import React, { useState, useEffect } from 'react';
import {
  BarChart3, Download, Users, Calendar,
  DollarSign, AlertCircle, RefreshCw, Info, Percent, TrendingUp,
} from 'lucide-react';
import { AreaChart, BarChart, DonutChart, Legend } from '@tremor/react';
import {
  obtenerEstadisticas, obtenerOcupacion, obtenerIngresos, obtenerClientes,
  ReportStats, OcupacionData, IngresosData, ClientesData,
} from '../../api/reportesService';

const TABS = ['Resumen Ejecutivo', 'Ocupación', 'Finanzas', 'Clientes'];
const PERIODS: { key: string; label: string }[] = [
  { key: 'semana', label: '7 días' },
  { key: 'mes',    label: '30 días' },
  { key: 'trimestre', label: '90 días' },
  { key: 'año',   label: '1 año' },
];

/* ── Small reusable pieces ─────────────────────────────── */
const EmptyChart: React.FC<{ msg?: string }> = ({ msg = 'Sin datos en este período' }) => (
  <div style={{ height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    <BarChart3 size={28} color="var(--shell-border-strong)" />
    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{msg}</span>
  </div>
);

const PanelTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode; badge?: string; badgeColor?: string }> =
  ({ icon, children, badge, badgeColor = 'var(--accent)' }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <p className="panel-card-title" style={{ marginBottom: 0 }}>
        {icon && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 8 }}>{icon}</span>}
        {children}
      </p>
      {badge && (
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
          padding: '3px 10px', borderRadius: 99,
          background: `color-mix(in srgb, ${badgeColor} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${badgeColor} 22%, transparent)`,
          color: badgeColor,
        }}>
          {badge}
        </span>
      )}
    </div>
  );

/* ── Loading skeleton ───────────────────────────────────── */
const LoadingState: React.FC = () => (
  <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
    <div style={{ height: 14, width: 160, borderRadius: 8, marginBottom: 10 }} className="skeleton" />
    <div style={{ height: 36, width: 260, borderRadius: 10, marginBottom: 10 }} className="skeleton" />
    <div style={{ height: 16, width: 340, borderRadius: 8, marginBottom: 36 }} className="skeleton" />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="kpi-card" style={{ minHeight: 120 }}>
          <div style={{ height: 10, width: 80, borderRadius: 6 }} className="skeleton" />
          <div style={{ height: 34, width: 110, borderRadius: 8, marginTop: 8 }} className="skeleton" />
          <div style={{ height: 5, borderRadius: 99, marginTop: 8 }} className="skeleton" />
        </div>
      ))}
    </div>
    <div style={{ height: 320, borderRadius: 20 }} className="skeleton" />
  </div>
);

