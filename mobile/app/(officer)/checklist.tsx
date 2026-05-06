import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, loadDraft, deleteDraft, enqueueOfflineSubmission } from '../../lib/storage';
import { ChecklistItem } from '../../components/ChecklistItem';
import { ProgressBar } from '../../components/ProgressBar';
import { ToastMessage } from '../../components/ToastMessage';

type ResponseType = 'Yes' | 'No' | 'N/A' | null;

interface ChecklistTemplateItem {
  id: string;
  section: string;
  item_text: string;
  item_order: number;
}

interface SelectedFile {
  uri: string;
  name: string;
  type: 'image' | 'document';
}

const today = new Date().toISOString().split('T')[0];
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function ChecklistScreen() {
  const { branchId, branchName, branchType, officerLat, officerLon } = useLocalSearchParams<{
    branchId: string; branchName: string; branchType: string;
    officerLat: string; officerLon: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, userRolesId } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [items, setItems] = useState<ChecklistTemplateItem[]>([]);
  const [responses, setResponses] = useState<Record<string, { response: ResponseType; remark: string }>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(today);
  const [timeIn, setTimeIn] = useState(nowTime());
  const [timeOut, setTimeOut] = useState('');
  const [generalRemark, setGeneralRemark] = useState('');
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'warning' }>({
    visible: false, message: '', type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning') =>
    setToast({ visible: true, message, type });

  // Fetch checklist items
  useEffect(() => {
    supabase
      .from('checklist_templates')
      .select('id, section, item_text, item_order')
      .eq('is_active', true)
      .order('item_order')
      .then(({ data }) => {
        if (data) {
          setItems(data);
          // Expand all sections by default
          const sections = new Set(data.map((i: ChecklistTemplateItem) => i.section));
          setExpandedSections(sections);
          // Init responses
          const init: Record<string, { response: ResponseType; remark: string }> = {};
          data.forEach((i: ChecklistTemplateItem) => { init[i.id] = { response: null, remark: '' }; });
          setResponses(init);
        }
        setLoading(false);
      });
  }, []);

  // Restore draft
  useEffect(() => {
    loadDraft(branchId, today).then((draft) => {
      if (draft) {
        Alert.alert('Resume Draft?', 'A saved draft was found for this branch today. Resume it?', [
          { text: 'Start Fresh', style: 'destructive' },
          {
            text: 'Resume', onPress: () => {
              setResponses(draft.responses as any);
              setGeneralRemark(draft.generalRemark);
              setTimeIn(draft.timeIn);
              setTimeOut(draft.timeOut);
            },
          },
        ]);
      }
    });
  }, []);

  // Group items by section
  const sections = useMemo(() => {
    const map: Record<string, ChecklistTemplateItem[]> = {};
    items.forEach((item) => {
      if (!map[item.section]) map[item.section] = [];
      map[item.section].push(item);
    });
    return map;
  }, [items]);

  const answeredCount = useMemo(
    () => Object.values(responses).filter((r) => r.response !== null).length,
    [responses]
  );

  const handleResponse = useCallback((itemId: string, response: ResponseType) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], response } }));
  }, []);

  const handleRemark = useCallback((itemId: string, remark: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], remark } }));
  }, []);

  const handleSaveDraft = async () => {
    await saveDraft(branchId, today, {
      branchId, branchName, branchType: branchType || '',
      date, timeIn, timeOut,
      responses: responses as any,
      generalRemark,
      fileUris: files.map((f) => f.uri),
      savedAt: new Date().toISOString(),
    });
    showToast('Draft saved successfully', 'success');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newFiles: SelectedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}.jpg`,
        type: 'image',
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (!result.canceled) {
      const newFiles: SelectedFile[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        type: 'document',
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleSubmit = async () => {
    // Validate
    const unanswered = items.filter((i) => responses[i.id]?.response === null);
    if (unanswered.length > 0) {
      showToast(`${unanswered.length} item(s) unanswered. Please complete all items.`, 'warning');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    Alert.alert(
      'Submit Inspection',
      'Submit this inspection? You cannot edit after submitting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          style: 'default',
          onPress: async () => {
            setSubmitting(true);
            const netState = await NetInfo.fetch();
            if (!netState.isConnected) {
              await enqueueOfflineSubmission({
                branchId, branchName, branchType: branchType || '',
                date, timeIn, timeOut,
                responses: responses as any,
                generalRemark,
                fileUris: files.map((f) => f.uri),
                savedAt: new Date().toISOString(),
              });
              setSubmitting(false);
              showToast('Saved offline — will sync when connected', 'warning');
              return;
            }

            try {
              // 1. Create inspection
              const { data: inspection, error: inspErr } = await supabase
                .from('inspections')
                .insert({
                  officer_id: userRolesId,
                  branch_id: branchId,
                  inspection_date: date,
                  time_in: timeIn || null,
                  time_out: timeOut || null,
                  status: 'draft',
                  officer_latitude: officerLat ? parseFloat(officerLat) : null,
                  officer_longitude: officerLon ? parseFloat(officerLon) : null,
                })
                .select('id')
                .single();

              if (inspErr || !inspection) throw new Error(inspErr?.message || 'Inspection creation failed');
              const inspectionId = inspection.id;

              // 2. Batch insert responses
              const responseRows = items.map((item) => ({
                inspection_id: inspectionId,
                checklist_item_id: item.id,
                response: responses[item.id]?.response,
                remarks: responses[item.id]?.remark || null,
              }));
              const { error: respErr } = await supabase.from('inspection_responses').insert(responseRows);
              if (respErr) throw new Error(respErr.message);

              // 3. Upload files
              for (const file of files) {
                const ext = file.name.split('.').pop();
                const path = `inspections/${inspectionId}/${Date.now()}_${file.name}`;
                const blob = await (await fetch(file.uri)).blob();
                const { data: uploadData, error: uploadErr } = await supabase.storage
                  .from('inspection-files')
                  .upload(path, blob, { contentType: file.type === 'image' ? `image/${ext}` : 'application/octet-stream' });
                if (!uploadErr && uploadData) {
                  const { data: urlData } = supabase.storage.from('inspection-files').getPublicUrl(path);
                  await supabase.from('inspection_files').insert({
                    inspection_id: inspectionId,
                    file_url: urlData.publicUrl,
                    file_name: file.name,
                    file_type: file.type,
                  });
                }
              }

              // 4. General remarks
              if (generalRemark.trim()) {
                await supabase.from('general_remarks').insert({
                  inspection_id: inspectionId,
                  remark_text: generalRemark.trim(),
                });
              }

              // 5. Submit
              await supabase
                .from('inspections')
                .update({ status: 'submitted', submitted_at: new Date().toISOString() })
                .eq('id', inspectionId);

              await deleteDraft(branchId, today);
              setSubmitting(false);

              router.replace({
                pathname: '/(officer)/confirm',
                params: {
                  inspectionId,
                  branchName,
                  branchType: branchType || '',
                  date,
                  timeIn,
                  timeOut,
                  answeredCount: String(items.length),
                  filesCount: String(files.length),
                },
              });
            } catch (e: any) {
              setSubmitting(false);
              showToast(e.message || 'Submission failed. Please try again.', 'error');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading checklist...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((p) => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View
        style={{
          backgroundColor: '#fff',
          paddingHorizontal: 16,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#1f2937', marginHorizontal: 12 }} numberOfLines={1}>
          {branchName}
        </Text>
        <TouchableOpacity
          onPress={handleSaveDraft}
          style={{
            backgroundColor: '#eff6ff',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 7,
          }}
        >
          <Text style={{ color: '#2563eb', fontWeight: '600', fontSize: 13 }}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <ProgressBar answered={answeredCount} total={items.length} />

      {/* Meta info */}
      <View
        style={{
          backgroundColor: '#fff',
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <Text style={{ fontSize: 12, color: '#6b7280' }}>Officer: <Text style={{ fontWeight: '600', color: '#374151' }}>{userName}</Text></Text>
        <Text style={{ fontSize: 12, color: '#d1d5db' }}>|</Text>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>Date: <Text style={{ fontWeight: '600', color: '#374151' }}>{date}</Text></Text>
        <Text style={{ fontSize: 12, color: '#d1d5db' }}>|</Text>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>In: <Text style={{ fontWeight: '600', color: '#374151' }}>{timeIn}</Text></Text>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 140 }}
      >
        {Object.entries(sections).map(([section, sectionItems]) => (
          <View key={section} style={{ marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => {
                setExpandedSections((prev) => {
                  const next = new Set(prev);
                  next.has(section) ? next.delete(section) : next.add(section);
                  return next;
                });
              }}
              style={{
                backgroundColor: '#1e40af',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: expandedSections.has(section) ? 8 : 0,
              }}
            >
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' }}>{section}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginRight: 8 }}>
                {sectionItems.filter((i) => responses[i.id]?.response !== null).length}/{sectionItems.length}
              </Text>
              <Ionicons
                name={expandedSections.has(section) ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="rgba(255,255,255,0.8)"
              />
            </TouchableOpacity>
            {expandedSections.has(section) &&
              sectionItems.map((item) => (
                <ChecklistItem
                  key={item.id}
                  itemId={item.id}
                  itemText={item.item_text}
                  response={responses[item.id]?.response ?? null}
                  remark={responses[item.id]?.remark ?? ''}
                  onResponseChange={handleResponse}
                  onRemarkChange={handleRemark}
                />
              ))}
          </View>
        ))}
      </ScrollView>

      {/* Sticky Footer */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 8,
        }}
      >
        {/* Time Out */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Text style={{ fontSize: 13, color: '#6b7280', marginRight: 8 }}>Time Out:</Text>
          <TextInput
            value={timeOut}
            onChangeText={setTimeOut}
            placeholder="HH:MM"
            placeholderTextColor="#9ca3af"
            style={{
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              fontSize: 14,
              color: '#1f2937',
              width: 80,
            }}
          />
        </View>

        {/* File picker row */}
        <View style={{ flexDirection: 'row', marginBottom: 10, gap: 8 }}>
          <TouchableOpacity
            onPress={pickImage}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#f0fdf4',
              borderRadius: 10,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: '#bbf7d0',
            }}
          >
            <Ionicons name="camera-outline" size={18} color="#16a34a" />
            <Text style={{ color: '#16a34a', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>Photos ({files.filter((f) => f.type === 'image').length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickDocument}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#eff6ff',
              borderRadius: 10,
              paddingVertical: 10,
              borderWidth: 1,
              borderColor: '#bfdbfe',
            }}
          >
            <Ionicons name="document-outline" size={18} color="#2563eb" />
            <Text style={{ color: '#2563eb', fontSize: 13, fontWeight: '600', marginLeft: 6 }}>Docs ({files.filter((f) => f.type === 'document').length})</Text>
          </TouchableOpacity>
        </View>

        {/* File thumbnails */}
        {files.filter((f) => f.type === 'image').length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {files.filter((f) => f.type === 'image').map((f, i) => (
              <View key={i} style={{ marginRight: 8, position: 'relative' }}>
                <Image source={{ uri: f.uri }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                <TouchableOpacity
                  onPress={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{
                    position: 'absolute',
                    top: -4, right: -4,
                    backgroundColor: '#ef4444',
                    borderRadius: 10,
                    width: 20, height: 20,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* General Remarks */}
        <TextInput
          value={generalRemark}
          onChangeText={setGeneralRemark}
          placeholder="General remarks (optional)..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={2}
          style={{
            borderWidth: 1,
            borderColor: '#e5e7eb',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
            fontSize: 13,
            color: '#1f2937',
            backgroundColor: '#f9fafb',
            marginBottom: 10,
            minHeight: 48,
            textAlignVertical: 'top',
          }}
        />

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? '#86efac' : '#16a34a',
            borderRadius: 14,
            minHeight: 54,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#16a34a',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 }}>
              SUBMIT INSPECTION
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
