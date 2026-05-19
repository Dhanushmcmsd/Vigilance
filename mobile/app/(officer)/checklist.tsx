import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  Animated,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { saveDraft, loadDraft, deleteDraft } from '../../lib/storage';
import { queueInspection } from '../../lib/syncQueue';
import { getDeviceAudit } from '../../lib/deviceInfo';
import { useLocationPing } from '../../lib/useLocationPing';
import { ToastMessage } from '../../components/ToastMessage';
import { ItemAttachments, type ItemAttachment } from '../../components/ItemAttachments';
import { isViolationResponse, responseButtonColors } from '../../lib/checklistScoring';
import { uploadInspectionFiles } from '../../lib/uploadInspectionFiles';
import { claimBranchInspection } from '../../lib/branchLocks';

const today = new Date().toISOString().split('T')[0];
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const YELLOW_REALTIME_THRESHOLD = 3;
const ITEMS_PER_PAGE = 4;

export default function ChecklistScreen() {
  const { branchId, branchName, branchType, officerLat, officerLon, inspectionId: routeInspectionId } =
    useLocalSearchParams<{
      branchId: string;
      branchName: string;
      branchType: string;
      officerLat: string;
      officerLon: string;
      inspectionId?: string;
    }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, userRolesId } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [items, setItems] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, { response: 'Yes' | 'No' | 'N/A' | null; remark: string }>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [date] = useState(today);
  const [timeIn] = useState(nowTime());
  const [timeOut, setTimeOut] = useState('');
  const [generalRemark, setGeneralRemark] = useState('');
  const [itemFiles, setItemFiles] = useState<Record<string, ItemAttachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'warning' }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageOpacity] = useState(new Animated.Value(1));
  const [transitioning, setTransitioning] = useState(false);
  const [highlightedPage, setHighlightedPage] = useState<number | null>(null);

  const [triggeredRedItems, setTriggeredRedItems] = useState<Set<string>>(new Set());
  const [yellowCount, setYellowCount] = useState(0);
  const [yellowAlertSent, setYellowAlertSent] = useState(false);

  const [activeInspectionId, setActiveInspectionId] = useState<string | null>(null);
  const [inspectionActive, setInspectionActive] = useState(false);
  const [itemRemarkToggles, setItemRemarkToggles] = useState<Record<string, boolean>>({});
  const [remarksExpanded, setRemarksExpanded] = useState(false);
  const { pingCount } = useLocationPing({ inspectionId: activeInspectionId, isActive: inspectionActive });

  const showToast = (message: string, type: 'success' | 'error' | 'warning') =>
    setToast({ visible: true, message, type });

  const toggleRemarkVisibility = (itemId: string) => {
    setItemRemarkToggles((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const isRemarkVisible = (itemId: string) => !!itemRemarkToggles[itemId];

  const resolveRiskBadge = (risk_level?: 'RED' | 'YELLOW' | 'GREEN') => {
    if (risk_level === 'RED') return { backgroundColor: '#fef2f2', color: '#dc2626', label: 'RED' };
    if (risk_level === 'YELLOW') return { backgroundColor: '#fffbeb', color: '#d97706', label: 'YELLOW' };
    return { backgroundColor: '#f0fdf4', color: '#16a34a', label: 'GREEN' };
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          id, section, item_text, item_order, risk_level, trigger_on_no,
          risk_classifications:risk_classifications!risk_classifications_checklist_item_id_fkey (
            risk_level, trigger_on_no, min_remark_chars, requires_photo
          )
        `)
        .eq('is_active', true)
        .order('item_order');

      if (error) {
        const fallback = await supabase
          .from('checklist_templates')
          .select('id, section, item_text, item_order, risk_level, trigger_on_no')
          .eq('is_active', true)
          .order('item_order');
        if (fallback.data) hydrateItems(fallback.data as any);
        setLoading(false);
        return;
      }

      hydrateItems(data as any);
      setLoading(false);
    })();
  }, []);

  const hydrateItems = (rows: any[]) => {
    const mapped = rows.map((r) => {
      const rc = Array.isArray(r.risk_classifications)
        ? r.risk_classifications[0]
        : r.risk_classifications;
      return {
        id: r.id,
        section: r.section,
        item_text: r.item_text,
        item_order: r.item_order,
        risk_level: (rc?.risk_level ?? r.risk_level) as 'RED' | 'YELLOW' | 'GREEN' | undefined,
        trigger_on_no: rc?.trigger_on_no ?? r.trigger_on_no ?? false,
        min_remark_chars: rc?.min_remark_chars ?? undefined,
        requires_photo: rc?.requires_photo ?? false,
      };
    });
    setItems(mapped);
    const sections = new Set(mapped.map((i) => i.section));
    setExpandedSections(sections);
    const init: Record<string, { response: 'Yes' | 'No' | 'N/A' | null; remark: string }> = {};
    mapped.forEach((i) => {
      init[i.id] = { response: null, remark: '' };
    });
    setResponses(init);
  };

  useEffect(() => {
    loadDraft(branchId, today).then((draft) => {
      if (draft) {
        Alert.alert('Resume Draft?', 'A saved draft was found for this branch today. Resume it?', [
          { text: 'Start Fresh', style: 'destructive' },
          {
            text: 'Resume', onPress: () => {
              setResponses(draft.responses as any);
              setGeneralRemark(draft.generalRemark);
              setTimeOut(draft.timeOut);
              if (draft.itemFiles) setItemFiles(draft.itemFiles);
            },
          },
        ]);
      }
    });
  }, []);

  const sections = useMemo(() => {
    const map: Record<string, any[]> = {};
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

  useEffect(() => {
    if (!branchId) return;
    if (routeInspectionId) {
      setActiveInspectionId(routeInspectionId);
      setInspectionActive(true);
      return;
    }
    void (async () => {
      const claim = await claimBranchInspection(branchId);
      if (claim.inspectionId) {
        setActiveInspectionId(claim.inspectionId);
        setInspectionActive(true);
      } else {
        Alert.alert('Store unavailable', claim.message, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    })();
  }, [branchId, routeInspectionId, router]);

  const ensureInspection = useCallback(async (): Promise<string | null> => {
    if (activeInspectionId) return activeInspectionId;
    if (routeInspectionId) {
      setActiveInspectionId(routeInspectionId);
      setInspectionActive(true);
      return routeInspectionId;
    }
    if (!userRolesId || !branchId) return null;
    const audit = await getDeviceAudit();
    const { data, error } = await supabase
      .from('inspections')
      .insert({
        officer_id: userRolesId,
        branch_id: branchId,
        inspection_date: date,
        time_in: timeIn || null,
        status: 'draft',
        sync_status: 'synced',
        device_id: audit.deviceId,
        app_version: audit.appVersion,
        officer_latitude: officerLat ? parseFloat(officerLat) : null,
        officer_longitude: officerLon ? parseFloat(officerLon) : null,
      })
      .select('id')
      .single();
    if (error || !data) {
      showToast('Could not initialise inspection for escalation', 'error');
      return null;
    }
    setActiveInspectionId(data.id);
    setInspectionActive(true);
    return data.id;
  }, [activeInspectionId, userRolesId, branchId, date, timeIn, officerLat, officerLon]);

  const handleRedTriggered = useCallback(
    async (itemId: string) => {
      let firstTime = false;
      setTriggeredRedItems((prev) => {
        if (prev.has(itemId)) return prev;
        firstTime = true;
        const next = new Set(prev);
        next.add(itemId);
        return next;
      });

      if (!firstTime) return;

      const inspId = await ensureInspection();
      if (!inspId) return;

      const redCount = triggeredRedItems.size + 1;

      supabase.functions
        .invoke('red-alert', {
          body: {
            inspection_id: inspId,
            checklist_item_id: itemId,
            officer_id: userRolesId,
            branch_id: branchId,
            red_count: redCount,
          },
        })
        .catch(() => {
          showToast('Escalation alert queued — will retry in background', 'warning');
        });
    },
    [ensureInspection, triggeredRedItems, userRolesId, branchId],
  );

  const lastTriggeredRedResponse = useRef<Record<string, 'Yes' | 'No' | 'N/A' | null>>({});
  const handleResponse = useCallback(
    (itemId: string, response: 'Yes' | 'No' | 'N/A' | null) => {
      setResponses((prev) => {
        const previous = prev[itemId]?.response ?? null;
        const next = { ...prev, [itemId]: { ...prev[itemId], response } };

        const item = items.find((i) => i.id === itemId);
        if (item?.risk_level === 'YELLOW') {
          const triggers =
            (item.trigger_on_no && response === 'No') ||
            (!item.trigger_on_no && response === 'Yes');
          const previouslyTriggered =
            (item.trigger_on_no && previous === 'No') ||
            (!item.trigger_on_no && previous === 'Yes');
          if (triggers && !previouslyTriggered) {
            setYellowCount((c) => c + 1);
          } else if (!triggers && previouslyTriggered) {
            setYellowCount((c) => Math.max(0, c - 1));
          }
        }

        if (item?.risk_level === 'RED' && response !== null) {
          const triggers =
            (item.trigger_on_no && response === 'No') ||
            (!item.trigger_on_no && response === 'Yes');
          if (triggers && lastTriggeredRedResponse.current[itemId] !== response) {
            lastTriggeredRedResponse.current[itemId] = response;
            handleRedTriggered(itemId);
          }
        }

        if (
          item &&
          response &&
          isViolationResponse(response, item.trigger_on_no ?? true)
        ) {
          setItemRemarkToggles((prev) => ({ ...prev, [itemId]: true }));
        }

        return next;
      });
    },
    [handleRedTriggered, items]
  );

  const handleRemark = useCallback((itemId: string, remark: string) => {
    setResponses((prev) => ({ ...prev, [itemId]: { ...prev[itemId], remark } }));
  }, []);

  useEffect(() => {
    if (yellowCount < YELLOW_REALTIME_THRESHOLD || yellowAlertSent) return;
    setYellowAlertSent(true);
    (async () => {
      const inspId = await ensureInspection();
      if (!inspId) return;
      supabase.functions
        .invoke('red-alert', {
          body: {
            inspection_id: inspId,
            officer_id: userRolesId,
            branch_id: branchId,
            template: 'YELLOW_REALTIME',
            yellow_count: yellowCount,
          },
        })
        .catch(() => {
          // Non-fatal — the supervisor will see them on submit anyway.
        });
    })();
  }, [yellowCount, yellowAlertSent, ensureInspection, userRolesId, branchId]);


  const handleSaveDraft = async () => {
    await saveDraft(branchId, today, {
      branchId,
      branchName,
      branchType: branchType || '',
      date,
      timeIn,
      timeOut,
      responses: responses as any,
      generalRemark,
      itemFiles,
      savedAt: new Date().toISOString(),
      officerLat: officerLat ? parseFloat(officerLat) : null,
      officerLon: officerLon ? parseFloat(officerLon) : null,
    });
    showToast('Draft saved successfully', 'success');
  };

  const appendItemFiles = useCallback((itemId: string, incoming: ItemAttachment[]) => {
    setItemFiles((prev) => ({
      ...prev,
      [itemId]: [...(prev[itemId] ?? []), ...incoming],
    }));
  }, []);

  const removeItemFile = useCallback((itemId: string, uri: string) => {
    setItemFiles((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] ?? []).filter((f) => f.uri !== uri),
    }));
  }, []);

  const pickImageForItem = useCallback(
    async (itemId: string) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled) {
        appendItemFiles(
          itemId,
          result.assets.map((a) => ({
            uri: a.uri,
            name: a.fileName || `photo_${Date.now()}.jpg`,
            type: 'image' as const,
          })),
        );
      }
    },
    [appendItemFiles],
  );

  const pickDocumentForItem = useCallback(
    async (itemId: string) => {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true });
      if (!result.canceled) {
        appendItemFiles(
          itemId,
          result.assets.map((a) => ({
            uri: a.uri,
            name: a.name,
            type: 'document' as const,
          })),
        );
      }
    },
    [appendItemFiles],
  );

  const totalAttachmentCount = useMemo(
    () => Object.values(itemFiles).reduce((sum, list) => sum + list.length, 0),
    [itemFiles],
  );

  const pageCount = useMemo(() => Math.ceil(items.length / ITEMS_PER_PAGE), [items.length]);
  const currentPageItems = useMemo(
    () => items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [items, currentPage]
  );
  const currentPageComplete = useMemo(
    () =>
      currentPageItems.every((item) => {
        const r = responses[item.id]?.response;
        return r !== null && r !== undefined;
      }),
    [currentPageItems, responses],
  );
  const currentPageSections = useMemo(() => {
    const map: Record<string, any[]> = {};
    currentPageItems.forEach((item) => {
      if (!map[item.section]) map[item.section] = [];
      map[item.section].push(item);
    });
    return map;
  }, [currentPageItems]);
  const sectionsOnPage = useMemo(
    () => Object.keys(currentPageSections),
    [currentPageSections]
  );
  const firstUnansweredPage = useMemo(() => {
    const index = items.findIndex((item) => responses[item.id]?.response === null);
    return index === -1 ? null : Math.floor(index / ITEMS_PER_PAGE) + 1;
  }, [items, responses]);

  const progressPercent = useMemo(() => Math.round((answeredCount / (items.length || 1)) * 100), [answeredCount, items.length]);
  const isLastPage = currentPage === pageCount;
  const sectionAnsweredCount = useCallback(
    (section: string) => currentPageSections[section]?.filter((item) => responses[item.id]?.response !== null).length ?? 0,
    [responses, currentPageSections]
  );
  const sectionItemCount = useCallback(
    (section: string) => currentPageSections[section]?.length ?? 0,
    [currentPageSections]
  );

  const animatePage = useCallback(
    (nextPage: number) => {
      if (transitioning || nextPage < 1 || nextPage > pageCount || nextPage === currentPage) return;
      Keyboard.dismiss();
      setTransitioning(true);
      Animated.timing(pageOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setCurrentPage(nextPage);
        setHighlightedPage(null);
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        Animated.timing(pageOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }).start(() => setTransitioning(false));
      });
    },
    [currentPage, pageCount, pageOpacity, transitioning]
  );

  useEffect(() => {
    const pageItems = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const allAnswered =
      pageItems.length > 0 &&
      pageItems.every((item) => responses[item.id]?.response !== null && responses[item.id]?.response !== undefined);

    if (!allAnswered || currentPage === pageCount) return;
    const timer = setTimeout(() => animatePage(currentPage + 1), 400);
    return () => clearTimeout(timer);
  }, [responses, currentPage, pageCount, items, animatePage]);

  const handleSubmit = async () => {
    const unanswered = items.filter((i) => responses[i.id]?.response === null);
    if (unanswered.length > 0) {
      const targetPage = firstUnansweredPage ?? 1;
      setHighlightedPage(targetPage);
      animatePage(targetPage);
      Alert.alert('Incomplete Inspection', `Please complete page ${targetPage} before submitting.`);
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
              // If a RED already triggered while online, an inspections row
              // exists in draft state — pass its id so the offline queue can
              // UPDATE that row instead of inserting a duplicate.
              await queueInspection({
                branchId,
                branchName,
                branchType: branchType || '',
                date,
                timeIn,
                timeOut,
                responses: responses as any,
                generalRemark,
                itemFiles,
                savedAt: new Date().toISOString(),
                officerLat: officerLat ? parseFloat(officerLat) : null,
                officerLon: officerLon ? parseFloat(officerLon) : null,
                inspectionId: activeInspectionId ?? undefined,
              });
              setSubmitting(false);
              showToast('Saved offline — will sync when connected', 'warning');
              return;
            }

            try {
              const inspectionId = await ensureInspection();
              if (!inspectionId) throw new Error('Inspection creation failed');

              const responseRows = items.map((item) => ({
                inspection_id: inspectionId,
                checklist_item_id: item.id,
                response: responses[item.id]?.response,
                remarks: responses[item.id]?.remark || null,
              }));
              const { error: respErr } = await supabase.from('inspection_responses').insert(responseRows);
              if (respErr) throw new Error(respErr.message);

              await uploadInspectionFiles(inspectionId, itemFiles);

              if (generalRemark.trim()) {
                await supabase.from('general_remarks').insert({
                  inspection_id: inspectionId,
                  remark_text: generalRemark.trim(),
                });
              }

              const submitAudit = await getDeviceAudit();
              await supabase
                .from('inspections')
                .update({
                  status: 'submitted',
                  time_out: timeOut || null,
                  submitted_at: new Date().toISOString(),
                  sync_status: 'synced',
                  device_id: submitAudit.deviceId,
                  app_version: submitAudit.appVersion,
                })
                .eq('id', inspectionId);

              setInspectionActive(false);
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
                  filesCount: String(totalAttachmentCount),
                },
              });
            } catch (e: any) {
              setInspectionActive(false);
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={{ marginTop: 12, color: '#6b7280' }}>Loading checklist...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9', paddingTop: insets.top }}>
      <ToastMessage
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((p) => ({ ...p, visible: false }))}
      />

      <View style={{ backgroundColor: '#1e3a5f', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: '#fff', marginHorizontal: 12 }} numberOfLines={1}>
          {branchName}
        </Text>
        <TouchableOpacity
          onPress={handleSaveDraft}
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            padding: 14,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Officer</Text>
              <Text style={{ fontSize: 13, color: '#111827', fontWeight: '600', marginTop: 2 }}>{userName}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Date</Text>
              <Text style={{ fontSize: 13, color: '#111827', fontWeight: '600', marginTop: 2 }}>{date}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Time In</Text>
              <Text style={{ fontSize: 13, color: '#111827', fontWeight: '600', marginTop: 2 }}>{timeIn}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Time Out</Text>
              <TextInput
                value={timeOut}
                onChangeText={setTimeOut}
                placeholder="HH:MM"
                placeholderTextColor="#9ca3af"
                style={{
                  marginTop: 2,
                  fontSize: 13,
                  color: '#111827',
                  borderBottomWidth: 1,
                  borderBottomColor: '#d1d5db',
                  paddingVertical: 2,
                }}
              />
            </View>
          </View>
        </View>

        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: '#111827', fontSize: 13, fontWeight: '600' }}>Progress</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: progressPercent < 40 ? '#ef4444' : progressPercent < 80 ? '#f59e0b' : '#16a34a' }}>
              {progressPercent}%
            </Text>
          </View>
          <View style={{ height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <View style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#2563eb' }} />
          </View>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>{answeredCount} of {items.length} answered</Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e3a5f' }}>{sectionsOnPage[0]}</Text>
          <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '700' }}>
              Page {currentPage} of {pageCount}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: pageCount }, (_, idx) => {
            const page = idx + 1;
            const active = page === currentPage;
            const completed = page < currentPage;
            return (
              <View
                key={page}
                style={{
                  width: 28,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: completed ? '#16a34a' : active ? '#2563eb' : '#e2e8f0',
                }}
              />
            );
          })}
        </View>

        <Animated.View style={{ opacity: pageOpacity }}>
          {sectionsOnPage.map((section) => (
            <View key={section} style={{ marginBottom: 12 }}>
            <View
              style={{
                backgroundColor: '#1e3a5f',
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{section}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {sectionAnsweredCount(section)}/{sectionItemCount(section)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </View>

            {currentPageSections[section].map((item) => {
              const badge = resolveRiskBadge(item.risk_level);
              const response = responses[item.id]?.response ?? null;
              const remark = responses[item.id]?.remark ?? '';
              const effectiveMinChars = item.min_remark_chars ?? 0;
              const remarkLen = remark.length;
              const remarkBelowMin = effectiveMinChars > 0 && remarkLen < effectiveMinChars;
              const showRemark = isRemarkVisible(item.id);
              const triggerOnNo = item.trigger_on_no ?? true;
              const itemAttachments = itemFiles[item.id] ?? [];

              return (
                <View
                  key={item.id}
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ backgroundColor: badge.backgroundColor, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: badge.color }}>{badge.label}</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827', lineHeight: 22, marginVertical: 12 }}>
                    {item.item_text}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {(
                      [
                        { label: '✓ YES', value: 'Yes' as const },
                        { label: '✗ NO', value: 'No' as const },
                        { label: '— N/A', value: 'N/A' as const },
                      ]
                    ).map((button) => {
                      const active = response === button.value;
                      const colors =
                        button.value === 'N/A'
                          ? {
                              activeColor: '#475569',
                              activeBg: '#f1f5f9',
                              inactiveColor: '#6b7280',
                            }
                          : responseButtonColors(button.value, response, triggerOnNo);
                      return (
                        <TouchableOpacity
                          key={button.value}
                          onPress={() => handleResponse(item.id, button.value)}
                          activeOpacity={0.75}
                          style={{
                            flex: 1,
                            borderRadius: 12,
                            paddingVertical: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: active ? colors.activeBg : '#f8fafc',
                            borderWidth: 1.5,
                            borderColor: active ? colors.activeColor : '#e2e8f0',
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: '700',
                              color: active ? colors.activeColor : colors.inactiveColor,
                            }}
                          >
                            {button.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <ItemAttachments
                    files={itemAttachments}
                    onAddPhoto={() => void pickImageForItem(item.id)}
                    onAddDocument={() => void pickDocumentForItem(item.id)}
                    onRemove={(uri) => removeItemFile(item.id, uri)}
                  />

                  <TouchableOpacity onPress={() => toggleRemarkVisibility(item.id)} activeOpacity={0.75}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#2563eb' }}>
                      {showRemark ? '▲ Hide remark' : '+ Add remark'}
                    </Text>
                  </TouchableOpacity>

                  {showRemark && (
                    <View style={{ marginTop: 10 }}>
                      <TextInput
                        value={remark}
                        onChangeText={(text) => handleRemark(item.id, text)}
                        placeholder="Type your remark here..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        numberOfLines={3}
                        style={{
                          fontSize: 13,
                          color: '#111827',
                          borderBottomWidth: 1,
                          borderBottomColor: remarkBelowMin ? '#dc2626' : '#d1d5db',
                          paddingVertical: 8,
                        }}
                      />
                      {effectiveMinChars > 0 && (
                        <Text style={{ marginTop: 6, fontSize: 11, fontWeight: '600', color: remarkBelowMin ? '#dc2626' : '#16a34a' }}>
                          {remarkLen}/{effectiveMinChars} characters{remarkBelowMin ? ` — ${effectiveMinChars - remarkLen} more required` : ' ✓'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}
        </Animated.View>

        {isLastPage && (
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 16,
              padding: 16,
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 3,
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              onPress={() => setRemarksExpanded((prev) => !prev)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: remarksExpanded ? 12 : 0 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>General Remarks (optional)</Text>
              <Ionicons name={remarksExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#2563eb" />
            </TouchableOpacity>
            {remarksExpanded && (
              <TextInput
                value={generalRemark}
                onChangeText={setGeneralRemark}
                placeholder="Overall observations for this visit..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: 14,
                  padding: 12,
                  fontSize: 13,
                  color: '#111827',
                  minHeight: 90,
                }}
              />
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
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
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => animatePage(currentPage - 1)}
            disabled={currentPage === 1 || transitioning}
            style={{
              flex: 1,
              minHeight: 52,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: '#e2e8f0',
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#374151' }}>Previous</Text>
          </TouchableOpacity>
          {currentPage < pageCount ? (
            !currentPageComplete && (
              <TouchableOpacity
                onPress={() => animatePage(currentPage + 1)}
                disabled={transitioning}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 14,
                  backgroundColor: '#2563eb',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Next</Text>
              </TouchableOpacity>
            )
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1,
                minHeight: 52,
                borderRadius: 14,
                backgroundColor: submitting ? '#93c5fd' : '#16a34a',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Submit Inspection ✓</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        <Text style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          {currentPageComplete && currentPage < pageCount
            ? 'All answers complete — moving to the next page shortly.'
            : 'Answer all items on this page to continue.'}
        </Text>
      </View>
    </View>
  );
}
