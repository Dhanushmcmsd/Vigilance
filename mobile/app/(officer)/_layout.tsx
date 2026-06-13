import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthGuard } from '../../components/AuthGuard';
import { DistrictAssignmentModal } from '../../components/DistrictAssignmentModal';

const TAB_ACTIVE = '#2dd4bf';
const TAB_INACTIVE = '#64748b';

function tabIcon(
  focusedName: ComponentProps<typeof Ionicons>['name'],
  outlineName: ComponentProps<typeof Ionicons>['name'],
) {  return ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : outlineName} size={size} color={color} />
  );
}

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
          tabBarActiveTintColor: TAB_ACTIVE,
          tabBarInactiveTintColor: TAB_INACTIVE,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Stores',
            tabBarIcon: tabIcon('storefront', 'storefront-outline'),
          }}
        />
        <Tabs.Screen
          name="drafts"
          options={{
            title: 'Drafts',
            tabBarIcon: tabIcon('document-text', 'document-text-outline'),
          }}
        />
        <Tabs.Screen
          name="submissions"
          options={{
            title: 'Submissions',
            tabBarIcon: tabIcon('checkmark-done', 'checkmark-done-outline'),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: tabIcon('person', 'person-outline'),
          }}
        />
        <Tabs.Screen name="select-branch" options={{ href: null }} />
        <Tabs.Screen name="checklist" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="confirm" options={{ href: null }} />
      </Tabs>
    </AuthGuard>
  );
}
