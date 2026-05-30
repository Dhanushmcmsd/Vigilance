import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { AuditScreenHeader } from '../../components/audit/AuditScreenHeader';
import { AUDIT } from '../../lib/auditTheme';
import { COLOR, FONT, RADIUS, SPACING } from '../../lib/a11y';

export default function AuditProfileScreen() {
  const router = useRouter();
  const { user, userName, userRole, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = () => {
    Alert.alert('Sign out', 'Leave the audit app?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          setSigningOut(false);
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg }}>
      <AuditScreenHeader
        eyebrow="VIGILANCE · AUDIT"
        title="Profile"
        subtitle="Read-only access to submitted inspections"
      />

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: AUDIT.surface,
            borderRadius: RADIUS.xl,
            padding: SPACING.lg,
            borderWidth: 1,
            borderColor: AUDIT.border,
            marginBottom: SPACING.lg,
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              backgroundColor: AUDIT.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: SPACING.md,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={36} color={AUDIT.accent} />
          </View>
          <Text style={{ fontSize: FONT.h1, fontWeight: '800', color: COLOR.text }}>{userName || 'Audit Reviewer'}</Text>
          <Text style={{ fontSize: FONT.body, color: COLOR.textMuted, marginTop: 4 }}>
            {user?.email ?? 'audit@company.app'}
          </Text>
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: SPACING.md,
              backgroundColor: AUDIT.accentSoft,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: RADIUS.md,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f766e', textTransform: 'uppercase' }}>
              {userRole ?? 'audit'} · mobile only
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: AUDIT.surface,
            borderRadius: RADIUS.xl,
            padding: SPACING.lg,
            borderWidth: 1,
            borderColor: AUDIT.border,
            marginBottom: SPACING.lg,
          }}
        >
          <Text style={{ fontSize: FONT.body, fontWeight: '800', color: COLOR.text, marginBottom: SPACING.sm }}>
            What you can do
          </Text>
          <Text style={{ fontSize: FONT.body, color: COLOR.textMuted, lineHeight: 22 }}>
            Browse all Ideal Store submissions, open daily checklist PDFs, and review monthly archives. You cannot
            edit inspections or submit new checklists.
          </Text>
        </View>

        <TouchableOpacity
          onPress={onSignOut}
          disabled={signingOut}
          style={{
            backgroundColor: '#fef2f2',
            borderRadius: RADIUS.lg,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            borderWidth: 1,
            borderColor: '#fecaca',
          }}
        >
          {signingOut ? (
            <ActivityIndicator color={AUDIT.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={22} color={AUDIT.danger} />
              <Text style={{ color: AUDIT.danger, fontSize: FONT.body, fontWeight: '800' }}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
