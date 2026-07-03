import type { AuditReportRow } from './auditReports';
import {
  collectInspectionImageFiles,
  resolveInspectionMediaUrls,
  type InspectionAnswerPhoto,
  type InspectionMediaFile,
} from './inspectionMedia';
import { REPORT_HTML_CSS, riskTheme, scoreTheme, sectionTheme } from './reportTheme';

export interface AuditPdfChecklistItem {
  item_text: string;
  section: string;
  item_order: number;
}

export interface AuditPdfResponseRow {
  id: string;
  response: string | null;
  remarks: string | null;
  checklist_item: AuditPdfChecklistItem | null;
}

export interface AuditPdfInspection {
  inspection_date: string;
  status: string;
  compliance_score: number | null;
  risk_level?: string | null;
  time_in?: string | null;
  time_out?: string | null;
  officer: { name: string } | null;
  inspection_responses: AuditPdfResponseRow[];
  inspection_files?: InspectionMediaFile[];
  inspection_answers?: InspectionAnswerPhoto[];
  general_remarks: { remark_text: string }[];
}

const isImageEvidence = (file: NonNullable<AuditPdfInspection['inspection_files']>[number]) => {
  const type = (file.file_type ?? '').toLowerCase();
  const name = file.file_name ?? '';
  const url = file.file_url ?? '';
  return type === 'image' || /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(name) || /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(url);
};

const formatReportTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

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

/** Resolve private-bucket URLs and merge gallery photos before PDF render. */
export async function prepareAuditPdfInspection(data: AuditPdfInspection): Promise<AuditPdfInspection> {
  const imageFiles = collectInspectionImageFiles(data.inspection_files ?? [], data.inspection_answers ?? []);
  const resolved = await resolveInspectionMediaUrls(imageFiles);
  return {
    ...data,
    inspection_files: resolved.map((file) => ({
      id: file.id,
      file_url: file.resolved_url,
      file_name: file.file_name,
      file_type: file.file_type,
      checklist_item_id: file.checklist_item_id ?? null,
    })),
  };
}

