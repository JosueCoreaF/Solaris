import React, { useState, useEffect, useCallback } from 'react';
import { obtenerFacturas, eliminarFactura } from '../../api/finanzasService';
import { Calendar, Tag, Trash2, Edit2, ChevronDown, ChevronUp, FileText, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useFinanceAI } from '../../context/FinanceAIContext';

interface Props {
  onEditarFactura: (factura: any) => void;
  recargarTrigger?: number;
}

export const ListaFacturas: React.FC<Props> = ({ onEditarFactura, recargarTrigger }) => {
  const { categoriasGenerales, categoriasCajaChica } = useFinanceAI();
  const [periodo, setPeriodo] = useState<string>('mes');
  const [facturas, setFacturas] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [expansiones, setExpansiones] = useState<Record<string, boolean>>({});

  // Cargar facturas
  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerFacturas(periodo);
      setFacturas(data || []);
    } catch (e: any) {
      console.error('Error cargando facturas:', e);
      setError(e.message || 'No se pudieron cargar las facturas.');
    } finally {
      setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargar();
  }, [cargar, recargarTrigger]);

  // Obtener nombre de categoría humana
  const getNombreCategoria = (tipo: 'general' | 'caja_chica', catId: number | null): string => {
    if (!catId) return 'Sin categoría';
    const lista = tipo === 'general' ? categoriasGenerales : categoriasCajaChica;
    const cat = lista.find(c => c.id === catId);
    return cat ? cat.nombre : `Categoría ${catId}`;
  };

  // Toggle expansión
  const toggleExpansion = (id: string) => {
    setExpansiones(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Eliminar
  const handleEliminar = async (id: string, proveedor: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la factura de "${proveedor}"?`)) {
      return;
    }

    try {
      await eliminarFactura(id);
      setMensajeExito('Factura eliminada correctamente.');
      setTimeout(() => setMensajeExito(null), 3000);
      cargar();
    } catch (e: any) {
      console.error('Error al eliminar factura:', e);
      setError(e.message || 'No se pudo eliminar la factura.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles de Periodo */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Historial de Facturas</h2>
          <p className="text-xs text-gray-400">Consulta, desglosa, edita o elimina facturas registradas en el sistema.</p>
        </div>
        <div className="flex items-center gap-2">
          {(['semana', 'mes', 'trimestre', 'año'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                periodo === p
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {p === 'mes' ? 'Este Mes' : p === 'semana' ? 'Esta Semana' : p === 'trimestre' ? 'Trimestre' : 'Este Año'}
            </button>
          ))}
          <button
            onClick={cargar}
            disabled={cargando}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-slate-800 transition-all disabled:opacity-50"
            title="Refrescar datos"
          >
            <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      {mensajeExito && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-xs flex items-center gap-2">
          <CheckCircle2 size={15} />
          {mensajeExito}
        </div>
      )}

      {/* Lista / Tabla */}
      {cargando ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-gray-100 shadow-xs">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            <span className="text-xs text-gray-400 font-medium">Cargando facturas...</span>
          </div>
        </div>
      ) : facturas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-xs">
          <FileText size={44} className="mx-auto text-gray-200 mb-3" />
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Sin facturas</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">No hay ninguna factura registrada para el periodo seleccionado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-xxs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Proveedor / Factura</th>
                  <th className="py-3 px-4">Gasto</th>
                  <th className="py-3 px-4">Categorización</th>
                  <th className="py-3 px-4 text-right">Total (L)</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {facturas.map(f => {
                  const esDesglosada = Array.isArray(f.desglose) && f.desglose.length > 0;
                  const estaExpandida = expansiones[f.id_factura] || false;

                  return (
                    <React.Fragment key={f.id_factura}>
                      <tr className={`hover:bg-slate-50/50 transition-colors ${estaExpandida ? 'bg-slate-50/30' : ''}`}>
                        {/* Control de Expansión si es desglosada */}
                        <td className="py-3 px-4">
                          {esDesglosada ? (
                            <button
                              onClick={() => toggleExpansion(f.id_factura)}
                              className="text-gray-400 hover:text-slate-700 p-0.5 hover:bg-gray-100 rounded"
                            >
                              {estaExpandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          ) : null}
                        </td>

                        {/* Fecha */}
                        <td className="py-3 px-4 font-medium text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {f.fecha}
                          </div>
                        </td>

                        {/* Proveedor / Factura */}
                        <td className="py-3 px-4 font-medium">
                          <div className="font-semibold text-slate-800">{f.proveedor}</div>
                          {f.no_factura ? (
                            <div className="text-xxs text-gray-400 font-mono mt-0.5">{f.no_factura}</div>
                          ) : (
                            <div className="text-xxs text-gray-300 italic mt-0.5">Sin número de factura</div>
                          )}
                          {f.imagen_url && (
                            <div className="flex gap-1.5 mt-1 flex-wrap">
                              {f.imagen_url.split(',').filter(Boolean).map((url: string, index: number) => (
                                <a
                                  key={index}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 text-[9px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-sm px-1.5 py-0.5 border border-slate-200/50 transition-all cursor-pointer"
                                  title={`Ver Imagen ${index + 1}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  🖼️ Foto {index + 1}
                                </a>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Tipo Gasto */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xxs font-semibold uppercase ${
                            f.tipo === 'general'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {f.tipo === 'general' ? 'General' : 'Caja Chica'}
                          </span>
                        </td>

                        {/* Categorización */}
                        <td className="py-3 px-4">
                          {esDesglosada ? (
                            <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full text-xxs font-bold cursor-pointer" onClick={() => toggleExpansion(f.id_factura)}>
                              🔗 Desglosada ({f.desglose.length} ítems)
                            </span>
                          ) : (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Tag size={12} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[180px]">
                                {getNombreCategoria(f.tipo, f.tipo === 'general' ? f.categoria_general_id : f.categoria_chica_id)}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Total */}
                        <td className="py-3 px-4 text-right font-bold text-slate-800 whitespace-nowrap">
                          L {parseFloat(f.monto_total || '0').toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onEditarFactura(f)}
                              className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                              title="Editar factura"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleEliminar(f.id_factura, f.proveedor)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                              title="Eliminar factura"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Fila del desglose expandida */}
                      {esDesglosada && estaExpandida && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="py-3 px-8">
                            <div className="border border-slate-200 bg-white rounded-lg p-3 shadow-xs space-y-2">
                              <div className="text-xxs font-bold uppercase tracking-wider text-slate-400 pb-1.5 border-b border-gray-100">
                                Desglose de Factura ({f.proveedor})
                              </div>
                              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                                {f.desglose.map((item: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center py-2 text-xxs">
                                    <div className="flex-1 min-w-0 pr-4">
                                      <p className="font-semibold text-slate-700 truncate">{item.descripcion}</p>
                                      <p className="text-gray-400 text-[10px]">
                                        Categoría: {getNombreCategoria(f.tipo, item.categoria_id)}
                                      </p>
                                    </div>
                                    <div className="font-mono font-bold text-slate-800">
                                      L {parseFloat(item.monto || '0').toFixed(2)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xxs font-bold text-slate-700">
                                <span>Total Desglosado:</span>
                                <span>L {parseFloat(f.monto_total || '0').toFixed(2)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaFacturas;
