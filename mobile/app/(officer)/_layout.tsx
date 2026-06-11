import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGuard } from '../../components/AuthGuard';
import { DistrictAssignmentModal } from '../../components/DistrictAssignmentModal';

export default function OfficerLayout() {
  const insets = useSafeAreaInsets();

  return (
    <AuthGuard>
      <DistrictAssignmentModal />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0f172a',
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
          tabBarActiveTintColor: '#2dd4bf',
          tabBarInactiveTintColor: '#64748b',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Stores',
            tabBarIcon: ({ color, size }) => <Ionicons name="storefront-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="drafts"
          options={{
            title: 'Drafts',
            tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="submissions"
          options={{
            title: 'Submissions',
            tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="select-branch" options={{ href: null }} />
        <Tabs.Screen name="checklist" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="confirm" options={{ href: null }} />
        <Tabs.Screen name="submission-detail" options={{ href: null }} />
      </Tabs>
    </AuthGuard>
  );
}
