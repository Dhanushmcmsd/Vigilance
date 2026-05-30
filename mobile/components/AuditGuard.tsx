import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

export const AuditGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (userRole && userRole !== 'audit') {
      if (userRole === 'officer') {
        router.replace('/(officer)');
      } else {
        router.replace('/(auth)/use-web-dashboard');
      }
    }
  }, [user, userRole, loading, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!user || userRole !== 'audit') return null;
  return <>{children}</>;
};
