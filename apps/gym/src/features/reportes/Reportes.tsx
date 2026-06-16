import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, CreditCard, AlertTriangle, Wallet } from 'lucide-react';
import { fetchDashboardKPIs, fetchDashboardTrends, type TrendPoint } from '../../api/dashboardService';
import { fetchInscripciones } from '../../api/membresiaService';
import { fetchPagos } from '../../api/pagosService';
import { fetchMiembros } from '../../api/miembrosService';
import { MemberGrowthChart, WeeklyRevenueChart } from '../../components/dashboard/TrendsCharts';

const fmt = (n: number) => `L. ${Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;

export const Reportes: React.FC = () => {
  const [kpis, setKpis] = useState<any>({});
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [deudas, setDeudas] = useState<any[]>([]);
  const [anticipos, setAnticipos] = useState<any[]>([]);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [trends, setTrends] = useState<{ memberGrowth: TrendPoint[]; weeklyRevenue: TrendPoint[] }>({ memberGrowth: [], weeklyRevenue: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboardKPIs(), fetchInscripciones(), fetchPagos(), fetchMiembros(), fetchDashboardTrends()])
      .then(([k, insc, pagos, mb, tr]) => {
        setKpis(k);
        setVencidas(insc.filter(i => i.estado === 'vencida' || (i.estado === 'activa' && new Date(i.fecha_fin) < new Date())));
        setDeudas(insc.filter(i => i.estado_pago === 'deuda' && i.estado === 'activa'));
        setAnticipos(insc.filter(i => i.estado_pago === 'abonada' && i.estado === 'activa' && (Number(i.total) - Number(i.anticipo ?? 0)) > 0));
        setMiembros(mb);
        setTrends(tr);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando reportes...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
        <p className="page-subtitle">Análisis del gimnasio</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Miembros Activos', value: kpis.miembrosActivos ?? 0, icon: <Users size={18} />, color: 'var(--success)' },
          { label: 'Membresías Activas', value: kpis.inscripcionesActivas ?? 0, icon: <CreditCard size={18} />, color: '#60a5fa' },
          { label: 'Vencen Este Mes', value: kpis.vencenEsteMes ?? 0, icon: <AlertTriangle size={18} />, color: 'var(--warning)' },
          { label: 'Ingresos del Mes', value: fmt(kpis.ingresosMes ?? 0), icon: <TrendingUp size={18} />, color: 'var(--accent)' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.14em' }}>{c.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, background: 'rgba(255,255,255,0.04)' }}>
                {c.icon}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 30, color: 'var(--text-h)', lineHeight: 1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="dashboard-trends-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Membresías con deuda */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, color: 'var(--text-h)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Membresías con Deuda ({deudas.length})</h3>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {deudas.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin deudas pendientes</div>
            ) : deudas.map(i => (
              <div key={i.id_inscripcion} style={{ padding: '10px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{(i.miembros as any)?.nombre_completo ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(i.planes_membresia as any)?.nombre ?? '—'}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: 14 }}>{fmt(i.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Membresías vencidas */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={16} style={{ color: 'var(--danger)' }} />
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, color: 'var(--text-h)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Membresías Vencidas ({vencidas.length})</h3>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {vencidas.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin membresías vencidas</div>
            ) : vencidas.map(i => (
              <div key={i.id_inscripcion} style={{ padding: '10px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{(i.miembros as any)?.nombre_completo ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(i.planes_membresia as any)?.nombre ?? '—'}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>Venció: {new Date(i.fecha_fin).toLocaleDateString('es-HN')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Anticipos / Saldos pendientes */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, overflow: 'hidden', gridColumn: '1/-1' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={16} style={{ color: '#60a5fa' }} />
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, color: 'var(--text-h)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Anticipos / Saldos Pendientes ({anticipos.length})</h3>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {anticipos.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin abonos pendientes de saldo</div>
            ) : anticipos.map(i => {
              const saldo = Number(i.total) - Number(i.anticipo ?? 0);
              const pct = Number(i.total) > 0 ? Math.round((Number(i.anticipo ?? 0) / Number(i.total)) * 100) : 0;
              return (
                <div key={i.id_inscripcion} style={{ padding: '10px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{(i.miembros as any)?.nombre_completo ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(i.planes_membresia as any)?.nombre ?? '—'} · Abonado {fmt(i.anticipo ?? 0)} de {fmt(i.total)}</div>
                    <div className="progress-track" style={{ marginTop: 6, maxWidth: 200 }}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: '#60a5fa', boxShadow: '0 0 8px #60a5fa' }} />
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--warning)', fontSize: 14, whiteSpace: 'nowrap' }}>Saldo: {fmt(saldo)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista de miembros */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, overflow: 'hidden', gridColumn: '1/-1' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)' }}>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 16, color: 'var(--text-h)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Estado de Miembros ({miembros.length})</h3>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {(['activo', 'inactivo', 'suspendido'] as const).map(est => {
              const count = miembros.filter(m => m.estado === est).length;
              const pct = miembros.length ? Math.round((count / miembros.length) * 100) : 0;
              const colors: Record<string, string> = { activo: 'var(--success)', inactivo: 'var(--muted)', suspendido: 'var(--danger)' };
              return (
                <div key={est} style={{ flex: 1, padding: '20px', textAlign: 'center', borderRight: '1px solid var(--shell-border-subtle)' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 32, color: colors[est] }}>{count}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6 }}>{est}</div>
                  <div className="progress-track" style={{ marginTop: 10 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: colors[est], boxShadow: `0 0 8px ${colors[est]}` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
