import React, { useEffect, useState } from 'react';
import { Users, CreditCard, TrendingUp, Calendar, AlertTriangle, UserPlus, ArrowUpRight } from 'lucide-react';
import { fetchDashboardKPIs, fetchDashboardTrends, fetchRecentActivity, type DashboardKPIs, type DashboardTrends, type ActivityItem } from '../api/dashboardService';
import { fetchClases, type ClaseGym } from '../api/clasesService';
import { fetchAsistenciaPorFecha } from '../api/asistenciaService';
import { useSync } from '../context/SyncContext';
import { useRole } from '../hooks/useRole';
import type { UserRole } from '../hooks/useRole';
import { MemberGrowthChart, WeeklyRevenueChart } from './dashboard/TrendsCharts';
import { ClassesToday } from './dashboard/ClassesToday';
import { ActivityFeed } from './dashboard/ActivityFeed';

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

const hora = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const GREETINGS: Partial<Record<UserRole, string>> = {
  PROPIETARIO:   'Panel Ejecutivo',
  ADMIN:         'Panel de Administración',
  RECEPCIONISTA: 'Recepción y Ventas',
  CONTADOR:      'Panel Financiero',
  MANTENIMIENTO: 'Panel de Operaciones',
};

const fmt = (n: number) => n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface KPICard {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  accent?: boolean;
}

const quickLinks = [
  { label: 'Nuevo Miembro', path: '/miembros' },
  { label: 'Nueva Inscripción', path: '/inscripciones' },
  { label: 'Registrar Pago', path: '/pagos' },
  { label: 'Clases de Hoy', path: '/clases' },
];

