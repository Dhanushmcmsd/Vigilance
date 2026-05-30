import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuditGuard } from '../../components/AuditGuard';
import { AUDIT } from '../../lib/auditTheme';

export default function AuditLayout() {
  const insets = useSafeAreaInsets();

  return (
    <AuditGuard>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: AUDIT.tabBar,
            borderTopWidth: 0,
            height: 64 + (Platform.OS === 'ios' ? insets.bottom : 0),
            paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
            paddingTop: 8,
            elevation: 20,
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowOffset: { width: 0, height: -4 },
            shadowRadius: 12,
          },
          tabBarActiveTintColor: AUDIT.accentBright,
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Stores',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="storefront-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="store-reports" options={{ href: null }} />
        <Tabs.Screen name="month-archive" options={{ href: null }} />
        <Tabs.Screen name="report-detail" options={{ href: null }} />
      </Tabs>
    </AuditGuard>
  );
}
