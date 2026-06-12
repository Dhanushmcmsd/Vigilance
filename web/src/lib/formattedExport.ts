/** Shared HTML-Excel and download helpers for professional report exports. */

export const EXPORT_STYLES = {
  title:
    'font-family:Calibri,Arial,sans-serif;font-size:20pt;font-weight:700;color:#0f172a;margin:0 0 4px 0;',
  subtitle:
    'font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#64748b;margin:0 0 20px 0;',
  section:
    'font-family:Calibri,Arial,sans-serif;font-size:13pt;font-weight:700;color:#0f766e;margin:28px 0 10px 0;padding-bottom:6px;border-bottom:2px solid #0f766e;',
  table: 'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;',
  th: 'border:1px solid #334155;background:#0f172a;color:#f8fafc;padding:10px 12px;text-align:left;font-weight:700;vertical-align:middle;',
  td: 'border:1px solid #cbd5e1;padding:8px 12px;vertical-align:top;color:#0f172a;',
  tdAlt: 'border:1px solid #cbd5e1;padding:8px 12px;background:#f8fafc;vertical-align:top;color:#0f172a;',
  tdBold: 'border:1px solid #cbd5e1;padding:8px 12px;font-weight:700;vertical-align:top;color:#0f172a;',
} as const;

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
          <div style="background:#e2e8f0;border-radius:4px;height:18px;width:100%;overflow:hidden;">
            <div style="background:${color};height:18px;width:${pct}%;min-width:${item.value > 0 ? '2%' : '0'};border-radius:4px;"></div>
          </div>
        </td>
        <td style="${EXPORT_STYLES.td};width:20%;text-align:right;font-weight:700;">${escapeHtml(String(item.value))}</td>
      </tr>`;
    })
    .join('');
  const heading = title
    ? `<p style="${EXPORT_STYLES.section.replace('margin:28px', 'margin:16px')}">${escapeHtml(title)}</p>`
    : '';
  return `${heading}<table style="${EXPORT_STYLES.table}">${bars}</table>`;
}

export function wrapHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:24px;">${body}</body>
</html>`;
}

export function buildReportHeader(title: string, subtitle: string): string {
  return `<p style="${EXPORT_STYLES.title}">${escapeHtml(title)}</p>
<p style="${EXPORT_STYLES.subtitle}">${escapeHtml(subtitle)}</p>`;
}

export function buildSection(title: string, content: string): string {
  return `<p style="${EXPORT_STYLES.section}">${escapeHtml(title)}</p>${content}`;
}
