import React, { useEffect, useState } from 'react';
import { Save, Check, RotateCcw, Settings2, UserPlus, Mail, Copy } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { useSync } from '../../context/SyncContext';
import { useToast } from '../../components/Toast';
import { useTheme } from '../../context/ThemeContext';
import { fetchConfiguracion, guardarConfiguracion, type ConfiguracionGym } from '../../api/configuracionService';
import { crearInvitacion, obtenerInvitaciones, type Invitacion } from '../../api/invitacionesService';
import { obtenerPersonal, cambiarEstadoUsuario, type UsuarioRol } from '../../api/usuariosRolesService';

const ROL_LABELS: Record<string, string> = {
  ENTRENADOR: 'Entrenador',
  RECEPCIONISTA: 'Recepcionista',
  ADMIN: 'Administrador',
  CONTADOR: 'Contador',
  VENDEDOR: 'Vendedor',
};

const ACCENT_PRESETS = [
  { label: 'Volt Lime', dark: '#c8ff3d', light: '#5f8a00' },
  { label: 'Coral', dark: '#ff5c35', light: '#d6451d' },
  { label: 'Cian', dark: '#3de1ff', light: '#0080a3' },
  { label: 'Violeta', dark: '#b18bff', light: '#6c3df0' },
  { label: 'Rosa', dark: '#ff5fa6', light: '#d62a73' },
  { label: 'Ámbar', dark: '#ffc23d', light: '#b3760a' },
];

