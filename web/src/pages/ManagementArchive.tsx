import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
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
  countDistrictsWithInspections,
  computeDistrictMonthSummaries,
  filterInspectionsByDistrict,
} from '../lib/districtCalculations';
import { computeMonthlyArchiveStats } from '../lib/managementArchive';

export default function ManagementArchive() {
  const { data = [], isLoading } = useManagementInspections();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDistrict = searchParams.get('district');

  const months = useMemo(() => {
    const keys = new Set(data.map((i) => monthKey(i.submitted_at)));
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

  const stats = useMemo(
    () => computeMonthlyArchiveStats(monthInspections, prevMonthInspections, selectedDistrict),
    [monthInspections, prevMonthInspections, selectedDistrict],
  );

  const branchDistrictCount = useMemo(
    () => countDistrictsWithInspections(scopedMonthInspections),
    [scopedMonthInspections],
  );

  const districtSummaries = useMemo(
    () => computeDistrictMonthSummaries(monthInspections, prevMonthInspections),
    [monthInspections, prevMonthInspections],
  );

  const trendData = useMemo(() => {
    if (!activeMonth) return [];
    if (selectedDistrict) {
      return calcStoreDailyTrend(monthInspections, activeMonth, selectedDistrict);
    }
    return calcDistrictDailyTrend(monthInspections, activeMonth);
  }, [monthInspections, activeMonth, selectedDistrict]);

  const underperformers = useMemo(
    () => computeUnderperformers(scopedMonthInspections, 80),
    [scopedMonthInspections],
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

  const openDistrict = (district: string) => {
    setSearchParams({ district, month: activeMonth });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {selectedDistrict ? (
            <button
              type="button"
              onClick={() => setSearchParams(activeMonth ? { month: activeMonth } : {})}
              className="bloom-link mb-3 min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Districts
            </button>
          ) : (
            <Link to="/dashboard" className="bloom-link mb-3">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          )}
          <BloomPageHeader
            title="Management archive"
            description="Historical compliance by calendar month with store performance trend analysis for leadership review."
          />
          <p className="mt-2 text-sm bloom-subtitle" data-breadcrumb>
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
            <StatCard
              label="Reports Submitted"
              value={stats.reportsSubmitted.value}
              trend={{ value: stats.reportsSubmitted.trend, label: 'vs prior month' }}
              color="blue"
              loading={isLoading}
              surface="bloom"
            />
            <StatCard
              label="Avg Compliance"
              value={`${stats.avgCompliance.value.toFixed(1)}%`}
              trend={{ value: stats.avgCompliance.trend, label: 'vs prior month' }}
              color={stats.avgCompliance.value >= 80 ? 'green' : 'yellow'}
              loading={isLoading}
              surface="bloom"
            />
            <StatCard
              label="Critical Flags Raised"
              value={stats.criticalFlagsRaised.value}
              trend={{ value: stats.criticalFlagsRaised.trend, label: 'vs prior month' }}
              color="red"
              loading={isLoading}
              surface="bloom"
            />
            <StatCard
              label="Branches"
              value={branchDistrictCount}
              trend={{ value: 0, label: selectedDistrict ? 'in selected district' : 'districts with inspections' }}
              color="blue"
              loading={isLoading}
              surface="bloom"
            />
          </div>

          <ComplianceChart data={trendData} surface="bloom" />

          {!selectedDistrict && districtSummaries.length > 0 ? (
            <BloomGradientPanel>
              <h3 className="bloom-heading mb-4 text-base font-semibold">District summary</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {districtSummaries.map((district) => (
                  <button
                    key={district.district}
                    type="button"
                    onClick={() => openDistrict(district.district)}
                    className="bloom-panel-nested flex w-full flex-col gap-2 p-4 text-left transition-opacity hover:opacity-90"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{district.district}</span>
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: district.avgCompliance >= 80 ? '#16A34A' : '#D97706' }}
                      >
                        {district.avgCompliance.toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-xs text-white/60">
                      {district.inspectionCount} inspections · {district.criticalCount} critical
                    </p>
                  </button>
                ))}
              </div>
            </BloomGradientPanel>
          ) : null}

          <BloomGradientPanel>
            <h3 className="bloom-heading mb-4 text-base font-semibold">
              Underperformers
              {selectedDistrict ? ` — ${selectedDistrict}` : ''}
            </h3>
            <UnderperformingTable rows={underperformers} surface="bloom" />
          </BloomGradientPanel>
        </>
      )}
    </div>
  );
}