export function buildAuditPdfHtml(data: AuditPdfInspection, branchName: string): string {
  const sections: Record<string, AuditPdfResponseRow[]> = {};
  (data.inspection_responses ?? []).forEach((r) => {
    const sec = r.checklist_item?.section ?? 'General';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(r);
  });

  Object.values(sections).forEach((items) => {
    items.sort(
      (a, b) => (a.checklist_item?.item_order ?? 0) - (b.checklist_item?.item_order ?? 0),
    );
  });

  const score = scoreTheme(data.compliance_score);
  const risk = riskTheme(data.risk_level ?? 'low');

  const sectionStats: { section: string; pass: number; fail: number; compliance: number }[] = [];
  const statsMap = new Map<string, { pass: number; fail: number }>();
  (data.inspection_responses ?? []).forEach((r) => {
    const sec = r.checklist_item?.section ?? 'General';
    const bucket = statsMap.get(sec) ?? { pass: 0, fail: 0 };
    if (r.response === 'Yes') bucket.pass += 1;
    else if (r.response === 'No') bucket.fail += 1;
    statsMap.set(sec, bucket);
  });
  statsMap.forEach((counts, section) => {
    const scored = counts.pass + counts.fail;
    sectionStats.push({
      section,
      ...counts,
      compliance: scored ? Math.round((counts.pass / scored) * 100) : 0,
    });
  });

  const chartHtml = sectionStats.length
    ? `<div class="chart-panel">
        <p class="chart-panel-title">Section Compliance Overview</p>
        ${sectionStats
          .map((row) => {
            const color = row.compliance >= 80 ? '#059669' : row.compliance >= 60 ? '#d97706' : '#dc2626';
            return `<div class="chart-row">
              <div class="chart-label">${escapeHtml(row.section)}</div>
              <div class="chart-track"><div class="chart-fill" style="width:${row.compliance}%;background:${color};"></div></div>
              <div class="chart-value">${row.compliance}%</div>
            </div>`;
          })
          .join('')}
      </div>`
    : '';

  const failCount = (data.inspection_responses ?? []).filter((r) => r.response === 'No').length;
  const passCount = (data.inspection_responses ?? []).filter((r) => r.response === 'Yes').length;
  const kpiHtml = `<div class="kpi-grid">
    <div class="kpi-box" style="border-color:#6ee7b7;background:#ecfdf5;"><div class="kpi-box-label">Compliance</div><div class="kpi-box-value" style="color:${score.text};">${data.compliance_score?.toFixed(1) ?? '—'}%</div></div>
    <div class="kpi-box" style="border-color:#fcd34d;background:#fffbeb;"><div class="kpi-box-label">Risk</div><div class="kpi-box-value" style="color:${risk.text};font-size:14px;">${escapeHtml((data.risk_level ?? 'LOW').toString().toUpperCase())}</div></div>
    <div class="kpi-box" style="border-color:#86efac;background:#f0fdf4;"><div class="kpi-box-label">Compliant</div><div class="kpi-box-value" style="color:#166534;">${passCount}</div></div>
    <div class="kpi-box" style="border-color:#fca5a5;background:#fef2f2;"><div class="kpi-box-label">NC</div><div class="kpi-box-value" style="color:#b91c1c;">${failCount}</div></div>
  </div>`;

  const sectionHtml = Object.entries(sections)
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
            <th style="width:58%">Checklist item</th>
            <th style="width:16%">Response</th>
            <th style="width:20%">Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((r, idx) => {
              const violation = r.response === 'No';
              const rowClass = violation ? 'violation' : r.response === 'Yes' ? 'compliant' : '';
              return `
            <tr class="${rowClass}">
              <td style="font-weight:700;color:${theme.accent};">${idx + 1}</td>
              <td>${escapeHtml(r.checklist_item?.item_text ?? '—')}</td>
              <td><span class="resp-badge ${responseBadgeClass(r.response)}">${escapeHtml(r.response ?? '—')}</span></td>
              <td>${escapeHtml(r.remarks ?? '')}</td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
    })
    .join('');

  const imageFiles = (data.inspection_files ?? []).filter(isImageEvidence);
  const photoHtml = imageFiles.length
    ? `
    <div class="section-block">
      <div class="section-head" style="background:#eff6ff;border-color:#93c5fd;color:#1d4ed8;">Photo Evidence</div>
      <div class="photos">
        ${imageFiles
          .map(
            (file) => `
          <div class="photo">
            <img src="${file.file_url}" />
            <p>${escapeHtml(file.file_name ?? 'Inspection evidence')}</p>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `
    : '';

  const remarksHtml =
    data.general_remarks?.length
      ? `<div class="section-block">
          <div class="section-head" style="background:#fdf2f8;border-color:#f9a8d4;color:#be185d;">General Remarks</div>
          <div style="padding:12px 14px;">${data.general_remarks.map((r) => `<p style="margin:0 0 8px;">${escapeHtml(r.remark_text)}</p>`).join('')}</div>
        </div>`
      : '';

  const timeLine =
    data.time_in || data.time_out
      ? `<div class="report-time">Inspection Time: ${formatReportTime(data.time_in)} – ${formatReportTime(data.time_out)}</div>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${REPORT_HTML_CSS}</style></head><body>
  <div class="report-shell">
    <div class="report-hero">
      <h1>STORE INSPECTION REPORT</h1>
      <p>Official Field Inspection Document</p>
    </div>

    <div class="report-tabs">
      <span class="report-tab active">Overview</span>
      <span class="report-tab">Compliance Chart</span>
      <span class="report-tab">Checklist Detail</span>
      <span class="report-tab">Evidence</span>
    </div>

    <div class="report-meta-grid">
      <div class="meta-card"><div class="meta-label">Location</div><div class="meta-value">${escapeHtml(branchName)}</div></div>
      <div class="meta-card"><div class="meta-label">Date</div><div class="meta-value">${escapeHtml(data.inspection_date)}</div></div>
      <div class="meta-card"><div class="meta-label">Officer</div><div class="meta-value">${escapeHtml(data.officer?.name ?? '—')}</div></div>
      <div class="meta-card accent-status"><div class="meta-label">Status</div><div class="meta-value">${escapeHtml((data.status ?? '').toUpperCase())}</div></div>
      <div class="meta-card accent-score" style="border-color:${score.border};background:${score.bg};"><div class="meta-label">Compliance</div><div class="meta-value" style="color:${score.text};">${data.compliance_score?.toFixed(1) ?? '—'}%</div></div>
      <div class="meta-card accent-risk" style="border-color:${risk.border};background:${risk.bg};"><div class="meta-label">Risk Level</div><div class="meta-value" style="color:${risk.text};">${escapeHtml((data.risk_level ?? 'LOW').toString().toUpperCase())}</div></div>
    </div>

    ${timeLine}

    <div class="report-body">
      ${kpiHtml}
      ${chartHtml}
      ${sectionHtml}
      ${photoHtml}
      ${remarksHtml}
      <div class="summary-strip">
        <span>Overall Compliance: ${data.compliance_score?.toFixed(1) ?? '—'}%</span>
        <span>Risk Level: ${escapeHtml((data.risk_level ?? 'LOW').toString().toUpperCase())}</span>
        <span>Inspector: ${escapeHtml(data.officer?.name ?? '—')}</span>
      </div>
    </div>

    <div class="report-footer">
      This report is an official field inspection document. Generated on ${escapeHtml(data.inspection_date)} |
      ${escapeHtml(branchName)} Store | Officer: ${escapeHtml(data.officer?.name ?? '—')} |
      System: Store Monitoring Division
    </div>
  </div>
  </body></html>`;
}

export type { AuditReportRow };
