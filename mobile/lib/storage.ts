import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DraftForm {
  branchId: string;
  branchName: string;
  branchType: string;
  date: string;
  timeIn: string;
  timeOut: string;
  responses: Record<string, { response: 'Yes' | 'No' | 'N/A' | null; remark: string }>;
  generalRemark: string;
  fileUris: string[];
  savedAt: string;
}

const DRAFT_PREFIX = 'draft_';
const QUEUE_KEY = 'offline_submission_queue';

export const saveDraft = async (branchId: string, date: string, data: DraftForm): Promise<void> => {
  const key = `${DRAFT_PREFIX}${branchId}_${date}`;
  await AsyncStorage.setItem(key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
};

export const loadDraft = async (branchId: string, date: string): Promise<DraftForm | null> => {
  const key = `${DRAFT_PREFIX}${branchId}_${date}`;
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
};

export const deleteDraft = async (branchId: string, date: string): Promise<void> => {
  const key = `${DRAFT_PREFIX}${branchId}_${date}`;
  await AsyncStorage.removeItem(key);
};

export const getAllDrafts = async (): Promise<{ key: string; draft: DraftForm }[]> => {
  const keys = await AsyncStorage.getAllKeys();
  const draftKeys = keys.filter((k) => k.startsWith(DRAFT_PREFIX));
  if (!draftKeys.length) return [];
  const pairs = await AsyncStorage.multiGet(draftKeys);
  return pairs
    .filter(([, v]) => v != null)
    .map(([k, v]) => ({ key: k, draft: JSON.parse(v!) }));
};

export const enqueueOfflineSubmission = async (data: DraftForm & { inspectionId?: string }): Promise<void> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: typeof data[] = raw ? JSON.parse(raw) : [];
  queue.push(data);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const getOfflineQueue = async (): Promise<(DraftForm & { inspectionId?: string })[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const clearOfflineQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
