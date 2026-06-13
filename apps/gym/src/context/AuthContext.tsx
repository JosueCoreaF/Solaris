import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export type AccountBlockedReason = 'ACCOUNT_SUSPENDED' | 'ACCOUNT_INACTIVE' | 'MODULE_SUSPENDED' | 'INVALID_SESSION' | null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  accountBlocked: AccountBlockedReason;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; user_id?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAccountStatus(token: string): Promise<AccountBlockedReason> {
  try {
    const res = await fetch(`${API}/gym/account-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return null;
    if (res.status === 403) {
      const data = await res.json();
      const code = data.error;
      if (code === 'ACCOUNT_SUSPENDED' || code === 'ACCOUNT_INACTIVE' || code === 'MODULE_SUSPENDED') {
        return code as AccountBlockedReason;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountBlocked, setAccountBlocked] = useState<AccountBlockedReason>(null);

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const gymId = params.get('gym_id') || params.get('business_id');

      let activeSession: Session | null = null;

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!error && data.session) activeSession = data.session;
      }
      if (gymId) localStorage.setItem('active_gym_id', gymId);
      if (accessToken || refreshToken || gymId) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      if (!activeSession) {
        const { data } = await supabase.auth.getSession();
        activeSession = data?.session ?? null;
      }

      setSession(activeSession);
      setUser(activeSession?.user ?? null);

      if (activeSession?.access_token) {
        const blocked = await fetchAccountStatus(activeSession.access_token);
        setAccountBlocked(blocked);
      }

      setLoading(false);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        setSession(s);
        setUser(s?.user ?? null);
        return;
      }

      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        const blocked = await fetchAccountStatus(s.access_token);
        setAccountBlocked(blocked);
      } else {
        setAccountBlocked(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null, user_id: data.user?.id };
  };

  const signOut = async () => {
    const { clearGymContextCache } = await import('../api/gymContext');
    clearGymContextCache();
    setAccountBlocked(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, accountBlocked, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
