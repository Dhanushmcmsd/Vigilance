import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronDown, Download, X } from 'lucide-react';
import { useManagementInspections } from '../hooks/useManagementInspections';
import type { ManagementInspection } from '../lib/inspectionQueries';
import { isViolationResponse } from '../lib/checklistScoring';
import RiskBadge from '../components/RiskBadge';

interface AuditArchiveProps {
  backPath: string;
  backLabel: string;
}

const staffBehaviourColor = (val: string) => {
  if (val === 'Good') return 'text-green-600';
  if (val === 'Moderate') return 'text-yellow-500';
  if (val === 'Bad') return 'text-red-600';
  return 'text-gray-700 dark:text-gray-300';
};

export default function AuditArchive({ backPath, backLabel }: AuditArchiveProps) {
  const { data = [], isLoading } = useManagementInspections();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [officerFilter, setOfficerFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'edited'>('all');
  const [sortKey, setSortKey] = useState<'submitted_at' | 'store' | 'officer'>('submitted_at');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [photoModalRow, setPhotoModalRow] = useState<ManagementInspection | null>(null);

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
    }).replace(',', ' ·');
  };

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const riskBand = (score: number) => {
    if (score >= 85) return 'LOW';
    if (score >= 70) return 'MEDIUM';
    return 'HIGH';
  };

  const downloadCsv = () => {
    const totalSubmissions = filteredRows.length;
    const uniqueStores = new Set(filteredRows.map((row) => row.branch_name)).size;
    const uniqueOfficers = new Set(filteredRows.map((row) => row.officer_name)).size;
    const totalPhotos = filteredRows.reduce((sum, row) => sum + row.photos.length, 0);
    const editedSubmissions = filteredRows.filter((row) => row.is_edited).length;
    const avgScore = totalSubmissions
      ? filteredRows.reduce((sum, row) => sum + row.compliance_score, 0) / totalSubmissions
      : 0;
    const lowRiskCount = filteredRows.filter((row) => riskBand(row.compliance_score) === 'LOW').length;
    const mediumRiskCount = filteredRows.filter((row) => riskBand(row.compliance_score) === 'MEDIUM').length;
    const highRiskCount = filteredRows.filter((row) => riskBand(row.compliance_score) === 'HIGH').length;
    const nonCompliantCount = filteredRows.reduce(
      (sum, row) =>
        sum +
        row.responses.filter((response) =>
          isViolationResponse(response.response, response.trigger_on_no),
        ).length,
      0,
    );

    const officerStats = new Map<
      string,
      { submissions: number; scoreSum: number; edited: number; photos: number; nonCompliant: number }
    >();
    const storeStats = new Map<
      string,
      { submissions: number; scoreSum: number; edited: number; photos: number; nonCompliant: number }
    >();
    const sectionStats = new Map<string, { answers: number; compliant: number; nonCompliant: number }>();
    const dailyStats = new Map<string, { submissions: number; scoreSum: number; nonCompliant: number }>();

    filteredRows.forEach((row) => {
      const rowNonCompliant = row.responses.filter((response) =>
        isViolationResponse(response.response, response.trigger_on_no),
      ).length;

      const officer = officerStats.get(row.officer_name) ?? {
        submissions: 0,
        scoreSum: 0,
        edited: 0,
        photos: 0,
        nonCompliant: 0,
      };
      officer.submissions += 1;
      officer.scoreSum += row.compliance_score;
      officer.edited += row.is_edited ? 1 : 0;
      officer.photos += row.photos.length;
      officer.nonCompliant += rowNonCompliant;
      officerStats.set(row.officer_name, officer);

      const store = storeStats.get(row.branch_name) ?? {
        submissions: 0,
        scoreSum: 0,
        edited: 0,
        photos: 0,
        nonCompliant: 0,
      };
      store.submissions += 1;
      store.scoreSum += row.compliance_score;
      store.edited += row.is_edited ? 1 : 0;
      store.photos += row.photos.length;
      store.nonCompliant += rowNonCompliant;
      storeStats.set(row.branch_name, store);

      const day = new Date(row.submitted_at).toISOString().slice(0, 10);
      const dayEntry = dailyStats.get(day) ?? { submissions: 0, scoreSum: 0, nonCompliant: 0 };
      dayEntry.submissions += 1;
      dayEntry.scoreSum += row.compliance_score;
      dayEntry.nonCompliant += rowNonCompliant;
      dailyStats.set(day, dayEntry);

      row.responses.forEach((response) => {
        const key = response.section || 'General';
        const section = sectionStats.get(key) ?? { answers: 0, compliant: 0, nonCompliant: 0 };
        section.answers += 1;
        if (isViolationResponse(response.response, response.trigger_on_no)) {
          section.nonCompliant += 1;
        } else if (response.response && response.response !== 'N/A') {
          section.compliant += 1;
        }
        sectionStats.set(key, section);
      });
    });

    const csvLines: string[] = [];
    const addRow = (values: unknown[]) => {
      csvLines.push(values.map(csvEscape).join(','));
    };
    const addBlank = () => csvLines.push('');

    addRow(['Vigilance Compliance Report Export']);
    addRow(['Generated At', new Date().toLocaleString('en-IN')]);
    addRow(['Date Filter From', fromDate || 'All']);
    addRow(['Date Filter To', toDate || 'All']);
    addRow(['Officer Filter', officerFilter || 'All']);
    addRow(['Store Filter', storeFilter || 'All']);
    addRow(['Status Filter', statusFilter]);
    addRow(['Sort', sortKey]);
    addBlank();

    addRow(['EXECUTIVE SUMMARY']);
    addRow(['Metric', 'Value']);
    addRow(['Total Submissions', totalSubmissions]);
    addRow(['Unique Stores', uniqueStores]);
    addRow(['Unique Officers', uniqueOfficers]);
    addRow(['Average Compliance Score', avgScore.toFixed(2)]);
    addRow(['Edited Submissions', editedSubmissions]);
    addRow(['Total Evidence Photos', totalPhotos]);
    addRow(['Average Photos per Submission', totalSubmissions ? (totalPhotos / totalSubmissions).toFixed(2) : '0.00']);
    addRow(['Total Non-Compliant Answers', nonCompliantCount]);
    addBlank();

    addRow(['RISK DISTRIBUTION (CHART READY)']);
    addRow(['Risk Band', 'Submissions', 'Percentage']);
    addRow(['LOW (>=85)', lowRiskCount, totalSubmissions ? `${((lowRiskCount / totalSubmissions) * 100).toFixed(2)}%` : '0.00%']);
    addRow(['MEDIUM (70-84)', mediumRiskCount, totalSubmissions ? `${((mediumRiskCount / totalSubmissions) * 100).toFixed(2)}%` : '0.00%']);
    addRow(['HIGH (<70)', highRiskCount, totalSubmissions ? `${((highRiskCount / totalSubmissions) * 100).toFixed(2)}%` : '0.00%']);
    addBlank();

    addRow(['DAILY COMPLIANCE TREND (CHART READY)']);
    addRow(['Date', 'Submissions', 'Average Score', 'Non-Compliant Answers']);
    Array.from(dailyStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([date, stats]) => {
        addRow([date, stats.submissions, (stats.scoreSum / stats.submissions).toFixed(2), stats.nonCompliant]);
      });
    addBlank();

    addRow(['OFFICER PERFORMANCE SUMMARY']);
    addRow(['Officer', 'Submissions', 'Average Score', 'Edited Submissions', 'Photos Added', 'Non-Compliant Answers']);
    Array.from(officerStats.entries())
      .sort((a, b) => b[1].submissions - a[1].submissions || a[0].localeCompare(b[0]))
      .forEach(([officer, stats]) => {
        addRow([
          officer,
          stats.submissions,
          (stats.scoreSum / stats.submissions).toFixed(2),
          stats.edited,
          stats.photos,
          stats.nonCompliant,
        ]);
      });
    addBlank();

    addRow(['STORE PERFORMANCE SUMMARY']);
    addRow(['Store', 'Submissions', 'Average Score', 'Edited Submissions', 'Photos Added', 'Non-Compliant Answers']);
    Array.from(storeStats.entries())
      .sort((a, b) => b[1].submissions - a[1].submissions || a[0].localeCompare(b[0]))
      .forEach(([store, stats]) => {
        addRow([
          store,
          stats.submissions,
          (stats.scoreSum / stats.submissions).toFixed(2),
          stats.edited,
          stats.photos,
          stats.nonCompliant,
        ]);
      });
    addBlank();

    addRow(['CHECKLIST SECTION SUMMARY']);
    addRow(['Section', 'Total Answers', 'Compliant', 'Non-Compliant', 'Compliance %']);
    Array.from(sectionStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([section, stats]) => {
        const denominator = stats.compliant + stats.nonCompliant;
        const compliancePct = denominator > 0 ? ((stats.compliant / denominator) * 100).toFixed(2) : '0.00';
        addRow([section, stats.answers, stats.compliant, stats.nonCompliant, `${compliancePct}%`]);
      });
    addBlank();

    addRow(['SUBMISSION DETAIL']);
    addRow([
      'Submitted At',
      'Edited At',
      'Store',
      'Officer',
      'Score',
      'Risk',
      'Status',
      'Is Edited',
      'Photo Count',
      'Responses Count',
      'Non-Compliant Answers',
    ]);
    filteredRows.forEach((row) => {
      const rowNonCompliant = row.responses.filter((response) =>
        isViolationResponse(response.response, response.trigger_on_no),
      ).length;
      addRow([
        row.submitted_at,
        row.edited_at ?? '',
        row.branch_name,
        row.officer_name,
        row.compliance_score.toFixed(2),
        row.risk_level,
        row.status,
        row.is_edited ? 'Yes' : 'No',
        row.photos.length,
        row.responses.length,
        rowNonCompliant,
      ]);
    });
    addBlank();

    addRow(['CHECKLIST RESPONSE DETAIL']);
    addRow([
      'Submission ID',
      'Inspection Date',
      'Store',
      'Officer',
      'Section',
      'Checklist Item',
      'Response',
      'Compliant',
      'Remark',
    ]);
    filteredRows.forEach((row) => {
      row.responses.forEach((response) => {
        const nonCompliant = isViolationResponse(response.response, response.trigger_on_no);
        addRow([
          row.id,
          row.inspection_date,
          row.branch_name,
          row.officer_name,
          response.section,
          response.item_text,
          response.response,
          nonCompliant ? 'No' : 'Yes',
          response.remarks ?? '',
        ]);
      });
    });

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
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
            Edit-aware inspection history with checklist answers, evidence photos, and exportable filters.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadCsv}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          <Download className="h-4 w-4" />
          Export CSV
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-3">Submitted At</th>
              <th className="px-4 py-3">Edited At</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Photos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading &&
              filteredRows.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                      className={`cursor-pointer border-t border-slate-100 text-white transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${
                        row.is_edited ? 'border-l-4 border-amber-400 bg-amber-950/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-slate-800 dark:text-slate-100">
                        {formatAuditDate(row.submitted_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-amber-400 font-semibold">
                        {formatAuditDate(row.edited_at)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {row.branch_name}
                          {row.is_edited && (
                            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                              EDITED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          {row.officer_photo_url ? (
                            <img
                              src={row.officer_photo_url}
                              alt={row.officer_name}
                              className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
                            />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {row.officer_name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="font-medium">{row.officer_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-bold tabular-nums text-slate-900 dark:text-white">{row.compliance_score.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <RiskBadge level={row.risk_level} />
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700 dark:text-slate-200">{row.status}</td>
                      <td className="px-4 py-3">
                        {row.photos.length ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPhotoModalRow(row);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal-300/40 px-2.5 py-1 text-xs font-semibold text-teal-500"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            {row.photos.length} photos
                          </button>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        <ChevronDown className={`ml-auto h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-t border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
                        <td colSpan={9} className="px-6 py-5">
                          <div className="space-y-5">
                            <div className="grid gap-3 md:grid-cols-2">
                            {row.responses.map((response) => (
                              <div key={response.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{response.section}</div>
                                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{response.item_text}</p>
                                <p className="mt-2 text-sm">
                                  <span className={`font-semibold ${staffBehaviourColor(response.response)}`}>{response.response}</span>
                                  {response.remarks ? <span className="text-slate-500"> · {response.remarks}</span> : null}
                                </p>
                              </div>
                            ))}
                            </div>
                            {row.photos.length > 0 && (
                              <section>
                                <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Photo Evidence</h3>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                  {row.photos.map((photo) => (
                                    <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                                      <img src={photo.url} alt={photo.name ?? 'Inspection evidence'} className="h-24 w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              </section>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            {!isLoading && !filteredRows.length && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                  No inspections match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {photoModalRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Photos - {photoModalRow.branch_name}</h2>
                <p className="text-sm text-slate-500">{photoModalRow.photos.length} downloadable evidence photos</p>
              </div>
              <button type="button" onClick={() => setPhotoModalRow(null)} className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {photoModalRow.photos.map((photo) => (
                <a key={photo.url} href={photo.url} download target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <img src={photo.url} alt="Inspection evidence" className="h-56 w-full object-cover transition group-hover:scale-[1.02]" />
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span>{photo.uploaded_at ? formatAuditDate(photo.uploaded_at) : 'Download photo'}</span>
                    <Download className="h-4 w-4" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
