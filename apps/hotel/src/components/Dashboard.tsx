import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, DollarSign, Users, Calendar, BarChart3,
  Plus, Settings, Clock, ArrowUp, ArrowDown, Wrench,
  BedDouble, Sparkles, CreditCard, FileText, ShieldCheck,
  Upload, UserCheck, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../context/AuthContext';
import {
  obtenerKPIsDashboard, calcularTendenciasOcupacion,
  obtenerSolicitudesPendientes, type DashboardKPI, type TendenciaOcupacion,
} from '../api/dashboardService';
import {
  fetchHoteles, fetchReservas, addDays, toDateKey, getOnlyDate,
  getDisplayStatus, getStatusLabel, getStatusColor, type Reserva,
} from '../api/bookingsService';
import { auditService } from '../api/auditService';

const GREETINGS: Record<string, string> = {
  PROPIETARIO: 'Panel Ejecutivo',
  ADMIN: 'Panel de Administración',
  RECEPCIONISTA: 'Panel de Recepción',
  CONTADOR: 'Panel Financiero',
  MANTENIMIENTO: 'Panel de Mantenimiento',
};

const GREETING_SUB: Record<string, string> = {
  PROPIETARIO: 'Vista consolidada de operaciones',
  ADMIN: 'Gestión operativa del hotel',
  RECEPCIONISTA: 'Reservas, pagos y atención al huésped',
  CONTADOR: 'Finanzas, facturas y reportes',
  MANTENIMIENTO: 'Tareas e incidencias asignadas',
};

function formatLps(n: number) {
  return `L. ${n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hora() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/* ── Bezier smooth path helper ───────────────────────── */
const makeBezier = (pts: Array<{ x: number; y: number }>) => {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cpx = (pts[i].x + pts[i + 1].x) / 2;
    d += ` C ${cpx},${pts[i].y} ${cpx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
};

/* ── SVG Area Chart ──────────────────────────────── */
const TendenciaChart: React.FC<{ data: TendenciaOcupacion[] }> = ({ data }) => {
  const width = 500;
  const height = 150;
  const paddingLeft = 32;
  const paddingRight = 16;
  const paddingTop = 24;
  const paddingBottom = 20;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => ({
    x: paddingLeft + (i / Math.max(data.length - 1, 1)) * chartWidth,
    y: height - paddingBottom - (d.ocupacion / 100) * chartHeight,
    val: d.ocupacion,
    dia: d.dia,
  }));

  const linePath = makeBezier(points);
  const areaPath = linePath
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
    : '';

  return (
    <div style={{ width: '100%', position: 'relative', marginTop: 10 }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.00" />
          </linearGradient>
          <filter id="chartGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {[0, 50, 100].map((grid, idx) => {
          const y = height - paddingBottom - (grid / 100) * chartHeight;
          return (
            <g key={idx}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y}
                stroke="var(--shell-border)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end"
                style={{ fontSize: 9, fill: 'var(--muted)', fontWeight: 500, fontFamily: 'var(--sans)' }}>
                {grid}%
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

        {linePath && (
          <>
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="3.5"
              strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.18" />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" filter="url(#chartGlow)" />
          </>
        )}

        {points.map((p, idx) => (
          <g key={idx}>
            <circle cx={p.x} cy={p.y} r="6" fill="var(--accent)" fillOpacity="0.12" />
            <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="var(--accent)" strokeWidth="2" />
            <text x={p.x} y={p.y - 9} textAnchor="middle"
              style={{ fontSize: 9.5, fill: 'var(--text-h)', fontWeight: 700, fontFamily: 'var(--display)' }}>
              {p.val}%
            </text>
            <text x={p.x} y={height - 4} textAnchor="middle"
              style={{ fontSize: 9, fill: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--sans)' }}>
              {p.dia}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ── Recent Activity Component ────────────────────── */
const RecentActivity: React.FC<{ logs: any[] }> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}>
        <Clock size={24} color="var(--shell-border-strong)" />
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>Sin actividad registrada recientemente</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Timeline vertical line */}
      <div style={{
        position: 'absolute', left: 13, top: 14, bottom: 14,
        width: 1.5,
        background: 'linear-gradient(to bottom, rgba(37,99,235,.3), rgba(37,99,235,.04))',
        borderRadius: 99,
        pointerEvents: 'none',
      }} />

      {logs.map((log, index) => {
        const timeAgo = log.segundos_atras < 60
          ? 'Ahora'
          : log.segundos_atras < 3600
          ? `${Math.floor(log.segundos_atras / 60)}m`
          : `${Math.floor(log.segundos_atras / 3600)}h`;

        const actionLabel = auditService.obtenerEtiquetaAccion(log.accion);
        const actionIcon = auditService.obtenerIconoAccion(log.accion);

        return (
          <div key={log.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: index < logs.length - 1 ? 16 : 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              backgroundColor: 'var(--accent-bg)',
              border: '1.5px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, flexShrink: 0, position: 'relative', zIndex: 1,
              boxShadow: '0 0 0 3px var(--shell-bg)',
            }}>
              {actionIcon}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, paddingTop: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-h)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {actionLabel}
                </span>
                <span style={{
                  fontSize: 10, color: 'var(--muted)', flexShrink: 0, fontWeight: 600,
                  background: 'var(--shell-border-subtle)', padding: '2px 7px', borderRadius: 99,
                }}>
                  {timeAgo}
                </span>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: 1 }}>
                {auditService.describirCambio(log)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Reservas de Hoy ─────────────────────────────── */
type TipoReservaHoy = 'check_in' | 'check_out' | 'en_curso';

const TIPO_HOY_META: Record<TipoReservaHoy, { label: string; color: string; campo: 'check_in' | 'check_out' }> = {
  check_in:  { label: 'Llega hoy',     color: '#2563eb', campo: 'check_in' },
  check_out: { label: 'Sale hoy',      color: '#f59e0b', campo: 'check_out' },
  en_curso:  { label: 'Hospedado',     color: '#10b981', campo: 'check_out' },
};

const ReservaHoyRow: React.FC<{ r: Reserva; tipo: TipoReservaHoy }> = ({ r, tipo }) => {
  const status = getDisplayStatus(r);
  const meta = TIPO_HOY_META[tipo];
  const fecha = new Date(r[meta.campo]);
  const horaTxt = isNaN(fecha.getTime())
    ? '--:--'
    : fecha.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--shell-border-subtle)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.huesped || 'Huésped'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.habitacion} · {tipo === 'en_curso' ? `Sale ${horaTxt}` : horaTxt}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, color: meta.color, background: `${meta.color}1a` }}>
          {meta.label}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
          color: getStatusColor(status), background: `${getStatusColor(status)}1a`,
        }}>
          {getStatusLabel(status)}
        </span>
      </div>
    </div>
  );
};

