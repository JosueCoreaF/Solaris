import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import apiClient from '../../services/api';

interface AuditEntry {
  id: string;
  owner_id: string | null;
  id_hotel: string | null;
  accion: string;
  entidad: string;
  usuario_email: string | null;
  usuario_rol: string | null;
  cambios_resumidos: string | null;
  created_at: string;
}

const ACCION_COLOR: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  LOGIN:  'bg-purple-100 text-purple-700',
};

const ACCION_LABEL: Record<string, string> = {
  INSERT: 'Registro creado', UPDATE: 'Registro actualizado', DELETE: 'Registro eliminado',
  LOGIN: 'Inicio de sesión', LOGOUT: 'Cierre de sesión',
  CREATE_USER: 'Usuario creado', CHANGE_ROLE: 'Rol actualizado',
};

// Nombres legibles para entidades/tablas, sin exponer los nombres técnicos
const ETIQUETA_ENTIDAD: Record<string, string> = {
  reservas_hotel: 'Reservas', pagos_hotel: 'Pagos', huespedes: 'Huéspedes',
  usuarios_roles: 'Usuarios & Roles', saldos_clientes: 'Saldos de Clientes',
  habitaciones: 'Habitaciones', bloqueos_habitacion: 'Bloqueos de Habitación',
  empresas: 'Empresas', cierres_diarios: 'Cierres Diarios', cotizaciones: 'Cotizaciones',
  servicios_adicionales: 'Servicios Adicionales', hoteles: 'Hotel',
};

function etiquetaEntidad(entidad: string): string {
  return ETIQUETA_ENTIDAD[entidad] ?? entidad.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

function describirCambio(log: AuditEntry): string {
  return ACCION_LABEL[log.accion] ?? log.accion;
}

export default function AdminAudit() {
  const [logs, setLogs]       = useState<AuditEntry[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset]   = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const LIMIT = 50;

  const load = async (newOffset = 0) => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/hub/admin/audit?limit=${LIMIT}&offset=${newOffset}`);
      setLogs(data.data);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, []);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Auditoría Global</h1>
            <p className="text-slate-500 text-sm mt-1">{total.toLocaleString()} registros en toda la plataforma</p>
          </div>
          <button onClick={() => load(0)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sin registros</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map(log => {
                const isOpen = expanded === log.id;
                const colorCls = ACCION_COLOR[log.accion] ?? 'bg-slate-100 text-slate-600';
                return (
                  <div key={log.id}>
                    <div
                      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition"
                      onClick={() => setExpanded(isOpen ? null : log.id)}
                    >
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${colorCls}`}>
                        {log.accion}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {etiquetaEntidad(log.entidad)}
                          <span className="font-normal text-slate-500"> — {describirCambio(log)}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          {log.usuario_email ?? 'Sistema'}{log.usuario_rol ? ` · ${log.usuario_rol}` : ''}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">
                        {new Date(log.created_at).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                      {isOpen ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                    </div>
                    {isOpen && (
                      <div className="px-5 py-3 bg-slate-50 text-xs text-slate-500 space-y-1 border-t border-slate-100">
                        <p><span className="font-semibold">ID log:</span> {log.id}</p>
                        {log.owner_id && <p><span className="font-semibold">Owner:</span> {log.owner_id}</p>}
                        {log.id_hotel && <p><span className="font-semibold">Hotel:</span> {log.id_hotel}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {total > LIMIT && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>{offset + 1}–{Math.min(offset + LIMIT, total)} de {total.toLocaleString()}</span>
            <div className="flex gap-2">
              <button onClick={() => load(Math.max(0, offset - LIMIT))} disabled={offset === 0 || loading}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">← Anterior</button>
              <button onClick={() => load(offset + LIMIT)} disabled={offset + LIMIT >= total || loading}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
