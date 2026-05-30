import type { ReactNode } from 'react';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  height?: number;
  headerExtra?: ReactNode;
}

export default function ChartPanel({
  title,
  subtitle,
  children,
  className = '',
  height = 300,
  headerExtra,
}: ChartPanelProps) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] dark:border-slate-800/80 dark:bg-slate-900 dark:shadow-[0_8px_24px_rgba(0,0,0,0.25)] ${className}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/60 to-transparent dark:via-slate-600/40" />
      <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-800/80">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {headerExtra}
        </div>
      </div>
      <div className="px-4 pb-5 pt-2 sm:px-6" style={{ height }}>
        {children}
      </div>
    </article>
  );
}
