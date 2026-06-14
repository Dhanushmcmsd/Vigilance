import { vi } from 'vitest';

export const mockMobileRpc = vi.fn();

export const supabaseUrl = 'https://test.supabase.co';
export const supabaseAnonKey = 'test-anon-key';

export const supabase = {
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
  },
  from: vi.fn(),
  rpc: (...args: unknown[]) => mockMobileRpc(...args),
};
