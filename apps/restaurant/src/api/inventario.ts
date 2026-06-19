import { supabase } from './supabase';
import type { ProductoInventario, CategoriaInventario } from '../types';

export async function getProductos(idRestaurant: string): Promise<ProductoInventario[]> {
  const { data, error } = await supabase
    .from('producto')
    .select('*, categoria(*)')
    .eq('id_restaurant', idRestaurant)
    .order('nombre_producto');
  if (error) throw error;
  return data ?? [];
}

export async function createProducto(payload: Omit<ProductoInventario, 'id_producto' | 'categoria'>): Promise<ProductoInventario> {
  const { data, error } = await supabase
    .from('producto')
    .insert(payload)
    .select('*, categoria(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateProducto(id: string, payload: Partial<ProductoInventario>): Promise<ProductoInventario> {
  const { id_producto: _, categoria: __, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('producto')
    .update(rest)
    .eq('id_producto', id)
    .select('*, categoria(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProducto(id: string): Promise<void> {
  const { error } = await supabase.from('producto').delete().eq('id_producto', id);
  if (error) throw error;
}

export async function getCategoriasInventario(): Promise<CategoriaInventario[]> {
  const { data, error } = await supabase
    .from('categoria')
    .select('*')
    .order('categoria');
  if (error) throw error;
  return data ?? [];
}

export async function getInventarioStock(idRestaurant: string) {
  const { data, error } = await supabase
    .from('inventario')
    .select('*, producto!inner(*)')
    .eq('producto.id_restaurant', idRestaurant)
    .order('id_inventario');
  if (error) throw error;
  return data ?? [];
}

export async function upsertInventarioStock(idProducto: string, stockActual: number, stockMinimo: number) {
  const { data: existing } = await supabase
    .from('inventario')
    .select('id_inventario')
    .eq('id_producto', idProducto)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('inventario')
      .update({ stock_actual: stockActual, stock_minimo: stockMinimo, fecha_actualizacion: new Date().toISOString() })
      .eq('id_inventario', existing.id_inventario);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('inventario')
      .insert({ id_producto: idProducto, stock_actual: stockActual, stock_minimo: stockMinimo });
    if (error) throw error;
  }
}

export async function getRecetasPlatillo(idPlatillo: string) {
  const { data, error } = await supabase
    .from('receta_platillo')
    .select('*, inventario(*, producto(*))')
    .eq('id_platillo', idPlatillo)
    .order('id_rec_platillo');
  if (error) throw error;
  return data ?? [];
}

export async function getAllRecetasByPlatillos(idPlatillos: (string | number)[]) {
  if (!idPlatillos.length) return [];
  const { data, error } = await supabase
    .from('receta_platillo')
    .select('*, inventario(*, producto(*))')
    .in('id_platillo', idPlatillos)
    .order('id_rec_platillo');
  if (error) throw error;
  return data ?? [];
}

export async function createRecetaItem(payload: { id_platillo: string; id_inventario: string; cantidad_utilizada: number }) {
  const { data, error } = await supabase
    .from('receta_platillo')
    .insert(payload)
    .select('*, inventario(*, producto(*))')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRecetaItem(id: string): Promise<void> {
  const { error } = await supabase.from('receta_platillo').delete().eq('id_rec_platillo', id);
  if (error) throw error;
}
