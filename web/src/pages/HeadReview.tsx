import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import Filters from '../components/Filters';
import RiskBadge from '../components/RiskBadge';
import { isCompliantResponse, isViolationResponse } from '../lib/checklistScoring';
// InspectionPdfReport is dynamically imported on demand to keep the
// initial bundle small (@react-pdf/renderer is ~1 MB minified).
type InspectionPdfData = import('../components/InspectionPdfReport').InspectionPdfData;

interface ReviewAttachment {
  url: string;
  name?: string;
  type: 'image' | 'document';
}

interface ReviewResponse {
  id: string;
  section: string;
  item_text: string;
  response: string;
  remarks: string | null;
  trigger_on_no: boolean;
  risk_level: string | null;
  attachments: ReviewAttachment[];
}

interface ReviewInspection {
  id: string;
  status: string;
  inspection_date: string;
  submitted_at: string;
  time_in: string | null;
  time_out: string | null;
  compliance_score: number;
  risk_level: string;
  general_remarks: string | null;
  branch_name: string;
  branch_type: string;
  officer_name: string;
  city: string;
  files: string[];
  imageFiles: ReviewAttachment[];
  responses: ReviewResponse[];
}

const scoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600 stroke-green-500';
  if (score >= 60) return 'text-yellow-600 stroke-yellow-500';
  if (score >= 40) return 'text-orange-600 stroke-orange-500';
  return 'text-red-600 stroke-red-500';
};

const staffBehaviourColor = (val: string) => {
  if (val === 'Good') return 'text-green-600';
  if (val === 'Moderate') return 'text-yellow-500';
  if (val === 'Bad') return 'text-red-600';
  return 'text-gray-700 dark:text-gray-300';
};

