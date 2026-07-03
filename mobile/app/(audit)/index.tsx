import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Animated,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { SPACING } from '../../lib/a11y';
import { AUDIT } from '../../lib/auditTheme';
import { AuditScreenHeader, AuditSearchBar } from '../../components/audit/AuditScreenHeader';
import { AuditStoreCard } from '../../components/audit/AuditStoreCard';

interface BranchInspectionRow {
  id: string;
  inspection_date: string;
  compliance_score: number | null;
  status: string;
  submitted_at: string | null;
}

interface BranchRow {
  id: string;
  branch_name: string;
  city: string | null;
  region: string | null;
  inspections: BranchInspectionRow[] | null;
}

interface BranchSummary {
  id: string;
  branch_name: string;
  city: string | null;
  region: string | null;
  reportCount: number;
  lastScore: number | null;
  lastDate: string | null;
  latestSubmittedAt: string | null;
}

export default function AuditHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const newDotAnim = useRef<Record<string, Animated.Value>>({});

  const { data: branches, isLoading, refetch, isRefetching } = useQuery<BranchSummary[]>({
    queryKey: ['audit-branch-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select(
          `
          id, branch_name, city, region,
          inspections!inspections_branch_id_fkey (
            id, inspection_date, compliance_score, status, submitted_at
          )
        `,
        )
        .eq('is_active', true)
        .order('region', { ascending: true })
        .order('branch_name', { ascending: true });

      if (error) throw error;

      return (data as BranchRow[])
        .map((b) => {
          const submitted = (b.inspections ?? []).filter((i) => i.status !== 'draft');
          const sorted = [...submitted].sort(
            (a, c) =>
              new Date(c.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime(),
          );
          return {
            id: b.id,
            branch_name: b.branch_name,
            city: b.city,
            region: b.region,
            reportCount: submitted.length,
            lastScore: sorted[0]?.compliance_score ?? null,
            lastDate: sorted[0]?.inspection_date ?? null,
            latestSubmittedAt: sorted[0]?.submitted_at ?? null,
          };
        })
        .sort((a, b) => new Date(b.latestSubmittedAt ?? 0).getTime() - new Date(a.latestSubmittedAt ?? 0).getTime());
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('audit-inspections-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inspections' },
        (payload) => {
          const next = payload.new as { branch_id?: string; status?: string } | undefined;
          const prev = payload.old as { status?: string } | undefined;
          const becameSubmitted =
            next?.status === 'submitted' && prev?.status !== 'submitted';
          const wasDeleted = payload.eventType === 'DELETE';
          if (!becameSubmitted && !wasDeleted) return;
          const branchId = next?.branch_id ?? (payload.old as { branch_id?: string })?.branch_id;
          if (!branchId) {
            queryClient.invalidateQueries({ queryKey: ['audit-branch-list'] });
            return;
          }
          if (!newDotAnim.current[branchId]) {
            newDotAnim.current[branchId] = new Animated.Value(0);
          }
          if (becameSubmitted) {
            Animated.loop(
              Animated.sequence([
                Animated.timing(newDotAnim.current[branchId], {
                  toValue: 1,
                  duration: 600,
                  useNativeDriver: true,
                }),
                Animated.timing(newDotAnim.current[branchId], {
                  toValue: 0,
                  duration: 600,
                  useNativeDriver: true,
                }),
              ]),
              { iterations: 5 },
            ).start();
          }
          queryClient.invalidateQueries({ queryKey: ['audit-branch-list'] });
          queryClient.invalidateQueries({ queryKey: ['audit-store-reports', branchId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = (branches ?? [])
    .filter(
      (b) =>
        b.branch_name.toLowerCase().includes(search.toLowerCase()) ||
        (b.city ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        new Date(b.latestSubmittedAt ?? 0).getTime() -
        new Date(a.latestSubmittedAt ?? 0).getTime(),
    );

  const listHeader = (
    <View>
      <AuditScreenHeader
        eyebrow="VIGILANCE · AUDIT"
        title="Stores"
        subtitle={`${userName || 'Audit reviewer'} · Read-only field officer reports`}
      />
      <AuditSearchBar value={search} onChangeText={setSearch} placeholder="Search stores..." />
      <Text
        style={{
          fontSize: 13,
          color: AUDIT.textMuted,
          marginHorizontal: 16,
          marginTop: SPACING.md,
          marginBottom: SPACING.sm,
          lineHeight: 18,
        }}
      >
        Tap a store to browse daily checklists and monthly PDF archives from field officers.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg }}>
      <StatusBar barStyle="light-content" />

      {isLoading ? (
        <>
          {listHeader}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={AUDIT.accent} />
            <Text style={{ color: AUDIT.textMuted, marginTop: 12 }}>Loading stores...</Text>
          </View>
        </>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AUDIT.accent} />
          }
          renderItem={({ item }) => (
            <AuditStoreCard
              branchName={item.branch_name}
              city={item.city}
              region={item.region}
              reportCount={item.reportCount}
              lastScore={item.lastScore}
              lastDate={item.lastDate}
              highlightDot={!!newDotAnim.current[item.id]}
              onPress={() =>
                router.push({
                  pathname: '/(audit)/store-reports',
                  params: { branchId: item.id, branchName: item.branch_name },
                })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: AUDIT.textMuted, marginTop: 24 }}>
              No stores match your search.
            </Text>
          }
        />
      )}
    </View>
  );
}
