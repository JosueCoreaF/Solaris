import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, Zap, AlertCircle, Receipt, List, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { obtenerResumen, obtenerFacturas } from '../../api/finanzasService';
import { RegistrarFactura } from './RegistrarFactura';
import { ListaFacturas } from './ListaFacturas';
import { useFinanceAI } from '../../context/FinanceAIContext';

interface FinanceData {
  ingresoTotal: number;
  egresosTotal: number;
  saldo: number;
  tipoCambio: number;
  ingresoUSD: number;
  movimientos: { tipo: 'ingreso' | 'egreso'; concepto: string; monto: number; fecha: string }[];
}

const PieChart: React.FC<{ ingresos: number; egresos: number }> = ({ ingresos, egresos }) => {
  const total = ingresos + egresos;
  if (!total) return <div className="text-xs text-gray-400">Sin datos financieros</div>;
  const ingresosPct = (ingresos / total) * 100;

  const angleIngresos = (ingresosPct / 100) * 360;

  const toRadians = (angle: number) => (angle * Math.PI) / 180;
  const getPoint = (angle: number, radius: number) => {
    const rad = toRadians(angle - 90);
    return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)];
  };

  const p2 = getPoint(angleIngresos, 80);
  const p3 = getPoint(360, 80);

  const largeArc = angleIngresos > 180 ? 1 : 0;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className="w-full">
      <circle cx="100" cy="100" r="80" fill="#10b981" />
      <path
        d={`M 100 100 L ${p2[0]} ${p2[1]} A 80 80 0 ${largeArc} 1 ${p3[0]} ${p3[1]} Z`}
        fill="#ef4444"
      />
      <circle cx="100" cy="100" r="50" fill="white" />
      <text x="100" y="95" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1e293b">
        {Math.round(ingresosPct)}%
      </text>
      <text x="100" y="115" textAnchor="middle" fontSize="12" fill="#64748b">
        Ingresos
      </text>
    </svg>
  );
};

