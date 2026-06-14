import { describe, expect, it, vi } from 'vitest';

import {
  resolveLocationStatus,
  verifyAndPersistLocationStatus,
} from '../../../supabase/functions/_shared/geofence.ts';

describe('geofence location_status resolution', () => {
  it('was_officer_in_range returns true → location_status = inside', () => {
    expect(
      resolveLocationStatus({
        latitude: 10.5,
        longitude: 76.2,
        rpcResult: true,
        rpcError: null,
      }),
    ).toBe('inside');
  });

  it('was_officer_in_range returns false → location_status = outside, submission still succeeds', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      from: vi.fn().mockReturnValue({ update }),
    };

    const status = await verifyAndPersistLocationStatus(supabase, {
      id: 'insp-1',
      officer_latitude: 10.5,
      officer_longitude: 76.2,
    });

    expect(status).toBe('outside');
    expect(update).toHaveBeenCalledWith({ location_status: 'outside' });
  });

  it('was_officer_in_range throws → location_status = unverified, submission still succeeds', () => {
    expect(
      resolveLocationStatus({
        latitude: 10.5,
        longitude: 76.2,
        rpcResult: null,
        rpcError: { message: 'PostGIS failure' },
      }),
    ).toBe('unverified');
  });

  it('null GPS coordinates → location_status = unverified, submission still succeeds', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const rpc = vi.fn();
    const supabase = {
      rpc,
      from: vi.fn().mockReturnValue({ update }),
    };

    const status = await verifyAndPersistLocationStatus(supabase, {
      id: 'insp-2',
      officer_latitude: null,
      officer_longitude: null,
    });

    expect(status).toBe('unverified');
    expect(rpc).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ location_status: 'unverified' });
  });

  it('client-sent location_status in payload → ignored, server value used instead', () => {
    expect(
      resolveLocationStatus({
        latitude: 10.5,
        longitude: 76.2,
        rpcResult: false,
        rpcError: null,
        clientLocationStatus: 'inside',
      }),
    ).toBe('outside');
  });
});
