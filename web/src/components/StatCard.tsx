interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  color?: 'default' | 'green' | 'yellow' | 'red' | 'blue';
  loading?: boolean;
  badge?: number;
}

const borderColors: Record<string, string> = {
  default: 'border-gray-200 dark:border-gray-700',
  green: 'border-green-400',
  yellow: 'border-yellow-400',
  red: 'border-red-400',
  blue: 'border-blue-400',
};

export default function StatCard({ label, value, trend, color = 'default', loading, badge }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border-l-4 border-gray-200 dark:border-gray-700 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
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
