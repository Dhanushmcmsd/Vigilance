import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { resolveResendFrom } from '../_shared/resendFrom.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') ?? 'https://vigilance-web.vercel.app';
const FROM_ADDR = resolveResendFrom();

serve(async (_req: Request) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // This week's inspections
    const { data: thisWeek } = await supabase
      .from('inspections')
      .select(`id, compliance_score, risk_level, status, created_at,
        branches(name, branch_type),
        inspection_responses(response, checklist_items(section, item_text))`)
      .gte('created_at', weekAgo.toISOString())
      .in('status', ['submitted', 'approved', 'rejected']);

    // Last week's inspections for trend
    const { data: lastWeek } = await supabase
      .from('inspections')
      .select('id, compliance_score')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())
      .in('status', ['submitted', 'approved', 'rejected']);

    const thisWeekData = thisWeek ?? [];
    const lastWeekData = lastWeek ?? [];

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const thisAvg = avg(thisWeekData.map((i: any) => i.compliance_score ?? 0));
    const lastAvg = avg(lastWeekData.map((i: any) => i.compliance_score ?? 0));
    const trend = thisAvg - lastAvg;
    const trendStr = trend >= 0 ? `↑ +${trend.toFixed(1)}%` : `↓ ${trend.toFixed(1)}%`;

    const cfcInsp = thisWeekData.filter((i: any) => i.branches?.branch_type === 'CFC');
    const storeInsp = thisWeekData.filter((i: any) => i.branches?.branch_type === 'Store');
    const cfcAvg = avg(cfcInsp.map((i: any) => i.compliance_score ?? 0));
    const storeAvg = avg(storeInsp.map((i: any) => i.compliance_score ?? 0));

    // Branch compliance ranking
    const branchMap: Record<string, { name: string; scores: number[] }> = {};
    thisWeekData.forEach((i: any) => {
      const bn = i.branches?.name ?? 'Unknown';
      if (!branchMap[bn]) branchMap[bn] = { name: bn, scores: [] };
      branchMap[bn].scores.push(i.compliance_score ?? 0);
    });
    const branchRanking = Object.values(branchMap)
      .map(b => ({ name: b.name, avg: avg(b.scores) }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);

    // Top issues
    const issueMap: Record<string, { text: string; section: string; count: number }> = {};
    thisWeekData.forEach((i: any) => {
      (i.inspection_responses ?? []).forEach((r: any) => {
        if (r.response === 'No' && r.checklist_items) {
          const key = r.checklist_items.item_text;
          if (!issueMap[key]) issueMap[key] = { text: key, section: r.checklist_items.section, count: 0 };
          issueMap[key].count++;
        }
      });
    });
    const topIssues = Object.values(issueMap).sort((a, b) => b.count - a.count).slice(0, 5);

    const branchRankHtml = branchRanking.map((b, i) =>
      `<tr style="background:${i % 2 === 0 ? '#f1f5f9' : 'white'}">
        <td style="padding:8px;">${i + 1}</td>
        <td style="padding:8px;">${b.name}</td>
        <td style="padding:8px;color:${b.avg < 60 ? '#dc2626' : b.avg < 80 ? '#d97706' : '#16a34a'};font-weight:bold;">${b.avg.toFixed(1)}%</td>
      </tr>`
    ).join('');

    const topIssuesHtml = topIssues.map((issue, i) =>
      `<tr style="background:${i % 2 === 0 ? '#f1f5f9' : 'white'}">
        <td style="padding:8px;">${i + 1}</td>
        <td style="padding:8px;">${issue.section}</td>
        <td style="padding:8px;">${issue.text}</td>
        <td style="padding:8px;font-weight:bold;color:#dc2626;">${issue.count}</td>
      </tr>`
    ).join('');

    const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:680px;margin:auto;padding:24px;">
  <h1 style="color:#1e3a5f">VMS Weekly Report</h1>
  <p style="color:#64748b;">${weekAgo.toLocaleDateString('en-IN')} — ${now.toLocaleDateString('en-IN')}</p>

  <h2>Summary</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#f1f5f9;"><td style="padding:8px;font-weight:bold;">Total Inspections</td><td style="padding:8px;">${thisWeekData.length}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Average Compliance</td><td style="padding:8px;">${thisAvg.toFixed(1)}% <span style="color:${trend >= 0 ? '#16a34a' : '#dc2626'}">${trendStr} vs last week</span></td></tr>
    <tr style="background:#f1f5f9;"><td style="padding:8px;font-weight:bold;">CFC Average</td><td style="padding:8px;">${cfcAvg.toFixed(1)}% (${cfcInsp.length} inspections)</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Store Average</td><td style="padding:8px;">${storeAvg.toFixed(1)}% (${storeInsp.length} inspections)</td></tr>
  </table>

  <h2>Worst Performing Branches (Top 5)</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#1e3a5f;color:white;"><th style="padding:8px;">#</th><th style="padding:8px;">Branch</th><th style="padding:8px;">Avg Compliance</th></tr>
    ${branchRankHtml}
  </table>

  <h2>Top 5 Recurring Issues</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr style="background:#1e3a5f;color:white;"><th style="padding:8px;">#</th><th style="padding:8px;">Section</th><th style="padding:8px;">Item</th><th style="padding:8px;">Count</th></tr>
    ${topIssuesHtml}
  </table>

  <div style="margin-top:24px;">
    <a href="${DASHBOARD_URL}/management" style="background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Dashboard</a>
  </div>
  <p style="margin-top:32px;color:#94a3b8;font-size:12px;">This is an automated report from Vigilance Management System. Do not reply to this email.</p>
</body></html>`;

    // Fetch management + head users
    const { data: recipients } = await supabase
      .from('user_roles')
      .select('email, name')
      .in('role', ['head', 'management'])
      .eq('is_active', true);

    for (const r of recipients ?? []) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_ADDR,
          to: r.email,
          subject: `VMS Weekly Report — ${weekAgo.toLocaleDateString('en-IN')} to ${now.toLocaleDateString('en-IN')}`,
          html,
        }),
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: recipients?.length ?? 0 }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
