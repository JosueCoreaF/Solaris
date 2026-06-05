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

  const symb = moneda === 'USD' ? '$' : 'L';

  return (
    <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left" style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 0, top: 2, bottom: 4, width: 4, borderRadius: 99, background: 'linear-gradient(to bottom, #10b981, #3b82f6)' }} />
          <span className="page-kicker">Contabilidad</span>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg, var(--text-h) 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Finanzas e Ingresos
          </h1>
          <p className="page-sub">Gestión de pagos, conversión de moneda y flujo de caja</p>
        </div>
        <button onClick={cargarDatos} className="btn-premium btn-premium-secondary" style={{ height: 38, gap: 7 }}>
          <RefreshCw size={14} /> Sincronizar
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, padding: '0 0 16px' }}>
        {([
          { id: 'resumen',   label: 'Resumen',           icon: <DollarSign size={14} /> },
          { id: 'registrar', label: 'Registrar Factura',  icon: <Receipt size={14} /> },
          { id: 'historial', label: 'Historial Facturas', icon: <List size={14} /> },
        ] as const).map(tab => (
          <button key={tab.id}
            onClick={() => { setVistaActiva(tab.id); setFacturaAEditar(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: 'all .18s ease',
              background: vistaActiva === tab.id ? 'var(--accent)' : 'rgba(15,23,42,.04)',
              color: vistaActiva === tab.id ? '#ffffff' : 'var(--muted)',
              boxShadow: vistaActiva === tab.id ? '0 2px 8px rgba(37,99,235,.22)' : 'none',
            }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Registrar ────────────────────────────────── */}
      {vistaActiva === 'registrar' && (
        <RegistrarFactura
          facturaAEditar={facturaAEditar}
          onCancelarEdicion={() => { setFacturaAEditar(null); setVistaActiva('historial'); }}
          onFacturaGuardada={() => { setFacturaAEditar(null); setRecargarTrigger(p => p + 1); setVistaActiva('historial'); }}
        />
      )}

      {/* ── Tab: Historial ────────────────────────────────── */}
      {vistaActiva === 'historial' && (
        <ListaFacturas
          recargarTrigger={recargarTrigger}
          onEditarFactura={(f) => { setFacturaAEditar(f); setVistaActiva('registrar'); }}
        />
      )}

      {/* ── Tab: Resumen ──────────────────────────────────── */}
      {vistaActiva === 'resumen' && (
        loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando resumen financiero…</span>
          </div>
        ) : error ? (
          <div className="alert-banner alert-banner-red">
            <div className="alert-banner-icon"><AlertCircle size={16} /></div>
            <div><p className="alert-banner-title">Error al cargar</p><p className="alert-banner-desc">{error}</p></div>
          </div>
        ) : (
          <>
            {/* ── Moneda + Período ────────────────────────── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Moneda</label>
                <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(15,23,42,.03)', borderRadius: 11, border: '1px solid var(--shell-border)' }}>
                  {(['HNL', 'USD'] as const).map(m => (
                    <button key={m} onClick={() => setMoneda(m)} style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, transition: 'all .18s',
                      background: moneda === m ? 'var(--accent)' : 'transparent',
                      color: moneda === m ? '#fff' : 'var(--muted)',
                      boxShadow: moneda === m ? '0 2px 8px rgba(37,99,235,.22)' : 'none',
                    }}>{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Período</label>
                <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(15,23,42,.03)', borderRadius: 11, border: '1px solid var(--shell-border)' }}>
                  {[{ k: 'semana', l: '7 días' }, { k: 'mes', l: '30 días' }, { k: 'trimestre', l: '90 días' }].map(p => (
                    <button key={p.k} onClick={() => setFiltro(p.k)} style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 700, transition: 'all .18s',
                      background: filtro === p.k ? 'var(--accent)' : 'transparent',
                      color: filtro === p.k ? '#fff' : 'var(--muted)',
                      boxShadow: filtro === p.k ? '0 2px 8px rgba(37,99,235,.22)' : 'none',
                    }}>{p.l}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── KPI Cards ───────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div className="kpi-card kpi-card-emerald" style={{ animationDelay: '0ms' }}>
                <div className="kpi-icon-wrap"><TrendingUp size={18} /></div>
                <div className="kpi-label">Ingresos</div>
                <div className="kpi-value" style={{ fontSize: 24 }}>{symb} {displayIngresos.toLocaleString('es-HN')}</div>
                <div className="kpi-sub">
                  <span className="kpi-trend-badge kpi-trend-up">Activo</span>
                  <span className="kpi-sub-text">Total del período</span>
                </div>
              </div>
              <div className="kpi-card kpi-card-rose" style={{ animationDelay: '60ms' }}>
                <div className="kpi-icon-wrap"><TrendingDown size={18} /></div>
                <div className="kpi-label">Egresos</div>
                <div className="kpi-value" style={{ fontSize: 24 }}>{symb} {displayEgresos.toLocaleString('es-HN')}</div>
                <div className="kpi-sub"><span className="kpi-sub-text">Gastos totales</span></div>
              </div>
              <div className="kpi-card kpi-card-blue" style={{ animationDelay: '120ms' }}>
                <div className="kpi-icon-wrap"><Zap size={18} /></div>
                <div className="kpi-label">Saldo Neto</div>
                <div className="kpi-value" style={{ fontSize: 24 }}>{symb} {displaySaldo.toLocaleString('es-HN')}</div>
                <div className="kpi-sub">
                  {displaySaldo >= 0
                    ? <span className="kpi-trend-badge kpi-trend-up">Positivo</span>
                    : <span className="kpi-trend-badge kpi-trend-down">Negativo</span>}
                  <span className="kpi-sub-text">Balance disponible</span>
                </div>
              </div>
            </div>

            {/* ── Tipo de cambio ─────────────────────────── */}
            <div className="alert-banner alert-banner-orange" style={{ marginBottom: 20 }}>
              <div className="alert-banner-icon" style={{ fontSize: 14 }}>💱</div>
              <div>
                <p className="alert-banner-title">Tipo de cambio activo</p>
                <p className="alert-banner-desc">1 USD = L {data.tipoCambio.toFixed(2)} · Equivalente en USD: ${data.ingresoUSD.toLocaleString('en-US')}</p>
              </div>
            </div>

            {/* ── Proporción + Movimientos ───────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20, marginBottom: 20 }}>

              {/* Pie chart panel */}
              <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <p className="panel-card-title"><BarChart3 size={15} color="var(--accent)" /> Proporción I/E</p>
                <div style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
                  <PieChart ingresos={data.ingresoTotal} egresos={data.egresosTotal} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                  <div className="stat-row">
                    <span className="stat-row-label">Ingresos</span>
                    <span className="stat-row-value" style={{ color: 'var(--success)' }}>
                      {data.ingresoTotal + data.egresosTotal > 0
                        ? ((data.ingresoTotal / (data.ingresoTotal + data.egresosTotal)) * 100).toFixed(0)
                        : 0}%
                    </span>
                  </div>
                  <div className="stat-row" style={{ borderBottom: 'none' }}>
                    <span className="stat-row-label">Egresos</span>
                    <span className="stat-row-value" style={{ color: 'var(--danger)' }}>
                      {data.ingresoTotal + data.egresosTotal > 0
                        ? ((data.egresosTotal / (data.ingresoTotal + data.egresosTotal)) * 100).toFixed(0)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Movimientos recientes */}
              <div className="panel-card">
                <p className="panel-card-title"><TrendingUp size={15} color="var(--accent)" /> Movimientos Recientes</p>
                {data.movimientos && data.movimientos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 13, top: 10, bottom: 8, width: 1.5, background: 'linear-gradient(to bottom, rgba(37,99,235,.25), transparent)', borderRadius: 99 }} />
                    {data.movimientos.map((mov, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: i < data.movimientos.length - 1 ? 14 : 0 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: mov.tipo === 'ingreso' ? 'rgba(16,185,129,.1)' : 'rgba(239,68,68,.1)',
                          border: `1.5px solid ${mov.tipo === 'ingreso' ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', zIndex: 1, boxShadow: '0 0 0 3px var(--shell-bg)',
                        }}>
                          {mov.tipo === 'ingreso'
                            ? <TrendingUp size={12} color="#10b981" />
                            : <TrendingDown size={12} color="#ef4444" />}
                        </div>
                        <div style={{ flex: 1, paddingTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mov.concepto}</span>
                            <span style={{ fontWeight: 700, fontSize: 13, flexShrink: 0, color: mov.tipo === 'ingreso' ? 'var(--success)' : 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                              {mov.tipo === 'ingreso' ? '+' : '−'} {symb} {(moneda === 'USD' ? Math.round(mov.monto / data.tipoCambio) : mov.monto).toLocaleString('es-HN')}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--shell-border-subtle)', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>{mov.fecha}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}>
                    <DollarSign size={24} color="var(--shell-border-strong)" />
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>No hay movimientos recientes</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Egresos por Categoría ──────────────────── */}
            <div className="panel-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p className="panel-card-title" style={{ marginBottom: 2 }}><BarChart3 size={15} color="var(--accent)" /> Egresos por Categoría</p>
                  <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0 }}>Desglose detallado de gastos contables del período</p>
                </div>
                <div style={{ display: 'flex', gap: 4, padding: 4, background: 'rgba(15,23,42,.03)', borderRadius: 11, border: '1px solid var(--shell-border)' }}>
                  {([{ k: 'caja_chica' as const, l: '☕ Caja Chica' }, { k: 'general' as const, l: '🏢 Gastos Generales' }]).map(t => (
                    <button key={t.k} onClick={() => { setTipoGastoReporte(t.k); setCategoriaExpandida(null); }}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700, transition: 'all .18s',
                        background: tipoGastoReporte === t.k ? 'var(--card-bg)' : 'transparent',
                        color: tipoGastoReporte === t.k ? 'var(--accent)' : 'var(--muted)',
                        boxShadow: tipoGastoReporte === t.k ? '0 1px 4px rgba(15,23,42,.1)' : 'none',
                      }}>{t.l}</button>
                  ))}
                </div>
              </div>

              {totalTipoGasto === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <BarChart3 size={28} color="var(--shell-border-strong)" />
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Sin gastos de <strong style={{ color: 'var(--text-h)' }}>{tipoGastoReporte === 'caja_chica' ? 'Caja Chica' : 'Gastos Generales'}</strong> en este período
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                  {/* Distribución */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Distribución</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                      {egresosPorCategoria.map(c => {
                        if (c.total === 0) return null;
                        const pct = totalTipoGasto > 0 ? (c.total / totalTipoGasto) * 100 : 0;
                        const sel = categoriaExpandida === c.id;
                        return (
                          <div key={c.id} onClick={() => setCategoriaExpandida(sel ? null : c.id)}
                            style={{
                              padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all .18s',
                              background: sel ? 'var(--accent-bg)' : 'var(--card-bg)',
                              border: `1px solid ${sel ? 'var(--accent-border)' : 'var(--shell-border)'}`,
                              boxShadow: sel ? '0 2px 8px rgba(37,99,235,.08)' : 'none',
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                📁 {c.nombre}
                                <span style={{ fontSize: 10, background: 'var(--shell-border-subtle)', padding: '1px 7px', borderRadius: 99, color: 'var(--muted)', fontWeight: 500 }}>
                                  {c.transacciones.length} reg.
                                </span>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-h)', fontVariantNumeric: 'tabular-nums' }}>
                                  L {c.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace', width: 28, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="kpi-progress" style={{ height: 6 }}>
                              <div className="kpi-progress-fill" style={{ width: `${pct}%`, background: sel ? 'var(--accent)' : 'linear-gradient(90deg, #8b5cf6, #3b82f6)' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Detalle de categoría seleccionada */}
                  <div style={{ border: '1px solid var(--shell-border)', borderRadius: 14, background: 'rgba(15,23,42,.015)', padding: 16, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
                    {categoriaExpandida === null ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, textAlign: 'center', padding: 24 }}>
                        <span style={{ fontSize: 28 }}>👈</span>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)', margin: 0 }}>Selecciona una categoría</p>
                        <p style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 240, lineHeight: 1.5 }}>
                          Haz clic en cualquier categoría para ver el desglose detallado de transacciones.
                        </p>
                      </div>
                    ) : (() => {
                      const catSel = egresosPorCategoria.find(c => c.id === categoriaExpandida);
                      if (!catSel) return null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--shell-border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18 }}>📁</span>
                              <div>
                                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>{catSel.nombre}</p>
                                <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{catSel.transacciones.length} transacciones</p>
                              </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '4px 12px', borderRadius: 99, border: '1px solid var(--accent-border)' }}>
                              L {catSel.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 320, display: 'flex', flexDirection: 'column' }}>
                            {catSel.transacciones.map((tr, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--shell-border-subtle)' }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <span style={{ fontSize: 10, fontFamily: 'monospace', background: 'var(--shell-border-subtle)', padding: '1px 6px', borderRadius: 6, color: 'var(--muted)' }}>{tr.fecha}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.proveedor}</span>
                                  </div>
                                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.descripcion}</p>
                                  {tr.no_factura && <p style={{ fontSize: 10, color: 'var(--muted)', margin: '1px 0 0', fontFamily: 'monospace' }}>Fact: {tr.no_factura}</p>}
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-h)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                                  L {tr.monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ──────────────────────────────────── */}
            <div className="alert-banner alert-banner-blue" style={{ marginTop: 20 }}>
              <div className="alert-banner-icon"><DollarSign size={16} /></div>
              <div>
                <p className="alert-banner-title">Datos en tiempo real</p>
                <p className="alert-banner-desc">Ingresos y egresos calculados automáticamente desde reservas y gastos registrados. Sincroniza regularmente.</p>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default Finance;
