// ============================================================
// supabase/functions/supervisor-otp
// Two routes selected by the `action` field in the request body:
//   action: 'send'   → generates a 6-digit OTP, hashes it with bcrypt,
//                       inserts a row into supervisor_acknowledgements,
//                       and emails the supervisor via Resend.
//   action: 'verify' → checks expiry + hash; on match, stamps
//                       acknowledged_at + supervisor lat/lng.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDR = Deno.env.get('ALERTS_FROM') ?? 'VMS Alerts <alerts@yourdomain.com>';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_TTL_SECONDS = OTP_TTL_MS / 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendPayload {
  action: 'send';
  inspection_id: string;
  checklist_item_id: string;
  supervisor_id?: string;
}

interface VerifyPayload {
  action: 'verify';
  inspection_id: string;
  checklist_item_id: string;
  otp: string;
  supervisor_lat?: number | null;
  supervisor_lng?: number | null;
}

type Payload = SendPayload | VerifyPayload;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as Payload;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (body.action === 'send') {
      return await handleSend(supabase, body);
    }
    if (body.action === 'verify') {
      return await handleVerify(supabase, body);
    }
    return json({ success: false, message: 'Unknown action' }, 400);
  } catch (err) {
    console.error('supervisor-otp error:', err);
    return json({ success: false, message: String(err) }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// Action: send
// ─────────────────────────────────────────────────────────────
async function handleSend(supabase: any, body: SendPayload): Promise<Response> {
  if (!body.inspection_id || !body.checklist_item_id) {
    return json({ success: false, message: 'inspection_id and checklist_item_id are required' }, 400);
  }

  const supervisorId = await resolveSupervisorId(supabase, body);
  if (!supervisorId) {
    return json({ success: false, message: 'No supervisor available' }, 404);
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  // Insert a new pending ack row. Multiple sends create multiple rows so we
  // can independently rate-limit resends; verify always uses the latest one.
  const { error: insertErr } = await supabase
    .from('supervisor_acknowledgements')
    .insert({
      inspection_id: body.inspection_id,
      checklist_item_id: body.checklist_item_id,
      supervisor_id: supervisorId,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
    });
  if (insertErr) {
    return json({ success: false, message: insertErr.message }, 500);
  }

  // Fetch supervisor email + branch context for the message body.
  const [{ data: supervisor }, { data: inspection }, { data: item }] = await Promise.all([
    supabase.from('user_roles').select('email, name').eq('id', supervisorId).maybeSingle(),
    supabase
      .from('inspections')
      .select('branch:branch_id ( branch_name )')
      .eq('id', body.inspection_id)
      .maybeSingle(),
    supabase
      .from('checklist_templates')
      .select('item_text')
      .eq('id', body.checklist_item_id)
      .maybeSingle(),
  ]);

  const supervisorEmail = (supervisor as any)?.email;
  let emailStatus: 'sent' | 'failed' | 'pending' = 'pending';
  let emailError: string | null = null;

  if (supervisorEmail) {
    try {
      const html = renderOtpEmail({
        supervisorName: (supervisor as any)?.name ?? 'Supervisor',
        branchName: (inspection as any)?.branch?.branch_name ?? 'a branch',
        itemText: (item as any)?.item_text ?? 'a RED-risk checklist item',
        otp,
      });
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_ADDR,
          to: supervisorEmail,
          subject: '🔴 Supervisor OTP — Vigilance RED escalation',
          html,
        }),
      });
      emailStatus = resp.ok ? 'sent' : 'failed';
      if (!resp.ok) emailError = `Resend HTTP ${resp.status}`;
    } catch (e) {
      emailStatus = 'failed';
      emailError = e instanceof Error ? e.message : String(e);
    }
  } else {
    emailStatus = 'failed';
    emailError = 'Supervisor has no email on record';
  }

  await supabase.from('notification_log').insert({
    inspection_id: body.inspection_id,
    escalation_id: null,
    recipient_id: supervisorId,
    channel: 'email',
    template: 'SUPERVISOR_OTP',
    status: emailStatus,
    sent_at: emailStatus === 'sent' ? new Date().toISOString() : null,
    error_message: emailError,
  });

  return json({
    success: true,
    expires_in: OTP_TTL_SECONDS,
    email_status: emailStatus,
  });
}

