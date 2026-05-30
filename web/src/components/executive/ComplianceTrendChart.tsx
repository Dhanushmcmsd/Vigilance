import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import ChartPanel from './ChartPanel';
import { axisTick, chartMargins, chartPalette, chartTooltipStyle } from './chartTheme';

interface TrendPoint {
  label: string;
  cfc: number;
  store: number;
}

export default function ComplianceTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartPanel
      title="Compliance trajectory"
      subtitle="Rolling average compliance for CFC and Store formats"
      height={340}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={chartMargins.line}>
          <defs>
            <linearGradient id="cfcFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartPalette.cfc} stopOpacity={0.18} />
              <stop offset="100%" stopColor={chartPalette.cfc} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="storeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartPalette.store} stopOpacity={0.12} />
              <stop offset="100%" stopColor={chartPalette.store} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chartPalette.grid} vertical={false} strokeDasharray="3 6" />
          <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} dy={8} />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={chartTooltipStyle()}
            formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            labelStyle={{ color: '#64748b', marginBottom: 4 }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
          />
          <ReferenceLine
            y={80}
            stroke={chartPalette.target}
            strokeDasharray="4 6"
            strokeOpacity={0.45}
          />
          <ReferenceLine
            y={60}
            stroke={chartPalette.warning}
            strokeDasharray="4 6"
            strokeOpacity={0.45}
          />
          <Area
            type="monotone"
            dataKey="cfc"
            stroke="none"
            fill="url(#cfcFill)"
            animationDuration={800}
            isAnimationActive
          />
          <Area
            type="monotone"
            dataKey="store"
            stroke="none"
            fill="url(#storeFill)"
            animationDuration={900}
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="cfc"
            name="CFC"
            stroke={chartPalette.cfc}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: chartPalette.cfc }}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Line
            type="monotone"
            dataKey="store"
            name="Store"
            stroke={chartPalette.store}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: chartPalette.store }}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}
