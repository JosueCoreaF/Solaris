import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface Miembro {
  id_miembro: string;
  id_gimnasio: string;
  nombre_completo: string;
  correo: string;
  telefono?: string;
  documento_identidad?: string;
  fecha_nacimiento?: string;
  genero?: 'masculino' | 'femenino' | 'otro';
  direccion?: string;
  contacto_emergencia?: string;
  telefono_emergencia?: string;
  observaciones?: string;
  estado: 'activo' | 'inactivo' | 'suspendido';
  fecha_registro: string;
  created_at: string;
}

export const fetchMiembros = async (): Promise<Miembro[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('miembros')
    .select('*')
    .eq('id_gimnasio', ctx.gimnasioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const crearMiembro = async (miembro: Partial<Miembro>): Promise<Miembro> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { data, error } = await supabase
    .from('miembros')
    .insert({ ...miembro, id_gimnasio: ctx.gimnasioId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const actualizarMiembro = async (id: string, updates: Partial<Miembro>): Promise<Miembro> => {
  const { data, error } = await supabase
    .from('miembros')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id_miembro', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const eliminarMiembro = async (id: string): Promise<void> => {
  const { error } = await supabase.from('miembros').delete().eq('id_miembro', id);
  if (error) throw error;
};
