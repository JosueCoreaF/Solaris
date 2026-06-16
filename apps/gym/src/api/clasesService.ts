import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface Entrenador {
  id_entrenador: string;
  id_gimnasio: string;
  nombre_completo: string;
  especialidad?: string;
  correo?: string;
  telefono?: string;
  estado: 'activo' | 'inactivo';
}

export interface ClaseGym {
  id_clase: string;
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

export const fetchClases = async (): Promise<ClaseGym[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('clases_gym')
    .select('*, entrenadores(nombre_completo, especialidad)')
    .eq('id_gimnasio', ctx.gimnasioId)
    .order('dia_semana')
    .order('hora_inicio');
  if (error) throw error;
  return data ?? [];
};

export const crearClase = async (clase: Partial<ClaseGym>): Promise<ClaseGym> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { data, error } = await supabase
    .from('clases_gym')
    .insert({ ...clase, id_gimnasio: ctx.gimnasioId })
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
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('entrenadores')
    .select('*')
    .eq('id_gimnasio', ctx.gimnasioId)
    .eq('estado', 'activo');
  if (error) throw error;
  return data ?? [];
};

export const crearEntrenador = async (e: Partial<Entrenador>): Promise<Entrenador> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { data, error } = await supabase
    .from('entrenadores')
    .insert({ ...e, id_gimnasio: ctx.gimnasioId })
    .select()
    .single();
  if (error) throw error;
  return data;
};
