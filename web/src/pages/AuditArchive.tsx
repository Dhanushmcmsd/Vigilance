import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useManagementInspections } from '../hooks/useManagementInspections';
import { isViolationResponse } from '../lib/checklistScoring';
import { formatNonComplianceAlert } from '../lib/alertDescriptions';
import ManagementReport from '../components/management/ManagementReport';

interface AuditArchiveProps {
  backPath: string;
  backLabel: string;
}

export default function AuditArchive({ backPath, backLabel }: AuditArchiveProps) {
  const { data = [] } = useManagementInspections();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [officerFilter, setOfficerFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'edited'>('all');
  const [sortKey, setSortKey] = useState<'submitted_at' | 'store' | 'officer'>('submitted_at');

  const filteredRows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return data
      .filter((row) => {
        const submitted = new Date(row.submitted_at);
        if (from && submitted < from) return false;
        if (to && submitted > to) return false;
        if (officerFilter && !row.officer_name.toLowerCase().includes(officerFilter.toLowerCase())) return false;
        if (storeFilter && !row.branch_name.toLowerCase().includes(storeFilter.toLowerCase())) return false;
        if (statusFilter === 'edited' && !row.is_edited) return false;
        if (statusFilter === 'normal' && row.is_edited) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'store') return a.branch_name.localeCompare(b.branch_name);
        if (sortKey === 'officer') return a.officer_name.localeCompare(b.officer_name);
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
  }, [data, fromDate, officerFilter, sortKey, statusFilter, storeFilter, toDate]);

  const formatAuditDate = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const riskBand = (score: number) => {
    if (score >= 85) return 'Low';
    if (score >= 70) return 'Medium';
    return 'High';
  };

  const downloadReport = () => {
    const totalSubmissions = filteredRows.length;
    const uniqueStores = new Set(filteredRows.map((row) => row.branch_name)).size;
    const uniqueOfficers = new Set(filteredRows.map((row) => row.officer_name)).size;
    const totalPhotos = filteredRows.reduce((sum, row) => sum + row.photos.length, 0);
    const editedSubmissions = filteredRows.filter((row) => row.is_edited).length;
    const avgScore = totalSubmissions
      ? filteredRows.reduce((sum, row) => sum + row.compliance_score, 0) / totalSubmissions
      : 0;

    const storeStats = new Map<string, { submissions: number; scoreSum: number; nonCompliant: number }>();
    const violations: {
      store: string;
      date: string;
      section: string;
      issue: string;
      officer: string;
    }[] = [];

    filteredRows.forEach((row) => {
      const store = storeStats.get(row.branch_name) ?? { submissions: 0, scoreSum: 0, nonCompliant: 0 };
      store.submissions += 1;
      store.scoreSum += row.compliance_score;

      row.responses.forEach((response) => {
        if (isViolationResponse(response.response, response.trigger_on_no)) {
          store.nonCompliant += 1;
          violations.push({
            store: row.branch_name,
            date: row.inspection_date,
            section: response.section,
            issue: formatNonComplianceAlert(response.item_text, response.response, response.trigger_on_no),
            officer: row.officer_name,
          });
        }
      });
      storeStats.set(row.branch_name, store);
    });

    const tableStyle =
      'border-collapse:collapse;width:100%;font-family:Calibri,Arial,sans-serif;font-size:11pt;';
    const thStyle =
      'border:1px solid #334155;background:#0f172a;color:#f8fafc;padding:8px 10px;text-align:left;font-weight:700;';
    const tdStyle = 'border:1px solid #cbd5e1;padding:8px 10px;vertical-align:top;';
    const tdAlt = 'border:1px solid #cbd5e1;padding:8px 10px;background:#f8fafc;vertical-align:top;';
    const titleStyle = 'font-family:Calibri,Arial,sans-serif;font-size:18pt;font-weight:700;color:#0f172a;';
    const subtitleStyle = 'font-family:Calibri,Arial,sans-serif;font-size:10pt;color:#64748b;margin:4px 0 16px;';
    const sectionStyle =
      'font-family:Calibri,Arial,sans-serif;font-size:12pt;font-weight:700;color:#0f766e;margin:24px 0 8px;';

    const summaryRows = [
      ['Total Submissions', String(totalSubmissions)],
      ['Unique Stores', String(uniqueStores)],
      ['Unique Officers', String(uniqueOfficers)],
      ['Average Compliance Score', `${avgScore.toFixed(1)}%`],
      ['Edited Submissions', String(editedSubmissions)],
      ['Evidence Photos', String(totalPhotos)],
      ['Non-Compliance Items', String(violations.length)],
    ];

    const storeRows = Array.from(storeStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([store, stats], i) => `
        <tr>
          <td style="${i % 2 ? tdAlt : tdStyle}">${store}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${stats.submissions}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${(stats.scoreSum / stats.submissions).toFixed(1)}%</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${stats.nonCompliant}</td>
        </tr>`,
      )
      .join('');

    const submissionRows = filteredRows
      .map(
        (row, i) => `
        <tr>
          <td style="${i % 2 ? tdAlt : tdStyle}">${formatAuditDate(row.submitted_at)}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${row.branch_name}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${row.officer_name}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${row.compliance_score.toFixed(1)}%</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${riskBand(row.compliance_score)}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${row.is_edited ? 'Edited' : 'Submitted'}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${row.photos.length}</td>
        </tr>`,
      )
      .join('');

    const violationRows = violations
      .map(
        (v, i) => `
        <tr>
          <td style="${i % 2 ? tdAlt : tdStyle}">${v.store}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${v.date}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${v.section}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${v.issue}</td>
          <td style="${i % 2 ? tdAlt : tdStyle}">${v.officer}</td>
        </tr>`,
      )
      .join('');

    const filterLine = [
      fromDate ? `From ${fromDate}` : null,
      toDate ? `To ${toDate}` : null,
      officerFilter ? `Officer: ${officerFilter}` : null,
      storeFilter ? `Store: ${storeFilter}` : null,
      statusFilter !== 'all' ? `Status: ${statusFilter}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'All records';

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8"><title>Vigilance Compliance Report</title></head>
<body>
  <p style="${titleStyle}">Vigilance Compliance Report</p>
  <p style="${subtitleStyle}">Generated ${new Date().toLocaleString('en-IN')} · ${filterLine}</p>

  <p style="${sectionStyle}">Executive Summary</p>
  <table style="${tableStyle}">
    <tr><th style="${thStyle}">Metric</th><th style="${thStyle}">Value</th></tr>
    ${summaryRows
      .map(
        ([label, value], i) =>
          `<tr><td style="${i % 2 ? tdAlt : tdStyle}">${label}</td><td style="${i % 2 ? tdAlt : tdStyle}">${value}</td></tr>`,
      )
      .join('')}
  </table>

  <p style="${sectionStyle}">Store Performance</p>
  <table style="${tableStyle}">
    <tr>
      <th style="${thStyle}">Store</th>
      <th style="${thStyle}">Submissions</th>
      <th style="${thStyle}">Avg Score</th>
      <th style="${thStyle}">Non-Compliance Items</th>
    </tr>
    ${storeRows || `<tr><td colspan="4" style="${tdStyle}">No data</td></tr>`}
  </table>

  <p style="${sectionStyle}">Inspection Submissions</p>
  <table style="${tableStyle}">
    <tr>
      <th style="${thStyle}">Submitted At</th>
      <th style="${thStyle}">Store</th>
      <th style="${thStyle}">Officer</th>
      <th style="${thStyle}">Score</th>
      <th style="${thStyle}">Risk</th>
      <th style="${thStyle}">Status</th>
      <th style="${thStyle}">Photos</th>
    </tr>
    ${submissionRows || `<tr><td colspan="7" style="${tdStyle}">No submissions match filters</td></tr>`}
  </table>

  <p style="${sectionStyle}">Non-Compliance Issues</p>
  <table style="${tableStyle}">
    <tr>
      <th style="${thStyle}">Store</th>
      <th style="${thStyle}">Date</th>
      <th style="${thStyle}">Section</th>
      <th style="${thStyle}">Issue</th>
      <th style="${thStyle}">Officer</th>
    </tr>
    ${violationRows || `<tr><td colspan="5" style="${tdStyle}">No non-compliance items in selected range</td></tr>`}
  </table>
</body>
</html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vigilance-report-${new Date().toISOString().slice(0, 10)}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={backPath} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-600">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit report archive</h1>
          <p className="mt-1 text-sm text-slate-500">
            Field inspection history with management reports and meeting-ready exports.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadReport}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          <Download className="h-4 w-4" />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-3 xl:grid-cols-6">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          From
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          To
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Officer
          <input value={officerFilter} onChange={(e) => setOfficerFilter(e.target.value)} placeholder="Search officer" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Store
          <input value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} placeholder="Search store" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Status
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case dark:border-slate-700 dark:bg-slate-950">
            <option value="all">All</option>
            <option value="normal">Normal</option>
            <option value="edited">Edited</option>
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sort
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case dark:border-slate-700 dark:bg-slate-950">
            <option value="submitted_at">Submitted time</option>
            <option value="store">Store name</option>
            <option value="officer">Officer name</option>
          </select>
        </label>
      </div>

      <ManagementReport />
    </div>
  );
}
