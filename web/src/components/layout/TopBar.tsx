import { Bell } from 'lucide-react';

const BREADCRUMB_TRAIL_STYLE = {
  textShadow:
    '0 0 12px rgba(212, 175, 55, 0.15), 0 0 4px rgba(212, 175, 55, 0.10), 0 0 1px rgba(212, 175, 55, 0.20)',
  transition: 'text-shadow 0.4s ease',
} as const;

interface TopBarProps {
  breadcrumb: string;
  subtitle?: string;
  redAlertCount: number;
  onNotificationClick: () => void;
  sidebarWidth?: number;
}

export function TopBar({
  breadcrumb,
  subtitle,
  redAlertCount,
  onNotificationClick,
  sidebarWidth = 240,
}: TopBarProps) {
  return (
    <div
      className="vms-topbar fixed top-0 right-0 z-30 flex h-20 items-center justify-between border-b px-4 transition-[left] duration-300 sm:px-6"
      style={{
        left: window.innerWidth < 768 ? '0' : sidebarWidth,
      }}
    >
      <div className="min-w-0">
        <div
          className="flex items-center gap-2 text-sm min-w-0"
          data-breadcrumb
          style={BREADCRUMB_TRAIL_STYLE}
        >
          <span className="text-muted shrink-0 hidden sm:inline truncate">{breadcrumb}</span>
        </div>
        {subtitle ? <p className="mt-1 text-xs text-muted truncate">{subtitle}</p> : null}
      </div>

      <button
        type="button"
        onClick={onNotificationClick}
        data-cursor="pointer"
        aria-label={`Notifications${redAlertCount > 0 ? `, ${redAlertCount} critical` : ''}`}
        className="relative p-2 rounded-lg transition-all shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      >
        <Bell className="w-5 h-5 text-text-primary" aria-hidden />

        {redAlertCount > 0 && (
          <div
            className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono px-1.5"
            style={{
              backgroundColor: '#EF4444',
              color: '#F5F5F0',
            }}
          >
            {redAlertCount > 99 ? '99+' : redAlertCount}
          </div>
        )}
      </button>
    </div>
  );
}
