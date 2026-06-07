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

const SERIES_COLORS = ['#0ea5e9', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#6366f1'];

export default function ComplianceChart({ data }: { data: Array<Record<string, string | number | null>> }) {
  const seriesKeys = data.length > 0
    ? Object.keys(data[0]).filter((key) => key !== 'label')
    : [];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-5 h-[360px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Compliance Trend</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Daily store performance and overall compliance for the selected period</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#33415522" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
          <Legend />
          <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" label="80%" />
          <ReferenceLine y={60} stroke="#eab308" strokeDasharray="4 4" label="60%" />
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
    </div>
  );
}
