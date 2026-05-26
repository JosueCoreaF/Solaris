import React, { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { obtenerTodosLosUsuarios, asignarRol, cambiarEstadoUsuario, UsuarioRol } from '../../api/usuariosRolesService';
import { crearInvitacion, obtenerInvitacionesActivas, resendInvitacion, eliminarInvitacion, Invitacion } from '../../api/invitacionesService';
import { crearUsuarioManual } from '../../api/usuariosService';

const rolColors: Record<string, string> = {
  PROPIETARIO: '#2563eb',
  ADMIN: '#7c3aed',
  RECEPCIONISTA: '#059669',
  MANTENIMIENTO: '#d97706',
  CONTADOR: '#0891b2',
};

const estadoColors: Record<string, string> = {
  activo: '#16a34a',
  inactivo: '#64748b',
  suspendido: '#dc2626',
  pendiente_aprobacion: '#f59e0b',
};

export const RoleManagement: React.FC = () => {
  const [usuarios, setUsuarios] = useState<UsuarioRol[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRol, setEditingRol] = useState('RECEPCIONISTA');
  const [editingEstado, setEditingEstado] = useState('activo');
  
  // Para crear invitación
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRol, setInviteRol] = useState<'RECEPCIONISTA' | 'MANTENIMIENTO' | 'CONTADOR' | 'ADMIN'>('RECEPCIONISTA');
  const [inviteLoading, setInviteLoading] = useState(false);

  // Para crear usuario manual
  const [manualEmail, setManualEmail] = useState('');
  const [manualNombre, setManualNombre] = useState('');
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  const [manualRol, setManualRol] = useState<'RECEPCIONISTA' | 'MANTENIMIENTO' | 'CONTADOR' | 'ADMIN'>('RECEPCIONISTA');
  const [manualEstado, setManualEstado] = useState<'activo' | 'inactivo' | 'suspendido'>('activo');
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    
    // Cargar solo invitaciones activas (no usadas)
    const invitas = await obtenerInvitacionesActivas();
    if (invitas) setInvitaciones(invitas);
    
    // Cargar TODOS los usuarios registrados (sin dependencia de hotel)
    const usuarios = await obtenerTodosLosUsuarios();
    if (usuarios) setUsuarios(usuarios);
    
    setLoading(false);
  };

  const handleCrearInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setError('Ingresa un correo válido');
      return;
    }
    
    // Validar que no exista una invitación activa para este email
    const yaExiste = invitaciones.some(i => i.email === inviteEmail && !i.usado);
    if (yaExiste) {
      setError('Ya existe una invitación activa para este correo');
      return;
    }
    
    setInviteLoading(true);
    const invita = await crearInvitacion(inviteEmail, null, inviteRol);
    
    if (invita) {
      setInvitaciones([invita, ...invitaciones]);
      setInviteEmail('');
      setError(null);
    } else {
      setError('Error al crear invitación');
    }
    setInviteLoading(false);
  };

  const handleResendCodigo = async (id: string) => {
    const nuevoCodigo = await resendInvitacion(id);
    if (nuevoCodigo) {
      setInvitaciones(invitaciones.map(i => 
        i.id === id ? { ...i, codigo_unico: nuevoCodigo } : i
      ));
    }
  };

  const handleEliminarInvitacion = async (id: string) => {
    if (confirm('¿Eliminar esta invitación?')) {
      const success = await eliminarInvitacion(id);
      if (success) {
        setInvitaciones(invitaciones.filter(i => i.id !== id));
      }
    }
  };

  const handleGuardarRol = async (usuario: UsuarioRol) => {
    const success = await asignarRol({
      usuario_id: usuario.usuario_id,
      id_hotel: usuario.id_hotel,
      rol: editingRol,
      estado: editingEstado,
    });

    if (success) {
      setUsuarios(
        usuarios.map(u =>
          u.usuario_id === usuario.usuario_id
            ? { ...u, rol: editingRol as any, estado: editingEstado as any }
            : u
        )
      );
      setEditingId(null);
    } else {
      setError('Error al guardar rol');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleCrearUsuarioManual = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualEmail.trim()) {
      setError('Ingresa un correo válido');
      return;
    }
    if (!manualNombre.trim()) {
      setError('Ingresa un nombre');
      return;
    }
    if (!manualPassword || manualPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setManualLoading(true);
    const nuevoUsuario = await crearUsuarioManual({
      email: manualEmail,
      password: manualPassword,
      nombre: manualNombre,
      rol: manualRol,
      estado: manualEstado,
    });

    if (nuevoUsuario) {
      setUsuarios([nuevoUsuario, ...usuarios]);
      setManualEmail('');
      setManualNombre('');
      setManualPassword('');
      setShowManualPassword(false);
      setManualRol('RECEPCIONISTA');
      setManualEstado('activo');
      setError(null);
    } else {
      setError('Error al crear usuario');
    }
    setManualLoading(false);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>
          Gestión de Roles y Permisos
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Asigna y administra roles de usuarios en tu hotel
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 32, height: 32, border: '2.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: '#64748b' }}>Cargando usuarios...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Invitar Usuario */}
          <div style={{ marginBottom: 32, padding: '18px 20px', borderRadius: 12, border: '1px solid #bfdbfe', backgroundColor: '#f0f9ff' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0c63e4', margin: '0 0 14px' }}>➕ Invitar Nuevo Usuario</h3>
            <form onSubmit={handleCrearInvitacion} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Correo</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="usuario@example.com"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Rol</label>
                <select
                  value={inviteRol}
                  onChange={e => setInviteRol(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="RECEPCIONISTA">Recepcionista</option>
                  <option value="MANTENIMIENTO">Mantenimiento</option>
                  <option value="CONTADOR">Contador</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={inviteLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#0c63e4',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: inviteLoading ? 'not-allowed' : 'pointer',
                  opacity: inviteLoading ? 0.7 : 1,
                  alignSelf: 'flex-end',
                }}
              >
                {inviteLoading ? 'Creando...' : 'Crear Invitación'}
              </button>
            </form>
          </div>

          {/* Crear Usuario Manual */}
          <div style={{ marginBottom: 32, padding: '18px 20px', borderRadius: 12, border: '1px solid #dcfce7', backgroundColor: '#f0fdf4' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', margin: '0 0 14px' }}>👤 Crear Usuario Manualmente</h3>
            <form onSubmit={handleCrearUsuarioManual} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Correo</label>
                <input
                  type="email"
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  placeholder="usuario@example.com"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nombre</label>
                <input
                  type="text"
                  value={manualNombre}
                  onChange={e => setManualNombre(e.target.value)}
                  placeholder="Juan Pérez"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Contraseña</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type={showManualPassword ? 'text' : 'password'}
                    value={manualPassword}
                    onChange={e => setManualPassword(e.target.value)}
                    placeholder="Mín. 8 caracteres"
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowManualPassword(!showManualPassword)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      cursor: 'pointer',
                      color: '#64748b',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e2e8f0';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f8fafc';
                    }}
                  >
                    {showManualPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Rol</label>
                <select
                  value={manualRol}
                  onChange={e => setManualRol(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit' }}
                >
                  <option value="RECEPCIONISTA">Recepcionista</option>
                  <option value="MANTENIMIENTO">Mantenimiento</option>
                  <option value="CONTADOR">Contador</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Estado</label>
                <select
                  value={manualEstado}
                  onChange={e => setManualEstado(e.target.value as any)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, fontFamily: 'inherit' }}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="suspendido">Suspendido</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={manualLoading}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#16a34a',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: manualLoading ? 'not-allowed' : 'pointer',
                  opacity: manualLoading ? 0.7 : 1,
                  alignSelf: 'flex-end',
                }}
              >
                {manualLoading ? 'Creando...' : 'Crear Usuario'}
              </button>
            </form>
          </div>

          {/* Tabla de Invitaciones Activas */}
          {invitaciones.filter(i => !i.usado).length > 0 && (
            <div style={{ marginBottom: 32, borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#475569', margin: 0 }}>📋 Invitaciones Activas</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Email</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Código</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Rol</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Estado</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.filter(i => !i.usado).map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#1e293b' }}>{inv.email}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        <code style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 600, color: '#0c63e4' }}>
                          {inv.codigo_unico}
                        </code>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: `${rolColors[inv.rol_sugerido]}20`,
                          color: rolColors[inv.rol_sugerido],
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {inv.rol_sugerido}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 4,
                          backgroundColor: inv.usado ? '#f1f5f9' : '#dcfce7',
                          color: inv.usado ? '#64748b' : '#16a34a',
                          fontSize: 11,
                          fontWeight: 700,
                        }}>
                          {inv.usado ? '✓ Usado' : '⏳ Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!inv.usado && (
                            <button
                              onClick={() => handleResendCodigo(inv.id)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: 4,
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#fff',
                                color: '#0c63e4',
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              🔄 Nuevo Código
                            </button>
                          )}
                          <button
                            onClick={() => handleEliminarInvitacion(inv.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid #fee2e2',
                              backgroundColor: '#fff',
                              color: '#dc2626',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Solicitudes Pendientes */}
          {usuarios.filter(u => u.estado === 'pendiente_aprobacion').length > 0 && (
            <div style={{ marginBottom: 32, padding: '16px 18px', borderRadius: 12, border: '1px solid #fcd34d', backgroundColor: 'rgba(251, 191, 36, 0.05)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', margin: '0 0 12px' }}>⏳ Solicitudes Pendientes de Aprobación</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {usuarios.filter(u => u.estado === 'pendiente_aprobacion').map(usuario => (
                  <div key={usuario.usuario_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: '#fff', borderRadius: 8, border: '1px solid #f3e8ff' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>{usuario.email}</p>
                      <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>Solicitado: {new Date(usuario.creado_en).toLocaleDateString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() =>
                          cambiarEstadoUsuario(usuario.usuario_id, usuario.id_hotel, 'activo').then(() => {
                            setUsuarios(usuarios.map(u => u.usuario_id === usuario.usuario_id ? { ...u, estado: 'activo' } : u));
                          })
                        }
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          backgroundColor: '#16a34a',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Aprobar
                      </button>
                      <button
                        onClick={() =>
                          cambiarEstadoUsuario(usuario.usuario_id, usuario.id_hotel, 'inactivo').then(() => {
                            setUsuarios(usuarios.map(u => u.usuario_id === usuario.usuario_id ? { ...u, estado: 'inactivo' } : u));
                          })
                        }
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#fff',
                          color: '#dc2626',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla de Usuarios Activos/Inactivos */}
          <div style={{ borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Email
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Rol
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Estado
                </th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.filter(u => u.estado !== 'pendiente_aprobacion').length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No hay usuarios activos/inactivos</p>
                  </td>
                </tr>
              ) : (
                usuarios.filter(u => u.estado !== 'pendiente_aprobacion').map(usuario => (
                  <tr key={usuario.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#1e293b' }}>
                      {usuario.email}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                      {editingId === usuario.usuario_id ? (
                        <select
                          value={editingRol}
                          onChange={e => setEditingRol(e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#1e293b',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="PROPIETARIO">PROPIETARIO</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="RECEPCIONISTA">RECEPCIONISTA</option>
                          <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                          <option value="CONTADOR">CONTADOR</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: `${rolColors[usuario.rol]}20`,
                            color: rolColors[usuario.rol],
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '.04em',
                          }}
                        >
                          {usuario.rol}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                      {editingId === usuario.usuario_id ? (
                        <select
                          value={editingEstado}
                          onChange={e => setEditingEstado(e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#1e293b',
                            backgroundColor: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="activo">Activo</option>
                          <option value="inactivo">Inactivo</option>
                          <option value="suspendido">Suspendido</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 6,
                            backgroundColor: `${estadoColors[usuario.estado]}20`,
                            color: estadoColors[usuario.estado],
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'capitalize',
                          }}
                        >
                          {usuario.estado}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                      {editingId === usuario.usuario_id ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => handleGuardarRol(usuario)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: 'none',
                              backgroundColor: '#16a34a',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                              backgroundColor: '#fff',
                              color: '#64748b',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'opacity 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(usuario.usuario_id);
                            setEditingRol(usuario.rol);
                            setEditingEstado(usuario.estado);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            color: '#2563eb',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>

          {/* Info Box */}
          <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 10, backgroundColor: '#f0f9ff', border: '1px solid #bfdbfe' }}>
            <p style={{ fontSize: 12, color: '#1e40af', margin: 0, lineHeight: 1.5 }}>
              <strong>ℹ️ Roles Disponibles:</strong> PROPIETARIO (acceso total), ADMIN (administración), RECEPCIONISTA (reservas/pagos), MANTENIMIENTO (limpieza), CONTADOR (finanzas).
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default RoleManagement;
