import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { slideInRight } from '../../lib/animations';

export interface StoreCardSummary {
  id: string;
  name: string;
  region: string;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  complianceScore: number;
  lastInspected: string;
}

interface StoreDetailPanelProps {
  store: StoreCardSummary | null;
  onClose: () => void;
  onViewAlerts?: () => void;
}

export function StoreDetailPanel({ store, onClose, onViewAlerts }: StoreDetailPanelProps) {
  if (!store) return null;

  const scoreColor =
    store.complianceScore >= 80 ? '#16A34A' : store.complianceScore >= 60 ? '#D97706' : '#C0392B';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden
      />

      <motion.div
        variants={slideInRight}
        initial="hidden"
        animate="visible"
        exit="hidden"
        role="dialog"
        aria-label={`Store details: ${store.name}`}
        className="fixed top-0 right-0 h-screen w-full max-w-md z-50 flex flex-col overflow-y-auto"
        style={{ backgroundColor: '#111118' }}
      >
        <div
          className="sticky top-0 flex items-center justify-between p-6 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)', backgroundColor: '#111118' }}
        >
          <h2 className="text-base font-semibold text-text-primary">Store details</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-text-primary" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">{store.name}</h3>
            <p className="text-sm text-muted mt-1">{store.region}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg p-3 border text-center" style={{ borderColor: 'rgba(192,57,43,0.35)' }}>
              <p className="text-xl font-mono font-bold text-text-primary">{store.redCount}</p>
              <p className="text-[10px] uppercase text-muted mt-1">Red</p>
            </div>
            <div className="rounded-lg p-3 border text-center" style={{ borderColor: 'rgba(217,119,6,0.35)' }}>
              <p className="text-xl font-mono font-bold text-text-primary">{store.yellowCount}</p>
              <p className="text-[10px] uppercase text-muted mt-1">Yellow</p>
            </div>
            <div className="rounded-lg p-3 border text-center" style={{ borderColor: 'rgba(22,163,74,0.35)' }}>
              <p className="text-xl font-mono font-bold text-text-primary">{store.greenCount}</p>
              <p className="text-[10px] uppercase text-muted mt-1">Green</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs text-muted mb-2">
              <span>Compliance score</span>
              <span style={{ color: scoreColor }} className="font-mono font-semibold">
                {store.complianceScore}%
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full" style={{ width: `${store.complianceScore}%`, backgroundColor: scoreColor }} />
            </div>
          </div>

          <p className="text-xs text-muted">Last inspected: {store.lastInspected}</p>

          {onViewAlerts && (store.redCount > 0 || store.yellowCount > 0) && (
            <button
              type="button"
              onClick={onViewAlerts}
              className="w-full rounded-md py-2.5 text-sm font-medium"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#F5F5F0' }}
            >
              View live alerts for this store
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