const ReservasHoyList: React.FC<{ items: Reserva[]; tipo: TipoReservaHoy; vacioTexto: string }> = ({ items, tipo, vacioTexto }) => {
  if (items.length === 0) {
    return <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>{vacioTexto}</div>;
  }
  return (
    <div>
      {items.map(r => <ReservaHoyRow key={r.id_reserva_hotel} r={r} tipo={tipo} />)}
    </div>
  );
};

const ReservasHoyPanel: React.FC<{ checkIns: Reserva[]; checkOuts: Reserva[]; enCurso: Reserva[] }> = ({ checkIns, checkOuts, enCurso }) => (
  <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <p className="panel-card-title"><Calendar size={16} color="var(--accent)" /> Reservas de hoy</p>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, flex: 1 }}>
      <div style={{ minWidth: 0 }}>
        <div className="section-divider" style={{ marginBottom: 4 }}>Check-ins ({checkIns.length})</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
          <ReservasHoyList items={checkIns} tipo="check_in" vacioTexto="Sin check-ins hoy" />
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="section-divider" style={{ marginBottom: 4 }}>Check-outs ({checkOuts.length})</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
          <ReservasHoyList items={checkOuts} tipo="check_out" vacioTexto="Sin check-outs hoy" />
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="section-divider" style={{ marginBottom: 4 }}>Hospedados ({enCurso.length})</div>
        <div style={{ maxHeight: 200, overflowY: 'auto', paddingRight: 2 }}>
          <ReservasHoyList items={enCurso} tipo="en_curso" vacioTexto="Sin huéspedes alojados hoy" />
        </div>
      </div>
    </div>
  </div>
);

