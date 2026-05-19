import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'officer' | 'head' | 'management' | 'admin' | 'audit' | null;

const VALID_ROLES: Role[] = ['officer', 'head', 'management', 'admin', 'audit'];

function parseRole(value: string | null | undefined): Role {
  if (!value) return null;
  return VALID_ROLES.includes(value as Role) ? (value as Role) : null;
}

export type SignInResult = {
  error: string | null;
  role: Role;
};

interface AuthContextType {
  user: Session['user'] | null;
  userRole: Role;
  userName: string;
  userRolesId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userRole: null,
  userName: '',
  userRolesId: null,
  loading: true,
  signIn: async () => ({ error: null, role: null }),
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Session['user'] | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [userName, setUserName] = useState('');
  const [userRolesId, setUserRolesId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyRoleRow = (row: { id: string; role: string; name: string } | null): Role => {
    if (!row) {
      setUserRole(null);
      setUserName('');
      setUserRolesId(null);
      return null;
    }
    const role = parseRole(row.role);
    setUserRole(role);
    setUserName(row.name ?? '');
    setUserRolesId(row.id);
    return role;
  };

  const fetchUserRole = async (userId: string): Promise<Role> => {
    // Prefer SECURITY DEFINER RPC — reliable for audit bootstrap under RLS.
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_user_role');
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!rpcError && rpcRow) {
      return applyRoleRow(rpcRow as { id: string; role: string; name: string });
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('id, role, name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      return applyRoleRow(data);
    }

    return applyRoleRow(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchUserRole(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setUserRole(null);
        setUserName('');
        setUserRolesId(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<SignInResult> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message, role: null };

    // Ensure JWT is attached before role lookup (avoids transient null role).
    await supabase.auth.getSession();
    let role: Role = null;
    if (data.user) {
      role = await fetchUserRole(data.user.id);
      if (!role) {
        await new Promise((r) => setTimeout(r, 400));
        role = await fetchUserRole(data.user.id);
      }
    }
    return { error: null, role };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setUserName('');
    setUserRolesId(null);
  };

  return (
    <AuthContext.Provider value={{ user, userRole, userName, userRolesId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
