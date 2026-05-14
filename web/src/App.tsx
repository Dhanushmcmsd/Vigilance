import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import { setupRealtimeSubscription, teardownRealtimeSubscription } from './lib/queryClient';

// Lazy-load heavy dashboard pages so they split into separate chunks
const HeadDashboard = lazy(() => import('./pages/HeadDashboard'));
const HeadReview = lazy(() => import('./pages/HeadReview'));
const ManagementDashboard = lazy(() => import('./pages/ManagementDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const MapView = lazy(() => import('./pages/MapView'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
    </div>
  );
}

type AllowedRole = 'head' | 'management' | 'admin' | 'officer';

function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: AllowedRole[];
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === 'officer') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-8 text-center max-w-sm">
          <div className="text-4xl mb-4">📱</div>
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

function AppRoutes() {
  useEffect(() => {
    setupRealtimeSubscription();
    return () => {
      teardownRealtimeSubscription();
    };
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
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
          path="/management"
          element={
            <RoleGuard allowedRoles={['management', 'admin']}>
              <Layout><ManagementDashboard /></Layout>
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
        <Route
          path="/map"
          element={
            <RoleGuard allowedRoles={['management', 'admin']}>
              <Layout><MapView /></Layout>
            </RoleGuard>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
