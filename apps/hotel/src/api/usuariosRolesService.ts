import { supabase } from './supabase';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function authHeaders() {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface UsuarioRol {
  id: string;
  user_id: string;
  id_hotel: string | null;
  owner_id: string;
  email: string;
  rol: 'PROPIETARIO' | 'ADMIN' | 'RECEPCIONISTA' | 'MANTENIMIENTO' | 'CONTADOR';
  estado: 'activo' | 'inactivo' | 'suspendido' | 'pendiente' | 'pendiente_aprobacion';
  creado_en: string;
  actualizado_en: string;
}

export interface AsignarRolParams {
  user_id: string;
  id_hotel?: string | null;
  rol: string;
  estado: string;
  owner_id?: string;
}

/**
 * Obtiene todos los usuarios con sus roles para un hotel
 */
export const obtenerUsuariosRoles = async (id_hotel: string): Promise<UsuarioRol[] | null> => {
  try {
    const { data, error } = await supabase
      .from('usuarios_roles_con_email')
      .select('*')
      .eq('id_hotel', id_hotel)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching usuarios_roles:', err);
    return null;
  }
};

/**
 * Obtiene un usuario específico con su rol
 */
export const obtenerUsuarioRol = async (usuario_id: string): Promise<UsuarioRol | null> => {
  try {
    const { data, error } = await supabase
      .from('usuarios_roles_con_email')
      .select('*')
      .eq('user_id', usuario_id)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching usuario_rol:', err);
    return null;
  }
};

/**
 * Asigna o actualiza un rol de usuario
 */
export const asignarRol = async (params: AsignarRolParams): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API}/roles/crear`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ user_id: params.user_id, id_hotel: params.id_hotel || null, rol: params.rol, estado: params.estado, owner_id: params.owner_id || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || res.statusText };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

/**
 * Cambia el estado de un usuario (activo/inactivo/suspendido)
 */
export const cambiarEstadoUsuario = async (user_id: string, _id_hotel: string | null, estado: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`${API}/roles/estado`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ user_id, estado }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || res.statusText };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
};

/**
 * Solicita crear un nuevo rol (estado: pendiente_aprobacion)
 */
export const solicitarRegistro = async (
  usuario_id: string,
  id_hotel: string,
  email: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('usuarios_roles').insert({
      user_id: usuario_id,
      id_hotel,
      rol: 'RECEPCIONISTA',
      estado: 'pendiente',
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error requesting registration:', err);
    return false;
  }
};

/**
 * Obtiene todos los usuarios del owner autenticado (via backend para evitar RLS)
 */
export const obtenerTodosLosUsuarios = async (): Promise<UsuarioRol[]> => {
  try {
    const res = await fetch(`${API}/roles/usuarios`, { headers: await authHeaders() });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Error fetching usuarios:', err);
    return [];
  }
};
