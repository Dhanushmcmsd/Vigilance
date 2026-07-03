import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('react-native-url-polyfill/auto', () => ({}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: vi.fn(),
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));
