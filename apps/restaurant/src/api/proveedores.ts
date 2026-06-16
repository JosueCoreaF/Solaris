import { supabase } from './supabase';
import type { Proveedor, Compra } from '../types';

export async function getProveedores(idRestaurant: string): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from('proveedor')
    .select('*')
    .eq('id_restaurant', idRestaurant)
    .order('nombre_proveedor');
  if (error) throw error;
  return data ?? [];
}

export async function createProveedor(payload: Omit<Proveedor, 'id_proveedor'>): Promise<Proveedor> {
  const { data, error } = await supabase
    .from('proveedor')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProveedor(id: string, payload: Partial<Proveedor>): Promise<Proveedor> {
  const { id_proveedor: _, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('proveedor')
    .update(rest)
    .eq('id_proveedor', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProveedor(id: string): Promise<void> {
  const { error } = await supabase.from('proveedor').delete().eq('id_proveedor', id);
  if (error) throw error;
}

export async function getCompras(idRestaurant: string): Promise<Compra[]> {
  const { data, error } = await supabase
    .from('compra')
    .select('*, proveedor(*)')
    .eq('id_restaurant', idRestaurant)
    .order('fecha_compra', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCompra(payload: Omit<Compra, 'id_compra' | 'proveedor'>): Promise<Compra> {
  const { data, error } = await supabase
    .from('compra')
    .insert(payload)
    .select('*, proveedor(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function getDetalleCompra(idCompra: string) {
  const { data, error } = await supabase
    .from('detalle_compra')
    .select('*, producto(*)')
    .eq('id_compra', idCompra)
    .order('id_detalle_compra');
  if (error) throw error;
  return data ?? [];
}

export async function createDetalleCompra(payload: { id_compra: string; id_producto: string; cantidad: number; precio_unitario: number; subtotal: number }) {
  const { data, error } = await supabase
    .from('detalle_compra')
    .insert(payload)
    .select('*, producto(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDetalleCompra(id: string): Promise<void> {
  const { error } = await supabase.from('detalle_compra').delete().eq('id_detalle_compra', id);
  if (error) throw error;
}
