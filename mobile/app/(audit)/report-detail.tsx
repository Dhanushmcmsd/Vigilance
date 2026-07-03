import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Image,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../../lib/supabase';
import { RADIUS, SPACING } from '../../lib/a11y';
import { AUDIT, auditScoreColor } from '../../lib/auditTheme';
import { buildAuditPdfHtml, prepareAuditPdfInspection } from '../../lib/auditPdf';
import { responseTheme, sectionTheme } from '../../lib/reportTheme';
import { isViolationResponse, type ChecklistResponse } from '../../lib/checklistScoring';
import {
  collectInspectionImageFiles,
  collectInspectionVideoFiles,
  collectItemImageAttachments,
} from '../../lib/inspectionMedia';
import { useResolvedMediaMap } from '../../hooks/useResolvedMediaMap';

const PDF_MIME_TYPE = 'application/pdf';

function toSafeFilePart(value: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const safe = (raw ?? fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || fallback;
}

function buildPdfFileName(
  inspectionId: string | undefined,
  branchName: string | string[] | undefined,
  inspectionDate: string,
): string {
  const store = toSafeFilePart(branchName, 'store');
  const date = inspectionDate.split('T')[0] || 'inspection';
  const id = inspectionId?.slice(0, 8) ?? Date.now().toString();
  return `inspection_${store}_${date}_${id}.pdf`;
}

async function savePdfToDeviceStorage(
  sourceUri: string,
  fileName: string,
): Promise<{ uri: string; savedToExternalStorage: boolean }> {
  if (Platform.OS === 'android') {
    const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted) {
      const base64 = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        PDF_MIME_TYPE,
      );
      await FileSystem.writeAsStringAsync(targetUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { uri: targetUri, savedToExternalStorage: true };
    }
  }

  const fallbackUri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: fallbackUri });
  return { uri: fallbackUri, savedToExternalStorage: false };
}

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

interface ReportDetail {
  id: string;
  inspection_date: string;
  created_at: string | null;
  status: string;
  compliance_score: number | null;
  risk_level: string | null;
  head_comment: string | null;
  submitted_at: string | null;
  time_in: string | null;
  time_out: string | null;
  officer: { name: string; phone: string | null } | null;
  inspection_responses: ResponseRow[];
  inspection_files: {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    checklist_item_id: string | null;
    duration_seconds?: number | null;
    file_size_bytes?: number | null;
  }[];
  inspection_answers: {
    checklist_item_id: string | null;
    photo_url: string | null;
  }[];
  general_remarks: { remark_text: string }[];
}

