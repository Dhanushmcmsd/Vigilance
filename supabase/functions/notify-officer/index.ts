/**
 * notify-officer
 * ─────────────────────────────────────────────────────────────────────────────
 * Fires after an inspection's status changes to `approved`, `rejected`, or
 * (rare) back to `submitted` (clarification requested by the head). Three
 * effects:
 *
 *   1. Insert a row into `public.notifications` — drives the in-app bell.
 *   2. Send an Expo Push notification when `user_roles.expo_push_token` is
 *      registered for the officer.
 *   3. Send an email via Resend to the officer's address (joined from
 *      auth.users since `user_roles.email` is denormalised and may be NULL).
 *
 * Invocation paths:
 *   - The web HeadReview calls this with supabase.functions.invoke('notify-officer', …)
 *     after each approve / reject / request-clarification action.
 *   - It can also be hooked to a Postgres Webhook on `inspections` UPDATE
 *     where (NEW.status <> OLD.status). See README for the SQL snippet.
 *
 * Required env (set via `supabase secrets set …`):
 *   SUPABASE_URL                 — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY    — auto-injected
 *   RESEND_API_KEY               — Resend API key
 *   RESEND_FROM                  — verified "from" address (optional, default below)
 *   DASHBOARD_URL                — public URL for deep links (optional)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { resolveResendFrom } from '../_shared/resendFrom.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = resolveResendFrom();
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') ?? 'https://vigilance-web.vercel.app';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

interface DistrictReassignedPayload {
  officer_role_id: string;
  district: string;
  notification_id?: string;
}

interface StoreAssignedPayload {
  officer_role_id: string;
  branch_name: string;
  district: string;
  notification_id?: string;
}

interface StoreUnassignedPayload {
  officer_role_id: string;
  branch_name: string;
  district: string;
}

interface NotifyPayload {
  inspection_id?: string;
  status?: 'approved' | 'rejected' | 'submitted';
  head_comment?: string | null;
  /** Optional override — useful when called from a DB trigger that doesn't auth. */
  recipient_role_id?: string;
  district_reassigned?: DistrictReassignedPayload;
  store_assigned?: StoreAssignedPayload;
  store_unassigned?: StoreUnassignedPayload;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, 405);
  }

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  if (payload?.district_reassigned) {
    return handleDistrictReassigned(supabase, payload.district_reassigned);
  }

  if (payload?.store_assigned) {
    return handleStoreAssigned(supabase, payload.store_assigned);
  }

  if (payload?.store_unassigned) {
    return handleStoreUnassigned(supabase, payload.store_unassigned);
  }

  if (!payload?.inspection_id || !payload?.status) {
    return jsonResponse(
      { error: 'inspection_id and status are required' },
      400,
    );
  }

  // 1. Resolve inspection + officer + branch.
  const { data: insp, error: inspErr } = await supabase
    .from('inspections')
    .select(
      `id, status, head_comment, compliance_score, inspection_date,
       officer:user_roles!inspections_officer_id_fkey ( id, name, email, expo_push_token, user_id ),
       branch:branches!inspections_branch_id_fkey ( branch_name )`,
    )
    .eq('id', payload.inspection_id)
    .maybeSingle();

  if (inspErr) return jsonResponse({ error: inspErr.message }, 500);
  if (!insp) return jsonResponse({ error: 'inspection not found' }, 404);

  const officerRow = Array.isArray(insp.officer) ? insp.officer[0] : insp.officer;
  const branchRow = Array.isArray(insp.branch) ? insp.branch[0] : insp.branch;

  if (!officerRow) {
    return jsonResponse({ error: 'officer not resolvable' }, 422);
  }

  // 2. Resolve officer email. Prefer the denormalised column; fall back to
  //    auth.users via the service-role admin API. This is what makes the
  //    function work even if you haven't backfilled user_roles.email yet.
  let officerEmail: string | null = officerRow.email ?? null;
  if (!officerEmail && officerRow.user_id) {
    const { data: authUser } = await supabase.auth.admin.getUserById(
      officerRow.user_id,
    );
    officerEmail = authUser?.user?.email ?? null;
  }

  const branchName = branchRow?.branch_name ?? 'Branch';
  const officerName = officerRow.name ?? 'Officer';

  // 3. Compose copy.
  const { title, body, type, color } = composeMessage(
    payload.status,
    branchName,
    payload.head_comment ?? insp.head_comment ?? null,
  );

  // 4. Insert notification row (drives the in-app bell + realtime).
  const link = `${DASHBOARD_URL}/officer/submissions/${insp.id}`;
  const { error: notifErr } = await supabase.from('notifications').insert({
    recipient_id: officerRow.id,
    inspection_id: insp.id,
    type,
    title,
    body,
    link,
  });
  if (notifErr) {
    console.error('notifications insert failed', notifErr);
  }

  // 5. Push + email in parallel; we don't fail the request if either fails —
  //    the in-app notification is the source of truth.
  const results = await Promise.allSettled([
    sendExpoPush(officerRow.expo_push_token, title, body, {
      inspection_id: insp.id,
      type,
    }),
    officerEmail
      ? sendResendEmail({
          to: officerEmail,
          subject: title,
          html: emailHtml({
            title,
            body,
            branchName,
            officerName,
            score: insp.compliance_score,
            color,
            link,
            comment: payload.head_comment ?? insp.head_comment ?? null,
          }),
        })
      : Promise.resolve({ skipped: 'no-email' }),
  ]);

  return jsonResponse({
    ok: true,
    notification_inserted: !notifErr,
    push: summarise(results[0]),
    email: summarise(results[1]),
  });
});

