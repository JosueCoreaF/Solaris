import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface PlanMembresia {
  id_plan: string;
  id_gimnasio: string;
  nombre: string;
  descripcion?: string;
  duracion_dias: number;
  precio: number;
  acceso_clases: boolean;
  acceso_gym: boolean;
  activo: boolean;
  created_at: string;
}

export interface InscripcionGym {
  id_inscripcion: string;
  id_gimnasio: string;
  id_miembro: string;
  id_plan: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'activa' | 'vencida' | 'cancelada' | 'congelada';
  estado_pago: 'pagado' | 'deuda' | 'cortesia' | 'abonada';
  total: number;
  anticipo: number;
  notas?: string;
  created_at: string;
  miembros?: { nombre_completo: string; correo: string };
  planes_membresia?: { nombre: string; duracion_dias: number; precio: number };
}

export const fetchPlanes = async (id_gimnasio?: string): Promise<PlanMembresia[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const gimnasioId = id_gimnasio ?? ctx.gimnasioId;
  const { data, error } = await supabase
    .from('planes_membresia')
    .select('*')
    .eq('id_gimnasio', gimnasioId)
    .eq('activo', true)
    .order('precio');
  if (error) throw error;
  return data ?? [];
};

export const fetchAllPlanes = async (): Promise<PlanMembresia[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('planes_membresia')
    .select('*')
    .eq('id_gimnasio', ctx.gimnasioId)
    .order('precio');
  if (error) throw error;
  return data ?? [];
};

export const crearPlan = async (plan: Partial<PlanMembresia>): Promise<PlanMembresia> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { data, error } = await supabase
    .from('planes_membresia')
    .insert({ ...plan, id_gimnasio: ctx.gimnasioId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const actualizarPlan = async (id: string, updates: Partial<PlanMembresia>): Promise<PlanMembresia> => {
  const { data, error } = await supabase
    .from('planes_membresia')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id_plan', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const fetchInscripciones = async (): Promise<InscripcionGym[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('inscripciones_gym')
    .select('*, miembros(nombre_completo, correo), planes_membresia(nombre, duracion_dias, precio)')
    .eq('id_gimnasio', ctx.gimnasioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const crearInscripcion = async (insc: Partial<InscripcionGym>): Promise<InscripcionGym> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { data, error } = await supabase
    .from('inscripciones_gym')
    .insert({ ...insc, id_gimnasio: ctx.gimnasioId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const actualizarInscripcion = async (id: string, updates: Partial<InscripcionGym>): Promise<InscripcionGym> => {
  const { data, error } = await supabase
    .from('inscripciones_gym')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id_inscripcion', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};
