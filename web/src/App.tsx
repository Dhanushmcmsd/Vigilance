import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import HeadDashboard from './pages/HeadDashboard';
import HeadReview from './pages/HeadReview';
import ManagementDashboard from './pages/ManagementDashboard';
import AdminPanel from './pages/AdminPanel';
import MapView from './pages/MapView'; // Phase 6 scaffold
import Layout from './components/Layout';
import { useEffect } from 'react';
import { setupRealtimeSubscription, teardownRealtimeSubscription } from './lib/queryClient';

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
      {/* Phase 6 scaffold — registered but not in sidebar nav yet */}
      {/* FUTURE: Map View — add to sidebar when ready */}
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
