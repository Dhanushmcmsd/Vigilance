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
import { isViolationResponse } from '../../lib/checklistScoring';
import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';
import { peekQueue, flushQueue } from '../../lib/syncQueue';
import { OfficerTabHeader } from '../../components/OfficerTabHeader';

interface ResponseRow {
  response: string | null;
  risk_level?: string | null;
  checklist_item?: { trigger_on_no?: boolean | null } | null;
}

interface SubmissionRow {
  id: string;
  inspection_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  compliance_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  submitted_at: string | null;
  branch: { branch_name: string; branch_type_id: string | null } | null;
  officer?: { name: string | null } | null;
  inspection_responses?: ResponseRow[];
}

function scoreColor(score: number) {
  if (score >= 80) return '#22C55E';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

function countBadges(responses: ResponseRow[] = []) {
  let red = 0;
  let yellow = 0;
  let green = 0;

  responses.forEach((entry) => {
    const triggerOnNo = entry.checklist_item?.trigger_on_no ?? true;
    const level = entry.risk_level?.toUpperCase();
    if (isViolationResponse(entry.response, triggerOnNo)) {
      if (level === 'YELLOW') yellow += 1;
      else red += 1;
    } else if (entry.response && entry.response !== 'N/A') {
      green += 1;
    }
  });

  return { red, yellow, green };
}

function SubmissionCard({ item, onPress }: { item: SubmissionRow; onPress: () => void }) {
  const storeName = item.branch?.branch_name ?? 'Unknown branch';
  const score = item.compliance_score;
  const dateLabel = item.submitted_at
    ? new Date(item.submitted_at).toLocaleDateString('en-IN')
    : item.inspection_date;
  const { red, yellow, green } = countBadges(item.inspection_responses);

  return (
    <TouchableOpacity onPress={onPress} style={styles.card} accessibilityRole="button">
      <View style={styles.cardTopRow}>
        <Text style={styles.storeName} numberOfLines={2}>
          {storeName}
        </Text>
        <Text style={styles.dateText}>{dateLabel}</Text>
      </View>

      {score != null ? (
        <Text style={[styles.scoreText, { color: scoreColor(score) }]}>{score.toFixed(0)}%</Text>
      ) : null}

      <View style={styles.badgeRow}>
        {red > 0 ? (
          <View style={[styles.badge, styles.badgeRed]}>
            <Text style={[styles.badgeText, { color: '#EF4444' }]}>RED {red}</Text>
          </View>
        ) : null}
        {yellow > 0 ? (
          <View style={[styles.badge, styles.badgeYellow]}>
            <Text style={[styles.badgeText, { color: '#F59E0B' }]}>YELLOW {yellow}</Text>
          </View>
        ) : null}
        {green > 0 ? (
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text style={[styles.badgeText, { color: '#22C55E' }]}>GREEN {green}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SubmissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userRolesId } = useAuth();

  const { data, isLoading, refetch, isRefetching, error, isError } = useQuery<SubmissionRow[]>({
    queryKey: ['officer-submissions', userRolesId],
    enabled: !!userRolesId,
    queryFn: async () => {
      const { data: rows, error: qErr } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, status, compliance_score, risk_level, submitted_at,
          branch:branches!inspections_branch_id_fkey ( branch_name, branch_type_id ),
          officer:user_roles!inspections_officer_id_fkey ( name ),
          inspection_responses (
            response,
            risk_level,
            checklist_item:checklist_templates!inspection_responses_checklist_item_id_fkey ( trigger_on_no )
          )
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

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <OfficerTabHeader
        title="Submissions"
        subtitle="Your completed inspections and compliance scores."
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      ) : isError ? (
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
      ) : empty ? (
        <View style={styles.center}>
          <Ionicons name="folder-open-outline" size={56} color={COLOR.borderStrong} />
          <Text style={styles.emptyTitle}>No submissions yet</Text>
          <Text style={styles.emptyBody}>Your completed inspections will appear here. Pull down to refresh.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + SPACING.xl,
            gap: 12,
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
          renderItem={({ item }) => (
            <SubmissionCard
              item={item}
              onPress={() => {
                haptics.tap();
                router.push({
                  pathname: '/(officer)/submission-detail',
                  params: {
                    inspectionId: item.id,
                    branchName: item.branch?.branch_name ?? 'Store',
                  },
                });
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ fontSize: 15, color: COLOR.textMuted }}>No submissions yet.</Text>
            </View>
          }
        />
      )}
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
    marginBottom: 6,
  } as const,
  storeName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    color: COLOR.text,
  } as const,
  dateText: {
    fontSize: 12,
    color: COLOR.textMuted,
    marginLeft: 8,
  } as const,
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  } as const,
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 4,
  } as const,
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  } as const,
  badgeRed: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  } as const,
  badgeYellow: {
    backgroundColor: 'rgba(245,158,11,0.12)',
  } as const,
  badgeGreen: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  } as const,
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
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
