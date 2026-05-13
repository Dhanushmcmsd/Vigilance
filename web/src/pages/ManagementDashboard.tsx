import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import StatCard from '../components/StatCard';
import ComplianceChart from '../components/ComplianceChart';
import BranchHeatmap from '../components/BranchHeatmap';
import InspectionTable, { type BranchRow } from '../components/InspectionTable';
import BranchDetailDrawer from '../components/BranchDetailDrawer';
import { supabase } from '../lib/supabase';

type RangeKey = 'today' | 'week' | 'month' | 'quarter' | 'custom';

interface InspectionResponse {
  section: string;
  item_text: string;
  response: string;
  remarks: string | null;
}

interface InspectionItem {
  id: string;
  status: string;
  compliance_score: number;
  risk_level: string;
  submitted_at: string;
  inspection_date: string;
  general_remarks: string | null;
  branch_id: string;
  branch_name: string;
  branch_type: string;
  city: string;
  region: string;
  officer_name: string;
  responses: InspectionResponse[];
}

const getDateRange = (range: RangeKey, from: string, to: string) => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(now.getDate() - diff);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'quarter') {
    start.setMonth(now.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
  } else if (range === 'custom' && from && to) {
    return {
      start: new Date(`${from}T00:00:00`),
      end: new Date(`${to}T23:59:59`),
    };
  }

  return { start, end };
};

const previousPeriod = (start: Date, end: Date) => {
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { prevStart, prevEnd };
};

const trendPercent = (current: number, previous: number) => {
  if (!previous && !current) return 0;
  if (!previous) return 100;
  return Math.round(((current - previous) / previous) * 100);
};

