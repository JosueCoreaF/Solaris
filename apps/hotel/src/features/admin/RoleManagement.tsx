import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, RefreshCw, Trash2, Check, X, UserPlus, Users, Mail, Search, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { obtenerTodosLosUsuarios, asignarRol, cambiarEstadoUsuario, UsuarioRol } from '../../api/usuariosRolesService';
import { crearInvitacion, obtenerInvitacionesActivas, resendInvitacion, eliminarInvitacion, Invitacion } from '../../api/invitacionesService';
import { crearUsuarioManual, eliminarUsuario, buscarUsuarioPorEmail, eliminarUsuarioPorEmail, BusquedaUsuario } from '../../api/usuariosService';
import apiClient from '../../services/api';

interface HotelItem { id_hotel: string; nombre_hotel: string; ciudad?: string; }

const ROL_COLOR: Record<string, string> = {
  PROPIETARIO: '#2563eb',
  ADMIN:        '#7c3aed',
  RECEPCIONISTA:'#059669',
  MANTENIMIENTO:'#d97706',
  CONTADOR:     '#0891b2',
};

const ESTADO_COLOR: Record<string, string> = {
  activo:               '#16a34a',
  inactivo:             '#64748b',
  suspendido:           '#dc2626',
  pendiente:            '#f59e0b',
  pendiente_aprobacion: '#f59e0b',
};

const ROLES = ['RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR', 'ADMIN'] as const;
const ESTADOS_EDIT = ['activo', 'inactivo', 'suspendido'] as const;

// ── Chip ──────────────────────────────────────────────────────────────────────

