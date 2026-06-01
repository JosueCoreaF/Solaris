import React, { useEffect, useState } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import { fetchInscripciones, crearInscripcion, actualizarInscripcion, fetchPlanes, type InscripcionGym, type PlanMembresia } from '../../api/membresiaService';
import { fetchMiembros, type Miembro } from '../../api/miembrosService';
import { useToast } from '../../components/Toast';
import { useSync } from '../../context/SyncContext';

const estadoBadge: Record<string, string> = {
  activa: 'badge-green', vencida: 'badge-red', cancelada: 'badge-gray', congelada: 'badge-yellow',
};
const pagoBadge: Record<string, string> = {
  pagado: 'badge-green', deuda: 'badge-red', cortesia: 'badge-blue',
};

export const Inscripciones: React.FC = () => {
  const { addToast } = useToast();
  const { gimnasio } = useSync();
  const [inscripciones, setInscripciones] = useState<InscripcionGym[]>([]);
  const [planes, setPlanes] = useState<PlanMembresia[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalPlan, setModalPlan] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ id_miembro: '', id_plan: '', fecha_inicio: new Date().toISOString().split('T')[0], notas: '' });
  const [formPlan, setFormPlan] = useState({ nombre: '', descripcion: '', duracion_dias: 30, precio: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [insc, pl, mb] = await Promise.all([fetchInscripciones(), fetchPlanes(), fetchMiembros()]);
      setInscripciones(insc); setPlanes(pl); setMiembros(mb);
    } catch { addToast('Error cargando datos', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const planSeleccionado = planes.find(p => p.id_plan === form.id_plan);
  const fechaFin = planSeleccionado
    ? new Date(new Date(form.fecha_inicio).getTime() + planSeleccionado.duracion_dias * 86400000).toISOString().split('T')[0]
    : '';

  const guardarInscripcion = async () => {
    if (!form.id_miembro || !form.id_plan || !form.fecha_inicio) { addToast('Completa los campos requeridos', 'warning'); return; }
    if (!gimnasio) { addToast('No hay gimnasio activo', 'error'); return; }
    setGuardando(true);
    try {
      const nueva = await crearInscripcion({
        id_miembro: form.id_miembro,
        id_plan: form.id_plan,
        id_gimnasio: gimnasio.id_gimnasio,
        fecha_inicio: form.fecha_inicio,
        fecha_fin: fechaFin,
        total: planSeleccionado?.precio ?? 0,
        notas: form.notas,
      });
      setInscripciones(prev => [nueva, ...prev]);
      addToast('Inscripción creada', 'success');
      setModal(false);
      setForm({ id_miembro: '', id_plan: '', fecha_inicio: new Date().toISOString().split('T')[0], notas: '' });
    } catch (e: any) { addToast(e.message || 'Error', 'error'); } finally { setGuardando(false); }
  };

  const cambiarEstado = async (id: string, estado: InscripcionGym['estado']) => {
    try {
      const updated = await actualizarInscripcion(id, { estado });
      setInscripciones(prev => prev.map(i => i.id_inscripcion === id ? { ...i, estado } : i));
      addToast('Estado actualizado', 'success');
    } catch { addToast('Error al actualizar', 'error'); }
  };

  const guardarPlan = async () => {
    if (!formPlan.nombre || !gimnasio) { addToast('Nombre requerido', 'warning'); return; }
    setGuardando(true);
    try {
      const { crearPlan } = await import('../../api/membresiaService');
      const nuevo = await crearPlan({ ...formPlan, id_gimnasio: gimnasio.id_gimnasio });
      setPlanes(prev => [...prev, nuevo]);
      addToast('Plan creado', 'success');
      setModalPlan(false);
      setFormPlan({ nombre: '', descripcion: '', duracion_dias: 30, precio: 0 });
    } catch (e: any) { addToast(e.message || 'Error', 'error'); } finally { setGuardando(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Membresías e Inscripciones</h1>
          <p className="page-subtitle">{inscripciones.length} inscripción(es) registrada(s)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setModalPlan(true)}><Plus size={14} /> Plan</button>
          <button className="btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Nueva Inscripción</button>
        </div>
      </div>

      {/* Planes activos */}
      {planes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 12 }}>Planes Activos</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {planes.map(p => (
              <div key={p.id_plan} style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 12, padding: '14px 18px', minWidth: 160 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', marginBottom: 4 }}>{p.nombre}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>L. {p.precio.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.duracion_dias} días</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>
        ) : inscripciones.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No hay inscripciones registradas</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Miembro</th>
                <th>Plan</th>
                <th>Inicio</th>
                <th>Vencimiento</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Pago</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {inscripciones.map(i => (
                <tr key={i.id_inscripcion}>
                  <td style={{ fontWeight: 600 }}>{(i.miembros as any)?.nombre_completo ?? '—'}</td>
                  <td>{(i.planes_membresia as any)?.nombre ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(i.fecha_inicio).toLocaleDateString('es-HN')}</td>
                  <td style={{ fontSize: 12, color: i.estado === 'vencida' ? '#dc2626' : 'var(--muted)' }}>
                    {new Date(i.fecha_fin).toLocaleDateString('es-HN')}
                  </td>
                  <td style={{ fontWeight: 600 }}>L. {Number(i.total).toFixed(2)}</td>
                  <td><span className={`badge ${estadoBadge[i.estado] ?? 'badge-gray'}`}>{i.estado}</span></td>
                  <td><span className={`badge ${pagoBadge[i.estado_pago] ?? 'badge-gray'}`}>{i.estado_pago}</span></td>
                  <td>
                    <select
                      style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--shell-border-strong)', background: 'transparent', cursor: 'pointer' }}
                      value={i.estado}
                      onChange={e => cambiarEstado(i.id_inscripcion, e.target.value as any)}
                    >
                      <option value="activa">Activa</option>
                      <option value="congelada">Congelada</option>
                      <option value="cancelada">Cancelada</option>
                      <option value="vencida">Vencida</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nueva inscripción */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Nueva Inscripción</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Miembro *</label>
                <select className="form-select" value={form.id_miembro} onChange={e => setForm(p => ({ ...p, id_miembro: e.target.value }))}>
                  <option value="">Seleccionar miembro...</option>
                  {miembros.filter(m => m.estado === 'activo').map(m => (
                    <option key={m.id_miembro} value={m.id_miembro}>{m.nombre_completo}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Plan de Membresía *</label>
                <select className="form-select" value={form.id_plan} onChange={e => setForm(p => ({ ...p, id_plan: e.target.value }))}>
                  <option value="">Seleccionar plan...</option>
                  {planes.map(p => (
                    <option key={p.id_plan} value={p.id_plan}>{p.nombre} — L. {p.precio.toFixed(2)} ({p.duracion_dias} días)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de Inicio *</label>
                <input className="form-input" type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} />
              </div>
              {planSeleccionado && (
                <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                    Vencimiento: {fechaFin} · Total: L. {planSeleccionado.precio.toFixed(2)}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notas</label>
                <textarea className="form-input" rows={2} value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarInscripcion} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear Inscripción'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo plan */}
      {modalPlan && (
        <div className="modal-overlay" onClick={() => setModalPlan(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Nuevo Plan de Membresía</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModalPlan(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre del Plan *</label>
                <input className="form-input" placeholder="Ej: Mensual, Trimestral, Estudiante..." value={formPlan.nombre} onChange={e => setFormPlan(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input className="form-input" value={formPlan.descripcion} onChange={e => setFormPlan(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Duración (días)</label>
                  <input className="form-input" type="number" min={1} value={formPlan.duracion_dias} onChange={e => setFormPlan(p => ({ ...p, duracion_dias: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio (L.)</label>
                  <input className="form-input" type="number" min={0} step="0.01" value={formPlan.precio} onChange={e => setFormPlan(p => ({ ...p, precio: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalPlan(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarPlan} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear Plan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
