import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Archive, TrendingDown } from 'lucide-react';
import StatCard from '../components/StatCard';
import ComplianceChart from '../components/ComplianceChart';
import BranchHeatmap from '../components/BranchHeatmap';
import InspectionTable, { type BranchRow } from '../components/InspectionTable';
import BranchDetailDrawer from '../components/BranchDetailDrawer';
import LiveSyncIndicator from '../components/LiveSyncIndicator';
import UnderperformingTable from '../components/UnderperformingTable';
import { useManagementInspections } from '../hooks/useManagementInspections';
import {
  type RangeKey,
  filterByDateRange,
  getDateRange,
  previousPeriod,
} from '../lib/dateRanges';
import {
  computeBranchRows,
  computeComplianceTrend,
  computeExecutiveStats,
  computeIssuesBySection,
  computeTopIssues,
  computeUnderperformers,
} from '../lib/managementAnalytics';

export default function ManagementDashboard() {
  const [range, setRange] = useState<RangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortKey, setSortKey] = useState<keyof BranchRow>('avgCompliance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedBranch, setSelectedBranch] = useState<BranchRow | null>(null);

  const { data = [], isLoading, isFetching, error } = useManagementInspections();
  const { start, end } = getDateRange(range, customFrom, customTo);
  const { prevStart, prevEnd } = previousPeriod(start, end);

  const filtered = useMemo(
    () => filterByDateRange(data, start, end),
    [data, start, end],
  );
  const previousFiltered = useMemo(
    () => filterByDateRange(data, prevStart, prevEnd),
    [data, prevStart, prevEnd],
  );

  const stats = useMemo(
    () => computeExecutiveStats(filtered, previousFiltered),
    [filtered, previousFiltered],
  );
  const underperformers = useMemo(() => computeUnderperformers(filtered), [filtered]);
  const trendData = useMemo(
    () => computeComplianceTrend(filtered, range === 'quarter'),
    [filtered, range],
  );
  const issuesBySection = useMemo(() => computeIssuesBySection(filtered), [filtered]);
  const topIssues = useMemo(() => computeTopIssues(filtered), [filtered]);
  const branchTable = useMemo(() => {
    const rows = computeBranchRows(filtered);
    return rows.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDirection]);

  const recentActivity = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
        .slice(0, 12),
    [filtered],
  );

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
      })),
    );
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((h) => `"${String((row as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vms-executive-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: keyof BranchRow) => {
    if (sortKey === key) setSortDirection((p) => (p === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDirection(key === 'avgCompliance' ? 'asc' : 'desc');
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
        Failed to load dashboard data. Check your connection and Supabase configuration.
      </div>
    );
  }

  return (
    <div className="space-y-8 print-full">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 px-6 py-8 text-white shadow-xl no-print">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.25),transparent_50%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Executive command centre
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Network compliance overview</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Live field inspection data from officers — updates automatically when new visits are submitted.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LiveSyncIndicator isFetching={isFetching} />
            <Link
              to="/management/archive"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20"
            >
              <Archive className="h-4 w-4" />
              Historical archive
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between no-print">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['today', 'Today'],
              ['week', 'This week'],
              ['month', 'This month'],
              ['quarter', 'Last 3 months'],
              ['custom', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                range === key
                  ? 'bg-slate-900 text-white shadow dark:bg-white dark:text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600"
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatCard label="Inspections" value={stats.total.value} trend={{ value: stats.total.trend, label: 'vs prior period' }} color="blue" loading={isLoading} />
        <StatCard label="Network compliance" value={`${stats.compliance.value.toFixed(1)}%`} trend={{ value: stats.compliance.trend, label: 'vs prior period' }} color={stats.compliance.value >= 80 ? 'green' : stats.compliance.value >= 60 ? 'yellow' : 'red'} loading={isLoading} />
        <StatCard label="Non-conformances" value={stats.violations.value} trend={{ value: stats.violations.trend, label: 'vs prior period' }} color={stats.violations.value > 0 ? 'red' : 'green'} loading={isLoading} />
        <StatCard label="Critical visits" value={stats.critical.value} trend={{ value: stats.critical.trend, label: 'vs prior period' }} color="red" loading={isLoading} />
        <StatCard label="Pending review" value={stats.pending.value} trend={{ value: stats.pending.trend, label: 'vs prior period' }} color="yellow" loading={isLoading} />
        <StatCard label="Branches covered" value={stats.branchesCovered.value} trend={{ value: stats.branchesCovered.trend, label: 'vs prior period' }} color="blue" loading={isLoading} />
        <StatCard label="CFC compliance" value={`${stats.cfc.value.toFixed(1)}%`} trend={{ value: stats.cfc.trend, label: 'vs prior period' }} color="green" loading={isLoading} />
        <StatCard label="Store compliance" value={`${stats.store.value.toFixed(1)}%`} trend={{ value: stats.store.trend, label: 'vs prior period' }} color="blue" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
        <div className="2xl:col-span-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Underperforming stores</h2>
            <span className="ml-auto text-xs text-slate-500">Below 70% compliance or elevated risk</span>
          </div>
          <UnderperformingTable
            rows={underperformers}
            onSelect={(name) => {
              const row = branchTable.find((b) => b.branchName === name);
              if (row) setSelectedBranch(row);
            }}
          />
        </div>
        <div className="2xl:col-span-2 space-y-6">
          <ComplianceChart data={trendData} />
          <BranchHeatmap data={issuesBySection} />
        </div>
      </div>

      <InspectionTable rows={branchTable} sortKey={sortKey} sortDirection={sortDirection} onSort={handleSort} onView={setSelectedBranch} />

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Live activity feed</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentActivity.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {item.officer_name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.branch_name}</p>
                  <p className="text-xs text-slate-500">
                    {item.officer_name} · {new Date(item.submitted_at).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{item.compliance_score.toFixed(0)}%</p>
                  <p className="text-xs capitalize text-slate-500">{item.status}</p>
                </div>
              </div>
            ))}
            {!recentActivity.length && !isLoading && (
              <p className="py-8 text-center text-sm text-slate-500">No inspections in this period yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-x-auto">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-base font-bold">Top recurring non-conformances</h3>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Section</th>
                <th className="py-2 pr-3">Count</th>
                <th className="py-2">%</th>
              </tr>
            </thead>
            <tbody>
              {topIssues.map((issue) => (
                <tr key={`${issue.section}-${issue.item}`} className="border-b border-slate-50 dark:border-slate-800">
                  <td className="py-2 pr-3 font-semibold">{issue.rank}</td>
                  <td className="py-2 pr-3">{issue.item}</td>
                  <td className="py-2 pr-3 text-slate-500">{issue.section}</td>
                  <td className="py-2 pr-3 font-semibold text-red-600">{issue.count}</td>
                  <td className="py-2">{issue.percentage.toFixed(1)}%</td>
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
