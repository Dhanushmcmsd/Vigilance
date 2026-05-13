// ============================================================
// supabase/functions/red-alert
// Sends RED-risk escalation emails to Store Manager, Area
// Supervisor (head) and Legal team, plus MD/Management when
// red_count >= 2. Also handles YELLOW_REALTIME notifications.
// Writes one row per recipient into public.notification_log.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') ?? 'https://your-dashboard.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FROM_ADDR = Deno.env.get('ALERTS_FROM') ?? 'VMS Alerts <alerts@yourdomain.com>';

interface RedAlertPayload {
  inspection_id: string;
  checklist_item_id?: string;
  officer_id?: string;
  branch_id?: string;
  red_count?: number;
  yellow_count?: number;
  template?: 'RED_ALERT' | 'YELLOW_REALTIME';
}

interface RecipientRow {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const otpRefId = crypto.randomUUID();

  try {
    const body = (await req.json()) as RedAlertPayload;
    const template = body.template ?? 'RED_ALERT';

    if (!body.inspection_id) {
      return json({ success: false, error: 'inspection_id is required' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [{ data: inspection }, { data: item }, { data: risk }] = await Promise.all([
      supabase
        .from('inspections')
        .select(`
          id, inspection_date, submitted_at, status,
          officer:officer_id ( id, name, email ),
          branch:branch_id ( id, branch_name, city, region )
        `)
        .eq('id', body.inspection_id)
        .maybeSingle(),
      body.checklist_item_id
        ? supabase
            .from('checklist_templates')
            .select('id, item_text, section')
            .eq('id', body.checklist_item_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
      body.checklist_item_id
        ? supabase
            .from('risk_classifications')
            .select('risk_level, statutory_act, legal_notes')
            .eq('checklist_item_id', body.checklist_item_id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    if (!inspection) {
      return json({ success: false, error: 'Inspection not found' }, 404);
    }

    const officer = (inspection as any).officer ?? {};
    const branch = (inspection as any).branch ?? {};

    // Resolve recipients by role. For the MVP we email every active user
    // whose role matches; production can later route by branch ownership.
    const targetRoles = template === 'YELLOW_REALTIME' ? ['head'] : ['head', 'admin'];
    const escalateToManagement =
      template === 'RED_ALERT' && (body.red_count ?? 1) >= 2;
    if (escalateToManagement) targetRoles.push('management');

    const { data: recipients } = await supabase
      .from('user_roles')
      .select('id, email, name, role')
      .in('role', targetRoles)
      .eq('is_active', true);

    const validRecipients: RecipientRow[] = (recipients ?? []).filter(
      (r: RecipientRow) => !!r.email,
    );

    const subjectBranch = branch.branch_name ?? 'Unknown Branch';
    const itemText = (item as any)?.item_text ?? '—';
    const statutoryAct = (risk as any)?.statutory_act as string | null;
    const legalNotes = (risk as any)?.legal_notes as string | null;
    const isYellow = template === 'YELLOW_REALTIME';

    const subject = isYellow
      ? `🟡 YELLOW THRESHOLD — ${subjectBranch} — ${body.yellow_count ?? 0} items flagged`
      : `🔴 RED RISK ALERT — ${subjectBranch} — ${itemText}`;

    const html = renderEmail({
      isYellow,
      branchName: subjectBranch,
      city: branch.city,
      region: branch.region,
      officerName: officer.name ?? 'Officer',
      itemText,
      statutoryAct,
      legalNotes,
      redCount: body.red_count,
      yellowCount: body.yellow_count,
      inspectionId: body.inspection_id,
    });

    // Fan-out: send + log per recipient. Continue on individual failures so a
    // single bad email never blocks the rest of the alerts.
    const logRows: Array<Record<string, unknown>> = [];

    await Promise.all(
      validRecipients.map(async (r) => {
        let status: 'sent' | 'failed' = 'sent';
        let errorMessage: string | null = null;
        try {
          const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_ADDR,
              to: r.email,
              subject,
              html,
            }),
          });
          if (!resp.ok) {
            status = 'failed';
            errorMessage = `Resend HTTP ${resp.status}`;
          }
        } catch (e) {
          status = 'failed';
          errorMessage = e instanceof Error ? e.message : String(e);
        }

        logRows.push({
          inspection_id: body.inspection_id,
          escalation_id: null,
          recipient_id: r.id,
          channel: 'email',
          template,
          status,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
          error_message: errorMessage,
        });
      }),
    );

    if (logRows.length) {
      await supabase.from('notification_log').insert(logRows);
    }

    return json({
      success: true,
      otp_ref_id: otpRefId,
      recipients: validRecipients.length,
      template,
    });
  } catch (err) {
    console.error('red-alert error:', err);
    return json({ success: false, error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function renderEmail(opts: {
  isYellow: boolean;
  branchName: string;
  city?: string | null;
  region?: string | null;
  officerName: string;
  itemText: string;
  statutoryAct: string | null;
  legalNotes: string | null;
  redCount?: number;
  yellowCount?: number;
  inspectionId: string;
}): string {
  const accent = opts.isYellow ? '#D97706' : '#DC2626';
  const tint = opts.isYellow ? '#FFFBEB' : '#FEF2F2';
  const headline = opts.isYellow
    ? `${opts.yellowCount ?? 0} YELLOW items flagged in a single inspection`
    : 'IMMEDIATE ACTION REQUIRED — RED risk item triggered';

  const legalSection = opts.statutoryAct
    ? `<p style="margin:8px 0 0;font-size:13px;"><strong>Statutory Act:</strong> ${escape(opts.statutoryAct)}</p>` +
      (opts.legalNotes ? `<p style="margin:4px 0 0;font-size:13px;color:#4b5563;">${escape(opts.legalNotes)}</p>` : '')
    : '';

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:${accent};padding:18px 24px;color:#fff;">
      <div style="font-size:13px;letter-spacing:1px;font-weight:700;opacity:0.85;">${
        opts.isYellow ? 'YELLOW REALTIME ALERT' : 'RED RISK ALERT'
      }</div>
      <div style="font-size:18px;font-weight:800;margin-top:4px;">${escape(opts.branchName)}</div>
    </div>
    <div style="padding:24px;">
      <div style="background:${tint};border-left:4px solid ${accent};padding:12px 14px;border-radius:6px;margin-bottom:16px;">
        <strong style="color:${accent}">${escape(headline)}</strong>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;">Officer</td><td style="padding:6px 0;font-weight:600;">${escape(opts.officerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Branch</td><td style="padding:6px 0;font-weight:600;">${escape(opts.branchName)}${opts.city ? `, ${escape(opts.city)}` : ''}${opts.region ? ` (${escape(opts.region)})` : ''}</td></tr>
        ${
          opts.isYellow
            ? `<tr><td style="padding:6px 0;color:#6b7280;">YELLOW count</td><td style="padding:6px 0;font-weight:600;">${opts.yellowCount ?? 0}</td></tr>`
            : `<tr><td style="padding:6px 0;color:#6b7280;">Item</td><td style="padding:6px 0;font-weight:600;">${escape(opts.itemText)}</td></tr>
               <tr><td style="padding:6px 0;color:#6b7280;">RED count</td><td style="padding:6px 0;font-weight:600;">${opts.redCount ?? 1}</td></tr>`
        }
        <tr><td style="padding:6px 0;color:#6b7280;">Timestamp</td><td style="padding:6px 0;font-weight:600;">${new Date().toLocaleString('en-IN')}</td></tr>
      </table>
      ${legalSection}
      <div style="margin-top:24px;text-align:center;">
        <a href="${DASHBOARD_URL}/head?inspection=${opts.inspectionId}"
           style="display:inline-block;background:${accent};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">
          Open Escalation
        </a>
      </div>
      <p style="margin-top:18px;font-size:11px;color:#94a3b8;text-align:center;">
        Vigilance Management System • Automated alert
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
