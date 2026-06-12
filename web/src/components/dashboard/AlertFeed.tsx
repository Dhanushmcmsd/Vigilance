import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/animations';

interface AlertItem {
  id: string;
  storeName: string;
  district: string;
  section: string;
  itemTitle: string;
  risk: 'RED' | 'YELLOW';
  timeAgo: string;
  verifierName: string;
  timestamp: string;
  remarks?: string;
  photoUrl?: string;
  statutoryRisk?: string;
}

interface AlertFeedProps {
  alerts: AlertItem[];
  onAlertClick: (alert: AlertItem) => void;
  groupByDistrict?: boolean;
}

export function AlertFeed({ alerts, onAlertClick, groupByDistrict = false }: AlertFeedProps) {
  const grouped = groupByDistrict
    ? alerts.reduce<Map<string, AlertItem[]>>((acc, alert) => {
        const key = alert.district ?? 'Unknown District';
        const list = acc.get(key) ?? [];
        list.push(alert);
        acc.set(key, list);
        return acc;
      }, new Map())
    : null;

  const renderAlert = (alert: AlertItem) => {
    const riskColor = alert.risk === 'RED' ? '#C0392B' : '#D97706';
    const riskBgColor = alert.risk === 'RED' ? 'rgba(192,57,43,0.04)' : 'rgba(217,118,6,0.04)';

    return (
      <motion.div
        key={alert.id}
        variants={fadeUp}
        onClick={() => onAlertClick(alert)}
        data-cursor="pointer"
        data-risk={alert.risk === 'RED' ? 'red' : undefined}
        className="rounded p-3 border transition-all cursor-pointer"
        style={{
          backgroundColor: riskBgColor,
          borderColor: 'rgba(255,255,255,0.05)',
        }}
        whileHover={{
          backgroundColor: 'rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-text-primary truncate">
                  {alert.storeName}
                </span>
                <div className="mt-1 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300 max-w-[160px] truncate">
                  {alert.section}
                </div>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{
                  backgroundColor: `${riskColor}26`,
                  color: riskColor,
                  border: `1px solid ${riskColor}`,
                }}
              >
                {alert.risk}
              </span>
            </div>

            <p className="text-xs text-muted mb-1 line-clamp-1">{alert.itemTitle}</p>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted">{alert.timeAgo}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div
      className="rounded-lg p-6 border"
      style={{
        backgroundColor: '#111118',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      <h2 className="text-sm font-semibold text-text-primary mb-4">Active Critical Flags</h2>

      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '380px' }}>
        <style>{`
          .alert-feed-scroll::-webkit-scrollbar {
            width: 4px;
          }
          .alert-feed-scroll::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.06);
          }
          .alert-feed-scroll::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.15);
            border-radius: 2px;
          }
        `}</style>

        <div className="alert-feed-scroll">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No active critical flags</p>
          ) : grouped ? (
            Array.from(grouped.entries()).map(([district, districtAlerts]) => (
              <div key={district} className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-primary">
                    {district}
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: 'rgba(192,57,43,0.15)',
                      color: '#C0392B',
                    }}
                  >
                    {districtAlerts.length}
                  </span>
                </div>
                <div className="space-y-2">{districtAlerts.map(renderAlert)}</div>
              </div>
            ))
          ) : (
            alerts.map(renderAlert)
          )}
        </div>
      </div>
    </div>
  );
}
