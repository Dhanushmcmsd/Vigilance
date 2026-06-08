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

const SERIES_COLORS = ['#7dd3fc', '#c4b5fd', '#86efac', '#fdba74', '#fca5a5', '#a5b4fc'];

const BLOOM_CHART = {
  grid: 'rgba(255,255,255,0.12)',
  tick: 'rgba(255,255,255,0.75)',
  tooltipBg: 'rgba(65, 38, 83, 0.95)',
  tooltipBorder: 'rgba(255,255,255,0.15)',
};

export default function ComplianceChart({
  data,
  surface = 'default',
}: {
  data: Array<Record<string, string | number | null>>;
  surface?: 'default' | 'bloom';
}) {
  const seriesKeys = data.length > 0 ? Object.keys(data[0]).filter((key) => key !== 'label') : [];
  const isBloom = surface === 'bloom';

  const chartBody = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className={`text-base font-semibold ${isBloom ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            Compliance Trend
          </h3>
          <p className={`text-xs ${isBloom ? 'text-white/65' : 'text-gray-500 dark:text-gray-400'}`}>
            Daily store performance and overall compliance for the selected period
          </p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={isBloom ? 280 : '100%'}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={isBloom ? BLOOM_CHART.grid : '#33415522'} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: isBloom ? BLOOM_CHART.tick : undefined }} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12, fill: isBloom ? BLOOM_CHART.tick : undefined }}
          />
          <Tooltip
            formatter={(value: number) => `${value.toFixed(1)}%`}
            contentStyle={
              isBloom
                ? {
                    backgroundColor: BLOOM_CHART.tooltipBg,
                    border: `1px solid ${BLOOM_CHART.tooltipBorder}`,
                    borderRadius: '8px',
                    color: '#fff',
                  }
                : undefined
            }
            labelStyle={isBloom ? { color: 'rgba(255,255,255,0.85)' } : undefined}
          />
          <Legend wrapperStyle={isBloom ? { color: 'rgba(255,255,255,0.85)' } : undefined} />
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
