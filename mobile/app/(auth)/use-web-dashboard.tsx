/**
 * Mobile-not-supported notice for supervisors (head / management / admin).
 *
 * The mobile app's surface area is intentionally officer-only — submission,
 * geofence gate, photo capture, offline sync. Supervisory workflows
 * (approval queue, escalations, KPI dashboards, admin CRUD) live on the web
 * dashboard. If a head/management/admin signs in on mobile we land them here
 * with a clear "use the web dashboard" message and a one-tap sign-out.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';

const DASHBOARD_URL =
  process.env.EXPO_PUBLIC_DASHBOARD_URL ?? 'https://vigilance.example.com';

export default function UseWebDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, userName, userRole } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const roleLabel =
    userRole === 'admin'
      ? 'Administrator'
      : userRole === 'management'
      ? 'Management'
      : userRole === 'head'
      ? 'Vigilance Head'
      : 'Supervisor';

  const onOpenDashboard = async () => {
    haptics.tap();
    const supported = await Linking.canOpenURL(DASHBOARD_URL);
    if (supported) Linking.openURL(DASHBOARD_URL);
  };

  const onSignOut = async () => {
    haptics.tap();
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.brand }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 28,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
          justifyContent: 'center',
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="desktop-outline" size={48} color="#ffffff" />
          </View>
          <Text
            style={{
              fontSize: FONT.h1,
              fontWeight: '900',
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            Use the Web Dashboard
          </Text>
          <Text
            style={{
              fontSize: FONT.body,
              color: COLOR.textOnPrimaryMuted,
              marginTop: SPACING.sm,
              fontWeight: '600',
              textAlign: 'center',
            }}
          >
            {userName ? `Signed in as ${userName}` : 'Signed in'} ·{' '}
            {roleLabel}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <Text
            style={{
              fontSize: FONT.bodyLg,
              fontWeight: '800',
              color: COLOR.text,
              marginBottom: SPACING.md,
            }}
          >
            This app is for field officers only.
          </Text>
          <Text
            style={{
              fontSize: FONT.body,
              color: COLOR.textMuted,
              lineHeight: 24,
              marginBottom: SPACING.lg,
            }}
          >
            Inspection approvals, escalation tickets, and management reports
            live on the web dashboard. Open it on your laptop or browser to
            continue.
          </Text>

          <TouchableOpacity
            onPress={onOpenDashboard}
            style={{
              backgroundColor: COLOR.brandStrong,
              borderRadius: RADIUS.lg,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: SPACING.sm,
              marginBottom: SPACING.md,
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open the Vigilance web dashboard"
          >
            <Ionicons name="open-outline" size={22} color="#ffffff" />
            <Text
              style={{
                color: '#ffffff',
                fontSize: FONT.bodyLg,
                fontWeight: '800',
                letterSpacing: 0.5,
              }}
            >
              Open Web Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSignOut}
            disabled={signingOut}
            style={{
              borderRadius: RADIUS.lg,
              minHeight: TOUCH.minHeight,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: SPACING.sm,
              borderWidth: 1.5,
              borderColor: COLOR.border,
              backgroundColor: COLOR.surfaceMuted,
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            {signingOut ? (
              <ActivityIndicator color={COLOR.text} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={22} color={COLOR.text} />
                <Text
                  style={{
                    color: COLOR.text,
                    fontSize: FONT.body,
                    fontWeight: '700',
                  }}
                >
                  Sign Out
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text
          style={{
            textAlign: 'center',
            color: COLOR.textOnPrimaryMuted,
            fontSize: FONT.body,
            marginTop: SPACING.xl,
            fontWeight: '600',
          }}
        >
          Need officer access? Contact your administrator.
        </Text>
      </ScrollView>
    </View>
  );
}
