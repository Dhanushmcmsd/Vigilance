import { Bell } from 'lucide-react';

interface TopBarProps {
  breadcrumb: string;
  redAlertCount: number;
  onNotificationClick: () => void;
  sidebarWidth?: number;
}

export function TopBar({
  breadcrumb,
  redAlertCount,
  onNotificationClick,
  sidebarWidth = 240,
}: TopBarProps) {
  return (
    <div
      className="fixed top-0 right-0 h-16 flex items-center justify-between px-4 sm:px-6 border-b z-30 transition-[left] duration-300"
      style={{
        backgroundColor: '#111118',
        borderColor: 'rgba(255,255,255,0.07)',
        left: window.innerWidth < 768 ? '0' : sidebarWidth,
      }}
    >
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-muted shrink-0 hidden sm:inline">Dashboard</span>
        <span className="text-muted shrink-0 hidden sm:inline">/</span>
        <span className="text-text-primary font-medium truncate">{breadcrumb}</span>
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
