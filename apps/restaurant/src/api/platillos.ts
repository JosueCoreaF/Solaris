import { supabase } from './supabase';
import type { Platillo, CategoriaPlatillo } from '../types';

export async function getPlatillos(idRestaurant: string): Promise<Platillo[]> {
  const { data, error } = await supabase
    .from('platillo')
    .select('*, categoria_platillo(*)')
    .eq('id_restaurant', idRestaurant)
    .order('nombre_platillo');
  if (error) throw error;
  return data ?? [];
}

export async function createPlatillo(payload: Omit<Platillo, 'id_platillo' | 'categoria_platillo'>): Promise<Platillo> {
  const { data, error } = await supabase
    .from('platillo')
    .insert(payload)
    .select('*, categoria_platillo(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlatillo(id: string, payload: Partial<Platillo>): Promise<Platillo> {
  const { id_platillo: _, categoria_platillo: __, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('platillo')
    .update(rest)
    .eq('id_platillo', id)
    .select('*, categoria_platillo(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlatillo(id: string): Promise<void> {
  const { error } = await supabase.from('platillo').delete().eq('id_platillo', id);
  if (error) throw error;
}

export async function getCategoriasPlatillo(): Promise<CategoriaPlatillo[]> {
  const { data, error } = await supabase
    .from('categoria_platillo')
    .select('*')
    .order('nombre_categoria');
  if (error) throw error;
  return data ?? [];
}

export async function createCategoriaPlatillo(payload: Omit<CategoriaPlatillo, 'id_categoria_platillo'>): Promise<CategoriaPlatillo> {
  const { data, error } = await supabase
    .from('categoria_platillo')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}
