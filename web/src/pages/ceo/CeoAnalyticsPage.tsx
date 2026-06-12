import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useCeoDashboard } from '../../context/CeoDashboardContext';
import { staggerContainer, fadeUp } from '../../lib/animations';
import {
  calcMonthlyTrend,
  computeScopedMetrics,
  computeScopedSectionData,
  listDistrictNames,
} from '../../lib/districtCalculations';

export default function CeoAnalyticsPage() {
  const { inspections, metrics, storeCards } = useCeoDashboard();
  const [districtFilter, setDistrictFilter] = useState<string>('');

  const districts = useMemo(() => listDistrictNames(storeCards), [storeCards]);
  const activeDistrict = districtFilter || null;

  const scopedMetrics = useMemo(
    () => computeScopedMetrics(inspections, storeCards, activeDistrict),
    [inspections, storeCards, activeDistrict],
  );

  const scopedSectionData = useMemo(
    () => computeScopedSectionData(inspections, activeDistrict),
    [inspections, activeDistrict],
  );

  const complianceTrend = useMemo(
    () => calcMonthlyTrend(inspections, activeDistrict),
    [inspections, activeDistrict],
  );

  const sectionChart = useMemo(() => {
    return scopedSectionData.map((section) => ({
      name: section.section,
      compliant: section.green,
      warning: section.yellow,
      critical: section.red,
    }));
  }, [scopedSectionData]);

  const COLORS = {
    compliant: '#22C55E',
    warning: '#F59E0B',
    critical: '#EF4444',
  };

  const trendTitle = activeDistrict
    ? `Monthly Compliance Trend — ${activeDistrict}`
    : 'Monthly Compliance Trend';

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50 mb-2">Analytics</h1>
        <p className="text-sm text-gray-400" data-breadcrumb>
          Dashboard / Analytics{activeDistrict ? ` / ${activeDistrict}` : ''}
        </p>
      </div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox label="Critical Issues Not Resolved" value={scopedMetrics.openRedFlags} color="#EF4444" />
        <MetricBox label="Stores Needing Urgent Attention" value={scopedMetrics.storesAtCriticalRisk} color="#F59E0B" />
        <MetricBox label="Overdue Targets Missed" value={scopedMetrics.overdueTargetsMissed} color="#EF4444" />
        <MetricBox label="Stores Flagged for Review" value={scopedMetrics.storesFlaggedForReview} color="#F59E0B" />
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-100">{trendTitle}</h3>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-xs text-gray-100"
              style={{
                backgroundColor: '#111118',
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <option value="">All Districts</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: '#F5F5F0' }}
              />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
              <Line
                type="monotone"
                dataKey="compliance"
                stroke={COLORS.compliant}
                strokeWidth={2}
                dot={{ fill: COLORS.compliant, r: 4 }}
                name="Avg compliance %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-100">Compliance by Section</h3>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-xs text-gray-100"
              style={{
                backgroundColor: '#111118',
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <option value="">All Districts</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectionChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                }}
                labelStyle={{ color: '#F5F5F0' }}
              />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
              <Bar dataKey="compliant" fill={COLORS.compliant} name="Compliant" radius={[4, 4, 0, 0]} />
              <Bar dataKey="warning" fill={COLORS.warning} name="Warning" radius={[4, 4, 0, 0]} />
              <Bar dataKey="critical" fill={COLORS.critical} name="Critical" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-gray-100">Risk by Section</h3>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="rounded-lg border px-3 py-2 text-xs text-gray-100"
              style={{
                backgroundColor: '#111118',
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <option value="">All Districts</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-3">
            {scopedSectionData.slice(0, 6).map((section, idx) => {
              const totalFlags = section.red + section.yellow + section.green;
              const riskPercent = totalFlags > 0 ? Math.round((section.red / totalFlags) * 100) : 0;

              return (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{section.section}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, riskPercent + 5)}%`,
                          backgroundColor: riskPercent > 30 ? '#EF4444' : riskPercent > 15 ? '#F59E0B' : '#22C55E',
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-400 w-12 text-right">{riskPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <h3 className="text-sm font-semibold text-gray-100 mb-4">Key Summary</h3>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Total Open Issues</div>
              <div className="text-2xl font-bold text-blue-400">
                {scopedMetrics.openRedFlags + scopedMetrics.activeYellowWarnings}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Critical Issues</div>
              <div className="text-2xl font-bold text-red-400">{scopedMetrics.openRedFlags}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Overdue Targets</div>
              <div className="text-2xl font-bold text-orange-400">{scopedMetrics.overdueTargetsMissed}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Inspections Completed Today</div>
              <div className="text-2xl font-bold text-green-400">{metrics.inspectionsToday}</div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <div className="text-xs font-medium text-gray-400 mb-2">{label}</div>
      <div className="flex items-end gap-2">
        <div className="text-3xl font-bold" style={{ color }}>
          {value}
        </div>
      </div>
    </div>
  );
}
