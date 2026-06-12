import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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

const LIVE_SUBTITLE_BASE = 'Live summary of compliance, alerts, and store health.';

const HEADER_SUBTITLES: Record<string, string> = {
  '/dashboard': LIVE_SUBTITLE_BASE,
  '/dashboard/analytics': LIVE_SUBTITLE_BASE,
  '/dashboard/map': LIVE_SUBTITLE_BASE,
  '/dashboard/reports': LIVE_SUBTITLE_BASE,
  '/dashboard/audit-archive': LIVE_SUBTITLE_BASE,
  '/dashboard/archive': LIVE_SUBTITLE_BASE,
  '/dashboard/settings': 'Configure dashboard preferences and workspace behavior.',
};

function CeoShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ReturnType<typeof useCeoDashboard>['alerts'][0] | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [alertDistrictFilter, setAlertDistrictFilter] = useState<string | null>(null);

  const { metrics, alerts, isError, error, refetch } = useCeoDashboard();

  const districtParam = searchParams.get('district');
  const monthParam = searchParams.get('month');
  const baseCrumb = BREADCRUMBS[location.pathname] ?? 'Overview';

  const breadcrumbParts = ['Dashboard', baseCrumb];
  if (location.pathname === '/dashboard/archive' && monthParam && !districtParam) {
    breadcrumbParts.push(monthParam);
  }
  if (districtParam) {
    if (location.pathname === '/dashboard/archive' && monthParam) {
      breadcrumbParts.push(monthParam, districtParam);
    } else {
      breadcrumbParts.push(districtParam);
    }
  }
  const breadcrumb = breadcrumbParts.join(' / ');

  const baseSubtitle = HEADER_SUBTITLES[location.pathname] ?? LIVE_SUBTITLE_BASE;
  const subtitle = districtParam
    ? `Live summary for ${districtParam} — compliance, alerts, and store health.`
    : baseSubtitle;

  const filteredAlertsForDrawer = alertDistrictFilter
    ? alerts.filter((a) => a.district === alertDistrictFilter)
    : alerts;

  const drawerNotifications = filteredAlertsForDrawer.slice(0, 20).map((n) => ({
    id: n.id,
    storeName: n.storeName,
    itemTitle: n.itemTitle,
    time: n.timeAgo,
    risk: n.risk,
    read: readIds.has(n.id),
    district: n.district,
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
        districtChips={Array.from(new Set(alerts.map((a) => a.district))).sort()}
        activeDistrict={alertDistrictFilter}
        onDistrictFilter={setAlertDistrictFilter}
        onMarkAllRead={() => setReadIds(new Set(alerts.map((n) => n.id)))}
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
