import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Role = 'officer' | 'head' | 'management' | 'admin' | 'audit' | null;

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

  const fetchUserRole = async (userId: string): Promise<Role> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('id, role, name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    if (!error && data) {
      const role = data.role as Role;
      setUserRole(role);
      setUserName(data.name);
      setUserRolesId(data.id);
      return role;
    }
    return null;
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
    let role: Role = null;
    if (data.user) role = await fetchUserRole(data.user.id);
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
