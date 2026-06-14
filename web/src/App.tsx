import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import RoleGuard from './components/RoleGuard';
import { homePathForRole } from './lib/roleRoutes';
import { AuthenticatedRealtime } from './components/AuthenticatedRealtime';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import AcceptableUse from './pages/legal/AcceptableUse';
import { PolicyGate } from './components/legal/PolicyGate';

const CeoDashboard = lazy(() => import('./pages/CeoDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-800 border-t-brand-500" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
    </div>
  );
}

function HomeRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;

  const home = homePathForRole(role);
  if (home) return <Navigate to={home} replace />;

  return <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthenticatedRealtime />
      <PolicyGate>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/legal/terms" element={<TermsOfService />} />
        <Route path="/legal/privacy" element={<PrivacyPolicy />} />
        <Route path="/legal/acceptable-use" element={<AcceptableUse />} />
        <Route
          path="/head/*"
          element={<Navigate to="/login" replace />}
        />
        <Route
          path="/dashboard/*"
          element={
            <RoleGuard allowedRoles={['management', 'audit']}>
              <CeoDashboard />
            </RoleGuard>
          }
        />
        <Route
          path="/management/audit-archive"
          element={
            <RoleGuard allowedRoles={['management', 'audit']}>
              <Navigate to="/dashboard/audit-archive" replace />
            </RoleGuard>
          }
        />
        <Route
          path="/management/archive"
          element={
            <RoleGuard allowedRoles={['management', 'audit']}>
              <Navigate to="/dashboard/archive" replace />
            </RoleGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <Layout><AdminPanel /></Layout>
            </RoleGuard>
          }
        />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      </PolicyGate>
    </Suspense>
  );
}

export default function App() {
  return (
    <RouteErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </RouteErrorBoundary>
  );
}
