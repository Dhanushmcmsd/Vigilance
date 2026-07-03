import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fadeUp } from '../../lib/animations';

interface StatCardProps {
  label: string;
  value: number | string;
  trend?: { direction: 'up' | 'down'; percentage: number };
  borderColor?: 'critical' | 'warning' | 'safe' | 'default';
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  trend,
  borderColor = 'default',
  loading,
  onClick,
}: StatCardProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    if (typeof value === 'number' && !loading) {
      const animation = animate(count, value, { duration: 1.2, ease: 'easeOut' });
      return animation.stop;
    }
  }, [value, loading, count]);

  const borderColors = {
    critical: 'var(--accent-red)',
    warning: 'var(--accent-yellow)',
    safe: 'var(--accent-green)',
    default: 'var(--accent-blue)',
  };

  const bgColors = {
    critical: 'rgba(239,68,68,0.08)',
    warning: 'rgba(245,158,11,0.08)',
    safe: 'rgba(34,197,94,0.08)',
    default: 'rgba(99,102,241,0.08)',
  };

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <motion.div variants={fadeUp}>
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`relative rounded-lg p-6 border w-full text-left transition-opacity ${
          onClick ? 'cursor-pointer hover:opacity-90 clickable' : ''
        }`}
        style={{
          backgroundColor: bgColors[borderColor],
          borderColor: 'var(--border-color)',
          borderLeftWidth: '4px',
          borderLeftColor: borderColors[borderColor],
        }}
      >
        {loading ? (
          <div className="h-16 flex items-center justify-center">
            <div
              className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--accent-blue)' }}
            />
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div
                  className="text-4xl font-bold tracking-tight mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {typeof value === 'number' ? <motion.span>{rounded}</motion.span> : value}
                </div>
                <div className="text-xs font-medium tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </div>
              </div>
              {trend && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-md"
                  style={{
                    backgroundColor:
                      trend.direction === 'up' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  }}
                >
                  {trend.direction === 'up' ? (
                    <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent-green)' }} aria-hidden />
                  ) : (
                    <TrendingDown className="w-4 h-4" style={{ color: 'var(--accent-red)' }} aria-hidden />
                  )}
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: trend.direction === 'up' ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}
                  >
                    {trend.percentage}%
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </Wrapper>
    </motion.div>
  );
}
