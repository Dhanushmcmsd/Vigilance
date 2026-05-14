import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'head' | 'management' | 'admin' | 'officer';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  name: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Role | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  name: '',
  loading: true,
  signIn: async () => ({ error: null, role: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error || !data) return { role: null, name: '' };
    return { role: data.role as Role, name: data.name as string };
  };

  useEffect(() => {
    // Bootstrap existing session on page load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { role: r, name: n } = await fetchRole(session.user.id);
        setUser(session.user);
        setRole(r);
        setName(n);
      }
      setLoading(false);
    });

    // Keep state in sync with auth events (token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null);
          setRole(null);
          setName('');
          setLoading(false);
          return;
        }
        // SIGNED_IN is handled imperatively in signIn() below.
        // TOKEN_REFRESHED / USER_UPDATED — re-sync role in case it changed.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          const { role: r, name: n } = await fetchRole(session.user.id);
          setUser(session.user);
          setRole(r);
          setName(n);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Signs in and immediately fetches the user's role before returning.
   * This lets Login.tsx navigate directly instead of waiting for a
   * reactive useEffect chain that depends on loading state changes.
   */
  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ error: string | null; role: Role | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message, role: null };

    const session = data.session;
    if (!session?.user) return { error: 'Sign-in succeeded but no session was returned.', role: null };

    const { role: r, name: n } = await fetchRole(session.user.id);
    setUser(session.user);
    setRole(r);
    setName(n);

    if (!r) {
      // Auth worked but no matching user_roles row — not a dashboard user
      await supabase.auth.signOut();
      return { error: 'No dashboard access found for this account.', role: null };
    }

    return { error: null, role: r };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, name, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