// ── helpers ───────────────────────────────────────────────────────────────

async function handleDistrictReassigned(
  supabase: ReturnType<typeof createClient>,
  payload: DistrictReassignedPayload,
) {
  const { data: officerRow, error: officerErr } = await supabase
    .from('user_roles')
    .select('id, name, expo_push_token')
    .eq('id', payload.officer_role_id)
    .maybeSingle();

  if (officerErr) return jsonResponse({ error: officerErr.message }, 500);
  if (!officerRow) return jsonResponse({ error: 'officer not found' }, 404);

  const title = '📍 New District Assigned';
  const body =
    `You have been assigned to cover ${payload.district} district stores. Tap to view your updated store list.`;

  const pushResult = await sendExpoPush(officerRow.expo_push_token, title, body, {
    type: 'district_reassigned',
    district: payload.district,
    notification_id: payload.notification_id ?? null,
    screen: 'StoreList',
  });

  return jsonResponse({ ok: true, push: pushResult });
}

async function handleStoreAssigned(
  supabase: ReturnType<typeof createClient>,
  payload: StoreAssignedPayload,
) {
  const { data: officerRow, error: officerErr } = await supabase
    .from('user_roles')
    .select('id, name, expo_push_token')
    .eq('id', payload.officer_role_id)
    .maybeSingle();

  if (officerErr) return jsonResponse({ error: officerErr.message }, 500);
  if (!officerRow) return jsonResponse({ error: 'officer not found' }, 404);

  const title = '🏪 New Store Assigned';
  const body = `${payload.branch_name} in ${payload.district} has been assigned to you.`;

  const pushResult = await sendExpoPush(officerRow.expo_push_token, title, body, {
    type: 'store_assigned',
    branch_name: payload.branch_name,
    district: payload.district,
    notification_id: payload.notification_id ?? null,
    screen: 'StoreList',
  });

  return jsonResponse({ ok: true, push: pushResult });
}

