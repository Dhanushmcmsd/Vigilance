import {
  buildHtmlBarChart,
  buildHtmlTable,
  buildReportHeader,
  buildSection,
  buildSummaryTable,
  downloadHtmlExcel,
  wrapHtmlDocument,
} from './formattedExport';

export interface AdminReportFilters {
  from: string;
  to: string;
  branchType: string;
  status: string;
}

export interface AdminInspectionDetailRow {
  id: string;
  inspection_date?: string;
  submitted_at?: string | null;
  compliance_score?: number;
  risk_level?: string;
  status?: string;
  user_roles?: { name?: string } | null;
  branches?: {
    branch_name?: string;
    city?: string;
    branch_types?: { type_name?: string } | { type_name?: string }[] | null;
  } | null;
  inspection_responses?: {
    response?: string;
    remarks?: string;
    checklist_templates?: { section?: string; item_text?: string } | null;
  }[];
  inspection_files?: { file_url?: string }[];
  inspection_answers?: { photo_url?: string | null }[];
}

export interface AdminInspectionSummaryRow {
  id: string;
  inspection_date?: string;
  submitted_at?: string | null;
  compliance_score?: number;
  risk_level?: string;
  status?: string;
  user_roles?: { name?: string } | null;
  branches?: {
    branch_name?: string;
    city?: string;
    branch_types?: { type_name?: string } | { type_name?: string }[] | null;
  } | null;
}

export interface AdminUnifiedReportPayload {
  filters: AdminReportFilters;
  detailRows: string[][];
  summaryRows: string[][];
  submittedCount: number;
  branchCounts: Map<string, number>;
  riskCounts: { low: number; medium: number; critical: number; other: number };
  avgCompliance: string;
  leaveHeaders: string[];
  leaveRows: string[][];
}

function tabBarHtml(): string {
  return `<div class="report-tabs" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 18px 0;background:#f8fafc;border-bottom:2px solid #dbeafe;">
    <span style="display:inline-block;padding:8px 14px;border-radius:10px 10px 0 0;border:1.5px solid #4f46e5;border-bottom:none;background:linear-gradient(135deg,#1e3a8a,#4f46e5);color:#fff;font-size:10px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Executive Summary</span>
    <span style="display:inline-block;padding:8px 14px;border-radius:10px 10px 0 0;border:1.5px solid #cbd5e1;border-bottom:none;background:#fff;color:#64748b;font-size:10px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Inspections</span>
    <span style="display:inline-block;padding:8px 14px;border-radius:10px 10px 0 0;border:1.5px solid #cbd5e1;border-bottom:none;background:#fff;color:#64748b;font-size:10px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Checklist Detail</span>
    <span style="display:inline-block;padding:8px 14px;border-radius:10px 10px 0 0;border:1.5px solid #cbd5e1;border-bottom:none;background:#fff;color:#64748b;font-size:10px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">Officer Leave</span>
  </div>`;
}

export function buildAdminUnifiedReportHtml(payload: AdminUnifiedReportPayload): string {
  const { filters, detailRows, summaryRows, submittedCount, branchCounts, riskCounts, avgCompliance, leaveHeaders, leaveRows } = payload;
  const filterLine = `Period ${filters.from} to ${filters.to} · Branch type: ${filters.branchType} · Status: ${filters.status}`;

  const executiveSummary = buildSummaryTable([
    ['Report period', `${filters.from} to ${filters.to}`],
    ['Branch type filter', filters.branchType],
    ['Status filter', filters.status],
    ['Total checklist rows', String(detailRows.length)],
    ['Inspection visits', String(summaryRows.length)],
    ['Submitted / approved visits', String(submittedCount)],
    ['Unique branches', String(branchCounts.size)],
    ['Average compliance', avgCompliance],
    ['Low risk visits', String(riskCounts.low)],
    ['Medium risk visits', String(riskCounts.medium)],
    ['Critical risk visits', String(riskCounts.critical)],
    ['Officer leave records', String(leaveRows.length)],
  ]);

  const branchChart = buildHtmlBarChart(
    Array.from(branchCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({ label, value, color: '#6366f1' })),
    'Inspections by branch',
  );

  const riskChart = buildHtmlBarChart(
    [
      { label: 'Low', value: riskCounts.low, color: '#22c55e' },
      { label: 'Medium', value: riskCounts.medium, color: '#f59e0b' },
      { label: 'Critical', value: riskCounts.critical, color: '#ef4444' },
      { label: 'Other', value: riskCounts.other, color: '#94a3b8' },
    ],
    'Risk level distribution',
  );

  const body = [
    buildReportHeader('Vigilance Unified Inspection Report', `Generated ${new Date().toLocaleString('en-IN')} · ${filterLine}`),
    tabBarHtml(),
    buildSection('Executive summary', `${executiveSummary}${branchChart}${riskChart}`),
    buildSection(
      'Inspection summary',
      buildHtmlTable(
        ['Inspection ID', 'Inspection date', 'Submitted at', 'Branch', 'City', 'Branch type', 'Officer', 'Compliance', 'Risk level', 'Status'],
        summaryRows,
      ),
    ),
    buildSection(
      'Inspection checklist detail',
      buildHtmlTable(
        [
          'Inspection ID',
          'Inspection date',
          'Submitted at',
          'Officer',
          'Branch',
          'Branch type',
          'City',
          'Section',
          'Checklist item',
          'Response',
          'Remarks',
          'Compliance %',
          'Risk level',
          'Status',
          'Evidence files',
        ],
        detailRows,
      ),
    ),
    buildSection('Officer attendance & leave', buildHtmlTable(leaveHeaders, leaveRows)),
  ].join('');

  return wrapHtmlDocument('Vigilance Unified Inspection Report', body);
}

export function downloadAdminUnifiedReport(payload: AdminUnifiedReportPayload): void {
  const html = buildAdminUnifiedReportHtml(payload);
  downloadHtmlExcel(html, `vigilance-unified-report-${payload.filters.from}-to-${payload.filters.to}.xls`);
}
