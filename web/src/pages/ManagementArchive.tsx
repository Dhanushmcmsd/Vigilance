import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, ChevronRight } from 'lucide-react';
import StatCard from '../components/StatCard';
import ComplianceChart from '../components/ComplianceChart';
import { BloomGradientPanel, BloomPageHeader } from '../components/ui/BloomGradientPanel';
import { useManagementInspections } from '../hooks/useManagementInspections';
import { formatMonthLabel, monthKey } from '../lib/inspectionQueries';
import { computeComplianceTrend } from '../lib/managementAnalytics';
import { filterByDateRange } from '../lib/dateRanges';
import { filterInspectionsByDistrict } from '../lib/districtCalculations';
import {
  complianceScoreColor,
  computeDistrictMonthSummariesV2,
  computeMonthlyArchiveStats,
} from '../lib/managementArchive';

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

  const trendData = useMemo(() => {
    const source = selectedDistrict ? scopedMonthInspections : monthInspections;
    return computeComplianceTrend(source, true);
  }, [monthInspections, scopedMonthInspections, selectedDistrict]);

  const districtSummaries = useMemo(
    () => computeDistrictMonthSummariesV2(monthInspections, prevMonthInspections),
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

  const trendArrow = (direction: 'up' | 'down' | 'stable') => {
    if (direction === 'up') return '↑';
    if (direction === 'down') return '↓';
    return '→';
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
          <p className="mt-2 text-sm text-white/60" data-breadcrumb>
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
              label="Active Officers"
              value={stats.activeOfficers.value}
              trend={{ value: 0, label: `across ${stats.activeOfficers.districtCount} districts` }}
              color="blue"
              loading={isLoading}
              surface="bloom"
            />
          </div>

          <ComplianceChart data={trendData} surface="bloom" />

          {!selectedDistrict ? (
            <BloomGradientPanel className="p-6">
              <h2 className="mb-4 text-lg font-bold text-white">Districts — {formatMonthLabel(activeMonth)}</h2>
              <div className="space-y-3">
                {districtSummaries.map((district) => {
                  const scoreColor = complianceScoreColor(district.avgCompliance);
                  return (
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
                        <p className="font-bold text-white">
                          {district.district} · {district.totalReports}{' '}
                          {district.totalReports === 1 ? 'report' : 'reports'}
                        </p>
                        <p className="text-sm text-white/65">
                          {district.redFlagsRaised} red flags · {district.officersActive} officers · Last report{' '}
                          {district.lastReportDate}
                        </p>
                        <p className="mt-1 text-xs text-white/50">
                          {district.mostCommonFailedSection !== '—'
                            ? `Most failed: ${district.mostCommonFailedSection}`
                            : 'No failed sections recorded'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-xl font-black tabular-nums" style={{ color: scoreColor }}>
                          {district.avgCompliance.toFixed(1)}%
                        </span>
                        <p className="mt-1 text-sm font-semibold text-white/80">
                          {trendArrow(district.complianceTrend)} vs prior month
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-white/45" />
                    </button>
                  );
                })}
              </div>
            </BloomGradientPanel>
          ) : null}
        </>
      )}
    </div>
  );
}
