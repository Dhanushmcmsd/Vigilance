import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Animated,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RADIUS, SPACING } from '../../lib/a11y';

const AUDIT = {
  bg: '#0f172a',
  surface: '#1e293b',
  accent: '#6366f1',
  accentSoft: '#312e81',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  border: '#334155',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

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

      return (data as BranchRow[]).map((b) => {
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
        };
      });
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel('audit-inspections-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inspections',
        },
        (payload) => {
          const row = payload.new as { branch_id?: string; status?: string };
          if (row.status !== 'submitted' || !row.branch_id) return;
          const branchId = row.branch_id;
          if (!newDotAnim.current[branchId]) {
            newDotAnim.current[branchId] = new Animated.Value(0);
          }
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
          queryClient.invalidateQueries({ queryKey: ['audit-branch-list'] });
          queryClient.invalidateQueries({ queryKey: ['audit-store-reports', branchId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = (branches ?? []).filter(
    (b) =>
      b.branch_name.toLowerCase().includes(search.toLowerCase()) ||
      (b.city ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const scoreColor = (score: number | null) => {
    if (score === null) return AUDIT.textMuted;
    if (score >= 80) return AUDIT.success;
    if (score >= 60) return AUDIT.warning;
    return AUDIT.danger;
  };

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg, paddingTop: insets.top }}>
      <StatusBar barStyle="light-content" />

      <View style={{ padding: SPACING.lg, paddingBottom: SPACING.md }}>
        <Text
          style={{
            fontSize: 11,
            color: AUDIT.accent,
            fontWeight: '800',
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          VIGILANCE AUDIT
        </Text>
        <Text style={{ fontSize: 26, fontWeight: '900', color: AUDIT.text, marginTop: 4 }}>
          Store Reports
        </Text>
        <Text style={{ fontSize: 14, color: AUDIT.textMuted, marginTop: 2 }}>
          {userName} · All branches
        </Text>
      </View>

      <View
        style={{
          marginHorizontal: SPACING.lg,
          marginBottom: SPACING.md,
          backgroundColor: AUDIT.surface,
          borderRadius: RADIUS.lg,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: SPACING.md,
          borderWidth: 1,
          borderColor: AUDIT.border,
        }}
      >
        <Ionicons name="search" size={20} color={AUDIT.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search branches..."
          placeholderTextColor={AUDIT.textMuted}
          style={{ flex: 1, color: AUDIT.text, fontSize: 15, paddingVertical: 12, paddingLeft: 8 }}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color={AUDIT.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={AUDIT.accent} />
          <Text style={{ color: AUDIT.textMuted, marginTop: 12 }}>Loading stores...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingBottom: insets.bottom + 32,
          }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AUDIT.accent} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/(audit)/store-reports',
                  params: { branchId: item.id, branchName: item.branch_name },
                })
              }
              style={{
                backgroundColor: AUDIT.surface,
                borderRadius: RADIUS.xl,
                padding: SPACING.lg,
                marginBottom: SPACING.md,
                borderWidth: 1,
                borderColor: AUDIT.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: AUDIT.text }}>
                      {item.branch_name}
                    </Text>
                    {newDotAnim.current[item.id] && (
                      <Animated.View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: AUDIT.success,
                          opacity: newDotAnim.current[item.id],
                        }}
                      />
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: AUDIT.textMuted, marginTop: 2 }}>
                    {item.city ?? ''}
                    {item.region ? ` · ${item.region}` : ''}
                  </Text>
                </View>
                {item.lastScore !== null && (
                  <Text style={{ fontSize: 22, fontWeight: '900', color: scoreColor(item.lastScore) }}>
                    {item.lastScore.toFixed(0)}%
                  </Text>
                )}
              </View>

              <View style={{ flexDirection: 'row', marginTop: SPACING.md, gap: SPACING.md }}>
                <View
                  style={{
                    backgroundColor: AUDIT.accentSoft,
                    borderRadius: RADIUS.md,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#a5b4fc', fontWeight: '700' }}>
                    {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
                  </Text>
                </View>
                {item.lastDate && (
                  <Text style={{ fontSize: 12, color: AUDIT.textMuted, alignSelf: 'center' }}>
                    Last:{' '}
                    {new Date(item.lastDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                )}
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={AUDIT.textMuted}
                  style={{ marginLeft: 'auto', alignSelf: 'center' }}
                />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
