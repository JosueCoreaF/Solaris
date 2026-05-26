import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../api/supabase';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  const [userStatus, setUserStatus] = useState<'checking' | 'approved' | 'pending' | 'blocked'>('checking');

  useEffect(() => {
    const checkUserStatus = async () => {
      if (session?.user) {
        try {
          const { data, error } = await supabase
            .from('usuarios_roles')
            .select('estado')
            .eq('usuario_id', session.user.id);

          const roleRecord = data && data.length > 0 ? data[0] : null;

          if (error || !roleRecord) {
            setUserStatus('approved'); // Sin registro = acceso permitido (legacy / cliente)
          } else if (roleRecord.estado === 'pendiente_aprobacion') {
            setUserStatus('pending');
          } else if (roleRecord.estado === 'activo') {
            setUserStatus('approved');
          } else {
            setUserStatus('blocked');
          }
        } catch {
          setUserStatus('approved');
        }
      } else {
        // No session - redirect to login
        setUserStatus('approved');
      }
    };

    // Check status whenever loading changes or session changes
    checkUserStatus();
  }, [session]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-inner">
          <div className="auth-loading-badge">PC</div>
          <div className="auth-loading-spinner" />
        </div>
      </div>
    );
  }

  // If no session after loading complete, redirect to login
  if (!session) return <Navigate to="/login" replace />;

  // Show loading while checking user status
  if (userStatus === 'checking') {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-inner">
          <div className="auth-loading-badge">PC</div>
          <div className="auth-loading-spinner" />
        </div>
      </div>
    );
  }

  if (userStatus === 'pending') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>Acceso Pendiente</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 16px' }}>
            Tu solicitud de acceso está siendo revisada por el propietario. Te notificaremos cuando sea aprobada.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (userStatus === 'blocked') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#dc2626', margin: '0 0 8px' }}>Acceso Bloqueado</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 16px' }}>
            Tu cuenta ha sido desactivada. Contacta al propietario.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
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
          <div className="auth-loading-badge">PC</div>
          <div className="auth-loading-spinner" />
        </div>
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;
  return <>{children}</>;
};