/* ── KPI Card ──────────────────────────────────────── */
interface KpiProps {
  label: string; value: string; sub: string;
  color: string; icon: React.ReactNode;
  progress?: number; delay?: number;
  trend?: 'up' | 'down' | null;
}
const KpiCard: React.FC<KpiProps> = ({ label, value, sub, color, icon, progress, delay = 0, trend }) => (
  <div className={`kpi-card kpi-card-${color}`} style={{ animationDelay: `${delay}ms` }}>
    <div className="kpi-icon-wrap">{icon}</div>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {progress !== undefined && (
      <div className="kpi-progress" style={{ marginTop: 2 }}>
        <div className="kpi-progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    )}
    <div className="kpi-sub">
      {trend === 'up' && (
        <span className="kpi-trend-badge kpi-trend-up">
          <ArrowUp size={9} strokeWidth={2.5} /> Alza
        </span>
      )}
      {trend === 'down' && (
        <span className="kpi-trend-badge kpi-trend-down">
          <ArrowDown size={9} strokeWidth={2.5} /> Baja
        </span>
      )}
      <span className="kpi-sub-text">{sub}</span>
    </div>
  </div>
);

/* ── Quick action chip ─────────────────────────────── */
interface ActionProps { to: string; icon: React.ReactNode; label: string; delay?: number; }
const ActionChip: React.FC<{ to: string; icon: React.ReactNode; label: string; delay?: number }> = ({ to, icon, label, delay = 0 }) => (
  <Link to={to} className="action-chip animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
    <div className="action-chip-icon">{icon}</div>
    <span className="action-chip-label">{label}</span>
  </Link>
);

/* ── VISTA PROPIETARIO ──────────────────────────────── */
const DashboardPropietario: React.FC<{
  kpis: DashboardKPI;
  tendencias: TendenciaOcupacion[];
  usuariosPendientes: number;
  hoteles: any[];
  loading: boolean;
  recentLogs: any[];
  checkInsHoy: Reserva[];
  checkOutsHoy: Reserva[];
  enCursoHoy: Reserva[];
}> = ({ kpis, tendencias, usuariosPendientes, hoteles, loading, recentLogs, checkInsHoy, checkOutsHoy, enCursoHoy }) => {
  const neto = kpis.ingresosMes - kpis.gastosMes;
  const isTendenciasEmpty = tendencias.every(d => d.ocupacion === 0);

  return (
    <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
      {/* Cabecera */}
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div className="page-header-left" style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{
            position: 'absolute', left: 0, top: 2, bottom: 4,
            width: 4, borderRadius: 99,
            background: 'linear-gradient(to bottom, var(--accent), #8b5cf6)',
          }} />
          <span className="page-kicker">{hora()} · {new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg, var(--text-h) 0%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Panel Ejecutivo
          </h1>
          <p className="page-sub">Resumen consolidado de operaciones del hotel</p>
        </div>
        <div className="status-online">
          <div className="status-dot" />
          Sistema activo
        </div>
      </div>

      {/* Alertas */}
      {(usuariosPendientes > 0 || kpis.reservasPendientes > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {usuariosPendientes > 0 && (
            <div className="alert-banner alert-banner-orange">
              <div className="alert-banner-icon"><AlertTriangle size={17} /></div>
              <div>
                <p className="alert-banner-title">Solicitudes pendientes de aprobación</p>
                <p className="alert-banner-desc">{usuariosPendientes} usuario(s) esperando acceso al sistema</p>
              </div>
            </div>
          )}
          {kpis.reservasPendientes > 0 && (
            <div className="alert-banner alert-banner-blue">
              <div className="alert-banner-icon"><Calendar size={17} /></div>
              <div>
                <p className="alert-banner-title">Check-ins próximos</p>
                <p className="alert-banner-desc">{kpis.reservasPendientes} reserva(s) ingresan en los próximos 3 días</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginBottom: 28 }}>
        <KpiCard label="Ocupación Actual" value={`${kpis.ocupacion}%`}
          sub={kpis.ocupacion >= 75 ? 'Meta alcanzada ✓' : 'Potencial de mejora'}
          color="blue" icon={<TrendingUp size={18} />} progress={kpis.ocupacion} delay={0} />
        <KpiCard label="Ingresos Hoy" value={formatLps(kpis.ingresosHoy)}
          sub={`Mes: ${formatLps(kpis.ingresosMes)}`}
          color="emerald" icon={<DollarSign size={18} />} delay={60} trend="up" />
        <KpiCard label="Por Ingresar" value={String(kpis.reservasPendientes)}
          sub="Check-ins próximos 3 días"
          color="amber" icon={<Calendar size={18} />} delay={120} />
        <KpiCard label="Score Operativo" value={`${kpis.scoreClientes}%`}
          sub="Basado en operaciones"
          color="violet" icon={<Users size={18} />} progress={kpis.scoreClientes} delay={180} />
      </div>

      {/* Fila inferior: tendencias + financiero + auditoria + acciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.1fr minmax(260px, 1fr)', gap: 20, alignItems: 'stretch' }}>

        {/* Gráfico ocupación 7 días */}
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 270 }}>
          <p className="panel-card-title"><BarChart3 size={16} color="var(--accent)" /> Ocupación últimos 7 días</p>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {isTendenciasEmpty ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: 8 }}>
                <BarChart3 size={28} color="var(--shell-border-strong)" />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin reservas activas esta semana</span>
              </div>
            ) : (
              <TendenciaChart data={tendencias} />
            )}
          </div>
        </div>

        {/* Resumen financiero */}
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="panel-card-title"><DollarSign size={16} color="var(--accent)" /> Finanzas del mes</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <div className="stat-row">
              <span className="stat-row-label">Ingresos</span>
              <span className="stat-row-value" style={{ color: 'var(--success)' }}>{formatLps(kpis.ingresosMes)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">Gastos</span>
              <span className="stat-row-value" style={{ color: 'var(--danger)' }}>{formatLps(kpis.gastosMes)}</span>
            </div>
            <div className="stat-row" style={{ marginTop: 4, borderBottom: 'none' }}>
              <span className="stat-row-label" style={{ fontWeight: 700 }}>Neto</span>
              <span className="stat-row-value" style={{ fontSize: 16, color: neto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatLps(neto)}
              </span>
            </div>
            
            {hoteles.length > 1 && kpis.desglose && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--shell-border-subtle)' }}>
                <div className="section-divider" style={{ marginBottom: 6, paddingBottom: 4 }}>Por sede</div>
                <div style={{ maxHeight: 110, overflowY: 'auto', paddingRight: 2 }}>
                  {Object.entries(kpis.desglose).slice(0, 3).map(([hId, monto]) => (
                    <div key={hId} className="stat-row" style={{ padding: '5px 0', borderBottom: 'none' }}>
                      <span className="stat-row-label" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {hoteles.find(h => h.id_hotel === hId)?.nombre_hotel || 'Hotel'}
                      </span>
                      <span className="stat-row-value" style={{ fontSize: 12.5 }}>{formatLps(monto as number)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="panel-card-title"><Clock size={16} color="var(--accent)" /> Actividad reciente</p>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220, paddingRight: 2 }}>
            <RecentActivity logs={recentLogs} />
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="panel-card" style={{ padding: '22px 14px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="panel-card-title" style={{ marginBottom: 12 }}>Accesos rápidos</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
            <ActionChip to="/reservas" icon={<Plus size={18} />} label="Nueva Reserva" delay={0} />
            <ActionChip to="/reportes" icon={<BarChart3 size={18} />} label="Reportes" delay={30} />
            <ActionChip to="/gestionar-roles" icon={<Users size={18} />} label="Roles" delay={60} />
            <ActionChip to="/auditoria" icon={<ShieldCheck size={18} />} label="Auditoría" delay={90} />
            <ActionChip to="/exportar" icon={<Upload size={18} />} label="Exportar" delay={120} />
            <ActionChip to="/config" icon={<Settings size={18} />} label="Config" delay={150} />
          </div>
        </div>

      </div>

      {/* Reservas de hoy */}
      <div style={{ marginTop: 20 }}>
        <ReservasHoyPanel checkIns={checkInsHoy} checkOuts={checkOutsHoy} enCurso={enCursoHoy} />
      </div>
    </div>
  );
};

/* ── VISTA RECEPCIONISTA ────────────────────────────── */
const DashboardRecepcionista: React.FC<{ kpis: DashboardKPI; checkInsHoy: Reserva[]; checkOutsHoy: Reserva[]; enCursoHoy: Reserva[] }> = ({ kpis, checkInsHoy, checkOutsHoy, enCursoHoy }) => (
  <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
    <div className="page-header">
      <div className="page-header-left">
        <span className="page-kicker">{hora()}</span>
        <h1 className="page-title">Recepción</h1>
        <p className="page-sub">Reservas, pagos y atención al huésped</p>
      </div>
      <div className="status-online"><div className="status-dot" />En línea</div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
      <KpiCard label="Ocupación" value={`${kpis.ocupacion}%`} sub="Habitaciones activas"
        color="blue" icon={<BedDouble size={18} />} progress={kpis.ocupacion} delay={0} />
      <KpiCard label="Check-ins Próximos" value={String(kpis.reservasPendientes)} sub="Próximos 3 días"
        color="amber" icon={<UserCheck size={18} />} delay={60} />
      <KpiCard label="Ingresos Hoy" value={`L. ${kpis.ingresosHoy.toLocaleString('es-HN', { minimumFractionDigits: 0 })}`}
        sub="Pagos recibidos" color="emerald" icon={<CreditCard size={18} />} delay={120} trend="up" />
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
      <ActionChip to="/reservas"    icon={<Plus size={20} />}      label="Nueva Reserva" delay={0} />
      <ActionChip to="/pagos"       icon={<CreditCard size={20} />} label="Registrar Pago" delay={50} />
      <ActionChip to="/habitaciones" icon={<BedDouble size={20} />} label="Habitaciones" delay={100} />
      <ActionChip to="/housekeeping" icon={<Sparkles size={20} />}  label="Housekeeping" delay={150} />
      <ActionChip to="/clientes"    icon={<Users size={20} />}      label="Clientes" delay={200} />
      <ActionChip to="/mantenimiento" icon={<Wrench size={20} />}   label="Reportar Incidencia" delay={250} />
      <ActionChip to="/finanzas"    icon={<FileText size={20} />}   label="Ingresos" delay={300} />
      <ActionChip to="/chat"        icon={<Calendar size={20} />}   label="Chat Equipo" delay={350} />
    </div>

    <ReservasHoyPanel checkIns={checkInsHoy} checkOuts={checkOutsHoy} enCurso={enCursoHoy} />
  </div>
);

/* ── VISTA MANTENIMIENTO ────────────────────────────── */
const DashboardMantenimiento: React.FC = () => (
  <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
    <div className="page-header">
      <div className="page-header-left">
        <span className="page-kicker">{hora()}</span>
        <h1 className="page-title">Mantenimiento</h1>
        <p className="page-sub">Tareas asignadas e incidencias activas</p>
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
      <ActionChip to="/mantenimiento" icon={<Wrench size={22} />}    label="Mis Tareas" delay={0} />
      <ActionChip to="/housekeeping"  icon={<Sparkles size={22} />}  label="Housekeeping" delay={60} />
      <ActionChip to="/habitaciones"  icon={<BedDouble size={22} />} label="Estado Habitaciones" delay={120} />
      <ActionChip to="/reservas"      icon={<Calendar size={22} />}  label="Ver Reservas" delay={180} />
      <ActionChip to="/chat"          icon={<Users size={22} />}     label="Chat Equipo" delay={240} />
    </div>
    <div className="panel-card" style={{ background: 'rgba(245,158,11,.04)', borderColor: 'rgba(245,158,11,.2)' }}>
      <p className="panel-card-title"><Wrench size={15} color="#f59e0b" /> Acceso directo</p>
      <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
        Usa el menú <strong style={{ color: 'var(--text-h)' }}>Mantenimiento</strong> para ver tus tareas pendientes,
        actualizar el progreso y agregar notas. En <strong style={{ color: 'var(--text-h)' }}>Housekeeping</strong> puedes
        cambiar el estado de limpieza de cada habitación.
      </p>
    </div>
  </div>
);

/* ── VISTA CONTADOR ─────────────────────────────────── */
const DashboardContador: React.FC<{ kpis: DashboardKPI }> = ({ kpis }) => {
  const neto = kpis.ingresosMes - kpis.gastosMes;
  return (
    <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">{hora()}</span>
          <h1 className="page-title">Panel Financiero</h1>
          <p className="page-sub">Ingresos, egresos y reportes contables</p>
        </div>
        <div className="status-online"><div className="status-dot" />En línea</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Ingresos del Mes" value={formatLps(kpis.ingresosMes)} sub="Total facturado"
          color="emerald" icon={<ArrowUp size={18} />} delay={0} trend="up" />
        <KpiCard label="Gastos del Mes" value={formatLps(kpis.gastosMes)} sub="Total registrado"
          color="rose" icon={<ArrowDown size={18} />} delay={60} />
        <KpiCard label="Neto del Mes" value={formatLps(neto)} sub={neto >= 0 ? 'Balance positivo ✓' : 'Balance negativo'}
          color={neto >= 0 ? 'blue' : 'rose'} icon={<DollarSign size={18} />} delay={120} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <ActionChip to="/finanzas"      icon={<FileText size={20} />}  label="Registrar Factura" delay={0} />
        <ActionChip to="/estado-cuenta" icon={<DollarSign size={20} />} label="Estado de Cuenta" delay={50} />
        <ActionChip to="/reportes"      icon={<BarChart3 size={20} />} label="Reportes" delay={100} />
        <ActionChip to="/exportar"      icon={<Upload size={20} />}    label="Exportar Datos" delay={150} />
        <ActionChip to="/pagos"         icon={<CreditCard size={20} />} label="Pagos" delay={200} />
        <ActionChip to="/clientes"      icon={<Users size={20} />}     label="Clientes" delay={250} />
      </div>
    </div>
  );
};

/* ── VISTA ADMIN ────────────────────────────────────── */
const DashboardAdmin: React.FC<{ kpis: DashboardKPI; tendencias: TendenciaOcupacion[]; recentLogs: any[] }> = ({ kpis, tendencias, recentLogs }) => {
  const isTendenciasEmpty = tendencias.every(d => d.ocupacion === 0);
  return (
    <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
      <div className="page-header">
        <div className="page-header-left" style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{
            position: 'absolute', left: 0, top: 2, bottom: 4,
            width: 4, borderRadius: 99,
            background: 'linear-gradient(to bottom, var(--accent), #8b5cf6)',
          }} />
          <span className="page-kicker">{hora()}</span>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg, var(--text-h) 0%, var(--accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Administración
          </h1>
          <p className="page-sub">Gestión operativa del hotel</p>
        </div>
        <div className="status-online"><div className="status-dot" />En línea</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard label="Ocupación" value={`${kpis.ocupacion}%`} sub="Habitaciones activas"
          color="blue" icon={<TrendingUp size={18} />} progress={kpis.ocupacion} delay={0} />
        <KpiCard label="Ingresos Hoy" value={formatLps(kpis.ingresosHoy)} sub={`Mes: ${formatLps(kpis.ingresosMes)}`} color="emerald"
          icon={<DollarSign size={18} />} delay={60} trend="up" />
        <KpiCard label="Por Ingresar" value={String(kpis.reservasPendientes)} sub="Check-ins 3 días"
          color="amber" icon={<Calendar size={18} />} delay={120} />
        <KpiCard label="Score" value={`${kpis.scoreClientes}%`} sub="Score operativo"
          color="violet" icon={<Users size={18} />} progress={kpis.scoreClientes} delay={180} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr minmax(240px, 1fr)', gap: 20 }}>
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 270 }}>
          <p className="panel-card-title"><BarChart3 size={16} color="var(--accent)" /> Ocupación últimos 7 días</p>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            {isTendenciasEmpty
              ? <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13, width: '100%' }}>Sin datos esta semana</div>
              : <TendenciaChart data={tendencias} />}
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="panel-card-title"><Clock size={16} color="var(--accent)" /> Actividad reciente</p>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220, paddingRight: 2 }}>
            <RecentActivity logs={recentLogs} />
          </div>
        </div>

        <div className="panel-card" style={{ padding: '22px 14px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <p className="panel-card-title" style={{ marginBottom: 12 }}>Accesos rápidos</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1 }}>
            <ActionChip to="/reservas"    icon={<Plus size={18} />}       label="Reservas" delay={0} />
            <ActionChip to="/habitaciones" icon={<BedDouble size={18} />} label="Habitaciones" delay={40} />
            <ActionChip to="/housekeeping" icon={<Sparkles size={18} />}  label="Housekeeping" delay={80} />
            <ActionChip to="/tarifas"     icon={<DollarSign size={18} />} label="Tarifas" delay={120} />
            <ActionChip to="/auditoria"   icon={<ShieldCheck size={18} />} label="Auditoría" delay={160} />
            <ActionChip to="/config"      icon={<Settings size={18} />}   label="Config" delay={200} />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── LOADING SKELETON ───────────────────────────────── */
const DashboardSkeleton: React.FC = () => (
  <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
    <div style={{ height: 24, width: 180, borderRadius: 8, marginBottom: 8 }} className="skeleton" />
    <div style={{ height: 36, width: 280, borderRadius: 10, marginBottom: 32 }} className="skeleton" />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
      {[0,1,2,3].map(i => (
        <div key={i} className="kpi-card" style={{ animationDelay: `${i * 60}ms` }}>
          <div style={{ height: 12, width: 80, borderRadius: 6 }} className="skeleton" />
          <div style={{ height: 34, width: 120, borderRadius: 8, marginTop: 4 }} className="skeleton" />
          <div style={{ height: 5, borderRadius: 99 }} className="skeleton" />
          <div style={{ height: 12, width: 100, borderRadius: 6 }} className="skeleton" />
        </div>
      ))}
    </div>
  </div>
);

/* ── MAIN EXPORT ────────────────────────────────────── */
export const Dashboard: React.FC = () => {
  const { role } = useRole();
  const { user } = useAuth();
  const [kpis, setKpis] = useState<DashboardKPI>({
    ocupacion: 0, ingresosHoy: 0, reservasPendientes: 0,
    scoreClientes: 75, ingresosMes: 0, gastosMes: 0,
  });
  const [tendencias, setTendencias] = useState<TendenciaOcupacion[]>([]);
  const [usuariosPendientes, setUsuariosPendientes] = useState(0);
  const [hoteles, setHoteles] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [checkInsHoy, setCheckInsHoy] = useState<Reserva[]>([]);
  const [checkOutsHoy, setCheckOutsHoy] = useState<Reserva[]>([]);
  const [enCursoHoy, setEnCursoHoy] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const hoy = toDateKey(new Date());
        const mañana = toDateKey(addDays(new Date(), 1));
        const [hotelesData, kpisData, tendenciasData, reservasHoyData] = await Promise.all([
          fetchHoteles().catch(() => []),
          obtenerKPIsDashboard().catch(() => ({ ocupacion: 0, ingresosHoy: 0, reservasPendientes: 0, scoreClientes: 75, ingresosMes: 0, gastosMes: 0 })),
          calcularTendenciasOcupacion().catch(() => []),
          fetchReservas(`${hoy}T00:00`, `${mañana}T00:00`).catch(() => []),
        ]);
        setHoteles(hotelesData);
        setKpis(kpisData);
        setTendencias(tendenciasData);
        const activas = reservasHoyData.filter(r => r.estado !== 'cancelada');
        setCheckInsHoy(activas.filter(r => getOnlyDate(r.check_in) === hoy));
        setCheckOutsHoy(activas.filter(r => getOnlyDate(r.check_out) === hoy));
        setEnCursoHoy(activas.filter(r => getOnlyDate(r.check_in) !== hoy && getOnlyDate(r.check_out) !== hoy));
        if (role === 'PROPIETARIO' || role === 'ADMIN') {
          const p = await obtenerSolicitudesPendientes().catch(() => 0);
          setUsuariosPendientes(p);
        }
        if (role === 'PROPIETARIO' || role === 'ADMIN' || role === 'CONTADOR') {
          const logsData = await auditService.obtenerLogs(5).catch(() => ({ data: [] }));
          setRecentLogs(logsData.data || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  if (loading) return <DashboardSkeleton />;

  switch (role) {
    case 'PROPIETARIO':
      return <DashboardPropietario kpis={kpis} tendencias={tendencias} usuariosPendientes={usuariosPendientes} hoteles={hoteles} loading={loading} recentLogs={recentLogs} checkInsHoy={checkInsHoy} checkOutsHoy={checkOutsHoy} enCursoHoy={enCursoHoy} />;
    case 'ADMIN':
      return <DashboardAdmin kpis={kpis} tendencias={tendencias} recentLogs={recentLogs} />;
    case 'RECEPCIONISTA':
      return <DashboardRecepcionista kpis={kpis} checkInsHoy={checkInsHoy} checkOutsHoy={checkOutsHoy} enCursoHoy={enCursoHoy} />;
    case 'CONTADOR':
      return <DashboardContador kpis={kpis} />;
    case 'MANTENIMIENTO':
      return <DashboardMantenimiento />;
    default:
      return <DashboardRecepcionista kpis={kpis} checkInsHoy={checkInsHoy} checkOutsHoy={checkOutsHoy} enCursoHoy={enCursoHoy} />;
  }
};
