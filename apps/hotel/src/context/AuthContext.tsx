import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import type { UserRole } from '../hooks/useRole';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export type AccountBlockedReason = 'ACCOUNT_SUSPENDED' | 'ACCOUNT_INACTIVE' | 'MODULE_SUSPENDED' | 'INVALID_SESSION' | null;

interface AuthContextValue {
  session:        Session | null;
  user:           User | null;
  loading:        boolean;
  role:           UserRole;
  loadingRole:    boolean;
  accountBlocked: AccountBlockedReason;
  supportMode:    boolean;
  refreshRole:    () => Promise<void>;
  signIn:  (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:  (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error: string | null; user_id?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchRole(token: string): Promise<UserRole> {
  try {
    const res = await fetch(`${API}/roles/mi-rol`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return 'INVITADO';
    const data = await res.json();
    return (data.rol as UserRole) || 'INVITADO';
  } catch {
    return 'INVITADO';
  }
}

async function fetchAccountStatus(token: string): Promise<AccountBlockedReason> {
  try {
    const res = await fetch(`${API}/hotel/account-status`, {
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
  const [session,        setSession]        = useState<Session | null>(null);
  const [user,           setUser]           = useState<User | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [role,           setRole]           = useState<UserRole>('INVITADO');
  const [loadingRole,    setLoadingRole]    = useState(false);
  const [accountBlocked, setAccountBlocked] = useState<AccountBlockedReason>(null);
  const [supportMode,    setSupportMode]    = useState(() => sessionStorage.getItem('solaris_support_mode') === '1');

  const refreshRole = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setRole('INVITADO'); return; }
    setLoadingRole(true);
    const fetched = await fetchRole(token);
    setRole(fetched);
    setLoadingRole(false);
  }, []);

  // Escuchar el evento que dispara el interceptor de Axios cuando llega un 403/401 de bloqueo
  useEffect(() => {
    const handleBlocked = (e: Event) => {
      const { reason } = (e as CustomEvent<{ reason: AccountBlockedReason }>).detail;
      setAccountBlocked(reason);
    };
    window.addEventListener('solarys:account-blocked', handleBlocked);
    return () => window.removeEventListener('solarys:account-blocked', handleBlocked);
  }, []);

  useEffect(() => {
    const init = async () => {
      const params       = new URLSearchParams(window.location.search);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const hotelId      = params.get('hotel_id') || params.get('business_id');
      const soporte      = params.get('soporte');

      if (hotelId) {
        localStorage.setItem('active_hotel_id', hotelId);
      } else if (accessToken) {
        localStorage.removeItem('active_hotel_id');
      }
      if (soporte === '1') {
        sessionStorage.setItem('solaris_support_mode', '1');
        setSupportMode(true);
      }
      if (accessToken || refreshToken || hotelId || soporte) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      let activeSession: Session | null = null;

      if (accessToken && refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken, refresh_token: refreshToken,
          });
          if (!error && data.session) activeSession = data.session;
        } catch (err) {
          console.error('[AuthContext] setSession error:', err);
        }
      }

      if (!activeSession) {
        const { data } = await supabase.auth.getSession();
        activeSession = data?.session ?? null;
      }

      setSession(activeSession);
      setUser(activeSession?.user ?? null);

      if (activeSession?.access_token) {
        // Verificar estado antes de bajar loading — evita que SyncProvider
        // monte y haga requests mientras la cuenta está bloqueada.
        const blocked = await fetchAccountStatus(activeSession.access_token);
        setAccountBlocked(blocked);

        if (!blocked) {
          setLoadingRole(true);
          const fetched = await fetchRole(activeSession.access_token);
          setRole(fetched);
          setLoadingRole(false);
        }
      }

      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, s) => {
      // INITIAL_SESSION y TOKEN_REFRESHED no requieren re-chequear el estado
      // de la cuenta: el primero ya lo maneja init(), el segundo es solo
      // renovación silenciosa del JWT.
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
        if (!blocked) {
          setLoadingRole(true);
          const fetched = await fetchRole(s.access_token);
          setRole(fetched);
          setLoadingRole(false);
        }
      } else {
        setRole('INVITADO');
        setAccountBlocked(null);
      }
    });

    return () => { listener.subscription.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: Record<string, any>,
  ): Promise<{ error: string | null; user_id?: string }> => {
    const maxRetries = 3;
    let lastError: any = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: metadata ? { data: metadata } : undefined,
        });
        if (error) {
          if (error.status === 429) {
            lastError = error;
            if (attempt < maxRetries - 1) {
              await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
              continue;
            }
          }
          return { error: error.message };
        }
        return { error: null, user_id: data.user?.id };
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    if (lastError?.status === 429) {
      return { error: 'Demasiados intentos. Por favor, espera unos minutos.' };
    }
    return { error: lastError?.message || 'Error desconocido' };
  };

  const signOut = async () => {
    localStorage.removeItem('autoLoginSession');
    sessionStorage.removeItem('solaris_support_mode');
    setRole('INVITADO');
    setAccountBlocked(null);
    setSupportMode(false);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session, user, loading,
      role, loadingRole, accountBlocked,
      supportMode,
      refreshRole,
      signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
