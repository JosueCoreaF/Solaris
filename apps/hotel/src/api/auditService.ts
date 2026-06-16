import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function getHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const hotelId = localStorage.getItem('active_hotel_id') || '';
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(hotelId ? { 'X-Hotel-ID': hotelId } : {}),
  };
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...headers, ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export interface AuditLog {
  id: string;
  accion: string;
  entidad: string;
  entidad_id: string | null;
  usuario_email: string | null;
  usuario_rol: string | null;
  cambios_resumidos: string | null;
  datos_anteriores: Record<string, any> | null;
  datos_nuevos: Record<string, any> | null;
  ip_cliente: string | null;
  user_agent: string | null;
  referencia_externa: string | null;
  notas: string | null;
  fecha_hora: string;
  created_at_iso: string;
  segundos_atras: number;
}

export interface AuditStats {
  total_acciones: number;
  acciones_por_tipo: Record<string, number>;
  acciones_por_usuario: Record<string, number>;
  acciones_por_entidad: Record<string, number>;
  periodo: string;
}

export interface AuditLogsResponse {
  data: AuditLog[];
  limit: number;
  offset: number;
}

// Etiquetas legibles para entidades (nombres de tablas) — para no exponer nombres técnicos
export const ETIQUETA_ENTIDAD: Record<string, string> = {
  reservas_hotel: 'Reservas',
  pagos_hotel: 'Pagos',
  huespedes: 'Huéspedes',
  usuarios_roles: 'Usuarios & Roles',
  saldos_clientes: 'Saldos de Clientes',
  habitaciones: 'Habitaciones',
  bloqueos_habitacion: 'Bloqueos de Habitación',
  empresas: 'Empresas',
  cierres_diarios: 'Cierres Diarios',
  cotizaciones: 'Cotizaciones',
  servicios_adicionales: 'Servicios Adicionales',
  hoteles: 'Hotel',
};

// Etiquetas legibles para campos técnicos
export const ETIQUETA_CAMPO: Record<string, string> = {
  estado: 'Estado', estado_pago: 'Estado de Pago', estado_display: 'Estado (visual)',
  total_reserva: 'Total Reserva', monto: 'Monto', moneda: 'Moneda',
  check_in: 'Check-in', check_out: 'Check-out', updated_at: 'Actualizado',
  created_at: 'Creado', id_huesped: 'Huésped', id_habitacion: 'Habitación',
  id_hotel: 'Hotel', observaciones: 'Observaciones', origen_reserva: 'Origen',
  es_cortesia: 'Cortesía', metodo_pago: 'Método de Pago', fecha_pago: 'Fecha de Pago',
  rol: 'Rol', email: 'Email', nombre_completo: 'Nombre', tipo: 'Tipo',
  aplicado: 'Aplicado', detalles_estado: 'Detalles del Estado',
};

// Campos internos que no aportan información al usuario
const CAMPOS_IGNORADOS = new Set([
  'id', 'id_reserva_hotel', 'id_pago_hotel', 'id_saldo', 'id_empresa',
  'usuario_id', 'id_usuario', 'id_hotel', 'created_at', 'updated_at',
]);

const PREFIX = '/hotel/audit/logs';

