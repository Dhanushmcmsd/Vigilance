/**
 * admin-create-user
 * ─────────────────────────────────────────────────────────────────────────────
 * Provisions a new user (officer / head / management / admin) on behalf of an
 * authenticated admin. Replaces the (broken + insecure) client-side
 * `supabase.auth.admin.createUser` call that used to live in the web Admin
 * Panel — `auth.admin` requires the service-role key, which must NEVER ship
 * to the browser. Every call from a browser client silently 401s.
 *
 * Security model:
 *   1. `verify_jwt = true` in config.toml — Supabase rejects unauthenticated
 *      requests before the function body runs.
 *   2. We additionally verify, with the caller's JWT, that
 *      `user_roles.role = 'admin'` for the caller. A leaked anon-key alone is
 *      not enough — you need a valid admin session.
 *   3. The actual auth.admin call uses the service-role key from
 *      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), which lives only in the
 *      Edge runtime (set via `supabase secrets set …`).
 *   4. Rate-limited to 10 creations / 5 min per caller (per-user bucket) to
 *      blunt credential-stuffing scripts that might use a stolen admin JWT.
 *
 * Transactional shape:
 *   create auth user  ──→  insert user_roles row  ──→  return password
 *                          │
 *                          └── on failure: delete the auth user we just made
 *
 * Request body:
 *   { email, password?, name, role, phone? }
 *   - password is optional. If omitted we generate a 14-char alphanumeric one
 *     and return it; the admin shares it with the user out-of-band.
 *
 * Response:
 *   200 → { user_id, password, generated: boolean }
 *   400 → validation error
 *   403 → caller is not an admin
 *   409 → an account already exists with this email
 *   429 → rate-limited
 *
 * Required env (set with `supabase secrets set …`):
 *   SUPABASE_URL                   (auto)
 *   SUPABASE_SERVICE_ROLE_KEY      (auto)
 *   SUPABASE_ANON_KEY              (auto)
 *
 * Optional env:
 *   UPSTASH_REDIS_REST_URL / TOKEN — enables the rate-limiter (no-ops without)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { rateLimit } from '../_shared/rateLimit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_ROLES = ['officer', 'head', 'management', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

interface CreateUserPayload {
  email: string;
  password?: string;
  name: string;
  role: AllowedRole;
  phone?: string;
}

// ── Validation ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePayload(p: unknown): { ok: true; value: CreateUserPayload } | { ok: false; error: string } {
  if (!p || typeof p !== 'object') return { ok: false, error: 'Body must be JSON.' };
  const x = p as Record<string, unknown>;

  const email = typeof x.email === 'string' ? x.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Invalid email address.' };

  const name = typeof x.name === 'string' ? x.name.trim() : '';
  if (name.length < 2) return { ok: false, error: 'Name is required.' };

  const role = x.role as AllowedRole;
  if (!ALLOWED_ROLES.includes(role)) {
    return { ok: false, error: `role must be one of ${ALLOWED_ROLES.join(', ')}.` };
  }

  const phone = typeof x.phone === 'string' ? x.phone.trim() : undefined;

  let password: string | undefined;
  if (x.password !== undefined && x.password !== null && x.password !== '') {
    if (typeof x.password !== 'string') {
      return { ok: false, error: 'password must be a string if provided.' };
    }
    if (x.password.length < 8) {
      return { ok: false, error: 'password must be at least 8 characters.' };
    }
    password = x.password;
  }

  return { ok: true, value: { email, name, role, phone, password } };
}

// 14 chars, alphabetic + digits + 1 symbol. Excludes 0/O/1/l/I to avoid
// transcription mistakes when the admin reads the password out loud.
function generatePassword(): string {
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbol = '!@#$%&*';
  const all = lowers + uppers + digits;
  const bytes = new Uint8Array(13);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += all[b % all.length];
  // Insert one symbol at a random position to satisfy aggressive password
  // policies. We pick the byte at the end to choose where.
  const last = new Uint8Array(1);
  crypto.getRandomValues(last);
  const symPos = last[0] % out.length;
  return out.slice(0, symPos) + symbol[bytes[0] % symbol.length] + out.slice(symPos);
}

// ── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // The Authorization header is mandatory (verify_jwt=true enforces this at
  // the platform edge too, but we still read it because we need the caller
  // JWT to look up their role with RLS in effect).
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  // ── 1. Identify the caller ────────────────────────────────────────────────
  // anon client + caller JWT → respects RLS; user_roles RLS already restricts
  // `SELECT` of own row + admin-can-see-all, so this works for an admin.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerAuth?.user) {
    return json({ error: 'Invalid or expired session.' }, 401);
  }

  const callerUid = callerAuth.user.id;

  // ── 2. RBAC: caller must be admin ─────────────────────────────────────────
  const { data: callerRole, error: roleErr } = await callerClient
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', callerUid)
    .maybeSingle();

  if (roleErr) {
    console.error('[admin-create-user] role lookup failed', roleErr);
    return json({ error: 'Could not verify caller permissions.' }, 500);
  }
  if (!callerRole || !callerRole.is_active || callerRole.role !== 'admin') {
    return json({ error: 'Only administrators can create users.' }, 403);
  }

  // ── 3. Rate-limit per admin caller ────────────────────────────────────────
  const rl = await rateLimit(req, {
    id: `admin-create-user:${callerUid}`,
    limit: 10,
    windowSeconds: 300,
  });
  if (!rl.allowed) return rl.response;

  // ── 4. Parse + validate payload ───────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be valid JSON.' }, 400);
  }
  const parsed = validatePayload(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { email, name, role, phone } = parsed.value;
  const generated = parsed.value.password === undefined;
  const password = parsed.value.password ?? generatePassword();

  // ── 5. Service-role client for the privileged ops ─────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pre-flight: surface a clean 409 instead of the cryptic Supabase auth
  // error. listUsers with a query filter is paginated; we only need to know
  // if any row exists, so page 1 / per_page 1 is enough.
  // (Supabase ignores `filter` for non-admin keys; we're using the service role.)
  // deno-lint-ignore no-explicit-any
  const { data: existing } = await (admin.auth.admin as any).listUsers({
    page: 1,
    perPage: 1,
    filter: `email.eq.${email}`,
  });
  if (existing?.users?.length) {
    return json({ error: 'An account with this email already exists.' }, 409);
  }

  // ── 6. Create auth user ────────────────────────────────────────────────────
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });
  if (authErr || !created?.user) {
    console.error('[admin-create-user] createUser failed', authErr);
    return json(
      { error: authErr?.message ?? 'Failed to create auth user.' },
      500,
    );
  }

  const newUserId = created.user.id;

  // ── 7. Link the role row, rolling back the auth user on failure ───────────
  const roleInsertPayload: Record<string, unknown> = {
    user_id: newUserId,
    email,
    name,
    role,
    phone: phone ?? null,
    is_active: true,
  };

  const { error: linkErr } = await admin.from('user_roles').insert(roleInsertPayload);

  if (linkErr) {
    console.error('[admin-create-user] user_roles insert failed; rolling back', linkErr);
    const { error: rbErr } = await admin.auth.admin.deleteUser(newUserId);
    if (rbErr) {
      console.error(
        '[admin-create-user] ROLLBACK FAILED — orphaned auth user',
        { newUserId, rbErr },
      );
    }
    return json(
      { error: `Could not link user role: ${linkErr.message}` },
      500,
    );
  }

  // ── 8. Done ───────────────────────────────────────────────────────────────
  return json(
    {
      user_id: newUserId,
      password,
      generated,
    },
    200,
  );
});
