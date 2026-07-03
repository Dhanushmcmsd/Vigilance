import { Fragment, useMemo, useState } from 'react';
import type { BranchSectionHeatmap } from '../../lib/managementAnalytics';
import ChartPanel from './ChartPanel';
import { heatCellColor, heatCellColorDark } from './chartTheme';

function abbreviateSection(section: string) {
  const words = section.split(/\s+/);
  if (words.length === 1) return section.slice(0, 10);
  return words.map((word) => word[0]).join('');
}

export default function SectionHeatmapGrid({ data }: { data: BranchSectionHeatmap }) {
  const [hovered, setHovered] = useState<{ branch: string; section: string; violations: number } | null>(null);
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const cellMap = useMemo(() => {
    const map = new Map<string, { violations: number; intensity: number }>();
    data.cells.forEach((cell) => {
      map.set(`${cell.branch}::${cell.section}`, cell);
    });
    return map;
  }, [data.cells]);

  const colorFor = (intensity: number) =>
    isDark ? heatCellColorDark(intensity) : heatCellColor(intensity);

  if (!data.branches.length || !data.sections.length) {
    return (
      <ChartPanel title="Checklist section heatmap" subtitle="Non-conformance density by branch and section">
        <p className="flex h-full items-center justify-center text-sm text-slate-500">
          No violation data for this period.
        </p>
      </ChartPanel>
    );
  }

  return (
    <ChartPanel
      title="Checklist section heatmap"
      subtitle="Non-conformance density across branches and checklist sections"
      height={Math.min(420, 96 + data.branches.length * 36)}
      headerExtra={
        hovered ? (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {hovered.branch} · {hovered.section}: {hovered.violations} issue
            {hovered.violations === 1 ? '' : 's'}
          </p>
        ) : null
      }
    >
      <div className="flex h-full flex-col gap-3">
        <div className="overflow-x-auto">
          <div
            className="min-w-[680px] grid gap-1.5"
            style={{
              gridTemplateColumns: `minmax(120px, 160px) repeat(${data.sections.length}, minmax(44px, 1fr))`,
            }}
          >
            <div />
            {data.sections.map((section) => (
              <div
                key={section}
                className="truncate px-0.5 pb-1 text-center text-[10px] font-medium text-slate-500"
                title={section}
              >
                {abbreviateSection(section)}
              </div>
            ))}

            {data.branches.map((branch) => (
              <Fragment key={branch}>
                <div
                  className="flex items-center truncate pr-2 text-xs font-medium text-slate-700 dark:text-slate-200"
                  title={branch}
                >
                  {branch}
                </div>
                {data.sections.map((section) => {
                  const cell = cellMap.get(`${branch}::${section}`);
                  const violations = cell?.violations ?? 0;
                  const intensity = cell?.intensity ?? 0;
                  const active = hovered?.branch === branch && hovered?.section === section;
                  return (
                    <button
                      key={`${branch}-${section}`}
                      type="button"
                      onMouseEnter={() => setHovered({ branch, section, violations })}
                      onMouseLeave={() => setHovered(null)}
                      className={`h-8 rounded-md border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                        active
                          ? 'scale-105 border-slate-400 shadow-md ring-2 ring-slate-300/50 dark:ring-slate-600/50'
                          : 'border-slate-200/50 hover:scale-[1.03] hover:shadow-sm dark:border-slate-700/50'
                      }`}
                      style={{ backgroundColor: colorFor(intensity) }}
                      aria-label={`${branch}, ${section}, ${violations} violations`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
          <span>Low risk</span>
          <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-emerald-100 via-amber-200 to-rose-300 dark:from-emerald-900/40 dark:via-amber-900/40 dark:to-rose-900/50" />
          <span>High risk</span>
        </div>
      </div>
    </ChartPanel>
  );
}
