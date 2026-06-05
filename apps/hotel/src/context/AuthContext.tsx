import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, any>) => Promise<{ error: string | null; user_id?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleUrlAuth = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken  = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const hotelId      = params.get('hotel_id') || params.get('business_id');

      // Guardar hotel_id antes de limpiar la URL
      if (hotelId) {
        localStorage.setItem('active_hotel_id', hotelId);
      }

      // Limpiar tokens de la URL
      if (accessToken || refreshToken || hotelId) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Si vienen tokens explícitos (desde hub), establecer sesión
      if (accessToken && refreshToken) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error && data.session) {
            setSession(data.session);
            setUser(data.session.user);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('[AuthContext] setSession error:', err);
        }
      }

      // Fallback: leer sesión desde localStorage (misma sesión que hub)
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } catch (err) {
        console.error('[AuthContext] getSession error:', err);
      }

      setLoading(false);
    };

    handleUrlAuth();

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const aplicarLoginAutomatico = async (): Promise<boolean> => {
    try {
      const autoLoginData = localStorage.getItem('autoLoginSession');
      if (!autoLoginData) return false;

      const { access_token, refresh_token } = JSON.parse(autoLoginData);

      // Intentar restablecer la sesión
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.warn('Auto-login failed:', error);
        localStorage.removeItem('autoLoginSession');
        return false;
      }

      return !!data.session;
    } catch (error) {
      console.error('Error applying auto-login:', error);
      return false;
    }
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, any>): Promise<{ error: string | null; user_id?: string }> => {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: metadata ? { data: metadata } : undefined,
        });
        
        if (error) {
          // Check if it's a rate limiting error
          if (error.status === 429) {
            lastError = error;
            if (attempt < maxRetries - 1) {
              // Exponential backoff: 2^attempt * 1000ms (1s, 2s, 4s)
              const delayMs = Math.pow(2, attempt) * 1000;
              console.log(`Rate limited. Retrying in ${delayMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
          }
          return { error: error.message };
        }
        return { error: null, user_id: data.user?.id };
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }
    }

    // All retries exhausted
    if (lastError?.status === 429) {
      return { error: 'Demasiados intentos. Por favor, espera unos minutos antes de intentar de nuevo.' };
    }
    return { error: lastError?.message || 'Error desconocido' };
  };

  const signOut = async () => {
    localStorage.removeItem('autoLoginSession');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