async function handleStoreUnassigned(
  supabase: ReturnType<typeof createClient>,
  payload: StoreUnassignedPayload,
) {
  const { data: officerRow, error: officerErr } = await supabase
    .from('user_roles')
    .select('id, name, expo_push_token')
    .eq('id', payload.officer_role_id)
    .maybeSingle();

  if (officerErr) return jsonResponse({ error: officerErr.message }, 500);
  if (!officerRow) return jsonResponse({ error: 'officer not found' }, 404);

  const title = '🏪 Store Reassigned';
  const body = `${payload.branch_name} in ${payload.district} is no longer assigned to you.`;

  const pushResult = await sendExpoPush(officerRow.expo_push_token, title, body, {
    type: 'store_unassigned',
    branch_name: payload.branch_name,
    district: payload.district,
    screen: 'StoreList',
  });

  return jsonResponse({ ok: true, push: pushResult });
}

function composeMessage(
  status: 'approved' | 'rejected' | 'submitted',
  branchName: string,
  comment: string | null,
) {
  if (status === 'approved') {
    return {
      title: `Inspection approved — ${branchName}`,
      body: comment
        ? `Your supervisor approved this inspection. Note: ${comment}`
        : 'Your supervisor approved this inspection. Great work.',
      type: 'inspection_approved',
      color: '#15803d',
    };
  }
  if (status === 'rejected') {
    return {
      title: `Inspection rejected — ${branchName}`,
      body: comment
        ? `Your supervisor rejected this inspection. Reason: ${comment}`
        : 'Your supervisor rejected this inspection. Please re-inspect.',
      type: 'inspection_rejected',
      color: '#b91c1c',
    };
  }
  // 'submitted' = clarification requested back to officer.
  return {
    title: `Clarification requested — ${branchName}`,
    body: comment
      ? `Your supervisor needs more detail: ${comment}`
      : 'Your supervisor has requested clarification on this inspection.',
    type: 'clarification_requested',
    color: '#b45309',
  };
}

async function sendExpoPush(
  token: string | null | undefined,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!token || !token.startsWith('ExponentPushToken')) {
    return { skipped: 'no-token' };
  }
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'inspections',
    }),
  });
  if (!res.ok) throw new Error(`expo push ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sendResendEmail(args: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) return { skipped: 'no-resend-key' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return res.json();
}

function emailHtml(args: {
  title: string;
  body: string;
  branchName: string;
  officerName: string;
  score: number | null;
  color: string;
  link: string;
  comment: string | null;
}) {
  return `<!DOCTYPE html><html><body style="font-family:Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111827;">
  <h1 style="color:#1e3a8a;font-size:18px;margin-bottom:24px">Vigilance Management System</h1>
  <div style="border-left:4px solid ${args.color};padding:12px 16px;background:#f9fafb;border-radius:0 8px 8px 0;margin-bottom:16px">
    <div style="font-size:16px;font-weight:600;color:${args.color}">${escapeHtml(args.title)}</div>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.55">${escapeHtml(args.body)}</p>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
    <tr><td style="padding:6px 0;color:#6b7280">Officer</td><td style="padding:6px 0;font-weight:600">${escapeHtml(args.officerName)}</td></tr>
    <tr><td style="padding:6px 0;color:#6b7280">Branch</td><td style="padding:6px 0;font-weight:600">${escapeHtml(args.branchName)}</td></tr>
    ${args.score != null ? `<tr><td style="padding:6px 0;color:#6b7280">Compliance</td><td style="padding:6px 0;font-weight:600">${args.score}%</td></tr>` : ''}
    ${args.comment ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top">Comment</td><td style="padding:6px 0">${escapeHtml(args.comment)}</td></tr>` : ''}
  </table>
  <a href="${args.link}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Open inspection</a>
  <p style="margin-top:24px;font-size:11px;color:#9ca3af">You're receiving this because you submitted the inspection above.</p>
</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&'
      ? '&amp;'
      : c === '<'
        ? '&lt;'
        : c === '>'
          ? '&gt;'
          : c === '"'
            ? '&quot;'
            : '&#39;',
  );
}

function summarise(r: PromiseSettledResult<unknown>) {
  return r.status === 'fulfilled'
    ? { ok: true, value: r.value }
    : { ok: false, error: String((r as PromiseRejectedResult).reason) };
}
