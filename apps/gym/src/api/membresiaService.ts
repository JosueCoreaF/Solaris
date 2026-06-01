import { supabase } from './supabase';

export interface PlanMembresia {
  id_plan: string;
  owner_id: string;
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
  owner_id: string;
  id_miembro: string;
  id_gimnasio: string;
  id_plan: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'activa' | 'vencida' | 'cancelada' | 'congelada';
  estado_pago: 'pagado' | 'deuda' | 'cortesia';
  total: number;
  anticipo: number;
  notas?: string;
  created_at: string;
  miembros?: { nombre_completo: string; correo: string };
  planes_membresia?: { nombre: string; duracion_dias: number; precio: number };
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

export const fetchPlanes = async (id_gimnasio?: string): Promise<PlanMembresia[]> => {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  let query = supabase.from('planes_membresia').select('*').eq('owner_id', ownerId).eq('activo', true);
  if (id_gimnasio) query = query.eq('id_gimnasio', id_gimnasio);
  const { data, error } = await query.order('precio');
  if (error) throw error;
  return data ?? [];
};

export const crearPlan = async (plan: Partial<PlanMembresia>): Promise<PlanMembresia> => {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error('No owner_id');
  const { data, error } = await supabase
    .from('planes_membresia')
    .insert({ ...plan, owner_id: ownerId })
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
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('inscripciones_gym')
    .select('*, miembros(nombre_completo, correo), planes_membresia(nombre, duracion_dias, precio)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const crearInscripcion = async (insc: Partial<InscripcionGym>): Promise<InscripcionGym> => {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error('No owner_id');
  const { data, error } = await supabase
    .from('inscripciones_gym')
    .insert({ ...insc, owner_id: ownerId })
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
