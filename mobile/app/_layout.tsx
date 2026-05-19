import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from '../context/AuthContext';
import { queryClient } from '../lib/queryClient';
import { useNetworkSync } from '../lib/useNetworkSync';
import { useOtaUpdates } from '../lib/useOtaUpdates';

function NetworkSyncMount() {
  useNetworkSync();
  useOtaUpdates();
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NetworkSyncMount />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(officer)" />
            <Stack.Screen name="(audit)" />
          </Stack>
          <StatusBar style="auto" />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
