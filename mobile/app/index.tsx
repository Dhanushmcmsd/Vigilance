import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { AUDIT } from '../lib/auditTheme';

/**
 * Root entry — sends authenticated users to the correct mobile flow by role.
 * Audit users must never land on the officer or web-dashboard screens.
 */
export default function AppIndex() {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (userRole === 'audit') {
      router.replace('/(audit)');
      return;
    }
    if (userRole === 'officer') {
      router.replace('/(officer)');
      return;
    }
    if (userRole === 'management' || userRole === 'admin') {
      router.replace('/(auth)/use-web-dashboard');
      return;
    }
    router.replace('/(auth)/login');
  }, [user, userRole, loading, router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: AUDIT.bg }}>
      <ActivityIndicator size="large" color={AUDIT.accent} />
    </View>
  );
}
