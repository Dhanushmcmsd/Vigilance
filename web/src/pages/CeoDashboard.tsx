import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CeoDashboardLayout from './ceo/CeoDashboardLayout';
import CeoOverviewPage from './ceo/CeoOverviewPage';
import CeoAnalyticsPage from './ceo/CeoAnalyticsPage';
import CeoAlertsPage from './ceo/CeoAlertsPage';
import CeoMapPage from './ceo/CeoMapPage';
import CeoReportsPage from './ceo/CeoReportsPage';
import CeoSettingsPage from './ceo/CeoSettingsPage';

const ManagementArchive = lazy(() => import('./ManagementArchive'));
const AuditArchive = lazy(() => import('./AuditArchive'));

/** CEO / management dashboard with nested routes. */
export default function CeoDashboard() {
  return (
    <Routes>
      <Route element={<CeoDashboardLayout />}>
        <Route index element={<CeoOverviewPage />} />
        <Route path="analytics" element={<CeoAnalyticsPage />} />
        <Route path="alerts" element={<CeoAlertsPage />} />
        <Route path="map" element={<CeoMapPage />} />
        <Route path="reports" element={<CeoReportsPage />} />
        <Route path="archive" element={<ManagementArchive />} />
        <Route path="audit-archive" element={<AuditArchive backPath="/dashboard" backLabel="Back to dashboard" />} />
        <Route path="settings" element={<CeoSettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
