import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import { supabase } from '../lib/supabase';

type HeadTab = 'overview' | 'escalations';

interface HeadInspection {
  id: string;
  inspection_date: string;
  submitted_at: string;
  status: string;
  compliance_score: number;
  risk_level: string;
  head_comment: string | null;
  officer_name: string;
  branch_name: string;
}

interface EscalationRow {
  id: string;
  inspection_id: string;
  checklist_item_id: string;
  risk_level: 'RED' | 'YELLOW' | 'GREEN';
  status: 'open' | 'in_progress' | 'closed';
  assigned_to: string | null;
  sla_deadline: string | null;
  reinspection_deadline: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  branch_name: string;
  officer_name: string;
  item_text: string | null;
}

const riskPriority = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export default function HeadDashboard() {
  const [tab, setTab] = useState<HeadTab>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review Operations</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Quick glance across pending inspections, recent decisions, and active escalations.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'escalations', label: 'RED Escalations' },
          ] as { key: HeadTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 text-sm font-medium rounded-t transition-colors ${
              tab === t.key
                ? 'bg-brand-600 text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <OverviewTab /> : <EscalationsTab />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB (existing dashboard)
// ════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const navigate = useNavigate();

  const { data = [], isLoading, error } = useQuery<HeadInspection[]>({
    queryKey: ['inspections', 'head-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select(`
          id,
          inspection_date,
          submitted_at,
          status,
          compliance_score,
          risk_level,
          head_comment,
          branches:branch_id (branch_name),
          user_roles:officer_id (name)
        `)
        .order('inspection_date', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((item: any) => ({
        id: item.id,
        inspection_date: item.inspection_date,
        submitted_at: item.submitted_at ?? item.inspection_date,
        status: item.status,
        compliance_score: Number(item.compliance_score ?? 0),
        risk_level: item.risk_level ?? 'low',
        head_comment: item.head_comment,
        officer_name: item.user_roles?.name ?? 'Unknown Officer',
        branch_name: item.branches?.branch_name ?? 'Unknown Branch',
      }));
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      pending: data.filter((item) => item.status === 'submitted').length,
      approvedToday: data.filter((item) => item.status === 'approved' && new Date(item.inspection_date) >= startOfToday).length,
      rejectedWeek: data.filter((item) => item.status === 'rejected' && new Date(item.inspection_date) >= startOfWeek).length,
      totalMonth: data.filter((item) => new Date(item.inspection_date) >= startOfMonth).length,
    };
  }, [data]);

  const priorityQueue = useMemo(() => {
    return data
      .filter((item) => item.status === 'submitted')
      .sort((a, b) => {
        const riskA = riskPriority[a.risk_level as keyof typeof riskPriority] ?? 99;
        const riskB = riskPriority[b.risk_level as keyof typeof riskPriority] ?? 99;
        if (riskA !== riskB) return riskA - riskB;
        return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
      });
  }, [data]);

  const recentActivity = useMemo(() => {
    return data
      .filter((item) => item.status === 'approved' || item.status === 'rejected')
      .slice(0, 10);
  }, [data]);

  const timeAgo = (date: string) => {
    const diffMs = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (error) {
    return <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">Failed to load Head dashboard.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Pending Review" value={stats.pending} color={stats.pending > 0 ? 'red' : 'green'} badge={stats.pending} loading={isLoading} />
        <StatCard label="Approved Today" value={stats.approvedToday} color="green" loading={isLoading} />
        <StatCard label="Rejected This Week" value={stats.rejectedWeek} color="yellow" loading={isLoading} />
        <StatCard label="Total This Month" value={stats.totalMonth} color="blue" loading={isLoading} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Priority Queue</h3>
            <p className="text-xs text-gray-500">Critical risk first, then oldest submitted inspections.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left">Branch</th>
                <th className="px-4 py-3 text-left">Officer</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Risk</th>
                <th className="px-4 py-3 text-left">Compliance</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {priorityQueue.map((item) => (
                <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 font-medium">{item.branch_name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.officer_name}</td>
                  <td className="px-4 py-3 text-gray-500">{timeAgo(item.submitted_at)}</td>
                  <td className="px-4 py-3"><RiskBadge level={item.risk_level} /></td>
                  <td className="px-4 py-3 font-semibold text-brand-600">{item.compliance_score.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/head/review?inspection=${item.id}`)}
                      className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium"
                    >
                      Review Now
                    </button>
                  </td>
                </tr>
              ))}
              {!priorityQueue.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">No inspections are waiting for review.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {recentActivity.map((item) => (
            <div key={item.id} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.branch_name} • {item.officer_name}</div>
                <div className="text-xs text-gray-500 mt-1">{new Date(item.inspection_date).toLocaleString('en-IN')}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">{item.head_comment?.slice(0, 120) || 'No head comment recorded.'}</div>
              </div>
              <div className={`text-xs font-semibold px-3 py-1 rounded-full ${item.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// RED ESCALATIONS TAB
// ════════════════════════════════════════════════════════════════════════════
function EscalationsTab() {
  const qc = useQueryClient();

  const { data: meId } = useQuery<string | null>({
    queryKey: ['current-user-roles-id'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();
      return data?.id ?? null;
    },
    staleTime: 5 * 60_000,
  });

  const { data = [], isLoading, error } = useQuery<EscalationRow[]>({
    queryKey: ['escalation-tickets', 'active'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalation_tickets')
        .select(`
          id, inspection_id, checklist_item_id, risk_level, status, assigned_to,
          sla_deadline, reinspection_deadline, resolved_at, resolution_notes, created_at,
          inspections:inspection_id (
            branches:branch_id ( branch_name ),
            user_roles:officer_id ( name )
          ),
          checklist_templates:checklist_item_id ( item_text )
        `)
        .neq('status', 'closed')
        .order('sla_deadline', { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        inspection_id: row.inspection_id,
        checklist_item_id: row.checklist_item_id,
        risk_level: row.risk_level,
        status: row.status,
        assigned_to: row.assigned_to,
        sla_deadline: row.sla_deadline,
        reinspection_deadline: row.reinspection_deadline,
        resolved_at: row.resolved_at,
        resolution_notes: row.resolution_notes,
        created_at: row.created_at,
        branch_name: row.inspections?.branches?.branch_name ?? 'Unknown Branch',
        officer_name: row.inspections?.user_roles?.name ?? 'Unknown Officer',
        item_text: row.checklist_templates?.item_text ?? null,
      }));
    },
  });

  const assignToMe = useMutation({
    mutationFn: async (ticketId: string) => {
      if (!meId) throw new Error('Current user role not found');
      const { error } = await supabase
        .from('escalation_tickets')
        .update({ assigned_to: meId, status: 'in_progress' })
        .eq('id', ticketId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-tickets', 'active'] }),
  });

  const resolveTicket = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('escalation_tickets')
        .update({ status: 'closed', resolved_at: new Date().toISOString(), resolution_notes: notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['escalation-tickets', 'active'] }),
  });

  const handleResolve = (id: string) => {
    const notes = window.prompt('Resolution notes (required):');
    if (!notes || !notes.trim()) return;
    resolveTicket.mutate({ id, notes: notes.trim() });
  };

  if (error) {
    return <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4">Failed to load escalations.</div>;
  }

  if (isLoading) {
    return <div className="text-gray-500">Loading escalations…</div>;
  }

  if (!data.length) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-10 text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No active escalations</h3>
        <p className="text-sm text-gray-500 mt-2">All RED items have been resolved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          {data.length} active escalation{data.length === 1 ? '' : 's'}
        </h3>
        <p className="text-xs text-gray-500">Auto-refreshes every 60 seconds</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.map((ticket) => (
          <EscalationCard
            key={ticket.id}
            ticket={ticket}
            isMine={!!meId && ticket.assigned_to === meId}
            onAssign={() => assignToMe.mutate(ticket.id)}
            onResolve={() => handleResolve(ticket.id)}
            assigning={assignToMe.isPending}
            resolving={resolveTicket.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function EscalationCard({
  ticket,
  isMine,
  onAssign,
  onResolve,
  assigning,
  resolving,
}: {
  ticket: EscalationRow;
  isMine: boolean;
  onAssign: () => void;
  onResolve: () => void;
  assigning: boolean;
  resolving: boolean;
}) {
  const slaHours = useMemo(() => {
    if (!ticket.sla_deadline) return null;
    return (new Date(ticket.sla_deadline).getTime() - Date.now()) / 36e5;
  }, [ticket.sla_deadline]);

  const slaUrgent = slaHours !== null && slaHours < 4;
  const slaExpired = slaHours !== null && slaHours <= 0;

  const slaLabel = (() => {
    if (slaHours === null) return 'No SLA';
    if (slaExpired) return `⏰ Overdue by ${Math.abs(Math.round(slaHours))}h`;
    if (slaHours < 1) return `⏰ ${Math.round(slaHours * 60)}m remaining`;
    return `⏰ ${Math.round(slaHours)}h remaining`;
  })();

  const reinspectionDate = ticket.reinspection_deadline
    ? new Date(ticket.reinspection_deadline).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const statusStyles: Record<EscalationRow['status'], string> = {
    open: 'bg-red-100 text-red-700 border border-red-200',
    in_progress: 'bg-amber-100 text-amber-700 border border-amber-200',
    closed: 'bg-green-100 text-green-700 border border-green-200',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-red-100 dark:border-red-900/40 overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/40">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider text-white bg-red-600">
            RED
          </span>
          <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusStyles[ticket.status]}`}>
            {ticket.status.replace('_', ' ')}
          </span>
        </div>
        <span
          className={`text-xs font-semibold ${
            slaExpired ? 'text-red-700' : slaUrgent ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {slaLabel}
        </span>
      </div>

      <div className="p-5 space-y-3">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{ticket.branch_name}</div>
          <div className="text-xs text-gray-500">Officer: {ticket.officer_name}</div>
        </div>

        {ticket.item_text && (
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-snug">
            <span className="text-xs uppercase tracking-wide text-gray-400 font-semibold block mb-1">Failed item</span>
            {ticket.item_text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="text-gray-400 uppercase tracking-wide font-semibold">Re-inspection by</div>
            <div className="text-gray-700 dark:text-gray-200 mt-0.5">{reinspectionDate}</div>
          </div>
          <div>
            <div className="text-gray-400 uppercase tracking-wide font-semibold">Opened</div>
            <div className="text-gray-700 dark:text-gray-200 mt-0.5">
              {new Date(ticket.created_at).toLocaleString('en-IN', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {!ticket.assigned_to || (!isMine && ticket.status === 'open') ? (
            <button
              onClick={onAssign}
              disabled={assigning}
              className="flex-1 px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              {assigning ? 'Assigning…' : 'Assign to me'}
            </button>
          ) : (
            <div className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium text-center">
              {isMine ? 'Assigned to you' : 'Assigned'}
            </div>
          )}
          <button
            onClick={onResolve}
            disabled={resolving}
            className="flex-1 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {resolving ? 'Saving…' : 'Mark Resolved'}
          </button>
        </div>
      </div>
    </div>
  );
}
