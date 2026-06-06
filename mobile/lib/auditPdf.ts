import type { AuditReportRow } from './auditReports';

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
  time_in?: string | null;
  time_out?: string | null;
  officer: { name: string } | null;
  inspection_responses: AuditPdfResponseRow[];
  inspection_files?: { file_url: string; file_name?: string | null; file_type?: string | null }[];
  general_remarks: { remark_text: string }[];
}

const isImageEvidence = (file: NonNullable<AuditPdfInspection['inspection_files']>[number]) => {
  const type = (file.file_type ?? '').toLowerCase();
  const name = file.file_name ?? '';
  const url = file.file_url ?? '';
  return type === 'image' || /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(name) || /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(url);
};

const formatReportTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

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

  const sectionHtml = Object.entries(sections)
    .map(
      ([sec, items]) => `
    <div class="section">
      <h3>${sec}</h3>
      <table>
        <thead><tr><th>#</th><th>Checklist item</th><th>Response</th><th>Remarks</th></tr></thead>
        <tbody>
          ${items
            .map(
              (r, idx) => `
            <tr class="${r.response === 'No' ? 'no-row' : ''}">
              <td>${idx + 1}</td>
              <td>${r.checklist_item?.item_text ?? '—'}</td>
              <td class="resp resp-${(r.response ?? 'na').toLowerCase().replace('/', '')}">${r.response ?? '—'}</td>
              <td>${r.remarks ?? ''}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `,
    )
    .join('');
  const imageFiles = (data.inspection_files ?? []).filter(isImageEvidence);
  const photoHtml = imageFiles.length
    ? `
    <div class="section">
      <h3>Photo Evidence</h3>
      <div class="photos">
        ${imageFiles
          .map(
            (file) => `
          <div class="photo">
            <img src="${file.file_url}" />
            <p>${file.file_name ?? 'Inspection evidence'}</p>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 32px; color: #1e293b; font-size: 13px; }
    h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
    .score-box { display: inline-block; padding: 8px 20px; border-radius: 8px; background: #f0fdf4; color: #16a34a; font-size: 24px; font-weight: 900; margin-bottom: 24px; }
    .section { margin-bottom: 28px; }
    h3 { font-size: 14px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; color: #64748b; padding: 6px 8px; background: #f8fafc; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .resp { font-weight: 700; }
    .resp-yes { color: #16a34a; }
    .resp-no { color: #dc2626; }
    .resp-na { color: #6b7280; }
    .no-row { background: #fef2f2; }
    .photos { display: flex; flex-wrap: wrap; gap: 12px; }
    .photo { width: 150px; }
    .photo img { width: 150px; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0; }
    .photo p { margin: 4px 0 0; font-size: 10px; color: #64748b; word-break: break-word; }
    .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; text-align: center; }
  </style>
  </head><body>
  <h1>Field Inspection Report — ${branchName}</h1>
  <p class="meta">Date: ${data.inspection_date} | Officer: ${data.officer?.name ?? '—'} | Status: ${(data.status ?? '').toUpperCase()}</p>
  <div class="score-box">${data.compliance_score?.toFixed(0) ?? '—'}% Compliance</div>
  ${sectionHtml}
  ${photoHtml}
  ${
    data.general_remarks?.length
      ? `<div class="section"><h3>General Remarks</h3><p>${data.general_remarks.map((r) => r.remark_text).join('<br>')}</p></div>`
      : ''
  }
  <p class="footer">Vigilance Management System · Field officer checklist · ${new Date().toLocaleString('en-IN')}</p>
  </body></html>`;
}

export type { AuditReportRow };
