import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import ChartPanel from './ChartPanel';
import { chartPalette, chartTooltipStyle } from './chartTheme';
import type { RiskDistributionItem } from '../../lib/managementAnalytics';

export default function RiskDistributionChart({ data }: { data: RiskDistributionItem[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.length ? data : [{ level: 'none', label: 'No data', count: 1 }];

  return (
    <ChartPanel
      title="Risk distribution"
      subtitle="Inspection visits grouped by assessed risk level"
      height={320}
    >
      <div className="flex h-full items-center gap-4">
        <div className="relative h-full min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="label"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={3}
                animationDuration={750}
                animationEasing="ease-out"
                stroke="none"
              >
                {chartData.map((entry) => (
                  <Cell key={entry.level} fill={chartPalette.risk[entry.level as keyof typeof chartPalette.risk] ?? chartPalette.risk.none} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={chartTooltipStyle()}
                formatter={(value: number, name: string) => [`${value} visits`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{total}</span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Total</span>
          </div>
        </div>

        <ul className="hidden w-[132px] shrink-0 space-y-2 sm:block">
          {chartData.map((entry) => (
            <li key={entry.level} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      chartPalette.risk[entry.level as keyof typeof chartPalette.risk] ?? chartPalette.risk.none,
                  }}
                />
                {entry.label}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{entry.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartPanel>
  );
}
