import { supabase } from './supabase';
import type { ReservaMesa } from '../types';

export async function getReservas(idRestaurant: string): Promise<ReservaMesa[]> {
  const { data, error } = await supabase
    .from('reserva')
    .select('*, cliente_restaurante(*), mesa_restaurante(*)')
    .eq('id_restaurant', idRestaurant)
    .order('fecha_reserva', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getReservasHoy(idRestaurant: string): Promise<ReservaMesa[]> {
  const hoy = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('reserva')
    .select('*, cliente_restaurante(*), mesa_restaurante(*)')
    .eq('id_restaurant', idRestaurant)
    .eq('fecha_reserva', hoy)
    .order('hora_reserva');
  if (error) throw error;
  return data ?? [];
}

export async function createReserva(payload: Omit<ReservaMesa, 'id_reserva' | 'cliente_restaurante' | 'mesa_restaurante'>): Promise<ReservaMesa> {
  const { data, error } = await supabase
    .from('reserva')
    .insert(payload)
    .select('*, cliente_restaurante(*), mesa_restaurante(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateReserva(id: string, payload: Partial<ReservaMesa>): Promise<ReservaMesa> {
  const { id_reserva: _, cliente_restaurante: __, mesa_restaurante: ___, ...rest } = payload as any;
  const { data, error } = await supabase
    .from('reserva')
    .update(rest)
    .eq('id_reserva', id)
    .select('*, cliente_restaurante(*), mesa_restaurante(*)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteReserva(id: string): Promise<void> {
  const { error } = await supabase.from('reserva').delete().eq('id_reserva', id);
  if (error) throw error;
}
