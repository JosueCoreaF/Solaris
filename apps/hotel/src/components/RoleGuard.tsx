import React from 'react';
import { useRole, UserRole } from '../hooks/useRole';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: UserRole | UserRole[];
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, requiredRoles, fallback }) => {
  const { role, loadingRole, hasRole } = useRole();

  // Esperar a que el rol real sea conocido — evita redirección prematura
  // mientras el fetch de /api/roles/mi-rol está en vuelo
  if (loadingRole) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: 'var(--muted)',
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!hasRole(requiredRoles)) {
    if (fallback) return <>{fallback}</>;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', flexDirection: 'column', gap: 16, padding: 24,
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(239,68,68,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26,
        }}>
          🔒
        </div>
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text-h)' }}>
            Acceso restringido
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Tu rol <strong>{role}</strong> no tiene permiso para ver esta sección.
          </p>
        </div>
        <a href="/" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
          Volver al Panel
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
