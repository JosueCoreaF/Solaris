import React, { useEffect, useState } from 'react';
import { Plus, X, Clock } from 'lucide-react';
import { fetchClases, crearClase, actualizarClase, fetchEntrenadores, crearEntrenador, type ClaseGym, type Entrenador } from '../../api/clasesService';
import { useToast } from '../../components/Toast';
import { useSync } from '../../context/SyncContext';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const DIA_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

export const Clases: React.FC = () => {
  const { addToast } = useToast();
  const { gimnasio } = useSync();
  const [clases, setClases] = useState<ClaseGym[]>([]);
  const [entrenadores, setEntrenadores] = useState<Entrenador[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalEnt, setModalEnt] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<Partial<ClaseGym>>({ dia_semana: 'lunes', hora_inicio: '07:00', hora_fin: '08:00', capacidad_maxima: 20, activa: true });
  const [formEnt, setFormEnt] = useState({ nombre_completo: '', especialidad: '', correo: '', telefono: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [cl, ent] = await Promise.all([fetchClases(), fetchEntrenadores()]);
      setClases(cl); setEntrenadores(ent);
    } catch { addToast('Error cargando datos', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const guardarClase = async () => {
    if (!form.nombre_clase || !gimnasio) { addToast('Nombre y gimnasio requeridos', 'warning'); return; }
    setGuardando(true);
    try {
      const nueva = await crearClase({ ...form, id_gimnasio: gimnasio.id_gimnasio });
      setClases(prev => [...prev, nueva]);
      addToast('Clase creada', 'success');
      setModal(false);
      setForm({ dia_semana: 'lunes', hora_inicio: '07:00', hora_fin: '08:00', capacidad_maxima: 20, activa: true });
    } catch (e: any) { addToast(e.message || 'Error', 'error'); } finally { setGuardando(false); }
  };

  const guardarEntrenador = async () => {
    if (!formEnt.nombre_completo || !gimnasio) { addToast('Nombre requerido', 'warning'); return; }
    setGuardando(true);
    try {
      const nuevo = await crearEntrenador({ ...formEnt, id_gimnasio: gimnasio.id_gimnasio, estado: 'activo' });
      setEntrenadores(prev => [...prev, nuevo]);
      addToast('Entrenador registrado', 'success');
      setModalEnt(false);
      setFormEnt({ nombre_completo: '', especialidad: '', correo: '', telefono: '' });
    } catch (e: any) { addToast(e.message || 'Error', 'error'); } finally { setGuardando(false); }
  };

  const toggleActiva = async (c: ClaseGym) => {
    try {
      const updated = await actualizarClase(c.id_clase, { activa: !c.activa });
      setClases(prev => prev.map(x => x.id_clase === c.id_clase ? { ...x, activa: updated.activa } : x));
    } catch { addToast('Error', 'error'); }
  };

  const diaHoy = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][new Date().getDay()];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Clases Grupales</h1>
          <p className="page-subtitle">Horario semanal de clases</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setModalEnt(true)}><Plus size={14} /> Entrenador</button>
          <button className="btn-primary" onClick={() => setModal(true)}><Plus size={16} /> Nueva Clase</button>
        </div>
      </div>

      {entrenadores.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {entrenadores.map(e => (
            <div key={e.id_entrenador} style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
              <strong style={{ color: 'var(--text-h)' }}>{e.nombre_completo}</strong>
              {e.especialidad && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>· {e.especialidad}</span>}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {DIAS.map(dia => {
            const clasesDelDia = clases.filter(c => c.dia_semana === dia);
            const esHoy = dia === diaHoy;
            return (
              <div key={dia} style={{
                background: 'var(--card-bg)', border: esHoy ? '2px solid var(--accent)' : '1px solid var(--shell-border)',
                borderRadius: 14, overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 14px', fontWeight: 700, fontSize: 13,
                  background: esHoy ? 'var(--accent-bg)' : 'var(--shell-bg)',
                  color: esHoy ? 'var(--accent)' : 'var(--text-h)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  {DIA_LABEL[dia]}
                  {esHoy && <span className="badge badge-green" style={{ fontSize: 10 }}>HOY</span>}
                </div>
                <div style={{ padding: 10 }}>
                  {clasesDelDia.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '12px 0' }}>Sin clases</p>
                  ) : clasesDelDia.map(c => (
                    <div key={c.id_clase} style={{
                      padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                      background: c.activa ? 'var(--accent-bg)' : 'var(--shell-bg)',
                      border: `1px solid ${c.activa ? 'var(--accent-border)' : 'var(--shell-border)'}`,
                      opacity: c.activa ? 1 : 0.6,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{c.nombre_clase}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        <Clock size={11} /> {c.hora_inicio} – {c.hora_fin}
                        {c.entrenadores && <span>· {(c.entrenadores as any).nombre_completo}</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cap: {c.capacidad_maxima}</span>
                        <button
                          onClick={() => toggleActiva(c)}
                          style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            background: c.activa ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)',
                            color: c.activa ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                          {c.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Nueva Clase</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre de la Clase *</label>
                <input className="form-input" placeholder="Ej: Yoga, Spinning, Zumba..." value={form.nombre_clase ?? ''} onChange={e => setForm(p => ({ ...p, nombre_clase: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Día</label>
                  <select className="form-select" value={form.dia_semana} onChange={e => setForm(p => ({ ...p, dia_semana: e.target.value as any }))}>
                    {DIAS.map(d => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Entrenador</label>
                  <select className="form-select" value={form.id_entrenador ?? ''} onChange={e => setForm(p => ({ ...p, id_entrenador: e.target.value || undefined }))}>
                    <option value="">Sin asignar</option>
                    {entrenadores.map(e => <option key={e.id_entrenador} value={e.id_entrenador}>{e.nombre_completo}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Hora Inicio</label>
                  <input className="form-input" type="time" value={form.hora_inicio ?? ''} onChange={e => setForm(p => ({ ...p, hora_inicio: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora Fin</label>
                  <input className="form-input" type="time" value={form.hora_fin ?? ''} onChange={e => setForm(p => ({ ...p, hora_fin: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Capacidad Máxima</label>
                  <input className="form-input" type="number" min={1} value={form.capacidad_maxima ?? 20} onChange={e => setForm(p => ({ ...p, capacidad_maxima: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripción</label>
                <textarea className="form-input" rows={2} value={form.descripcion ?? ''} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarClase} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear Clase'}</button>
            </div>
          </div>
        </div>
      )}

      {modalEnt && (
        <div className="modal-overlay" onClick={() => setModalEnt(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Nuevo Entrenador</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModalEnt(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre Completo *</label>
                <input className="form-input" value={formEnt.nombre_completo} onChange={e => setFormEnt(p => ({ ...p, nombre_completo: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Especialidad</label>
                <input className="form-input" placeholder="Ej: Yoga, Musculación, Crossfit..." value={formEnt.especialidad} onChange={e => setFormEnt(p => ({ ...p, especialidad: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Correo</label>
                  <input className="form-input" type="email" value={formEnt.correo} onChange={e => setFormEnt(p => ({ ...p, correo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={formEnt.telefono} onChange={e => setFormEnt(p => ({ ...p, telefono: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalEnt(false)}>Cancelar</button>
              <button className="btn-primary" onClick={guardarEntrenador} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
