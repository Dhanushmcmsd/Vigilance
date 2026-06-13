import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { BloomGradientPanel } from './ui/BloomGradientPanel';
import { useTheme } from '../context/ThemeContext';

const SERIES_COLORS = ['#0284c7', '#7c3aed', '#16a34a', '#ea580c', '#dc2626', '#4f46e5'];

const BLOOM_CHART_DARK = {
  grid: 'rgba(255,255,255,0.12)',
  tick: 'rgba(255,255,255,0.75)',
  tooltipBg: 'rgba(65, 38, 83, 0.95)',
  tooltipBorder: 'rgba(255,255,255,0.15)',
  tooltipText: '#ffffff',
  legend: 'rgba(255,255,255,0.85)',
  avgBar: 'rgba(99, 102, 241, 0.55)',
};

const BLOOM_CHART_LIGHT = {
  grid: 'rgba(0,0,0,0.15)',
  tick: '#000000',
  tooltipBg: '#ffffff',
  tooltipBorder: '#000000',
  tooltipText: '#000000',
  legend: '#000000',
  avgBar: 'rgba(99, 102, 241, 0.45)',
};

function enrichTrendData(data: Array<Record<string, string | number | null>>) {
  return data.map((row) => {
    const values = Object.entries(row)
      .filter(([key, val]) => key !== 'label' && val !== null && typeof val === 'number')
      .map(([, val]) => val as number);
    const avg =
      values.length > 0
        ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
        : null;
    return { ...row, 'Daily avg': avg };
  });
}

export default function ComplianceChart({
  data,
  surface = 'default',
}: {
  data: Array<Record<string, string | number | null>>;
  surface?: 'default' | 'bloom';
}) {
  const { isDark } = useTheme();
  const chartData = useMemo(() => enrichTrendData(data), [data]);
  const seriesKeys =
    chartData.length > 0
      ? Object.keys(chartData[0]).filter((key) => key !== 'label' && key !== 'Daily avg')
      : [];
  const isBloom = surface === 'bloom';
  const bloomChart = isDark ? BLOOM_CHART_DARK : BLOOM_CHART_LIGHT;
  const hasData = chartData.some((row) => row['Daily avg'] !== null);

  const chartBody = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className={`text-base font-semibold ${isBloom ? 'bloom-heading' : 'text-gray-900 dark:text-white'}`}>
            Compliance Trend
          </h3>
          <p className={`text-xs ${isBloom ? 'bloom-subtitle' : 'text-gray-500 dark:text-gray-400'}`}>
            Daily average compliance (bars) with store/district performance lines for the selected period
          </p>
        </div>
      </div>
      {!hasData ? (
        <p className={`py-16 text-center text-sm ${isBloom ? 'bloom-subtitle' : 'text-gray-500 dark:text-gray-400'}`}>
          No inspection activity recorded for this period yet.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={isBloom ? 280 : '100%'}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -16, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isBloom ? bloomChart.grid : '#33415522'} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: isBloom ? bloomChart.tick : undefined }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11, fill: isBloom ? bloomChart.tick : undefined }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                value != null ? `${Number(value).toFixed(1)}%` : '—',
                name,
              ]}
              contentStyle={
                isBloom
                  ? {
                      backgroundColor: bloomChart.tooltipBg,
                      border: `1px solid ${bloomChart.tooltipBorder}`,
                      borderRadius: '8px',
                      color: bloomChart.tooltipText,
                    }
                  : undefined
              }
              labelStyle={isBloom ? { color: bloomChart.tooltipText } : undefined}
              itemStyle={isBloom ? { color: bloomChart.tooltipText } : undefined}
            />
            <Legend wrapperStyle={isBloom ? { color: bloomChart.legend, fontSize: 11 } : { fontSize: 11 }} />
            <ReferenceLine
              y={80}
              stroke="#22c55e"
              strokeDasharray="4 4"
              label={{ value: '80%', fill: isBloom ? '#86efac' : '#16a34a', fontSize: 10 }}
            />
            <ReferenceLine
              y={60}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: '60%', fill: isBloom ? '#fcd34d' : '#eab308', fontSize: 10 }}
            />
            <Bar
              dataKey="Daily avg"
              name="Daily avg"
              fill={bloomChart.avgBar}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              isAnimationActive
              animationDuration={800}
            />
            {seriesKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive
                animationDuration={800}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </>
  );

  if (isBloom) {
    return <BloomGradientPanel className="h-[360px]">{chartBody}</BloomGradientPanel>;
  }

  return <div className="h-[360px] rounded-xl bg-white p-5 shadow-sm dark:bg-gray-900">{chartBody}</div>;
}
