import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabase';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  const [status, setStatus] = useState<'checking' | 'approved' | 'pending' | 'blocked'>('checking');

  useEffect(() => {
    if (!session?.user) { setStatus('approved'); return; }
    supabase
      .from('usuarios_roles')
      .select('estado')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const rec = data?.[0];
        if (!rec) setStatus('approved');
        else if (rec.estado === 'pendiente_aprobacion') setStatus('pending');
        else if (rec.estado === 'activo') setStatus('approved');
        else setStatus('blocked');
      })
      .catch(() => setStatus('approved'));
  }, [session]);

  if (loading || status === 'checking') {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-inner">
          <div className="auth-loading-badge">GYM</div>
          <div className="auth-loading-spinner" />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  if (status === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>Acceso Pendiente</h1>
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 360 }}>Tu cuenta está siendo revisada por el administrador.</p>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>Acceso Bloqueado</h1>
        <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', maxWidth: 360 }}>Tu cuenta ha sido desactivada.</p>
        <button onClick={() => supabase.auth.signOut()} style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          Cerrar sesión
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export const GuestGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-inner">
          <div className="auth-loading-badge">GYM</div>
          <div className="auth-loading-spinner" />
        </div>
      </div>
    );
  }
  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
};
