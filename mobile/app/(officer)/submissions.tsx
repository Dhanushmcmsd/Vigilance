import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';
import { peekQueue, flushQueue } from '../../lib/syncQueue';

interface SubmissionRow {
  id: string;
  inspection_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  compliance_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  submitted_at: string | null;
  branch: { branch_name: string; branch_type_id: string | null } | null;
}

export default function SubmissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userRolesId } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useQuery<SubmissionRow[]>({
    queryKey: ['officer-submissions', userRolesId],
    enabled: !!userRolesId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, status, compliance_score, risk_level, submitted_at,
          branch:branches!inspections_branch_id_fkey ( branch_name, branch_type_id )
        `,
        )
        .eq('officer_id', userRolesId!)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false, nullsFirst: false })
        .limit(100);
      if (error) throw error;
      return ((rows ?? []) as unknown) as SubmissionRow[];
    },
  });

  // Pending sync — items submitted while offline that haven't reached the
  // server yet. Read straight from the MMKV-backed queue so the count is
  // accurate even if the network is still down.
  const pendingQuery = useQuery<number>({
    queryKey: ['officer-pending-sync'],
    queryFn: async () => (await peekQueue()).length,
    // Refetch on focus + on every refresh action below.
    refetchInterval: 15_000,
  });

  const onRefresh = React.useCallback(async () => {
    haptics.tap();
    // Trigger an immediate flush attempt before re-reading either source.
    // If we're offline this is a no-op; if we're online any queued items
    // become real rows and surface in the next `refetch()`.
    await flushQueue().catch(() => {});
    await Promise.all([refetch(), pendingQuery.refetch()]);
  }, [refetch, pendingQuery]);

  const pendingCount = pendingQuery.data ?? 0;
  const empty = !isLoading && (data?.length ?? 0) === 0 && pendingCount === 0;

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
        <Text style={styles.headerTitle}>My Submissions</Text>
        <View style={{ width: 80 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLOR.brand} />
        </View>
      ) : empty ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={56} color={COLOR.borderStrong} />
          <Text style={styles.emptyTitle}>No submissions yet</Text>
          <Text style={styles.emptyBody}>
            Your completed inspections will appear here. Pull down to refresh.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{
            padding: SPACING.lg,
            paddingBottom: insets.bottom + SPACING.xl,
          }}
          ListHeaderComponent={
            pendingCount > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  router.push('/(officer)/drafts');
                }}
                style={styles.pendingBanner}
                accessibilityRole="button"
                accessibilityLabel={`${pendingCount} submission${
                  pendingCount === 1 ? '' : 's'
                } pending sync. Tap to view drafts.`}
              >
                <Ionicons
                  name="cloud-offline-outline"
                  size={28}
                  color="#a16207"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingTitle}>
                    {pendingCount} pending sync
                  </Text>
                  <Text style={styles.pendingBody}>
                    These submissions will upload automatically when you're
                    online. Tap to manage.
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color="#a16207"
                />
              </TouchableOpacity>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                router.push({
                  pathname: '/(officer)/submission-detail',
                  params: { id: item.id },
                });
              }}
              style={styles.card}
              accessibilityRole="button"
              accessibilityLabel={`View submission for ${
                item.branch?.branch_name ?? 'unknown branch'
              } on ${item.inspection_date}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {item.branch?.branch_name ?? 'Unknown branch'}
                </Text>
                <Text style={styles.cardMeta}>
                  {item.inspection_date}
                  {item.submitted_at
                    ? ` · submitted ${new Date(item.submitted_at).toLocaleDateString('en-IN')}`
                    : ''}
                </Text>
                <View style={styles.pillRow}>
                  <StatusPill status={item.status} />
                  {item.compliance_score != null && (
                    <ScorePill
                      score={item.compliance_score}
                      risk={item.risk_level}
                    />
                  )}
                </View>
              </View>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={COLOR.borderStrong}
              />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function StatusPill({ status }: { status: SubmissionRow['status'] }) {
  const map: Record<SubmissionRow['status'], { fg: string; bg: string }> = {
    draft: { fg: '#374151', bg: '#e5e7eb' },
    submitted: { fg: '#1d4ed8', bg: '#dbeafe' },
    approved: { fg: '#166534', bg: '#dcfce7' },
    rejected: { fg: '#b91c1c', bg: '#fee2e2' },
  };
  const c = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function ScorePill({
  score,
  risk,
}: {
  score: number;
  risk: SubmissionRow['risk_level'];
}) {
  const fg =
    risk === 'critical' || risk === 'high'
      ? '#b91c1c'
      : risk === 'medium'
      ? '#a16207'
      : '#166534';
  const bg =
    risk === 'critical' || risk === 'high'
      ? '#fee2e2'
      : risk === 'medium'
      ? '#fef3c7'
      : '#dcfce7';
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{score.toFixed(0)}%</Text>
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
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH.rowHeight,
  } as const,
  cardTitle: {
    fontSize: FONT.bodyLg,
    fontWeight: '800',
    color: COLOR.text,
  } as const,
  cardMeta: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginTop: SPACING.xs,
  } as const,
  pillRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  } as const,
  pill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  } as const,
  pillText: { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 0.5 } as const,
  pendingBanner: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: TOUCH.rowHeight,
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
