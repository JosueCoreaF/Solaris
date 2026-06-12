import { supabase } from './supabase';

export interface Invitacion {
  id: string;
  email: string;
  codigo_unico: string;
  id_hotel: string;
  rol_sugerido: string;
  usado: boolean;
  user_id: string | null;
  created_at: string;
}

// Generar código único aleatorio (6 caracteres)
const generarCodigo = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Crear invitación y enviar correo vía backend (incluye envío de email automático)
export const crearInvitacion = async (email: string, id_hotel: string | null, rol_sugerido: string): Promise<Invitacion | null> => {
  try {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      console.error('No se pudo determinar la sesión activa');
      return null;
    }

    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    };
    if (id_hotel) headers['x-hotel-id'] = id_hotel;

    const res = await fetch(`${base}/hotel/usuarios/invitar`, {
      method: 'POST',
      headers,
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

// Obtener invitaciones por hotel
export const obtenerInvitacionesPorHotel = async (id_hotel: string): Promise<Invitacion[]> => {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('*')
    .eq('id_hotel', id_hotel)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener invitaciones:', error);
    return [];
  }

  return data || [];
};

// Obtener todas las invitaciones (sin filtro de hotel)
export const obtenerTodasInvitaciones = async (): Promise<Invitacion[]> => {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener invitaciones:', error);
    return [];
  }

  return data || [];
};

// Obtener solo invitaciones activas (no usadas)
export const obtenerInvitacionesActivas = async (): Promise<Invitacion[]> => {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('*')
    .eq('usado', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error al obtener invitaciones activas:', error);
    return [];
  }

  return data || [];
};

// Validar código de invitación (vía backend para evitar restricciones de RLS)
export const validarInvitacion = async (
  email: string,
  codigo: string,
): Promise<{ valida: boolean; id_hotel?: string; rol_sugerido?: string; owner_id?: string; razon?: string }> => {
  try {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
    const res = await fetch(`${base}/public/invitacion/validar`, {
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

// Marcar invitación como usada
export const marcarInvitacionComoUsada = async (codigo: string, user_id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('invitaciones')
    .update({ usado: true, user_id })
    .eq('codigo_unico', codigo);

  if (error) {
    console.error('Error al marcar invitación como usada:', error);
    return false;
  }

  return true;
};

// Eliminar invitación
export const eliminarInvitacion = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('invitaciones')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error al eliminar invitación:', error);
    return false;
  }

  return true;
};

// Resend invitación (generar nuevo código)
export const resendInvitacion = async (id: string): Promise<string | null> => {
  const codigo = generarCodigo();

  const { error } = await supabase
    .from('invitaciones')
    .update({ codigo_unico: codigo })
    .eq('id', id);

  if (error) {
    console.error('Error al resend invitación:', error);
    return null;
  }

  return codigo;
};
