import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useManagementInspections } from '../hooks/useManagementInspections';
import { isViolationResponse } from '../lib/checklistScoring';
import { formatNonComplianceAlert } from '../lib/alertDescriptions';
import { filterInspectionsByDistrict } from '../lib/districtCalculations';
import ManagementReport from '../components/management/ManagementReport';
import { BloomGradientPanel } from '../components/ui/BloomGradientPanel';
import {
  buildHtmlBarChart,
  buildHtmlTable,
  buildReportHeader,
  buildSection,
  buildSummaryTable,
  downloadHtmlExcel,
  slugFilename,
  wrapHtmlDocument,
} from '../lib/formattedExport';

interface AuditArchiveProps {
  backPath?: string;
  backLabel?: string;
  districtFilter?: string | null;
}

export default function AuditArchive({ backPath, backLabel, districtFilter = null }: AuditArchiveProps = {}) {
  const { data = [] } = useManagementInspections();

  const scopedData = useMemo(
    () => filterInspectionsByDistrict(data, districtFilter),
    [data, districtFilter],
  );
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [officerFilter, setOfficerFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'edited'>('all');
  const [sortKey, setSortKey] = useState<'submitted_at' | 'store' | 'officer'>('submitted_at');

  const filteredRows = useMemo(() => {
    const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
    return scopedData
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
  }, [scopedData, fromDate, officerFilter, sortKey, statusFilter, storeFilter, toDate]);

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

    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    filteredRows.forEach((row) => {
      const band = riskBand(row.compliance_score);
      riskCounts[band] += 1;
    });

    const filterLine = [
      districtFilter ? `District: ${districtFilter}` : null,
      fromDate ? `From ${fromDate}` : null,
      toDate ? `To ${toDate}` : null,
      officerFilter ? `Officer: ${officerFilter}` : null,
      storeFilter ? `Store: ${storeFilter}` : null,
      statusFilter !== 'all' ? `Status: ${statusFilter}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'All records';

    const periodSlug =
      fromDate && toDate ? `${fromDate}-to-${toDate}` : new Date().toISOString().slice(0, 10);
    const districtSlug = districtFilter ? slugFilename(districtFilter) : 'all-districts';

    const html = wrapHtmlDocument(
      'Vigilance Compliance Report',
      [
        buildReportHeader(
          'Vigilance Compliance Report',
          `Generated ${new Date().toLocaleString('en-IN')} · ${filterLine}`,
        ),
        buildSection(
          'Executive summary',
          buildSummaryTable([
            ['Total submissions', String(totalSubmissions)],
            ['Unique stores', String(uniqueStores)],
            ['Unique officers', String(uniqueOfficers)],
            ['Average compliance score', `${avgScore.toFixed(1)}%`],
            ['Edited submissions', String(editedSubmissions)],
            ['Evidence photos', String(totalPhotos)],
            ['Non-compliance items', String(violations.length)],
          ]),
        ),
        buildSection(
          'Risk distribution',
          buildHtmlBarChart(
            [
              { label: 'Low risk (≥85%)', value: riskCounts.Low, color: '#22c55e' },
              { label: 'Medium risk (70–84%)', value: riskCounts.Medium, color: '#f59e0b' },
              { label: 'High risk (<70%)', value: riskCounts.High, color: '#ef4444' },
            ],
          ),
        ),
        buildSection(
          'Store performance',
          buildHtmlTable(
            ['Store', 'Submissions', 'Avg score', 'Non-compliance items'],
            Array.from(storeStats.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([store, stats]) => [
                store,
                String(stats.submissions),
                `${(stats.scoreSum / stats.submissions).toFixed(1)}%`,
                String(stats.nonCompliant),
              ]),
          ),
        ),
        buildSection(
          'Store compliance chart',
          buildHtmlBarChart(
            Array.from(storeStats.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([store, stats]) => ({
                label: store,
                value: Math.round(stats.scoreSum / stats.submissions),
                color:
                  stats.scoreSum / stats.submissions >= 85
                    ? '#22c55e'
                    : stats.scoreSum / stats.submissions >= 70
                      ? '#f59e0b'
                      : '#ef4444',
              })),
          ),
        ),
        buildSection(
          'Inspection submissions',
          buildHtmlTable(
            ['Submitted at', 'Store', 'Officer', 'Score', 'Risk', 'Status', 'Photos'],
            filteredRows.map((row) => [
              formatAuditDate(row.submitted_at),
              row.branch_name,
              row.officer_name,
              `${row.compliance_score.toFixed(1)}%`,
              riskBand(row.compliance_score),
              row.is_edited ? 'Edited' : 'Submitted',
              String(row.photos.length),
            ]),
          ),
        ),
        buildSection(
          'Non-compliance issues',
          buildHtmlTable(
            ['Store', 'Date', 'Section', 'Issue', 'Officer'],
            violations.map((v) => [v.store, v.date, v.section, v.issue, v.officer]),
          ),
        ),
      ].join(''),
    );

    downloadHtmlExcel(html, `vigilance-compliance-report-${districtSlug}-${periodSlug}.xls`);
  };

  return (
    <div className="space-y-5">
      {backPath && backLabel ? (
        <Link to={backPath} className="bloom-link inline-flex">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      ) : null}

      <BloomGradientPanel className="p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="bloom-subtitle text-sm">Filter submissions and export a compliance summary.</p>
          <button type="button" onClick={downloadReport} className="bloom-btn shrink-0">
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="bloom-label">
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="bloom-input mt-1 normal-case" />
          </label>
          <label className="bloom-label">
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="bloom-input mt-1 normal-case" />
          </label>
          <label className="bloom-label">
            Officer
            <input value={officerFilter} onChange={(e) => setOfficerFilter(e.target.value)} placeholder="Search officer" className="bloom-input mt-1 normal-case" />
          </label>
          <label className="bloom-label">
            Store
            <input value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} placeholder="Search store" className="bloom-input mt-1 normal-case" />
          </label>
          <label className="bloom-label">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="bloom-input mt-1 normal-case">
              <option value="all" className="bg-[#412653]">All</option>
              <option value="normal" className="bg-[#412653]">Normal</option>
              <option value="edited" className="bg-[#412653]">Edited</option>
            </select>
          </label>
          <label className="bloom-label">
            Sort
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)} className="bloom-input mt-1 normal-case">
              <option value="submitted_at" className="bg-[#412653]">Submitted time</option>
              <option value="store" className="bg-[#412653]">Store name</option>
              <option value="officer" className="bg-[#412653]">Officer name</option>
            </select>
          </label>
        </div>
      </BloomGradientPanel>

      <ManagementReport />
    </div>
  );
}
