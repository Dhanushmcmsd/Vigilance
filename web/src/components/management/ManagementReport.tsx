import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Folder,
  Search,
  Store,
  X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
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
      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{weekday}</p>
        <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">{dateLine}</p>
        <p className="mt-1.5 text-sm text-slate-500">Officer: {report.officer?.name ?? 'Unknown'}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
          <FileText className="h-3.5 w-3.5" />
          View checklist report
        </div>
      </div>
      {report.compliance_score !== null && (
        <span className="text-2xl font-black tabular-nums" style={{ color: scoreColor }}>
          {report.compliance_score.toFixed(0)}%
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
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

  const imageFiles = (data?.inspection_files ?? []).filter(
    (f) =>
      f.file_type === 'image' ||
      /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(f.file_url),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">{branchName}</p>
            {data && (
              <>
                <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {new Date(data.inspection_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-sm text-slate-500">Officer: {data.officer?.name ?? '—'}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data?.compliance_score !== null && data?.compliance_score !== undefined && (
              <span
                className="text-3xl font-black tabular-nums"
                style={{ color: auditScoreColor(data.compliance_score) }}
              >
                {data.compliance_score.toFixed(0)}%
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && <p className="py-8 text-center text-slate-500">Loading report…</p>}
          {!isLoading && !data && <p className="py-8 text-center text-slate-500">Report not found.</p>}
          {data && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Inspection Summary</p>
                <div className="mt-3 flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Time In</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatReportTime(data.time_in)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Time Out</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatReportTime(data.time_out)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="font-semibold capitalize text-green-600">{data.status}</p>
                  </div>
                </div>
                {data.head_comment && (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {data.head_comment}
                  </p>
                )}
              </div>

              {Object.entries(sections).map(([section, items]) => (
                <div key={section} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                      {section}
                    </p>
                  </div>
                  {items.map((r) => {
                    const triggerOnNo = r.checklist_item?.trigger_on_no ?? true;
                    const violation = isViolationResponse(r.response, triggerOnNo);
                    const itemText = r.checklist_item?.item_text ?? '—';
                    return (
                      <div
                        key={r.id}
                        className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800 ${
                          violation ? 'bg-red-50/60 dark:bg-red-950/20' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <p className="text-sm text-slate-900 dark:text-white">{itemText}</p>
                          {violation && (
                            <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
                              {formatNonComplianceAlert(itemText, r.response, triggerOnNo)}
                            </p>
                          )}
                          {r.remarks && (
                            <p className="mt-1 text-xs text-slate-500">Remark: {r.remarks}</p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-sm font-bold ${
                            violation ? 'text-red-600' : r.response === 'Yes' ? 'text-green-600' : 'text-slate-500'
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
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">General Remarks</p>
                  {data.general_remarks.map((r, i) => (
                    <p key={i} className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                      {r.remark_text}
                    </p>
                  ))}
                </div>
              )}

              {imageFiles.length > 0 && (
                <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Photo Evidence</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {imageFiles.map((f) => (
                      <a
                        key={f.id}
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
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
    </div>
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
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Management Report</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Browse field officer checklists by store — same view as the mobile audit app.
            </p>
          </div>
          {view.kind !== 'stores' && (
            <button
              type="button"
              onClick={() => {
                if (view.kind === 'month') {
                  setView({ kind: 'store', branchId: view.branchId, branchName: view.branchName });
                } else {
                  setView({ kind: 'stores' });
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {view.kind === 'stores' && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores…"
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            {branchesLoading ? (
              <p className="py-12 text-center text-slate-500">Loading stores…</p>
            ) : filteredBranches.length === 0 ? (
              <p className="py-12 text-center text-slate-500">No stores match your search.</p>
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
                      className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-left transition hover:border-teal-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-teal-700"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40">
                        <Store className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white">{branch.branch_name}</p>
                        {location && <p className="text-sm text-slate-500">{location}</p>}
                        <p className="mt-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400">
                          {branch.reportCount} {branch.reportCount === 1 ? 'report' : 'reports'}
                        </p>
                      </div>
                      {branch.lastScore !== null ? (
                        <span className="text-xl font-black tabular-nums" style={{ color: scoreColor }}>
                          {branch.lastScore.toFixed(0)}%
                        </span>
                      ) : null}
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {view.kind === 'store' && (
          <>
            <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
              {view.branchName} · {storeReports?.length ?? 0} reports
            </p>
            {reportsLoading ? (
              <p className="py-12 text-center text-slate-500">Loading reports…</p>
            ) : !storeReports?.length ? (
              <p className="py-12 text-center text-slate-500">No submitted reports for this store yet.</p>
            ) : (
              <div className="space-y-6">
                {groups.currentMonthDays.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                      {groups.currentMonthLabel}
                    </p>
                    <p className="mb-3 mt-1 text-xs text-slate-500">
                      Tap a day to open the field officer checklist
                    </p>
                    <div className="space-y-3">
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
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                      Earlier months
                    </p>
                    <p className="mb-3 mt-1 text-xs text-slate-500">
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
                          className="flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40">
                            <Folder className="h-5 w-5 text-teal-700 dark:text-teal-400" />
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-slate-900 dark:text-white">{folder.label}</p>
                            <p className="text-sm text-slate-500">
                              {folder.reportCount} {folder.reportCount === 1 ? 'report' : 'reports'}
                            </p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400" />
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
            <p className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
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
    </section>
  );
}