export const Dashboard: React.FC = () => {
  const { gimnasio } = useSync();
  const { role } = useRole();
  const [kpis, setKpis] = useState<DashboardKPIs>({
    totalMiembros: 0, miembrosActivos: 0, inscripcionesActivas: 0,
    vencenEsteMes: 0, ingresosMes: 0, clasesHoy: 0, nuevosEstaSemana: 0,
  });
  const [trends, setTrends] = useState<DashboardTrends>({ memberGrowth: [], weeklyRevenue: [] });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [clasesHoy, setClasesHoy] = useState<ClaseGym[]>([]);
  const [asistenciaPorClase, setAsistenciaPorClase] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardKPIs().then(setKpis).finally(() => setLoading(false));
    fetchDashboardTrends().then(setTrends);
    fetchRecentActivity().then(setActivity);
    fetchClases().then(clases => {
      const diaHoy = DIAS_SEMANA[new Date().getDay()];
      setClasesHoy(clases.filter(c => c.dia_semana === diaHoy && c.activa));
    });
    const hoy = new Date().toISOString().split('T')[0];
    fetchAsistenciaPorFecha(hoy).then(asistencias => {
      const map: Record<string, number> = {};
      for (const a of asistencias) {
        if (a.estado === 'asistio') map[a.id_clase] = (map[a.id_clase] ?? 0) + 1;
      }
      setAsistenciaPorClase(map);
    });
  }, []);

  const cards: KPICard[] = [
    { label: 'Total Miembros', value: kpis.totalMiembros, sub: `${kpis.miembrosActivos} activos`, icon: <Users size={18} /> },
    { label: 'Membresías Activas', value: kpis.inscripcionesActivas, sub: 'inscripciones vigentes', icon: <CreditCard size={18} /> },
    { label: 'Vencen Este Mes', value: kpis.vencenEsteMes, sub: 'por renovar', icon: <AlertTriangle size={18} />, accent: kpis.vencenEsteMes > 0 },
    { label: 'Ingresos del Mes', value: `L. ${fmt(kpis.ingresosMes)}`, sub: 'total cobrado', icon: <TrendingUp size={18} /> },
    { label: 'Clases Hoy', value: kpis.clasesHoy, sub: 'sesiones programadas', icon: <Calendar size={18} /> },
    { label: 'Nuevos (7 días)', value: kpis.nuevosEstaSemana, sub: 'miembros registrados', icon: <UserPlus size={18} /> },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p className="page-subtitle" style={{ marginBottom: 2 }}>
            {hora()} · {new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="page-title">
            {GREETINGS[role] ?? gimnasio?.nombre_gimnasio ?? 'Panel de Control'}
          </h1>
          <p className="page-subtitle">// {gimnasio?.nombre_gimnasio ?? 'Resumen general del gimnasio'}</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <div className="auth-loading-spinner" style={{ width: 18, height: 18 }} />
          Cargando métricas...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14, marginBottom: 32 }}>
            {cards.map((card, i) => (
              <div
                key={card.label}
                className="stat-card"
                style={{
                  animation: `fadeInUp 0.4s ease-out ${i * 0.05}s both`,
                  borderColor: card.accent ? 'var(--accent2-bg)' : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.14em' }}>
                    {card.label}
                  </span>
                  <div style={{
                    width: 32, height: 32, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: card.accent ? 'var(--accent2)' : 'var(--accent)',
                    background: card.accent ? 'var(--accent2-bg)' : 'var(--accent-bg)',
                  }}>
                    {card.icon}
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 38, color: 'var(--text-h)', lineHeight: 1, letterSpacing: '0.01em' }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {kpis.vencenEsteMes > 0 && (
            <div style={{
              background: 'var(--accent2-bg)', border: '1px solid rgba(255,92,53,0.28)',
              borderRadius: 4, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
              borderLeft: '3px solid var(--accent2)',
            }}>
              <AlertTriangle size={20} style={{ color: 'var(--accent2)', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 13, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kpis.vencenEsteMes} membresía(s) vencen este mes
                </strong>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  Revisa la sección de Membresías para gestionar las renovaciones.
                </p>
              </div>
            </div>
          )}

          <div className="dashboard-trends-grid" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="stat-card chart-card">
                <div className="chart-header">
                  <div>
                    <div className="chart-title">Crecimiento de Miembros</div>
                    <div className="chart-sub">// Últimos 6 meses</div>
                  </div>
                </div>
                <div className="chart-body">
                  <MemberGrowthChart data={trends.memberGrowth} />
                </div>
              </div>
              <div className="stat-card chart-card">
                <div className="chart-header">
                  <div>
                    <div className="chart-title">Ingresos Semanales</div>
                    <div className="chart-sub">// Últimos 7 días</div>
                  </div>
                </div>
                <div className="chart-body">
                  <WeeklyRevenueChart data={trends.weeklyRevenue} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="stat-card" style={{ padding: '20px 22px' }}>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--display)', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-h)', marginBottom: 4, position: 'relative', zIndex: 1 }}>
                  Aforo de Hoy
                </h3>
                <div className="chart-sub" style={{ marginBottom: 8, position: 'relative', zIndex: 1 }}>// Clases programadas y ocupación</div>
                <ClassesToday clases={clasesHoy} asistenciaPorClase={asistenciaPorClase} />
              </div>
              <div className="stat-card" style={{ padding: '20px 22px' }}>
                <h3 style={{ fontSize: 16, fontFamily: 'var(--display)', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-h)', marginBottom: 4, position: 'relative', zIndex: 1 }}>
                  Actividad Reciente
                </h3>
                <div className="chart-sub" style={{ marginBottom: 8, position: 'relative', zIndex: 1 }}>// Últimos movimientos</div>
                <ActivityFeed items={activity} />
              </div>
            </div>
          </div>

          <div className="stat-card" style={{ padding: 26 }}>
            <h3 style={{ fontSize: 18, fontFamily: 'var(--display)', textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-h)', marginBottom: 18 }}>
              Accesos Rápidos
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {quickLinks.map(item => (
                <a
                  key={item.path}
                  href={item.path}
                  className="btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  {item.label}
                  <ArrowUpRight size={14} />
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
