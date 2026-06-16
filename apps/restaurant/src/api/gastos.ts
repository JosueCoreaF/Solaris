import { supabase } from './supabase';
import type { PagoRest, CategoriaGastoRest } from '../types';

export async function getCategoriasGasto(idRestaurante: string): Promise<CategoriaGastoRest[]> {
  const { data, error } = await supabase
    .from('categorias_gasto_rest')
    .select('*')
    .eq('id_restaurante', idRestaurante)
    .order('nombre');
  if (error) throw error;
  return data ?? [];
}

export async function createCategoriaGasto(payload: Omit<CategoriaGastoRest, 'id_categoria'>): Promise<CategoriaGastoRest> {
  const { data, error } = await supabase
    .from('categorias_gasto_rest')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategoriaGasto(id: string): Promise<void> {
  const { error } = await supabase.from('categorias_gasto_rest').delete().eq('id_categoria', id);
  if (error) throw error;
}

export async function getPagos(idRestaurante: string): Promise<PagoRest[]> {
  const { data, error } = await supabase
    .from('pagos_rest')
    .select('*, categoria:categorias_gasto_rest(*)')
    .eq('id_restaurante', idRestaurante)
    .order('fecha_pago', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPago(payload: Omit<PagoRest, 'id_pago' | 'created_at' | 'categoria'>): Promise<PagoRest> {
  const { data, error } = await supabase
    .from('pagos_rest')
    .insert(payload)
    .select('*, categoria:categorias_gasto_rest(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deletePago(id: string): Promise<void> {
  const { error } = await supabase.from('pagos_rest').delete().eq('id_pago', id);
  if (error) throw error;
}
