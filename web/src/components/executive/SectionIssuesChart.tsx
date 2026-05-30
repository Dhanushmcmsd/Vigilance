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
import { axisTick, chartMargins, chartPalette, chartTooltipStyle, sectionBarColor } from './chartTheme';

interface SectionIssue {
  section: string;
  issues: number;
}

export default function SectionIssuesChart({ data }: { data: SectionIssue[] }) {
  const sorted = [...data].sort((a, b) => b.issues - a.issues).slice(0, 8);
  const max = Math.max(...sorted.map((item) => item.issues), 1);

  return (
    <ChartPanel
      title="Section failure analysis"
      subtitle="Checklist sections with the highest non-conformance counts"
      height={320}
    >
      {sorted.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sorted} layout="vertical" margin={chartMargins.barVertical}>
            <CartesianGrid stroke={chartPalette.grid} horizontal={false} strokeDasharray="3 6" />
            <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="section"
              width={128}
              tick={{ ...axisTick, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={chartTooltipStyle()} />
            <Bar
              dataKey="issues"
              radius={[0, 8, 8, 0]}
              barSize={16}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {sorted.map((entry) => (
                <Cell key={entry.section} fill={sectionBarColor(entry.issues, max)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <p className="flex h-full items-center justify-center text-sm text-slate-500">
          No section issues recorded in this period.
        </p>
      )}
    </ChartPanel>
  );
}
