import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(res.statusText);
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
  total: number;
}

class AuditService {
  // Obtener todos los logs con filtros opcionales
  async obtenerLogs(
    limit = 100,
    offset = 0,
    filtros?: {
      entidad?: string;
      accion?: string;
      usuario_id?: string;
      fecha_desde?: string;
      fecha_hasta?: string;
    }
  ): Promise<AuditLogsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (filtros?.entidad) params.append('entidad', filtros.entidad);
    if (filtros?.accion) params.append('accion', filtros.accion);
    if (filtros?.usuario_id) params.append('usuario_id', filtros.usuario_id);
    if (filtros?.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
    if (filtros?.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);

    return apiFetch<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
  }

  // Obtener estadísticas de auditoría
  async obtenerEstadisticas(dias = 30): Promise<AuditStats> {
    return apiFetch<AuditStats>(`/audit-logs/stats?dias=${dias}`);
  }

  // Obtener detalles de un log específico
  async obtenerLog(id: string): Promise<AuditLog> {
    return apiFetch<AuditLog>(`/audit-logs/${id}`);
  }

  // Obtener historial completo de una entidad específica
  async obtenerHistorialEntidad(
    tipo: string,
    id: string
  ): Promise<AuditLog[]> {
    return apiFetch<AuditLog[]>(`/audit-logs/entity/${tipo}/${id}`);
  }

  // Obtener auditoría de un usuario específico
  async obtenerAuditoriaPorUsuario(
    email: string,
    limit = 100,
    offset = 0
  ): Promise<AuditLogsResponse> {
    return apiFetch<AuditLogsResponse>(
      `/audit-logs/user/${encodeURIComponent(email)}?limit=${limit}&offset=${offset}`
    );
  }

  // Buscar en auditoría
  async buscar(
    query: string,
    limit = 50,
    offset = 0
  ): Promise<AuditLogsResponse> {
    return apiFetch<AuditLogsResponse>(
      `/audit-logs/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
  }

  // Exportar auditoría a CSV
  async exportarCSV(
    fecha_desde?: string,
    fecha_hasta?: string
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (fecha_desde) params.append('fecha_desde', fecha_desde);
    if (fecha_hasta) params.append('fecha_hasta', fecha_hasta);

    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_BASE}/audit-logs/export/csv?${params.toString()}`, {
      headers: authHeader,
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.blob();
  }

  // Helper: Formatear fecha para lectura
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  // Helper: Obtener icono para acción
  obtenerIconoAccion(accion: string): string {
    switch (accion) {
      case 'INSERT':
      case 'CREATE_USER':
        return '✚';
      case 'UPDATE':
      case 'CHANGE_ROLE':
        return '✏️';
      case 'DELETE':
        return '🗑️';
      case 'LOGIN':
        return '🔓';
      case 'LOGOUT':
        return '🔒';
      case 'ACCESS_REPORT':
        return '👁️';
      case 'APPLY_BALANCE':
        return '💰';
      case 'CANCEL_PAYMENT':
        return '❌';
      case 'CREATE_INVOICE':
        return '📄';
      default:
        return '•';
    }
  }

  // Helper: Obtener color para acción
  obtenerColorAccion(accion: string): string {
    switch (accion) {
      case 'INSERT':
      case 'CREATE_USER':
        return 'text-green-600';
      case 'UPDATE':
      case 'CHANGE_ROLE':
        return 'text-blue-600';
      case 'DELETE':
        return 'text-red-600';
      case 'LOGIN':
        return 'text-purple-600';
      case 'LOGOUT':
        return 'text-yellow-600';
      case 'APPLY_BALANCE':
        return 'text-emerald-600';
      case 'CANCEL_PAYMENT':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  }

  // Helper: Obtener etiqueta amigable para acción
  obtenerEtiquetaAccion(accion: string): string {
    const map: Record<string, string> = {
      'INSERT': 'Creado',
      'UPDATE': 'Actualizado',
      'DELETE': 'Eliminado',
      'LOGIN': 'Ingreso',
      'LOGOUT': 'Salida',
      'ACCESS_REPORT': 'Acceso a Reporte',
      'CREATE_USER': 'Usuario Creado',
      'CHANGE_ROLE': 'Cambio de Rol',
      'APPLY_BALANCE': 'Saldo Aplicado',
      'CANCEL_PAYMENT': 'Pago Cancelado',
      'CREATE_INVOICE': 'Factura Creada',
    };
    return map[accion] || accion;
  }
}

export const auditService = new AuditService();
