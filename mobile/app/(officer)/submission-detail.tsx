import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { isViolationResponse, type ChecklistResponse } from '../../lib/checklistScoring';

interface ChecklistItemRef {
  item_text: string;
  section: string;
  item_order: number;
  trigger_on_no: boolean;
}

interface ResponseRow {
  id: string;
  checklist_item_id: string;
  response: ChecklistResponse;
  remarks: string | null;
  checklist_item: ChecklistItemRef | null;
}

interface FileRow {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  checklist_item_id: string | null;
}

interface SubmissionDetail {
  id: string;
  inspection_date: string;
  status: string;
  compliance_score: number | null;
  risk_level: string | null;
  time_in: string | null;
  time_out: string | null;
  submitted_at: string | null;
  inspection_responses: ResponseRow[];
  inspection_files: FileRow[];
  general_remarks: { remark_text: string }[];
}

const isImageFile = (f: FileRow) => {
  const type = (f.file_type ?? '').toLowerCase();
  const name = (f.file_name ?? '').toLowerCase();
  const url = (f.file_url ?? '').toLowerCase();
  return (
    type === 'image' ||
    /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(name) ||
    /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(url)
  );
};

/**
 * Formats a stored HH:MM or HH:MM:SS time string for display.
 * Returns '-' for null/empty.
 */
const formatTime = (value: string | null | undefined): string => {
  if (!value || value.trim() === '') return '-';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value.trim();
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const scoreColor = (score: number) => {
  if (score >= 80) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
};

export default function SubmissionDetailScreen() {
  const { inspectionId, branchName } = useLocalSearchParams<{
    inspectionId: string;
    branchName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, error } = useQuery<SubmissionDetail | null>({
    queryKey: ['submission-detail', inspectionId],
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data: row, error: qErr } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, status, compliance_score, risk_level,
          time_in, time_out, submitted_at,
          inspection_responses (
            id, checklist_item_id, response, remarks,
            checklist_item:checklist_templates!inspection_responses_checklist_item_id_fkey (
              item_text, section, item_order, trigger_on_no
            )
          ),
          inspection_files ( id, file_url, file_name, file_type, checklist_item_id ),
          general_remarks ( remark_text )
        `,
        )
        .eq('id', inspectionId!)
        .maybeSingle();
      if (qErr) throw qErr;
      return row as SubmissionDetail | null;
    },
  });

  const sections = useMemo(() => {
    const grouped: Record<string, ResponseRow[]> = {};
    (data?.inspection_responses ?? []).forEach((r) => {
      const sec = r.checklist_item?.section ?? 'General';
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push(r);
    });
    return grouped;
  }, [data?.inspection_responses]);

  const itemEvidenceMap = useMemo(() => {
    const map = new Map<string, FileRow[]>();
    (data?.inspection_files ?? []).forEach((f) => {
      if (!isImageFile(f) || !f.checklist_item_id) return;
      const list = map.get(f.checklist_item_id) ?? [];
      list.push(f);
      map.set(f.checklist_item_id, list);
    });
    return map;
  }, [data?.inspection_files]);

  const allImages = useMemo(() => {
    const seen = new Set<string>();
    return (data?.inspection_files ?? []).filter((f) => {
      if (!isImageFile(f)) return false;
      if (seen.has(f.file_url)) return false;
      seen.add(f.file_url);
      return true;
    });
  }, [data?.inspection_files]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
        <Text style={{ color: '#1e293b', marginTop: 12 }}>Submission not found</Text>
      </View>
    );
  }

  const timeInDisplay = formatTime(data.time_in);
  const timeOutDisplay = formatTime(data.time_out);

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9', paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#1e3a5f',
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={{ flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
          {branchName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Summary card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginBottom: 12 }}>
            INSPECTION SUMMARY
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Date</Text>
              <Text style={{ color: '#0f172a', fontWeight: '700', marginTop: 2 }}>
                {new Date(data.inspection_date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
            {data.compliance_score !== null && (
              <Text style={{ fontSize: 28, fontWeight: '900', color: scoreColor(data.compliance_score) }}>
                {data.compliance_score.toFixed(0)}%
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <View>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Time In</Text>
              <Text style={{ color: '#0f172a', fontWeight: '700', marginTop: 2 }}>{timeInDisplay}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Time Out</Text>
              <Text style={{ color: '#0f172a', fontWeight: '700', marginTop: 2 }}>{timeOutDisplay}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Status</Text>
              <Text style={{ color: '#16a34a', fontWeight: '700', marginTop: 2 }}>
                {data.status?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Checklist sections */}
        {Object.entries(sections).map(([section, items]) => (
          <View
            key={section}
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              marginBottom: 12,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <View
              style={{
                backgroundColor: '#1e293b',
                padding: 12,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#38bdf8', letterSpacing: 1 }}>
                {section.toUpperCase()}
              </Text>
            </View>
            {items.map((r, idx) => {
              const violation = isViolationResponse(r.response, r.checklist_item?.trigger_on_no ?? true);
              const linkedEvidence = itemEvidenceMap.get(r.checklist_item_id) ?? [];
              return (
                <View
                  key={r.id}
                  style={{
                    padding: 12,
                    borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                    borderBottomColor: '#f1f5f9',
                    backgroundColor: violation ? 'rgba(239,68,68,0.05)' : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Text style={{ flex: 1, color: '#0f172a', fontSize: 13, lineHeight: 18 }}>
                      {r.checklist_item?.item_text ?? '-'}
                    </Text>
                    <Text
                      style={{
                        fontWeight: '800',
                        fontSize: 13,
                        marginLeft: 8,
                        color: violation
                          ? '#dc2626'
                          : r.response === 'Yes'
                          ? '#16a34a'
                          : '#64748b',
                      }}
                    >
                      {r.response}
                    </Text>
                  </View>
                  {r.remarks ? (
                    <Text style={{ marginTop: 6, color: '#64748b', fontSize: 12, lineHeight: 18 }}>
                      Remark: {r.remarks}
                    </Text>
                  ) : null}
                  {linkedEvidence.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 8 }}
                    >
                      {linkedEvidence.map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          onPress={() => Linking.openURL(f.file_url)}
                          style={{ marginRight: 8 }}
                        >
                          <Image
                            source={{ uri: f.file_url }}
                            style={{ width: 64, height: 64, borderRadius: 8 }}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}

        {/* General Remarks */}
        {(data.general_remarks ?? []).length > 0 && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginBottom: 8 }}>
              GENERAL REMARKS
            </Text>
            {data.general_remarks.map((r, i) => (
              <Text key={i} style={{ color: '#0f172a', fontSize: 13, lineHeight: 20 }}>
                {r.remark_text}
              </Text>
            ))}
          </View>
        )}

        {/* All photo evidence */}
        {allImages.length > 0 && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginBottom: 12 }}>
              PHOTO EVIDENCE
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {allImages.map((f) => (
                <TouchableOpacity key={f.id} onPress={() => Linking.openURL(f.file_url)}>
                  <Image
                    source={{ uri: f.file_url }}
                    style={{ width: 100, height: 100, borderRadius: 10 }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
