import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
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
    if (userRole && userRole !== 'officer') {
      router.replace('/(auth)/login');
    }
  }, [user, userRole, loading]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!user || userRole !== 'officer') {
    if (userRole && userRole !== 'officer') {
      return (
        <View className="flex-1 items-center justify-center bg-white px-8">
          <Text className="text-2xl font-bold text-gray-800 mb-3 text-center">
            Web Dashboard Required
          </Text>
          <Text className="text-base text-gray-500 text-center">
            Your role ({userRole}) is managed through the web dashboard. Please use a browser to access your account.
          </Text>
        </View>
      );
    }
    return null;
  }

  return <>{children}</>;
};
