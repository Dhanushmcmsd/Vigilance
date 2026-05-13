import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../../lib/supabase';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';
import { ToastMessage } from '../../components/ToastMessage';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'error' | 'success' | 'warning';
  }>({ visible: false, message: '', type: 'error' });

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      haptics.warning();
      setToast({
        visible: true,
        message: 'Please enter a valid email address.',
        type: 'error',
      });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: 'vigilancems://reset-password',
    });
    setLoading(false);
    if (error) {
      haptics.error();
      setToast({
        visible: true,
        message: 'Could not send the reset email. Please try again later.',
        type: 'error',
      });
      return;
    }
    haptics.success();
    setSent(true);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: COLOR.brand }}
    >
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((p) => ({ ...p, visible: false }))}
      />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: SPACING.xl,
          paddingTop: insets.top + SPACING.xl,
          paddingBottom: insets.bottom + SPACING.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back */}
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

        {/* Hero */}
        <View style={{ alignItems: 'center', marginBottom: SPACING.xl }}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-open-outline" size={36} color="#fff" />
          </View>
          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter the email tied to your officer account. We'll send you a
            secure link to set a new password.
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {sent ? (
            <View style={{ alignItems: 'center', paddingVertical: SPACING.lg }}>
              <Ionicons
                name="checkmark-circle"
                size={56}
                color={COLOR.success}
              />
              <Text style={styles.sentTitle}>Check your email</Text>
              <Text style={styles.sentBody}>
                If <Text style={{ fontWeight: '800' }}>{email}</Text> belongs to
                a Vigilance account, the reset link is on its way. Open it on
                this device to set a new password.
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
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
                accessibilityLabel="Email address"
              />
              <TouchableOpacity
                onPress={submit}
                disabled={loading}
                style={[
                  styles.submit,
                  { backgroundColor: loading ? '#93c5fd' : COLOR.brandStrong },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send reset link"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Send reset link</Text>
                )}
              </TouchableOpacity>
            </>
          )}
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
  label: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLOR.textMuted,
    marginBottom: SPACING.xs,
  } as const,
  input: {
    minHeight: TOUCH.minHeight,
    borderWidth: 1.5,
    borderColor: COLOR.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT.body,
    color: COLOR.text,
    backgroundColor: COLOR.surfaceMuted,
    marginBottom: SPACING.lg,
  } as const,
  submit: {
    minHeight: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  submitText: {
    color: '#fff',
    fontSize: FONT.bodyLg,
    fontWeight: '800',
  } as const,
  sentTitle: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    marginTop: SPACING.md,
  } as const,
  sentBody: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  } as const,
};