/* ── Error state ────────────────────────────────────────── */
const ErrorState: React.FC<{ error: string | null; onRetry: () => void }> = ({ error, onRetry }) => (
  <div style={{ padding: '28px clamp(20px, 3vw, 52px)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
    <div className="panel-card" style={{ maxWidth: 440, textAlign: 'center', padding: '40px 32px' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 18,
        background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 18px', color: '#ef4444',
      }}>
        <AlertCircle size={26} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', margin: '0 0 8px' }}>Error al cargar reportes</p>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
        {error || 'No se pudieron recuperar los datos desde el servidor.'}
      </p>
      <button
        onClick={onRetry}
        className="btn-premium btn-premium-primary"
        style={{ margin: '0 auto', display: 'inline-flex', gap: 8 }}
      >
        <RefreshCw size={14} /> Reintentar
      </button>
    </div>
  </div>
);

/* ── Main component ─────────────────────────────────────── */
export const Reportes: React.FC = () => {
  const [periodo, setPeriodo]       = useState('mes');
  const [activeTab, setActiveTab]   = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [statsData,    setStatsData]    = useState<ReportStats | null>(null);
  const [ocupacionData, setOcupacionData] = useState<OcupacionData | null>(null);
  const [ingresosData, setIngresosData] = useState<IngresosData | null>(null);
  const [clientesData, setClientesData] = useState<ClientesData | null>(null);

  const getPeriodDates = (p: string) => {
    const ahora = new Date();
    const hasta = ahora.toLocaleDateString('en-CA');
    const desde = new Date(ahora);
    if (p === 'semana')    desde.setDate(ahora.getDate() - 7);
    else if (p === 'trimestre') desde.setDate(ahora.getDate() - 90);
    else if (p === 'año') desde.setFullYear(ahora.getFullYear() - 1);
    else                   desde.setDate(ahora.getDate() - 30);
    return { desde: desde.toLocaleDateString('en-CA'), hasta };
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const { desde, hasta } = getPeriodDates(periodo);
      const [stats, ocupacion, ingresos, clientes] = await Promise.all([
        obtenerEstadisticas(periodo),
        obtenerOcupacion(desde, hasta),
        obtenerIngresos(periodo),
        obtenerClientes(),
      ]);
      setStatsData(stats);
      setOcupacionData(ocupacion);
      setIngresosData(ingresos);
      setClientesData(clientes);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar los reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, [periodo]);

  const handleExportPDF = () => window.print();

  if (loading) return <LoadingState />;
  if (error || !statsData || !ocupacionData || !ingresosData || !clientesData) {
    return <ErrorState error={error} onRetry={cargarDatos} />;
  }

  /* ── Chart data ────────────────────────────────────────── */
  const ocupacionTendencia = statsData.tasaOcupacion.map((pct, idx) => ({
    dia: `Día ${idx + 1}`,
    'Tasa Ocupación': pct,
  }));

  const reservasEstadoData = statsData.reservasPorEstado.map(r => ({
    name: r.estado,
    value: r.cantidad,
  }));

  const ingresosDiariosChart = ingresosData.detalles.map(d => ({
    dia: d.periodo,
    'Monto HNL': d.cantidad,
  }));

  const clientesNuevosRecurrentes = [
    { name: 'Recurrentes', value: clientesData.recurrentes },
    { name: 'Nuevos',      value: clientesData.nuevos },
  ];

  const picoPorcentaje = ocupacionData.dias.length > 0
    ? Math.max(...ocupacionData.dias.map(d => d.ocupacion))
    : 0;

  const totalCobros = ingresosData.detalles.reduce((acc, curr) => acc + curr.reservas, 0);

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-header-left" style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{
            position: 'absolute', left: 0, top: 2, bottom: 4,
            width: 4, borderRadius: 99,
            background: 'linear-gradient(to bottom, var(--accent), #8b5cf6)',
          }} />
          <span className="page-kicker">Inteligencia de negocio</span>
          <h1 className="page-title" style={{
            background: 'linear-gradient(135deg, var(--text-h) 0%, var(--accent) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Análisis e Informes
          </h1>
          <p className="page-sub">Métricas consolidadas de reservas y finanzas del hotel</p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={cargarDatos}
            title="Sincronizar datos"
            style={{
              width: 38, height: 38, borderRadius: 10,
              border: '1px solid var(--shell-border-strong)',
              background: 'var(--card-bg)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--muted)', transition: 'all .18s ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-h)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--shell-border-strong)'; }}
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={handleExportPDF}
            className="btn-premium btn-premium-primary"
            style={{ height: 38, gap: 7 }}
          >
            <Download size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 28 }}>

        <div className="kpi-card kpi-card-blue" style={{ animationDelay: '0ms' }}>
          <div className="kpi-icon-wrap"><Percent size={18} /></div>
          <div className="kpi-label">Ocupación Promedio</div>
          <div className="kpi-value">{statsData.ocupacionPromedio}%</div>
          <div className="kpi-progress">
            <div className="kpi-progress-fill" style={{ width: `${statsData.ocupacionPromedio}%` }} />
          </div>
          <div className="kpi-sub"><span className="kpi-sub-text">Capacidad operativa activa</span></div>
        </div>

        <div className="kpi-card kpi-card-emerald" style={{ animationDelay: '60ms' }}>
          <div className="kpi-icon-wrap"><DollarSign size={18} /></div>
          <div className="kpi-label">Ingresos del Período</div>
          <div className="kpi-value" style={{ fontSize: 22 }}>L {statsData.totalIngresos.toLocaleString('es-HN')}</div>
          <div className="kpi-sub">
            <span className="kpi-trend-badge kpi-trend-up" style={{ fontSize: 10 }}>Activo</span>
            <span className="kpi-sub-text">≈ ${ingresosData.totalUSD.toLocaleString()} USD</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-violet" style={{ animationDelay: '120ms' }}>
          <div className="kpi-icon-wrap"><Calendar size={18} /></div>
          <div className="kpi-label">Total Reservas</div>
          <div className="kpi-value">{statsData.totalReservas}</div>
          <div className="kpi-sub"><span className="kpi-sub-text">Estadías en el período</span></div>
        </div>

        <div className="kpi-card kpi-card-amber" style={{ animationDelay: '180ms' }}>
          <div className="kpi-icon-wrap"><Users size={18} /></div>
          <div className="kpi-label">Huéspedes Activos</div>
          <div className="kpi-value">{clientesData.activos}</div>
          <div className="kpi-sub">
            <span className="kpi-sub-text">de {clientesData.total} registrados</span>
          </div>
        </div>

      </div>

      {/* ── Tabs + Período ────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>

        {/* Tab list */}
        <div style={{
          display: 'flex', gap: 2, padding: 4,
          background: 'rgba(15,23,42,.03)',
          borderRadius: 14, border: '1px solid var(--shell-border)',
        }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 600, transition: 'all .18s ease',
                background: activeTab === i ? 'var(--card-bg)' : 'transparent',
                color: activeTab === i ? 'var(--accent)' : 'var(--muted)',
                boxShadow: activeTab === i ? '0 1px 4px rgba(15,23,42,.1)' : 'none',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div style={{
          display: 'flex', gap: 2, padding: 4,
          background: 'rgba(15,23,42,.03)',
          borderRadius: 12, border: '1px solid var(--shell-border)',
        }}>
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              style={{
                padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: 11.5, fontWeight: 700, transition: 'all .18s ease',
                background: periodo === key ? 'var(--accent)' : 'transparent',
                color: periodo === key ? '#ffffff' : 'var(--muted)',
                boxShadow: periodo === key ? '0 2px 8px rgba(37,99,235,.22)' : 'none',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab 0: Resumen Ejecutivo ─────────────────────── */}
      {activeTab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, animation: 'fadeInUp .35s ease both' }}>

          <div className="panel-card">
            <PanelTitle icon={<TrendingUp size={15} color="var(--accent)" />} badge="Historial">
              Tendencia de Ocupación
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
              Porcentaje de habitaciones vendidas en el período
            </p>
            {ocupacionTendencia.length > 0 ? (
              <AreaChart
                className="h-72"
                data={ocupacionTendencia}
                index="dia"
                categories={['Tasa Ocupación']}
                colors={['blue']}
                valueFormatter={v => `${v}%`}
                yAxisWidth={40}
                showGridLines={false}
              />
            ) : <EmptyChart />}
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <PanelTitle icon={<Calendar size={15} color="var(--accent)" />} badge="Período">
              Distribución de Reservas
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
              Comportamiento por estados
            </p>
            {reservasEstadoData.length > 0 ? (
              <>
                <DonutChart
                  className="h-52"
                  data={reservasEstadoData}
                  category="value"
                  index="name"
                  colors={['emerald', 'blue', 'amber', 'rose', 'violet']}
                  valueFormatter={v => `${v} reservas`}
                  variant="donut"
                />
                <Legend
                  className="mt-5 justify-center flex-wrap gap-x-4 gap-y-2"
                  categories={reservasEstadoData.map(r => r.name)}
                  colors={['emerald', 'blue', 'amber', 'rose', 'violet']}
                />
              </>
            ) : <EmptyChart msg="No se registraron reservas en este período" />}
          </div>
        </div>
      )}

      {/* ── Tab 1: Ocupación ────────────────────────────── */}
      {activeTab === 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, animation: 'fadeInUp .35s ease both' }}>

          <div className="panel-card">
            <PanelTitle icon={<TrendingUp size={15} color="#6366f1" />} badge="Día por día" badgeColor="#6366f1">
              Detalle de Ocupación Diaria
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
              Capacidad física utilizada cada jornada
            </p>
            {ocupacionData.dias.length > 0 ? (
              <AreaChart
                className="h-72"
                data={ocupacionData.dias.map(d => ({
                  Fecha: d.fecha.substring(5),
                  'Ocupación %': d.ocupacion,
                }))}
                index="Fecha"
                categories={['Ocupación %']}
                colors={['indigo']}
                valueFormatter={v => `${v}%`}
                yAxisWidth={40}
                showGridLines={false}
              />
            ) : <EmptyChart msg="No hay registros para el rango indicado" />}
          </div>

          <div className="panel-card">
            <PanelTitle icon={<Percent size={15} color="#6366f1" />}>
              Métricas de Ocupación
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 20 }}>
              Eficiencia del inventario físico
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Ocupación Promedio
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#6366f1',
                  background: 'rgba(99,102,241,.08)', padding: '2px 10px', borderRadius: 99,
                  border: '1px solid rgba(99,102,241,.18)',
                }}>
                  {ocupacionData.promedio}%
                </span>
              </div>
              <div className="kpi-progress" style={{ height: 7 }}>
                <div className="kpi-progress-fill" style={{ width: `${ocupacionData.promedio}%`, background: 'linear-gradient(90deg, #6366f1, #3b82f6)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="stat-row">
                <span className="stat-row-label">Días analizados</span>
                <span className="stat-row-value">{ocupacionData.dias.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-row-label">Total habitaciones</span>
                <span className="stat-row-value">{ocupacionData.dias[0]?.habitacionesTotales || 0}</span>
              </div>
              <div className="stat-row" style={{ borderBottom: 'none' }}>
                <span className="stat-row-label">Pico máximo</span>
                <span className="stat-row-value" style={{ color: 'var(--success)', fontSize: 17 }}>
                  {picoPorcentaje}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Finanzas ──────────────────────────────── */}
      {activeTab === 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, animation: 'fadeInUp .35s ease both' }}>

          <div className="panel-card">
            <PanelTitle icon={<DollarSign size={15} color="#10b981" />} badge="Finanzas" badgeColor="#10b981">
              Ingresos por Período
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
              Efectivo cobrado expresado en moneda nacional (HNL)
            </p>
            {ingresosDiariosChart.length > 0 ? (
              <BarChart
                className="h-72"
                data={ingresosDiariosChart}
                index="dia"
                categories={['Monto HNL']}
                colors={['emerald']}
                valueFormatter={v => `L. ${v.toLocaleString('es-HN')}`}
                yAxisWidth={80}
                showGridLines={false}
              />
            ) : <EmptyChart msg="Sin movimientos financieros en el período" />}
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <PanelTitle icon={<DollarSign size={15} color="#10b981" />}>
              Caja y Equivalencias
            </PanelTitle>

            {/* HNL block */}
            <div style={{
              padding: '18px 20px', borderRadius: 14,
              background: 'linear-gradient(160deg, #ffffff 0%, rgba(236,253,245,.85) 100%)',
              border: '1px solid rgba(16,185,129,.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Moneda local (HNL)
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: 'rgba(16,185,129,.1)', padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(16,185,129,.2)' }}>
                  Activo
                </span>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#065f46', letterSpacing: '-.03em', margin: 0 }}>
                L {ingresosData.total.toLocaleString('es-HN')}
              </p>
            </div>

            {/* USD block */}
            <div style={{
              padding: '18px 20px', borderRadius: 14,
              background: 'linear-gradient(160deg, #ffffff 0%, rgba(239,246,255,.85) 100%)',
              border: '1px solid rgba(59,130,246,.15)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Dólares (USD)
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                  Ref: {ingresosData.tipoCambio}
                </span>
              </div>
              <p style={{ fontSize: 26, fontWeight: 800, color: '#1e40af', letterSpacing: '-.03em', margin: 0 }}>
                $ {ingresosData.totalUSD.toLocaleString('es-HN')}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div className="stat-row" style={{ borderBottom: 'none' }}>
                <span className="stat-row-label">Transacciones totales</span>
                <span className="stat-row-value">{totalCobros} cobros</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 3: Clientes ──────────────────────────────── */}
      {activeTab === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, animation: 'fadeInUp .35s ease both' }}>

          <div className="panel-card">
            <PanelTitle icon={<Users size={15} color="#8b5cf6" />} badge="Clientes Elite" badgeColor="#8b5cf6">
              Top Huéspedes de la Propiedad
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
              Huéspedes de mayor volumen operativo
            </p>

            {clientesData.topClientes.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-premium" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Huésped</th>
                      <th style={{ textAlign: 'right' }}>Estadías</th>
                      <th style={{ textAlign: 'right' }}>Total Facturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesData.topClientes.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 10,
                              background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.14)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 800, color: 'var(--accent)',
                            }}>
                              {c.nombre.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{c.nombre}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {c.reservas}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                          L {c.gastado.toLocaleString('es-HN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyChart msg="No hay historial de clientes en el hotel" />}
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <PanelTitle icon={<Users size={15} color="#8b5cf6" />}>
              Fidelización de Clientes
            </PanelTitle>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: -12, marginBottom: 16 }}>
              Nuevos vs recurrentes en el período
            </p>

            {clientesNuevosRecurrentes.some(x => x.value > 0) ? (
              <>
                <DonutChart
                  className="h-52"
                  data={clientesNuevosRecurrentes}
                  category="value"
                  index="name"
                  colors={['teal', 'violet']}
                  valueFormatter={v => `${v} clientes`}
                />
                <Legend
                  className="mt-5 justify-center flex-wrap gap-x-4 gap-y-2"
                  categories={clientesNuevosRecurrentes.map(r => r.name)}
                  colors={['teal', 'violet']}
                />
                <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div className="stat-row">
                    <span className="stat-row-label">Clientes nuevos</span>
                    <span className="stat-row-value" style={{ color: 'var(--accent)' }}>{clientesData.nuevos}</span>
                  </div>
                  <div className="stat-row" style={{ borderBottom: 'none' }}>
                    <span className="stat-row-label">Clientes recurrentes</span>
                    <span className="stat-row-value" style={{ color: 'var(--success)' }}>{clientesData.recurrentes}</span>
                  </div>
                </div>
              </>
            ) : <EmptyChart msg="Sin datos suficientes de fidelidad" />}
          </div>
        </div>
      )}

      {/* ── Footer info ───────────────────────────────────── */}
      <div className="alert-banner alert-banner-blue" style={{ marginTop: 24 }}>
        <div className="alert-banner-icon"><Info size={16} /></div>
        <div>
          <p className="alert-banner-title">Auditoría operativa en tiempo real</p>
          <p className="alert-banner-desc">
            Los datos presentados corresponden a la conciliación en tiempo real de reservas y transacciones del hotel seleccionado.
          </p>
        </div>
      </div>

    </div>
  );
};
