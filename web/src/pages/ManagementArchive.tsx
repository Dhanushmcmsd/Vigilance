import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import StatCard from '../components/StatCard';
import ComplianceChart from '../components/ComplianceChart';
import UnderperformingTable from '../components/UnderperformingTable';
import { useManagementInspections } from '../hooks/useManagementInspections';
import { formatMonthLabel, monthKey } from '../lib/inspectionQueries';
import {
  computeExecutiveStats,
  computeStorePerformanceTrend,
  computeUnderperformers,
} from '../lib/managementAnalytics';
import { filterByDateRange } from '../lib/dateRanges';

export default function ManagementArchive() {
  const { data = [], isLoading } = useManagementInspections();
  const months = useMemo(() => {
    const keys = new Set(data.map((i) => monthKey(i.inspection_date)));
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const activeMonth = selectedMonth || months[0] || '';

  const monthInspections = useMemo(() => {
    if (!activeMonth) return [];
    const [y, m] = activeMonth.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59);
    return filterByDateRange(data, start, end);
  }, [data, activeMonth]);

  const prevMonthInspections = useMemo(() => {
    if (!activeMonth) return [];
    const [y, m] = activeMonth.split('-').map(Number);
    const start = new Date(y, m - 2, 1);
    const end = new Date(y, m - 1, 0, 23, 59, 59);
    return filterByDateRange(data, start, end);
  }, [data, activeMonth]);

  const stats = useMemo(
    () => computeExecutiveStats(monthInspections, prevMonthInspections),
    [monthInspections, prevMonthInspections],
  );
  const underperformers = useMemo(() => computeUnderperformers(monthInspections), [monthInspections]);
  const trendData = useMemo(() => computeStorePerformanceTrend(monthInspections), [monthInspections]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/dashboard"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Management archive</h1>
          <p className="mt-1 text-sm text-slate-500">
            Historical compliance by calendar month with store performance trend analysis for leadership review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-slate-400" />
          <select
            value={activeMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!months.length && !isLoading ? (
        <p className="rounded-xl border border-dashed p-12 text-center text-slate-500">
          No submitted inspections yet. Data will appear here month by month as officers complete visits.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Inspections" value={stats.total.value} trend={{ value: stats.total.trend, label: 'vs prior month' }} color="blue" loading={isLoading} />
            <StatCard label="Compliance" value={`${stats.compliance.value.toFixed(1)}%`} trend={{ value: stats.compliance.trend, label: 'vs prior month' }} color={stats.compliance.value >= 80 ? 'green' : 'yellow'} loading={isLoading} />
            <StatCard label="Critical" value={stats.critical.value} trend={{ value: stats.critical.trend, label: 'vs prior month' }} color="red" loading={isLoading} />
            <StatCard label="Branches" value={stats.branchesCovered.value} trend={{ value: stats.branchesCovered.trend, label: 'vs prior month' }} color="blue" loading={isLoading} />
          </div>

          <ComplianceChart data={trendData} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-bold">Underperformers — {formatMonthLabel(activeMonth)}</h2>
            <UnderperformingTable rows={underperformers} />
          </div>
        </>
      )}
    </div>
  );
}
