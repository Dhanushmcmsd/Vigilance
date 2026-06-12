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
  officer?: { name: string | null } | null;
}

function scoreColor(score: number) {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#d97706';
  return '#dc2626';
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
          branch:branches!inspections_branch_id_fkey ( branch_name, branch_type_id ),
          officer:user_roles!inspections_officer_id_fkey ( name )
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
            paddingHorizontal: 16,
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
            ) : null
          }
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const storeName = item.branch?.branch_name ?? 'Unknown branch';
            const score = item.compliance_score;
            return (
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  router.push({
                    pathname: '/(officer)/submission-detail',
                    params: { inspectionId: item.id, branchName: storeName },
                  });
                }}
                style={styles.row}
                accessibilityRole="button"
              >
                <View style={styles.rowMain}>
                  <Text style={styles.storeName} numberOfLines={1} ellipsizeMode="tail">
                    {storeName}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.inspection_date}
                    {item.submitted_at
                      ? ` · ${new Date(item.submitted_at).toLocaleDateString('en-IN')}`
                      : ''}
                    {item.officer?.name ? ` · ${item.officer.name}` : ''}
                  </Text>
                </View>
                {score != null ? (
                  <Text style={[styles.scoreText, { color: scoreColor(score) }]}>{score.toFixed(0)}%</Text>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    minHeight: TOUCH.rowHeight,
  } as const,
  rowMain: {
    flex: 1,
    marginRight: 12,
  } as const,
  storeName: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLOR.text,
    textAlign: 'left' as const,
  },
  rowMeta: {
    fontSize: FONT.xs,
    color: COLOR.textMuted,
    marginTop: 4,
    textAlign: 'left' as const,
  },
  scoreText: {
    fontSize: FONT.bodyLg,
    fontWeight: '800',
    textAlign: 'right' as const,
  },
  pendingBanner: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.md,
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
