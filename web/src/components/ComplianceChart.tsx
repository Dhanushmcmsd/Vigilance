import {
  ResponsiveContainer,
  LineChart,
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
};

const BLOOM_CHART_LIGHT = {
  grid: 'rgba(0,0,0,0.15)',
  tick: '#000000',
  tooltipBg: '#ffffff',
  tooltipBorder: '#000000',
  tooltipText: '#000000',
  legend: '#000000',
};

export default function ComplianceChart({
  data,
  surface = 'default',
}: {
  data: Array<Record<string, string | number | null>>;
  surface?: 'default' | 'bloom';
}) {
  const { isDark } = useTheme();
  const seriesKeys = data.length > 0 ? Object.keys(data[0]).filter((key) => key !== 'label') : [];
  const isBloom = surface === 'bloom';
  const bloomChart = isDark ? BLOOM_CHART_DARK : BLOOM_CHART_LIGHT;

  const chartBody = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`text-base font-semibold ${isBloom ? 'bloom-heading' : 'text-gray-900 dark:text-white'}`}>
            Compliance Trend
          </h3>
          <p className={`text-xs ${isBloom ? 'bloom-subtitle' : 'text-gray-500 dark:text-gray-400'}`}>
            Daily store performance and overall compliance for the selected period
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={isBloom ? 280 : '100%'}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isBloom ? bloomChart.grid : '#33415522'} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: isBloom ? bloomChart.tick : undefined }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: isBloom ? bloomChart.tick : undefined }}
          />
          <Tooltip
            formatter={(value: number) => `${value.toFixed(1)}%`}
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
          />
          <Legend wrapperStyle={isBloom ? { color: bloomChart.legend } : undefined} />
          <ReferenceLine y={80} stroke="#86efac" strokeDasharray="4 4" label={{ value: '80%', fill: isBloom ? '#86efac' : '#16a34a' }} />
          <ReferenceLine y={60} stroke="#fcd34d" strokeDasharray="4 4" label={{ value: '60%', fill: isBloom ? '#fcd34d' : '#eab308' }} />
          {seriesKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={3}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </>
  );

  if (isBloom) {
    return (
      <BloomGradientPanel className="h-[360px]">
        {chartBody}
      </BloomGradientPanel>
    );
  }

  return <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-5 h-[360px]">{chartBody}</div>;
}
