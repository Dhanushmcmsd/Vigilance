import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CursorProvider } from '../../components/cursor/CursorProvider';
import { Sidebar } from '../../components/layout/Sidebar';
import { TopBar } from '../../components/layout/TopBar';
import { NotificationDrawer } from '../../components/layout/NotificationDrawer';
import { AlertDetailPanel } from '../../components/dashboard/AlertDetailPanel';
import { CeoDashboardProvider, useCeoDashboard } from '../../context/CeoDashboardContext';

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/map': 'Store Map',
  '/dashboard/audit-archive': 'Vigilance Report',
  '/dashboard/archive': 'Monthly Archive',
  '/dashboard/reports': 'Reports',
  '/dashboard/settings': 'Settings',
};

const HEADER_SUBTITLES: Record<string, string> = {
  '/dashboard': 'Live summary of compliance, alerts, and store health.',
  '/dashboard/analytics': 'Performance trends and risk distribution across stores.',
  '/dashboard/map': 'Geographic view of store compliance and risk density.',
  '/dashboard/reports': 'Monthly and custom exports for management reporting.',
  '/dashboard/audit-archive': 'Audit archive and management reports from field inspections.',
  '/dashboard/archive': 'Historical monthly compliance records.',
  '/dashboard/settings': 'Configure dashboard preferences and workspace behavior.',
};

function CeoShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ReturnType<typeof useCeoDashboard>['alerts'][0] | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const { metrics, alerts, notifications, isError, error, refetch } = useCeoDashboard();

  const breadcrumb = BREADCRUMBS[location.pathname] ?? 'Overview';
  const subtitle = HEADER_SUBTITLES[location.pathname] ?? 'Operational intelligence for field compliance.';

  const drawerNotifications = notifications.map((n) => ({
    ...n,
    read: readIds.has(n.id),
  }));

  return (
    <div style={{ backgroundColor: '#0A0A0F', minHeight: '100vh' }}>
      <Sidebar onWidthChange={setSidebarWidth} />
      <TopBar
        breadcrumb={breadcrumb}
        subtitle={subtitle}
        redAlertCount={metrics.openRedFlags}
        onNotificationClick={() => setNotificationDrawerOpen(true)}
        sidebarWidth={sidebarWidth}
      />

      <main
        className="pt-24 px-4 sm:px-6 lg:px-8 pb-10 transition-[margin-left] duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        {isError && (
          <div
            className="mb-6 rounded-lg border px-4 py-3 text-sm"
            style={{
              borderColor: 'rgba(192,57,43,0.4)',
              backgroundColor: 'rgba(192,57,43,0.08)',
              color: '#F5F5F0',
            }}
            role="alert"
          >
            <p className="font-semibold">Could not load dashboard data</p>
            <p className="mt-1 opacity-80">
              {error?.message ?? 'The inspections query failed. Check your connection and try again.'}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{ backgroundColor: '#C0392B', color: '#fff' }}
            >
              Retry
            </button>
          </div>
        )}

        <Outlet context={{ setSelectedAlert, navigate }} />
      </main>

      <NotificationDrawer
        open={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        notifications={drawerNotifications}
        onMarkAllRead={() => setReadIds(new Set(notifications.map((n) => n.id)))}
        onSelectNotification={(id) => {
          const match = alerts.find((a) => a.id === id);
          if (match) setSelectedAlert(match);
          setNotificationDrawerOpen(false);
        }}
      />

      <AlertDetailPanel alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
    </div>
  );
}

export type CeoOutletContext = {
  setSelectedAlert: (alert: ReturnType<typeof useCeoDashboard>['alerts'][0] | null) => void;
  navigate: ReturnType<typeof useNavigate>;
};

export default function CeoDashboardLayout() {
  return (
    <CursorProvider>
      <CeoDashboardProvider>
        <CeoShell />
      </CeoDashboardProvider>
    </CursorProvider>
  );
}
