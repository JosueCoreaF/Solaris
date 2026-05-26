import { supabase } from '../api/supabase';
import { Reserva, Habitacion } from '../types';

// Servicios directos a Supabase (cuando no usamos el backend)

export const supabaseReservasService = {
  async getAll() {
    const { data, error } = await supabase
      .from('reservas_hotel')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Reserva[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('reservas_hotel')
      .select('*')
      .eq('id_reserva', id)
      .single();
    
    if (error) throw error;
    return data as Reserva;
  },

  async create(reserva: Partial<Reserva>) {
    const { data, error } = await supabase
      .from('reservas_hotel')
      .insert([reserva])
      .select()
      .single();
    
    if (error) throw error;
    return data as Reserva;
  },

  async update(id: string, updates: Partial<Reserva>) {
    const { data, error } = await supabase
      .from('reservas_hotel')
      .update(updates)
      .eq('id_reserva', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Reserva;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('reservas_hotel')
      .delete()
      .eq('id_reserva', id);
    
    if (error) throw error;
  },
};

export const supabaseHabitacionesService = {
  async getAll() {
    const { data, error } = await supabase
      .from('habitaciones_hotel')
      .select('*')
      .order('numero_habitacion', { ascending: true });
    
    if (error) throw error;
    return data as Habitacion[];
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('habitaciones_hotel')
      .select('*')
      .eq('id_habitacion', id)
      .single();
    
    if (error) throw error;
    return data as Habitacion;
  },

  async create(habitacion: Partial<Habitacion>) {
    const { data, error } = await supabase
      .from('habitaciones_hotel')
      .insert([habitacion])
      .select()
      .single();
    
    if (error) throw error;
    return data as Habitacion;
  },

  async update(id: string, updates: Partial<Habitacion>) {
    const { data, error } = await supabase
      .from('habitaciones_hotel')
      .update(updates)
      .eq('id_habitacion', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Habitacion;
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('habitaciones_hotel')
      .delete()
      .eq('id_habitacion', id);
    
    if (error) throw error;
  },
};
