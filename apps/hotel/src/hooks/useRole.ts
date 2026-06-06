import { useAuth } from '../context/AuthContext';

export type UserRole =
  | 'PROPIETARIO'
  | 'ADMIN'
  | 'RECEPCIONISTA'
  | 'MANTENIMIENTO'
  | 'CONTADOR'
  | 'INVITADO';

/** Invalida el cache de rol — ya no necesario, se mantiene por compatibilidad */
export const invalidateRoleCache = () => {};

export const useRole = () => {
  const { role, loadingRole, refreshRole } = useAuth();

  const hasRole = (roles: UserRole | UserRole[]): boolean =>
    (Array.isArray(roles) ? roles : [roles]).includes(role);

  const canRead = (resource: string): boolean => {
    if (role === 'PROPIETARIO') return true;
    const perms: Record<string, UserRole[]> = {
      dashboard:    ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
      reservas:     ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
      habitaciones: ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
      limpieza:     ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
      finanzas:     ['ADMIN', 'CONTADOR'],
      pagos:        ['ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
      config:       ['ADMIN'],
      tarifas:      ['ADMIN'],
      reportes:     ['ADMIN', 'CONTADOR'],
    };
    return perms[resource]?.includes(role) ?? false;
  };

  const canCreate = (resource: string): boolean => {
    if (role === 'PROPIETARIO' || role === 'ADMIN') return true;
    const perms: Record<string, boolean> = {
      reservas: role === 'RECEPCIONISTA',
      pagos:    role === 'RECEPCIONISTA' || role === 'CONTADOR',
      limpieza: role === 'MANTENIMIENTO',
    };
    return perms[resource] ?? false;
  };

  const canEdit = (resource: string): boolean => {
    if (role === 'PROPIETARIO' || role === 'ADMIN') return true;
    const perms: Record<string, boolean> = {
      reservas: role === 'RECEPCIONISTA',
      pagos:    role === 'RECEPCIONISTA' || role === 'CONTADOR',
      limpieza: role === 'MANTENIMIENTO',
    };
    return perms[resource] ?? false;
  };

  const canDelete = (_resource: string): boolean =>
    role === 'PROPIETARIO' || role === 'ADMIN';

  return { role, loadingRole, refreshRole, hasRole, canRead, canCreate, canEdit, canDelete };
};
