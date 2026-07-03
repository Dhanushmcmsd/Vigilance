import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeInspectionComplianceScore,
  inspectionSubmitBlocked,
} from '@/lib/checklistScoring';
import { mockMobileRpc, supabase as mobileSupabase } from './mocks/mobileSupabase';
import { claimBranchInspection } from '@mobile/lib/branchLocks';
import {
  MAX_SYNC_ATTEMPTS,
  flushQueue,
  peekQueue,
  queueInspection,
  queueSize,
} from '@mobile/lib/syncQueue';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    getAllKeys: vi.fn(async () => [...storage.keys()]),
    multiGet: vi.fn(async (keys: string[]) => keys.map((k) => [k, storage.get(k) ?? null])),
  },
}));

vi.mock('react-native-mmkv', () => ({
  MMKV: class MockMmkv {
    private store = new Map<string, string>();
    getString(key: string) {
      return this.store.get(key);
    }
    set(key: string, value: string) {
      this.store.set(key, value);
    }
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn(async () => ({ isConnected: true })),
  },
}));

const draftPayload = {
  branchId: 'branch-1',
  branchName: 'Test Store',
  branchType: 'Store',
  date: '2026-06-14',
  timeIn: '09:00',
  timeOut: '10:00',
  responses: {
    a: { response: 'Yes' as const, remark: '' },
    b: { response: 'No' as const, remark: '' },
  },
  generalRemark: '',
  savedAt: new Date().toISOString(),
  officerLat: null,
  officerLon: null,
};

describe('inspection business logic', () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it('compliance score: 2 red + 1 yellow + 2 green → 40%', () => {
    const rows = [
      { response: 'No', triggerOnNo: true },
      { response: 'No', triggerOnNo: true },
      { response: 'No', triggerOnNo: true },
      { response: 'Yes', triggerOnNo: true },
      { response: 'Yes', triggerOnNo: true },
    ];
    expect(computeInspectionComplianceScore(rows)).toBe(40);
  });

  it('addToSyncQueue: length increments, item retrievable by id', async () => {
    expect(await queueSize()).toBe(0);
    await queueInspection({ ...draftPayload, inspectionId: 'insp-42' });
    expect(await queueSize()).toBe(1);
    const queued = await peekQueue();
    expect(queued[0]?.inspectionId).toBe('insp-42');
    expect(queued[0]?.branchId).toBe('branch-1');
  });

  it(`exhausted item (attempts >= ${MAX_SYNC_ATTEMPTS}) → excluded from flush`, async () => {
    storage.set(
      'sync_queue_v2',
      JSON.stringify([
        {
          ...draftPayload,
          inspectionId: 'insp-retry',
          queuedAt: Date.now(),
          attempts: MAX_SYNC_ATTEMPTS - 1,
        },
      ]),
    );

    vi.mocked(mobileSupabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const result = await flushQueue();
    expect(result.abandoned).toBe(1);
    expect(await queueSize()).toBe(0);
  });

  it('submit guard: empty responses → returns true (blocked)', () => {
    expect(
      inspectionSubmitBlocked(['item-1', 'item-2'], {
        'item-1': { response: null },
        'item-2': { response: null },
      }),
    ).toBe(true);
  });

  it('duplicate branch+date → conflict detected on second claim', async () => {
    mockMobileRpc
      .mockResolvedValueOnce({ data: 'insp-a', error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'BRANCH_COMPLETED: Report completed for this store today.' },
      });

    const first = await claimBranchInspection('branch-1');
    const second = await claimBranchInspection('branch-1');

    expect(first.inspectionId).toBe('insp-a');
    expect(second.errorCode).toBe('BRANCH_COMPLETED');
    expect(second.inspectionId).toBeNull();
  });
});
