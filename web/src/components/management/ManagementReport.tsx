import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FileText,
  Folder,
  Search,
  Store,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buildInspectionPdfDataFromReportDetail } from '../../lib/auditExport';
import { dedupeInspectionImageFiles } from '../../lib/inspectionImages';
import { isViolationResponse } from '../../lib/checklistScoring';
import { formatNonComplianceAlert } from '../../lib/alertDescriptions';
import {
  auditScoreColor,
  formatReportDayLine,
  groupStoreReports,
  monthFolderLabel,
  reportsInMonth,
  type AuditReportRow,
} from '../../lib/auditReports';
import { BloomGradientPanel } from '../ui/BloomGradientPanel';

interface BranchSummary {
  id: string;
  branch_name: string;
  city: string | null;
  region: string | null;
  reportCount: number;
  lastScore: number | null;
  lastDate: string | null;
}

interface ReportDetail {
  id: string;
  inspection_date: string;
  status: string;
  compliance_score: number | null;
  risk_level: string | null;
  head_comment: string | null;
  submitted_at: string | null;
  time_in: string | null;
  time_out: string | null;
  officer: { name: string } | null;
  inspection_responses: {
    id: string;
    response: string;
    remarks: string | null;
    checklist_item: {
      item_text: string;
      section: string;
      trigger_on_no: boolean;
    } | null;
  }[];
  inspection_files: { id: string; file_url: string; file_name: string; file_type: string }[];
  general_remarks: { remark_text: string }[];
}

type View =
  | { kind: 'stores' }
  | { kind: 'store'; branchId: string; branchName: string }
  | { kind: 'month'; branchId: string; branchName: string; yearMonth: string };

function formatReportTime(value: string | null | undefined): string {
  if (!value?.trim()) return '—';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value.trim();
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  const isPm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
}

