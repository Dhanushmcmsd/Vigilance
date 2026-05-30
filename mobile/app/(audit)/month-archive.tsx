import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { RADIUS, SPACING } from '../../lib/a11y';
import { AUDIT } from '../../lib/auditTheme';
import { AuditScreenHeader } from '../../components/audit/AuditScreenHeader';
import { monthFolderLabel, reportsInMonth, type AuditReportRow } from '../../lib/auditReports';
import { AuditReportCard } from '../../components/audit/AuditReportCard';

export default function MonthArchiveScreen() {
  const { branchId, branchName, yearMonth } = useLocalSearchParams<{
    branchId: string;
    branchName: string;
    yearMonth: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const monthLabel = yearMonth ? monthFolderLabel(yearMonth) : 'Month';

  const { data, isLoading, refetch, isRefetching } = useQuery<AuditReportRow[]>({
    queryKey: ['audit-month-archive', branchId, yearMonth],
    enabled: !!branchId && !!yearMonth,
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
        .gte('inspection_date', `${yearMonth}-01`)
        .lte('inspection_date', `${yearMonth}-31`)
        .order('inspection_date', { ascending: false });
      if (error) throw error;
      return reportsInMonth((rows ?? []) as unknown as AuditReportRow[], yearMonth!);
    },
  });

  const groupedByDay = useMemo(() => data ?? [], [data]);

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg }}>
      <AuditScreenHeader
        eyebrow={(branchName ?? 'STORE').toUpperCase()}
        title={monthLabel}
        subtitle={`${groupedByDay.length} reports · tap any day for PDF`}
        onBack={() => router.back()}
      />

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={AUDIT.accent} />
        </View>
      ) : (
        <FlatList
          data={groupedByDay}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 32 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AUDIT.accent} />
          }
          ListHeaderComponent={
            <View
              style={{
                backgroundColor: AUDIT.accentSoft,
                borderRadius: RADIUS.lg,
                padding: SPACING.md,
                marginBottom: SPACING.md,
                borderWidth: 1,
                borderColor: AUDIT.border,
              }}
            >
              <Text style={{ fontSize: 12, color: '#c7d2fe', lineHeight: 18 }}>
                Archived monthly folder. Each entry is a field officer inspection with the full
                checklist available as PDF.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AuditReportCard
              item={item}
              showDayHeader
              onPress={() =>
                router.push({
                  pathname: '/(audit)/report-detail',
                  params: { inspectionId: item.id, branchName: branchName ?? '' },
                })
              }
            />
          )}
        />
      )}
    </View>
  );
}
