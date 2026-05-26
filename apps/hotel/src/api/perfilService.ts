import { supabase } from './supabase';

const API_BASE = 'http://localhost:4000/api/users';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  direccion?: string;
  foto_perfil_url?: string;
  tema: 'claro' | 'oscuro';
  idioma: 'es' | 'en';
  notificaciones_activas: boolean;
}

export interface SavedAccount {
  usuario_id: string;
  email: string;
  nombre: string;
  apellido: string;
  foto_perfil_url?: string;
  password?: string; // Contraseña guardada (solo si recordar_dispositivo=true)
}

export interface UserPreferences {
  tema: 'claro' | 'oscuro';
  idioma: 'es' | 'en';
  notificaciones_activas: boolean;
  login_automatico: boolean;
  recordar_dispositivo: boolean;
}

export interface ActivityLog {
  id: string;
  usuario_id: string;
  accion: string;
  tabla_afectada: string;
  valores_antiguos?: Record<string, any>;
  valores_nuevos?: Record<string, any>;
  timestamp: string;
}

// Obtener perfil del usuario autenticado
export async function obtenerPerfilUsuario() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('No authenticated user');
    }

    // TODO: Conectar con backend endpoint GET /api/users/profile
    // const response = await fetch(`${API_BASE}/profile`, {
    //   method: 'GET',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${user.session?.access_token || ''}`,
    //   },
    // });

    // Por ahora retornamos los datos del usuario autenticado
    return {
      id: user.id,
      email: user.email || '',
      nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || '',
      apellido: user.user_metadata?.apellido || '',
      telefono: user.user_metadata?.telefono || '',
      direccion: user.user_metadata?.direccion || '',
      foto_perfil_url: user.user_metadata?.foto_perfil_url || '',
      tema: user.user_metadata?.tema || 'claro',
      idioma: user.user_metadata?.idioma || 'es',
      notificaciones_activas: user.user_metadata?.notificaciones_activas !== false,
    };
  } catch (error) {
    console.error('Error obtaining user profile:', error);
    throw error;
  }
}

// Actualizar perfil del usuario
export async function actualizarPerfilUsuario(perfil: Partial<UserProfile>) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('No authenticated user');

    // Actualizar en auth.users metadata
    const { data, error } = await supabase.auth.updateUser({
      data: perfil,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Obtener preferencias del usuario desde la tabla preferencias_usuario o localStorage
export async function obtenerPreferenciasUsuario(): Promise<UserPreferences | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('No authenticated user');

    // Primero intentar obtener de BD
    const { data, error } = await supabase
      .from('preferencias_usuario')
      .select('tema, idioma, notificaciones_activas, login_automatico, recordar_dispositivo')
      .eq('usuario_id', user.id)
      .single();

    if (data) {
      return data;
    }

    // Si la tabla no existe, intentar cargar de localStorage
    if (error) {
      console.warn('No se encontró en BD, buscando en localStorage:', error.message);
      
      const localPrefs = localStorage.getItem('userPreferences');
      if (localPrefs) {
        try {
          const parsed = JSON.parse(localPrefs);
          console.log('✅ Preferencias cargadas desde localStorage:', parsed);
          return {
            tema: parsed.tema || 'claro',
            idioma: parsed.idioma || 'es',
            notificaciones_activas: parsed.notificaciones_activas !== false,
            login_automatico: parsed.login_automatico === true,
            recordar_dispositivo: parsed.recordar_dispositivo === true,
          };
        } catch (e) {
          console.error('Error parsing localStorage preferences:', e);
        }
      }

      // Valores por defecto si nada existe
      console.log('Usando preferencias por defecto');
      return {
        tema: 'claro',
        idioma: 'es',
        notificaciones_activas: true,
        login_automatico: false,
        recordar_dispositivo: false,
      };
    }

    return data;
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return null;
  }
}

