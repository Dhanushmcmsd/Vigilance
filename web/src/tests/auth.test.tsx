import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthContext';
import RoleGuard from '@/components/RoleGuard';
import { supabase } from '@/lib/supabase';

type AuthListener = (event: string, session: { user: { id: string } } | null) => void;

let authListener: AuthListener | null = null;

async function emitInitialSession(session: { user: { id: string } } | null) {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    authListener?.('INITIAL_SESSION', session);
    await Promise.resolve();
  });
}

function mockRoleLookup(role: string | null, name = 'Test User') {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: role ? [{ role, name, accepted_policy_version: '1' }] : [],
    error: null,
  } as never);
}

function seedRoleCache(userId: string, role: string, name: string) {
  sessionStorage.setItem(
    'vms_auth_profile',
    JSON.stringify({
      userId,
      role,
      name,
      acceptedPolicyVersion: '1',
      cachedAt: Date.now(),
    }),
  );
}

function ProtectedAdmin() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <div>Admin Panel</div>
    </RoleGuard>
  );
}

function ProtectedDashboard() {
  return (
    <RoleGuard allowedRoles={['management', 'audit']}>
      <div>Management Dashboard</div>
    </RoleGuard>
  );
}

describe('auth route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authListener = null;
    sessionStorage.clear();

    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((cb) => {
      authListener = cb as AuthListener;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as never;
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);
  });

  it('no session → redirect to /login before protected route renders', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/admin" element={<ProtectedAdmin />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitInitialSession(null);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('admin JWT → /admin mounts without redirect', async () => {
    mockRoleLookup('admin', 'Admin User');
    seedRoleCache('admin-user-id', 'admin', 'Admin User');

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/admin" element={<ProtectedAdmin />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitInitialSession({ user: { id: 'admin-user-id' } });

    await waitFor(() => {
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('officer JWT → /admin blocked, redirected', async () => {
    mockRoleLookup('officer', 'Field Officer');
    seedRoleCache('officer-user-id', 'officer', 'Field Officer');

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/admin" element={<ProtectedAdmin />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitInitialSession({ user: { id: 'officer-user-id' } });

    await waitFor(() => {
      expect(screen.getByText('Mobile App Required')).toBeInTheDocument();
    });
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('management JWT → /dashboard mounts', async () => {
    mockRoleLookup('management', 'Regional Head');
    seedRoleCache('mgmt-user-id', 'management', 'Regional Head');

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/dashboard" element={<ProtectedDashboard />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitInitialSession({ user: { id: 'mgmt-user-id' } });

    await waitFor(() => {
      expect(screen.getByText('Management Dashboard')).toBeInTheDocument();
    });
  });

  it('getSession throws → treated as no session, redirect to /login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error('network down'));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/admin" element={<ProtectedAdmin />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitInitialSession(null);

    await act(async () => {
      vi.advanceTimersByTime(5100);
    });

    await waitFor(
      () => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    vi.useRealTimers();
  }, 10000);
});
