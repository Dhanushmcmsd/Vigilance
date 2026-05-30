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
}

export function StatCard({ label, value, trend, borderColor = 'default', loading }: StatCardProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    if (typeof value === 'number' && !loading) {
      const animation = animate(count, value, { duration: 1.2, ease: 'easeOut' });
      return animation.stop;
    }
  }, [value, loading, count]);

  const borderColors = {
    critical: '#EF4444',
    warning: '#F59E0B',
    safe: '#22C55E',
    default: '#2563EB',
  };

  const bgColors = {
    critical: 'rgba(239,68,68,0.08)',
    warning: 'rgba(245,158,11,0.08)',
    safe: 'rgba(34,197,94,0.08)',
    default: 'rgba(37,99,235,0.08)',
  };

  return (
    <motion.div
      variants={fadeUp}
      className="relative rounded-lg p-6 border"
      style={{
        backgroundColor: bgColors[borderColor],
        borderColor: 'rgba(255,255,255,0.07)',
        borderLeftWidth: '4px',
        borderLeftColor: borderColors[borderColor],
      }}
    >
      {loading ? (
        <div className="h-16 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-4xl font-bold text-gray-100 tracking-tight mb-1">
                {typeof value === 'number' ? <motion.span>{rounded}</motion.span> : value}
              </div>
              <div className="text-xs text-gray-400 font-medium tracking-wide">
                {label}
              </div>
            </div>
            {trend && (
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-md"
                style={{
                  backgroundColor: trend.direction === 'up' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                }}
              >
                {trend.direction === 'up' ? (
                  <TrendingUp className="w-4 h-4" style={{ color: '#22C55E' }} aria-hidden />
                ) : (
                  <TrendingDown className="w-4 h-4" style={{ color: '#EF4444' }} aria-hidden />
                )}
                <span
                  className="text-xs font-semibold"
                  style={{ color: trend.direction === 'up' ? '#22C55E' : '#EF4444' }}
                >
                  {trend.percentage}%
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}
