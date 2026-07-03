import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { ManagementInspection } from './inspectionQueries';
import type { ExecutiveStats } from './managementAnalytics';
import { REPORT_BRAND } from './reportTheme';

export interface DashboardExportPayload {
  rangeLabel: string;
  generatedAt: Date;
  stats: ExecutiveStats;
  inspections: ManagementInspection[];
  topIssues: { rank: number; item: string; section: string; count: number; percentage: number }[];
  branchRows: {
    branchName: string;
    type: string;
    city: string;
    inspections: number;
    avgCompliance: number;
    riskLevel: string;
    lastInspected: string;
  }[];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 200);
}

function escapeCsv(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function buildInspectionCsvLines(
  rows: Array<Record<string, unknown>>,
): string {
  if (rows.length === 0) {
    return 'inspectionId,date,branch,branchType,city,region,officer,status,complianceScore,riskLevel,section,item,response,remarks';
  }
  const headers = Object.keys(rows[0]);
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(',')),
  ].join('\n');
}

function fileStamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function downloadDashboardCsv(payload: DashboardExportPayload) {
  const rows = payload.inspections.flatMap((item) =>
    item.responses.map((response) => ({
      inspectionId: item.id,
      date: item.inspection_date,
      branch: item.branch_name,
      branchType: item.branch_type,
      city: item.city,
      region: item.region,
      officer: item.officer_name,
      status: item.status,
      complianceScore: item.compliance_score,
      riskLevel: item.risk_level,
      section: response.section,
      item: response.item_text,
      response: response.response,
      remarks: response.remarks ?? '',
    })),
  );

  const summaryRows = [
    ['Metric', 'Value'],
    ['Period', payload.rangeLabel],
    ['Generated', payload.generatedAt.toLocaleString('en-IN')],
    ['Total inspections', payload.stats.total.value],
    ['Network compliance %', payload.stats.compliance.value.toFixed(1)],
    ['Non-conformances', payload.stats.violations.value],
    ['Critical visits', payload.stats.critical.value],
    ['Branches covered', payload.stats.branchesCovered.value],
    ['CFC compliance %', payload.stats.cfc.value.toFixed(1)],
    ['Store compliance %', payload.stats.store.value.toFixed(1)],
  ];

  const detailHeaders = rows.length
    ? Object.keys(rows[0])
    : ['inspectionId', 'date', 'branch', 'branchType', 'city', 'region', 'officer', 'status', 'complianceScore', 'riskLevel', 'section', 'item', 'response', 'remarks'];

  const csv = [
    'Vigilance Executive Dashboard Summary',
    ...summaryRows.map((row) => row.map(escapeCsv).join(',')),
    '',
    'Inspection detail',
    detailHeaders.join(','),
    ...rows.map((row) =>
      detailHeaders.map((header) => escapeCsv((row as Record<string, unknown>)[header])).join(','),
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `vigilance-dashboard-${fileStamp(payload.generatedAt)}.csv`);
}

const pdfStyles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: 'Helvetica', backgroundColor: '#f8fafc' },
  shell: {
    margin: 28,
    borderWidth: 2,
    borderColor: REPORT_BRAND.navy,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  hero: { backgroundColor: REPORT_BRAND.navy, padding: 22, color: '#ffffff' },
  title: { fontSize: 18, marginBottom: 4, fontWeight: 'bold', color: '#ffffff' },
  subtitle: { fontSize: 10, color: '#dbeafe', marginBottom: 0 },
  body: { padding: 18 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    borderRadius: 6,
    color: '#3730a3',
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  cellLabel: { width: '45%', color: '#334155' },
  cellValue: { width: '55%', fontWeight: 'bold', color: '#0f172a' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#4f46e5',
    padding: 7,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  tableRowAlt: { backgroundColor: '#f8fafc' },
  colBranch: { width: '28%' },
  colType: { width: '12%' },
  colCity: { width: '18%' },
  colScore: { width: '14%' },
  colRisk: { width: '14%' },
  colDate: { width: '14%' },
});

function DashboardPdfDocument({ payload }: { payload: DashboardExportPayload }) {
  const { stats, rangeLabel, generatedAt, branchRows, topIssues } = payload;

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.shell}>
          <View style={pdfStyles.hero}>
            <Text style={pdfStyles.title}>Vigilance Executive Dashboard</Text>
            <Text style={pdfStyles.subtitle}>
              {rangeLabel} · Generated {generatedAt.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={pdfStyles.body}>
            <Text style={pdfStyles.sectionTitle}>Network overview</Text>
            {[
              ['Total inspections', stats.total.value],
              ['Network compliance', `${stats.compliance.value.toFixed(1)}%`],
              ['Non-conformances', stats.violations.value],
              ['Critical visits', stats.critical.value],
              ['Pending review', stats.pending.value],
              ['Branches covered', stats.branchesCovered.value],
              ['CFC compliance', `${stats.cfc.value.toFixed(1)}%`],
              ['Store compliance', `${stats.store.value.toFixed(1)}%`],
            ].map(([label, value]) => (
              <View key={label} style={pdfStyles.row}>
                <Text style={pdfStyles.cellLabel}>{label}</Text>
                <Text style={pdfStyles.cellValue}>{value}</Text>
              </View>
            ))}

            <Text style={pdfStyles.sectionTitle}>Top non-conformances</Text>
            {topIssues.slice(0, 8).map((issue) => (
              <View key={`${issue.section}-${issue.item}`} style={pdfStyles.row}>
                <Text style={pdfStyles.cellLabel}>
                  {issue.rank}. {issue.item}
                </Text>
                <Text style={pdfStyles.cellValue}>
                  {issue.section} · {issue.count} ({issue.percentage.toFixed(1)}%)
                </Text>
              </View>
            ))}

            <Text style={pdfStyles.sectionTitle}>Branch performance</Text>
            <View style={pdfStyles.tableHeader}>
              <Text style={pdfStyles.colBranch}>Branch</Text>
              <Text style={pdfStyles.colType}>Type</Text>
              <Text style={pdfStyles.colCity}>City</Text>
              <Text style={pdfStyles.colScore}>Compliance</Text>
              <Text style={pdfStyles.colRisk}>Risk</Text>
              <Text style={pdfStyles.colDate}>Last visit</Text>
            </View>
            {branchRows.slice(0, 15).map((row, index) => (
              <View key={row.branchName} style={[pdfStyles.tableRow, index % 2 ? pdfStyles.tableRowAlt : {}]}>
                <Text style={pdfStyles.colBranch}>{row.branchName}</Text>
                <Text style={pdfStyles.colType}>{row.type}</Text>
                <Text style={pdfStyles.colCity}>{row.city}</Text>
                <Text style={pdfStyles.colScore}>{row.avgCompliance.toFixed(1)}%</Text>
                <Text style={pdfStyles.colRisk}>{row.riskLevel}</Text>
                <Text style={pdfStyles.colDate}>{row.lastInspected}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadDashboardPdf(payload: DashboardExportPayload) {
  const blob = await pdf(<DashboardPdfDocument payload={payload} />).toBlob();
  triggerDownload(blob, `vigilance-dashboard-${fileStamp(payload.generatedAt)}.pdf`);
}

export function downloadDashboardWord(payload: DashboardExportPayload) {
  const { stats, rangeLabel, generatedAt, branchRows, topIssues } = payload;

  const summaryRows = [
    ['Total inspections', stats.total.value],
    ['Network compliance', `${stats.compliance.value.toFixed(1)}%`],
    ['Non-conformances', stats.violations.value],
    ['Critical visits', stats.critical.value],
    ['Pending review', stats.pending.value],
    ['Branches covered', stats.branchesCovered.value],
    ['CFC compliance', `${stats.cfc.value.toFixed(1)}%`],
    ['Store compliance', `${stats.store.value.toFixed(1)}%`],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px;border:1px solid #e2e8f0;">${label}</td><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">${value}</td></tr>`,
    )
    .join('');

  const issueRows = topIssues
    .slice(0, 10)
    .map(
      (issue) =>
        `<tr><td style="padding:8px;border:1px solid #e2e8f0;">${issue.rank}</td><td style="padding:8px;border:1px solid #e2e8f0;">${issue.item}</td><td style="padding:8px;border:1px solid #e2e8f0;">${issue.section}</td><td style="padding:8px;border:1px solid #e2e8f0;">${issue.count}</td><td style="padding:8px;border:1px solid #e2e8f0;">${issue.percentage.toFixed(1)}%</td></tr>`,
    )
    .join('');

  const branchTableRows = branchRows
    .map(
      (row) =>
        `<tr><td style="padding:8px;border:1px solid #e2e8f0;">${row.branchName}</td><td style="padding:8px;border:1px solid #e2e8f0;">${row.type}</td><td style="padding:8px;border:1px solid #e2e8f0;">${row.city}</td><td style="padding:8px;border:1px solid #e2e8f0;">${row.avgCompliance.toFixed(1)}%</td><td style="padding:8px;border:1px solid #e2e8f0;">${row.riskLevel}</td><td style="padding:8px;border:1px solid #e2e8f0;">${row.lastInspected}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Vigilance Executive Dashboard</title></head>
<body style="font-family:Calibri,Arial,sans-serif;color:#0f172a;">
  <h1 style="font-size:24px;margin-bottom:4px;">Vigilance Executive Dashboard</h1>
  <p style="color:#64748b;margin-top:0;">${rangeLabel} · Generated ${generatedAt.toLocaleString('en-IN')}</p>
  <h2 style="font-size:16px;margin-top:24px;">Network overview</h2>
  <table style="border-collapse:collapse;width:100%;">${summaryRows}</table>
  <h2 style="font-size:16px;margin-top:24px;">Top non-conformances</h2>
  <table style="border-collapse:collapse;width:100%;">
    <tr style="background:#f8fafc;"><th style="padding:8px;border:1px solid #e2e8f0;">#</th><th style="padding:8px;border:1px solid #e2e8f0;">Item</th><th style="padding:8px;border:1px solid #e2e8f0;">Section</th><th style="padding:8px;border:1px solid #e2e8f0;">Count</th><th style="padding:8px;border:1px solid #e2e8f0;">%</th></tr>
    ${issueRows}
  </table>
  <h2 style="font-size:16px;margin-top:24px;">Branch performance</h2>
  <table style="border-collapse:collapse;width:100%;">
    <tr style="background:#f8fafc;"><th style="padding:8px;border:1px solid #e2e8f0;">Branch</th><th style="padding:8px;border:1px solid #e2e8f0;">Type</th><th style="padding:8px;border:1px solid #e2e8f0;">City</th><th style="padding:8px;border:1px solid #e2e8f0;">Compliance</th><th style="padding:8px;border:1px solid #e2e8f0;">Risk</th><th style="padding:8px;border:1px solid #e2e8f0;">Last visit</th></tr>
    ${branchTableRows}
  </table>
</body>
</html>`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  triggerDownload(blob, `vigilance-dashboard-${fileStamp(generatedAt)}.doc`);
}
