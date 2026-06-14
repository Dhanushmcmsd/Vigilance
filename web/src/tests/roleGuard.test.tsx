import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoleGuard from '@/components/RoleGuard';
import { AuthProvider } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type AuthListener = (event: string, session: { user: { id: string } } | null) => void;

let authListener: AuthListener | null = null;

async function emitSession(userId: string) {
  await act(async () => {
    await Promise.resolve();
    authListener?.('INITIAL_SESSION', { user: { id: userId } });
    await Promise.resolve();
  });
}

function renderWithRole(role: string | null) {
  vi.mocked(supabase.rpc).mockResolvedValue({
    data: role ? [{ role, name: 'Role Test User', accepted_policy_version: '1' }] : [],
    error: null,
  } as never);

  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/protected']}>
        <RoleGuard allowedRoles={['admin']}>
          <div data-testid="protected-child">Protected Content</div>
        </RoleGuard>
      </MemoryRouter>
    </AuthProvider>,
  );

  return act(async () => {
    await Promise.resolve();
    authListener?.('INITIAL_SESSION', role ? { user: { id: `${role}-id` } } : null);
    await Promise.resolve();
  });
}

describe('RoleGuard', () => {
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

  it("admin in allowedRoles=['admin'] → child renders", async () => {
    await renderWithRole('admin');
    await waitFor(() => {
      expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    });
  });

  it("officer in allowedRoles=['admin'] → child absent from DOM", async () => {
    await renderWithRole('officer');
    await waitFor(() => {
      expect(screen.getByText('Mobile App Required')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
  });

  it("management in allowedRoles=['management','admin'] → child renders", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ role: 'management', name: 'Head', accepted_policy_version: '1' }],
      error: null,
    } as never);

    render(
      <AuthProvider>
        <MemoryRouter>
          <RoleGuard allowedRoles={['management', 'admin']}>
            <div data-testid="mgmt-child">Mgmt View</div>
          </RoleGuard>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitSession('mgmt-1');

    await waitFor(() => {
      expect(screen.getByTestId('mgmt-child')).toBeInTheDocument();
    });
  });

  it('undefined role → fallback renders or redirect fires', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route
              path="/protected"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <div data-testid="protected-child">Protected Content</div>
                </RoleGuard>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitSession('orphan-id');

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
  });

  it("audit in allowedRoles=['audit'] → child renders", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ role: 'audit', name: 'Auditor', accepted_policy_version: '1' }],
      error: null,
    } as never);

    render(
      <AuthProvider>
        <MemoryRouter>
          <RoleGuard allowedRoles={['audit']}>
            <div data-testid="audit-child">Audit Archive</div>
          </RoleGuard>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitSession('audit-1');

    await waitFor(() => {
      expect(screen.getByTestId('audit-child')).toBeInTheDocument();
    });
  });

  it("officer in allowedRoles=['officer','admin'] → child renders", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ role: 'officer', name: 'Officer', accepted_policy_version: '1' }],
      error: null,
    } as never);

    render(
      <AuthProvider>
        <MemoryRouter>
          <RoleGuard allowedRoles={['officer', 'admin']}>
            <div data-testid="officer-child">Officer View</div>
          </RoleGuard>
        </MemoryRouter>
      </AuthProvider>,
    );

    await emitSession('officer-1');

    await waitFor(() => {
      expect(screen.getByTestId('officer-child')).toBeInTheDocument();
    });
  });
});