// Guardar preferencias del usuario en la tabla preferencias_usuario
export async function guardarPreferenciasUsuario(preferencias: Partial<UserPreferences>) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('No authenticated user');

    // SIEMPRE guardar en localStorage como fallback
    const prefsToSave = {
      usuario_id: user.id,
      email: user.email, // Guardar email para "recordar dispositivo"
      ...preferencias,
      updated_at: new Date().toISOString(),
    };
    
    localStorage.setItem('userPreferences', JSON.stringify(prefsToSave));
    console.log('✅ Preferencias guardadas en localStorage:', prefsToSave);

    // Si recordar_dispositivo está habilitado, guardar la cuenta
    if (preferencias.recordar_dispositivo) {
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (!userError && currentUser) {
        const metadata = currentUser.user_metadata || {};
        guardarCuentaRecordada({
          usuario_id: currentUser.id,
          email: currentUser.email || '',
          nombre: metadata.nombre || '',
          apellido: metadata.apellido || '',
          foto_perfil_url: metadata.foto_perfil_url,
        });
      }
    }

    // Intentar guardar también en BD (pero no fallar si no existe tabla)
    try {
      const { error: bdError } = await supabase
        .from('preferencias_usuario')
        .upsert({
          usuario_id: user.id,
          ...preferencias,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (!bdError) {
        console.log('✅ Preferencias también guardadas en BD');
      }
    } catch (bdError) {
      console.warn('BD no disponible (tabla no existe aún), usando localStorage:', bdError);
    }

    // Si login_automatico está habilitado, guardar credenciales en localStorage
    if (preferencias.login_automatico) {
      const session = await supabase.auth.getSession();
      if (session.data.session) {
        const autoLoginData = {
          access_token: session.data.session.access_token,
          refresh_token: session.data.session.refresh_token,
          expires_at: session.data.session.expires_at,
          userId: user.id,
          email: user.email,
        };
        localStorage.setItem('autoLoginSession', JSON.stringify(autoLoginData));
        console.log('✅ Login automático habilitado - Credenciales guardadas');
      }
    } else {
      // Eliminar credenciales guardadas si se deshabilita
      localStorage.removeItem('autoLoginSession');
      console.log('🔓 Login automático deshabilitado');
    }

    return { success: true, message: '✅ Preferencias guardadas correctamente' };
  } catch (error) {
    console.error('Error saving preferences:', error);
    throw error;
  }
}

// Verificar y aplicar login automático
export async function aplicarLoginAutomatico(): Promise<boolean> {
  try {
    const autoLoginData = localStorage.getItem('autoLoginSession');
    if (!autoLoginData) return false;

    const { access_token, refresh_token } = JSON.parse(autoLoginData);

    // Intentar restablecer la sesión
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) {
      console.warn('Auto-login failed:', error);
      localStorage.removeItem('autoLoginSession');
      return false;
    }

    return !!data.session;
  } catch (error) {
    console.error('Error applying auto-login:', error);
    return false;
  }
}

// Obtener historial de actividad del usuario actual
export async function obtenerMiActividad(limite: number = 50) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('No authenticated user');
    }

    const { data, error } = await supabase
      .from('bitacora_actividad')
      .select('*')
      .eq('usuario_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(limite);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }
}

// Cambiar contraseña
export async function cambiarContraseña(nuevaContraseña: string) {
  try {
    if (nuevaContraseña.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    const { error } = await supabase.auth.updateUser({
      password: nuevaContraseña,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, message: 'Contraseña actualizada correctamente' };
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
}

// Obtener sesiones activas del usuario
export async function obtenerSesionesActivas() {
  try {
    // TODO: Implementar cuando Supabase proporcione esta funcionalidad
    const { data, error } = await supabase.auth.refreshSession();

    if (error) {
      throw new Error(error.message);
    }

    return [{ device: 'Current Device', lastActive: new Date().toISOString() }];
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
}

// Obtener permisos del usuario basado en su rol
export async function obtenerPermisosUsuario() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('No authenticated user');
    }

    // TODO: Conectar con backend endpoint GET /api/users/permissions
    // Obtener del usuario autenticado los permisos basado en su rol
    const { data, error } = await supabase
      .from('usuarios_roles')
      .select('rol')
      .eq('usuario_id', user.id)
      .single();

    if (error) {
      console.warn('No role found for user');
      return null;
    }

    return data?.rol || null;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return null;
  }
}

// Obtener todas las cuentas recordadas del navegador
export function obtenerCuentasRecordadas(): SavedAccount[] {
  try {
    const savedAccounts = localStorage.getItem('savedAccounts');
    if (savedAccounts) {
      const accounts = JSON.parse(savedAccounts);
      return Array.isArray(accounts) ? accounts : [];
    }
    return [];
  } catch (error) {
    console.error('Error getting saved accounts:', error);
    return [];
  }
}

// Guardar una cuenta para "recordar dispositivo"
export function guardarCuentaRecordada(account: SavedAccount) {
  try {
    const savedAccounts = obtenerCuentasRecordadas();
    
    // Evitar duplicados
    const index = savedAccounts.findIndex(a => a.email === account.email);
    if (index >= 0) {
      savedAccounts[index] = account; // Actualizar si ya existe
    } else {
      savedAccounts.push(account);
    }
    
    localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
    console.log('✅ Cuenta recordada:', account.email);
  } catch (error) {
    console.error('Error saving account:', error);
  }
}

// Eliminar una cuenta recordada
export function eliminarCuentaRecordada(email: string) {
  try {
    const savedAccounts = obtenerCuentasRecordadas();
    const filtered = savedAccounts.filter(a => a.email !== email);
    localStorage.setItem('savedAccounts', JSON.stringify(filtered));
    console.log('✅ Cuenta eliminada:', email);
  } catch (error) {
    console.error('Error deleting account:', error);
  }
}
