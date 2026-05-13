import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { getAllDrafts } from '../../lib/storage';
import { peekQueue } from '../../lib/syncQueue';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const dateStr = (): string =>
  new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export default function BranchTypeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName } = useAuth();
  const [draftCount, setDraftCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([getAllDrafts(), peekQueue()]).then(([d, q]) => {
        setDraftCount(d.length);
        setQueueCount(q.length);
      });
    }, []),
  );

  const goto = (path: '/(officer)/drafts' | '/(officer)/submissions' | '/(officer)/profile') => {
    haptics.tap();
    router.push(path);
  };

  const selectType = (type: 'CFC' | 'Store') => {
    haptics.tap();
    router.push({
      pathname: '/(officer)/select-branch',
      params: { branchType: type },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg, paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting} numberOfLines={1}>
              {greeting()}, {(userName || 'Officer').split(' ')[0]}
            </Text>
            <Text style={styles.dateLine}>{dateStr()}</Text>
          </View>
          <TouchableOpacity
            onPress={() => goto('/(officer)/profile')}
            style={styles.profileButton}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Ionicons name="person-circle-outline" size={26} color="#fff" />
            <Text style={styles.profileButtonLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: insets.bottom + SPACING.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Start a new inspection</Text>

        {/* CFC Card */}
        <TouchableOpacity
          onPress={() => selectType('CFC')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start CFC inspection"
          style={[styles.bigCard, { backgroundColor: COLOR.brand }]}
        >
          <View style={styles.bigCardIcon}>
            <Ionicons name="storefront-outline" size={30} color="#fff" />
          </View>
          <View>
            <Text style={styles.bigCardTitle}>CFC</Text>
            <Text style={styles.bigCardSub}>Central Fulfillment Centre</Text>
          </View>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>

        {/* Store Card */}
        <TouchableOpacity
          onPress={() => selectType('Store')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Start Store inspection"
          style={[styles.bigCard, { backgroundColor: '#0f766e' }]}
        >
          <View style={styles.bigCardIcon}>
            <Ionicons name="bag-outline" size={30} color="#fff" />
          </View>
          <View>
            <Text style={styles.bigCardTitle}>Store</Text>
            <Text style={styles.bigCardSub}>Retail Store Branch</Text>
          </View>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>My work</Text>

        <NavRow
          icon="document-text-outline"
          label="My Drafts"
          sub="Resume inspections you started"
          badge={draftCount > 0 ? draftCount : undefined}
          badgeColor={COLOR.brand}
          onPress={() => goto('/(officer)/drafts')}
        />
        <NavRow
          icon="cloud-upload-outline"
          label="Pending sync"
          sub="Submissions waiting to upload"
          badge={queueCount > 0 ? queueCount : undefined}
          badgeColor={COLOR.warning}
          onPress={() => goto('/(officer)/drafts')}
        />
        <NavRow
          icon="checkmark-done-outline"
          label="My Submissions"
          sub="History of completed inspections"
          onPress={() => goto('/(officer)/submissions')}
        />
      </ScrollView>
    </View>
  );
}

function NavRow({
  icon,
  label,
  sub,
  badge,
  badgeColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  badge?: number;
  badgeColor?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={styles.navRow}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.navIcon}>
        <Ionicons name={icon} size={24} color={COLOR.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.navLabel}>{label}</Text>
        <Text style={styles.navSub}>{sub}</Text>
      </View>
      {badge != null && (
        <View style={[styles.badge, { backgroundColor: badgeColor ?? COLOR.brand }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={22} color={COLOR.borderStrong} />
    </TouchableOpacity>
  );
}

const styles = {
  header: {
    backgroundColor: COLOR.brand,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  } as const,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  } as const,
  greeting: {
    fontSize: FONT.h1,
    fontWeight: '800',
    color: '#fff',
  } as const,
  dateLine: {
    fontSize: FONT.body,
    color: COLOR.textOnPrimaryMuted,
    marginTop: 2,
  } as const,
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: TOUCH.minHeight,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
  } as const,
  profileButtonLabel: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '700',
  } as const,
  sectionTitle: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  } as const,
  bigCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.md,
    minHeight: 160,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  } as const,
  bigCardIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  bigCardTitle: {
    fontSize: FONT.display,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  } as const,
  bigCardSub: {
    fontSize: FONT.body,
    color: COLOR.textOnPrimaryMuted,
    marginTop: 4,
  } as const,
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: TOUCH.rowHeight,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLOR.border,
  } as const,
  navIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLOR.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  navLabel: {
    fontSize: FONT.bodyLg,
    fontWeight: '700',
    color: COLOR.text,
  } as const,
  navSub: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginTop: 2,
  } as const,
  badge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: SPACING.sm,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  badgeText: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '800',
  } as const,
};
