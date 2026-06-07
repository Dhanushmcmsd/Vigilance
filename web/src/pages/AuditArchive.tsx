import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Camera, ChevronDown, Download, FileDown, X } from 'lucide-react';
import { useManagementInspections } from '../hooks/useManagementInspections';
import type { ManagementInspection } from '../lib/inspectionQueries';
import { fetchInspectionForPdf } from '../lib/auditExport';
import type { InspectionPdfData } from '../components/InspectionPdfReport';
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
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const downloadCsv = () => {
    const headers = ['Submitted At', 'Edited At', 'Store', 'Officer', 'Score', 'Risk', 'Status', 'Photos'];
    const csv = [
      headers.join(','),
      ...filteredRows.map((row) => [
        row.submitted_at,
        row.edited_at ?? '',
        row.branch_name,
        row.officer_name,
        row.compliance_score.toFixed(1),
        row.risk_level,
        row.status,
        String(row.photos.length),
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async (inspectionId: string) => {
    setExportingId(inspectionId);
    setToast('Generating audit PDF…');
    try {
      const row = data.find((entry) => entry.id === inspectionId) ?? null;
      let pdfData = await fetchInspectionForPdf(inspectionId);
      // Guaranteed fallback: build from already-loaded archive row.
      if (!pdfData && row) {
        pdfData = mapRowToPdfData(row);
      }
      if (!pdfData) throw new Error('Inspection not found.');
      const { generateInspectionPdf } = await import('../components/InspectionPdfReport');
      const filename = await generateInspectionPdf(pdfData);
      setToast(`Downloaded ${filename}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PDF export failed.';
      setToast(message);
    } finally {
      setExportingId(null);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

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
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={exportingId === row.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void exportPdf(row.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            {exportingId === row.id ? '…' : 'PDF'}
                          </button>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                        </div>
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

function mapRowToPdfData(row: ManagementInspection): InspectionPdfData {
  const safeHttpUrl = (value: string | null | undefined): string | null => {
    const raw = String(value ?? '').trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  };

  const itemAttachmentsByChecklist = new Map<string, { url: string; type: 'image' }[]>();
  row.photos.forEach((photo) => {
    const url = safeHttpUrl(photo.url);
    if (!url) return;
    // We do not have checklist-level mapping in archive row photos; attach globally per item.
    row.responses.forEach((response) => {
      const list = itemAttachmentsByChecklist.get(response.checklist_item_id) ?? [];
      if (!list.some((item) => item.url === url)) list.push({ url, type: 'image' });
      itemAttachmentsByChecklist.set(response.checklist_item_id, list);
    });
  });

  return {
    id: row.id,
    branchName: row.branch_name,
    branchType: row.branch_type,
    officerName: row.officer_name,
    city: row.city,
    inspectionDate: row.inspection_date,
    submittedAt: row.submitted_at,
    timeIn: null,
    timeOut: null,
    complianceScore: row.compliance_score,
    riskLevel: row.risk_level,
    status: row.status,
    headComment: null,
    generalRemark: null,
    responses: row.responses.map((response) => ({
      section: response.section,
      item_text: response.item_text,
      response: response.response,
      remarks: response.remarks,
      risk_level:
        response.risk_level === 'RED' || response.risk_level === 'YELLOW' || response.risk_level === 'GREEN'
          ? response.risk_level
          : null,
      trigger_on_no: response.trigger_on_no,
      attachments: itemAttachmentsByChecklist.get(response.checklist_item_id) ?? [],
    })),
    photos: row.photos
      .map((photo) => safeHttpUrl(photo.url))
      .filter((url): url is string => Boolean(url))
      .map((url) => ({ url })),
  };
}
