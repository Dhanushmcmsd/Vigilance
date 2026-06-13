import { useMemo, useState } from 'react';

const NEON_SERIES = [
  { stroke: '#ff2bd6', glow: '#ff2bd6', name: 'magenta' },
  { stroke: '#ffe600', glow: '#ffe600', name: 'yellow' },
  { stroke: '#00f0ff', glow: '#00f0ff', name: 'cyan' },
  { stroke: '#ff6b35', glow: '#ff6b35', name: 'orange' },
  { stroke: '#b388ff', glow: '#b388ff', name: 'violet' },
  { stroke: '#69f0ae', glow: '#69f0ae', name: 'green' },
] as const;

const AVG_SERIES = { stroke: '#ff1744', glow: '#ff1744', name: 'red' };

const CHART = {
  width: 880,
  height: 300,
  padL: 52,
  padR: 28,
  padT: 28,
  padB: 44,
};

interface ChartRow {
  label: string;
  [key: string]: string | number | null;
}

type EnrichedRow = ChartRow & { 'Daily avg': number | null };

interface PlotPoint {
  x: number;
  y: number;
}

function enrichTrendData(data: ChartRow[]): EnrichedRow[] {
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

function toPlotPoints(
  rows: EnrichedRow[],
  key: string,
  plotW: number,
  plotH: number,
): PlotPoint[] {
  const points: PlotPoint[] = [];
  rows.forEach((row, index) => {
    const value = row[key];
    if (value === null || typeof value !== 'number') return;
    const x = CHART.padL + (index / Math.max(rows.length - 1, 1)) * plotW;
    const y = CHART.padT + plotH - (value / 100) * plotH;
    points.push({ x, y });
  });
  return points;
}

/** Smooth cubic path similar to the reference neon curves. */
function buildSmoothPath(points: PlotPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function appendRedTail(path: string, points: PlotPoint[]): string {
  if (!path || points.length === 0) return path;
  const last = points[points.length - 1];
  const tailEnd = Math.min(last.x + 48, CHART.width - CHART.padR);
  return `${path} L ${tailEnd} ${last.y}`;
}

function GlowDefs() {
  const colors = [...NEON_SERIES.map((s) => s.glow), AVG_SERIES.glow];
  return (
    <defs>
      {colors.map((color) => (
        <filter key={color} id={`glow-${color.replace('#', '')}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feGaussianBlur stdDeviation="7" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      ))}
      <filter id="glow-axis" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {colors.map((color) => (
        <marker
          key={`arrow-${color}`}
          id={`arrow-${color.replace('#', '')}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

export default function GlowingComplianceTrendChart({
  data,
}: {
  data: Array<Record<string, string | number | null>>;
}) {
  const chartData = useMemo(
    () => enrichTrendData(data as ChartRow[]),
    [data],
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotW = CHART.width - CHART.padL - CHART.padR;
  const plotH = CHART.height - CHART.padT - CHART.padB;

  const seriesKeys = useMemo(
    () =>
      chartData.length > 0
        ? Object.keys(chartData[0]).filter((key) => key !== 'label' && key !== 'Daily avg')
        : [],
    [chartData],
  );

  const hasData = chartData.some((row) => row['Daily avg'] !== null);

  const seriesPaths = useMemo(() => {
    return seriesKeys.map((key, index) => {
      const palette = NEON_SERIES[index % NEON_SERIES.length];
      const points = toPlotPoints(chartData, key, plotW, plotH);
      return {
        key,
        path: buildSmoothPath(points),
        points,
        ...palette,
        delay: index * 0.35,
      };
    });
  }, [chartData, seriesKeys, plotW, plotH]);

  const avgPath = useMemo(() => {
    const points = toPlotPoints(chartData, 'Daily avg', plotW, plotH);
    const basePath = buildSmoothPath(points);
    return {
      path: appendRedTail(basePath, points),
      points,
      ...AVG_SERIES,
      delay: seriesKeys.length * 0.35 + 0.2,
    };
  }, [chartData, seriesKeys.length, plotW, plotH]);

  const hoverX =
    hoverIndex != null
      ? CHART.padL + (hoverIndex / Math.max(chartData.length - 1, 1)) * plotW
      : null;

  return (
    <div className="glow-trend-chart">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="bloom-heading text-base font-semibold">Compliance Trend</h3>
          <p className="bloom-subtitle text-xs">
            Daily average compliance with store/district performance lines for the selected period
          </p>
        </div>
      </div>

      {!hasData ? (
        <p className="bloom-subtitle py-16 text-center text-sm">
          No inspection activity recorded for this period yet.
        </p>
      ) : (
        <div
          className="glow-trend-canvas"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
            const index = Math.round(ratio * Math.max(chartData.length - 1, 0));
            setHoverIndex(index);
          }}
        >
          <svg
            viewBox={`0 0 ${CHART.width} ${CHART.height}`}
            className="glow-trend-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <GlowDefs />

            <rect x={0} y={0} width={CHART.width} height={CHART.height} fill="#000000" rx={12} />

            {/* Glowing axes */}
            <line
              x1={CHART.padL}
              y1={CHART.padT}
              x2={CHART.padL}
              y2={CHART.height - CHART.padB}
              stroke="#ffffff"
              strokeWidth={1.5}
              filter="url(#glow-axis)"
              className="glow-axis-line"
            />
            <line
              x1={CHART.padL}
              y1={CHART.height - CHART.padB}
              x2={CHART.width - CHART.padR}
              y2={CHART.height - CHART.padB}
              stroke="#ffffff"
              strokeWidth={1.5}
              filter="url(#glow-axis)"
              className="glow-axis-line"
            />

            {/* Subtle Y ticks */}
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = CHART.padT + plotH - (tick / 100) * plotH;
              return (
                <g key={tick}>
                  <line
                    x1={CHART.padL - 4}
                    y1={y}
                    x2={CHART.padL}
                    y2={y}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={1}
                  />
                  <text
                    x={CHART.padL - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.45)"
                    fontSize={10}
                  >
                    {tick}%
                  </text>
                </g>
              );
            })}

            {/* X day labels */}
            {chartData.map((row, index) => {
              if (chartData.length > 20 && index % 2 !== 0 && index !== chartData.length - 1) return null;
              const x = CHART.padL + (index / Math.max(chartData.length - 1, 1)) * plotW;
              return (
                <text
                  key={row.label}
                  x={x}
                  y={CHART.height - CHART.padB + 18}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.4)"
                  fontSize={10}
                >
                  {row.label}
                </text>
              );
            })}

            {/* Neon series curves */}
            {seriesPaths.map((series) =>
              series.path ? (
                <path
                  key={series.key}
                  d={series.path}
                  fill="none"
                  stroke={series.stroke}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#glow-${series.glow.replace('#', '')})`}
                  markerEnd={`url(#arrow-${series.glow.replace('#', '')})`}
                  pathLength={100}
                  className="glow-trend-line"
                  style={{ ['--line-delay' as string]: `${series.delay}s` }}
                />
              ) : null,
            )}

            {/* Daily average — red glowing merged trend */}
            {avgPath.path ? (
              <path
                d={avgPath.path}
                fill="none"
                stroke={avgPath.stroke}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#glow-${avgPath.glow.replace('#', '')})`}
                markerEnd={`url(#arrow-${avgPath.glow.replace('#', '')})`}
                pathLength={100}
                className="glow-trend-line glow-trend-line-avg"
                style={{ ['--line-delay' as string]: `${avgPath.delay}s` }}
              />
            ) : null}

            {/* Hover guide */}
            {hoverX != null && hoverIndex != null ? (
              <>
                <line
                  x1={hoverX}
                  y1={CHART.padT}
                  x2={hoverX}
                  y2={CHART.height - CHART.padB}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 4"
                />
                {seriesPaths.map((series) => {
                  const row = chartData[hoverIndex];
                  const value = row?.[series.key];
                  if (value == null || typeof value !== 'number') return null;
                  const y = CHART.padT + plotH - (value / 100) * plotH;
                  return (
                    <circle
                      key={series.key}
                      cx={hoverX}
                      cy={y}
                      r={5}
                      fill={series.stroke}
                      filter={`url(#glow-${series.glow.replace('#', '')})`}
                    />
                  );
                })}
                {(() => {
                  const avg = chartData[hoverIndex]?.['Daily avg'];
                  if (avg == null || typeof avg !== 'number') return null;
                  const y = CHART.padT + plotH - (avg / 100) * plotH;
                  return (
                    <circle
                      cx={hoverX}
                      cy={y}
                      r={6}
                      fill={AVG_SERIES.stroke}
                      filter={`url(#glow-${AVG_SERIES.glow.replace('#', '')})`}
                    />
                  );
                })()}
              </>
            ) : null}
          </svg>

          {hoverIndex != null && chartData[hoverIndex] ? (
            <div className="glow-trend-tooltip">
              <p className="glow-trend-tooltip-title">Day {chartData[hoverIndex].label}</p>
              {seriesKeys.map((key, index) => {
                const value = chartData[hoverIndex][key];
                if (value == null) return null;
                const color = NEON_SERIES[index % NEON_SERIES.length].stroke;
                return (
                  <p key={key} style={{ color }}>
                    {key}: {Number(value).toFixed(1)}%
                  </p>
                );
              })}
              {chartData[hoverIndex]['Daily avg'] != null ? (
                <p style={{ color: AVG_SERIES.stroke }}>
                  Daily avg: {Number(chartData[hoverIndex]['Daily avg']).toFixed(1)}%
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="glow-trend-legend">
            {seriesKeys.map((key, index) => {
              const color = NEON_SERIES[index % NEON_SERIES.length].stroke;
              return (
                <span key={key} className="glow-trend-legend-item">
                  <span className="glow-trend-legend-dot" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                  {key}
                </span>
              );
            })}
            <span className="glow-trend-legend-item">
              <span
                className="glow-trend-legend-dot"
                style={{ backgroundColor: AVG_SERIES.stroke, boxShadow: `0 0 10px ${AVG_SERIES.stroke}` }}
              />
              Daily avg
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
