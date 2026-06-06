/**
 * Fuente única de verdad para permisos por rol.
 * Usada en: App.tsx (rutas), Sidebar.tsx (menú), ChatOperativo (canales).
 */
import type { UserRole } from '../hooks/useRole';

// ── Rutas → roles permitidos ──────────────────────────────────────────────────
export const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
  '/perfil': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
  '/habitaciones': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
  '/housekeeping': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
  '/mantenimiento': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
  '/reservas': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  '/pagos': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  '/clientes': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  '/empresas': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  '/estado-cuenta': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  '/chat': ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
  '/finanzas': ['PROPIETARIO', 'ADMIN', 'CONTADOR'],
  '/tarifas': ['PROPIETARIO', 'ADMIN'],
  '/exportar': ['PROPIETARIO', 'ADMIN', 'CONTADOR'],
  '/importar-reservas': ['PROPIETARIO', 'ADMIN'],
  '/config': ['PROPIETARIO', 'ADMIN'],
  '/gestionar-roles': ['PROPIETARIO'],
  '/auditoria': ['PROPIETARIO', 'ADMIN'],
  '/reportes': ['PROPIETARIO', 'ADMIN', 'CONTADOR'],
};

// ── Canales de chat → roles que pueden acceder ────────────────────────────────
export const CHAT_CHANNEL_ROLES: Record<string, UserRole[]> = {
  general: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
  hotel: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
  operativo: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
  cliente: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  privado: ['PROPIETARIO', 'ADMIN'],
  cierre: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
};

export const canAccessChannel = (role: UserRole, tipo: string): boolean => {
  const allowed = CHAT_CHANNEL_ROLES[tipo];
  // Canal desconocido → solo admins
  if (!allowed) return role === 'PROPIETARIO' || role === 'ADMIN';
  return allowed.includes(role);
};

// ── Acciones dentro de módulos ────────────────────────────────────────────────
export const MODULE_ACTIONS: Record<string, Record<string, UserRole[]>> = {
  reservas: {
    crear: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA'],
    editar: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA'],
    cancelar: ['PROPIETARIO', 'ADMIN'],
    ver: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  },
  pagos: {
    registrar: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA'],
    anular: ['PROPIETARIO', 'ADMIN'],
    ver: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'],
  },
  habitaciones: {
    editar: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA'],
    bloquear: ['PROPIETARIO', 'ADMIN'],
    estado: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
  },
  mantenimiento: {
    crear: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA'],
    avanzar: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
    notas: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'],
    eliminar: ['PROPIETARIO', 'ADMIN'],
  },
  chat: {
    crear_canal: ['PROPIETARIO', 'ADMIN'],
    eliminar_canal: ['PROPIETARIO', 'ADMIN'],
    enviar: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'],
  },
  usuarios: {
    gestionar: ['PROPIETARIO'],
    ver: ['PROPIETARIO', 'ADMIN'],
  },
};

export const canDo = (role: UserRole, module: string, action: string): boolean => {
  const roles = MODULE_ACTIONS[module]?.[action];
  if (!roles) return role === 'PROPIETARIO';
  return roles.includes(role);
};
