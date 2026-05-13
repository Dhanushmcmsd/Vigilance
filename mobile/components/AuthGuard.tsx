import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    // Already authenticated but not an officer — show the "use the web
    // dashboard" notice rather than bouncing back to the login form
    // (which would just sit there with their session already valid).
    if (userRole && userRole !== 'officer') {
      router.replace('/(auth)/use-web-dashboard');
    }
  }, [user, userRole, loading, router]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // While the useEffect-driven redirect is in flight, render nothing rather
  // than a flash of the inline notice. The dedicated screen handles the UX.
  if (!user || userRole !== 'officer') return null;

  return <>{children}</>;
};
