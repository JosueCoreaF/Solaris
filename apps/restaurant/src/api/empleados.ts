import { supabase } from './supabase';
import type { EmpleadoRestaurante, CargoRestaurant } from '../types';

export async function getEmpleados(idRestaurant: string): Promise<EmpleadoRestaurante[]> {
  const { data, error } = await supabase
    .from('empleado_restaurante')
    .select('*, cargo_restaurant(*)')
    .eq('id_restaurant', idRestaurant)
    .order('apellido');
  if (error) throw error;
  return data ?? [];
}

export async function getCargos(): Promise<CargoRestaurant[]> {
  const { data, error } = await supabase
    .from('cargo_restaurant')
    .select('*')
    .order('nombre_cargo');
  if (error) throw error;
  return data ?? [];
}

export async function createEmpleado(payload: Omit<EmpleadoRestaurante, 'id_empleado_restaurante' | 'cargo_restaurant'>): Promise<EmpleadoRestaurante> {
  const { data, error } = await supabase
    .from('empleado_restaurante')
    .insert(payload)
    .select('*, cargo_restaurant(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmpleado(id: string, payload: Partial<EmpleadoRestaurante>): Promise<EmpleadoRestaurante> {
  const { id_empleado_restaurante: _, cargo_restaurant: __, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('empleado_restaurante')
    .update(rest)
    .eq('id_empleado_restaurante', id)
    .select('*, cargo_restaurant(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEmpleado(id: string): Promise<void> {
  const { error } = await supabase.from('empleado_restaurante').delete().eq('id_empleado_restaurante', id);
  if (error) throw error;
}
