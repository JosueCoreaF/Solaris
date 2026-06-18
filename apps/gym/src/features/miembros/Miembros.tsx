import React, { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Users, UserCheck, UserX, UserMinus, Eye, Mail, Phone, MapPin, Cake, ShieldAlert, FileText, CalendarDays, Globe, CheckCircle2, ChevronDown } from 'lucide-react';
import { fetchMiembros, crearMiembro, actualizarMiembro, eliminarMiembro, type Miembro } from '../../api/miembrosService';
import { fetchPlanes, crearInscripcion, type PlanMembresia } from '../../api/membresiaService';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../components/Toast';

const EMPTY: Partial<Miembro> = {
  nombre_completo: '', correo: '', telefono: '', documento_identidad: '',
  genero: 'masculino', estado: 'activo', observaciones: '',
};

const estadoBadge: Record<string, string> = {
  activo: 'badge-green', inactivo: 'badge-gray', suspendido: 'badge-red',
};

const calcularEdad = (fechaNacimiento?: string): number | null => {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
};

const iniciales = (nombre: string): string =>
  nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

export const Miembros: React.FC = () => {
  const { addToast } = useToast();
  const { gimnasio } = useSync();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [planes, setPlanes] = useState<PlanMembresia[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState(false);
  const [perfil, setPerfil] = useState<Miembro | null>(null);
  const [editando, setEditando] = useState<Miembro | null>(null);
  const [form, setForm] = useState<Partial<Miembro>>(EMPTY);
  const [guardando, setGuardando] = useState(false);

  // Estado para activar solicitudes del portal
  const [modalActivar, setModalActivar] = useState(false);
  const [solicitudActiva, setSolicitudActiva] = useState<Miembro | null>(null);
  const [planActivar, setPlanActivar] = useState('');
  const [fechaActivar, setFechaActivar] = useState(new Date().toISOString().split('T')[0]);
  const [activando, setActivando] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [mb, pl] = await Promise.all([fetchMiembros(), fetchPlanes()]);
      setMiembros(mb);
      setPlanes(pl);
    } catch { addToast('Error cargando miembros', 'error'); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const abrir = (m?: Miembro) => {
    setEditando(m ?? null);
    setForm(m ? { ...m } : EMPTY);
    setModal(true);
  };

  const cerrar = () => { setModal(false); setEditando(null); setForm(EMPTY); };

  const guardar = async () => {
    if (!form.nombre_completo || !form.correo) { addToast('Nombre y correo son requeridos', 'warning'); return; }
    setGuardando(true);
    try {
      if (editando) {
        const updated = await actualizarMiembro(editando.id_miembro, form);
        setMiembros(prev => prev.map(m => m.id_miembro === updated.id_miembro ? updated : m));
        addToast('Miembro actualizado', 'success');
      } else {
        const nuevo = await crearMiembro(form);
        setMiembros(prev => [nuevo, ...prev]);
        addToast('Miembro registrado', 'success');
      }
      cerrar();
    } catch (e: any) { addToast(e.message || 'Error al guardar', 'error'); } finally { setGuardando(false); }
  };

  const eliminar = async (m: Miembro) => {
    if (!confirm(`¿Eliminar a ${m.nombre_completo}?`)) return;
    try {
      await eliminarMiembro(m.id_miembro);
      setMiembros(prev => prev.filter(x => x.id_miembro !== m.id_miembro));
      addToast('Miembro eliminado', 'success');
    } catch { addToast('Error al eliminar', 'error'); }
  };

  const filtrados = miembros.filter(m =>
    m.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.correo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (m.documento_identidad ?? '').includes(busqueda)
  );

  const solicitudesPortal = miembros.filter(
    m => m.estado === 'inactivo' && m.observaciones?.startsWith('Plan solicitado:')
  );

  const abrirActivar = (m: Miembro) => {
    setSolicitudActiva(m);
    // Pre-seleccionar el plan mencionado en observaciones si existe
    const match = m.observaciones?.match(/Plan solicitado: (.+?) \(/);
    const planMatch = planes.find(p => match && p.nombre === match[1]);
    setPlanActivar(planMatch?.id_plan ?? planes[0]?.id_plan ?? '');
    setFechaActivar(new Date().toISOString().split('T')[0]);
    setModalActivar(true);
  };

  const activarSolicitud = async () => {
    if (!solicitudActiva || !planActivar || !gimnasio) return;
    const plan = planes.find(p => p.id_plan === planActivar);
    if (!plan) return;
    setActivando(true);
    try {
      const fechaFin = new Date(new Date(fechaActivar).getTime() + plan.duracion_dias * 86400000)
        .toISOString().split('T')[0];
      await Promise.all([
        actualizarMiembro(solicitudActiva.id_miembro, { estado: 'activo', observaciones: solicitudActiva.observaciones }),
        crearInscripcion({
          id_miembro: solicitudActiva.id_miembro,
          id_plan: plan.id_plan,
          id_gimnasio: gimnasio.id_gimnasio,
          fecha_inicio: fechaActivar,
          fecha_fin: fechaFin,
          total: plan.precio,
          notas: `Inscripción generada desde solicitud del portal público`,
        }),
      ]);
      setMiembros(prev => prev.map(m =>
        m.id_miembro === solicitudActiva.id_miembro ? { ...m, estado: 'activo' } : m
      ));
      addToast(`${solicitudActiva.nombre_completo} activado e inscrito correctamente`, 'success');
      setModalActivar(false);
      setSolicitudActiva(null);
    } catch (e: any) {
      addToast(e.message || 'Error al activar', 'error');
    } finally {
      setActivando(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Miembros</h1>
          <p className="page-subtitle">{miembros.length} miembro(s) registrado(s)</p>
        </div>
        <button className="btn-primary" onClick={() => abrir()}>
          <Plus size={16} /> Nuevo Miembro
        </button>
      </div>

      {/* ── Solicitudes del Portal ─────────────────────────────────────── */}
      {solicitudesPortal.length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Globe size={15} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
              Solicitudes del Portal — {solicitudesPortal.length} pendiente{solicitudesPortal.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {solicitudesPortal.map(s => (
              <div key={s.id_miembro} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, padding: '10px 14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 13, marginBottom: 2 }}>{s.nombre_completo}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.correo}{s.telefono ? ` · ${s.telefono}` : ''}</div>
                  {s.observaciones && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3 }}>{s.observaciones}</div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  {new Date(s.created_at).toLocaleDateString('es-HN')}
                </div>
                <button
                  className="btn-primary"
                  style={{ fontSize: 12, padding: '5px 12px', whiteSpace: 'nowrap' }}
                  onClick={() => abrirActivar(s)}
                >
                  <CheckCircle2 size={13} /> Activar e Inscribir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Miembros', value: miembros.length, icon: <Users size={18} />, color: 'var(--accent)' },
          { label: 'Activos', value: miembros.filter(m => m.estado === 'activo').length, icon: <UserCheck size={18} />, color: 'var(--success)' },
          { label: 'Inactivos', value: miembros.filter(m => m.estado === 'inactivo').length, icon: <UserMinus size={18} />, color: 'var(--muted)' },
          { label: 'Suspendidos', value: miembros.filter(m => m.estado === 'suspendido').length, icon: <UserX size={18} />, color: 'var(--danger)' },
        ].map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.14em' }}>{c.label}</span>
              <div style={{ width: 32, height: 32, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, background: 'rgba(255,255,255,0.04)' }}>
                {c.icon}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 30, color: 'var(--text-h)', lineHeight: 1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input className="form-input" style={{ paddingLeft: 32 }} placeholder="Buscar por nombre, correo o documento..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Cargando...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
            {busqueda ? 'No hay resultados para tu búsqueda' : 'No hay miembros registrados'}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Documento</th>
                <th>Estado</th>
                <th>Registro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(m => (
                <tr key={m.id_miembro}>
                  <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>{m.nombre_completo}</td>
                  <td>{m.correo}</td>
                  <td>{m.telefono || '—'}</td>
                  <td>{m.documento_identidad || '—'}</td>
                  <td><span className={`badge ${estadoBadge[m.estado] ?? 'badge-gray'}`}>{m.estado}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(m.created_at).toLocaleDateString('es-HN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 3 }}
                        title="Ver Perfil" onClick={() => setPerfil(m)}>
                        <Eye size={14} />
                      </button>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 3 }}
                        title="Editar" onClick={() => abrir(m)}>
                        <Edit2 size={14} />
                      </button>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 4, borderRadius: 3 }}
                        title="Eliminar" onClick={() => eliminar(m)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {perfil && (
        <div className="modal-overlay" onClick={() => setPerfil(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Perfil del Miembro</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setPerfil(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', color: 'var(--accent)',
                  fontFamily: 'var(--display)', fontSize: 20, flexShrink: 0,
                }}>
                  {iniciales(perfil.nombre_completo)}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--text-h)', textTransform: 'uppercase' }}>{perfil.nombre_completo}</div>
                  <span className={`badge ${estadoBadge[perfil.estado] ?? 'badge-gray'}`}>{perfil.estado}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                  <Mail size={14} style={{ color: 'var(--muted)' }} /> {perfil.correo}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                  <Phone size={14} style={{ color: 'var(--muted)' }} /> {perfil.telefono || '—'}
                </div>
                {perfil.fecha_nacimiento && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)' }}>
                    <Cake size={14} style={{ color: 'var(--muted)' }} />
                    {new Date(perfil.fecha_nacimiento).toLocaleDateString('es-HN')} ({calcularEdad(perfil.fecha_nacimiento)} años)
                  </div>
                )}
                {perfil.genero && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', textTransform: 'capitalize' }}>
                    <Users size={14} style={{ color: 'var(--muted)' }} /> {perfil.genero}
                  </div>
                )}
                {perfil.direccion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', gridColumn: '1/-1' }}>
                    <MapPin size={14} style={{ color: 'var(--muted)' }} /> {perfil.direccion}
                  </div>
                )}
                {(perfil.contacto_emergencia || perfil.telefono_emergencia) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', gridColumn: '1/-1' }}>
                    <ShieldAlert size={14} style={{ color: 'var(--warning)' }} />
                    Emergencia: {perfil.contacto_emergencia || '—'} {perfil.telefono_emergencia ? `· ${perfil.telefono_emergencia}` : ''}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12, gridColumn: '1/-1' }}>
                  <CalendarDays size={14} /> Registrado el {new Date(perfil.created_at).toLocaleDateString('es-HN')}
                </div>
                {perfil.observaciones && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--text)', gridColumn: '1/-1', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--shell-border-subtle)' }}>
                    <FileText size={14} style={{ color: 'var(--muted)', marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 12 }}>{perfil.observaciones}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPerfil(null)}>Cerrar</button>
              <button className="btn-primary" onClick={() => { abrir(perfil); setPerfil(null); }}>Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Activar e Inscribir ─────────────────────────────────── */}
      {modalActivar && solicitudActiva && (
        <div className="modal-overlay" onClick={() => setModalActivar(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>Activar e Inscribir</h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModalActivar(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', borderRadius: 4, padding: '10px 12px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 14 }}>{solicitudActiva.nombre_completo}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{solicitudActiva.correo}</div>
                {solicitudActiva.observaciones && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>{solicitudActiva.observaciones}</div>
                )}
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Plan de membresía *</label>
                  <div style={{ position: 'relative' }}>
                    <select className="form-select" value={planActivar} onChange={e => setPlanActivar(e.target.value)}>
                      <option value="">— Seleccionar plan —</option>
                      {planes.map(p => (
                        <option key={p.id_plan} value={p.id_plan}>
                          {p.nombre} · {p.duracion_dias} días · L {p.precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--muted)' }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de inicio *</label>
                  <input className="form-input" type="date" value={fechaActivar} onChange={e => setFechaActivar(e.target.value)} />
                </div>
                {planActivar && (() => {
                  const p = planes.find(pl => pl.id_plan === planActivar);
                  if (!p) return null;
                  const fin = new Date(new Date(fechaActivar).getTime() + p.duracion_dias * 86400000).toLocaleDateString('es-HN');
                  return (
                    <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--shell-bg)', borderRadius: 4, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Vence: <strong style={{ color: 'var(--text-h)' }}>{fin}</strong></span>
                      <span>Total: <strong style={{ color: 'var(--accent)' }}>L {p.precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModalActivar(false)}>Cancelar</button>
              <button className="btn-primary" onClick={activarSolicitud} disabled={activando || !planActivar}>
                {activando ? 'Procesando...' : 'Activar e Inscribir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={cerrar}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-h)', margin: 0 }}>
                {editando ? 'Editar Miembro' : 'Nuevo Miembro'}
              </h3>
              <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={cerrar}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Nombre Completo *</label>
                  <input className="form-input" value={form.nombre_completo ?? ''} onChange={e => setForm(p => ({ ...p, nombre_completo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo *</label>
                  <input className="form-input" type="email" value={form.correo ?? ''} onChange={e => setForm(p => ({ ...p, correo: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input className="form-input" value={form.telefono ?? ''} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Documento de Identidad</label>
                  <input className="form-input" value={form.documento_identidad ?? ''} onChange={e => setForm(p => ({ ...p, documento_identidad: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Género</label>
                  <select className="form-select" value={form.genero ?? 'masculino'} onChange={e => setForm(p => ({ ...p, genero: e.target.value as any }))}>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Nacimiento</label>
                  <input className="form-input" type="date" value={form.fecha_nacimiento ?? ''} onChange={e => setForm(p => ({ ...p, fecha_nacimiento: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-select" value={form.estado ?? 'activo'} onChange={e => setForm(p => ({ ...p, estado: e.target.value as any }))}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="suspendido">Suspendido</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Contacto de Emergencia</label>
                  <input className="form-input" value={form.contacto_emergencia ?? ''} onChange={e => setForm(p => ({ ...p, contacto_emergencia: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Dirección</label>
                  <input className="form-input" value={form.direccion ?? ''} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} />
                </div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Observaciones</label>
                  <textarea className="form-input" rows={2} value={form.observaciones ?? ''} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={cerrar}>Cancelar</button>
              <button className="btn-primary" onClick={guardar} disabled={guardando}>
                {guardando ? 'Guardando...' : editando ? 'Guardar Cambios' : 'Registrar Miembro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
