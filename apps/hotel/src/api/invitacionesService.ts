import { supabase } from './supabase';

export interface Invitacion {
  id: string;
  email: string;
  codigo_unico: string;
  id_hotel: string;
  rol_sugerido: string;
  usado: boolean;
  user_id: string | null;
  creado_en: string;
  actualizado_en: string;
}

// Generar código único aleatorio (6 caracteres)
const generarCodigo = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Crear invitación (id_hotel puede ser opcional inicialmente)
export const crearInvitacion = async (email: string, id_hotel: string | null, rol_sugerido: string): Promise<Invitacion | null> => {
  // Validar que no exista una invitación activa para este email
  const { data: existentes, error: errCheck } = await supabase
    .from('invitaciones')
    .select('*')
    .eq('email', email)
    .eq('usado', false);

  if (!errCheck && existentes && existentes.length > 0) {
    console.error('Ya existe una invitación activa para este email');
    return null;
  }

  const codigo = generarCodigo();
  
  const { data, error } = await supabase
    .from('invitaciones')
    .insert([{ 
      email, 
      codigo_unico: codigo, 
      id_hotel: id_hotel || null, 
      rol_sugerido,
      usado: false 
    }])
    .select()
    .single();

  if (error) {
    console.error('Error al crear invitación:', error);
    return null;
  }

  return data;
};

// Obtener invitaciones por hotel
export const obtenerInvitacionesPorHotel = async (id_hotel: string): Promise<Invitacion[]> => {
  const { data, error } = await supabase
    .from('invitaciones')
    .select('*')
    .eq('id_hotel', id_hotel)
    .order('creado_en', { ascending: false });

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
    .order('creado_en', { ascending: false });

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
    .order('creado_en', { ascending: false });

  if (error) {
    console.error('Error al obtener invitaciones activas:', error);
    return [];
  }

  return data || [];
};

// Validar código de invitación
export const validarInvitacion = async (email: string, codigo: string): Promise<{ valida: boolean; id_hotel?: string; rol_sugerido?: string }> => {
  const { data, error } = await supabase
    .rpc('fn_validar_invitacion', { p_email: email, p_codigo: codigo });

  if (error || !data || data.length === 0) {
    return { valida: false };
  }

  return {
    valida: data[0].valida,
    id_hotel: data[0].id_hotel,
    rol_sugerido: data[0].rol_sugerido,
  };
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