export const Config: React.FC = () => {
  const { gimnasio, refresh } = useSync();
  const { addToast } = useToast();
  const { theme, accentColor, setAccentColor, resetAccentColor } = useTheme();
  const [form, setForm] = useState({ nombre_gimnasio: '', ciudad: '', direccion: '', telefono: '', correo_contacto: '' });
  const [guardando, setGuardando] = useState(false);

  const [operativa, setOperativa] = useState({
    moneda: 'HNL', porcentaje_impuesto: 0, hora_apertura: '05:00', hora_cierre: '22:00',
    dias_aviso_vencimiento: 7, permitir_congelar_membresia: true, nombre_negocio: '',
  });
  const [guardandoOperativa, setGuardandoOperativa] = useState(false);

  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [invEmail, setInvEmail] = useState('');
  const [invRol, setInvRol] = useState('ENTRENADOR');
  const [enviandoInv, setEnviandoInv] = useState(false);

  const [personal, setPersonal] = useState<UsuarioRol[]>([]);
  const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null);

  useEffect(() => {
    if (gimnasio) {
      setForm({
        nombre_gimnasio: gimnasio.nombre_gimnasio ?? '',
        ciudad: gimnasio.ciudad ?? '',
        direccion: gimnasio.direccion ?? '',
        telefono: gimnasio.telefono ?? '',
        correo_contacto: gimnasio.correo_contacto ?? '',
      });
    }
  }, [gimnasio]);

  useEffect(() => {
    if (gimnasio?.id_gimnasio) {
      obtenerInvitaciones(gimnasio.id_gimnasio).then(setInvitaciones);
      obtenerPersonal(gimnasio.id_gimnasio).then(setPersonal);
    } else {
      setInvitaciones([]);
      setPersonal([]);
    }
  }, [gimnasio?.id_gimnasio]);

  useEffect(() => {
    fetchConfiguracion().then(cfg => {
      if (cfg) {
        setOperativa({
          moneda: cfg.moneda ?? 'HNL',
          porcentaje_impuesto: Number(cfg.porcentaje_impuesto ?? 0),
          hora_apertura: (cfg.hora_apertura ?? '05:00').slice(0, 5),
          hora_cierre: (cfg.hora_cierre ?? '22:00').slice(0, 5),
          dias_aviso_vencimiento: cfg.dias_aviso_vencimiento ?? 7,
          permitir_congelar_membresia: cfg.permitir_congelar_membresia ?? true,
          nombre_negocio: cfg.nombre_negocio ?? '',
        });
      }
    }).catch(() => {});
  }, []);

  const guardar = async () => {
    if (!gimnasio) return;
    setGuardando(true);
    try {
      const { error } = await supabase
        .from('gimnasios')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id_gimnasio', gimnasio.id_gimnasio);
      if (error) throw error;
      addToast('Configuración guardada', 'success');
      refresh();
    } catch (e: any) { addToast(e.message || 'Error al guardar', 'error'); } finally { setGuardando(false); }
  };

  const enviarInvitacion = async () => {
    if (!invEmail.trim()) { addToast('Ingresa un correo', 'warning'); return; }
    if (!gimnasio?.id_gimnasio) { addToast('No hay gimnasio activo', 'error'); return; }
    setEnviandoInv(true);
    try {
      const inv = await crearInvitacion(invEmail.trim(), invRol, gimnasio.id_gimnasio);
      if (!inv) { addToast('No se pudo crear la invitación', 'error'); return; }
      setInvitaciones(prev => [inv, ...prev]);
      setInvEmail('');
      addToast(`Invitación enviada a ${inv.email}`, 'success');
    } catch (e: any) {
      addToast(e.message || 'Error al enviar invitación', 'error');
    } finally {
      setEnviandoInv(false);
    }
  };

  const copiarCodigo = (codigo: string) => {
    navigator.clipboard.writeText(codigo);
    addToast('Código copiado al portapapeles', 'success');
  };

  const toggleEstadoPersonal = async (persona: UsuarioRol) => {
    const nuevoEstado = persona.estado === 'activo' ? 'inactivo' : 'activo';
    setCambiandoEstado(persona.user_id);
    const { ok, error } = await cambiarEstadoUsuario(persona.user_id, nuevoEstado);
    setCambiandoEstado(null);
    if (!ok) { addToast(error || 'Error al cambiar el estado', 'error'); return; }
    setPersonal(prev => prev.map(p => p.user_id === persona.user_id ? { ...p, estado: nuevoEstado as UsuarioRol['estado'] } : p));
    addToast(`${persona.email} ahora está ${nuevoEstado}`, 'success');
  };

  const guardarOperativa = async () => {
    setGuardandoOperativa(true);
    try {
      await guardarConfiguracion(operativa as Partial<ConfiguracionGym>);
      addToast('Configuración operativa guardada', 'success');
    } catch (e: any) { addToast(e.message || 'Error al guardar', 'error'); } finally { setGuardandoOperativa(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Información del gimnasio</p>
        </div>
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {!gimnasio ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
          No hay un gimnasio configurado. Crea uno desde Supabase para comenzar.
        </div>
      ) : (
        <div style={{ maxWidth: 640, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderTop: '2px solid var(--accent)', borderRadius: 4, padding: 28 }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text-h)', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Datos del Gimnasio</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Nombre del Gimnasio</label>
              <input className="form-input" value={form.nombre_gimnasio} onChange={e => setForm(p => ({ ...p, nombre_gimnasio: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input className="form-input" value={form.ciudad} onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input className="form-input" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Dirección</label>
              <input className="form-input" value={form.direccion} onChange={e => setForm(p => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Correo de Contacto</label>
              <input className="form-input" type="email" value={form.correo_contacto} onChange={e => setForm(p => ({ ...p, correo_contacto: e.target.value }))} />
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--shell-border-subtle)' }}>
            <h4 style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Información del Módulo</h4>
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <div><span style={{ color: 'var(--muted)' }}>ID Módulo:</span> <code style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--surface-raised)', color: 'var(--text-h)', padding: '2px 6px', borderRadius: 3 }}>{gimnasio.id_module ?? '—'}</code></div>
              <div><span style={{ color: 'var(--muted)' }}>Estado:</span> <span className="badge badge-green" style={{ marginLeft: 6 }}>{gimnasio.estado}</span></div>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 640, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderTop: '2px solid var(--accent)', borderRadius: 4, padding: 28, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text-h)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Color de Énfasis</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Personaliza el color de acento usado en botones, iconos y resaltados.</p>
          </div>
          <button className="btn-secondary" onClick={resetAccentColor} style={{ fontSize: 11, padding: '8px 12px' }}>
            <RotateCcw size={13} /> Restablecer
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {ACCENT_PRESETS.map(preset => {
            const color = theme === 'dark' ? preset.dark : preset.light;
            const active = color.toLowerCase() === accentColor.toLowerCase();
            return (
              <button
                key={preset.label}
                onClick={() => setAccentColor(color)}
                title={preset.label}
                style={{
                  width: 38, height: 38, borderRadius: 6, background: color, border: active ? '2px solid var(--text-h)' : '1px solid var(--shell-border-strong)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: active ? '0 0 0 3px var(--accent-bg)' : 'none', transition: 'all 0.15s ease',
                }}
              >
                {active && <Check size={16} color={theme === 'dark' && color === preset.dark ? '#0a0c0f' : '#ffffff'} strokeWidth={3} />}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Color personalizado</label>
          <input
            type="color"
            value={accentColor}
            onChange={e => setAccentColor(e.target.value)}
            style={{ width: 44, height: 32, borderRadius: 4, border: '1px solid var(--shell-border-strong)', background: 'var(--surface-raised)', cursor: 'pointer', padding: 2 }}
          />
          <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase' }}>{accentColor}</code>
        </div>
      </div>

      <div style={{ maxWidth: 640, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderTop: '2px solid var(--accent)', borderRadius: 4, padding: 28, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text-h)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings2 size={18} /> Configuración Operativa
            </h3>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Moneda, horarios y reglas de membresía del gimnasio.</p>
          </div>
          <button className="btn-primary" onClick={guardarOperativa} disabled={guardandoOperativa}>
            <Save size={16} /> {guardandoOperativa ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Nombre del Negocio (recibos)</label>
            <input className="form-input" value={operativa.nombre_negocio} onChange={e => setOperativa(p => ({ ...p, nombre_negocio: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Moneda</label>
            <select className="form-select" value={operativa.moneda} onChange={e => setOperativa(p => ({ ...p, moneda: e.target.value }))}>
              <option value="HNL">Lempira (HNL)</option>
              <option value="USD">Dólar (USD)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Impuesto (%)</label>
            <input className="form-input" type="number" min={0} step="0.01" value={operativa.porcentaje_impuesto}
              onChange={e => setOperativa(p => ({ ...p, porcentaje_impuesto: Number(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora de Apertura</label>
            <input className="form-input" type="time" value={operativa.hora_apertura} onChange={e => setOperativa(p => ({ ...p, hora_apertura: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Hora de Cierre</label>
            <input className="form-input" type="time" value={operativa.hora_cierre} onChange={e => setOperativa(p => ({ ...p, hora_cierre: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Días de Aviso de Vencimiento</label>
            <input className="form-input" type="number" min={0} value={operativa.dias_aviso_vencimiento}
              onChange={e => setOperativa(p => ({ ...p, dias_aviso_vencimiento: Number(e.target.value) }))} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
            <input type="checkbox" id="permitir_congelar" checked={operativa.permitir_congelar_membresia}
              onChange={e => setOperativa(p => ({ ...p, permitir_congelar_membresia: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
            <label htmlFor="permitir_congelar" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>Permitir congelar membresías</label>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderTop: '2px solid var(--accent)', borderRadius: 4, padding: 28, marginTop: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text-h)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} /> Personal del Gimnasio
          </h3>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Colaboradores con acceso a este gimnasio.</p>
        </div>

        {personal.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Aún no hay colaboradores registrados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {personal.map(persona => (
              <div key={persona.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 12px', background: 'var(--surface-raised)', borderRadius: 4 }}>
                <div>
                  <span style={{ color: 'var(--text-h)' }}>{persona.email}</span>
                  <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
                    {ROL_LABELS[persona.rol] ?? persona.rol}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`badge ${persona.estado === 'activo' ? 'badge-green' : 'badge-gray'}`}>{persona.estado}</span>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    disabled={cambiandoEstado === persona.user_id}
                    onClick={() => toggleEstadoPersonal(persona)}
                  >
                    {cambiandoEstado === persona.user_id ? '...' : persona.estado === 'activo' ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 640, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderTop: '2px solid var(--accent)', borderRadius: 4, padding: 28, marginTop: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--display)', fontSize: 18, color: 'var(--text-h)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} /> Invitar Personal
          </h3>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>Genera un código de invitación para que un miembro de tu equipo cree su cuenta.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input className="form-input" type="email" placeholder="empleado@correo.com"
              value={invEmail} onChange={e => setInvEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-select" value={invRol} onChange={e => setInvRol(e.target.value)}>
              <option value="ENTRENADOR">Entrenador</option>
              <option value="RECEPCIONISTA">Recepcionista</option>
              <option value="ADMIN">Administrador</option>
              <option value="CONTADOR">Contador</option>
              <option value="VENDEDOR">Vendedor</option>
            </select>
          </div>
          <button className="btn-primary" onClick={enviarInvitacion} disabled={enviandoInv}>
            <Mail size={16} /> {enviandoInv ? 'Enviando...' : 'Invitar'}
          </button>
        </div>

        {invitaciones.length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid var(--shell-border-subtle)', paddingTop: 16 }}>
            <h4 style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Invitaciones Enviadas</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {invitaciones.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 13, padding: '8px 12px', background: 'var(--surface-raised)', borderRadius: 4 }}>
                  <div>
                    <span style={{ color: 'var(--text-h)' }}>{inv.email}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{inv.rol_sugerido}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {inv.usado ? (
                      <span className="badge badge-green">Usado</span>
                    ) : (
                      <>
                        <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', letterSpacing: '0.12em' }}>{inv.codigo_unico}</code>
                        <button onClick={() => copiarCodigo(inv.codigo_unico)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>
                          <Copy size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
