import { supabase } from './supabase';

export interface Entrenador {
  id_entrenador: string;
  owner_id: string;
  id_gimnasio: string;
  nombre_completo: string;
  especialidad?: string;
  correo?: string;
  telefono?: string;
  estado: 'activo' | 'inactivo';
}

export interface ClaseGym {
  id_clase: string;
  owner_id: string;
  id_gimnasio: string;
  id_entrenador?: string;
  nombre_clase: string;
  descripcion?: string;
  dia_semana: 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';
  hora_inicio: string;
  hora_fin: string;
  capacidad_maxima: number;
  activa: boolean;
  entrenadores?: { nombre_completo: string; especialidad?: string };
}

const getOwnerId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: rol } = await supabase
    .from('usuarios_roles')
    .select('owner_id')
    .eq('usuario_id', data.user.id)
    .eq('estado', 'activo')
    .single();
  return rol?.owner_id ?? null;
};

export const fetchClases = async (): Promise<ClaseGym[]> => {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('clases_gym')
    .select('*, entrenadores(nombre_completo, especialidad)')
    .eq('owner_id', ownerId)
    .order('dia_semana')
    .order('hora_inicio');
  if (error) throw error;
  return data ?? [];
};

export const crearClase = async (clase: Partial<ClaseGym>): Promise<ClaseGym> => {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error('No owner_id');
  const { data, error } = await supabase
    .from('clases_gym')
    .insert({ ...clase, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const actualizarClase = async (id: string, updates: Partial<ClaseGym>): Promise<ClaseGym> => {
  const { data, error } = await supabase
    .from('clases_gym')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id_clase', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchEntrenadores = async (): Promise<Entrenador[]> => {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('entrenadores')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('estado', 'activo');
  if (error) throw error;
  return data ?? [];
};

export const crearEntrenador = async (e: Partial<Entrenador>): Promise<Entrenador> => {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error('No owner_id');
  const { data, error } = await supabase
    .from('entrenadores')
    .insert({ ...e, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data;
};
