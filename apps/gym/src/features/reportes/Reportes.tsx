import React, { useEffect, useState } from 'react';
import { TrendingUp, Users, CreditCard, AlertTriangle } from 'lucide-react';
import { fetchDashboardKPIs } from '../../api/dashboardService';
import { fetchInscripciones } from '../../api/membresiaService';
import { fetchPagos } from '../../api/pagosService';
import { fetchMiembros } from '../../api/miembrosService';

const fmt = (n: number) => `L. ${Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;

export const Reportes: React.FC = () => {
  const [kpis, setKpis] = useState<any>({});
  const [vencidas, setVencidas] = useState<any[]>([]);
  const [deudas, setDeudas] = useState<any[]>([]);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchDashboardKPIs(), fetchInscripciones(), fetchPagos(), fetchMiembros()])
      .then(([k, insc, pagos, mb]) => {
        setKpis(k);
        setVencidas(insc.filter(i => i.estado === 'vencida' || (i.estado === 'activa' && new Date(i.fecha_fin) < new Date())));
        setDeudas(insc.filter(i => i.estado_pago === 'deuda' && i.estado === 'activa'));
        setMiembros(mb);
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
          { label: 'Miembros Activos', value: kpis.miembrosActivos ?? 0, icon: <Users size={20} />, color: '#16a34a' },
          { label: 'Membresías Activas', value: kpis.inscripcionesActivas ?? 0, icon: <CreditCard size={20} />, color: '#2563eb' },
          { label: 'Vencen Este Mes', value: kpis.vencenEsteMes ?? 0, icon: <AlertTriangle size={20} />, color: '#d97706' },
          { label: 'Ingresos del Mes', value: fmt(kpis.ingresosMes ?? 0), icon: <TrendingUp size={20} />, color: '#16a34a' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.label}</span>
              <span style={{ color: c.color }}>{c.icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Membresías con deuda */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} style={{ color: '#d97706' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Membresías con Deuda ({deudas.length})</h3>
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
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>{fmt(i.total)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Membresías vencidas */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={16} style={{ color: '#dc2626' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Membresías Vencidas ({vencidas.length})</h3>
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
                <div style={{ fontSize: 12, color: '#dc2626' }}>Venció: {new Date(i.fecha_fin).toLocaleDateString('es-HN')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de miembros */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 16, overflow: 'hidden', gridColumn: '1/-1' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--shell-border-subtle)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Estado de Miembros ({miembros.length})</h3>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {(['activo', 'inactivo', 'suspendido'] as const).map(est => {
              const count = miembros.filter(m => m.estado === est).length;
              const pct = miembros.length ? Math.round((count / miembros.length) * 100) : 0;
              const colors: Record<string, string> = { activo: '#16a34a', inactivo: '#64748b', suspendido: '#dc2626' };
              return (
                <div key={est} style={{ flex: 1, padding: '20px', textAlign: 'center', borderRight: '1px solid var(--shell-border-subtle)' }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: colors[est] }}>{count}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'capitalize', marginTop: 4 }}>{est}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
