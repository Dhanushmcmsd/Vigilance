import { motion, AnimatePresence } from 'framer-motion';
import { slideInRight } from '../../lib/animations';

interface NotificationItem {
  id: string;
  storeName: string;
  itemTitle: string;
  time: string;
  risk: 'RED' | 'YELLOW';
  read: boolean;
  district?: string;
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  districtChips?: string[];
  activeDistrict?: string | null;
  onDistrictFilter?: (district: string | null) => void;
  onMarkAllRead: () => void;
  onSelectNotification?: (id: string) => void;
}

function NotificationRow({
  item,
  accent,
  onSelect,
}: {
  item: NotificationItem;
  accent: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <button
      type="button"
      key={item.id}
      onClick={() => onSelect?.(item.id)}
      data-cursor="pointer"
      className="w-full text-left relative rounded-lg p-3 transition-all"
      style={{
        backgroundColor: item.read ? 'transparent' : 'rgba(255,255,255,0.04)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="text-xs font-semibold text-text-primary mb-1">{item.storeName}</div>
      <div className="text-xs text-muted mb-2 line-clamp-2">{item.itemTitle}</div>
      <div className="text-[10px] font-mono text-muted text-right">{item.time}</div>
    </button>
  );
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  districtChips = [],
  activeDistrict = null,
  onDistrictFilter,
  onMarkAllRead,
  onSelectNotification,
}: NotificationDrawerProps) {
  const criticalNotifications = notifications.filter((n) => n.risk === 'RED');
  const warningNotifications = notifications.filter((n) => n.risk === 'YELLOW');

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
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
            aria-label="Notifications"
            className="fixed top-0 right-0 h-screen w-full max-w-[360px] z-50 flex flex-col"
            style={{ backgroundColor: '#111118' }}
          >
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <h2 className="text-sm font-semibold text-text-primary">Alerts</h2>
              <button
                type="button"
                onClick={onMarkAllRead}
                data-cursor="pointer"
                className="text-xs text-muted hover:text-text-primary transition-colors"
              >
                Mark all read
              </button>
            </div>

            {districtChips.length > 0 && (
              <div className="flex flex-wrap gap-2 border-b p-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                <button
                  type="button"
                  onClick={() => onDistrictFilter?.(null)}
                  className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide"
                  style={{
                    backgroundColor: !activeDistrict ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                    color: '#F5F5F0',
                  }}
                >
                  All
                </button>
                {districtChips.map((district) => (
                  <button
                    key={district}
                    type="button"
                    onClick={() => onDistrictFilter?.(district)}
                    className="rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor:
                        activeDistrict === district ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                      color: '#F5F5F0',
                    }}
                  >
                    {district}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {activeDistrict && (
                <div className="px-4 pt-4">
                  <div
                    className="text-[10px] uppercase tracking-wider font-semibold mb-3"
                    style={{ color: '#94a3b8' }}
                  >
                    {activeDistrict}
                  </div>
                </div>
              )}

              {criticalNotifications.length > 0 && (
                <div className="p-4">
                  <div
                    className="text-[10px] uppercase tracking-wider font-semibold mb-3"
                    style={{ color: '#C0392B' }}
                  >
                    Critical
                  </div>
                  <div className="space-y-2">
                    {criticalNotifications.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        accent="#C0392B"
                        onSelect={onSelectNotification}
                      />
                    ))}
                  </div>
                </div>
              )}

              {warningNotifications.length > 0 && (
                <div className="p-4">
                  <div
                    className="text-[10px] uppercase tracking-wider font-semibold mb-3"
                    style={{ color: '#D97706' }}
                  >
                    Warnings
                  </div>
                  <div className="space-y-2">
                    {warningNotifications.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        accent="#D97706"
                        onSelect={onSelectNotification}
                      />
                    ))}
                  </div>
                </div>
              )}

              {notifications.length === 0 && (
                <div className="flex items-center justify-center h-48">
                  <p className="text-sm text-muted">No alerts</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