class AuditService {
  async obtenerLogs(
    limit = 50,
    offset = 0,
    filtros?: {
      entidad?: string;
      accion?: string;
      usuario?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
    }
  ): Promise<AuditLogsResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filtros?.entidad)     params.append('entidad',     filtros.entidad);
    if (filtros?.accion)      params.append('accion',      filtros.accion);
    if (filtros?.usuario)     params.append('usuario',     filtros.usuario);
    if (filtros?.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
    if (filtros?.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);
    return apiFetch<AuditLogsResponse>(`${PREFIX}?${params}`);
  }

  async obtenerEstadisticas(dias = 30): Promise<AuditStats> {
    return apiFetch<AuditStats>(`${PREFIX}/stats?dias=${dias}`);
  }

  async buscar(query: string, limit = 50, offset = 0): Promise<AuditLogsResponse> {
    return apiFetch<AuditLogsResponse>(
      `${PREFIX}/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
  }

  async obtenerMiActividad(limit = 30, offset = 0): Promise<AuditLogsResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return apiFetch<AuditLogsResponse>(`${PREFIX}/my-activity?${params}`);
  }

  async exportarCSV(fecha_desde?: string, fecha_hasta?: string): Promise<Blob> {
    const headers = await getHeaders();
    const params = new URLSearchParams();
    if (fecha_desde) params.append('fecha_desde', fecha_desde);
    if (fecha_hasta) params.append('fecha_hasta', fecha_hasta);
    const res = await fetch(`${API_BASE}${PREFIX}/export?${params}`, { headers });
    if (!res.ok) throw new Error('Error exportando CSV');
    return res.blob();
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-HN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  obtenerIconoAccion(accion: string): string {
    const map: Record<string, string> = {
      INSERT: '➕', CREATE_USER: '👤', UPDATE: '✏️', CHANGE_ROLE: '🔄',
      DELETE: '🗑️', LOGIN: '🔑', LOGOUT: '🚪', APPLY_BALANCE: '💰',
      CANCEL_PAYMENT: '↩️', CREATE_INVOICE: '📄', CHECK_IN: '🏠',
      CHECK_OUT: '🏁', CANCEL_RESERVATION: '❌', BLOCK_ROOM: '🔒',
      UNBLOCK_ROOM: '🔓',
    };
    return map[accion] || '•';
  }

  obtenerColorAccion(accion: string): string {
    if (['INSERT', 'CREATE_USER', 'CHECK_IN', 'UNBLOCK_ROOM'].includes(accion)) return 'text-emerald-600';
    if (['UPDATE', 'CHANGE_ROLE', 'APPLY_BALANCE'].includes(accion)) return 'text-blue-600';
    if (['DELETE', 'CANCEL_RESERVATION', 'CANCEL_PAYMENT', 'BLOCK_ROOM'].includes(accion)) return 'text-red-600';
    if (['LOGIN'].includes(accion)) return 'text-violet-600';
    if (['CHECK_OUT', 'LOGOUT'].includes(accion)) return 'text-amber-600';
    return 'text-slate-500';
  }

  obtenerEtiquetaAccion(accion: string): string {
    const map: Record<string, string> = {
      INSERT: 'Creado', UPDATE: 'Actualizado', DELETE: 'Eliminado',
      LOGIN: 'Ingreso al sistema', LOGOUT: 'Cierre de sesión',
      CREATE_USER: 'Usuario creado', CHANGE_ROLE: 'Rol cambiado',
      APPLY_BALANCE: 'Saldo aplicado', CANCEL_PAYMENT: 'Pago anulado',
      CREATE_INVOICE: 'Factura creada', CHECK_IN: 'Check-in',
      CHECK_OUT: 'Check-out', CANCEL_RESERVATION: 'Reserva cancelada',
      BLOCK_ROOM: 'Habitación bloqueada', UNBLOCK_ROOM: 'Habitación desbloqueada',
    };
    return map[accion] || accion;
  }

  /** Nombre legible de la entidad/módulo afectado, sin exponer el nombre técnico de la tabla. */
  etiquetaEntidad(entidad: string | null | undefined): string {
    if (!entidad) return 'Registro';
    return ETIQUETA_ENTIDAD[entidad] ?? entidad.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  }

  /** Lista de campos que cambiaron entre dos snapshots, ignorando IDs e internos. */
  camposModificados(anterior: Record<string, unknown> | null, nuevo: Record<string, unknown> | null): string[] {
    const todos = new Set([...Object.keys(anterior ?? {}), ...Object.keys(nuevo ?? {})]);
    const cambios: string[] = [];
    todos.forEach((campo) => {
      if (CAMPOS_IGNORADOS.has(campo)) return;
      if (JSON.stringify(anterior?.[campo]) !== JSON.stringify(nuevo?.[campo])) cambios.push(campo);
    });
    return cambios;
  }

  /** Resumen legible en español de lo que cambió, en vez del crudo "INSERT en <tabla>". */
  describirCambio(log: AuditLog): string {
    const entidadLabel = this.etiquetaEntidad(log.entidad);

    if (log.accion === 'INSERT') return `Se creó un registro en ${entidadLabel}`;
    if (log.accion === 'DELETE') return `Se eliminó un registro en ${entidadLabel}`;

    if (log.accion === 'UPDATE') {
      const campos = this.camposModificados(log.datos_anteriores, log.datos_nuevos);
      if (campos.length === 0) return `Se actualizó un registro en ${entidadLabel}`;
      const etiquetas = campos.slice(0, 3).map(c => ETIQUETA_CAMPO[c] ?? c.replace(/_/g, ' '));
      const extra = campos.length > 3 ? ` y ${campos.length - 3} campo(s) más` : '';
      return `Se actualizó ${etiquetas.join(', ')}${extra} en ${entidadLabel}`;
    }

    return `${this.obtenerEtiquetaAccion(log.accion)} — ${entidadLabel}`;
  }
}

export const auditService = new AuditService();
