/** Shared HTML-Excel and download helpers for colorful report exports. */

import { sectionTheme } from './reportTheme';

export const EXPORT_STYLES = {
  shell:
    'max-width:920px;margin:0 auto;border:2px solid #1e3a8a;border-radius:14px;overflow:hidden;background:#ffffff;',
  hero:
    'background:#1e3a8a;color:#ffffff;padding:18px 20px;font-family:Calibri,Arial,sans-serif;',
  heroTitle: 'font-size:20pt;font-weight:800;margin:0;letter-spacing:0.4px;',
  heroSubtitle: 'font-size:10pt;margin:6px 0 0;color:#dbeafe;',
  bodyPad: 'padding:16px 18px 20px;font-family:Calibri,Arial,sans-serif;',
  title:
    'font-family:Calibri,Arial,sans-serif;font-size:18pt;font-weight:800;color:#1e3a8a;margin:0 0 4px 0;',
  subtitle:
    'font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#64748b;margin:0 0 16px 0;',
  section:
    'font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:800;color:#3730a3;margin:20px 0 8px 0;padding:10px 12px;background:#eef2ff;border:1.5px solid #6366f1;border-radius:10px;text-transform:uppercase;letter-spacing:0.6px;',
  sectionBlock:
    'margin-bottom:14px;border:1.5px solid #cbd5e1;border-radius:12px;overflow:hidden;background:#ffffff;',
  table: 'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;',
  th: 'border:1.5px solid #6366f1;background:#4f46e5;color:#ffffff;padding:9px 11px;text-align:left;font-weight:700;vertical-align:middle;font-size:10pt;',
  td: 'border:1.5px solid #e2e8f0;padding:8px 11px;vertical-align:top;color:#0f172a;',
  tdAlt: 'border:1.5px solid #e2e8f0;padding:8px 11px;background:#f8fafc;vertical-align:top;color:#0f172a;',
  tdBold: 'border:1.5px solid #e2e8f0;padding:8px 11px;font-weight:700;vertical-align:top;color:#0f172a;background:#f1f5f9;',
  tdPass: 'border:1.5px solid #86efac;padding:8px 11px;background:#f0fdf4;vertical-align:top;color:#166534;',
  tdFail: 'border:1.5px solid #fca5a5;padding:8px 11px;background:#fef2f2;vertical-align:top;color:#b91c1c;',
  summaryStrip:
    'margin-top:12px;padding:12px 14px;border:1.5px solid #93c5fd;border-radius:10px;background:#eff6ff;font-weight:700;color:#1e3a8a;font-family:Calibri,Arial,sans-serif;font-size:11pt;',
  footer:
    'margin-top:12px;padding:12px 18px;border-top:2px solid #dbeafe;background:#f8fafc;text-align:center;font-size:9pt;color:#64748b;font-family:Calibri,Arial,sans-serif;',
} as const;

function sectionExportStyle(section: string): string {
  const theme = sectionTheme(section);
  return `font-family:Calibri,Arial,sans-serif;font-size:11pt;font-weight:800;color:${theme.text};margin:0;padding:10px 12px;background:${theme.bg};border-bottom:1.5px solid ${theme.border};text-transform:uppercase;letter-spacing:0.6px;`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 200);
}

export function downloadHtmlExcel(html: string, filename: string) {
  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.xls') ? filename : `${filename}.xls`);
}

export function buildHtmlTable(
  headers: string[],
  rows: string[][],
  options?: { altRows?: boolean },
): string {
  const { table, th, td, tdAlt } = EXPORT_STYLES;
  const altRows = options?.altRows ?? true;
  const headerRow = headers.map((h) => `<th style="${th}">${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      (row, i) =>
        `<tr>${row
          .map((cell) => {
            const style = altRows && i % 2 ? tdAlt : td;
            return `<td style="${style}">${escapeHtml(cell)}</td>`;
          })
          .join('')}</tr>`,
    )
    .join('');
  return `<table style="${table}"><tr>${headerRow}</tr>${body}</table>`;
}

export function buildSummaryTable(pairs: [string, string][]): string {
  const { table, th, td, tdAlt, tdBold } = EXPORT_STYLES;
  const rows = pairs
    .map(
      ([label, value], i) =>
        `<tr><td style="${i % 2 ? tdAlt : tdBold}">${escapeHtml(label)}</td><td style="${i % 2 ? tdAlt : td}">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  return `<table style="${table}"><tr><th style="${th}">Metric</th><th style="${th}">Value</th></tr>${rows}</table>`;
}

export function buildHtmlBarChart(
  items: { label: string; value: number; max?: number; color?: string }[],
  title?: string,
): string {
  const max = Math.max(...items.map((i) => i.max ?? i.value), 1);
  const bars = items
    .map((item) => {
      const pct = Math.round((item.value / max) * 100);
      const color = item.color ?? '#6366f1';
      return `<tr>
        <td style="${EXPORT_STYLES.tdBold};width:28%;">${escapeHtml(item.label)}</td>
        <td style="${EXPORT_STYLES.td};width:52%;">
          <div style="background:#e2e8f0;border-radius:6px;height:20px;width:100%;overflow:hidden;border:1px solid #cbd5e1;">
            <div style="background:${color};height:20px;width:${pct}%;min-width:${item.value > 0 ? '2%' : '0'};border-radius:5px;"></div>
          </div>
        </td>
        <td style="${EXPORT_STYLES.td};width:20%;text-align:right;font-weight:700;">${escapeHtml(String(item.value))}</td>
      </tr>`;
    })
    .join('');
  const heading = title
    ? `<p style="${EXPORT_STYLES.section}">${escapeHtml(title)}</p>`
    : '';
  return `${heading}<table style="${EXPORT_STYLES.table}">${bars}</table>`;
}

export function wrapHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:24px;background:#f8fafc;">
<div style="${EXPORT_STYLES.shell}">
  <div style="${EXPORT_STYLES.hero}">
    <p style="${EXPORT_STYLES.heroTitle}">${escapeHtml(title)}</p>
    <p style="${EXPORT_STYLES.heroSubtitle}">Official Field Inspection Document · Vigilance Management System</p>
  </div>
  <div style="${EXPORT_STYLES.bodyPad}">${body}</div>
  <div style="${EXPORT_STYLES.footer}">Generated by Vigilance Management System · Store Monitoring Division</div>
</div>
</body>
</html>`;
}

export function buildReportHeader(_title: string, subtitle: string): string {
  return `<p style="${EXPORT_STYLES.subtitle}">${escapeHtml(subtitle)}</p>`;
}

export function buildSection(title: string, content: string): string {
  return `<div style="${EXPORT_STYLES.sectionBlock}">
    <p style="${sectionExportStyle(title)}">${escapeHtml(title)}</p>
    <div style="padding:10px 12px 12px;">${content}</div>
  </div>`;
}
