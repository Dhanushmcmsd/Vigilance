import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import StatCard from '../components/StatCard';
import ComplianceChart from '../components/ComplianceChart';
import UnderperformingTable from '../components/UnderperformingTable';
import { BloomGradientPanel, BloomPageHeader } from '../components/ui/BloomGradientPanel';
import { useManagementInspections } from '../hooks/useManagementInspections';
import { formatMonthLabel, monthKey } from '../lib/inspectionQueries';
import { computeUnderperformers } from '../lib/managementAnalytics';
import { filterByDateRange } from '../lib/dateRanges';
import {
  calcDistrictDailyTrend,
  calcStoreDailyTrend,
  computeDistrictMonthSummaries,
  countDistrictsWithInspections,
  filterInspectionsByDistrict,
} from '../lib/districtCalculations';

export default function ManagementArchive() {
  const { data = [], isLoading } = useManagementInspections();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDistrict = searchParams.get('district');

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

  const scopedMonthInspections = useMemo(
    () => filterInspectionsByDistrict(monthInspections, selectedDistrict),
    [monthInspections, selectedDistrict],
  );

  const scopedPrevMonthInspections = useMemo(
    () => filterInspectionsByDistrict(prevMonthInspections, selectedDistrict),
    [prevMonthInspections, selectedDistrict],
  );

  const stats = useMemo(() => {
    const current = selectedDistrict ? scopedMonthInspections : monthInspections;
    const previous = selectedDistrict ? scopedPrevMonthInspections : prevMonthInspections;
    const avg = (list: typeof current) =>
      list.length ? list.reduce((sum, row) => sum + row.compliance_score, 0) / list.length : 0;
    const trend = (cur: number, prev: number) => {
      if (!prev && !cur) return 0;
      if (!prev) return 100;
      return Math.round(((cur - prev) / prev) * 100);
    };
    const critical = current.filter((row) => row.risk_level === 'critical').length;
    const prevCritical = previous.filter((row) => row.risk_level === 'critical').length;
    const districts = countDistrictsWithInspections(current);
    const prevDistricts = countDistrictsWithInspections(previous);

    return {
      total: { value: current.length, trend: trend(current.length, previous.length) },
      compliance: {
        value: avg(current),
        trend: trend(avg(current), avg(previous)),
      },
      critical: { value: critical, trend: trend(critical, prevCritical) },
      branchesCovered: {
        value: selectedDistrict ? new Set(current.map((row) => row.branch_name)).size : districts,
        trend: trend(
          selectedDistrict ? new Set(current.map((row) => row.branch_name)).size : districts,
          selectedDistrict ? new Set(previous.map((row) => row.branch_name)).size : prevDistricts,
        ),
      },
    };
  }, [
    monthInspections,
    prevMonthInspections,
    scopedMonthInspections,
    scopedPrevMonthInspections,
    selectedDistrict,
  ]);

  const underperformers = useMemo(
    () => computeUnderperformers(scopedMonthInspections, 80),
    [scopedMonthInspections],
  );

  const trendData = useMemo(() => {
    if (!activeMonth) return [];
    return selectedDistrict
      ? calcStoreDailyTrend(monthInspections, activeMonth, selectedDistrict)
      : calcDistrictDailyTrend(monthInspections, activeMonth);
  }, [activeMonth, monthInspections, selectedDistrict]);

  const districtSummaries = useMemo(
    () => computeDistrictMonthSummaries(monthInspections, prevMonthInspections),
    [monthInspections, prevMonthInspections],
  );

  const onMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (selectedDistrict) {
      setSearchParams({ district: selectedDistrict, month });
    } else if (month) {
      setSearchParams({ month });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/dashboard" className="bloom-link mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
          {selectedDistrict ? (
            <button
              type="button"
              onClick={() => setSearchParams(activeMonth ? { month: activeMonth } : {})}
              className="bloom-link mb-3 min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Districts
            </button>
          ) : null}
          <BloomPageHeader
            title="Management archive"
            description="Historical compliance by calendar month with store performance trend analysis for leadership review."
          />
          <p
            className="mt-2 text-sm text-white/60"
            data-breadcrumb
            style={{
              textShadow:
                '0 0 12px rgba(212, 175, 55, 0.15), 0 0 4px rgba(212, 175, 55, 0.10), 0 0 1px rgba(212, 175, 55, 0.20)',
              transition: 'text-shadow 0.4s ease',
            }}
          >
            Dashboard / Monthly Archive / {formatMonthLabel(activeMonth)}
            {selectedDistrict ? ` / ${selectedDistrict}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-white/50" />
          <select
            value={activeMonth}
            onChange={(e) => onMonthChange(e.target.value)}
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

          {!selectedDistrict ? (
            <BloomGradientPanel className="p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Districts — {formatMonthLabel(activeMonth)}</h2>
              <div className="space-y-3">
                {districtSummaries.map((district) => (
                  <button
                    key={district.district}
                    type="button"
                    onClick={() =>
                      setSearchParams({
                        district: district.district,
                        ...(activeMonth ? { month: activeMonth } : {}),
                      })
                    }
                    className="bloom-panel-nested flex w-full items-center gap-4 p-4 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">{district.district}</p>
                      <p className="text-sm text-white/65">
                        {district.inspectionCount} inspections · {district.avgCompliance.toFixed(1)}% avg compliance
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-white/80">
                      {district.trend >= 0 ? '↑' : '↓'} {Math.abs(district.trend).toFixed(1)}%
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />
                  </button>
                ))}
              </div>
            </BloomGradientPanel>
          ) : (
            <BloomGradientPanel className="p-6">
              <h2 className="mb-4 text-lg font-bold text-white">
                Underperformers — {formatMonthLabel(activeMonth)} · {selectedDistrict}
              </h2>
              <UnderperformingTable rows={underperformers} surface="bloom" />
            </BloomGradientPanel>
          )}
        </>
      )}
    </div>
  );
}
