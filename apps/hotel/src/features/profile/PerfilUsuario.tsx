import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Upload, Lock, Bell, Moon, Globe, Shield, LogOut, User, Mail, Phone, MapPin, Calendar, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRole } from '../../hooks/useRole';
import * as perfilService from '../../api/perfilService';
import { auditService, AuditLog } from '../../api/auditService';

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
  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
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

  const [filtroAccion, setFiltroAccion] = useState('');
  const [filtroTabla, setFiltroTabla] = useState('');
  const [activeTab, setActiveTab] = useState<'general' | 'seguridad' | 'preferencias' | 'actividad'>('general');

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
      const localPrefs = localStorage.getItem('userPreferences');
      if (localPrefs) {
        try {
          const parsed = JSON.parse(localPrefs);
          setTema((parsed.tema || 'claro') as 'claro' | 'oscuro');
          setIdioma((parsed.idioma || 'es') as 'es' | 'en');
          setNotificacionesActivas(parsed.notificaciones_activas !== false);
          setLoginAutomatico(parsed.login_automatico === true);
          setRecordarDispositivo(parsed.recordar_dispositivo === true);
          return;
        } catch (e) {
          console.error('Error parsing localStorage:', e);
        }
      }

      const prefs = await Promise.race([
        perfilService.obtenerPreferenciasUsuario(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as any;
      
      if (prefs) {
        setTema((prefs.tema || 'claro') as 'claro' | 'oscuro');
        setIdioma((prefs.idioma || 'es') as 'es' | 'en');
        setNotificacionesActivas(prefs.notificaciones_activas !== false);
        setLoginAutomatico(prefs.login_automatico === true);
        setRecordarDispositivo(prefs.recordar_dispositivo === true);
      }
    } catch (err) {
      console.error('Error cargando preferencias:', err);
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
      const response = await auditService.obtenerMiActividad(30, 0);
      setActivityLogs(response.data ?? []);
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
      await perfilService.actualizarPerfilUsuario(updatedData);
      setProfile({ ...profile, ...updatedData });
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
      await perfilService.guardarPreferenciasUsuario({
        tema: tema as 'claro' | 'oscuro',
        idioma: idioma as 'es' | 'en',
        notificaciones_activas: notificacionesActivas,
        login_automatico: loginAutomatico,
        recordar_dispositivo: recordarDispositivo,
      });
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

  const etiquetaEntidadPerfil: Record<string, string> = {
    reservas_hotel: 'Reservas', pagos_hotel: 'Pagos', huespedes: 'Huéspedes',
    usuarios_roles: 'Usuarios & Roles', saldos_clientes: 'Saldos',
    habitaciones: 'Habitaciones', cotizaciones: 'Cotizaciones', hoteles: 'Hotel',
  };

  const userRole = role;

  if (loading && !profile) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          Error: No se pudo cargar el perfil. Por favor recarga la página.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1 tracking-tight">Mi Perfil</h1>
          <p className="text-sm text-slate-500">Gestiona tu información, seguridad y preferencias de la cuenta.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-lg border border-blue-100 flex items-center gap-1.5">
            <Shield size={14} />
            {userRole || 'CARGANDO...'}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-6 flex items-center gap-2 animate-slide-in">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm mb-6 flex items-center gap-2 animate-slide-in">
          <Shield size={18} />
          {successMessage}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-64 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === 'general' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <User size={18} /> General
            </button>
            <button
              onClick={() => setActiveTab('seguridad')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === 'seguridad' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Lock size={18} /> Seguridad
            </button>
            <button
              onClick={() => setActiveTab('preferencias')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === 'preferencias' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Globe size={18} /> Preferencias
            </button>
            <button
              onClick={() => setActiveTab('actividad')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === 'actividad' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bell size={18} /> Actividad
            </button>
          </nav>
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {activeTab === 'general' && (
            <div className="animate-fade-in">
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Información Personal</h2>
                <p className="text-sm text-slate-500 mt-1">Actualiza tu foto y datos de contacto.</p>
              </div>
              
              <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center text-4xl overflow-hidden relative group">
                    {profile.foto_perfil_url ? (
                      <img src={profile.foto_perfil_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400">👤</span>
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload size={24} className="text-white" />
                    </div>
                  </div>
                  <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md transition-colors">
                    Cambiar foto
                  </button>
                </div>

                <div className="flex-1">
                  {!editingProfile ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre</p>
                          <p className="text-base font-medium text-slate-900">{profile.nombre}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Apellido</p>
                          <p className="text-base font-medium text-slate-900">{profile.apellido || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Correo Electrónico</p>
                          <p className="text-base font-medium text-slate-900 flex items-center gap-2">
                            <Mail size={16} className="text-slate-400" /> {profile.email}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono</p>
                          <p className="text-base font-medium text-slate-900 flex items-center gap-2">
                            <Phone size={16} className="text-slate-400" /> {profile.telefono || '—'}
                          </p>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección</p>
                          <p className="text-base font-medium text-slate-900 flex items-center gap-2">
                            <MapPin size={16} className="text-slate-400" /> {profile.direccion || '—'}
                          </p>
                        </div>
                      </div>
                      <div className="pt-6 border-t border-slate-100">
                        <button
                          onClick={() => setEditingProfile(true)}
                          className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm"
                        >
                          Editar Información
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre</label>
                          <input
                            type="text"
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apellido</label>
                          <input
                            type="text"
                            value={editApellido}
                            onChange={e => setEditApellido(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Teléfono</label>
                          <input
                            type="tel"
                            value={editTelefono}
                            onChange={e => setEditTelefono(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Dirección</label>
                          <input
                            type="text"
                            value={editDireccion}
                            onChange={e => setEditDireccion(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors outline-none"
                          />
                        </div>
                      </div>
                      <div className="pt-6 border-t border-slate-100 flex gap-3">
                        <button
                          onClick={handleGuardarPerfil}
                          disabled={loading}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm shadow-blue-600/20 disabled:opacity-70 flex items-center gap-2"
                        >
                          {loading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                        <button
                          onClick={() => setEditingProfile(false)}
                          className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-sm font-semibold py-2.5 px-6 rounded-xl transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'seguridad' && (
            <div className="animate-fade-in">
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Seguridad de la Cuenta</h2>
                <p className="text-sm text-slate-500 mt-1">Protege tu acceso y administra tus credenciales.</p>
              </div>
              
              <div className="p-6 md:p-8 space-y-8">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-blue-600" /> Cambiar Contraseña
                  </h3>
                  <div className="max-w-md space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nueva Contraseña</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          placeholder="Mín. 8 caracteres"
                          className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirmar Contraseña</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          placeholder="Repite la contraseña"
                          className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleCambiarContraseña}
                      disabled={loading || !newPassword || !confirmPassword}
                      className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold py-3 px-6 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-blue-600" /> Opciones de Acceso
                  </h3>
                  <div className="space-y-4 max-w-2xl">
                    <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Login Automático</p>
                        <p className="text-xs text-slate-500 mt-1">Inicia sesión automáticamente si existe un token activo (como Google).</p>
                      </div>
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={loginAutomatico} onChange={e => {setLoginAutomatico(e.target.checked); handleGuardarPreferencias();}} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Recordar Dispositivo</p>
                        <p className="text-xs text-slate-500 mt-1">Mantener la sesión abierta en este navegador por más tiempo.</p>
                      </div>
                      <div className="relative">
                        <input type="checkbox" className="sr-only peer" checked={recordarDispositivo} onChange={e => {setRecordarDispositivo(e.target.checked); handleGuardarPreferencias();}} />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preferencias' && (
            <div className="animate-fade-in">
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Preferencias de Interfaz</h2>
                <p className="text-sm text-slate-500 mt-1">Personaliza la apariencia y el comportamiento de la aplicación.</p>
              </div>

              <div className="p-6 md:p-8 space-y-8 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Apariencia</label>
                    <div className="relative">
                      <select
                        value={tema}
                        onChange={e => {setTema(e.target.value as 'claro'|'oscuro'); handleGuardarPreferencias();}}
                        className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-blue-500 block p-3 outline-none appearance-none cursor-pointer hover:border-blue-300 transition-colors"
                      >
                        <option value="claro">☀️ Tema Claro</option>
                        <option value="oscuro">🌙 Tema Oscuro</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Idioma</label>
                    <div className="relative">
                      <select
                        value={idioma}
                        onChange={e => {setIdioma(e.target.value as 'es'|'en'); handleGuardarPreferencias();}}
                        className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-semibold rounded-xl focus:ring-2 focus:ring-blue-500 block p-3 outline-none appearance-none cursor-pointer hover:border-blue-300 transition-colors"
                      >
                        <option value="es">🇪🇸 Español (Honduras)</option>
                        <option value="en">🇺🇸 English (US)</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Bell size={18} className="text-blue-600" /> Alertas
                  </h3>
                  <label className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer group">
                    <div>
                      <p className="text-sm font-bold text-slate-900">Notificaciones del Sistema</p>
                      <p className="text-xs text-slate-500 mt-1">Recibe alertas importantes sobre tus reservas e ingresos.</p>
                    </div>
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" checked={notificacionesActivas} onChange={e => {setNotificacionesActivas(e.target.checked); handleGuardarPreferencias();}} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actividad' && (
            <div className="animate-fade-in flex flex-col h-full min-h-[500px]">
              <div className="p-6 md:p-8 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Bitácora de Actividad</h2>
                <p className="text-sm text-slate-500 mt-1">Revisa el historial de acciones realizadas por tu cuenta.</p>
              </div>

              <div className="p-6 bg-slate-50 border-b border-slate-200">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Acción</label>
                    <input
                      type="text"
                      value={filtroAccion}
                      onChange={e => setFiltroAccion(e.target.value)}
                      placeholder="Ej: Creado, Actualizado"
                      className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 block p-2.5 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Filtrar por Módulo</label>
                    <input
                      type="text"
                      value={filtroTabla}
                      onChange={e => setFiltroTabla(e.target.value)}
                      placeholder="Ej: Reservas, Pagos"
                      className="w-full bg-white border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 block p-2.5 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-4 px-6 font-semibold">Fecha y Hora</th>
                      <th className="py-4 px-6 font-semibold">Acción</th>
                      <th className="py-4 px-6 font-semibold">Módulo</th>
                      <th className="py-4 px-6 font-semibold">Descripción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activityLogs.length > 0 ? (
                      activityLogs
                        .filter(log => {
                          const etiquetaAccion = auditService.obtenerEtiquetaAccion(log.accion).toLowerCase();
                          const etiquetaEnt = (etiquetaEntidadPerfil[log.entidad] ?? log.entidad ?? '').toLowerCase();
                          return (
                            (!filtroAccion || etiquetaAccion.includes(filtroAccion.toLowerCase()) || log.accion.toLowerCase().includes(filtroAccion.toLowerCase())) &&
                            (!filtroTabla  || etiquetaEnt.includes(filtroTabla.toLowerCase()))
                          );
                        })
                        .map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 text-slate-700 whitespace-nowrap">
                              {new Date(log.created_at_iso).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-4 px-6 font-medium text-slate-900">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${auditService.obtenerColorAccion(log.accion)} bg-slate-100`}>
                                {auditService.obtenerIconoAccion(log.accion)} {auditService.obtenerEtiquetaAccion(log.accion)}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-slate-600 text-sm">
                              {etiquetaEntidadPerfil[log.entidad] ?? log.entidad?.replace(/_/g, ' ') ?? '—'}
                            </td>
                            <td className="py-4 px-6 text-slate-500 text-xs max-w-xs truncate">
                              {log.cambios_resumidos || '—'}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No hay actividad reciente registrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
};
