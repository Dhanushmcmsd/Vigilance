interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  color?: 'default' | 'green' | 'yellow' | 'red' | 'blue';
  loading?: boolean;
  badge?: number;
  surface?: 'default' | 'bloom';
}

const borderColors: Record<string, string> = {
  default: 'border-gray-200 dark:border-gray-700',
  green: 'border-green-400',
  yellow: 'border-yellow-400',
  red: 'border-red-400',
  blue: 'border-blue-400',
};

const bloomBorderColors: Record<string, string> = {
  default: 'border-black/30',
  green: 'border-emerald-600',
  yellow: 'border-amber-600',
  red: 'border-red-600',
  blue: 'border-sky-600',
};

export default function StatCard({
  label,
  value,
  trend,
  color = 'default',
  loading,
  badge,
  surface = 'default',
}: StatCardProps) {
  const isBloom = surface === 'bloom';

  if (loading) {
    if (isBloom) {
      return (
        <div className="bloom-panel p-5 animate-pulse">
          <div className="bloom-panel-content">
            <div className="h-4 rounded w-2/3 mb-3 bg-white/15" />
            <div className="h-8 rounded w-1/2 bg-white/15" />
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 border-gray-200 dark:border-gray-700 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  if (isBloom) {
    return (
      <div className={`bloom-panel border-l-4 ${bloomBorderColors[color]} p-5 relative`}>
        <div className="bloom-panel-content">
          {badge !== undefined && badge > 0 && (
            <span className="absolute top-3 right-3 z-10 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
              {badge}
            </span>
          )}
          <div className="text-sm bloom-stat-label mb-1">{label}</div>
          <div className="text-3xl font-bold bloom-stat-value">{value}</div>
          {trend && (
            <div
              className={`text-xs mt-1 font-medium ${
                trend.value >= 0 ? 'bloom-stat-trend-up' : 'bloom-stat-trend-down'
              }`}
            >
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 ${borderColors[color]} p-5 relative`}>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-3 right-3 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-bold">
          {badge}
        </span>
      )}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
      {trend && (
        <div className={`text-xs mt-1 font-medium ${
          trend.value >= 0 ? 'text-green-600' : 'text-red-500'
        }`}>
          {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
        </div>
      )}
    </div>
  );
}
