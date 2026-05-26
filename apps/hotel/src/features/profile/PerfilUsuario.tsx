import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Upload, Lock, Bell, Moon, Globe, Shield, LogOut, User, Mail, Phone, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import { supabase } from '../../api/supabase';
import * as perfilService from '../../api/perfilService';

interface ActivityLog {
  id: string;
  usuario_id: string;
  accion: string;
  tabla_afectada: string;
  valores_antiguos?: Record<string, any>;
  valores_nuevos?: Record<string, any>;
  timestamp: string;
}

interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  direccion?: string;
  foto_perfil_url?: string;
  tema: 'claro' | 'oscuro';
  idioma: 'es' | 'en';
  notificaciones_activas: boolean;
  created_at: string;
  last_login?: string;
}

export const PerfilUsuario: React.FC = () => {
  const { user: authUser, signOut } = useAuth();
  const { role, canRead, canCreate, canEdit, canDelete } = useRole();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados de edición
  const [editingProfile, setEditingProfile] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editApellido, setEditApellido] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Preferencias
  const [tema, setTema] = useState<'claro' | 'oscuro'>('claro');
  const [idioma, setIdioma] = useState<'es' | 'en'>('es');
  const [notificacionesActivas, setNotificacionesActivas] = useState(true);
  const [loginAutomatico, setLoginAutomatico] = useState(false);
  const [recordarDispositivo, setRecordarDispositivo] = useState(false);

  // Filtros de actividad
  const [filtroAccion, setFiltroAccion] = useState('');
  const [filtroTabla, setFiltroTabla] = useState('');

  useEffect(() => {
    cargarPerfil();
    cargarPreferencias();
    cargarHistorialActividad();
  }, []);

  const cargarPerfil = async () => {
    setLoading(true);
    try {
      if (authUser) {
        const perfilData: UserProfile = {
          id: authUser.id,
          email: authUser.email || '',
          nombre: authUser.user_metadata?.nombre || authUser.email?.split('@')[0] || '',
          apellido: authUser.user_metadata?.apellido || '',
          telefono: authUser.user_metadata?.telefono || '',
          direccion: authUser.user_metadata?.direccion || '',
          foto_perfil_url: authUser.user_metadata?.foto_perfil_url || '',
          tema: 'claro',
          idioma: 'es',
          notificaciones_activas: true,
          created_at: authUser.created_at || new Date().toISOString(),
          last_login: authUser.last_sign_in_at,
        };

        setProfile(perfilData);
        setEditNombre(perfilData.nombre);
        setEditApellido(perfilData.apellido);
        setEditTelefono(perfilData.telefono || '');
        setEditDireccion(perfilData.direccion || '');
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  };

  const cargarPreferencias = async () => {
    try {
      // Primero intentar cargar desde localStorage directamente (más rápido)
      const localPrefs = localStorage.getItem('userPreferences');
      if (localPrefs) {
        try {
          const parsed = JSON.parse(localPrefs);
          console.log('✅ Preferencias cargadas desde localStorage:', parsed);
          setTema((parsed.tema || 'claro') as 'claro' | 'oscuro');
          setIdioma((parsed.idioma || 'es') as 'es' | 'en');
          setNotificacionesActivas(parsed.notificaciones_activas !== false);
          setLoginAutomatico(parsed.login_automatico === true);
          setRecordarDispositivo(parsed.recordar_dispositivo === true);
          return; // Si encontramos en localStorage, no hacer más
        } catch (e) {
          console.error('Error parsing localStorage:', e);
        }
      }

      // Si no está en localStorage, intentar desde perfilService (que intenta BD + localStorage fallback)
      const prefs = await Promise.race([
        perfilService.obtenerPreferenciasUsuario(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any;
      
      if (prefs) {
        console.log('Preferencias cargadas:', prefs);
        setTema((prefs.tema || 'claro') as 'claro' | 'oscuro');
        setIdioma((prefs.idioma || 'es') as 'es' | 'en');
        setNotificacionesActivas(prefs.notificaciones_activas !== false);
        setLoginAutomatico(prefs.login_automatico === true);
        setRecordarDispositivo(prefs.recordar_dispositivo === true);
      }
    } catch (err) {
      console.error('Error cargando preferencias:', err);
      // Usar valores por defecto si todo falla
      setTema('claro');
      setIdioma('es');
      setNotificacionesActivas(true);
      setLoginAutomatico(false);
      setRecordarDispositivo(false);
    }
  };

  const cargarHistorialActividad = async () => {
    try {
      if (!authUser) return;

      const { data, error: err } = await supabase
        .from('bitacora_actividad')
        .select('*')
        .eq('usuario_id', authUser.id)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (err) {
        console.warn('No se pudo cargar bitácora:', err);
        return;
      }

      if (data) {
        setActivityLogs(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGuardarPerfil = async () => {
    try {
      if (!authUser || !profile) return;

      setLoading(true);
      const updatedData = {
        nombre: editNombre,
        apellido: editApellido,
        telefono: editTelefono,
        direccion: editDireccion,
      };

      // Actualizar metadata del usuario en Supabase Auth
      await perfilService.actualizarPerfilUsuario(updatedData);

      const updatedProfile: UserProfile = {
        ...profile,
        ...updatedData,
      };

      setProfile(updatedProfile);
      setEditingProfile(false);
      setSuccessMessage('✅ Perfil actualizado correctamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setError('❌ Error al guardar perfil');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCambiarContraseña = async () => {
    if (!newPassword || !confirmPassword) {
      setError('⚠️ Por favor completa todos los campos');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('⚠️ Las contraseñas no coinciden');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (newPassword.length < 8) {
      setError('⚠️ La contraseña debe tener al menos 8 caracteres');
      setTimeout(() => setError(null), 3000);
      return;
    }

    try {
      setLoading(true);
      await perfilService.cambiarContraseña(newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setSuccessMessage('✅ Contraseña actualizada correctamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setError('❌ Error al cambiar contraseña');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarPreferencias = async () => {
    try {
      setLoading(true);
      
      // Guardar preferencias
      await perfilService.guardarPreferenciasUsuario({
        tema: tema as 'claro' | 'oscuro',
        idioma: idioma as 'es' | 'en',
        notificaciones_activas: notificacionesActivas,
        login_automatico: loginAutomatico,
        recordar_dispositivo: recordarDispositivo,
      });

      // Recargar preferencias para confirmar que se guardaron
      await cargarPreferencias();

      setSuccessMessage('✅ Preferencias guardadas correctamente');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setError('❌ Error al guardar preferencias');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const actividadFiltrada = activityLogs.filter(log => {
    const coincideAccion = !filtroAccion || log.accion.toLowerCase().includes(filtroAccion.toLowerCase());
    const coincideTabla = !filtroTabla || log.tabla_afectada.toLowerCase().includes(filtroTabla.toLowerCase());
    return coincideAccion && coincideTabla;
  });

  const userRole = role;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: '#64748b' }}>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ padding: '16px', borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          Error: No se pudo cargar el perfil. Por favor recarga la página.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>
          👤 Mi Perfil
        </h1>
        <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
          Gestiona tu información personal y preferencias
        </p>
      </div>

      {/* Mensajes de error/éxito */}
      {error && (
        <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', color: '#dc2626', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '12px 14px', borderRadius: 10, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)', color: '#22c55e', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ {successMessage}
        </div>
      )}

      {profile && (
        <>
          {/* 1. PERFIL PERSONAL */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #e0e7ff', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <User size={24} style={{ color: '#2563eb' }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                📋 Perfil Personal
              </h2>
            </div>

            {!editingProfile ? (
              <div style={{ display: 'grid', gap: 16 }}>
                {/* Avatar */}
                <div style={{ textAlign: 'center', paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ width: 100, height: 100, borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 40, color: '#64748b' }}>
                    {profile.foto_perfil_url ? '🖼️' : '👤'}
                  </div>
                  <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                    Foto de perfil
                  </p>
                </div>

                {/* Datos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Nombre</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>{profile.nombre}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>Apellido</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>{profile.apellido || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>
                      <Mail size={14} style={{ display: 'inline', marginRight: 4 }} />
                      Correo
                    </p>
                    <p style={{ fontSize: 13, color: '#2563eb', margin: 0 }}>{profile.email}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>
                      <Phone size={14} style={{ display: 'inline', marginRight: 4 }} />
                      Teléfono
                    </p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>{profile.telefono || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>
                      <MapPin size={14} style={{ display: 'inline', marginRight: 4 }} />
                      Dirección
                    </p>
                    <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{profile.direccion || '—'}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>
                      <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
                      Se unió
                    </p>
                    <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{new Date(profile.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingProfile(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    alignSelf: 'flex-start',
                  }}
                >
                  ✏️ Editar Perfil
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={e => setEditNombre(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={editApellido}
                    onChange={e => setEditApellido(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={editTelefono}
                    onChange={e => setEditTelefono(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={editDireccion}
                    onChange={e => setEditDireccion(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleGuardarPerfil}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: '#16a34a',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    💾 Guardar
                  </button>
                  <button
                    onClick={() => setEditingProfile(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      color: '#475569',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Cambiar Contraseña */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: '#475569',
                }}
              >
                <Lock size={14} />
                {showPasswordForm ? 'Cancelar' : 'Cambiar Contraseña'}
              </button>

              {showPasswordForm && (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#fff5f5', border: '1px solid #fee2e2' }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Contraseña Nueva
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mín. 8 caracteres"
                        style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      />
                      <button
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', left: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Confirmar Contraseña
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Repetir contraseña"
                        style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                      />
                      <button
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', left: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleCambiarContraseña}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: '#dc2626',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    🔐 Actualizar Contraseña
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 2. PREFERENCIAS DE INTERFAZ */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #fef3c7', backgroundColor: '#fffbeb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Moon size={24} style={{ color: '#ca8a04' }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                🎨 Preferencias de Interfaz
              </h2>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Tema
                </label>
                <select
                  value={tema}
                  onChange={e => setTema(e.target.value as 'claro' | 'oscuro')}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    backgroundColor: '#fff',
                  }}
                >
                  <option value="claro">☀️ Claro</option>
                  <option value="oscuro">🌙 Oscuro</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Idioma
                </label>
                <select
                  value={idioma}
                  onChange={e => setIdioma(e.target.value as 'es' | 'en')}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    backgroundColor: '#fff',
                  }}
                >
                  <option value="es">🇪🇸 Español</option>
                  <option value="en">🇺🇸 English</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={16} style={{ color: '#ca8a04' }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>Notificaciones</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>Recibir alertas del sistema</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notificacionesActivas}
                  onChange={e => setNotificacionesActivas(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #dbeafe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={16} style={{ color: '#0284c7' }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>🔐 Login Automático</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>Inicia sesión automáticamente (como Google)</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={loginAutomatico}
                  onChange={e => setLoginAutomatico(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #dbeafe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={16} style={{ color: '#0284c7' }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', margin: 0 }}>📱 Recordar Dispositivo</p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>Mantener sesión en este navegador</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={recordarDispositivo}
                  onChange={e => setRecordarDispositivo(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: 'pointer' }}
                />
              </div>

              <button
                onClick={handleGuardarPreferencias}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: '#ca8a04',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                💾 Guardar Preferencias
              </button>
            </div>
          </div>

          {/* 3. SEGURIDAD Y AUDITORÍA */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #fce7f3', backgroundColor: '#fdf2f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Shield size={24} style={{ color: '#ec4899' }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                🔒 Mi Actividad
              </h2>
            </div>

            {/* Filtros */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Filtrar por acción
                </label>
                <input
                  type="text"
                  value={filtroAccion}
                  onChange={e => setFiltroAccion(e.target.value)}
                  placeholder="Ej: INSERT, UPDATE, DELETE"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Filtrar por tabla
                </label>
                <input
                  type="text"
                  value={filtroTabla}
                  onChange={e => setFiltroTabla(e.target.value)}
                  placeholder="Ej: reservas, usuarios_roles"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Tabla de actividad */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', backgroundColor: '#fff' }}>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Fecha/Hora</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Acción</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Tabla</th>
                    <th style={{ padding: '10px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {actividadFiltrada.length > 0 ? (
                    actividadFiltrada.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#fdf2f8' }}>
                        <td style={{ padding: '10px', color: '#475569' }}>
                          {new Date(log.timestamp).toLocaleString('es-ES')}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            backgroundColor: log.accion === 'INSERT' ? '#dcfce7' : log.accion === 'UPDATE' ? '#fef3c7' : '#fee2e2',
                            color: log.accion === 'INSERT' ? '#16a34a' : log.accion === 'UPDATE' ? '#ca8a04' : '#dc2626',
                            fontSize: 11,
                            fontWeight: 600,
                          }}>
                            {log.accion}
                          </span>
                        </td>
                        <td style={{ padding: '10px', color: '#2563eb', fontWeight: 500 }}>
                          {log.tabla_afectada}
                        </td>
                        <td style={{ padding: '10px', color: '#64748b', fontSize: 11 }}>
                          {log.valores_nuevos && Object.keys(log.valores_nuevos).length > 0
                            ? `${Object.keys(log.valores_nuevos).length} campos`
                            : '—'
                          }
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        No hay registros de actividad
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p style={{ fontSize: 11, color: '#64748b', marginTop: 12, marginBottom: 0 }}>
              📊 Total de registros mostrados: {actividadFiltrada.length} de {activityLogs.length}
            </p>
          </div>

          {/* 4. ROL Y PERMISOS */}
          <div style={{ marginBottom: 32, padding: '20px', borderRadius: 12, border: '1px solid #dbeafe', backgroundColor: '#eff6ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <User size={24} style={{ color: '#0284c7' }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                🎯 Rol y Permisos
              </h2>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ padding: 12, borderRadius: 8, backgroundColor: '#fff', border: '1px solid #bfdbfe' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#475569', margin: '0 0 4px' }}>Rol Asignado</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0284c7', margin: 0 }}>
                  {userRole ? userRole.toUpperCase() : 'Cargando...'}
                </p>
              </div>

              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>Permisos Activos:</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  {userRole ? (
                    [
                      { nombre: 'Leer Reservas', permiso: canRead('reservas') },
                      { nombre: 'Crear Reservas', permiso: canCreate('reservas') },
                      { nombre: 'Editar Reservas', permiso: canEdit('reservas') },
                      { nombre: 'Ver Finanzas', permiso: canRead('finanzas') },
                      { nombre: 'Crear Pagos', permiso: canCreate('pagos') },
                      { nombre: 'Ver Reportes', permiso: canRead('reportes') },
                      { nombre: 'Acceso Admin', permiso: canRead('config') },
                    ].map(({ nombre, permiso }) => (
                      <div
                        key={nombre}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 6,
                          backgroundColor: permiso ? '#dcfce7' : '#fee2e2',
                          border: `1px solid ${permiso ? '#86efac' : '#fca5a5'}`,
                          fontSize: 12,
                          fontWeight: 500,
                          color: permiso ? '#166534' : '#7f1d1d',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {permiso ? '✓' : '✗'} {nombre}
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 12, color: '#64748b' }}>Cargando permisos...</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cerrar Sesión */}
          <div style={{ padding: '20px', borderRadius: 12, border: '1px solid #fee2e2', backgroundColor: '#fff5f5', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
              ¿Deseas cerrar tu sesión?
            </p>
            <button
              onClick={signOut}
              style={{
                padding: '10px 20px',
                borderRadius: 6,
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                margin: '0 auto',
              }}
            >
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
};
