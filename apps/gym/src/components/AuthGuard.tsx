import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Clock, ShieldOff, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabase';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  const [status, setStatus] = useState<'checking' | 'approved' | 'pending' | 'blocked'>('checking');

  useEffect(() => {
    if (!session?.user) { setStatus('approved'); return; }
    supabase
      .from('usuarios_roles_gym')
      .select('estado')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        const rec = data?.[0];
        if (!rec) setStatus('approved');
        else if (rec.estado === 'pendiente' || rec.estado === 'pendiente_aprobacion') setStatus('pending');
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--shell-bg)', padding: 24 }}>
        <div style={{
          width: '100%', maxWidth: 420, background: 'var(--shell-panel-strong)', border: '1px solid var(--shell-border)',
          borderTop: '2px solid var(--warning)', borderRadius: 6, padding: 36, textAlign: 'center',
          boxShadow: 'var(--shadow)', animation: 'fadeInUp 0.4s ease-out',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 6, margin: '0 auto 20px', background: 'rgba(251,191,36,0.12)',
            border: '1px solid var(--warning)', color: 'var(--warning)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Clock size={26} />
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 10 }}>
            Acceso Pendiente
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
            Tu cuenta está siendo revisada por el administrador. Recibirás acceso una vez sea aprobada.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--shell-bg)', padding: 24 }}>
        <div style={{
          width: '100%', maxWidth: 420, background: 'var(--shell-panel-strong)', border: '1px solid var(--shell-border)',
          borderTop: '2px solid var(--danger)', borderRadius: 6, padding: 36, textAlign: 'center',
          boxShadow: 'var(--shadow)', animation: 'fadeInUp 0.4s ease-out',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 6, margin: '0 auto 20px', background: 'rgba(251,82,82,0.12)',
            border: '1px solid var(--danger)', color: 'var(--danger)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldOff size={26} />
          </div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 10 }}>
            Acceso Bloqueado
          </h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
            Tu cuenta ha sido desactivada. Contacta con soporte si crees que esto es un error.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
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
