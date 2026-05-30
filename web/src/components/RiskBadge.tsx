interface RiskBadgeProps {
  level: string | null | undefined;
}

const riskStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border border-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border border-orange-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border border-green-300',
};

export default function RiskBadge({ level }: RiskBadgeProps) {
  const key = (level ?? 'low').toLowerCase();
  const style = riskStyles[key] ?? riskStyles.low;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${style}`}>
      {level ?? 'N/A'}
    </span>
  );
}