const formatVideoDuration = (seconds: number | null | undefined) => {
  if (!seconds || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatVideoSizeMb = (bytes: number | null | undefined) => {
  if (!bytes || bytes <= 0) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Formats DB time strings to 12-hour display (e.g. "08:05 PM").
 * Accepts HH:MM, HH:MM:SS, and HH:MM:SS.micros.
 */
const formatReportTime = (value: string | null | undefined): string => {
  if (!value || value.trim() === '') return '-';
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?/);
  if (!match) return value.trim();
  const h = Math.min(23, Math.max(0, Number(match[1])));
  const m = Math.min(59, Math.max(0, Number(match[2])));
  const isPm = h >= 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
};

export default function AuditReportDetailScreen() {
  const { inspectionId, branchName } = useLocalSearchParams<{
    inspectionId: string;
    branchName: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data, isLoading, error } = useQuery<ReportDetail | null>({
    queryKey: ['audit-report-detail', inspectionId],
    enabled: !!inspectionId,
    queryFn: async () => {
      const { data: row, error: qErr } = await supabase
        .from('inspections')
        .select(
          `
          id, inspection_date, created_at, status, compliance_score, risk_level,
          head_comment, submitted_at, time_in, time_out,
          officer:user_roles!inspections_officer_id_fkey ( name, phone ),
          inspection_responses (
            id, checklist_item_id, response, remarks,
            checklist_item:checklist_templates!inspection_responses_checklist_item_id_fkey (
              item_text, section, item_order, trigger_on_no
            )
          ),
          inspection_files ( id, file_url, file_name, file_type, checklist_item_id, duration_seconds, file_size_bytes ),
          inspection_answers ( checklist_item_id, photo_url ),
          general_remarks ( remark_text )
        `,
        )
        .eq('id', inspectionId!)
        .maybeSingle();
      if (qErr) throw qErr;
      return row as ReportDetail | null;
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

  const imageFiles = useMemo(
    () => collectInspectionImageFiles(data?.inspection_files ?? [], data?.inspection_answers ?? []),
    [data?.inspection_files, data?.inspection_answers],
  );

  const videoFiles = useMemo(
    () => collectInspectionVideoFiles(data?.inspection_files ?? []),
    [data?.inspection_files],
  );

  const itemEvidenceMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof collectInspectionImageFiles>>();
    (data?.inspection_responses ?? []).forEach((response) => {
      const attachments = collectItemImageAttachments(
        data?.inspection_files ?? [],
        data?.inspection_answers ?? [],
        response.checklist_item_id,
      );
      if (attachments.length > 0) {
        map.set(response.checklist_item_id, attachments);
      }
    });
    return map;
  }, [data?.inspection_files, data?.inspection_answers, data?.inspection_responses]);

  const resolvedMap = useResolvedMediaMap([
    ...imageFiles.map((file) => file.file_url),
    ...videoFiles.map((file) => file.file_url),
  ]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const prepared = await prepareAuditPdfInspection(data);
      const html = buildAuditPdfHtml(prepared, branchName ?? 'Unknown Store');
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = buildPdfFileName(inspectionId, branchName, data.inspection_date);
      const { uri: savedUri, savedToExternalStorage } = await savePdfToDeviceStorage(uri, fileName);

      if (savedToExternalStorage) {
        Alert.alert('PDF downloaded', 'Report saved to the selected storage folder.');
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(savedUri, {
            mimeType: PDF_MIME_TYPE,
            dialogTitle: `Inspection Report - ${branchName}`,
          });
        } else {
          Alert.alert('PDF saved', `Saved to app storage: ${savedUri}`);
        }
      }
    } catch {
      Alert.alert('Error', 'Could not generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShareReport = async () => {
    if (!data) return;
    const text = `Vigilance Inspection Report\nStore: ${branchName}\nDate: ${data.inspection_date}\nScore: ${data.compliance_score?.toFixed(0) ?? '-'}%\nStatus: ${data.status?.toUpperCase()}\n\nPowered by Vigilance Management System`;
    await Share.share({ message: text, title: `Inspection - ${branchName}` });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: AUDIT.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={AUDIT.accent} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: AUDIT.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="alert-circle-outline" size={48} color={AUDIT.danger} />
        <Text style={{ color: AUDIT.text, marginTop: 12 }}>Report not found</Text>
      </View>
    );
  }

  // FIX: Use the stored time_in / time_out columns directly.
  // Never fall back to created_at for time_in — that is the draft creation timestamp,
  // not the officer's arrival time. If time_in is missing, show '-'.
  const timeInDisplay = formatReportTime(data.time_in);
  const timeOutDisplay = formatReportTime(data.time_out);

  return (
    <View style={{ flex: 1, backgroundColor: AUDIT.bg, paddingTop: insets.top }}>
      <View style={{ padding: SPACING.lg, paddingBottom: SPACING.md }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={AUDIT.accent} />
          <Text style={{ color: AUDIT.accent, fontSize: 14, fontWeight: '700' }}>
            {branchName}
          </Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: AUDIT.text }}>
              {new Date(data.inspection_date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Text style={{ fontSize: 13, color: AUDIT.textMuted, marginTop: 2 }}>
              Officer: {data.officer?.name ?? '-'}
            </Text>
          </View>
          {data.compliance_score !== null && (
            <Text style={{ fontSize: 32, fontWeight: '900', color: auditScoreColor(data.compliance_score) }}>
              {data.compliance_score.toFixed(0)}%
            </Text>
          )}
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: SPACING.md,
          paddingHorizontal: SPACING.lg,
          marginBottom: SPACING.md,
        }}
      >
        <TouchableOpacity
          onPress={handleDownloadPdf}
          disabled={pdfLoading}
          style={{
            flex: 1,
            backgroundColor: AUDIT.accent,
            borderRadius: RADIUS.lg,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {pdfLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>Download PDF</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShareReport}
          style={{
            backgroundColor: AUDIT.surface,
            borderRadius: RADIUS.lg,
            borderWidth: 1,
            borderColor: AUDIT.border,
            paddingVertical: 12,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Ionicons name="share-outline" size={20} color={AUDIT.accent} />
          <Text style={{ color: AUDIT.accent, fontWeight: '800', fontSize: 14 }}>Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + 32 }}
      >
        {/* Inspection Summary */}
        <View
          style={{
            backgroundColor: AUDIT.surface,
            borderRadius: RADIUS.xl,
            padding: SPACING.lg,
            marginBottom: SPACING.md,
            borderWidth: 1,
            borderColor: AUDIT.border,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: AUDIT.textMuted, letterSpacing: 1 }}>
            INSPECTION SUMMARY
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: SPACING.xl }}>
            <View>
              <Text style={{ fontSize: 11, color: AUDIT.textMuted }}>Time In</Text>
              <Text style={{ color: AUDIT.text, fontWeight: '700' }}>{timeInDisplay}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: AUDIT.textMuted }}>Time Out</Text>
              <Text style={{ color: AUDIT.text, fontWeight: '700' }}>{timeOutDisplay}</Text>
            </View>
            <View>
              <Text style={{ fontSize: 11, color: AUDIT.textMuted }}>Status</Text>
              <Text style={{ color: AUDIT.success, fontWeight: '700' }}>{data.status?.toUpperCase()}</Text>
            </View>
          </View>
          {data.head_comment ? (
            <View
              style={{
                marginTop: 12,
                backgroundColor: '#1c2a3a',
                borderRadius: RADIUS.md,
                padding: SPACING.md,
              }}
            >
              <Text style={{ fontSize: 11, color: AUDIT.textMuted, marginBottom: 4 }}>Head Comment</Text>
              <Text style={{ color: AUDIT.text, fontSize: 13 }}>{data.head_comment}</Text>
            </View>
          ) : null}
        </View>

        {/* Checklist sections */}
        {Object.entries(sections).map(([section, items]) => {
          const theme = sectionTheme(section);
          return (
          <View
            key={section}
            style={{
              backgroundColor: AUDIT.surface,
              borderRadius: RADIUS.xl,
              marginBottom: SPACING.md,
              borderWidth: 1.5,
              borderColor: theme.border,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                backgroundColor: theme.bg,
                padding: SPACING.md,
                borderBottomWidth: 1.5,
                borderBottomColor: theme.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text, letterSpacing: 1 }}>
                {section.toUpperCase()}
              </Text>
            </View>
            {items.map((r, idx) => {
              const violation = isViolationResponse(r.response, r.checklist_item?.trigger_on_no ?? true);
              const resp = responseTheme(r.response, violation);
              const linkedEvidence = itemEvidenceMap.get(r.checklist_item_id) ?? [];
              return (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    padding: SPACING.md,
                    borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                    borderBottomColor: AUDIT.border,
                    backgroundColor: violation ? `${resp.bg}88` : r.response === 'Yes' ? 'rgba(16,185,129,0.08)' : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={{ flex: 1, color: AUDIT.text, fontSize: 13 }}>
                        {r.checklist_item?.item_text ?? '-'}
                      </Text>
                      <View
                        style={{
                          marginLeft: 8,
                          borderWidth: 1.5,
                          borderColor: resp.border,
                          backgroundColor: resp.pill,
                          borderRadius: 999,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontWeight: '800', fontSize: 11, color: resp.text }}>
                          {r.response}
                        </Text>
                      </View>
                    </View>
                    {r.remarks ? (
                      <Text style={{ marginTop: 6, color: AUDIT.textMuted, fontSize: 12, lineHeight: 18 }}>
                        Remark: {r.remarks}
                      </Text>
                    ) : null}
                    {/* Per-item photo evidence from inspection_files */}
                    {linkedEvidence.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 8 }}
                      >
                        {linkedEvidence.map((f) => (
                          <TouchableOpacity
                            key={f.id}
                            onPress={() => Linking.openURL(resolvedMap[f.file_url] ?? f.file_url)}
                            style={{ marginRight: 8 }}
                          >
                            <Image
                              source={{ uri: resolvedMap[f.file_url] ?? f.file_url }}
                              style={{ width: 64, height: 64, borderRadius: RADIUS.md }}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
          );
        })}

        {/* General Remarks */}
        {(data.general_remarks ?? []).length > 0 && (
          <View
            style={{
              backgroundColor: AUDIT.surface,
              borderRadius: RADIUS.xl,
              padding: SPACING.lg,
              marginBottom: SPACING.md,
              borderWidth: 1,
              borderColor: AUDIT.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: AUDIT.textMuted,
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              GENERAL REMARKS
            </Text>
            {data.general_remarks.map((r, i) => (
              <Text key={i} style={{ color: AUDIT.text, fontSize: 13, lineHeight: 20 }}>
                {r.remark_text}
              </Text>
            ))}
          </View>
        )}

        {/* All photo evidence */}
        {imageFiles.length > 0 && (
          <View
            style={{
              backgroundColor: AUDIT.surface,
              borderRadius: RADIUS.xl,
              padding: SPACING.lg,
              marginBottom: SPACING.md,
              borderWidth: 1,
              borderColor: AUDIT.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: AUDIT.textMuted,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              PHOTO EVIDENCE
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {imageFiles.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  onPress={() => Linking.openURL(resolvedMap[f.file_url] ?? f.file_url)}
                >
                  <Image
                    source={{ uri: resolvedMap[f.file_url] ?? f.file_url }}
                    style={{ width: 100, height: 100, borderRadius: RADIUS.md }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {videoFiles.length > 0 && (
          <View
            style={{
              backgroundColor: AUDIT.surface,
              borderRadius: RADIUS.xl,
              padding: SPACING.lg,
              marginBottom: SPACING.md,
              borderWidth: 1,
              borderColor: AUDIT.border,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: AUDIT.textMuted,
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              VIDEOS
            </Text>
            <View style={{ gap: 8 }}>
              {videoFiles.map((f) => (
                <View
                  key={f.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: RADIUS.md,
                    borderWidth: 1,
                    borderColor: AUDIT.border,
                    backgroundColor: '#1c2a3a',
                    padding: SPACING.md,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: AUDIT.text }} numberOfLines={1}>
                      {f.file_name ?? 'Inspection video'}
                    </Text>
                    <Text style={{ fontSize: 11, color: AUDIT.textMuted, marginTop: 4 }}>
                      {formatVideoDuration(f.duration_seconds)} · {formatVideoSizeMb(f.file_size_bytes)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => Linking.openURL(resolvedMap[f.file_url] ?? f.file_url)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: AUDIT.accent,
                      borderRadius: RADIUS.md,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                    }}
                  >
                    <Ionicons name="play" size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Play</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
