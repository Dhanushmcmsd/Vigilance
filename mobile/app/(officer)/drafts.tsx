import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { deleteDraft, getAllDrafts, type DraftForm } from '../../lib/storage';
import { peekQueue, flushQueue, type QueuedInspection } from '../../lib/syncQueue';
import { haptics } from '../../lib/haptics';
import { ToastMessage } from '../../components/ToastMessage';
import { OfficerTabHeader } from '../../components/OfficerTabHeader';

interface DraftRow {
  key: string;
  draft: DraftForm;
}

export default function DraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [queue, setQueue] = useState<QueuedInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'error' | 'success' | 'warning';
  }>({ visible: false, message: '', type: 'success' });

  const showToast = (
    message: string,
    type: 'error' | 'success' | 'warning' = 'success',
  ) => setToast({ visible: true, message, type });

  const load = useCallback(async () => {
    const [d, q] = await Promise.all([getAllDrafts(), peekQueue()]);
    setDrafts(d.sort((a, b) => b.draft.savedAt.localeCompare(a.draft.savedAt)));
    setQueue(q.sort((a, b) => b.queuedAt - a.queuedAt));
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSyncNow = async () => {
    haptics.medium();
    setSyncing(true);
    try {
      const r = await flushQueue();
      await load();
      if (r.attempted === 0) {
        showToast('No queued submissions.', 'warning');
      } else if (r.branchCompleted > 0) {
        haptics.warning();
        Alert.alert(
          'Store already completed',
          'Another officer submitted this store while you were offline. That queued report was removed.',
        );
        if (r.succeeded > 0) {
          showToast(`Synced ${r.succeeded} other submission(s).`, 'success');
        }
      } else if (r.abandoned > 0) {
        haptics.error();
        Alert.alert(
          'Sync failed',
          'Some submissions could not sync after 3 attempts. Check your connection and try again, or contact support.',
        );
      } else if (r.failed === 0) {
        haptics.success();
        showToast(`Synced ${r.succeeded} of ${r.attempted}.`, 'success');
      } else {
        haptics.warning();
        showToast(
          `${r.succeeded} synced, ${r.failed} still queued. Will retry.`,
          'warning',
        );
      }
    } catch {
      haptics.error();
      showToast('Sync failed. Check your connection.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const onResume = (item: DraftRow) => {
    haptics.tap();
    router.push({
      pathname: '/(officer)/checklist',
      params: {
        branchId: item.draft.branchId,
        branchName: item.draft.branchName,
        branchType: item.draft.branchType,
      },
    });
  };

  const onDelete = (item: DraftRow) => {
    Alert.alert(
      'Delete draft?',
      `This will permanently remove your draft for ${item.draft.branchName} on ${item.draft.date}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            haptics.warning();
            await deleteDraft(item.draft.branchId, item.draft.date);
            await load();
            showToast('Draft deleted.', 'success');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
        <OfficerTabHeader
          title="Drafts"
          subtitle="Resume in-progress inspections or sync queued submissions."
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0f766e" />
        </View>
      </View>
    );
  }

  const empty = drafts.length === 0 && queue.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.bg }}>
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((p) => ({ ...p, visible: false }))}
      />

      <OfficerTabHeader
        title="Drafts"
        subtitle="Resume in-progress inspections or sync queued submissions."
      />

      {/* Sync now */}
      <View style={{ padding: SPACING.lg }}>
        <TouchableOpacity
          onPress={onSyncNow}
          disabled={syncing}
          style={[
            styles.syncButton,
            { backgroundColor: syncing ? '#5eead4' : '#0f766e' },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Sync ${queue.length} queued submissions now`}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
          )}
          <Text style={styles.syncLabel}>
            {syncing
              ? 'Syncing…'
              : queue.length > 0
              ? `Sync now (${queue.length} queued)`
              : 'Nothing queued — tap to check'}
          </Text>
        </TouchableOpacity>
      </View>

      {empty ? (
        <View style={styles.emptyWrap}>
          <Ionicons
            name="document-text-outline"
            size={56}
            color={COLOR.borderStrong}
          />
          <Text style={styles.emptyTitle}>No drafts yet</Text>
          <Text style={styles.emptyBody}>
            Start an inspection from the home screen — any progress will be
            saved here automatically.
          </Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: insets.bottom + SPACING.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            queue.length > 0 ? (
              <View style={styles.queueBanner}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={20}
                  color={COLOR.warning}
                />
                <Text style={styles.queueBannerText}>
                  {queue.length} submitted offline — will sync automatically
                  when online.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const answered = Object.values(item.draft.responses).filter(
              (r) => r.response != null,
            ).length;
            const total = Object.keys(item.draft.responses).length;
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.draft.branchName}</Text>
                    <Text style={styles.cardMeta}>
                      {item.draft.date} · {item.draft.branchType}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {answered}/{total} answered · saved{' '}
                      {timeAgo(item.draft.savedAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => onResume(item)}
                    style={[styles.actionButton, styles.actionPrimary]}
                    accessibilityRole="button"
                    accessibilityLabel={`Resume draft for ${item.draft.branchName}`}
                  >
                    <Ionicons name="play" size={20} color="#fff" />
                    <Text style={styles.actionPrimaryText}>Resume</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => onDelete(item)}
                    style={[styles.actionButton, styles.actionDanger]}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete draft for ${item.draft.branchName}`}
                  >
                    <Ionicons name="trash" size={20} color={COLOR.danger} />
                    <Text style={styles.actionDangerText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const delta = Math.max(0, Date.now() - t);
  const m = Math.floor(delta / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const styles = {
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.bg,
  } as const,
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
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: TOUCH.minHeight,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
  } as const,
  syncLabel: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '700',
  } as const,
  queueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLOR.warningSoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  } as const,
  queueBannerText: {
    flex: 1,
    color: COLOR.warning,
    fontSize: FONT.body,
    fontWeight: '600',
  } as const,
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLOR.border,
  } as const,
  cardHead: { flexDirection: 'row', alignItems: 'center' } as const,
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
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  } as const,
  actionButton: {
    flex: 1,
    minHeight: TOUCH.minHeight,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  } as const,
  actionPrimary: { backgroundColor: COLOR.brandStrong } as const,
  actionPrimaryText: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '700',
  } as const,
  actionDanger: {
    backgroundColor: COLOR.dangerSoft,
    borderWidth: 1,
    borderColor: '#fecaca',
  } as const,
  actionDangerText: {
    color: COLOR.danger,
    fontSize: FONT.body,
    fontWeight: '700',
  } as const,
  emptyWrap: {
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
};