const Chip = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 6,
    background: `${color}18`, color, fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
  }}>
    {label}
  </span>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const RoleManagement: React.FC = () => {
  const { user, refreshRole } = useAuth();
  const [usuarios,    setUsuarios]    = useState<UsuarioRol[]>([]);
  const [invitaciones,setInvitaciones]= useState<Invitacion[]>([]);
  const [hoteles,     setHoteles]     = useState<HotelItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Editing row
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editingRol,    setEditingRol]    = useState('RECEPCIONISTA');
  const [editingEstado, setEditingEstado] = useState('activo');
  const [editingHotel,  setEditingHotel]  = useState('');
  const [saving,        setSaving]        = useState(false);

  // Invite form
  const [inviteEmail,  setInviteEmail]  = useState('');
  const [inviteRol,    setInviteRol]    = useState<typeof ROLES[number]>('RECEPCIONISTA');
  const [inviteLoading,setInviteLoading]= useState(false);

  // Manual user form
  const [manualEmail,   setManualEmail]   = useState('');
  const [manualNombre,  setManualNombre]  = useState('');
  const [manualPassword,setManualPassword]= useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [manualRol,     setManualRol]     = useState<typeof ROLES[number]>('RECEPCIONISTA');
  const [manualEstado,  setManualEstado]  = useState<'activo'|'inactivo'|'suspendido'>('activo');
  const [manualHotel,   setManualHotel]   = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Buscar / eliminar cuenta por email
  const [buscarEmail,    setBuscarEmail]    = useState('');
  const [buscarResult,   setBuscarResult]   = useState<BusquedaUsuario | null>(null);
  const [buscarLoading,  setBuscarLoading]  = useState(false);
  const [eliminandoCuenta, setEliminandoCuenta] = useState(false);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => { void cargarDatos(); }, []);

  const cargarDatos = async () => {
    setLoading(true);
    const [usrs, invs, hots] = await Promise.all([
      obtenerTodosLosUsuarios(),
      obtenerInvitacionesActivas(),
      apiClient.get('/hotel/config/hoteles').catch(() => []),
    ]);
    setUsuarios(usrs);
    setInvitaciones(invs);
    setHoteles(Array.isArray(hots) ? hots : []);
    setLoading(false);
  };

  // ── Invitación ──
  const handleCrearInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) { showToast('Ingresa un correo válido.', 'err'); return; }
    if (invitaciones.some(i => i.email === inviteEmail && !i.usado)) {
      showToast('Ya existe una invitación activa para ese correo.', 'err'); return;
    }
    setInviteLoading(true);
    const inv = await crearInvitacion(inviteEmail, null, inviteRol);
    if (inv) {
      setInvitaciones(p => [inv, ...p]);
      setInviteEmail('');
      showToast('Invitación creada.');
    } else {
      showToast('Error al crear invitación.', 'err');
    }
    setInviteLoading(false);
  };

  const handleResend = async (id: string) => {
    const code = await resendInvitacion(id);
    if (code) {
      setInvitaciones(p => p.map(i => i.id === id ? { ...i, codigo_unico: code } : i));
      showToast('Código regenerado.');
    } else {
      showToast('Error al regenerar código.', 'err');
    }
  };

  const handleEliminarInv = async (id: string) => {
    if (!confirm('¿Eliminar esta invitación?')) return;
    const ok = await eliminarInvitacion(id);
    if (ok) {
      setInvitaciones(p => p.filter(i => i.id !== id));
      showToast('Invitación eliminada.');
    } else {
      showToast('Error al eliminar.', 'err');
    }
  };

  // ── Rol / Estado ──
  const handleGuardarRol = async (u: UsuarioRol) => {
    setSaving(true);
    const res = await asignarRol({ user_id: u.user_id, id_hotel: editingHotel || u.id_hotel, rol: editingRol, estado: editingEstado });
    if (res.ok) {
      setUsuarios(p => p.map(x => x.user_id === u.user_id ? { ...x, rol: editingRol as any, estado: editingEstado as any } : x));
      setEditingId(null);
      showToast('Cambios guardados.');
      // Si el admin editó su propio rol, refrescar el contexto de permisos
      if (u.user_id === user?.id) await refreshRole();
    } else {
      showToast(res.error ?? 'Error al guardar.', 'err');
    }
    setSaving(false);
  };

  const handleAprobar = async (u: UsuarioRol) => {
    const res = await cambiarEstadoUsuario(u.user_id, u.id_hotel, 'activo');
    if (res.ok) {
      setUsuarios(p => p.map(x => x.user_id === u.user_id ? { ...x, estado: 'activo' } : x));
      showToast('Usuario aprobado.');
    } else {
      showToast(res.error ?? 'Error.', 'err');
    }
  };

  const handleRechazar = async (u: UsuarioRol) => {
    const res = await cambiarEstadoUsuario(u.user_id, u.id_hotel, 'inactivo');
    if (res.ok) {
      setUsuarios(p => p.map(x => x.user_id === u.user_id ? { ...x, estado: 'inactivo' } : x));
      showToast('Usuario rechazado.');
    } else {
      showToast(res.error ?? 'Error.', 'err');
    }
  };

  const handleBuscarCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buscarEmail.trim()) return;
    setBuscarLoading(true);
    setBuscarResult(null);
    try {
      const result = await buscarUsuarioPorEmail(buscarEmail.trim());
      setBuscarResult(result);
    } catch (err: any) {
      showToast(err.message ?? 'Usuario no encontrado.', 'err');
    } finally {
      setBuscarLoading(false);
    }
  };

  const handleEliminarCuentaCompleta = async () => {
    if (!buscarResult) return;
    if (!confirm(`¿Eliminar completamente la cuenta de ${buscarResult.email}?\n\nEsto borrará su acceso a todo el sistema y no se puede deshacer.`)) return;
    setEliminandoCuenta(true);
    try {
      await eliminarUsuarioPorEmail(buscarResult.email!);
      setBuscarResult(null);
      setBuscarEmail('');
      setUsuarios(p => p.filter(u => u.user_id !== buscarResult.user_id));
      showToast('Cuenta eliminada del sistema.');
    } catch (err: any) {
      showToast(err.message ?? 'Error al eliminar.', 'err');
    } finally {
      setEliminandoCuenta(false);
    }
  };

  const handleEliminarUsuario = async (u: UsuarioRol) => {
    if (!confirm(`¿Eliminar a ${u.email} del sistema?\n\nEsto revocará su acceso por completo.`)) return;
    try {
      await eliminarUsuario(u.user_id);
      setUsuarios(p => p.filter(x => x.user_id !== u.user_id));
      showToast('Usuario eliminado.');
    } catch (err: any) {
      showToast(err.message ?? 'Error al eliminar.', 'err');
    }
  };

  // ── Crear usuario manual ──
  const handleCrearManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim())  { showToast('Correo requerido.', 'err'); return; }
    if (!manualNombre.trim()) { showToast('Nombre requerido.', 'err'); return; }
    if (!manualPassword || manualPassword.length < 8) { showToast('Contraseña mín. 8 caracteres.', 'err'); return; }
    setManualLoading(true);
    try {
      const nuevo = await crearUsuarioManual({ email: manualEmail, password: manualPassword, nombre: manualNombre, rol: manualRol, estado: manualEstado, id_hotel: manualHotel || undefined });
      setUsuarios(p => [nuevo, ...p]);
      setManualEmail(''); setManualNombre(''); setManualPassword(''); setManualHotel('');
      showToast('Usuario creado exitosamente.');
    } catch (err: any) {
      showToast(err.message ?? 'Error al crear usuario.', 'err');
    } finally {
      setManualLoading(false);
    }
  };

  const pendientes = usuarios.filter(u => u.estado === 'pendiente' || u.estado === 'pendiente_aprobacion');
  const activos    = usuarios.filter(u => u.estado !== 'pendiente' && u.estado !== 'pendiente_aprobacion');
  const invActivas = invitaciones.filter(i => !i.usado);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-medium"
          style={{ background: toast.type === 'ok' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
          {toast.type === 'ok' ? <Check size={14}/> : <X size={14}/>}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gestión de Roles</h1>
          <p className="text-sm text-slate-500 mt-1">Administra usuarios y permisos del hotel.</p>
        </div>
        <button onClick={() => void cargarDatos()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors">
          <RefreshCw size={14}/> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin"/>
        </div>
      ) : (
        <>
          {/* ── Invitar Usuario ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail size={16} className="text-blue-600"/>
              <h3 className="text-sm font-semibold text-blue-700">Invitar Nuevo Usuario</h3>
            </div>
            <form onSubmit={handleCrearInvitacion} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Correo</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rol</label>
                <select value={inviteRol} onChange={e => setInviteRol(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0)+r.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <button type="submit" disabled={inviteLoading}
                className="self-end px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {inviteLoading ? 'Creando...' : 'Crear Invitación'}
              </button>
            </form>
          </div>

          {/* ── Crear Usuario Manual ── */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={16} className="text-emerald-600"/>
              <h3 className="text-sm font-semibold text-emerald-700">Crear Usuario Manualmente</h3>
            </div>
            <form onSubmit={handleCrearManual} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Correo</label>
                <input type="email" value={manualEmail} onChange={e => setManualEmail(e.target.value)}
                  placeholder="usuario@ejemplo.com" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre</label>
                <input type="text" value={manualNombre} onChange={e => setManualNombre(e.target.value)}
                  placeholder="Juan Pérez" className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Contraseña</label>
                <div className="flex gap-2">
                  <input type={showPassword ? 'text' : 'password'} value={manualPassword} onChange={e => setManualPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres" className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none"/>
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="px-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-700 transition-colors">
                    {showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rol</label>
                <select value={manualRol} onChange={e => setManualRol(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0)+r.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Estado inicial</label>
                <select value={manualEstado} onChange={e => setManualEstado(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Hotel</label>
                <select value={manualHotel} onChange={e => setManualHotel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none">
                  <option value="">— Sin hotel específico —</option>
                  {hoteles.map(h => (
                    <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>
                  ))}
                </select>
              </div>
              <button type="submit" disabled={manualLoading}
                className="self-end px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {manualLoading ? 'Creando...' : 'Crear Usuario'}
              </button>
            </form>
          </div>

          {/* ── Buscar y eliminar cuenta por correo ── */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Search size={15} className="text-red-500"/>
              <h3 className="text-sm font-semibold text-red-700">Buscar cuenta por correo</h3>
            </div>
            <p className="text-xs text-red-500 mb-4">
              Útil para gestionar usuarios registrados como propietarios que no aparecen en la lista.
            </p>
            <form onSubmit={handleBuscarCuenta} className="flex gap-3">
              <input
                type="email"
                value={buscarEmail}
                onChange={e => { setBuscarEmail(e.target.value); setBuscarResult(null); }}
                placeholder="correo@ejemplo.com"
                className="flex-1 px-3 py-2 rounded-xl border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
              />
              <button type="submit" disabled={buscarLoading || !buscarEmail.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2">
                {buscarLoading ? <RefreshCw size={13} className="animate-spin"/> : <Search size={13}/>}
                Buscar
              </button>
            </form>

            {buscarResult && (
              <div className="mt-4 bg-white border border-red-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-slate-800">{buscarResult.email}</p>
                    <div className="flex flex-wrap gap-2">
                      {buscarResult.en_owners && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-xs font-bold">
                          <AlertTriangle size={10}/> Registrado como Propietario
                          {buscarResult.nombre_empresa && ` — ${buscarResult.nombre_empresa}`}
                        </span>
                      )}
                      {buscarResult.roles.map((r, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-md text-xs font-semibold"
                          style={{ background: `${ROL_COLOR[r.rol] ?? '#64748b'}18`, color: ROL_COLOR[r.rol] ?? '#64748b' }}>
                          {r.rol} · {r.estado}
                        </span>
                      ))}
                      {!buscarResult.en_owners && buscarResult.roles.length === 0 && (
                        <span className="text-xs text-slate-400">Sin rol asignado</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      Registrado: {new Date(buscarResult.created_at).toLocaleDateString('es-HN')}
                    </p>
                  </div>
                  <button
                    onClick={handleEliminarCuentaCompleta}
                    disabled={eliminandoCuenta}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60"
                  >
                    <Trash2 size={12}/>
                    {eliminandoCuenta ? 'Eliminando...' : 'Eliminar cuenta'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Invitaciones Activas ── */}
          {invActivas.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <Mail size={14} className="text-slate-400"/>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invitaciones Activas ({invActivas.length})</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Correo', 'Código', 'Rol', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invActivas.map(inv => (
                    <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700">{inv.email}</td>
                      <td className="px-4 py-3">
                        <code className="bg-slate-100 px-2 py-1 rounded-lg text-xs font-mono font-bold text-blue-600">{inv.codigo_unico}</code>
                      </td>
                      <td className="px-4 py-3"><Chip label={inv.rol_sugerido} color={ROL_COLOR[inv.rol_sugerido] ?? '#64748b'}/></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleResend(inv.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors">
                            <RefreshCw size={11}/> Nuevo código
                          </button>
                          <button onClick={() => handleEliminarInv(inv.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition-colors">
                            <Trash2 size={11}/> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Solicitudes Pendientes ── */}
          {pendientes.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3">Solicitudes pendientes de aprobación ({pendientes.length})</h3>
              <div className="flex flex-col gap-2">
                {pendientes.map(u => (
                  <div key={u.user_id} className="flex items-center justify-between bg-white rounded-xl p-3 border border-amber-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{u.email}</p>
                      <p className="text-xs text-slate-400">Solicitado: {new Date(u.creado_en).toLocaleDateString('es-HN')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAprobar(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors">
                        <Check size={12}/> Aprobar
                      </button>
                      <button onClick={() => handleRechazar(u)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-red-500 rounded-xl text-xs font-semibold hover:bg-red-50 transition-colors">
                        <X size={12}/> Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tabla de Usuarios ── */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Users size={14} className="text-slate-400"/>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Usuarios del Hotel ({activos.length})</h3>
            </div>
            {activos.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">Sin usuarios registrados.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Correo', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activos.map(u => (
                    <tr key={u.user_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700">{u.email}</td>
                      <td className="px-4 py-3">
                        {editingId === u.user_id ? (
                          <select value={editingRol} onChange={e => setEditingRol(e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none">
                            {['PROPIETARIO','ADMIN','RECEPCIONISTA','MANTENIMIENTO','CONTADOR'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <Chip label={u.rol} color={ROL_COLOR[u.rol] ?? '#64748b'}/>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === u.user_id ? (
                          <div className="flex flex-col gap-1.5">
                            <select value={editingEstado} onChange={e => setEditingEstado(e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none">
                              {ESTADOS_EDIT.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                            </select>
                            <select value={editingHotel} onChange={e => setEditingHotel(e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none">
                              <option value="">— Sin hotel —</option>
                              {hoteles.map(h => (
                                <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <Chip label={u.estado} color={ESTADO_COLOR[u.estado] ?? '#64748b'}/>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === u.user_id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleGuardarRol(u)} disabled={saving}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60">
                              {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => { setEditingId(u.user_id); setEditingRol(u.rol); setEditingEstado(u.estado); setEditingHotel(u.id_hotel || ''); }}
                              className="px-3 py-1.5 border border-slate-200 bg-slate-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors">
                              Editar
                            </button>
                            {u.rol !== 'PROPIETARIO' && (
                              <button onClick={() => handleEliminarUsuario(u)}
                                className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-50 transition-colors">
                                <Trash2 size={11}/> Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Info */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
            <strong>Roles disponibles:</strong> PROPIETARIO (acceso total), ADMIN (administración), RECEPCIONISTA (reservas/pagos), MANTENIMIENTO (limpieza), CONTADOR (finanzas).
          </div>
        </>
      )}
    </div>
  );
};

export default RoleManagement;