function ReportCard({ report, onOpen }: { report: AuditReportRow; onOpen: () => void }) {
  const { weekday, dateLine } = formatReportDayLine(report.inspection_date);
  const scoreColor = auditScoreColor(report.compliance_score);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="bloom-panel-nested flex w-full items-center gap-4 p-4 text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{weekday}</p>
        <p className="mt-0.5 text-base font-semibold text-white">{dateLine}</p>
        <p className="mt-1.5 text-sm text-white/55">Officer: {report.officer?.name ?? 'Unknown'}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/70">
          <FileText className="h-3.5 w-3.5" />
          Open report
        </div>
      </div>
      {report.compliance_score !== null && (
        <span className="text-2xl font-black tabular-nums" style={{ color: scoreColor }}>
          {report.compliance_score.toFixed(0)}%
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />
    </button>
  );
}

function ReportDetailModal({
  inspectionId,
  branchName,
  onClose,
}: {
  inspectionId: string;
  branchName: string;
  onClose: () => void;
}) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setPdfLoading(true);
    setPdfError(null);
    try {
      const pdfData = buildInspectionPdfDataFromReportDetail(data, branchName);
      const { generateInspectionPdf } = await import('../InspectionPdfReport');
      await generateInspectionPdf(pdfData, {
        filenamePrefix: 'management-report',
        documentTitle: 'MANAGEMENT REPORT',
      });
    } catch (err) {
      console.error('[ManagementReport PDF]', err);
      setPdfError(err instanceof Error ? err.message : 'PDF download failed. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const { data, isLoading } = useQuery<ReportDetail | null>({
    queryKey: ['management-report-detail', inspectionId],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, status, compliance_score, risk_level,
          head_comment, submitted_at, time_in, time_out,
          officer:user_roles!inspections_officer_id_fkey ( name ),
          inspection_responses (
            id, response, remarks,
            checklist_item:checklist_templates!inspection_responses_checklist_item_id_fkey (
              item_text, section, trigger_on_no
            )
          ),
          inspection_files ( id, file_url, file_name, file_type ),
          general_remarks ( remark_text )
        `,
        )
        .eq('id', inspectionId)
        .maybeSingle();
      if (error) throw error;
      return row as ReportDetail | null;
    },
  });

  const sections = useMemo(() => {
    const grouped: Record<string, ReportDetail['inspection_responses']> = {};
    (data?.inspection_responses ?? []).forEach((r) => {
      const sec = r.checklist_item?.section ?? 'General';
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(r);
    });
    return grouped;
  }, [data?.inspection_responses]);

  const imageFiles = useMemo(
    () => dedupeInspectionImageFiles(data?.inspection_files ?? []),
    [data?.inspection_files],
  );

  return createPortal(
    <div
      className="vms-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Inspection report"
      onClick={onClose}
    >
      <div className="vms-report-modal" onClick={(event) => event.stopPropagation()}>
        <div className="vms-report-modal-header">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{branchName}</p>
            {data && (
              <>
                <h3 className="mt-1 truncate text-lg font-semibold text-white">
                  {new Date(data.inspection_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-sm text-slate-400">Officer: {data.officer?.name ?? '—'}</p>
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {data?.compliance_score !== null && data?.compliance_score !== undefined && (
              <span
                className="mr-1 text-2xl font-bold tabular-nums"
                style={{ color: auditScoreColor(data.compliance_score) }}
              >
                {data.compliance_score.toFixed(0)}%
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={pdfLoading || isLoading || !data}
              className="vms-modal-btn-primary"
            >
              <Download className="h-3.5 w-3.5" />
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </button>
            <button type="button" onClick={onClose} className="vms-modal-btn-ghost" aria-label="Close report">
              <X className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>

        {pdfError && (
          <div className="mx-5 mt-3 rounded-lg border border-red-400/35 bg-red-950/40 px-3 py-2 text-xs text-red-100">
            {pdfError}
          </div>
        )}

        <div className="vms-report-modal-body">
          {isLoading && <p className="py-10 text-center text-slate-400">Loading report…</p>}
          {!isLoading && !data && <p className="py-10 text-center text-slate-400">Report not found.</p>}
          {data && (
            <div className="space-y-4">
              <div className="vms-report-section p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inspection Summary</p>
                <div className="mt-3 flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-xs text-white/55">Time In</p>
                    <p className="font-semibold text-white">{formatReportTime(data.time_in)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/55">Time Out</p>
                    <p className="font-semibold text-white">{formatReportTime(data.time_out)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/55">Status</p>
                    <p className="font-semibold capitalize text-emerald-300">{data.status}</p>
                  </div>
                </div>
                {data.head_comment && (
                  <p className="mt-3 rounded-lg bg-black/25 p-3 text-sm text-white/85">
                    {data.head_comment}
                  </p>
                )}
              </div>

              {Object.entries(sections).map(([section, items]) => (
                <div key={section} className="vms-report-section overflow-hidden p-0">
                  <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{section}</p>
                  </div>
                  {items.map((r) => {
                    const triggerOnNo = r.checklist_item?.trigger_on_no ?? true;
                    const violation = isViolationResponse(r.response, triggerOnNo);
                    const itemText = r.checklist_item?.item_text ?? '—';
                    return (
                      <div
                        key={r.id}
                        className={`flex gap-3 border-b border-white/8 px-4 py-3 last:border-0 ${
                          violation ? 'bg-red-950/30' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm text-white">{itemText}</p>
                          {violation && (
                            <p className="mt-1 text-xs font-semibold text-red-300">
                              {formatNonComplianceAlert(itemText, r.response, triggerOnNo)}
                            </p>
                          )}
                          {r.remarks && (
                            <p className="mt-1 text-xs text-white/55">Remark: {r.remarks}</p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-sm font-bold ${
                            violation ? 'text-red-300' : r.response === 'Yes' ? 'text-emerald-300' : 'text-white/55'
                          }`}
                        >
                          {r.response}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {(data.general_remarks ?? []).length > 0 && (
                <div className="vms-report-section p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">General Remarks</p>
                  {data.general_remarks.map((r, i) => (
                    <p key={i} className="mt-2 text-sm text-white/85">
                      {r.remark_text}
                    </p>
                  ))}
                </div>
              )}

              {imageFiles.length > 0 && (
                <div className="vms-report-section p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Photo Evidence</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {imageFiles.map((f) => (
                      <a
                        key={f.id}
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border border-white/15"
                      >
                        <img src={f.file_url} alt={f.file_name} className="h-24 w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ManagementReport() {
  const [view, setView] = useState<View>({ kind: 'stores' });
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<{ id: string; branchName: string } | null>(null);

  const { data: branches, isLoading: branchesLoading } = useQuery<BranchSummary[]>({
    queryKey: ['management-report-branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select(
          `
          id, branch_name, city, region,
          inspections!inspections_branch_id_fkey (
            id, inspection_date, compliance_score, status, submitted_at
          )
        `,
        )
        .eq('is_active', true)
        .order('branch_name', { ascending: true });
      if (error) throw error;

      return ((data ?? []) as {
        id: string;
        branch_name: string;
        city: string | null;
        region: string | null;
        inspections: AuditReportRow[] | null;
      }[])
        .map((b) => {
          const submitted = (b.inspections ?? []).filter((i) => i.status !== 'draft');
          const sorted = [...submitted].sort(
            (a, c) =>
              new Date(c.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime(),
          );
          return {
            id: b.id,
            branch_name: b.branch_name,
            city: b.city,
            region: b.region,
            reportCount: submitted.length,
            lastScore: sorted[0]?.compliance_score ?? null,
            lastDate: sorted[0]?.inspection_date ?? null,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.lastDate ?? 0).getTime() - new Date(a.lastDate ?? 0).getTime(),
        );
    },
  });

  const branchId = view.kind !== 'stores' ? view.branchId : null;

  const { data: storeReports, isLoading: reportsLoading } = useQuery<AuditReportRow[]>({
    queryKey: ['management-report-store', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, submitted_at, status, compliance_score, risk_level,
          officer:user_roles!inspections_officer_id_fkey ( name )
        `,
        )
        .eq('branch_id', branchId!)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (rows ?? []) as unknown as AuditReportRow[];
    },
  });

  const filteredBranches = (branches ?? []).filter(
    (b) =>
      b.branch_name.toLowerCase().includes(search.toLowerCase()) ||
      (b.city ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const groups = useMemo(() => groupStoreReports(storeReports ?? []), [storeReports]);

  const monthReports =
    view.kind === 'month' ? reportsInMonth(storeReports ?? [], view.yearMonth) : [];

  return (
    <BloomGradientPanel className="overflow-hidden p-0" noPadding>
      {view.kind !== 'stores' && (
        <div className="flex items-center justify-end border-b border-white/10 px-5 py-3">
          <button
            type="button"
            onClick={() => {
              if (view.kind === 'month') {
                setView({ kind: 'store', branchId: view.branchId, branchName: view.branchName });
              } else {
                setView({ kind: 'stores' });
              }
            }}
            className="bloom-btn-ghost"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      )}

      <div className="p-5">
        {view.kind === 'stores' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores…"
                className="bloom-input py-2.5 pl-10"
              />
            </div>
            {branchesLoading ? (
              <p className="py-12 text-center text-white/65">Loading stores…</p>
            ) : filteredBranches.length === 0 ? (
              <p className="py-12 text-center text-white/65">No stores match your search.</p>
            ) : (
              <div className="space-y-3">
                {filteredBranches.map((branch) => {
                  const location = [branch.city, branch.region].filter(Boolean).join(' · ');
                  const scoreColor = auditScoreColor(branch.lastScore);
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() =>
                        setView({ kind: 'store', branchId: branch.id, branchName: branch.branch_name })
                      }
                      className="bloom-panel-nested flex w-full items-center gap-4 p-4 text-left"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <Store className="h-5 w-5 text-white/70" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white">{branch.branch_name}</p>
                        {location && <p className="text-sm text-white/65">{location}</p>}
                        <p className="mt-1.5 text-xs font-medium text-white/50">
                          {branch.reportCount} {branch.reportCount === 1 ? 'report' : 'reports'}
                        </p>
                      </div>
                      {branch.lastScore !== null ? (
                        <span className="text-xl font-black tabular-nums" style={{ color: scoreColor }}>
                          {branch.lastScore.toFixed(0)}%
                        </span>
                      ) : null}
                      <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view.kind === 'store' && (
          <>
            <p className="mb-4 text-sm font-semibold text-white/85">
              {view.branchName} · {storeReports?.length ?? 0} reports
            </p>
            {reportsLoading ? (
              <p className="py-12 text-center text-white/65">Loading reports…</p>
            ) : !storeReports?.length ? (
              <p className="py-12 text-center text-white/65">No submitted reports for this store yet.</p>
            ) : (
              <div className="space-y-6">
                {groups.currentMonthDays.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                      {groups.currentMonthLabel}
                    </p>
                    <div className="mt-3 space-y-3">
                      {groups.currentMonthDays.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onOpen={() =>
                            setSelectedReport({ id: report.id, branchName: view.branchName })
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
                {groups.monthFolders.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                      Earlier months
                    </p>
                    <p className="mb-3 mt-1 text-xs text-white/55">
                      Reports older than this month are stored in monthly folders
                    </p>
                    <div className="space-y-3">
                      {groups.monthFolders.map((folder) => (
                        <button
                          key={folder.key}
                          type="button"
                          onClick={() =>
                            setView({
                              kind: 'month',
                              branchId: view.branchId,
                              branchName: view.branchName,
                              yearMonth: folder.key,
                            })
                          }
                          className="bloom-panel-nested flex w-full items-center gap-4 p-4 text-left"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                            <Folder className="h-5 w-5 text-white/70" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-white">{folder.label}</p>
                            <p className="text-sm text-white/65">
                              {folder.reportCount} {folder.reportCount === 1 ? 'report' : 'reports'}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-white/45" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {view.kind === 'month' && (
          <>
            <p className="mb-4 text-sm font-semibold text-white/85">
              {view.branchName} · {monthFolderLabel(view.yearMonth)}
            </p>
            <div className="space-y-3">
              {monthReports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onOpen={() => setSelectedReport({ id: report.id, branchName: view.branchName })}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {selectedReport && (
        <ReportDetailModal
          inspectionId={selectedReport.id}
          branchName={selectedReport.branchName}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </BloomGradientPanel>
  );
}
