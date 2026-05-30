import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

const QUEUE_KEY = 'offline_queue';

export interface QueuedInspection {
  id: string;  // local temp id
  payload: Record<string, any>;
  responses: Array<{ checklist_item_id: string; response: string; remarks?: string }>;
  fileUris: string[];
  queuedAt: string;
}

export async function addToQueue(item: QueuedInspection): Promise<void> {
  const existing = await getQueue();
  existing.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
}

export async function getQueue(): Promise<QueuedInspection[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function processQueue(): Promise<void> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining: QueuedInspection[] = [];

  for (const item of queue) {
    try {
      // Insert inspection
      const { data: insp, error } = await supabase
        .from('inspections')
        .insert(item.payload)
        .select('id')
        .single();
      if (error) throw error;

      const inspectionId = insp.id;

      // Insert responses
      if (item.responses.length > 0) {
        await supabase.from('inspection_responses').insert(
          item.responses.map(r => ({ ...r, inspection_id: inspectionId }))
        );
      }

      // Upload files
      for (const uri of item.fileUris) {
        try {
          const filename = uri.split('/').pop() ?? `file_${Date.now()}.jpg`;
          const response = await fetch(uri);
          const blob = await response.blob();
          const { data: uploadData } = await supabase.storage
            .from('inspection-files')
            .upload(`${inspectionId}/${filename}`, blob, { contentType: 'image/jpeg' });
          if (uploadData) {
            const { data: urlData } = supabase.storage
              .from('inspection-files')
              .getPublicUrl(uploadData.path);
            await supabase.from('inspection_files').insert({
              inspection_id: inspectionId,
              file_url: urlData.publicUrl,
              file_type: 'image',
            });
          }
        } catch {
          // File upload failure is non-fatal
        }
      }

      // Inspection synced successfully, don't push to remaining
    } catch {
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

export async function getQueueLength(): Promise<number> {
  const q = await getQueue();
  return q.length;
}
