import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import { supabase } from '../lib/supabase';

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

const riskPriority = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export default function HeadDashboard() {
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
          branches:branch_id (name),
          user_roles:officer_id (full_name)
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
        officer_name: item.user_roles?.full_name ?? 'Unknown Officer',
        branch_name: item.branches?.name ?? 'Unknown Branch',
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Review Operations</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Quick glance across pending inspections and recent decisions.</p>
      </div>

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
