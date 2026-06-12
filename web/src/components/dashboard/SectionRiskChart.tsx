import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface SectionData {
  section: string;
  red: number;
  yellow: number;
  green: number;
}

interface SectionRiskChartProps {
  data: SectionData[];
  lastUpdated?: string;
}

const RED = '#ef4444';
const YELLOW = '#f59e0b';
const GREEN = '#22c55e';

function sectionComplianceScore(item: SectionData): number {
  const total = item.red + item.yellow + item.green;
  if (total === 0) return 0;
  return Math.round((item.green / total) * 100);
}

export function SectionRiskChart({ data, lastUpdated }: SectionRiskChartProps) {
  const barData = useMemo(
    () =>
      data.map((item) => ({
        section: item.section,
        RED: item.red,
        YELLOW: item.yellow,
        GREEN: item.green,
      })),
    [data],
  );

  const radarData = useMemo(
    () =>
      data.map((item) => ({
        section: item.section,
        score: sectionComplianceScore(item),
      })),
    [data],
  );

  const updatedLabel =
    lastUpdated ??
    new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Risk Distribution by Section
        </h2>
        <p className="text-xs mt-1 dashboard-last-updated">Last updated: {updatedLabel}</p>
      </div>

      {barData.length === 0 ? (
        <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>
          No section breakdown available yet.
        </p>
      ) : (
        <div className="flex flex-col xl:flex-row gap-4">
          <div className="w-full xl:w-[60%]" style={{ minHeight: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="section"
                  width={72}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Bar dataKey="RED" stackId="risk" fill={RED} isAnimationActive animationDuration={800}>
                  <LabelList
                    dataKey="RED"
                    position="center"
                    fill="#fff"
                    fontSize={10}
                    formatter={(v: number) => (v > 0 ? String(v) : '')}
                  />
                </Bar>
                <Bar dataKey="YELLOW" stackId="risk" fill={YELLOW} isAnimationActive animationDuration={800}>
                  <LabelList
                    dataKey="YELLOW"
                    position="center"
                    fill="#fff"
                    fontSize={10}
                    formatter={(v: number) => (v > 0 ? String(v) : '')}
                  />
                </Bar>
                <Bar dataKey="GREEN" stackId="risk" fill={GREEN} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={800}>
                  <LabelList
                    dataKey="GREEN"
                    position="center"
                    fill="#fff"
                    fontSize={10}
                    formatter={(v: number) => (v > 0 ? String(v) : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full xl:w-[40%]" style={{ minHeight: 320 }}>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke="var(--border-color)" />
                <PolarAngleAxis dataKey="section" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <Radar
                  name="Compliance %"
                  dataKey="score"
                  stroke="#6366f1"
                  fill="rgba(99, 102, 241, 0.2)"
                  fillOpacity={0.6}
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={800}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Compliance']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {barData.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
          {[
            { color: RED, label: 'RED' },
            { color: YELLOW, label: 'YELLOW' },
            { color: GREEN, label: 'GREEN' },
            { color: '#6366f1', label: 'Compliance radar' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