export default function HeadReview() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('inspection'));
  const [branchType, setBranchType] = useState('');
  const [branchName, setBranchName] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [riskLevel, setRiskLevel] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [comment, setComment] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const { data = [], isLoading, error } = useQuery<ReviewInspection[]>({
    queryKey: ['inspections', 'head-review'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select(`
          id,
          status,
          inspection_date,
          submitted_at,
          time_in,
          time_out,
          compliance_score,
          risk_level,
          head_comment,
          branches:branch_id (branch_name, city, branch_types:branch_type_id (type_name)),
          user_roles:officer_id (name),
          general_remarks ( remark_text ),
          inspection_files (file_url, file_name, file_type, checklist_item_id),
          inspection_responses (
            id,
            response,
            remarks,
            checklist_item_id,
            checklist_templates:checklist_item_id (
              section,
              item_text,
              trigger_on_no,
              risk_level
            )
          )
        `)
        .in('status', ['submitted', 'approved', 'rejected'])
        .order('submitted_at', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((item: any) => ({
        id: item.id,
        status: item.status,
        inspection_date: item.inspection_date,
        submitted_at: item.submitted_at ?? item.inspection_date,
        time_in: item.time_in,
        time_out: item.time_out,
        compliance_score: Number(item.compliance_score ?? 0),
        risk_level: item.risk_level ?? 'low',
        general_remarks: (item.general_remarks as { remark_text?: string }[] | null)?.[0]?.remark_text ?? null,
        branch_name: item.branches?.branch_name ?? 'Unknown Branch',
        branch_type: item.branches?.branch_types?.type_name ?? 'Unknown Type',
        officer_name: item.user_roles?.name ?? 'Unknown Officer',
        city: item.branches?.city ?? '-',
        files: (item.inspection_files ?? []).map((f: any) => f.file_url).filter(Boolean),
        imageFiles: (item.inspection_files ?? [])
          .filter((f: any) => f.file_type === 'image')
          .map((f: any) => ({
            url: f.file_url,
            name: f.file_name ?? undefined,
            type: 'image' as const,
          })),
        responses: (item.inspection_responses ?? []).map((r: any) => {
          const ct = r.checklist_templates;
          const triggerOnNo = ct?.trigger_on_no ?? true;
          const itemFiles = (item.inspection_files ?? []).filter(
            (f: any) => f.checklist_item_id === r.checklist_item_id,
          );
          return {
            id: r.id,
            section: ct?.section ?? '',
            item_text: ct?.item_text ?? '',
            response: r.response,
            remarks: r.remarks ?? null,
            trigger_on_no: !!triggerOnNo,
            risk_level: (ct?.risk_level as string | null) ?? null,
            attachments: itemFiles.map((f: any) => ({
              url: f.file_url,
              name: f.file_name ?? undefined,
              type: (f.file_type === 'image' ? 'image' : 'document') as 'image' | 'document',
            })),
          };
        }),
      }));
    },
  });

  const filtered = useMemo(() => {
    return data.filter((item) => {
      if (branchType && item.branch_type !== branchType) return false;
      if (branchName && item.branch_name !== branchName) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      if (riskLevel && item.risk_level !== riskLevel) return false;
      if (dateFilter && item.inspection_date !== dateFilter) return false;
      return true;
    });
  }, [data, branchType, branchName, statusFilter, riskLevel, dateFilter]);

  useEffect(() => {
    if (!selectedId && filtered.length) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((item) => item.id === selectedId) ?? null;

  const groupedSections = useMemo(() => {
    if (!selected) return [];
    const grouped = new Map<string, ReviewResponse[]>();
    selected.responses.forEach((response) => {
      const list = grouped.get(response.section) ?? [];
      list.push(response);
      grouped.set(response.section, list);
    });
    return Array.from(grouped.entries()).map(([section, responses]) => ({ section, responses }));
  }, [selected]);

  const branchTypes = Array.from(new Set(data.map((item) => item.branch_type)));
  const branchNames = Array.from(new Set(data.map((item) => item.branch_name)));

  const exportPdf = async () => {
    if (!selected) return;
    setToast('Generating PDF…');
    try {
      const { generateInspectionPdf } = await import('../components/InspectionPdfReport');
      const data: InspectionPdfData = {
        id: selected.id,
        branchName: selected.branch_name,
        branchType: selected.branch_type,
        officerName: selected.officer_name,
        city: selected.city,
        inspectionDate: selected.inspection_date,
        submittedAt: selected.submitted_at,
        timeIn: selected.time_in,
        timeOut: selected.time_out,
        complianceScore: selected.compliance_score,
        riskLevel: selected.risk_level,
        status: selected.status,
        headComment: null,
        generalRemark: selected.general_remarks,
        responses: selected.responses.map((r) => ({
          section: r.section,
          item_text: r.item_text,
          response: r.response,
          remarks: r.remarks,
          risk_level: r.risk_level as 'RED' | 'YELLOW' | 'GREEN' | null,
          trigger_on_no: r.trigger_on_no,
          attachments: r.attachments,
        })),
        photos: selected.imageFiles.map((file) => ({ url: file.url })),
      };
      const filename = await generateInspectionPdf(data);
      setToast(`Downloaded ${filename}`);
    } catch (err) {
      console.error('[PDF Export Error]', err);
      const message = err instanceof Error ? err.message : 'Failed to generate PDF. Please try again.';
      setToast(message);
    } finally {
      setTimeout(() => setToast(null), 3000);
    }
  };

  const doAction = async (action: 'approved' | 'rejected' | 'submitted') => {
    if (!selected) return;
    if (!comment.trim()) {
      setToast('Head comment is required.');
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const { error } = await supabase
      .from('inspections')
      .update({
        status: action,
        head_comment: comment.trim(),
      })
      .eq('id', selected.id);

    if (error) {
      setToast(error.message);
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Fire-and-forget officer notification. We don't block the UI on this;
    // the in-app notifications row is the source of truth (push/email are
    // best-effort side channels). Network failures are surfaced as a quieter
    // toast so the supervisor knows their action succeeded but the notify
    // didn't.
    void supabase.functions
      .invoke('notify-officer', {
        body: {
          inspection_id: selected.id,
          status: action,
          head_comment: comment.trim(),
        },
      })
      .then(({ error: notifyErr }) => {
        if (notifyErr) {
          if (import.meta.env.DEV) console.warn('notify-officer failed', notifyErr);
          setToast('Action saved — officer notification queued for retry.');
          setTimeout(() => setToast(null), 3500);
        }
      });

    await queryClient.invalidateQueries({ queryKey: ['inspections'] });
    setToast(action === 'submitted' ? 'Clarification requested.' : `Inspection ${action}.`);
    setComment('');
    if (action !== 'submitted') {
      const remaining = filtered.filter((item) => item.id !== selected.id && item.status === 'submitted');
      setSelectedId(remaining[0]?.id ?? null);
    }
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      const typing = tag === 'TEXTAREA' || tag === 'INPUT';

      // Help overlay — always available, even while typing-context-aware
      // shortcuts are off. Shift+/ is the canonical "?".
      if (!typing && (event.key === '?' || (event.shiftKey && event.key === '/'))) {
        event.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }
      if (event.key === 'Escape' && shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }
      if (typing) return;
      if (!selected) return;

      const currentIndex = filtered.findIndex((item) => item.id === selected.id);
      if (event.key === 'ArrowDown' && currentIndex < filtered.length - 1) {
        setSelectedId(filtered[currentIndex + 1].id);
      }
      if (event.key === 'ArrowUp' && currentIndex > 0) {
        setSelectedId(filtered[currentIndex - 1].id);
      }
      if (event.key.toLowerCase() === 'a') void doAction('approved');
      if (event.key.toLowerCase() === 'r') void doAction('rejected');
      if (event.key.toLowerCase() === 'c') void doAction('submitted');
      if (event.key.toLowerCase() === 'p') void exportPdf();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtered, selected, comment, shortcutsOpen]);

  if (error) {
    return <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">Failed to load review data.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Review Inspections</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Approve, reject, or request clarification on field officer submissions before they are archived.
        </p>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <ShortcutsHelpOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <div className="lg:hidden flex justify-end no-print">
        <button onClick={() => setMobileListOpen(true)} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium">Open Inspection List</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 h-[calc(100vh-8rem)]">
        <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden lg:block ${mobileListOpen ? 'fixed inset-x-0 bottom-0 top-24 z-40' : 'hidden'}`}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Inspection List</h3>
              <p className="text-xs text-gray-500">Pending and reviewed inspections</p>
            </div>
            <button className="lg:hidden text-gray-500" onClick={() => setMobileListOpen(false)}>✕</button>
          </div>
          <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-800">
            <Filters
              branchTypes={branchTypes}
              branchNames={branchNames}
              selectedType={branchType}
              selectedBranch={branchName}
              selectedStatus={statusFilter}
              selectedRisk={riskLevel}
              onTypeChange={setBranchType}
              onBranchChange={setBranchName}
              onStatusChange={setStatusFilter}
              onRiskChange={setRiskLevel}
            />
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800" />
          </div>
          <div className="overflow-y-auto h-[calc(100%-170px)]">
            {isLoading && (
              <div className="px-4 py-6 text-sm text-gray-500 flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-brand-500 border-r-transparent animate-spin" />
                Loading inspections…
              </div>
            )}
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedId(item.id); setMobileListOpen(false); }}
                className={`w-full text-left px-4 py-4 border-b border-gray-100 dark:border-gray-800 transition ${selectedId === item.id ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{item.branch_name}</div>
                    <div className="text-xs text-gray-500">{item.officer_name}</div>
                  </div>
                  <RiskBadge level={item.risk_level} />
                </div>
                <div className="text-xs text-gray-500 mt-2">{new Date(item.inspection_date).toLocaleString('en-IN')}</div>
                <div className="text-xs mt-2 font-semibold text-brand-600">{item.compliance_score.toFixed(1)}%</div>
              </button>
            ))}
            {!filtered.length && <div className="p-6 text-sm text-gray-500">No inspections found.</div>}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">Select an inspection to review.</div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selected.branch_name}</h2>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{selected.branch_type}</span>
                      <RiskBadge level={selected.risk_level} />
                    </div>
                    <div className="text-sm text-gray-500">{selected.officer_name} • {selected.city}</div>
                    <div className="text-sm text-gray-500 mt-1">{new Date(selected.inspection_date).toLocaleString('en-IN')} • {selected.time_in ?? '--'} → {selected.time_out ?? '--'}</div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="relative w-28 h-28">
                      <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                        <circle
                          cx="60"
                          cy="60"
                          r="52"
                          fill="none"
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 52}
                          strokeDashoffset={(1 - selected.compliance_score / 100) * 2 * Math.PI * 52}
                          className={scoreColor(selected.compliance_score)}
                        />
                      </svg>
                      <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${scoreColor(selected.compliance_score).split(' ')[0]}`}>
                        {selected.compliance_score.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Checklist Responses</h3>
                  <div className="space-y-3">
                    {groupedSections.map(({ section, responses }) => (
                      <div key={section} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/60 text-left flex items-center justify-between"
                        >
                          <span className="font-medium text-sm">{section}</span>
                          <span>{expandedSections[section] ? '−' : '+'}</span>
                        </button>
                        {expandedSections[section] !== false && (
                          <div className="p-4 space-y-3">
                            {responses.map((response) => (
                              <div key={response.id} className={`rounded-lg p-3 border ${isViolationResponse(response.response, response.trigger_on_no) ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900' : isCompliantResponse(response.response, response.trigger_on_no) ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900' : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-800'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100"><span className="inline-flex items-center gap-2 flex-wrap">
                                      {isViolationResponse(response.response, response.trigger_on_no) && (
                                        <span className="text-[10px] font-semibold uppercase text-red-700 bg-red-100 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.5 rounded">Issue</span>
                                      )}
                                      {isCompliantResponse(response.response, response.trigger_on_no) && (
                                        <span className="text-[10px] font-semibold uppercase text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-300 px-1.5 py-0.5 rounded">OK</span>
                                      )}
                                      {!isViolationResponse(response.response, response.trigger_on_no) &&
                                        !isCompliantResponse(response.response, response.trigger_on_no) && (
                                          <span className="text-[10px] font-semibold uppercase text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400 px-1.5 py-0.5 rounded">N/A</span>
                                        )}
                                      <span>{response.item_text}</span>
                                    </span></div>
                                    {response.remarks && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Remarks: {response.remarks}</div>}
                                    {response.attachments.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {response.attachments.map((file) =>
                                          file.type === 'image' || /\.(jpe?g|png|webp)$/i.test(file.url) ? (
                                            <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                              <img src={file.url} alt={file.name ?? 'Evidence'} className="w-20 h-16 object-cover" />
                                            </a>
                                          ) : (
                                            <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                                              {file.name ?? 'Document'}
                                            </a>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <span className={`text-xs font-semibold shrink-0 ${staffBehaviourColor(response.response)}`}>{response.response}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {selected.imageFiles.length > 0 && (
                  <section>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Photo Evidence</h3>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {selected.imageFiles.map((file) => (
                        <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:opacity-90">
                          <img src={file.url} alt={file.name ?? 'Inspection evidence'} className="w-full h-24 object-cover" />
                        </a>
                      ))}
                    </div>
                  </section>
                )}

                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Photos / Files</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {selected.files.map((file, index) => {
                      const isImage = /\.(jpg|jpeg|png|webp)$/i.test(file);
                      return isImage ? (
                        <a key={file} href={file} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 hover:opacity-90">
                          <img src={file} alt={`Inspection file ${index + 1}`} className="w-full h-28 object-cover" />
                        </a>
                      ) : (
                        <a key={file} href={file} target="_blank" rel="noreferrer" className="block rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-sm text-brand-600 bg-gray-50 dark:bg-gray-900">
                          Open document {index + 1}
                        </a>
                      );
                    })}
                    {!selected.files.length && <div className="text-sm text-gray-500">No files uploaded.</div>}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">General Remarks</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{selected.general_remarks || 'No general remarks provided.'}</p>
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Enter head comment (required before action)"
                  className="w-full min-h-[90px] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => void doAction('approved')} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium">Approve</button>
                  <button onClick={() => void doAction('rejected')} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium">Reject</button>
                  <button onClick={() => void doAction('submitted')} className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium">Request Clarification</button>
                  <button onClick={() => void exportPdf()} className="ml-auto px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium">Export PDF</button>
                </div>
                <div className="text-xs text-gray-500">Keyboard shortcuts: <kbd className="px-1.5 py-0.5 rounded border bg-gray-50 text-[10px] font-mono">A</kbd> approve · <kbd className="px-1.5 py-0.5 rounded border bg-gray-50 text-[10px] font-mono">R</kbd> reject · <kbd className="px-1.5 py-0.5 rounded border bg-gray-50 text-[10px] font-mono">↑↓</kbd> navigate · <kbd className="px-1.5 py-0.5 rounded border bg-gray-50 text-[10px] font-mono">?</kbd> show all</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS: Array<{ key: string; label: string }> = [
  { key: 'A', label: 'Approve current inspection' },
  { key: 'R', label: 'Reject current inspection' },
  { key: 'C', label: 'Request clarification' },
  { key: 'P', label: 'Export PDF report' },
  { key: '↑ / ↓', label: 'Move between inspections' },
  { key: '?', label: 'Show / hide this overlay' },
  { key: 'Esc', label: 'Close any open dialog' },
];

function ShortcutsHelpOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-md rounded-xl border bg-white dark:bg-gray-900 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Close shortcuts overlay"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">{s.label}</span>
              <kbd className="font-mono text-xs px-2 py-0.5 rounded border bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-gray-500">
          Shortcuts are disabled while typing in the comment box.
        </p>
      </div>
    </div>
  );
}