export default function ManagementDashboard() {
  const [range, setRange] = useState<RangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<keyof BranchRow>('avgCompliance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedBranch, setSelectedBranch] = useState<BranchRow | null>(null);

  const { start, end } = getDateRange(range, customFrom, customTo);
  const { prevStart, prevEnd } = previousPeriod(start, end);

  const { data = [], isLoading, error } = useQuery<InspectionItem[]>({
    queryKey: ['inspections', 'management-dashboard'],
    queryFn: async () => {
      const { data: inspections, error: inspectionsError } = await supabase
        .from('inspections')
        .select(`
          id,
          status,
          compliance_score,
          risk_level,
          submitted_at,
          inspection_date,
          general_remarks,
          branch_id,
          branches:branch_id (name, city, region, branch_types:type_id (name)),
          user_roles:officer_id (full_name),
          inspection_responses (section, item_text, response, remarks)
        `)
        .in('status', ['submitted', 'approved', 'rejected'])
        .order('inspection_date', { ascending: false });

      if (inspectionsError) throw inspectionsError;

      return (inspections ?? []).map((item: any) => ({
        id: item.id,
        status: item.status,
        compliance_score: Number(item.compliance_score ?? 0),
        risk_level: item.risk_level ?? 'low',
        submitted_at: item.submitted_at ?? item.inspection_date,
        inspection_date: item.inspection_date,
        general_remarks: item.general_remarks,
        branch_id: item.branch_id,
        branch_name: item.branches?.name ?? 'Unknown Branch',
        branch_type: item.branches?.branch_types?.name ?? 'Unknown Type',
        city: item.branches?.city ?? '-',
        region: item.branches?.region ?? '-',
        officer_name: item.user_roles?.full_name ?? 'Unknown Officer',
        responses: item.inspection_responses ?? [],
      }));
    },
  });

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const date = new Date(item.inspection_date);
      return date >= start && date <= end;
    });
  }, [data, start, end]);

  const previousFiltered = useMemo(() => {
    return data.filter((item) => {
      const date = new Date(item.inspection_date);
      return date >= prevStart && date <= prevEnd;
    });
  }, [data, prevStart, prevEnd]);

  const stats = useMemo(() => {
    const currentTotal = filtered.length;
    const previousTotal = previousFiltered.length;

    const currentCompliance = filtered.length
      ? filtered.reduce((sum, item) => sum + item.compliance_score, 0) / filtered.length
      : 0;
    const previousCompliance = previousFiltered.length
      ? previousFiltered.reduce((sum, item) => sum + item.compliance_score, 0) / previousFiltered.length
      : 0;

    const currentCritical = filtered.filter((item) => item.risk_level === 'critical').length;
    const previousCritical = previousFiltered.filter((item) => item.risk_level === 'critical').length;

    const currentPending = filtered.filter((item) => item.status === 'submitted').length;
    const previousPending = previousFiltered.filter((item) => item.status === 'submitted').length;

    const cfc = filtered.filter((item) => item.branch_type.toLowerCase().includes('cfc'));
    const store = filtered.filter((item) => item.branch_type.toLowerCase().includes('store'));
    const prevCfc = previousFiltered.filter((item) => item.branch_type.toLowerCase().includes('cfc'));
    const prevStore = previousFiltered.filter((item) => item.branch_type.toLowerCase().includes('store'));

    const cfcCompliance = cfc.length ? cfc.reduce((sum, item) => sum + item.compliance_score, 0) / cfc.length : 0;
    const storeCompliance = store.length ? store.reduce((sum, item) => sum + item.compliance_score, 0) / store.length : 0;
    const prevCfcCompliance = prevCfc.length ? prevCfc.reduce((sum, item) => sum + item.compliance_score, 0) / prevCfc.length : 0;
    const prevStoreCompliance = prevStore.length ? prevStore.reduce((sum, item) => sum + item.compliance_score, 0) / prevStore.length : 0;

    return {
      total: { value: currentTotal, trend: trendPercent(currentTotal, previousTotal) },
      compliance: { value: currentCompliance, trend: trendPercent(currentCompliance, previousCompliance) },
      critical: { value: currentCritical, trend: trendPercent(currentCritical, previousCritical) },
      pending: { value: currentPending, trend: trendPercent(currentPending, previousPending) },
      cfc: { value: cfcCompliance, trend: trendPercent(cfcCompliance, prevCfcCompliance) },
      store: { value: storeCompliance, trend: trendPercent(storeCompliance, prevStoreCompliance) },
    };
  }, [filtered, previousFiltered]);

  const trendData = useMemo(() => {
    const useWeekly = range === 'quarter';
    const grouped = new Map<string, { cfc: number[]; store: number[] }>();

    filtered.forEach((item) => {
      const date = new Date(item.inspection_date);
      const key = useWeekly
        ? `W${Math.ceil(date.getDate() / 7)} ${date.toLocaleDateString('en-IN', { month: 'short' })}`
        : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const entry = grouped.get(key) ?? { cfc: [], store: [] };
      if (item.branch_type.toLowerCase().includes('cfc')) entry.cfc.push(item.compliance_score);
      else entry.store.push(item.compliance_score);
      grouped.set(key, entry);
    });

    return Array.from(grouped.entries()).map(([label, value]) => ({
      label,
      cfc: value.cfc.length ? value.cfc.reduce((a, b) => a + b, 0) / value.cfc.length : 0,
      store: value.store.length ? value.store.reduce((a, b) => a + b, 0) / value.store.length : 0,
    }));
  }, [filtered, range]);

  const issuesBySection = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((inspection) => {
      inspection.responses.filter((r) => r.response === 'No').forEach((response) => {
        counts.set(response.section, (counts.get(response.section) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([section, issues]) => ({ section, issues }))
      .sort((a, b) => b.issues - a.issues);
  }, [filtered]);

  const branchTable = useMemo<BranchRow[]>(() => {
    const grouped = new Map<string, InspectionItem[]>();
    filtered.forEach((item) => {
      const list = grouped.get(item.branch_name) ?? [];
      list.push(item);
      grouped.set(item.branch_name, list);
    });

    const rows = Array.from(grouped.entries()).map(([branchName, items]) => {
      const latest = items.slice().sort((a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime())[0];
      return {
        branchName,
        type: latest.branch_type,
        city: latest.city,
        inspections: items.length,
        avgCompliance: items.reduce((sum, item) => sum + item.compliance_score, 0) / items.length,
        riskLevel: items.slice().sort((a, b) => ['low', 'medium', 'high', 'critical'].indexOf(b.risk_level) - ['low', 'medium', 'high', 'critical'].indexOf(a.risk_level))[0]?.risk_level ?? 'low',
        lastInspected: new Date(latest.inspection_date).toLocaleDateString('en-IN'),
      };
    });

    return rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDirection]);

  const recentActivity = useMemo(() => {
    return filtered
      .slice()
      .sort((a, b) => new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime())
      .slice(0, 15);
  }, [filtered]);

  const topIssues = useMemo(() => {
    const counts = new Map<string, { section: string; item: string; count: number }>();
    filtered.forEach((inspection) => {
      inspection.responses.filter((r) => r.response === 'No').forEach((response) => {
        const key = `${response.section}__${response.item_text}`;
        const existing = counts.get(key) ?? { section: response.section, item: response.item_text, count: 0 };
        existing.count += 1;
        counts.set(key, existing);
      });
    });

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
        percentage: filtered.length ? (item.count / filtered.length) * 100 : 0,
      }));
  }, [filtered]);

  const exportCsv = () => {
    const rows = filtered.flatMap((item) =>
      item.responses.map((response) => ({
        id: item.id,
        date: item.inspection_date,
        branch: item.branch_name,
        branchType: item.branch_type,
        city: item.city,
        officer: item.officer_name,
        status: item.status,
        complianceScore: item.compliance_score,
        riskLevel: item.risk_level,
        section: response.section,
        item: response.item_text,
        response: response.response,
        remarks: response.remarks ?? '',
      }))
    );

    const headers = Object.keys(rows[0] ?? {});
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String((row as any)[header] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'management-dashboard-export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (key: keyof BranchRow) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  if (error) {
    return <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-4">Failed to load dashboard data.</div>;
  }

  return (
    <div className="space-y-6 print-full">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Executive Compliance Overview</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Leadership view across branches, issues, and review performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ['today', 'Today'],
            ['week', 'This Week'],
            ['month', 'This Month'],
            ['quarter', 'Last 3 Months'],
            ['custom', 'Custom'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRange(key as RangeKey)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                range === key
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
          {range === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-sm" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-2 rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-sm" />
            </div>
          )}
          <button onClick={exportCsv} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Export CSV</button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white text-sm font-medium"
            title="Print this dashboard. For an itemised PDF of a single inspection, open it in Head Review and press P."
          >
            Print Dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <StatCard label="Total Inspections" value={stats.total.value} trend={{ value: stats.total.trend, label: 'vs previous period' }} color="blue" loading={isLoading} />
        <StatCard label="Compliance Rate" value={`${stats.compliance.value.toFixed(1)}%`} trend={{ value: stats.compliance.trend, label: 'vs previous period' }} color={stats.compliance.value >= 80 ? 'green' : stats.compliance.value >= 60 ? 'yellow' : 'red'} loading={isLoading} />
        <StatCard label="Critical Issues" value={stats.critical.value} trend={{ value: stats.critical.trend, label: 'vs previous period' }} color={stats.critical.value > 0 ? 'red' : 'green'} loading={isLoading} />
        <StatCard label="Pending Review" value={stats.pending.value} trend={{ value: stats.pending.trend, label: 'vs previous period' }} color={stats.pending.value > 0 ? 'yellow' : 'green'} loading={isLoading} />
        <StatCard label="CFC Compliance" value={`${stats.cfc.value.toFixed(1)}%`} trend={{ value: stats.cfc.trend, label: 'vs previous period' }} color="green" loading={isLoading} />
        <StatCard label="Store Compliance" value={`${stats.store.value.toFixed(1)}%`} trend={{ value: stats.store.trend, label: 'vs previous period' }} color="blue" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <ComplianceChart data={trendData} />
        <BranchHeatmap data={issuesBySection} />
      </div>

      <InspectionTable rows={branchTable} sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} onView={setSelectedBranch} />

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 flex items-center justify-center font-semibold">
                  {item.officer_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.officer_name} • {item.branch_name}</div>
                  <div className="text-xs text-gray-500 truncate">{new Date(item.inspection_date).toLocaleString('en-IN')}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-semibold px-2 py-1 rounded-full ${item.status === 'approved' ? 'bg-green-100 text-green-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.status}</div>
                  <div className="text-xs mt-1 font-semibold text-brand-600">{item.compliance_score.toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-5 overflow-x-auto">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Top Recurring Issues</h3>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                <th className="py-2 pr-3">Rank</th>
                <th className="py-2 pr-3">Checklist Item</th>
                <th className="py-2 pr-3">Section</th>
                <th className="py-2 pr-3">No Count</th>
                <th className="py-2">% of Inspections</th>
              </tr>
            </thead>
            <tbody>
              {topIssues.map((issue) => (
                <tr key={`${issue.section}-${issue.item}`} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3 pr-3 font-semibold">{issue.rank}</td>
                  <td className="py-3 pr-3 text-gray-900 dark:text-gray-100">{issue.item}</td>
                  <td className="py-3 pr-3 text-gray-500">{issue.section}</td>
                  <td className="py-3 pr-3 font-semibold text-red-500">{issue.count}</td>
                  <td className="py-3">{issue.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <BranchDetailDrawer
        branchName={selectedBranch?.branchName ?? null}
        open={Boolean(selectedBranch)}
        onOpenChange={(open) => {
          if (!open) setSelectedBranch(null);
        }}
      />
    </div>
  );
}
