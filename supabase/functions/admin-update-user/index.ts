/**
 * admin-update-user
 * ─────────────────────────────────────────────────────────────────────────────
 * Updates an existing user's auth credentials and user_roles profile on behalf
 * of an authenticated admin. Mirrors admin-create-user security: service-role
 * key never ships to the browser.
 *
 * Request body:
 *   { user_roles_id, email?, password?, name, role, phone? }
 *   - password is optional; only applied when non-empty (min 8 chars).
 *
 * Response:
 *   200 → { user_id }
 *   400 → validation error
 *   403 → caller is not an admin
 *   404 → user not found
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { rateLimit } from '../_shared/rateLimit.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALLOWED_ROLES = ['officer', 'head', 'management', 'admin', 'audit'] as const;
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UpdateUserPayload {
  user_roles_id: string;
  email: string;
  password?: string;
  name: string;
  role: AllowedRole;
  phone?: string;
}

function validatePayload(
  p: unknown,
): { ok: true; value: UpdateUserPayload } | { ok: false; error: string } {
  if (!p || typeof p !== 'object') return { ok: false, error: 'Body must be JSON.' };
  const x = p as Record<string, unknown>;

  const user_roles_id = typeof x.user_roles_id === 'string' ? x.user_roles_id.trim() : '';
  if (!user_roles_id) return { ok: false, error: 'user_roles_id is required.' };

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

  return { ok: true, value: { user_roles_id, email, name, role, phone, password } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerAuth?.user) {
    return json({ error: 'Invalid or expired session.' }, 401);
  }

  const callerUid = callerAuth.user.id;

  const { data: callerRole, error: roleErr } = await callerClient
    .from('user_roles')
    .select('role, is_active')
    .eq('user_id', callerUid)
    .maybeSingle();

  if (roleErr) {
    console.error('[admin-update-user] role lookup failed', roleErr);
    return json({ error: 'Could not verify caller permissions.' }, 500);
  }
  if (!callerRole || !callerRole.is_active || callerRole.role !== 'admin') {
    return json({ error: 'Only administrators can update users.' }, 403);
  }

  const rl = await rateLimit(req, {
    id: `admin-update-user:${callerUid}`,
    limit: 20,
    windowSeconds: 300,
  });
  if (!rl.allowed) return rl.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be valid JSON.' }, 400);
  }

  const parsed = validatePayload(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  const { user_roles_id, email, name, role, phone, password } = parsed.value;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: targetRow, error: targetErr } = await admin
    .from('user_roles')
    .select('id, user_id, email')
    .eq('id', user_roles_id)
    .maybeSingle();

  if (targetErr) {
    console.error('[admin-update-user] target lookup failed', targetErr);
    return json({ error: 'Could not load user.' }, 500);
  }
  if (!targetRow?.user_id) {
    return json({ error: 'User not found.' }, 404);
  }

  const authUpdate: { email?: string; password?: string } = {};
  if (email !== (targetRow.email ?? '').toLowerCase()) {
    authUpdate.email = email;
  }
  if (password) {
    authUpdate.password = password;
  }

  if (Object.keys(authUpdate).length > 0) {
    const { error: authErr } = await admin.auth.admin.updateUserById(
      targetRow.user_id,
      authUpdate,
    );
    if (authErr) {
      console.error('[admin-update-user] updateUserById failed', authErr);
      return json({ error: authErr.message }, 500);
    }
  }

  const { error: profileErr } = await admin
    .from('user_roles')
    .update({
      email,
      name,
      role,
      phone: phone ?? null,
    })
    .eq('id', user_roles_id);

  if (profileErr) {
    console.error('[admin-update-user] user_roles update failed', profileErr);
    return json({ error: profileErr.message }, 500);
  }

  return json({ user_id: targetRow.user_id }, 200);
});
