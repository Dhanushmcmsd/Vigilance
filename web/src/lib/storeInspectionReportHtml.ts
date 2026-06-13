import type { InspectionPdfData } from '../components/InspectionPdfReport';
import { isCompliantResponse } from './checklistScoring';
import { REPORT_HTML_CSS, riskTheme, scoreTheme, sectionTheme } from './reportTheme';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function responseBadgeClass(response: string | null | undefined): string {
  const value = (response ?? '').trim().toLowerCase();
  if (value === 'yes') return 'resp-yes';
  if (value === 'no') return 'resp-no';
  if (value === 'n/a' || !value) return 'resp-na';
  return 'resp-other';
}

function formatReportTime(value: string | null | undefined): string {
  if (!value) return '—';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function computeSectionStats(data: InspectionPdfData) {
  const grouped = new Map<string, { pass: number; fail: number; total: number }>();
  for (const response of data.responses) {
    const section = response.section || 'General';
    const bucket = grouped.get(section) ?? { pass: 0, fail: 0, total: 0 };
    const trigger = response.trigger_on_no ?? true;
    if (!response.response || response.response === 'N/A') {
      grouped.set(section, bucket);
      continue;
    }
    bucket.total += 1;
    if (isCompliantResponse(response.response, trigger)) bucket.pass += 1;
    else bucket.fail += 1;
    grouped.set(section, bucket);
  }
  return Array.from(grouped.entries()).map(([section, counts]) => {
    const scored = counts.pass + counts.fail;
    const compliance = scored ? Math.round((counts.pass / scored) * 100) : 0;
    return { section, ...counts, compliance };
  });
}

function buildComplianceChartHtml(stats: ReturnType<typeof computeSectionStats>): string {
  if (!stats.length) return '';
  const rows = stats
    .map((row) => {
      const color = row.compliance >= 80 ? '#059669' : row.compliance >= 60 ? '#d97706' : '#dc2626';
      return `
      <div class="chart-row">
        <div class="chart-label">${escapeHtml(row.section)}</div>
        <div class="chart-track">
          <div class="chart-fill" style="width:${row.compliance}%;background:${color};"></div>
        </div>
        <div class="chart-value">${row.compliance}%</div>
      </div>`;
    })
    .join('');

  return `
    <div class="chart-panel">
      <p class="chart-panel-title">Section Compliance Overview</p>
      ${rows}
    </div>`;
}

function buildKpiStrip(data: InspectionPdfData): string {
  const failCount = data.responses.filter((r) => {
    const trigger = r.trigger_on_no ?? true;
    return r.response && r.response !== 'N/A' && !isCompliantResponse(r.response, trigger);
  }).length;
  const passCount = data.responses.filter((r) => {
    const trigger = r.trigger_on_no ?? true;
    return r.response && isCompliantResponse(r.response, trigger);
  }).length;

  return `
    <div class="kpi-grid">
      <div class="kpi-box" style="border-color:#6ee7b7;background:#ecfdf5;">
        <div class="kpi-box-label">Compliance</div>
        <div class="kpi-box-value" style="color:${scoreTheme(data.complianceScore).text};">${data.complianceScore.toFixed(1)}%</div>
      </div>
      <div class="kpi-box" style="border-color:#fcd34d;background:#fffbeb;">
        <div class="kpi-box-label">Risk Level</div>
        <div class="kpi-box-value" style="color:${riskTheme(data.riskLevel).text};font-size:14px;">${escapeHtml(data.riskLevel.toUpperCase())}</div>
      </div>
      <div class="kpi-box" style="border-color:#86efac;background:#f0fdf4;">
        <div class="kpi-box-label">Compliant</div>
        <div class="kpi-box-value" style="color:#166534;">${passCount}</div>
      </div>
      <div class="kpi-box" style="border-color:#fca5a5;background:#fef2f2;">
        <div class="kpi-box-label">Non-Conformance</div>
        <div class="kpi-box-value" style="color:#b91c1c;">${failCount}</div>
      </div>
    </div>`;
}

export function buildStoreInspectionReportHtml(
  data: InspectionPdfData,
  options?: { documentTitle?: string },
): string {
  const title = options?.documentTitle ?? 'STORE INSPECTION REPORT';
  const score = scoreTheme(data.complianceScore);
  const risk = riskTheme(data.riskLevel);
  const sectionStats = computeSectionStats(data);

  const grouped = new Map<string, typeof data.responses>();
  for (const response of data.responses) {
    const section = response.section || 'General';
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section)!.push(response);
  }

  const sectionHtml = Array.from(grouped.entries())
    .map(([sec, items]) => {
      const theme = sectionTheme(sec);
      return `
    <div class="section-block">
      <div class="section-head" style="background:${theme.bg};border-color:${theme.border};color:${theme.text};">
        ${escapeHtml(sec)}
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width:6%">#</th>
            <th style="width:52%">Checklist item</th>
            <th style="width:14%">Response</th>
            <th style="width:28%">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((r, idx) => {
              const trigger = r.trigger_on_no ?? true;
              const violation = r.response && r.response !== 'N/A' && !isCompliantResponse(r.response, trigger);
              const rowClass = violation ? 'violation' : r.response === 'Yes' ? 'compliant' : '';
              return `
            <tr class="${rowClass}">
              <td style="font-weight:700;color:${theme.accent};text-align:center;">${idx + 1}</td>
              <td>${escapeHtml(r.item_text)}</td>
              <td style="text-align:center;"><span class="resp-badge ${responseBadgeClass(r.response)}">${escapeHtml(r.response ?? '—')}</span></td>
              <td>${escapeHtml(r.remarks ?? '')}</td>
            </tr>`;
            })
            .join('')}
        </tbody>
      </table>
    </div>`;
    })
    .join('');

  const allPhotos = [
    ...(data.photos ?? []),
    ...data.responses.flatMap((r) => (r.attachments ?? []).filter((a) => a.type !== 'document')),
  ];
  const seenUrls = new Set<string>();
  const uniquePhotos = allPhotos.filter((p) => {
    if (seenUrls.has(p.url)) return false;
    seenUrls.add(p.url);
    return true;
  });

  const photoHtml = uniquePhotos.length
    ? `
    <div class="section-block">
      <div class="section-head" style="background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;">Photo Evidence</div>
      <div class="photos">
        ${uniquePhotos
          .map(
            (photo) => `
          <div class="photo">
            <img src="${photo.url}" crossorigin="anonymous" />
            <p>${escapeHtml(photo.name ?? 'Inspection evidence')}</p>
          </div>`,
          )
          .join('')}
      </div>
    </div>`
    : '';

  const remarksHtml = data.generalRemark
    ? `<div class="section-block">
        <div class="section-head" style="background:#fdf2f8;border-color:#f9a8d4;color:#be185d;">General Remarks</div>
        <div style="padding:12px 14px;">${escapeHtml(data.generalRemark).split('\n').map((line) => `<p style="margin:0 0 8px;">${line}</p>`).join('')}</div>
      </div>`
    : '';

  const headCommentHtml = data.headComment
    ? `<div class="section-block">
        <div class="section-head" style="background:#fdf2f8;border-color:#f9a8d4;color:#be185d;">Supervisor Review</div>
        <div style="padding:12px 14px;">${escapeHtml(data.headComment)}</div>
      </div>`
    : '';

  const timeLine =
    data.timeIn || data.timeOut
      ? `<div class="report-time">Inspection Time: ${formatReportTime(data.timeIn)} – ${formatReportTime(data.timeOut)}</div>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${REPORT_HTML_CSS}</style></head><body>
  <div class="report-shell">
    <div class="report-hero">
      <h1>${escapeHtml(title)}</h1>
      <p>Official Field Inspection Document · Vigilance Management System</p>
    </div>

    <div class="report-tabs">
      <span class="report-tab active">Overview</span>
      <span class="report-tab">Compliance Chart</span>
      <span class="report-tab">Checklist Detail</span>
      <span class="report-tab">Evidence</span>
    </div>

    <div class="report-meta-grid">
      <div class="meta-card"><div class="meta-label">Location</div><div class="meta-value">${escapeHtml(data.branchName)}</div></div>
      <div class="meta-card"><div class="meta-label">Date</div><div class="meta-value">${escapeHtml(data.inspectionDate)}</div></div>
      <div class="meta-card"><div class="meta-label">Officer</div><div class="meta-value">${escapeHtml(data.officerName)}</div></div>
      <div class="meta-card accent-status"><div class="meta-label">Status</div><div class="meta-value">${escapeHtml(data.status.toUpperCase())}</div></div>
      <div class="meta-card accent-score" style="border-color:${score.border};background:${score.bg};"><div class="meta-label">Compliance</div><div class="meta-value" style="color:${score.text};">${data.complianceScore.toFixed(1)}%</div></div>
      <div class="meta-card accent-risk" style="border-color:${risk.border};background:${risk.bg};"><div class="meta-label">Risk Level</div><div class="meta-value" style="color:${risk.text};">${escapeHtml(data.riskLevel.toUpperCase())}</div></div>
    </div>

    ${timeLine}

    <div class="report-body">
      ${buildKpiStrip(data)}
      ${buildComplianceChartHtml(sectionStats)}
      ${headCommentHtml}
      ${sectionHtml}
      ${remarksHtml}
      ${photoHtml}
      <div class="summary-strip">
        <span>Overall Compliance: ${data.complianceScore.toFixed(1)}%</span>
        <span>Risk Level: ${escapeHtml(data.riskLevel.toUpperCase())}</span>
        <span>Inspector: ${escapeHtml(data.officerName)}</span>
        <span>Store Type: ${escapeHtml(data.branchType)}</span>
      </div>
    </div>

    <div class="report-footer">
      This report is an official field inspection document. Generated on ${escapeHtml(data.inspectionDate)} |
      ${escapeHtml(data.branchName)} Store | Officer: ${escapeHtml(data.officerName)} |
      System: Store Monitoring Division
    </div>
  </div>
  </body></html>`;
}
