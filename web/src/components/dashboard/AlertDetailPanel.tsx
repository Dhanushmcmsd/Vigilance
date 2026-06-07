import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { slideInRight } from '../../lib/animations';

interface AlertDetailPanelProps {
  alert: {
    storeName: string;
    section: string;
    itemTitle: string;
    risk: 'RED' | 'YELLOW';
    verifierName: string;
    timestamp: string;
    remarks?: string;
    photoUrl?: string;
    statutoryRisk?: string;
  } | null;
  onClose: () => void;
}

export function AlertDetailPanel({ alert, onClose }: AlertDetailPanelProps) {
  if (!alert) return null;

  const riskColor = alert.risk === 'RED' ? '#C0392B' : '#D97706';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      />

      <motion.div
        variants={slideInRight}
        initial="hidden"
        animate="visible"
        exit="hidden"
        className="fixed top-0 right-0 h-screen w-[480px] z-50 flex flex-col overflow-y-auto"
        style={{ backgroundColor: '#111118' }}
      >
        <div
          className="sticky top-0 flex items-center justify-between p-6 border-b z-10"
          style={{
            backgroundColor: '#111118',
            borderColor: 'rgba(255,255,255,0.07)'
          }}
        >
          <h2 className="text-base font-semibold text-text-primary">Alert Details</h2>
          <button
            onClick={onClose}
            data-cursor="pointer"
            className="p-2 rounded-lg transition-all"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <X className="w-4 h-4 text-text-primary" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div
              className="inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-wider mb-4"
              style={{
                backgroundColor: `${riskColor}26`,
                border: `1px solid ${riskColor}`,
                color: riskColor
              }}
            >
              {alert.risk} RISK
            </div>

            <h3 className="text-lg font-semibold text-text-primary mb-2">
              {alert.storeName}
            </h3>

            <div className="text-sm text-muted">
              <span className="text-xs uppercase tracking-wider">Section</span>
              <p className="mt-1 text-sm text-text-primary">{alert.section}</p>
            </div>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.07)'
            }}
          >
            <div className="text-xs uppercase tracking-wider text-muted mb-2">
              Non-Compliance Item
            </div>
            <p className="text-sm text-text-primary leading-relaxed">
              {alert.itemTitle}
            </p>
          </div>

          {alert.statutoryRisk && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgba(192,57,43,0.08)',
                borderColor: '#C0392B',
                borderLeftWidth: '3px'
              }}
            >
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#C0392B' }}>
                Statutory / Legal Risk
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                {alert.statutoryRisk}
              </p>
            </div>
          )}

          {alert.remarks && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(255,255,255,0.07)'
              }}
            >
              <div className="text-xs uppercase tracking-wider text-muted mb-2">
                Officer Remarks
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                {alert.remarks}
              </p>
            </div>
          )}

          {alert.photoUrl && (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <img src={alert.photoUrl} alt="Evidence" className="w-full" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted mb-1">
                Verified By
              </div>
              <div className="text-sm font-medium text-text-primary">
                {alert.verifierName}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted mb-1">
                Flagged At
              </div>
              <div className="text-sm font-mono text-text-primary">
                {new Date(alert.timestamp).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
