import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { COLOR, RADIUS, SPACING } from '../../lib/a11y';
import { AUDIT } from '../../lib/auditTheme';
import { AuditScreenHeader } from '../../components/audit/AuditScreenHeader';
import {
  groupStoreReports,
  type AuditMonthFolder,
  type AuditReportRow,
} from '../../lib/auditReports';
import { AuditReportCard } from '../../components/audit/AuditReportCard';

type ListItem =
  | { kind: 'day'; report: AuditReportRow }
  | { kind: 'folder'; folder: AuditMonthFolder };

export default function StoreReportsScreen() {
  const { branchId, branchName } = useLocalSearchParams<{
    branchId: string;
    branchName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<AuditReportRow[]>({
    queryKey: ['audit-store-reports', branchId],
    enabled: !!branchId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, submitted_at, status, compliance_score, risk_level,
          officer:user_roles!inspections_officer_id_fkey ( name )
        `,
        )
        .eq('branch_id', branchId!)
        .neq('status', 'draft')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (rows ?? []) as unknown as AuditReportRow[];
    },
  });

  const groups = useMemo(() => groupStoreReports(data ?? []), [data]);

  const sections = useMemo(() => {
    const result: { title: string; subtitle?: string; data: ListItem[] }[] = [];

    if (groups.currentMonthDays.length > 0) {
      result.push({
        title: groups.currentMonthLabel,
        subtitle: 'Tap a day to open the field officer checklist PDF',
        data: groups.currentMonthDays.map((report) => ({ kind: 'day' as const, report })),
      });
    }

    if (groups.monthFolders.length > 0) {
      result.push({
        title: 'Earlier months',
        subtitle: 'Reports older than this month are stored in monthly folders',
        data: groups.monthFolders.map((folder) => ({ kind: 'folder' as const, folder })),
      });
    }

    return result;
  }, [groups]);

  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`audit-branch-${branchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspections', filter: `branch_id=eq.${branchId}` },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['audit-store-reports', branchId] });
          if (payload.eventType === 'DELETE') {
            queryClient.invalidateQueries({ queryKey: ['audit-branch-list'] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, queryClient]);

  const openPdf = (inspectionId: string) => {
    router.push({
      pathname: '/(audit)/report-detail',
      params: { inspectionId, branchName: branchName ?? '' },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg }}>
      <AuditScreenHeader
        eyebrow="STORE REPORTS"
        title={branchName ?? 'Store'}
        subtitle={`${data?.length ?? 0} field inspection reports`}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={AUDIT.accent} />
        </View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl }}>
          <Ionicons name="folder-open-outline" size={48} color={AUDIT.textMuted} />
          <Text style={{ color: AUDIT.textMuted, marginTop: 12, textAlign: 'center' }}>
            No submitted reports for this store yet.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) =>
            item.kind === 'day' ? item.report.id : `folder-${item.folder.key}-${index}`
          }
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AUDIT.accent} />
          }
          renderSectionHeader={({ section: { title, subtitle } }) => (
            <View style={{ marginBottom: SPACING.md, marginTop: SPACING.sm }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f766e', letterSpacing: 1 }}>
                {title.toUpperCase()}
              </Text>
              {subtitle ? (
                <Text style={{ fontSize: 12, color: AUDIT.textMuted, marginTop: 4 }}>{subtitle}</Text>
              ) : null}
            </View>
          )}
          renderItem={({ item }) => {
            if (item.kind === 'folder') {
              return (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/(audit)/month-archive',
                      params: {
                        branchId: branchId ?? '',
                        branchName: branchName ?? '',
                        yearMonth: item.folder.key,
                      },
                    })
                  }
                  style={{
                    backgroundColor: AUDIT.surface,
                    borderRadius: RADIUS.xl,
                    padding: SPACING.lg,
                    marginBottom: SPACING.md,
                    borderWidth: 1,
                    borderColor: AUDIT.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: AUDIT.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: SPACING.md,
                    }}
                  >
                    <Ionicons name="folder" size={24} color={AUDIT.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: COLOR.text }}>
                      {item.folder.label}
                    </Text>
                    <Text style={{ fontSize: 13, color: AUDIT.textMuted, marginTop: 2 }}>
                      {item.folder.reportCount}{' '}
                      {item.folder.reportCount === 1 ? 'report' : 'reports'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={AUDIT.textMuted} />
                </TouchableOpacity>
              );
            }

            return (
              <AuditReportCard
                item={item.report}
                onPress={() => openPdf(item.report.id)}
                showDayHeader
              />
            );
          }}
        />
      )}
    </View>
  );
}
