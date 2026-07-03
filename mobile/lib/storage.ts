import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DraftForm } from './draftForm';

export type { DraftForm } from './draftForm';
const DRAFT_PREFIX = 'draft_';
const QUEUE_KEY = 'offline_submission_queue';

export const saveDraft = async (branchId: string, date: string, data: DraftForm): Promise<void> => {
  const key = `${DRAFT_PREFIX}${branchId}_${date}`;
  await AsyncStorage.setItem(key, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
};

export const loadDraft = async (branchId: string, date: string): Promise<DraftForm | null> => {
  const key = `${DRAFT_PREFIX}${branchId}_${date}`;
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  // Gracefully handle older drafts that don't have GPS fields
  return {
    ...parsed,
    officerLat: parsed.officerLat ?? null,
    officerLon: parsed.officerLon ?? null,
  };
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
    .map(([k, v]) => {
      const parsed = JSON.parse(v!);
      return {
        key: k,
        draft: {
          ...parsed,
          officerLat: parsed.officerLat ?? null,
          officerLon: parsed.officerLon ?? null,
        },
      };
    });
};

export const getOfflineQueue = async (): Promise<(DraftForm & { inspectionId?: string })[]> => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  const queue = JSON.parse(raw);
  // Gracefully handle older queued items that don't have GPS fields
  return queue.map((item: any) => ({
    ...item,
    officerLat: item.officerLat ?? null,
    officerLon: item.officerLon ?? null,
  }));
};

export const clearOfflineQueue = async (): Promise<void> => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};
