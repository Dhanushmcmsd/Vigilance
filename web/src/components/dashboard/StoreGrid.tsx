import { motion } from 'framer-motion';
import { fadeUp, staggerContainer } from '../../lib/animations';

interface StoreCard {
  id: string;
  name: string;
  region: string;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  complianceScore: number;
  lastInspected: string;
  hasOpenRed: boolean;
  hasOpenYellow: boolean;
}

interface StoreGridProps {
  stores: StoreCard[];
  onStoreClick: (store: StoreCard) => void;
  showDistrictLabel?: boolean;
}

export function StoreGrid({ stores, onStoreClick, showDistrictLabel = false }: StoreGridProps) {
  const getBorderColor = (store: StoreCard) => {
    if (store.hasOpenRed) return '#C0392B';
    if (store.hasOpenYellow) return '#D97706';
    return 'rgba(255,255,255,0.07)';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#16A34A';
    if (score >= 60) return '#D97706';
    return '#C0392B';
  };

  return (
    <div>
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
        District Health Overview
      </h2>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {stores.map(store => {
          const borderColor = getBorderColor(store);
          const scoreColor = getScoreColor(store.complianceScore);

          return (
            <motion.div
              key={store.id}
              variants={fadeUp}
              onClick={() => onStoreClick(store)}
              data-cursor="pointer"
              whileHover={{ scale: 1.01 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg p-5 border cursor-pointer clickable"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                borderLeftWidth: '3px',
                borderLeftColor: borderColor,
              }}
            >
              <div className="mb-3">
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {store.name}
                </h3>
                {showDistrictLabel ? (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-1"
                    style={{
                      borderColor: 'var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    District
                  </span>
                ) : null}
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {store.region}
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold border"
                  style={{
                    backgroundColor: 'rgba(192,57,43,0.15)',
                    borderColor: '#C0392B',
                    color: '#C0392B'
                  }}
                >
                  RED: {store.redCount}
                </div>
                <div
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold border"
                  style={{
                    backgroundColor: 'rgba(217,119,6,0.15)',
                    borderColor: '#D97706',
                    color: '#D97706'
                  }}
                >
                  YELLOW: {store.yellowCount}
                </div>
                <div
                  className="px-2 py-1 rounded text-[10px] font-mono font-bold border"
                  style={{
                    backgroundColor: 'rgba(22,163,74,0.15)',
                    borderColor: '#16A34A',
                    color: '#16A34A'
                  }}
                >
                  GREEN: {store.greenCount}
                </div>
              </div>

              <div className="mb-3">
                <div
                  className="h-0.5 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${store.complianceScore}%`,
                      backgroundColor: scoreColor
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted">
                  Last: {store.lastInspected}
                </span>
                <span
                  className="text-sm font-mono font-bold"
                  style={{ color: scoreColor }}
                >
                  {store.complianceScore}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
