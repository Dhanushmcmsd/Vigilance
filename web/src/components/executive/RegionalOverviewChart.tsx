import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import ChartPanel from './ChartPanel';
import {
  axisTick,
  chartMargins,
  chartPalette,
  chartTooltipStyle,
  complianceBarColor,
} from './chartTheme';
import type { RegionalComplianceItem } from '../../lib/managementAnalytics';

export default function RegionalOverviewChart({ data }: { data: RegionalComplianceItem[] }) {
  return (
    <ChartPanel
      title="Regional overview"
      subtitle="Average compliance by region with inspection volume"
      height={320}
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={chartMargins.barVertical}>
            <CartesianGrid stroke={chartPalette.grid} horizontal={false} strokeDasharray="3 6" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="region"
              width={108}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, _name, item) => [
                `${value.toFixed(1)}% · ${item.payload.inspections} inspections`,
                'Compliance',
              ]}
              contentStyle={chartTooltipStyle()}
            />
            <Bar
              dataKey="compliance"
              radius={[0, 8, 8, 0]}
              barSize={18}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell key={entry.region} fill={complianceBarColor(entry.compliance)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="flex h-full items-center justify-center text-sm text-slate-500">
          No regional data for this period.
        </p>
      )}
    </ChartPanel>
  );
}
