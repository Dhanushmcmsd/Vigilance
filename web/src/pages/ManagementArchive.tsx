import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import StatCard from '../components/StatCard';
import ComplianceChart from '../components/ComplianceChart';
import UnderperformingTable from '../components/UnderperformingTable';
import { BloomGradientPanel, BloomPageHeader } from '../components/ui/BloomGradientPanel';
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
          <Link to="/dashboard" className="bloom-link mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          <BloomPageHeader
            title="Management archive"
            description="Historical compliance by calendar month with store performance trend analysis for leadership review."
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-white/50" />
          <select
            value={activeMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bloom-input min-w-[160px] font-medium normal-case"
          >
            {months.map((m) => (
              <option key={m} value={m} className="bg-[#412653] text-white">
                {formatMonthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!months.length && !isLoading ? (
        <BloomGradientPanel>
          <p className="py-12 text-center text-white/70">
            No submitted inspections yet. Data will appear here month by month as officers complete visits.
          </p>
        </BloomGradientPanel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Inspections" value={stats.total.value} trend={{ value: stats.total.trend, label: 'vs prior month' }} color="blue" loading={isLoading} surface="bloom" />
            <StatCard label="Compliance" value={`${stats.compliance.value.toFixed(1)}%`} trend={{ value: stats.compliance.trend, label: 'vs prior month' }} color={stats.compliance.value >= 80 ? 'green' : 'yellow'} loading={isLoading} surface="bloom" />
            <StatCard label="Critical" value={stats.critical.value} trend={{ value: stats.critical.trend, label: 'vs prior month' }} color="red" loading={isLoading} surface="bloom" />
            <StatCard label="Branches" value={stats.branchesCovered.value} trend={{ value: stats.branchesCovered.trend, label: 'vs prior month' }} color="blue" loading={isLoading} surface="bloom" />
          </div>

          <ComplianceChart data={trendData} surface="bloom" />

          <BloomGradientPanel className="p-6">
            <h2 className="mb-4 text-lg font-bold text-white">
              Underperformers — {formatMonthLabel(activeMonth)}
            </h2>
            <UnderperformingTable rows={underperformers} surface="bloom" />
          </BloomGradientPanel>
        </>
      )}
    </div>
  );
}
