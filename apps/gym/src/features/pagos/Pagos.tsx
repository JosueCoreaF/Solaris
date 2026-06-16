import React, { useEffect, useState } from 'react';
import { Plus, X, DollarSign, StickyNote, Hash } from 'lucide-react';
import { fetchPagos, registrarPago, anularPago, type PagoGym } from '../../api/pagosService';
import { fetchInscripciones, type InscripcionGym } from '../../api/membresiaService';
import { fetchDashboardTrends, type TrendPoint } from '../../api/dashboardService';
import { useToast } from '../../components/Toast';
import { WeeklyRevenueChart } from '../../components/dashboard/TrendsCharts';

const fmt = (n: number) => `L. ${Number(n).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
const estadoBadge: Record<string, string> = { registrado: 'badge-blue', aplicado: 'badge-green', anulado: 'badge-red' };

export const Pagos: React.FC = () => {
  const { addToast } = useToast();
  const [pagos, setPagos] = useState<PagoGym[]>([]);
  const [inscripciones, setInscripciones] = useState<InscripcionGym[]>([]);
  const [weeklyRevenue, setWeeklyRevenue] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    id_inscripcion: '', monto: '', metodo_pago: 'efectivo' as PagoGym['metodo_pago'],
    referencia: '', notas: '', fecha_pago: new Date().toISOString().split('T')[0],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [pg, insc] = await Promise.all([fetchPagos(), fetchInscripciones()]);
      setPagos(pg);
      setInscripciones(insc.filter(i => i.estado === 'activa' && i.estado_pago !== 'pagado'));
    } catch { addToast('Error cargando datos', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); fetchDashboardTrends().then(t => setWeeklyRevenue(t.weeklyRevenue)); }, []);

  const inscSeleccionada = inscripciones.find(i => i.id_inscripcion === form.id_inscripcion);

  const guardar = async () => {
    if (!form.id_inscripcion || !form.monto) { addToast('Inscripción y monto requeridos', 'warning'); return; }
    setGuardando(true);
    try {
      const nuevo = await registrarPago({
        id_inscripcion: form.id_inscripcion,
        monto: Number(form.monto),
        metodo_pago: form.metodo_pago,
        referencia: form.referencia || undefined,
        notas: form.notas || undefined,
        fecha_pago: new Date(form.fecha_pago).toISOString(),
      });
      setPagos(prev => [nuevo, ...prev]);
      addToast('Pago registrado', 'success');
      setModal(false);
      setForm({ id_inscripcion: '', monto: '', metodo_pago: 'efectivo', referencia: '', notas: '', fecha_pago: new Date().toISOString().split('T')[0] });
      load();
    } catch (e: any) { addToast(e.message || 'Error', 'error'); } finally { setGuardando(false); }
  };

  const anular = async (id: string) => {
    if (!confirm('¿Anular este pago?')) return;
    try {
      await anularPago(id);
      setPagos(prev => prev.map(p => p.id_pago_gym === id ? { ...p, estado: 'anulado' } : p));
      addToast('Pago anulado', 'success');
    } catch { addToast('Error al anular', 'error'); }
  };

  const totalMes = pagos.filter(p => {
    const f = new Date(p.fecha_pago);
    const now = new Date();
    return p.estado !== 'anulado' && f.getMonth() === now.getMonth() && f.getFullYear() === now.getFullYear();
  }).reduce((s, p) => s + Number(p.monto), 0);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Pagos</h1>
          <p className="page-subtitle">Registro de cobros del gimnasio</p>
        </div>
        <button className="btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Registrar Pago</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Ingresos del Mes', value: fmt(totalMes), color: 'var(--success)' },
          { label: 'Total Pagos', value: pagos.filter(p => p.estado !== 'anulado').length, color: '#60a5fa' },
          { label: 'Pagos Anulados', value: pagos.filter(p => p.estado === 'anulado').length, color: 'var(--danger)' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 12 }}>{c.label}</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 28, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="stat-card chart-card" style={{ marginBottom: 24 }}>
        <div className="chart-header">
          <div>
            <div className="chart-title">Ingresos Semanales</div>
            <div className="chart-sub">// Últimos 7 días</div>
          </div>
        </div>
        <div className="chart-body">
          <WeeklyRevenueChart data={weeklyRevenue} />
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>
        ) : pagos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No hay pagos registrados</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Miembro</th>
                <th>Plan</th>
                <th>Monto</th>
                <th>Método</th>
                <th>Referencia</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => {
                const insc = p.inscripciones_gym as any;
                return (
                  <tr key={p.id_pago_gym}>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {insc?.miembros?.nombre_completo ?? '—'}
                        {p.notas && <StickyNote size={12} style={{ color: 'var(--muted)' }} title={p.notas} />}
                      </div>
                    </td>
                    <td>{insc?.planes_membresia?.nombre ?? '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>
                      {fmt(p.monto)}
                      {p.moneda && p.moneda !== 'HNL' && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>{p.moneda}</span>}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{p.metodo_pago}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {p.referencia
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Hash size={11} />{p.referencia}</span>
                        : '—'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(p.fecha_pago).toLocaleDateString('es-HN')}</td>
                    <td><span className={`badge ${estadoBadge[p.estado] ?? 'badge-gray'}`}>{p.estado}</span></td>
                    <td>
                      {p.estado !== 'anulado' && (
                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 11, padding: '3px 8px', borderRadius: 3, fontFamily: 'var(--mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                          onClick={() => anular(p.id_pago_gym)}>Anular</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Registrar Pago</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Inscripción / Membresía *</label>
                <select className="form-select" value={form.id_inscripcion} onChange={e => {
                  const insc = inscripciones.find(i => i.id_inscripcion === e.target.value);
                  setForm(p => ({ ...p, id_inscripcion: e.target.value, monto: insc ? String(insc.total) : '' }));
                }}>
                  <option value="">Seleccionar inscripción con deuda...</option>
                  {inscripciones.map(i => (
                    <option key={i.id_inscripcion} value={i.id_inscripcion}>
                      {(i.miembros as any)?.nombre_completo ?? '?'} — {(i.planes_membresia as any)?.nombre ?? '?'} (L. {Number(i.total).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Monto (L.) *</label>
                  <input className="form-input" type="number" min={0} step="0.01" value={form.monto} onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Método de Pago</label>
                  <select className="form-select" value={form.metodo_pago} onChange={e => setForm(p => ({ ...p, metodo_pago: e.target.value as any }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Pago</label>
                  <input className="form-input" type="date" value={form.fecha_pago} onChange={e => setForm(p => ({ ...p, fecha_pago: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Referencia</label>
                  <input className="form-input" placeholder="N° cheque, transfer..." value={form.referencia} onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows={2} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar Pago'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
