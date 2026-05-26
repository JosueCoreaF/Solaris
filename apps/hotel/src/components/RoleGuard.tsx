import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRole, UserRole } from '../hooks/useRole';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles: UserRole | UserRole[];
  fallback?: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, requiredRoles, fallback }) => {
  const { hasRole } = useRole();

  if (!hasRole(requiredRoles)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>Acceso Denegado</h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>No tienes permiso para acceder a este recurso</p>
        </div>
        <a href="/" style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>Volver al Panel</a>
      </div>
    );
  }

  return <>{children}</>;
};
