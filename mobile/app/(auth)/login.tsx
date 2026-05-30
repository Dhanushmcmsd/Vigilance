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
import { useAuth } from '../../context/AuthContext';
import { ToastMessage } from '../../components/ToastMessage';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'error' | 'success' | 'warning' }>({
    visible: false,
    message: '',
    type: 'error',
  });

  const showError = (message: string) => setToast({ visible: true, message, type: 'error' });

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      haptics.warning();
      showError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error, role } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      haptics.error();
      showError('Invalid email or password. Please try again.');
      return;
    }
    haptics.success();
    // The mobile app is officer-only. Heads, management, and admins authenticate
    // through the web dashboard. We still sign them in so the auth session is
    // valid (in case they want to sign out cleanly), but route them to a notice
    // screen instead of the officer flow.
    if (role === 'officer') {
      router.replace('/(officer)');
    } else if (role === 'audit') {
      router.replace('/(audit)');
    } else if (role === 'head' || role === 'management' || role === 'admin') {
      router.replace('/(auth)/use-web-dashboard');
    } else {
      showError('Your account has no active role. Contact the administrator.');
    }
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
          paddingHorizontal: 28,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 2 }}>VMS</Text>
          </View>
          <Text style={{ fontSize: FONT.display, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }}>
            Vigilance
          </Text>
          <Text style={{ fontSize: FONT.body, color: COLOR.textOnPrimaryMuted, marginTop: 6, fontWeight: '600' }}>
            Field officer & audit (mobile)
          </Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 8, textAlign: 'center' }}>
            officer@example.com · audit@example.com
          </Text>
        </View>

        {/* Form Card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <Text style={{ fontSize: FONT.h1, fontWeight: '800', color: COLOR.text, marginBottom: SPACING.lg }}>
            Sign In
          </Text>

          {/* Email */}
          <Text style={{ fontSize: FONT.body, fontWeight: '700', color: COLOR.textMuted, marginBottom: SPACING.xs }}>
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email address"
            style={{
              borderWidth: 1.5,
              borderColor: COLOR.border,
              borderRadius: RADIUS.md,
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.md,
              fontSize: FONT.body,
              color: COLOR.text,
              marginBottom: SPACING.md,
              minHeight: TOUCH.minHeight,
              backgroundColor: COLOR.surfaceMuted,
            }}
          />

          {/* Password */}
          <Text style={{ fontSize: FONT.body, fontWeight: '700', color: COLOR.textMuted, marginBottom: SPACING.xs }}>
            Password
          </Text>
          <View style={{ position: 'relative', marginBottom: SPACING.md }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              accessibilityLabel="Password"
              style={{
                borderWidth: 1.5,
                borderColor: COLOR.border,
                borderRadius: RADIUS.md,
                paddingHorizontal: SPACING.lg,
                paddingRight: 64,
                paddingVertical: SPACING.md,
                fontSize: FONT.body,
                color: COLOR.text,
                minHeight: TOUCH.minHeight,
                backgroundColor: COLOR.surfaceMuted,
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: TOUCH.minHeight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={COLOR.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            accessibilityRole="link"
            accessibilityLabel="Forgot password?"
            style={{ alignSelf: 'flex-end', minHeight: TOUCH.minHeight, justifyContent: 'center', marginBottom: SPACING.sm }}
          >
            <Text style={{ color: COLOR.brandStrong, fontSize: FONT.body, fontWeight: '700' }}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#93c5fd' : COLOR.brandStrong,
              borderRadius: RADIUS.lg,
              minHeight: 56,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: SPACING.sm,
              shadowColor: COLOR.brandStrong,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={22} color="#fff" />
                <Text style={{ color: '#fff', fontSize: FONT.bodyLg, fontWeight: '800', letterSpacing: 0.5 }}>
                  Sign In
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', color: COLOR.textOnPrimaryMuted, fontSize: FONT.body, marginTop: SPACING.xl, fontWeight: '600' }}>
          Vigilance Management System v1.0
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
