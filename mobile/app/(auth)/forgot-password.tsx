import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';

/**
 * Self-service email password reset is disabled.
 * Officers receive credentials from an administrator.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: COLOR.brand }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: SPACING.xl,
          paddingTop: insets.top + SPACING.xl,
          paddingBottom: insets.bottom + SPACING.xl,
        }}
      >
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backRow}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: SPACING.xl }}>
          <View style={styles.iconCircle}>
            <Ionicons name="people-outline" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Password reset</Text>
          <Text style={styles.subtitle}>
            Contact your Vigilance administrator to reset your password. Self-service email reset is not enabled for this app.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.body}>
            Your administrator can set a new password when creating or updating your account. If you do not have an account yet, ask your admin to provision one.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={[styles.submit, { marginTop: SPACING.lg }]}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
          >
            <Text style={styles.submitText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = {
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.minHeight,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.lg,
  } as const,
  backText: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '700',
  } as const,
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  } as const,
  title: {
    fontSize: FONT.h1,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  } as const,
  subtitle: {
    fontSize: FONT.body,
    color: COLOR.textOnPrimaryMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
    maxWidth: 320,
  } as const,
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  } as const,
  body: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    lineHeight: 22,
    textAlign: 'center',
  } as const,
  submit: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.brandStrong,
  } as const,
  submitText: {
    color: '#fff',
    fontSize: FONT.bodyLg,
    fontWeight: '800',
  } as const,
};
