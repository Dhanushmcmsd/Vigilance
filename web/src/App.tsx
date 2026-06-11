import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Smartphone } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import { homePathForRole } from './lib/roleRoutes';
import { AuthenticatedRealtime } from './components/AuthenticatedRealtime';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import TermsOfService from './pages/legal/TermsOfService';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import AcceptableUse from './pages/legal/AcceptableUse';
import { PolicyGate } from './components/legal/PolicyGate';

// Lazy-load heavy dashboard pages so they split into separate chunks
const HeadDashboard = lazy(() => import('./pages/HeadDashboard'));
const HeadReview = lazy(() => import('./pages/HeadReview'));
const CeoDashboard = lazy(() => import('./pages/CeoDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AuditArchive = lazy(() => import('./pages/AuditArchive'));

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 gap-4">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-800 border-t-brand-500" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
    </div>
  );
}

type AllowedRole = 'head' | 'management' | 'admin' | 'officer' | 'audit';

function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: AllowedRole[];
}) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === 'admin' && (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/head'))) {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'officer') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-7 h-7 text-brand-600 dark:text-brand-400" aria-hidden />
          </div>
          <h2 className="text-xl font-semibold mb-2">Mobile App Required</h2>
          <p className="text-gray-500">Please use the mobile app to submit inspections.</p>
        </div>
      </div>
    );
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** Unknown paths: send guests to login, signed-in users to their home dashboard. */
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
          path="/head"
          element={
            <RoleGuard allowedRoles={['head']}>
              <Layout><HeadDashboard /></Layout>
            </RoleGuard>
          }
        />
        <Route
          path="/head/review"
          element={
            <RoleGuard allowedRoles={['head']}>
              <Layout><HeadReview /></Layout>
            </RoleGuard>
          }
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
          path="/head/archive"
          element={
            <RoleGuard allowedRoles={['head']}>
              <Layout><AuditArchive backPath="/head" backLabel="Back to head dashboard" /></Layout>
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
