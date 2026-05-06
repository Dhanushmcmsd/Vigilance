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
      showError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      showError('Invalid email or password. Please try again.');
      return;
    }
    router.replace('/(officer)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#1e40af' }}
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
          <Text style={{ fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>
            Vigilance
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
            Field Officer Portal
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
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 24 }}>
            Sign In
          </Text>

          {/* Email */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor="#9ca3af"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1.5,
              borderColor: '#e5e7eb',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontSize: 16,
              color: '#1f2937',
              marginBottom: 16,
              minHeight: 52,
              backgroundColor: '#f9fafb',
            }}
          />

          {/* Password */}
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Password</Text>
          <View style={{ position: 'relative', marginBottom: 24 }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              style={{
                borderWidth: 1.5,
                borderColor: '#e5e7eb',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingRight: 52,
                paddingVertical: 14,
                fontSize: 16,
                color: '#1f2937',
                minHeight: 52,
                backgroundColor: '#f9fafb',
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 14, top: 14 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#93c5fd' : '#2563eb',
              borderRadius: 14,
              minHeight: 54,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#2563eb',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 }}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 32 }}>
          Vigilance Management System v1.0
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