// ─────────────────────────────────────────────────────────────
// Action: verify
// ─────────────────────────────────────────────────────────────
async function handleVerify(supabase: any, body: VerifyPayload): Promise<Response> {
  if (!body.inspection_id || !body.checklist_item_id || !body.otp) {
    return json({ success: false, message: 'inspection_id, checklist_item_id and otp are required' }, 400);
  }

  // Pick the most recent un-acknowledged record for this item.
  const { data: row, error } = await supabase
    .from('supervisor_acknowledgements')
    .select('id, otp_hash, otp_expires_at, acknowledged_at')
    .eq('inspection_id', body.inspection_id)
    .eq('checklist_item_id', body.checklist_item_id)
    .is('acknowledged_at', null)
    .order('otp_expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return json({ success: false, message: error.message }, 500);
  if (!row) return json({ success: false, message: 'No pending OTP found' }, 404);

  const expired = new Date(row.otp_expires_at).getTime() <= Date.now();
  if (expired) {
    return json({ success: false, message: 'OTP expired' }, 410);
  }

  const matches = await bcrypt.compare(body.otp, row.otp_hash);
  if (!matches) {
    return json({ success: false, message: 'Invalid OTP' }, 400);
  }

  const { error: updateErr } = await supabase
    .from('supervisor_acknowledgements')
    .update({
      acknowledged_at: new Date().toISOString(),
      supervisor_lat: body.supervisor_lat ?? null,
      supervisor_lng: body.supervisor_lng ?? null,
    })
    .eq('id', row.id);

  if (updateErr) {
    return json({ success: false, message: updateErr.message }, 500);
  }

  return json({ success: true });
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function generateOtp(): string {
  // 6-digit numeric, leading zeros allowed.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, '0');
}

async function resolveSupervisorId(supabase: any, body: SendPayload): Promise<string | null> {
  if (body.supervisor_id) return body.supervisor_id;
  // Fall back to the first active head — production should later resolve by
  // branch ownership.
  const { data } = await supabase
    .from('user_roles')
    .select('id')
    .eq('role', 'head')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function renderOtpEmail(opts: {
  supervisorName: string;
  branchName: string;
  itemText: string;
  otp: string;
}): string {
  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#DC2626;color:#fff;padding:18px 24px;">
      <div style="font-size:13px;letter-spacing:1px;font-weight:700;opacity:0.85;">SUPERVISOR ACKNOWLEDGEMENT</div>
      <div style="font-size:18px;font-weight:800;margin-top:4px;">${escape(opts.branchName)}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;font-size:14px;color:#1f2937;">Hi ${escape(opts.supervisorName)},</p>
      <p style="margin:0 0 14px;font-size:14px;color:#1f2937;line-height:1.5;">
        A RED-risk item is being flagged at <strong>${escape(opts.branchName)}</strong>:
      </p>
      <blockquote style="margin:0 0 16px;padding:10px 14px;background:#FEF2F2;border-left:4px solid #DC2626;font-size:13px;color:#7f1d1d;border-radius:6px;">
        ${escape(opts.itemText)}
      </blockquote>
      <p style="margin:0 0 8px;font-size:13px;color:#4b5563;">Share this OTP with the officer on site:</p>
      <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f9fafb;padding:16px;border-radius:10px;color:#111827;">
        ${escape(opts.otp)}
      </div>
      <p style="margin:14px 0 0;font-size:11px;color:#94a3b8;text-align:center;">
        Expires in 10 minutes. Do not share this OTP outside the inspection.
      </p>
    </div>
  </div>
</body></html>`;
}

function escape(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
