interface ExecutiveStatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  accent?: 'neutral' | 'positive' | 'caution' | 'critical' | 'info';
  loading?: boolean;
}

const accentStyles = {
  neutral: 'before:bg-slate-300 dark:before:bg-slate-600',
  positive: 'before:bg-emerald-500',
  caution: 'before:bg-amber-500',
  critical: 'before:bg-rose-500',
  info: 'before:bg-sky-600',
};

export default function ExecutiveStatCard({
  label,
  value,
  trend,
  accent = 'neutral',
  loading,
}: ExecutiveStatCardProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="animate-pulse space-y-3">
          <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-8 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] ${accentStyles[accent]}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white">
        {value}
      </p>
      {trend && (
        <p
          className={`mt-2 text-xs font-medium ${
            trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {trend.value >= 0 ? '+' : ''}
          {trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}
