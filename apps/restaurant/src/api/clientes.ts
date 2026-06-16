import { supabase } from './supabase';
import type { ClienteRestaurante } from '../types';

export async function getClientes(idRestaurant: string): Promise<ClienteRestaurante[]> {
  const { data, error } = await supabase
    .from('cliente_restaurante')
    .select('*')
    .eq('id_restaurant', idRestaurant)
    .order('apellido');
  if (error) throw error;
  return data ?? [];
}

export async function createCliente(payload: Omit<ClienteRestaurante, 'id_cliente'>): Promise<ClienteRestaurante> {
  const { data, error } = await supabase
    .from('cliente_restaurante')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCliente(id: string, payload: Partial<ClienteRestaurante>): Promise<ClienteRestaurante> {
  const { id_cliente: _, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('cliente_restaurante')
    .update(rest)
    .eq('id_cliente', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from('cliente_restaurante').delete().eq('id_cliente', id);
  if (error) throw error;
}
