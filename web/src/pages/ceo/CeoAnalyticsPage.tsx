import { useMemo } from 'react';
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

export default function CeoAnalyticsPage() {
  const { metrics, sectionData } = useCeoDashboard();

  const complianceTrend = useMemo(() => {
    return [
      { day: 'Mon', compliant: 85, atRisk: 12, critical: 3 },
      { day: 'Tue', compliant: 82, atRisk: 14, critical: 4 },
      { day: 'Wed', compliant: 88, atRisk: 10, critical: 2 },
      { day: 'Thu', compliant: 90, atRisk: 8, critical: 2 },
      { day: 'Fri', compliant: 87, atRisk: 11, critical: 2 },
      { day: 'Sat', compliant: 84, atRisk: 13, critical: 3 },
      { day: 'Sun', compliant: 80, atRisk: 15, critical: 5 },
    ];
  }, []);

  const sectionChart = useMemo(() => {
    return sectionData.map((section) => ({
      name: section.section,
      compliant: section.green,
      warning: section.yellow,
      critical: section.red,
    }));
  }, [sectionData]);

  const COLORS = {
    compliant: '#22C55E',
    warning: '#F59E0B',
    critical: '#EF4444',
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-50 mb-2">Analytics</h1>
        <p className="text-sm text-gray-400">Dashboard / Analytics</p>
      </div>

      {/* Key Metrics */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox label="Critical Issues Not Resolved" value={metrics.openRedFlags} color="#EF4444" />
        <MetricBox label="Stores Needing Urgent Attention" value={metrics.storesAtCriticalRisk} color="#F59E0B" />
        <MetricBox label="Overdue Targets Missed" value={metrics.slaBreaches} color="#EF4444" />
        <MetricBox label="Stores Flagged for Review" value={metrics.activeYellowWarnings} color="#F59E0B" />
      </motion.div>

      {/* Charts Grid - 2 column on desktop, 1 on mobile */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend */}
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <h3 className="text-sm font-semibold text-gray-100 mb-4">Weekly Compliance Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceTrend}>
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
              <Line
                type="monotone"
                dataKey="compliant"
                stroke={COLORS.compliant}
                strokeWidth={2}
                dot={{ fill: COLORS.compliant, r: 4 }}
                name="Compliant"
              />
              <Line
                type="monotone"
                dataKey="atRisk"
                stroke={COLORS.warning}
                strokeWidth={2}
                dot={{ fill: COLORS.warning, r: 4 }}
                name="At Risk"
              />
              <Line
                type="monotone"
                dataKey="critical"
                stroke={COLORS.critical}
                strokeWidth={2}
                dot={{ fill: COLORS.critical, r: 4 }}
                name="Critical"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Compliance by Section */}
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <h3 className="text-sm font-semibold text-gray-100 mb-4">Compliance by Section</h3>
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

        {/* Section Risk Breakdown */}
        <div
          className="rounded-lg border p-6"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)',
          }}
        >
          <h3 className="text-sm font-semibold text-gray-100 mb-4">Risk by Section</h3>
          <div className="space-y-3">
            {sectionData.slice(0, 6).map((section, idx) => {
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

        {/* Summary Stats */}
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
                {metrics.openRedFlags + metrics.activeYellowWarnings}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Critical Issues</div>
              <div className="text-2xl font-bold text-red-400">{metrics.openRedFlags}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Overdue Targets</div>
              <div className="text-2xl font-bold text-orange-400">{metrics.slaBreaches}</div>
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
