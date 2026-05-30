import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface SectionData {
  section: string;
  red: number;
  yellow: number;
  green: number;
}

interface SectionRiskChartProps {
  data: SectionData[];
}

export function SectionRiskChart({ data }: SectionRiskChartProps) {
  const chartData = data.map(item => ({
    section: item.section,
    RED: item.red,
    YELLOW: item.yellow,
    GREEN: item.green,
    total: item.red + item.yellow + item.green
  }));

  return (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: '#111118',
        borderColor: 'rgba(255,255,255,0.07)'
      }}
    >
      <h2 className="text-sm font-semibold text-text-primary mb-4">
        Failures by Section
      </h2>

      {chartData.length === 0 ? (
        <p className="text-sm text-muted text-center py-16">No section breakdown available yet.</p>
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="section"
            width={60}
            tick={{ fill: '#6B7280', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111118',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontFamily: 'JetBrains Mono',
              fontSize: '12px'
            }}
            itemStyle={{ color: '#F5F5F0' }}
            labelStyle={{ color: '#F5F5F0', fontWeight: 600, marginBottom: '4px' }}
            formatter={(value: number, name: string) => [value, name]}
          />
          <Bar dataKey="RED" stackId="a" fill="#7F1D1D" radius={[0, 0, 0, 0]} />
          <Bar dataKey="YELLOW" stackId="a" fill="#78350F" radius={[0, 0, 0, 0]} />
          <Bar dataKey="GREEN" stackId="a" fill="#14532D" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
      )}

      {chartData.length > 0 && (
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#7F1D1D' }} />
          <span className="text-xs text-muted">RED</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#78350F' }} />
          <span className="text-xs text-muted">YELLOW</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: '#14532D' }} />
          <span className="text-xs text-muted">GREEN</span>
        </div>
      </div>
      )}
    </div>
  );
}
