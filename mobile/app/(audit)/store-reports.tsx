import React, { useEffect } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { RADIUS, SPACING } from '../../lib/a11y';

const AUDIT = {
  bg: '#0f172a',
  surface: '#1e293b',
  accent: '#6366f1',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  border: '#334155',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

interface ReportRow {
  id: string;
  inspection_date: string;
  submitted_at: string | null;
  status: string;
  compliance_score: number | null;
  risk_level: string | null;
  officer: { name: string } | null;
}

export default function StoreReportsScreen() {
  const { branchId, branchName } = useLocalSearchParams<{
    branchId: string;
    branchName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<ReportRow[]>({
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
      return (rows ?? []) as unknown as ReportRow[];
    },
  });

  useEffect(() => {
    if (!branchId) return;
    const channel = supabase
      .channel(`audit-branch-${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inspections',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['audit-store-reports', branchId] });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inspections',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['audit-store-reports', branchId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, queryClient]);

  const scoreColor = (score: number | null) => {
    if (score === null) return AUDIT.textMuted;
    if (score >= 80) return AUDIT.success;
    if (score >= 60) return AUDIT.warning;
    return AUDIT.danger;
  };

  const riskLabel = (risk: string | null) => {
    const map: Record<string, { label: string; color: string }> = {
      low: { label: 'LOW RISK', color: AUDIT.success },
      medium: { label: 'MEDIUM', color: AUDIT.warning },
      high: { label: 'HIGH RISK', color: AUDIT.danger },
      critical: { label: 'CRITICAL', color: '#a855f7' },
    };
    return risk ? map[risk] : null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg, paddingTop: insets.top }}>
      <View style={{ padding: SPACING.lg, paddingBottom: SPACING.md }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={AUDIT.accent} />
          <Text style={{ color: AUDIT.accent, fontSize: 14, fontWeight: '700' }}>All Stores</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 22, fontWeight: '900', color: AUDIT.text }}>{branchName}</Text>
        <Text style={{ fontSize: 13, color: AUDIT.textMuted, marginTop: 2 }}>
          {data?.length ?? 0} submitted reports
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={AUDIT.accent} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AUDIT.accent} />
          }
          renderItem={({ item }) => {
            const risk = riskLabel(item.risk_level);
            return (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/(audit)/report-detail',
                    params: { inspectionId: item.id, branchName: branchName ?? '' },
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
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: AUDIT.text }}>
                    {new Date(item.inspection_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={{ fontSize: 13, color: AUDIT.textMuted, marginTop: 2 }}>
                    Officer: {item.officer?.name ?? 'Unknown'}
                  </Text>
                  <View style={{ flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
                    {risk && (
                      <Text style={{ fontSize: 11, fontWeight: '800', color: risk.color }}>
                        ● {risk.label}
                      </Text>
                    )}
                    {item.status === 'approved' && (
                      <Text style={{ fontSize: 11, fontWeight: '800', color: AUDIT.success }}>
                        ✓ APPROVED
                      </Text>
                    )}
                  </View>
                </View>
                {item.compliance_score !== null && (
                  <Text
                    style={{
                      fontSize: 26,
                      fontWeight: '900',
                      color: scoreColor(item.compliance_score),
                      marginRight: 8,
                    }}
                  >
                    {item.compliance_score.toFixed(0)}%
                  </Text>
                )}
                <Ionicons name="document-text-outline" size={24} color={AUDIT.accent} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
