import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';
import { peekQueue } from '../../lib/syncQueue';

interface AssignmentRow {
  branch_name: string;
  city: string | null;
  region: string | null;
  branch_type: { type_name: string } | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, userName, profilePhotoUrl, userRole, userRolesId, signOut, refreshProfile } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [displayName, setDisplayName] = useState(userName || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setDisplayName(userName || '');
  }, [userName]);

  const { data: queueCount = 0 } = useQuery({
    queryKey: ['profile-queue-size'],
    queryFn: async () => (await peekQueue()).length,
    staleTime: 10_000,
  });

  // Officer's branch assignments are inferred from recent inspections — the
  // current schema doesn't have a dedicated officer_branches table.
  const { data: assignments = [] } = useQuery<AssignmentRow[]>({
    queryKey: ['profile-assignments', userRolesId],
    enabled: !!userRolesId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select(
          `
          branch:branches!inspections_branch_id_fkey (
            branch_name, city, region,
            branch_type:branch_types!branches_branch_type_id_fkey ( type_name )
          )
        `,
        )
        .eq('officer_id', userRolesId!)
        .order('inspection_date', { ascending: false })
        .limit(20);
      if (error) throw error;
      // supabase-js infers nested joins as arrays even when they're 1-to-1,
      // so we narrow via `unknown` then handle either shape.
      const rows = ((data ?? []) as unknown) as Array<{
        branch: AssignmentRow | AssignmentRow[] | null;
      }>;
      const seen = new Set<string>();
      const out: AssignmentRow[] = [];
      for (const row of rows) {
        const b = Array.isArray(row.branch) ? row.branch[0] : row.branch;
        if (!b || seen.has(b.branch_name)) continue;
        seen.add(b.branch_name);
        out.push(b);
        if (out.length >= 6) break;
      }
      return out;
    },
  });

  const handleSignOut = async () => {
    setSigningOut(true);
    haptics.medium();
    try {
      await signOut();
      router.replace('/(auth)/login');
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
    }
  };

  const saveDisplayName = async () => {
    const cleanName = displayName.trim();
    if (!cleanName || !userRolesId) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ name: cleanName })
        .eq('id', userRolesId);
      if (error) throw error;
      await refreshProfile();
      Alert.alert('Profile Updated', 'Your display name has been saved.');
    } catch (error: any) {
      Alert.alert('Update Failed', error?.message ?? 'Could not update your profile name.');
    } finally {
      setSavingProfile(false);
    }
  };

  const pickProfilePhoto = async () => {
    if (!userRolesId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Required', 'Photo library access is required to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const ext = asset.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${userRolesId}/profile_${Date.now()}.${ext}`;
      const blob = await (await fetch(asset.uri)).blob();
      const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, blob, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({ profile_photo_url: data.publicUrl })
        .eq('id', userRolesId);
      if (updateError) throw updateError;

      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Upload Failed', error?.message ?? 'Could not update your profile picture.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.back();
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={COLOR.textOnPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: insets.bottom + SPACING.xl,
        }}
      >
        {/* Identity card */}
        <View style={styles.identityCard}>
          <TouchableOpacity
            onPress={pickProfilePhoto}
            disabled={uploadingPhoto}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            style={styles.avatar}
          >
            {profilePhotoUrl ? (
              <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(userName || 'V').slice(0, 1).toUpperCase()}
              </Text>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera-outline" size={14} color="#fff" />
              )}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Officer name"
              placeholderTextColor="#94a3b8"
              style={styles.nameInput}
            />
            <Text style={styles.identityRole}>
              {userRole ? userRole.toUpperCase() : 'OFFICER'}
            </Text>
            <Text style={styles.identityEmail}>{user?.email ?? '—'}</Text>
            <TouchableOpacity
              onPress={saveDisplayName}
              disabled={savingProfile || displayName.trim() === (userName || '').trim()}
              style={[
                styles.saveProfileButton,
                (savingProfile || displayName.trim() === (userName || '').trim()) && styles.saveProfileButtonDisabled,
              ]}
            >
              {savingProfile ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveProfileText}>Save Profile</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent branches */}
        <Text style={styles.sectionTitle}>Recent branches</Text>
        {assignments.length === 0 ? (
          <Text style={styles.muted}>No branch history yet.</Text>
        ) : (
          assignments.map((a: AssignmentRow) => (
            <View key={a.branch_name} style={styles.assignmentRow}>
              <Ionicons
                name="storefront-outline"
                size={22}
                color={COLOR.brand}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentName}>{a.branch_name}</Text>
                <Text style={styles.assignmentMeta}>
                  {[a.branch_type?.type_name, a.city, a.region]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Sync status */}
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.syncRow}>
          <Ionicons
            name={queueCount > 0 ? 'cloud-offline-outline' : 'cloud-done-outline'}
            size={22}
            color={queueCount > 0 ? COLOR.warning : COLOR.success}
          />
          <Text style={styles.syncText}>
            {queueCount > 0
              ? `${queueCount} submission${queueCount === 1 ? '' : 's'} pending — will sync on reconnect.`
              : 'All your submissions are synced.'}
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={() => {
            haptics.warning();
            setConfirmOpen(true);
          }}
          style={styles.signOutButton}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={22} color={COLOR.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Confirmation modal */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>
              You'll need to enter your email and password again. Any drafts
              are saved on this device.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setConfirmOpen(false)}
                style={[styles.modalButton, styles.modalCancel]}
                accessibilityRole="button"
                accessibilityLabel="Cancel sign out"
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSignOut}
                disabled={signingOut}
                style={[styles.modalButton, styles.modalConfirm]}
                accessibilityRole="button"
                accessibilityLabel="Confirm sign out"
              >
                {signingOut ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Sign Out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = {
  header: {
    backgroundColor: COLOR.brand,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as const,
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH.minHeight,
    paddingHorizontal: SPACING.sm,
    gap: SPACING.xs,
  } as const,
  backText: {
    color: COLOR.textOnPrimary,
    fontSize: FONT.body,
    fontWeight: '600',
  } as const,
  headerTitle: {
    color: COLOR.textOnPrimary,
    fontSize: FONT.h1,
    fontWeight: '800',
  } as const,
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    marginBottom: SPACING.xl,
  } as const,
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLOR.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  } as const,
  avatarImage: {
    width: 64,
    height: 64,
  } as const,
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  } as const,
  avatarText: {
    color: '#fff',
    fontSize: FONT.h1,
    fontWeight: '900',
  } as const,
  identityName: {
    fontSize: FONT.h1,
    fontWeight: '800',
    color: COLOR.text,
  } as const,
  fieldLabel: {
    fontSize: FONT.xs,
    fontWeight: '800',
    color: COLOR.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  } as const,
  nameInput: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    paddingVertical: 4,
    marginTop: 2,
  } as const,
  identityRole: {
    fontSize: FONT.xs,
    fontWeight: '800',
    color: COLOR.brand,
    letterSpacing: 0.6,
    marginTop: 2,
  } as const,
  identityEmail: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginTop: SPACING.xs,
  } as const,
  saveProfileButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.md,
    backgroundColor: COLOR.brand,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  } as const,
  saveProfileButtonDisabled: {
    opacity: 0.45,
  } as const,
  saveProfileText: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '800',
  } as const,
  sectionTitle: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  } as const,
  muted: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
  } as const,
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: SPACING.md,
    minHeight: TOUCH.rowHeight,
    marginBottom: SPACING.sm,
  } as const,
  assignmentName: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLOR.text,
  } as const,
  assignmentMeta: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginTop: 2,
  } as const,
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: SPACING.md,
    minHeight: TOUCH.rowHeight,
    marginBottom: SPACING.xl,
  } as const,
  syncText: {
    flex: 1,
    fontSize: FONT.body,
    color: COLOR.text,
    lineHeight: 22,
  } as const,
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.minHeight,
    borderRadius: RADIUS.lg,
    backgroundColor: COLOR.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: SPACING.md,
  } as const,
  signOutText: {
    fontSize: FONT.body,
    fontWeight: '800',
    color: COLOR.danger,
  } as const,
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  } as const,
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
  } as const,
  modalTitle: {
    fontSize: FONT.h1,
    fontWeight: '800',
    color: COLOR.text,
    marginBottom: SPACING.sm,
  } as const,
  modalBody: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  } as const,
  modalActions: { flexDirection: 'row', gap: SPACING.sm } as const,
  modalButton: {
    flex: 1,
    minHeight: TOUCH.minHeight,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  modalCancel: {
    backgroundColor: COLOR.surfaceMuted,
    borderWidth: 1,
    borderColor: COLOR.border,
  } as const,
  modalCancelText: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLOR.text,
  } as const,
  modalConfirm: {
    backgroundColor: COLOR.danger,
  } as const,
  modalConfirmText: {
    fontSize: FONT.body,
    fontWeight: '800',
    color: '#fff',
  } as const,
};
