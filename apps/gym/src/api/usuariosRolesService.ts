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
  rol: string;
  estado: 'activo' | 'inactivo' | 'suspendido' | 'pendiente';
  creado_en: string;
  actualizado_en: string;
}

export const obtenerPersonal = async (idGimnasio: string): Promise<UsuarioRol[]> => {
  try {
    const { data, error } = await supabase
      .from('usuarios_roles_gym_con_email')
      .select('*')
      .eq('id_hotel', idGimnasio)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return (data as any[]) || [];
  } catch (err) {
    console.error('Error al obtener personal:', err);
    return [];
  }
};

// Activa, suspende o desactiva a un colaborador
export const cambiarEstadoUsuario = async (user_id: string, estado: string): Promise<{ ok: boolean; error?: string }> => {
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
