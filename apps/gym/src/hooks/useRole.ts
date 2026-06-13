import { useAuth } from '../context/AuthContext';

export type UserRole = 'PROPIETARIO' | 'ADMIN' | 'RECEPCIONISTA' | 'CONTADOR' | 'MANTENIMIENTO' | 'INVITADO';

export const useRole = () => {
  const { user } = useAuth();

  const getRole = (): UserRole => {
    if (!user) return 'INVITADO';
    if (user.email?.includes('propietario') || user.email?.includes('owner')) return 'PROPIETARIO';
    if (user.email?.includes('admin')) return 'ADMIN';
    if (user.email?.includes('contador')) return 'CONTADOR';
    return 'RECEPCIONISTA';
  };

  const role = getRole();

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    const arr = Array.isArray(roles) ? roles : [roles];
    return arr.includes(role);
  };

  return { role, hasRole };
};
