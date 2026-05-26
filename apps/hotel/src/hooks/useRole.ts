import { useAuth } from '../context/AuthContext';

export type UserRole = 'PROPIETARIO' | 'ADMIN' | 'RECEPCIONISTA' | 'MANTENIMIENTO' | 'CONTADOR' | 'INVITADO';

export const useRole = () => {
  const { user } = useAuth();

  // TODO: Obtener rol desde JWT claim o metadata del usuario
  // Por ahora, usamos un rol por defecto basado en el email
  const getRole = (): UserRole => {
    if (!user) return 'INVITADO';

    // En producción, esto vendría del JWT o de una consulta a usuarios_roles
    // const role = user.user_metadata?.rol;
    // if (role) return role as UserRole;

    // Rol temporal por email (para desarrollo)
    if (user.email?.includes('josuejosuelpaz') || user.email?.includes('propietario') || user.email?.includes('owner')) return 'PROPIETARIO';
    if (user.email?.includes('admin')) return 'ADMIN';
    if (user.email?.includes('counter') || user.email?.includes('contador')) return 'CONTADOR';
    if (user.email?.includes('maintenance') || user.email?.includes('mantenimiento')) return 'MANTENIMIENTO';

    return 'RECEPCIONISTA'; // rol por defecto
  };

  const role = getRole();

  const hasRole = (roles: UserRole | UserRole[]): boolean => {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(role);
  };

  const canRead = (resource: string): boolean => {
    // PROPIETARIO puede leer todo
    if (role === 'PROPIETARIO') return true;

    const permissions: Record<string, UserRole[]> = {
      // Dashboard - todos pueden ver
      dashboard: ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
      // Reservas
      reservas: ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
      habitaciones: ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
      limpieza: ['ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
      // Finanzas
      finanzas: ['ADMIN', 'CONTADOR'],
      pagos: ['ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
      // Admin
      config: ['ADMIN'],
      tarifas: ['ADMIN'],
      reportes: ['ADMIN', 'CONTADOR'],
    };
    return permissions[resource]?.includes(role) ?? false;
  };

  const canCreate = (resource: string): boolean => {
    if (role === 'PROPIETARIO' || role === 'ADMIN') return true;

    const permissions: Record<string, boolean> = {
      reservas: role === 'RECEPCIONISTA',
      pagos: role === 'RECEPCIONISTA' || role === 'CONTADOR',
      limpieza: role === 'MANTENIMIENTO',
    };

    return permissions[resource] ?? false;
  };

  const canEdit = (resource: string): boolean => {
    if (role === 'PROPIETARIO' || role === 'ADMIN') return true;

    const permissions: Record<string, boolean> = {
      reservas: role === 'RECEPCIONISTA',
      pagos: role === 'RECEPCIONISTA' || role === 'CONTADOR',
      limpieza: role === 'MANTENIMIENTO',
    };

    return permissions[resource] ?? false;
  };

  const canDelete = (_resource: string): boolean => {
    // Solo PROPIETARIO y ADMIN pueden borrar
    return role === 'PROPIETARIO' || role === 'ADMIN';
  };

  return {
    role,
    hasRole,
    canRead,
    canCreate,
    canEdit,
    canDelete,
  };
};
