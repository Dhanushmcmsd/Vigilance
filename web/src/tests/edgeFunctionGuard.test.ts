import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.stubGlobal('Deno', {
  env: {
    get: (key: string) => {
      if (key === 'CRON_SECRET') return 'cron-test-secret';
      if (key === 'SUPABASE_URL') return 'https://test.supabase.co';
      if (key === 'SUPABASE_ANON_KEY') return 'anon-key';
      return undefined;
    },
  },
});

import {
  enforceCronOnlyGuard,
  enforceSecurityGuard,
} from '../../../supabase/functions/_shared/authGuard.ts';

describe('edge function auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    });
  });

  it('missing Authorization header → 401', async () => {
    const req = new Request('https://example.com/fn', { method: 'POST' });
    const res = await enforceSecurityGuard(req, { allowedRoles: ['admin'] });
    expect(res?.status).toBe(401);
  });

  it('malformed JWT → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid JWT') });

    const req = new Request('https://example.com/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    const res = await enforceSecurityGuard(req, { allowedRoles: ['admin'] });
    expect(res?.status).toBe(401);
  });

  it('valid JWT, role=officer, guard requires admin → 403', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'officer' }, error: null }),
    });

    const req = new Request('https://example.com/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer ey.test.token' },
    });
    const res = await enforceSecurityGuard(req, { allowedRoles: ['admin'] });
    expect(res?.status).toBe(403);
  });

  it('valid JWT, role=admin, guard requires admin → passes', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null }),
    });

    const req = new Request('https://example.com/fn', {
      method: 'POST',
      headers: { Authorization: 'Bearer ey.test.token' },
    });
    const res = await enforceSecurityGuard(req, { allowedRoles: ['admin'] });
    expect(res).toBeNull();
  });

  it('valid x-cron-secret, no JWT → passes for cron endpoint', async () => {
    const req = new Request('https://example.com/health-check', {
      method: 'GET',
      headers: { 'x-cron-secret': 'cron-test-secret' },
    });
    const res = enforceCronOnlyGuard(req);
    expect(res).toBeNull();
  });
});
