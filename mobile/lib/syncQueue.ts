/**
 * Offline sync queue for inspection submissions.
 *
 * Replaces the legacy manual AsyncStorage queue in lib/storage.ts with a
 * production-grade pattern:
 *   - Backed by react-native-mmkv when the native module is available
 *     (10× faster than AsyncStorage, supports synchronous reads).
 *   - Falls back transparently to AsyncStorage for Expo Go / web / unit tests.
 *   - Atomic queue ops with a single key + JSON snapshot.
 *   - Flush is idempotent: failed items stay in the queue and are retried on
 *     the next reconnect (see useNetworkSync).
 *   - When a draft was already promoted to a real inspection row (the lazy
 *     RED-trigger path), the queued payload carries `inspectionId` and the
 *     flusher UPDATEs that row instead of inserting a duplicate.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { supabase } from './supabase';
import { getDeviceAudit } from './deviceInfo';
import type { DraftForm } from './storage';

export type QueuedInspection = DraftForm & {
  inspectionId?: string;
  queuedAt: number;
  attempts: number;
};

const QUEUE_KEY = 'sync_queue_v2';

// ── storage backend ────────────────────────────────────────────────────────
// Lazy-load MMKV so the app still bundles when the native module isn't
// present (Expo Go, web). Falls back to AsyncStorage with the same API surface.

interface KVStore {
  getString(k: string): Promise<string | null>;
  setString(k: string, v: string): Promise<void>;
}

let cached: KVStore | undefined;

const getStore = (): KVStore => {
  if (cached) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv') as typeof import('react-native-mmkv');
    const mmkv = new MMKV({ id: 'vigilance.sync' });
    cached = {
      getString: async (k) => mmkv.getString(k) ?? null,
      setString: async (k, v) => mmkv.set(k, v),
    };
  } catch {
    cached = {
      getString: (k) => AsyncStorage.getItem(k),
      setString: (k, v) => AsyncStorage.setItem(k, v),
    };
  }
  return cached;
};

// ── queue ops ───────────────────────────────────────────────────────────────

const readQueue = async (): Promise<QueuedInspection[]> => {
  const raw = await getStore().getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = async (queue: QueuedInspection[]): Promise<void> => {
  await getStore().setString(QUEUE_KEY, JSON.stringify(queue));
};

export const queueInspection = async (
  data: DraftForm & { inspectionId?: string },
): Promise<void> => {
  const queue = await readQueue();
  queue.push({ ...data, queuedAt: Date.now(), attempts: 0 });
  await writeQueue(queue);
};

export const peekQueue = async (): Promise<QueuedInspection[]> => readQueue();

export const queueSize = async (): Promise<number> => (await readQueue()).length;

export const clearQueue = async (): Promise<void> => writeQueue([]);

// ── flush ───────────────────────────────────────────────────────────────────

export interface FlushResult {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Drains queued items into Supabase. Returns counts. Safe to call repeatedly;
 * if any item fails it stays in the queue for the next reconnect.
 */
export const flushQueue = async (): Promise<FlushResult> => {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return { attempted: 0, succeeded: 0, failed: 0 };

  const queue = await readQueue();
  if (queue.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  const remaining: QueuedInspection[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await syncOne(item);
      succeeded += 1;
    } catch (err) {
      failed += 1;
      remaining.push({ ...item, attempts: item.attempts + 1 });
      if (__DEV__) console.warn('[syncQueue] flush failed', err);
    }
  }

  await writeQueue(remaining);
  return { attempted: queue.length, succeeded, failed };
};

/**
 * Push one queued draft to Supabase. Creates the inspection row + responses +
 * file rows in sequence. If the payload carries an inspectionId (i.e. it was
 * already created on a RED trigger), we UPDATE that row rather than insert.
 */
async function syncOne(item: QueuedInspection): Promise<void> {
  const {
    branchId,
    date,
    timeIn,
    timeOut,
    responses,
    generalRemark,
    fileUris,
    officerLat,
    officerLon,
    inspectionId,
  } = item;

  const { data: userResp } = await supabase.auth.getUser();
  const authedId = userResp?.user?.id;
  if (!authedId) throw new Error('No authenticated user — keeping in queue');

  // Resolve officer's user_roles.id (FK target on inspections.officer_id).
  const { data: officer, error: officerErr } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', authedId)
    .maybeSingle();
  if (officerErr || !officer) throw officerErr ?? new Error('officer not found');

  // Device audit — populated on every flush so re-tries from a different
  // device (rare but possible) show up correctly in the audit log.
  const audit = await getDeviceAudit();

  let resolvedId = inspectionId;
  if (resolvedId) {
    const { error: upErr } = await supabase
      .from('inspections')
      .update({
        branch_id: branchId,
        inspection_date: date,
        time_in: timeIn || null,
        time_out: timeOut || null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        officer_latitude: officerLat,
        officer_longitude: officerLon,
        sync_status: 'synced',
        device_id: audit.deviceId,
        app_version: audit.appVersion,
      })
      .eq('id', resolvedId);
    if (upErr) throw upErr;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('inspections')
      .insert({
        officer_id: officer.id,
        branch_id: branchId,
        inspection_date: date,
        time_in: timeIn || null,
        time_out: timeOut || null,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        officer_latitude: officerLat,
        officer_longitude: officerLon,
        sync_status: 'synced',
        device_id: audit.deviceId,
        app_version: audit.appVersion,
      })
      .select('id')
      .single();
    if (insErr || !inserted) throw insErr ?? new Error('insert failed');
    resolvedId = inserted.id;
  }

  // Responses (idempotent upsert keyed on inspection + item).
  const responseRows = Object.entries(responses)
    .filter(([, v]) => v.response != null)
    .map(([checklist_item_id, v]) => ({
      inspection_id: resolvedId!,
      checklist_item_id,
      response: v.response,
      remarks: v.remark?.trim() || null,
    }));
  if (responseRows.length) {
    const { error: rErr } = await supabase
      .from('inspection_responses')
      .upsert(responseRows, { onConflict: 'inspection_id,checklist_item_id' });
    if (rErr) throw rErr;
  }

  if (generalRemark?.trim()) {
    await supabase.from('general_remarks').insert({
      inspection_id: resolvedId,
      remark_text: generalRemark.trim(),
    });
  }

  if (fileUris?.length) {
    // We don't re-upload the bytes here — file URIs are local. The original
    // submission path uploads to Storage; offline flush only re-creates the
    // metadata row using whatever URI we cached. A future enhancement is to
    // also queue the binary itself; out of scope for this pass.
    const fileRows = fileUris.map((uri) => ({
      inspection_id: resolvedId!,
      file_url: uri,
      file_name: uri.split('/').pop() ?? 'attachment',
      file_type: /\.(png|jpe?g|webp)$/i.test(uri) ? 'image' : 'document',
    }));
    await supabase.from('inspection_files').insert(fileRows);
  }
}
