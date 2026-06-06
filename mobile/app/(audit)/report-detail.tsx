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
import { buildAuditPdfHtml } from '../../lib/auditPdf';
import { isViolationResponse, type ChecklistResponse } from '../../lib/checklistScoring';

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
  }[];
  inspection_answers: { photo_url: string | null; photo_uploaded_at: string | null }[];
  general_remarks: { remark_text: string }[];
}

const isImageEvidence = (file: ReportDetail['inspection_files'][number]) => {
  const type = (file.file_type ?? '').toLowerCase();
  const name = file.file_name ?? '';
  const url = file.file_url ?? '';
  return type === 'image' || /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(name) || /\.(jpe?g|png|gif|webp|heic|heif)(\?|#|$)/i.test(url);
};

const formatReportTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const formatTimestampTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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
          inspection_files ( id, file_url, file_name, file_type, checklist_item_id ),
          inspection_answers ( photo_url, photo_uploaded_at ),
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

  const itemEvidenceMap = useMemo(() => {
    const map = new Map<string, ReportDetail['inspection_files']>();
    (data?.inspection_files ?? []).forEach((file) => {
      if (!isImageEvidence(file) || !file.checklist_item_id) return;
      const list = map.get(file.checklist_item_id) ?? [];
      list.push(file);
      map.set(file.checklist_item_id, list);
    });
    return map;
  }, [data?.inspection_files]);

  const handleDownloadPdf = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const html = buildAuditPdfHtml(data, branchName ?? 'Unknown Store');
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
    const text = `Vigilance Inspection Report\nStore: ${branchName}\nDate: ${data.inspection_date}\nScore: ${data.compliance_score?.toFixed(0) ?? 'â€”'}%\nStatus: ${data.status?.toUpperCase()}\n\nPowered by Vigilance Management System`;
    await Share.share({ message: text, title: `Inspection â€” ${branchName}` });
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

  const imageFiles = [
    ...(data.inspection_files ?? []).filter(isImageEvidence),
    ...((data.inspection_answers ?? [])
      .filter((p) => !!p.photo_url)
      .map((p, idx) => ({
        id: `answer-photo-${idx}`,
        file_url: p.photo_url as string,
        file_name: 'Inspection photo',
        file_type: 'image',
        checklist_item_id: null,
      }))),
  ].filter((file, idx, arr) => arr.findIndex((f) => f.file_url === file.file_url) === idx);

  const timeInDisplay = data.time_in
    ? formatReportTime(data.time_in)
    : formatTimestampTime(data.created_at ?? data.submitted_at);
  const timeOutDisplay = data.time_out
    ? formatReportTime(data.time_out)
    : formatTimestampTime(data.submitted_at);

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
          {data.head_comment && (
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
          )}
        </View>

        {Object.entries(sections).map(([section, items]) => (
          <View
            key={section}
            style={{
              backgroundColor: AUDIT.surface,
              borderRadius: RADIUS.xl,
              marginBottom: SPACING.md,
              borderWidth: 1,
              borderColor: AUDIT.border,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                backgroundColor: '#1e293b',
                padding: SPACING.md,
                borderBottomWidth: 1,
                borderBottomColor: AUDIT.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: AUDIT.accent, letterSpacing: 1 }}>
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
                    flexDirection: 'row',
                    padding: SPACING.md,
                    borderBottomWidth: idx < items.length - 1 ? 1 : 0,
                    borderBottomColor: AUDIT.border,
                    backgroundColor: violation ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Text style={{ flex: 1, color: AUDIT.text, fontSize: 13 }}>
                        {r.checklist_item?.item_text ?? '-'}
                      </Text>
                      <Text
                        style={{
                          fontWeight: '800',
                          fontSize: 13,
                          marginLeft: 8,
                          color: violation ? AUDIT.danger : r.response === 'Yes' ? AUDIT.success : AUDIT.textMuted,
                        }}
                      >
                        {r.response}
                      </Text>
                    </View>
                    {r.remarks ? (
                      <Text style={{ marginTop: 6, color: AUDIT.textMuted, fontSize: 12, lineHeight: 18 }}>
                        Remark: {r.remarks}
                      </Text>
                    ) : null}
                    {linkedEvidence.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        {linkedEvidence.map((f) => (
                          <TouchableOpacity
                            key={f.id}
                            onPress={() => Linking.openURL(f.file_url)}
                            style={{ marginRight: 8 }}
                          >
                            <Image
                              source={{ uri: f.file_url }}
                              style={{ width: 64, height: 64, borderRadius: RADIUS.md }}
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
        ))}

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
                <TouchableOpacity key={f.id} onPress={() => Linking.openURL(f.file_url)}>
                  <Image
                    source={{ uri: f.file_url }}
                    style={{ width: 100, height: 100, borderRadius: RADIUS.md }}
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
