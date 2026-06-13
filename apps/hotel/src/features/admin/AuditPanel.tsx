import React, { useEffect, useState } from 'react';
import { auditService, AuditLog, AuditStats, AuditLogsResponse, ETIQUETA_ENTIDAD, ETIQUETA_CAMPO } from '../../api/auditService';
import { Search, Download, ChevronDown, Filter, RefreshCw, Calendar } from 'lucide-react';

export const AuditPanel: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [daysFilter, setDaysFilter] = useState(30);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const cargarLogs = async (nuevoOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      let response: AuditLogsResponse;

      if (searchQuery.length >= 3) {
        response = await auditService.buscar(searchQuery, limit, nuevoOffset);
      } else {
        const fechaDesde = new Date();
        fechaDesde.setDate(fechaDesde.getDate() - daysFilter);

        response = await auditService.obtenerLogs(limit, nuevoOffset, {
          entidad:     entityFilter || undefined,
          accion:      actionFilter || undefined,
          fecha_desde: fechaDesde.toISOString().split('T')[0],
          fecha_hasta: new Date().toISOString().split('T')[0],
        });
      }

      setLogs(response.data);
      setHasMore((response.data ?? []).length === limit);
    } catch (err: any) {
      setError(err.message || 'Error cargando logs de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const stats = await auditService.obtenerEstadisticas(daysFilter);
      setStats(stats);
    } catch (err: any) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  const descargarCSV = async () => {
    setLoading(true);
    try {
      const fechaDesde = new Date();
      fechaDesde.setDate(fechaDesde.getDate() - daysFilter);

      const blob = await auditService.exportarCSV(
        fechaDesde.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Error descargando CSV');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0);
    cargarLogs(0);
    cargarEstadisticas();
  }, [daysFilter, entityFilter, actionFilter]);

  useEffect(() => {
    if (searchQuery.length >= 3 || searchQuery === '') {
      setOffset(0);
      cargarLogs(0);
    }
  }, [searchQuery]);

  // Syntax highlighter para JSON
  const renderJsonSintaxis = (obj: unknown) => {
    const json = JSON.stringify(obj, null, 2);
    const lines = json.split('\n').map((line, i) => {
      const formatted = line
        .replace(/("[\w_]+")(\s*:)/g, '<span style="color:#6366f1;font-weight:600">$1</span>$2')
        .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span style="color:#16a34a">$1</span>')
        .replace(/:\s*(\d+\.?\d*)/g, ': <span style="color:#d97706">$1</span>')
        .replace(/:\s*(true|false)/g, ': <span style="color:#7c3aed">$1</span>')
        .replace(/:\s*(null)/g, ': <span style="color:#9ca3af">$1</span>');
      return `<span key="${i}">${formatted}</span>`;
    });
    return { __html: lines.join('\n') };
  };

  // Etiquetas legibles para campos técnicos y entidades (nombres de tablas)
  const etiquetaCampo = ETIQUETA_CAMPO;
  const etiquetaEntidad = ETIQUETA_ENTIDAD;

  const formatValor = (val: unknown): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return new Date(val).toLocaleString('es-HN', { dateStyle: 'medium', timeStyle: 'short' });
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const renderCambiosTabla = (anterior: Record<string, unknown> | null, nuevo: Record<string, unknown> | null) => {
    if (!anterior && !nuevo) return null;

    // Campos a ignorar (internos / sin valor para el usuario)
    const ignorar = new Set(['id_reserva_hotel', 'id_pago_hotel', 'id_saldo', 'id', 'id_empresa', 'usuario_id', 'id_usuario']);

    const camposConCambio: string[] = [];
    const todosCampos = new Set([...Object.keys(anterior ?? {}), ...Object.keys(nuevo ?? {})]);

    todosCampos.forEach((campo) => {
      if (ignorar.has(campo)) return;
      const valAntes = anterior?.[campo];
      const valDespues = nuevo?.[campo];
      if (JSON.stringify(valAntes) !== JSON.stringify(valDespues)) {
        camposConCambio.push(campo);
      }
    });

    // Si no hay cambios detectados pero hay datos, mostrar campos relevantes
    const camposAMostrar = camposConCambio.length > 0 ? camposConCambio : Object.keys(nuevo ?? anterior ?? {}).filter(c => !ignorar.has(c)).slice(0, 8);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-2 border border-gray-200 font-semibold text-gray-700 w-1/3">Campo</th>
              {anterior && <th className="text-left p-2 border border-gray-200 font-semibold text-red-600 w-1/3">Antes</th>}
              {nuevo && <th className="text-left p-2 border border-gray-200 font-semibold text-green-600 w-1/3">Después</th>}
            </tr>
          </thead>
          <tbody>
            {camposAMostrar.map((campo) => {
              const valAntes = anterior?.[campo];
              const valDespues = nuevo?.[campo];
              const cambio = JSON.stringify(valAntes) !== JSON.stringify(valDespues);
              return (
                <tr key={campo} className={cambio ? 'bg-yellow-50' : ''}>
                  <td className="p-2 border border-gray-200 font-medium text-gray-600">
                    {etiquetaCampo[campo] ?? campo}
                  </td>
                  {anterior && (
                    <td className="p-2 border border-gray-200 text-red-700">
                      {formatValor(valAntes)}
                    </td>
                  )}
                  {nuevo && (
                    <td className="p-2 border border-gray-200 text-green-700 font-medium">
                      {formatValor(valDespues)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderLog = (log: AuditLog) => {
    const isExpanded = expandedLogId === log.id;
    const usuarioCompleto = log.usuario_email ?? 'Sistema (trigger automático)';

    return (
      <div key={log.id} className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
        <div
          className="p-4 cursor-pointer hover:bg-gray-50 transition"
          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xl">
                  {auditService.obtenerIconoAccion(log.accion)}
                </span>
                <span className={`font-semibold ${auditService.obtenerColorAccion(log.accion)}`}>
                  {auditService.obtenerEtiquetaAccion(log.accion)}
                </span>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {etiquetaEntidad[log.entidad ?? ''] ?? log.entidad?.replace(/_/g, ' ')}
                </span>
                {log.usuario_rol && (
                  <span className="text-xs text-white bg-blue-600 px-2 py-0.5 rounded">
                    {log.usuario_rol}
                  </span>
                )}
              </div>

              {/* Usuario y fecha en una sola fila destacada */}
              <div className="flex items-center gap-3 text-sm mb-2">
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
                  <span className="text-base">·</span>
                  <span className="font-semibold text-indigo-800">{usuarioCompleto}</span>
                </div>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">{auditService.formatearFecha(log.created_at_iso)}</span>
              </div>

              <div className="text-xs text-gray-600 bg-blue-50 px-3 py-1.5 rounded border-l-2 border-blue-300">
                {auditService.describirCambio(log)}
              </div>

              {log.notas && (
                <div className="text-sm text-gray-600 mt-1.5 italic">
                  {log.notas}
                </div>
              )}
            </div>

            <ChevronDown
              size={20}
              className={`ml-3 flex-shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="bg-gray-50 p-4 border-t border-gray-200 space-y-4">
            {/* Quién hizo el cambio */}
            <div className="p-3 bg-white rounded-lg border border-indigo-100">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Realizó el cambio</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Usuario</span>
                  <p className="font-medium text-gray-800">{usuarioCompleto}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Rol</span>
                  <p className="font-medium text-gray-800">{log.usuario_rol ?? '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Fecha y hora</span>
                  <p className="font-medium text-gray-800">{auditService.formatearFecha(log.created_at_iso)}</p>
                </div>
                {log.ip_cliente && (
                  <div>
                    <span className="text-gray-500 text-xs">IP</span>
                    <p className="font-medium text-gray-800">{log.ip_cliente}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tabla de cambios */}
            {(log.datos_anteriores || log.datos_nuevos) && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-100 border-b border-gray-200">
                  <h4 className="font-semibold text-sm text-gray-700">Detalle de Cambios</h4>
                </div>
                <div className="p-3">
                  {renderCambiosTabla(
                    log.datos_anteriores as Record<string, unknown> | null,
                    log.datos_nuevos as Record<string, unknown> | null
                  )}
                </div>
              </div>
            )}

            {/* JSON completo con syntax highlighting */}
            {(log.datos_anteriores || log.datos_nuevos) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {log.datos_anteriores && (
                  <div className="rounded-lg border border-red-100 overflow-hidden">
                    <div className="px-3 py-1.5 bg-red-50 border-b border-red-100 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
                      <span className="text-xs font-semibold text-red-700">Valores Anteriores</span>
                    </div>
                    <pre
                      className="p-3 text-xs overflow-x-auto max-h-52 bg-[#fdfafa] leading-relaxed font-mono"
                      dangerouslySetInnerHTML={renderJsonSintaxis(log.datos_anteriores)}
                    />
                  </div>
                )}
                {log.datos_nuevos && (
                  <div className="rounded-lg border border-green-100 overflow-hidden">
                    <div className="px-3 py-1.5 bg-green-50 border-b border-green-100 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
                      <span className="text-xs font-semibold text-green-700">Valores Nuevos</span>
                    </div>
                    <pre
                      className="p-3 text-xs overflow-x-auto max-h-52 bg-[#f9fdf9] leading-relaxed font-mono"
                      dangerouslySetInnerHTML={renderJsonSintaxis(log.datos_nuevos)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notas / referencia */}
            {(log.notas || log.referencia_externa) && (
              <div className="p-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-600 space-y-1">
                {log.notas && <p><strong>Nota:</strong> {log.notas}</p>}
                {log.referencia_externa && <p><strong>Referencia:</strong> {log.referencia_externa}</p>}
              </div>
            )}

            <p className="text-xs text-gray-400">ID: {log.id}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 bg-white rounded-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Auditoría Exhaustiva</h1>
        <p className="text-gray-600">
          Rastreo detallado de todas las acciones en el sistema. Solo accesible por PROPIETARIO.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-900">
              {stats.total_acciones?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-blue-700">Total de Acciones</div>
            <div className="text-xs text-blue-600 mt-1">{stats.periodo}</div>
          </div>

          {stats.acciones_por_tipo && Object.keys(stats.acciones_por_tipo).length > 0 && (
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
              <div className="text-sm text-green-900 mb-2">
                <strong>Acciones</strong>
              </div>
              <div className="text-xs text-green-700 space-y-1">
                {Object.entries(stats.acciones_por_tipo as Record<string, number>)
                  .slice(0, 3)
                  .map(([accion, count]) => (
                    <div key={accion}>
                      {accion}: {count}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {stats.acciones_por_usuario && Object.keys(stats.acciones_por_usuario).length > 0 && (
            <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-900 mb-2">
                <strong>Usuarios Activos</strong>
              </div>
              <div className="text-xs text-purple-700 space-y-1">
                {Object.entries(stats.acciones_por_usuario as Record<string, number>)
                  .slice(0, 3)
                  .map(([usuario, count]) => (
                    <div key={usuario}>
                      {usuario}: {count}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {stats.acciones_por_entidad && Object.keys(stats.acciones_por_entidad).length > 0 && (
            <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg border border-amber-200">
              <div className="text-sm text-amber-900 mb-2">
                <strong>Entidades Modificadas</strong>
              </div>
              <div className="text-xs text-amber-700 space-y-1">
                {Object.entries(stats.acciones_por_entidad as Record<string, number>)
                  .slice(0, 3)
                  .map(([entidad, count]) => (
                    <div key={entidad}>
                      {etiquetaEntidad[entidad] ?? entidad.replace(/_/g, ' ')}: {count}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6 space-y-4">
        {/* Búsqueda */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Búsqueda (mínimo 3 caracteres)
          </label>
          <input
            type="text"
            placeholder="Buscar en cambios, notas, usuario..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar size={16} className="inline mr-1" />
              Últimos días
            </label>
            <select
              value={daysFilter}
              onChange={(e) => setDaysFilter(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>7 días</option>
              <option value={30}>30 días</option>
              <option value={90}>90 días</option>
              <option value={365}>1 año</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter size={16} className="inline mr-1" />
              Entidad
            </label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="reservas_hotel">Reservas</option>
              <option value="pagos_hotel">Pagos</option>
              <option value="saldos_clientes">Saldos</option>
              <option value="usuarios_roles">Usuarios & Roles</option>
              <option value="huespedes">Huéspedes</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Acción
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas</option>
              <option value="INSERT">Creación</option>
              <option value="UPDATE">Actualización</option>
              <option value="DELETE">Eliminación</option>
              <option value="LOGIN">Login</option>
              <option value="CHANGE_ROLE">Cambio de Rol</option>
            </select>
          </div>

          <div className="flex gap-2 items-end">
            <button
              onClick={() => {
                setOffset(0);
                cargarLogs(0);
                cargarEstadisticas();
              }}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
            <button
              onClick={descargarCSV}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Descargar CSV
            </button>
          </div>
        </div>
      </div>

      {/* Lista de logs */}
      <div className="space-y-3">
        {loading && logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="text-gray-600 mt-2">Cargando auditoría...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Sin registros de auditoría con los filtros seleccionados
          </div>
        ) : (
          <>
            {logs.map((log) => renderLog(log))}

            {/* Paginación */}
            <div className="flex gap-2 justify-center mt-6 pt-6 border-t">
              <button
                onClick={() => {
                const prev = Math.max(0, offset - limit);
                setOffset(prev);
                cargarLogs(prev);
              }}
                disabled={offset === 0 || loading}
                className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
              >
                ← Anterior
              </button>
              <span className="px-4 py-2 text-gray-600">
                {offset + 1} - {Math.min(offset + limit, offset + logs.length)} de ∞
              </span>
              <button
                onClick={() => {
                const next = offset + limit;
                setOffset(next);
                cargarLogs(next);
              }}
                disabled={!hasMore || loading}
                className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Siguiente →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
