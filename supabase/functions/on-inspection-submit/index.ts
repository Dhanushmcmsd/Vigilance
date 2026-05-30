import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { rateLimit } from '../_shared/rateLimit.ts';
import { resolveResendFrom } from '../_shared/resendFrom.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') ?? 'https://vigilance-web.vercel.app';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_ADDR = resolveResendFrom();

serve(async (req: Request) => {
  try {
    // Rate limit BEFORE parsing the body. Two buckets:
    //   1. Per-caller (JWT sub if signed-in, else IP) — generous limit since
    //      this is normally invoked from the DB webhook, not direct clients.
    //   2. Global emergency brake — if the webhook ever loops (we've seen
    //      this happen during status churn), this stops a runaway from
    //      DOSing Resend.
    const perCaller = await rateLimit(req, {
      id: 'on-inspection-submit:caller',
      limit: 60,
      windowSeconds: 60,
    });
    if (!perCaller.allowed) return perCaller.response!;

    const global = await rateLimit(req, {
      id: 'on-inspection-submit:global',
      limit: 600,
      windowSeconds: 60,
      identifier: 'global',
    });
    if (!global.allowed) return global.response!;

    const payload = await req.json();
    const record = payload.record;
    if (!record || record.status !== 'submitted') {
      return new Response('Skipped', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch inspection details
    const { data: insp } = await supabase
      .from('inspections')
      .select(`id, created_at, time_in, time_out, compliance_score, risk_level, general_remarks,
        user_roles(name, email),
        branches(name, branch_type, city),
        inspection_responses(response, remarks, checklist_items(section, item_text))`)
      .eq('id', record.id)
      .single();

    if (!insp) return new Response('Inspection not found', { status: 404 });

    // Fetch head emails
    const { data: heads } = await supabase
      .from('user_roles')
      .select('email, name')
      .eq('role', 'head')
      .eq('is_active', true);

    if (!heads?.length) return new Response('No head found', { status: 200 });

    const isUrgent = ['critical', 'high'].includes(insp.risk_level);
    const noResponses = (insp.inspection_responses as any[])
      .filter((r: any) => r.response === 'No');

    const noItemsHtml = noResponses.length > 0
      ? `<h3 style="color:#dc2626">Failed Items (${noResponses.length})</h3>
         <ul>${noResponses.map((r: any) => `<li><strong>${r.checklist_items?.section ?? ''}</strong>: ${r.checklist_items?.item_text ?? ''}${r.remarks ? ` — <em>${r.remarks}</em>` : ''}</li>`).join('')}</ul>`
      : '<p>No failed items.</p>';

    const urgentBanner = isUrgent
      ? `<div style="background:#fee2e2;border:2px solid #dc2626;border-radius:8px;padding:16px;margin:16px 0;">
           <strong style="color:#dc2626;font-size:18px;">&#9888; IMMEDIATE REVIEW REQUIRED</strong>
         </div>`
      : '';

    const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:640px;margin:auto;padding:24px;">
  <h1 style="color:#1e3a5f">VMS — Vigilance Management System</h1>
  <h2>New Inspection Submitted</h2>
  ${urgentBanner}
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr style="background:#f1f5f9;"><td style="padding:8px;font-weight:bold;">Branch</td><td style="padding:8px;">${(insp as any).branches?.name ?? '—'} (${(insp as any).branches?.branch_type ?? ''})</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Officer</td><td style="padding:8px;">${(insp as any).user_roles?.name ?? '—'}</td></tr>
    <tr style="background:#f1f5f9;"><td style="padding:8px;font-weight:bold;">Date</td><td style="padding:8px;">${new Date(insp.created_at).toLocaleDateString('en-IN')}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Compliance Score</td><td style="padding:8px;">${insp.compliance_score ?? '—'}%</td></tr>
    <tr style="background:#f1f5f9;"><td style="padding:8px;font-weight:bold;">Risk Level</td><td style="padding:8px;color:${insp.risk_level === 'critical' ? '#dc2626' : insp.risk_level === 'high' ? '#ea580c' : '#16a34a'}">${insp.risk_level?.toUpperCase() ?? '—'}</td></tr>
  </table>
  ${noItemsHtml}
  <div style="margin-top:24px;">
    <a href="${DASHBOARD_URL}/head/review" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Review Now</a>
  </div>
</body></html>`;

    // Send emails to all heads
    for (const head of heads) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_ADDR,
          to: head.email,
          subject: `[${isUrgent ? 'URGENT' : 'NEW'}] Inspection Submitted — ${(insp as any).branches?.name ?? 'Branch'} — Risk: ${insp.risk_level?.toUpperCase()}`,
          html,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
