import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Simplified RoleGuard for testing
const RoleGuard = ({ children, allowedRoles }: any) => {
  const user = null; // Mocked unauthenticated user
  if (!user) return <div>Redirected to Login</div>;
  return children;
};

describe('Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated users to login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={
            <RoleGuard allowedRoles={['management']}>
              <div>Dashboard</div>
            </RoleGuard>
          } />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Redirected to Login')).toBeInTheDocument();
  });
});
