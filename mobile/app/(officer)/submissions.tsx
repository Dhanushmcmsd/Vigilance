import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLOR, FONT, RADIUS, SPACING } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';
import { peekQueue, flushQueue } from '../../lib/syncQueue';
import { OfficerTabHeader } from '../../components/OfficerTabHeader';
import {
  formatEditWindowCountdown,
  isEditWindowActive,
} from '../../lib/branchLocks';

interface SubmissionRow {
  id: string;
  submitted_at: string | null;
  edit_window_expires_at: string | null;
  branch: { branch_name: string } | null;
}

function formatSubmittedAt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function SubmissionCard({
  item,
  timerTick,
}: {
  item: SubmissionRow;
  timerTick: number;
}) {
  void timerTick;
  const storeName = item.branch?.branch_name ?? 'Unknown branch';
  const submittedLabel = formatSubmittedAt(item.submitted_at);
  const editActive = isEditWindowActive(item.edit_window_expires_at);
  const countdown = editActive ? formatEditWindowCountdown(item.edit_window_expires_at) : null;

  return (
    <View style={styles.card} accessibilityRole="text">
      <View style={styles.cardTopRow}>
        <Text style={styles.storeName} numberOfLines={2}>
          {storeName}
        </Text>
      </View>
      <Text style={styles.submittedText}>Submitted {submittedLabel}</Text>
      {countdown ? (
        <Text style={styles.editWindowText}>Edit window: {countdown} remaining</Text>
      ) : null}
    </View>
  );
}

export default function SubmissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userRolesId } = useAuth();
  const [timerTick, setTimerTick] = React.useState(0);

  const { data, isLoading, refetch, isRefetching, error, isError } = useQuery<SubmissionRow[]>({
    queryKey: ['officer-submissions', userRolesId],
    enabled: !!userRolesId,
    queryFn: async () => {
      const { data: rows, error: qErr } = await supabase
        .from('inspections')
        .select(
          `
          id, submitted_at, edit_window_expires_at,
          branch:branches!inspections_branch_id_fkey ( branch_name )
        `,
        )
        .eq('officer_id', userRolesId!)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (qErr) throw qErr;
      return ((rows ?? []) as unknown) as SubmissionRow[];
    },
  });

  React.useEffect(() => {
    const hasActiveEditWindow = (data ?? []).some((row) =>
      isEditWindowActive(row.edit_window_expires_at),
    );
    if (!hasActiveEditWindow) return;
    const id = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [data]);

  useFocusEffect(
    React.useCallback(() => {
      if (userRolesId) void refetch();
    }, [userRolesId, refetch]),
  );

  const pendingQuery = useQuery<number>({
    queryKey: ['officer-pending-sync'],
    queryFn: async () => (await peekQueue()).length,
    refetchInterval: 15_000,
  });

  const onRefresh = React.useCallback(async () => {
    haptics.tap();
    await flushQueue().catch(() => {});
    await Promise.all([refetch(), pendingQuery.refetch()]);
  }, [refetch, pendingQuery]);

  const pendingCount = pendingQuery.data ?? 0;
  const empty = !isLoading && !isError && (data?.length ?? 0) === 0 && pendingCount === 0;

  const listHeader = (
    <>
      <OfficerTabHeader
        title="Submissions"
        subtitle="Your submitted inspections."
      />
      {pendingCount > 0 ? (
        <TouchableOpacity
          onPress={() => {
            haptics.tap();
            router.push('/(officer)/drafts');
          }}
          style={[styles.pendingBanner, { marginTop: 12 }]}
          accessibilityRole="button"
        >
          <Ionicons name="cloud-offline-outline" size={28} color="#a16207" />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingTitle}>{pendingCount} pending sync</Text>
            <Text style={styles.pendingBody}>
              These submissions will upload automatically when you're online. Tap to manage.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#a16207" />
        </TouchableOpacity>
      ) : null}
    </>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {listHeader}
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#0f766e" />
              </View>
            </>
          }
        />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {listHeader}
              <View style={styles.center}>
                <Ionicons name="alert-circle-outline" size={56} color={COLOR.danger} />
                <Text style={styles.emptyTitle}>Could not load submissions</Text>
                <Text style={styles.emptyBody}>
                  {error instanceof Error ? error.message : 'Please pull down to try again.'}
                </Text>
                <TouchableOpacity
                  onPress={() => void refetch()}
                  style={[styles.pendingBanner, { marginTop: SPACING.lg, alignSelf: 'stretch' }]}
                >
                  <Text style={[styles.pendingTitle, { color: '#0f766e' }]}>Retry</Text>
                </TouchableOpacity>
              </View>
            </>
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        />
      </View>
    );
  }

  if (empty) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <>
              {listHeader}
              <View style={styles.center}>
                <Ionicons name="folder-open-outline" size={56} color={COLOR.borderStrong} />
                <Text style={styles.emptyTitle}>No submissions yet</Text>
                <Text style={styles.emptyBody}>
                  Your completed inspections will appear here. Pull down to refresh.
                </Text>
              </View>
            </>
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <FlatList
        data={data}
        keyExtractor={(it) => it.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + SPACING.xl,
          gap: 12,
        }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        renderItem={({ item }) => <SubmissionCard item={item} timerTick={timerTick} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  } as const,
  emptyTitle: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    marginTop: SPACING.md,
  } as const,
  emptyBody: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    maxWidth: 320,
    lineHeight: 22,
  } as const,
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  } as const,
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  } as const,
  storeName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    color: COLOR.text,
  } as const,
  submittedText: {
    fontSize: 13,
    color: COLOR.textMuted,
    marginTop: 2,
  } as const,
  editWindowText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f766e',
    marginTop: 6,
  } as const,
  pendingBanner: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  } as const,
  pendingTitle: {
    fontSize: FONT.bodyLg,
    fontWeight: '800',
    color: '#92400e',
  } as const,
  pendingBody: {
    fontSize: FONT.body,
    color: '#a16207',
    marginTop: 2,
    lineHeight: 20,
  } as const,
};
