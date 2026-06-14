import { useAuth } from '../context/AuthContext';

export type UserRole = 'PROPIETARIO' | 'ADMIN' | 'RECEPCIONISTA' | 'CONTADOR' | 'MANTENIMIENTO' | 'INVITADO';

export const useRole = () => {
  const { role, loadingRole, refreshRole } = useAuth();

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    const arr = Array.isArray(roles) ? roles : [roles];
    return arr.includes(role);
  };

  return { role, loadingRole, refreshRole, hasRole };
};

