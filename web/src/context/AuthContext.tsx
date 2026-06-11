import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { queryClient } from '../lib/queryClient';
import { fetchManagementInspections } from '../lib/inspectionQueries';

type Role = 'head' | 'management' | 'admin' | 'officer' | 'audit';

const VALID_ROLES: Role[] = ['head', 'management', 'admin', 'officer', 'audit'];
const ROLE_CACHE_KEY = 'vms_auth_profile';
const AUTH_INIT_FALLBACK_MS = 5_000;
/** Absolute ceiling — UI must never spin forever on auth init. */
const AUTH_HARD_STOP_MS = 10_000;
const ROLE_FETCH_TIMEOUT_MS = 6_000;

function parseRole(value: string | null | undefined): Role | null {
  if (!value) return null;
  return VALID_ROLES.includes(value as Role) ? (value as Role) : null;
}

interface CachedProfile {
  userId: string;
  role: Role | null;
  name: string;
  acceptedPolicyVersion: string | null;
  cachedAt: number;
}

function readCachedProfile(
  userId: string,
): { role: Role | null; name: string; acceptedPolicyVersion: string | null } | null {
  try {
    const raw = sessionStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProfile;
    if (parsed.userId !== userId) return null;
    if (Date.now() - parsed.cachedAt > 24 * 60 * 60 * 1000) return null;
    return {
      role: parsed.role,
      name: parsed.name,
      acceptedPolicyVersion: parsed.acceptedPolicyVersion ?? null,
    };
  } catch {
    return null;
  }
}

function writeCachedProfile(
  userId: string,
  role: Role | null,
  name: string,
  acceptedPolicyVersion: string | null,
) {
  try {
    const payload: CachedProfile = { userId, role, name, acceptedPolicyVersion, cachedAt: Date.now() };
    sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function clearCachedProfile() {
  try {
    sessionStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  name: string;
  acceptedPolicyVersion: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: Role | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  name: '',
  acceptedPolicyVersion: null,
  loading: true,
  signIn: async () => ({ error: null, role: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState<string>('');
  const [acceptedPolicyVersion, setAcceptedPolicyVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const initialSessionHandledRef = useRef(false);
  const roleFetchGenerationRef = useRef(0);

  const clearAuth = useCallback(() => {
    setUser(null);
    setRole(null);
    setName('');
    setAcceptedPolicyVersion(null);
    clearCachedProfile();
    try {
      sessionStorage.removeItem('vms_policy_accepted_version');
    } catch {
      /* ignore */
    }
  }, []);

  type RoleProfile = { role: Role | null; name: string; acceptedPolicyVersion: string | null };

  const applyRoleRow = (
    row: { role: string; name: string; accepted_policy_version?: string | null } | null,
  ): RoleProfile => {
    if (!row) return { role: null, name: '', acceptedPolicyVersion: null };
    return {
      role: parseRole(row.role),
      name: row.name ?? '',
      acceptedPolicyVersion: row.accepted_policy_version ?? null,
    };
  };

  const fetchRole = useCallback(async (userId: string) => {
    const load = async () => {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_user_role');
      const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!rpcError && rpcRow) {
        return applyRoleRow(rpcRow as { role: string; name: string; accepted_policy_version?: string | null });
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role, name, accepted_policy_version')
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return applyRoleRow(data);
      return applyRoleRow(null);
    };

    try {
      return await withTimeout(load(), ROLE_FETCH_TIMEOUT_MS, 'Role lookup');
    } catch {
      const cached = readCachedProfile(userId);
      if (cached) {
        return {
          role: cached.role,
          name: cached.name,
          acceptedPolicyVersion: cached.acceptedPolicyVersion,
        };
      }
      return applyRoleRow(null);
    }
  }, []);

  const syncUserRole = useCallback(
    async (sessionUser: User, options?: { blockUi?: boolean }) => {
      const generation = ++roleFetchGenerationRef.current;
      if (options?.blockUi) setLoading(true);

      try {
        const cached = readCachedProfile(sessionUser.id);
        setUser(sessionUser);
        if (cached) {
          setRole(cached.role);
          setName(cached.name);
          setAcceptedPolicyVersion(cached.acceptedPolicyVersion);
        }

        const { role: r, name: n, acceptedPolicyVersion: pv } = await fetchRole(sessionUser.id);
        if (generation !== roleFetchGenerationRef.current) return r;

        setUser(sessionUser);
        setRole(r);
        setName(n);
        setAcceptedPolicyVersion(pv);
        writeCachedProfile(sessionUser.id, r, n, pv);
        return r;
      } finally {
        if (options?.blockUi) setLoading(false);
      }
    },
    [fetchRole],
  );

  const finishInitialLoad = useCallback(() => {
    if (initialSessionHandledRef.current) return;
    initialSessionHandledRef.current = true;
    setLoading(false);
  }, []);

  const forceStopLoading = useCallback(() => {
    finishInitialLoad();
    setLoading(false);
  }, [finishInitialLoad]);

  useEffect(() => {
    const hardStop = window.setTimeout(forceStopLoading, AUTH_HARD_STOP_MS);
    return () => window.clearTimeout(hardStop);
  }, [forceStopLoading]);

  useEffect(() => {
    let mounted = true;

    const fallbackTimer = window.setTimeout(() => {
      if (!mounted || initialSessionHandledRef.current) return;
      void (async () => {
        try {
          const { data: { session }, error } = await withTimeout(
            supabase.auth.getSession(),
            AUTH_INIT_FALLBACK_MS,
            'Session recovery',
          );
          if (error) throw error;
          if (session?.user) {
            const cached = readCachedProfile(session.user.id);
            setUser(session.user);
            if (cached) {
              setRole(cached.role);
              setName(cached.name);
              setAcceptedPolicyVersion(cached.acceptedPolicyVersion);
            }
            finishInitialLoad();
            void syncUserRole(session.user);
          } else {
            clearAuth();
            finishInitialLoad();
          }
        } catch {
          if (mounted) clearAuth();
          finishInitialLoad();
        }
      })();
    }, AUTH_INIT_FALLBACK_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        window.clearTimeout(fallbackTimer);
        if (session?.user) {
          const cached = readCachedProfile(session.user.id);
          setUser(session.user);
          if (cached) {
            setRole(cached.role);
            setName(cached.name);
            setAcceptedPolicyVersion(cached.acceptedPolicyVersion);
          }
          finishInitialLoad();
          void syncUserRole(session.user);
        } else {
          clearAuth();
          finishInitialLoad();
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        roleFetchGenerationRef.current += 1;
        clearAuth();
        setLoading(false);
        return;
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        await syncUserRole(session.user);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        roleFetchGenerationRef.current += 1;
        clearAuth();
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, [clearAuth, finishInitialLoad, forceStopLoading, syncUserRole]);

  useEffect(() => {
    if (loading || !user || !role) return;
    if (role === 'management' || role === 'admin') {
      void queryClient.prefetchQuery({
        queryKey: ['inspections', 'management'],
        queryFn: fetchManagementInspections,
      });
    }
  }, [user, role, loading]);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ error: string | null; role: Role | null }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, role: null };

      const session = data.session;
      if (!session?.user) {
        return { error: 'Sign-in succeeded but no session was returned.', role: null };
      }

      let r = await syncUserRole(session.user);
      if (!r) {
        r = await syncUserRole(session.user);
      }

      if (!r) {
        await supabase.auth.signOut();
        clearAuth();
        return { error: 'No dashboard access found for this account.', role: null };
      }

      return { error: null, role: r };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed';
      return { error: message, role: null };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuth();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{ user, role, name, acceptedPolicyVersion, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
