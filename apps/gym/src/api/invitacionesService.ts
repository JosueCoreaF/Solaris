import { supabase } from './supabase';

export interface Invitacion {
  id: string;
  email: string;
  codigo_unico: string;
  id_module: string | null;
  rol_sugerido: string;
  usado: boolean;
  user_id: string | null;
  expira_en: string;
  created_at: string;
}

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function authHeaders() {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Crear invitación y enviar correo vía backend
export const crearInvitacion = async (email: string, rol_sugerido: string, gymId?: string): Promise<Invitacion | null> => {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}/gym/usuarios/invitar`, {
      method: 'POST',
      headers: gymId ? { ...headers, 'X-Gym-ID': gymId } : headers,
      body: JSON.stringify({ email, rol_sugerido }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Error al crear invitación:', err);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error('Error al crear invitación:', err);
    return null;
  }
};

// Obtener invitaciones del owner autenticado
export const obtenerInvitaciones = async (gymId?: string): Promise<Invitacion[]> => {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API}/gym/usuarios/invitaciones`, {
      headers: gymId ? { ...headers, 'X-Gym-ID': gymId } : headers,
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

// Validar código de invitación (público, vía backend)
export const validarInvitacion = async (
  email: string,
  codigo: string,
): Promise<{ valida: boolean; id_module?: string; rol_sugerido?: string; owner_id?: string; razon?: string }> => {
  try {
    const res = await fetch(`${API}/public/invitacion/validar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo }),
    });
    const data = await res.json();
    if (!res.ok) return { valida: false, razon: data.error };
    return data;
  } catch (err) {
    console.error('Error validando invitación:', err);
    return { valida: false, razon: 'Error de conexión' };
  }
};

// Completa el registro: crea el usuario (ya confirmado) y asigna su rol, vía backend
export const completarRegistro = async (params: {
  email: string;
  codigo: string;
  password: string;
  nombre: string;
}): Promise<{ success: boolean; user_id?: string; error?: string }> => {
  try {
    const res = await fetch(`${API}/public/invitacion/completar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return data;
  } catch (err: any) {
    console.error('Error completando registro:', err);
    return { success: false, error: err.message || 'Error de conexión' };
  }
};
