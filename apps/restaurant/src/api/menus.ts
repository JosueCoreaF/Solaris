import { supabase } from './supabase';
import type { Menu } from '../types';

export async function getMenus(idRestaurant: string): Promise<Menu[]> {
  const { data, error } = await supabase
    .from('menu')
    .select('*, menu_platillo(*, platillo(id_platillo, nombre_platillo, precio, activo))')
    .eq('id_restaurant', idRestaurant)
    .order('nombre_menu');
  if (error) throw error;
  return (data ?? []).map((m: any) => ({
    ...m,
    platillos: (m.menu_platillo ?? []).map((mp: any) => mp.platillo).filter(Boolean),
  }));
}

export async function createMenu(payload: Omit<Menu, 'id_menu' | 'platillos' | 'fecha_creacion'>): Promise<Menu> {
  const { data, error } = await supabase
    .from('menu')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return { ...data, platillos: [] };
}

export async function updateMenu(id: string, payload: Partial<Omit<Menu, 'id_menu' | 'platillos'>>): Promise<void> {
  const { error } = await supabase.from('menu').update(payload).eq('id_menu', id);
  if (error) throw error;
}

export async function deleteMenu(id: string): Promise<void> {
  const { error } = await supabase.from('menu').delete().eq('id_menu', id);
  if (error) throw error;
}

export async function setPlatillosMenu(idMenu: string, idPlatillos: string[]): Promise<void> {
  const { error: delErr } = await supabase.from('menu_platillo').delete().eq('id_menu', idMenu);
  if (delErr) throw delErr;
  if (idPlatillos.length === 0) return;
  const rows = idPlatillos.map(id => ({ id_menu: idMenu, id_platillo: id }));
  const { error } = await supabase.from('menu_platillo').insert(rows);
  if (error) throw error;
}
