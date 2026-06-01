import React, { useEffect, useState } from 'react';
import { Users, CreditCard, TrendingUp, Calendar, AlertTriangle, UserPlus } from 'lucide-react';
import { fetchDashboardKPIs, type DashboardKPIs } from '../api/dashboardService';
import { useSync } from '../context/SyncContext';

const fmt = (n: number) => n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface KPICard {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
}

export const Dashboard: React.FC = () => {
  const { gimnasio } = useSync();
  const [kpis, setKpis] = useState<DashboardKPIs>({
    totalMiembros: 0, miembrosActivos: 0, inscripcionesActivas: 0,
    vencenEsteMes: 0, ingresosMes: 0, clasesHoy: 0, nuevosEstaSemana: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardKPIs().then(setKpis).finally(() => setLoading(false));
  }, []);

  const cards: KPICard[] = [
    { label: 'Total Miembros', value: kpis.totalMiembros, sub: `${kpis.miembrosActivos} activos`, icon: <Users size={22} />, color: '#16a34a' },
    { label: 'Membresías Activas', value: kpis.inscripcionesActivas, sub: 'inscripciones vigentes', icon: <CreditCard size={22} />, color: '#2563eb' },
    { label: 'Vencen Este Mes', value: kpis.vencenEsteMes, sub: 'por renovar', icon: <AlertTriangle size={22} />, color: '#d97706' },
    { label: 'Ingresos del Mes', value: `L. ${fmt(kpis.ingresosMes)}`, sub: 'total cobrado', icon: <TrendingUp size={22} />, color: '#16a34a' },
    { label: 'Clases Hoy', value: kpis.clasesHoy, sub: 'sesiones programadas', icon: <Calendar size={22} />, color: '#7c3aed' },
    { label: 'Nuevos (7 días)', value: kpis.nuevosEstaSemana, sub: 'miembros registrados', icon: <UserPlus size={22} />, color: '#0891b2' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {gimnasio ? `Panel — ${gimnasio.nombre_gimnasio}` : 'Panel de Control'}
        </h1>
        <p className="page-subtitle">Resumen general del gimnasio</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 14 }}>
          <div className="auth-loading-spinner" style={{ width: 18, height: 18 }} />
          Cargando métricas...
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
            {cards.map(card => (
              <div key={card.label} className="stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {card.label}
                  </span>
                  <div style={{ color: card.color, opacity: 0.8 }}>{card.icon}</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-h)', lineHeight: 1 }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {kpis.vencenEsteMes > 0 && (
            <div style={{
              background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.24)',
              borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24
            }}>
              <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <strong style={{ fontSize: 13, color: '#92400e' }}>
                  {kpis.vencenEsteMes} membresía(s) vencen este mes
                </strong>
                <p style={{ fontSize: 12, color: '#78350f', margin: '2px 0 0' }}>
                  Revisa la sección de Membresías para gestionar las renovaciones.
                </p>
              </div>
            </div>
          )}

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 16, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)', marginBottom: 16 }}>Accesos Rápidos</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: '+ Nuevo Miembro', path: '/miembros' },
                { label: '+ Nueva Inscripción', path: '/inscripciones' },
                { label: '+ Registrar Pago', path: '/pagos' },
                { label: 'Ver Clases de Hoy', path: '/clases' },
              ].map(item => (
                <a
                  key={item.path}
                  href={item.path}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '9px 16px', borderRadius: 8,
                    background: 'var(--accent-bg)', color: 'var(--accent)',
                    border: '1px solid var(--accent-border)',
                    fontSize: 13, fontWeight: 600, textDecoration: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
