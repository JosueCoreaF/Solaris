import React, { useEffect, useState } from 'react';
import { Plus, X, Clock, Mail, Phone, FileText, ClipboardCheck, Search, Check } from 'lucide-react';
import { fetchClases, crearClase, actualizarClase, fetchEntrenadores, crearEntrenador, type ClaseGym, type Entrenador } from '../../api/clasesService';
import { fetchMiembros, type Miembro } from '../../api/miembrosService';
import { fetchAsistenciaPorFecha, marcarAsistencia, quitarAsistencia, type AsistenciaClase } from '../../api/asistenciaService';
import { useToast } from '../../components/Toast';
import { useSync } from '../../context/SyncContext';

const HOY = new Date().toISOString().split('T')[0];

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const DIA_LABEL: Record<string, string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

export const Clases: React.FC = () => {
  const { addToast } = useToast();
  const { gimnasio } = useSync();
  const [clases, setClases] = useState<ClaseGym[]>([]);
  const [entrenadores, setEntrenadores] = useState<Entrenador[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [asistenciaHoy, setAsistenciaHoy] = useState<AsistenciaClase[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [modalEnt, setModalEnt] = useState(false);
  const [modalCheckin, setModalCheckin] = useState<ClaseGym | null>(null);
  const [busquedaCheckin, setBusquedaCheckin] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState<Partial<ClaseGym>>({ dia_semana: 'lunes', hora_inicio: '07:00', hora_fin: '08:00', capacidad_maxima: 20, activa: true });
  const [formEnt, setFormEnt] = useState({ nombre_completo: '', especialidad: '', correo: '', telefono: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [cl, ent, mb, asis] = await Promise.all([fetchClases(), fetchEntrenadores(), fetchMiembros(), fetchAsistenciaPorFecha(HOY)]);
      setClases(cl); setEntrenadores(ent); setMiembros(mb.filter(m => m.estado === 'activo')); setAsistenciaHoy(asis);
    } catch { addToast('Error cargando datos', 'error'); } finally { setLoading(false); }
  };

  const ocupados = (id_clase: string) => asistenciaHoy.filter(a => a.id_clase === id_clase && a.estado === 'asistio').length;

  const toggleAsistencia = async (id_clase: string, id_miembro: string) => {
    const existente = asistenciaHoy.find(a => a.id_clase === id_clase && a.id_miembro === id_miembro);
    try {
      if (existente && existente.estado === 'asistio') {
        await quitarAsistencia(existente.id_asistencia);
        setAsistenciaHoy(prev => prev.filter(a => a.id_asistencia !== existente.id_asistencia));
      } else {
        const nueva = await marcarAsistencia(id_clase, id_miembro, HOY, 'asistio');
        setAsistenciaHoy(prev => [...prev.filter(a => a.id_asistencia !== nueva.id_asistencia), nueva]);
      }
    } catch { addToast('Error al registrar asistencia', 'error'); }
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
            <div key={e.id_entrenador} style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, padding: '6px 12px', fontSize: 12 }}>
              <strong style={{ color: 'var(--text-h)' }}>{e.nombre_completo}</strong>
              {e.especialidad && <span style={{ color: 'var(--muted)', marginLeft: 6 }}>· {e.especialidad}</span>}
              {e.correo && (
                <span style={{ color: 'var(--muted)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Mail size={10} /> {e.correo}
                </span>
              )}
              {e.telefono && (
                <span style={{ color: 'var(--muted)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Phone size={10} /> {e.telefono}
                </span>
              )}
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
                background: 'var(--card-bg)', border: esHoy ? '1px solid var(--accent)' : '1px solid var(--shell-border)',
                borderTop: esHoy ? '2px solid var(--accent)' : '1px solid var(--shell-border)',
                borderRadius: 4, overflow: 'hidden'
              }}>
                <div style={{
                  padding: '10px 14px', fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em',
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
                      padding: '8px 10px', borderRadius: 4, marginBottom: 6,
                      background: c.activa ? 'var(--accent-bg)' : 'var(--shell-bg)',
                      border: `1px solid ${c.activa ? 'var(--accent-border)' : 'var(--shell-border)'}`,
                      opacity: c.activa ? 1 : 0.6,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-h)' }}>{c.nombre_clase}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        <Clock size={11} /> {c.hora_inicio} – {c.hora_fin}
                        {c.entrenadores && <span>· {(c.entrenadores as any).nombre_completo}</span>}
                      </div>
                      {c.descripcion && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                          <FileText size={11} style={{ marginTop: 1, flexShrink: 0 }} />
                          <span>{c.descripcion}</span>
                        </div>
                      )}
                      {c.activa && (() => {
                        const cupos = ocupados(c.id_clase);
                        const pct = Math.min(100, Math.round((cupos / c.capacidad_maxima) * 100));
                        return (
                          <div style={{ marginTop: 6 }}>
                            <div className="progress-track">
                              <div className={`progress-fill ${pct >= 90 ? 'is-full' : ''}`} style={{ width: `${pct}%` }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 3 }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {cupos}/{c.capacidad_maxima} Cupos hoy
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cap: {c.capacidad_maxima}</span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {c.activa && (
                            <button
                              onClick={() => { setModalCheckin(c); setBusquedaCheckin(''); }}
                              title="Check-in de hoy"
                              style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '3px 8px', borderRadius: 3, border: 'none', cursor: 'pointer',
                                textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4,
                                background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 700 }}>
                              <ClipboardCheck size={11} /> Check-in
                            </button>
                          )}
                          <button
                            onClick={() => toggleActiva(c)}
                            style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '3px 8px', borderRadius: 3, border: 'none', cursor: 'pointer',
                              textTransform: 'uppercase', letterSpacing: '0.06em',
                              background: c.activa ? 'rgba(251,82,82,0.1)' : 'rgba(74,222,128,0.1)',
                              color: c.activa ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                            {c.activa ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
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

      {modalCheckin && (
        <div className="modal-overlay" onClick={() => setModalCheckin(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>
                Check-in · {modalCheckin.nombre_clase}
              </h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModalCheckin(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar miembro..."
                    value={busquedaCheckin} onChange={e => setBusquedaCheckin(e.target.value)} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {ocupados(modalCheckin.id_clase)}/{modalCheckin.capacidad_maxima} Cupos
                </span>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {miembros
                  .filter(m => m.nombre_completo.toLowerCase().includes(busquedaCheckin.toLowerCase()))
                  .map(m => {
                    const presente = asistenciaHoy.some(a => a.id_clase === modalCheckin.id_clase && a.id_miembro === m.id_miembro && a.estado === 'asistio');
                    return (
                      <button
                        key={m.id_miembro}
                        onClick={() => toggleAsistencia(modalCheckin.id_clase, m.id_miembro)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                          padding: '8px 12px', borderRadius: 4, border: `1px solid ${presente ? 'var(--accent-border)' : 'var(--shell-border)'}`,
                          background: presente ? 'var(--accent-bg)' : 'transparent', cursor: 'pointer', textAlign: 'left',
                          color: 'var(--text-h)', fontSize: 13, fontWeight: 600,
                        }}>
                        {m.nombre_completo}
                        <span style={{
                          width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${presente ? 'var(--accent)' : 'var(--shell-border-strong)'}`,
                          background: presente ? 'var(--accent)' : 'transparent', flexShrink: 0,
                        }}>
                          {presente && <Check size={12} color="var(--accent-strong)" strokeWidth={3} />}
                        </span>
                      </button>
                    );
                  })}
                {miembros.length === 0 && (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No hay miembros activos</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalCheckin(null)}>Cerrar</button>
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
