import { Navigate, useLocation } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type AllowedRole = 'management' | 'admin' | 'officer' | 'audit';

export default function RoleGuard({
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

  if (role === 'admin' && location.pathname.startsWith('/dashboard')) {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'officer' && !allowedRoles.includes('officer')) {
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
