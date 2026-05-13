import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '../../lib/supabase';
import { COLOR, FONT, RADIUS, SPACING, TOUCH, riskPalette } from '../../lib/a11y';
import { haptics } from '../../lib/haptics';

interface DetailRow {
  id: string;
  inspection_date: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  compliance_score: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  head_comment: string | null;
  submitted_at: string | null;
  time_in: string | null;
  time_out: string | null;
  branch: { branch_name: string } | null;
  inspection_responses: ResponseRow[];
  inspection_files: FileRow[];
  general_remarks: { remark_text: string }[];
}

interface ResponseRow {
  id: string;
  response: 'Yes' | 'No' | 'N/A';
  remarks: string | null;
  checklist_item: {
    item_text: string;
    section: string;
    item_order: number;
    risk_classifications: { risk_level: 'RED' | 'YELLOW' | 'GREEN' } | null;
  } | null;
}

interface FileRow {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'image' | 'document';
}

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, error } = useQuery<DetailRow | null>({
    queryKey: ['submission-detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, status, compliance_score, risk_level, head_comment,
          submitted_at, time_in, time_out,
          branch:branches!inspections_branch_id_fkey ( branch_name ),
          inspection_responses (
            id, response, remarks,
            checklist_item:checklist_templates!inspection_responses_checklist_item_id_fkey (
              item_text, section, item_order,
              risk_classifications:risk_classifications!risk_classifications_checklist_item_id_fkey ( risk_level )
            )
          ),
          inspection_files ( id, file_url, file_name, file_type ),
          general_remarks ( remark_text )
        `,
        )
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return (row as unknown) as DetailRow | null;
    },
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLOR.brand} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={56} color={COLOR.danger} />
        <Text style={styles.errorTitle}>Couldn't load this inspection</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.actionButton, { backgroundColor: COLOR.brandStrong, marginTop: SPACING.lg }]}
        >
          <Text style={styles.actionPrimaryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Group responses by section.
  const grouped = new Map<string, ResponseRow[]>();
  for (const r of data.inspection_responses) {
    const sec = r.checklist_item?.section ?? 'Other';
    if (!grouped.has(sec)) grouped.set(sec, []);
    grouped.get(sec)!.push(r);
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        (a.checklist_item?.item_order ?? 0) - (b.checklist_item?.item_order ?? 0),
    );
  }

  const photos = data.inspection_files.filter((f: FileRow) => f.file_type === 'image');
  const docs = data.inspection_files.filter((f: FileRow) => f.file_type !== 'image');

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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data.branch?.branch_name ?? 'Inspection'}
        </Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: insets.bottom + SPACING.xl,
        }}
      >
        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryDate}>
            {data.inspection_date}
            {data.submitted_at
              ? ` · submitted ${new Date(data.submitted_at).toLocaleString('en-IN')}`
              : ''}
          </Text>
          <View style={styles.summaryRow}>
            <SummaryStat
              label="Score"
              value={
                data.compliance_score != null
                  ? `${data.compliance_score.toFixed(0)}%`
                  : '—'
              }
            />
            <SummaryStat label="Risk" value={(data.risk_level ?? '—').toUpperCase()} />
            <SummaryStat label="Status" value={data.status.toUpperCase()} />
          </View>
          {(data.time_in || data.time_out) && (
            <Text style={styles.summaryTime}>
              {data.time_in ?? '—'} → {data.time_out ?? '—'}
            </Text>
          )}
          {data.head_comment ? (
            <View style={styles.commentBox}>
              <Text style={styles.commentLabel}>Supervisor comment</Text>
              <Text style={styles.commentText}>{data.head_comment}</Text>
            </View>
          ) : null}
        </View>

        {/* General remarks */}
        {data.general_remarks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>General remarks</Text>
            {data.general_remarks.map((g: { remark_text: string }, i: number) => (
              <Text key={i} style={styles.bodyText}>
                {g.remark_text}
              </Text>
            ))}
          </View>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photos.map((p: FileRow) => (
                <Image
                  key={p.id}
                  source={{ uri: p.file_url }}
                  style={styles.photo}
                  accessibilityLabel={p.file_name}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Documents */}
        {docs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documents ({docs.length})</Text>
            {docs.map((d: FileRow) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => Linking.openURL(d.file_url)}
                style={styles.docRow}
                accessibilityRole="link"
                accessibilityLabel={`Open ${d.file_name}`}
              >
                <Ionicons name="document-outline" size={22} color={COLOR.brand} />
                <Text style={styles.docName} numberOfLines={1}>
                  {d.file_name}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={20}
                  color={COLOR.borderStrong}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Checklist by section */}
        {[...grouped.entries()].map(([section, items]) => (
          <View key={section} style={styles.section}>
            <Text style={styles.sectionTitle}>{section}</Text>
            {items.map((r) => {
              const risk = r.checklist_item?.risk_classifications?.risk_level;
              const palette =
                risk === 'RED'
                  ? riskPalette.red
                  : risk === 'YELLOW'
                  ? riskPalette.yellow
                  : risk === 'GREEN'
                  ? riskPalette.green
                  : null;
              return (
                <View
                  key={r.id}
                  style={[
                    styles.itemCard,
                    palette ? { borderLeftColor: palette.fg, borderLeftWidth: 4 } : null,
                  ]}
                >
                  <Text style={styles.itemText}>
                    {r.checklist_item?.item_order != null
                      ? `${r.checklist_item.item_order}. `
                      : ''}
                    {r.checklist_item?.item_text ?? '—'}
                  </Text>
                  <View style={styles.itemFootRow}>
                    <ResponsePill response={r.response} />
                    {risk && palette && (
                      <View style={[styles.riskPill, { backgroundColor: palette.bg }]}>
                        <Text style={[styles.riskPillText, { color: palette.fg }]}>
                          {risk}
                        </Text>
                      </View>
                    )}
                  </View>
                  {r.remarks ? <Text style={styles.remark}>{r.remarks}</Text> : null}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ResponsePill({ response }: { response: 'Yes' | 'No' | 'N/A' }) {
  const bg =
    response === 'Yes' ? '#dcfce7' : response === 'No' ? '#fee2e2' : '#e5e7eb';
  const fg =
    response === 'Yes' ? '#166534' : response === 'No' ? '#b91c1c' : '#374151';
  return (
    <View style={[styles.respPill, { backgroundColor: bg }]}>
      <Text style={[styles.respPillText, { color: fg }]}>{response}</Text>
    </View>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.bg,
    padding: SPACING.xl,
  } as const,
  errorTitle: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    marginTop: SPACING.md,
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
    flex: 1,
    color: COLOR.textOnPrimary,
    fontSize: FONT.h1,
    fontWeight: '800',
    textAlign: 'center',
  } as const,
  summaryCard: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    marginBottom: SPACING.lg,
  } as const,
  summaryDate: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginBottom: SPACING.md,
  } as const,
  summaryRow: { flexDirection: 'row', gap: SPACING.md } as const,
  summaryTime: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginTop: SPACING.md,
  } as const,
  statLabel: {
    fontSize: FONT.xs,
    fontWeight: '700',
    color: COLOR.textMuted,
    letterSpacing: 0.4,
  } as const,
  statValue: {
    fontSize: FONT.h2,
    fontWeight: '900',
    color: COLOR.text,
    marginTop: 4,
  } as const,
  commentBox: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLOR.warningSoft,
    borderRadius: RADIUS.md,
  } as const,
  commentLabel: {
    fontSize: FONT.xs,
    fontWeight: '800',
    color: COLOR.warning,
    letterSpacing: 0.4,
    marginBottom: 4,
  } as const,
  commentText: {
    fontSize: FONT.body,
    color: COLOR.text,
    lineHeight: 22,
  } as const,
  section: { marginBottom: SPACING.xl } as const,
  sectionTitle: {
    fontSize: FONT.h2,
    fontWeight: '800',
    color: COLOR.text,
    marginBottom: SPACING.md,
  } as const,
  bodyText: {
    fontSize: FONT.body,
    color: COLOR.text,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  } as const,
  photo: {
    width: 140,
    height: 140,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
    backgroundColor: COLOR.borderStrong,
  } as const,
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: SPACING.md,
    minHeight: TOUCH.minHeight,
    marginBottom: SPACING.sm,
  } as const,
  docName: {
    flex: 1,
    fontSize: FONT.body,
    fontWeight: '600',
    color: COLOR.text,
  } as const,
  itemCard: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  } as const,
  itemText: {
    fontSize: FONT.body,
    color: COLOR.text,
    lineHeight: 22,
    fontWeight: '600',
  } as const,
  itemFootRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  } as const,
  respPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  } as const,
  respPillText: { fontSize: FONT.body, fontWeight: '800' } as const,
  riskPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  } as const,
  riskPillText: { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 0.5 } as const,
  remark: {
    fontSize: FONT.body,
    color: COLOR.textMuted,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
    lineHeight: 22,
  } as const,
  actionButton: {
    minHeight: TOUCH.minHeight,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  actionPrimaryText: {
    color: '#fff',
    fontSize: FONT.body,
    fontWeight: '700',
  } as const,
};
