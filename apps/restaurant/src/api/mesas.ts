import { supabase } from './supabase';
import type { Mesa, EstadoMesa } from '../types';

export async function getMesas(idRestaurant: string): Promise<Mesa[]> {
  const { data, error } = await supabase
    .from('mesa_restaurante')
    .select('*')
    .eq('id_restaurant', idRestaurant)
    .order('numero_mesa');
  if (error) throw error;
  return data ?? [];
}

export async function createMesa(payload: Omit<Mesa, 'id_mesa'>): Promise<Mesa> {
  const { data, error } = await supabase
    .from('mesa_restaurante')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMesa(id: string, payload: Partial<Mesa>): Promise<Mesa> {
  const { id_mesa: _, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('mesa_restaurante')
    .update(rest)
    .eq('id_mesa', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cambiarEstadoMesa(id: string, estado: EstadoMesa): Promise<Mesa> {
  return updateMesa(id, { estado });
}

export async function deleteMesa(id: string): Promise<void> {
  const { error } = await supabase.from('mesa_restaurante').delete().eq('id_mesa', id);
  if (error) throw error;
}