export const Finance: React.FC = () => {
  const [data, setData] = useState<FinanceData>({
    ingresoTotal: 0,
    egresosTotal: 0,
    saldo: 0,
    tipoCambio: 24.5,
    ingresoUSD: 0,
    movimientos: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moneda, setMoneda] = useState<'HNL' | 'USD'>('HNL');
  const [filtro, setFiltro] = useState('mes');
  const [vistaActiva, setVistaActiva] = useState<'resumen' | 'registrar' | 'historial'>('resumen');
  const [facturaAEditar, setFacturaAEditar] = useState<any | null>(null);
  const [recargarTrigger, setRecargarTrigger] = useState(0);

  // Estados para reporte detallado por categoría
  const { categoriasGenerales, categoriasCajaChica } = useFinanceAI();
  const [facturas, setFacturas] = useState<any[]>([]);
  const [tipoGastoReporte, setTipoGastoReporte] = useState<'caja_chica' | 'general'>('caja_chica');
  const [categoriaExpandida, setCategoriaExpandida] = useState<number | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const resumen = await obtenerResumen(filtro);
      const facturasList = await obtenerFacturas(filtro);

      setData((prev) => ({
        ...prev,
        ingresoTotal: resumen.ingresoTotal,
        egresosTotal: resumen.egresosTotal,
        saldo: resumen.saldo,
        tipoCambio: resumen.tipoCambio,
        ingresoUSD: resumen.ingresoUSD,
      }));
      setFacturas(facturasList || []);
    } catch (err: any) {
      console.error('Error cargando finanzas:', err);
      setError(err?.message || 'Error al cargar los datos financieros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [filtro, recargarTrigger]);

  // Agrupar egresos de facturas por categoría
  const categoriasActuales = tipoGastoReporte === 'general' ? categoriasGenerales : categoriasCajaChica;

  const egresosPorCategoria = React.useMemo(() => {
    const list = facturas.filter(f => f.tipo === tipoGastoReporte);
    const map: Record<number, { id: number; nombre: string; total: number; transacciones: any[] }> = {};

    // Inicializar todas las categorías actuales en el mapa para que aparezcan aunque estén en 0
    categoriasActuales.forEach(c => {
      map[c.id] = {
        id: c.id,
        nombre: c.nombre,
        total: 0,
        transacciones: []
      };
    });

    list.forEach(f => {
      const esDesglosada = Array.isArray(f.desglose) && f.desglose.length > 0;
      
      if (esDesglosada) {
        f.desglose.forEach((item: any) => {
          const catId = Number(item.categoria_id);
          const monto = parseFloat(item.monto || '0');
          
          if (!map[catId]) {
            map[catId] = { id: catId, nombre: `Categoría ${catId}`, total: 0, transacciones: [] };
          }
          
          map[catId].total += monto;
          map[catId].transacciones.push({
            fecha: f.fecha,
            proveedor: f.proveedor,
            no_factura: f.no_factura,
            descripcion: item.descripcion,
            monto: monto,
            factura_id: f.id_factura
          });
        });
      } else {
        const catId = Number(tipoGastoReporte === 'general' ? f.categoria_general_id : f.categoria_chica_id);
        const monto = parseFloat(f.monto_total || '0');
        
        if (catId) {
          if (!map[catId]) {
            map[catId] = { id: catId, nombre: `Categoría ${catId}`, total: 0, transacciones: [] };
          }
          map[catId].total += monto;
          map[catId].transacciones.push({
            fecha: f.fecha,
            proveedor: f.proveedor,
            no_factura: f.no_factura,
            descripcion: f.descripcion || 'Gasto único',
            monto: monto,
            factura_id: f.id_factura
          });
        }
      }
    });

    // Filtrar y ordenar de mayor a menor gasto, o alfabéticamente si no hay gasto
    return Object.values(map).sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.nombre.localeCompare(b.nombre);
    });
  }, [facturas, tipoGastoReporte, categoriasActuales]);

  const totalTipoGasto = egresosPorCategoria.reduce((sum, c) => sum + c.total, 0);

  const displayIngresos = moneda === 'USD' ? Math.round(data.ingresoTotal / data.tipoCambio) : data.ingresoTotal;
  const displayEgresos = moneda === 'USD' ? Math.round(data.egresosTotal / data.tipoCambio) : data.egresosTotal;
  const displaySaldo = moneda === 'USD' ? Math.round(data.saldo / data.tipoCambio) : data.saldo;

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ADMINISTRACIÓN</p>
          <h1 className="text-3xl font-light text-gray-900 flex items-center gap-3">
            <DollarSign size={36} className="text-green-500" />
            Finanzas e Ingresos
          </h1>
          <p className="text-gray-500 text-sm mt-2">Gestión de pagos, conversión de moneda y flujo de caja</p>
        </div>
        <button
          onClick={cargarDatos}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RefreshCw size={16} /> Sincronizar
        </button>
      </div>

      {/* Tabs de navegación */}
      <div className="flex gap-1 mb-8 border-b border-gray-100">
        <button
          onClick={() => {
            setVistaActiva('resumen');
            setFacturaAEditar(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
            vistaActiva === 'resumen'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <DollarSign size={15} /> Resumen
        </button>
        <button
          onClick={() => {
            setVistaActiva('registrar');
            setFacturaAEditar(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
            vistaActiva === 'registrar'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Receipt size={15} /> Registrar Factura
        </button>
        <button
          onClick={() => {
            setVistaActiva('historial');
            setFacturaAEditar(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
            vistaActiva === 'historial'
              ? 'border-slate-800 text-slate-800'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List size={15} /> Historial de Facturas
        </button>
      </div>

      {/* Tab: Registrar Factura (Crear o Editar) */}
      {vistaActiva === 'registrar' && (
        <RegistrarFactura
          facturaAEditar={facturaAEditar}
          onCancelarEdicion={() => {
            setFacturaAEditar(null);
            setVistaActiva('historial');
          }}
          onFacturaGuardada={() => {
            setFacturaAEditar(null);
            setRecargarTrigger(prev => prev + 1);
            setVistaActiva('historial');
          }}
        />
      )}

      {/* Tab: Historial de Facturas */}
      {vistaActiva === 'historial' && (
        <ListaFacturas
          recargarTrigger={recargarTrigger}
          onEditarFactura={(f) => {
            setFacturaAEditar(f);
            setVistaActiva('registrar');
          }}
        />
      )}

      {/* Tab: Resumen */}
      {vistaActiva === 'resumen' && (
        loading ? (
          <div className="p-8 text-center">
            <div className="inline-block text-gray-400">
              <div className="animate-pulse">Cargando resumen financiero...</div>
            </div>
          </div>
        ) : error ? (
          <div className="p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle size={20} className="text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Selector de moneda y período */}
            <div className="flex gap-6 mb-8">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">Moneda</label>
                <div className="flex gap-2">
                  {['HNL', 'USD'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMoneda(m as 'HNL' | 'USD')}
                      style={{
                        padding: '8px 16px',
                        border: moneda === m ? 'none' : '1px solid #e2e8f0',
                        background: moneda === m ? '#1e293b' : '#fff',
                        color: moneda === m ? '#fff' : '#64748b',
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase mb-2 block">Período</label>
                <div className="flex gap-2">
                  {['semana', 'mes', 'trimestre'].map(p => (
                    <button
                      key={p}
                      onClick={() => setFiltro(p)}
                      style={{
                        padding: '8px 14px',
                        border: filtro === p ? 'none' : '1px solid #e2e8f0',
                        background: filtro === p ? '#1e293b' : '#fff',
                        color: filtro === p ? '#fff' : '#64748b',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-green-50 rounded-lg p-6 border border-green-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-green-600 uppercase mb-2">Ingresos</p>
                    <p className="text-3xl font-light text-green-900">
                      {moneda === 'USD' ? '$' : 'L'} {displayIngresos.toLocaleString()}
                    </p>
                    <p className="text-xs text-green-600 mt-2">↑ 12% vs mes anterior</p>
                  </div>
                  <TrendingUp className="text-green-500" size={28} />
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-6 border border-red-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-red-600 uppercase mb-2">Egresos</p>
                    <p className="text-3xl font-light text-red-900">
                      {moneda === 'USD' ? '$' : 'L'} {displayEgresos.toLocaleString()}
                    </p>
                    <p className="text-xs text-red-600 mt-2">Gastos totales</p>
                  </div>
                  <TrendingDown className="text-red-500" size={28} />
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Saldo Neto</p>
                    <p className="text-3xl font-light text-blue-900">
                      {moneda === 'USD' ? '$' : 'L'} {displaySaldo.toLocaleString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-2">Disponible</p>
                  </div>
                  <Zap className="text-blue-500" size={28} />
                </div>
              </div>
            </div>

            {/* Conversión de moneda */}
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-amber-900">
                <strong>💱 Tipo de cambio:</strong> 1 USD = L {data.tipoCambio.toFixed(2)}
              </p>
            </div>

            {/* Gráficos y tabla */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Gráfico de pastel */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-1">
                <h3 className="text-lg font-light text-gray-900 mb-4">Proporción I/E</h3>
                <div className="flex justify-center">
                  <PieChart ingresos={data.ingresoTotal} egresos={data.egresosTotal} />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ingresos:</span>
                    <span className="font-semibold text-green-600">
                      {data.ingresoTotal + data.egresosTotal > 0 
                        ? ((data.ingresoTotal / (data.ingresoTotal + data.egresosTotal)) * 100).toFixed(0) 
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Egresos:</span>
                    <span className="font-semibold text-red-600">
                      {data.ingresoTotal + data.egresosTotal > 0 
                        ? ((data.egresosTotal / (data.ingresoTotal + data.egresosTotal)) * 100).toFixed(0) 
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Movimientos recientes */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 lg:col-span-2">
                <h3 className="text-lg font-light text-gray-900 mb-4">Movimientos Recientes</h3>
                <div className="space-y-3">
                  {data.movimientos && data.movimientos.length > 0 ? (
                    data.movimientos.map((mov, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ background: mov.tipo === 'ingreso' ? '#10b981' : '#ef4444' }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 font-medium">{mov.concepto}</p>
                            <p className="text-xs text-gray-500">{mov.fecha}</p>
                          </div>
                        </div>
                        <span
                          className="text-sm font-semibold ml-2 whitespace-nowrap"
                          style={{ color: mov.tipo === 'ingreso' ? '#10b981' : '#ef4444' }}
                        >
                          {mov.tipo === 'ingreso' ? '+' : '-'} {moneda === 'USD' ? '$' : 'L'}
                          {(moneda === 'USD' ? Math.round(mov.monto / data.tipoCambio) : mov.monto).toLocaleString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-xs">
                      No hay movimientos recientes registrados.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reporte de Gastos Detallados por Categoría */}
            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="text-indigo-600 animate-pulse" size={22} />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Reporte Mensual de Egresos por Categoría</h3>
                    <p className="text-xs text-gray-400">Analiza el detalle al centavo de tus gastos contables.</p>
                  </div>
                </div>

                {/* Alternar entre Caja Chica y Gastos Generales */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-250/50">
                  <button
                    onClick={() => {
                      setTipoGastoReporte('caja_chica');
                      setCategoriaExpandida(null);
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      tipoGastoReporte === 'caja_chica'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    ☕ Caja Chica
                  </button>
                  <button
                    onClick={() => {
                      setTipoGastoReporte('general');
                      setCategoriaExpandida(null);
                    }}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      tipoGastoReporte === 'general'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    🏢 Gastos Generales
                  </button>
                </div>
              </div>

              {/* Contenido del Reporte */}
              <div className="space-y-4">
                {totalTipoGasto === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    No se han registrado gastos de tipo <strong className="text-slate-600">{tipoGastoReporte === 'caja_chica' ? 'Caja Chica' : 'Gastos Generales'}</strong> en este período.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Barra de progreso / Lista de Categorías */}
                    <div className="lg:col-span-6 space-y-3">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Distribución</h4>
                      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                        {egresosPorCategoria.map(c => {
                          const porcentaje = totalTipoGasto > 0 ? (c.total / totalTipoGasto) * 100 : 0;
                          if (c.total === 0) return null; // No mostrar las vacías en la distribución para no saturar

                          const estaExpandida = categoriaExpandida === c.id;

                          return (
                            <div 
                              key={c.id} 
                              onClick={() => setCategoriaExpandida(estaExpandida ? null : c.id)}
                              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                estaExpandida 
                                  ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' 
                                  : 'bg-white border-gray-150 hover:bg-slate-50/60'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1.5">
                                <span className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                                  <span>📁</span> {c.nombre}
                                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-gray-500 font-normal">
                                    {c.transacciones.length} {c.transacciones.length === 1 ? 'reg.' : 'regs.'}
                                  </span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-800">
                                    L {c.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-mono w-8 text-right">
                                    {porcentaje.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${porcentaje}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detalle interactivo de la Categoría Seleccionada */}
                    <div className="lg:col-span-6 border border-gray-150 rounded-xl bg-slate-50/30 p-4 flex flex-col min-h-[350px]">
                      {categoriaExpandida === null ? (
                        <div className="flex-1 flex flex-col justify-center items-center text-center p-6">
                          <span className="text-3xl mb-2">👈</span>
                          <h5 className="font-semibold text-xs text-slate-700">Selecciona una categoría</h5>
                          <p className="text-xxs text-gray-400 mt-1 max-w-[240px]">
                            Haz clic sobre cualquier categoría para ver el desglose al centavo: qué día se compró, qué factura y a qué precio.
                          </p>
                        </div>
                      ) : (
                        (() => {
                          const catSel = egresosPorCategoria.find(c => c.id === categoriaExpandida);
                          if (!catSel) return null;

                          return (
                            <div className="space-y-3 flex-1 flex flex-col">
                              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-lg">📁</span>
                                  <div>
                                    <h5 className="font-bold text-xs text-slate-800">{catSel.nombre}</h5>
                                    <p className="text-[10px] text-gray-400">{catSel.transacciones.length} transacciones registradas</p>
                                  </div>
                                </div>
                                <span className="bg-indigo-100 text-indigo-800 font-bold text-xs px-2.5 py-1 rounded-full">
                                  Total: L {catSel.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>

                              <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-gray-100">
                                {catSel.transacciones.map((tr, index) => (
                                  <div key={index} className="py-2.5 flex justify-between items-start gap-4">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 mb-0.5">
                                        <span className="text-[10px] bg-slate-100 font-mono text-gray-500 px-1 py-0.25 rounded">
                                          {tr.fecha}
                                        </span>
                                        <span className="font-semibold text-slate-700 text-xxs truncate">
                                          {tr.proveedor}
                                        </span>
                                      </div>
                                      <p className="text-xxs text-slate-500 italic truncate">{tr.descripcion}</p>
                                      {tr.no_factura && (
                                        <p className="text-[9px] text-gray-400 font-mono">Factura: {tr.no_factura}</p>
                                      )}
                                    </div>
                                    <div className="text-right font-bold text-slate-800 text-xs whitespace-nowrap">
                                      L {tr.monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-900">
                <strong>📋 Nota:</strong> Los ingresos y egresos se calculan automáticamente desde las reservas y gastos registrados. Asegúrate de sincronizar regularmente los datos.
              </p>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default Finance;
