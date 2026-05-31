import { supabase } from './supabase';

const API_BASE = 'http://localhost:4000/api/config';

// Helper centralizado para inyectar token de autorización y cabecera de hotel activo
async function fetchWithHotel(url: string, options?: RequestInit) {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Hotel-ID': activeHotelId,
      ...options?.headers,
    },
  });
}

// Configuración Hotelera
export async function obtenerConfigHotelera(hotelId?: string) {
  try {
    const headers: Record<string, string> = {};
    if (hotelId) {
      headers['X-Hotel-ID'] = hotelId;
    }
    const response = await fetchWithHotel(`${API_BASE}/hotelera`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error obtaining hotel config:', error);
    throw error;
  }
}

export async function actualizarConfigHotelera(config: {
  moneda_principal: string;
  moneda_alterna?: string;
  tipo_cambio_base: number;
  tasa_isv?: number;
  tasa_turistica?: number;
  nombre_red_hoteles?: string;
  hora_checkin?: string;
  hora_checkout?: string;
  descuento_tercera_edad?: number;
  edad_tercera_edad?: number;
  permite_sobreventa?: boolean;
  auto_confirmar_pagos?: boolean;
  permitir_edicion_personal?: boolean;
  horas_anticipacion_reserva?: number;
  umbral_ocupacion?: number;
  orientacion_calendario?: string;
  ciudad_base?: string;
}, hotelId?: string) {
  try {
    const headers: Record<string, string> = {};
    if (hotelId) {
      headers['X-Hotel-ID'] = hotelId;
    }
    const response = await fetchWithHotel(`${API_BASE}/hotelera`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error updating hotel config:', error);
    throw error;
  }
}

// Tipos de Habitación
export interface TipoHabitacion {
  id: string;
  nombre: string;
  descripcion: string;
  capacidad_base: number;
  estado: 'activo' | 'inactivo';
}

export async function obtenerTiposHabitacion(): Promise<TipoHabitacion[]> {
  const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion`, { method: 'GET' });
  if (!response.ok) throw new Error(response.statusText);
  const result = await response.json();
  return result.data || result;
}

export async function crearTipoHabitacion(tipo: Omit<TipoHabitacion, 'id'>): Promise<TipoHabitacion> {
  const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion`, {
    method: 'POST',
    body: JSON.stringify(tipo),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || response.statusText);
  }
  const result = await response.json();
  return result.data || result;
}

export async function actualizarTipoHabitacion(id: string, tipo: Partial<Omit<TipoHabitacion, 'id'>>): Promise<TipoHabitacion> {
  const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion/${id}`, {
    method: 'PUT',
    body: JSON.stringify(tipo),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || response.statusText);
  }
  const result = await response.json();
  return result.data || result;
}

export async function eliminarTipoHabitacion(id: string): Promise<void> {
  const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || response.statusText);
  }
}

// Servicios de habitación
export interface Servicio {
  id: string;
  nombre: string;
  icono: string;
  es_acumulable: boolean;
  cantidad_total: number;
}

export async function obtenerServicios(): Promise<Servicio[]> {
  const response = await fetchWithHotel(`${API_BASE}/servicios`, { method: 'GET' });
  if (!response.ok) throw new Error(response.statusText);
  const result = await response.json();
  return result.data || result;
}

export async function crearServicio(s: Omit<Servicio, 'id'>): Promise<Servicio> {
  const response = await fetchWithHotel(`${API_BASE}/servicios`, {
    method: 'POST',
    body: JSON.stringify(s),
  });
  if (!response.ok) throw new Error(response.statusText);
  const result = await response.json();
  return result.data || result;
}

export async function actualizarServicio(id: string, s: Partial<Omit<Servicio, 'id'>>): Promise<Servicio> {
  const response = await fetchWithHotel(`${API_BASE}/servicios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(s),
  });
  if (!response.ok) throw new Error(response.statusText);
  const result = await response.json();
  return result.data || result;
}

export async function eliminarServicio(id: string): Promise<void> {
  const response = await fetchWithHotel(`${API_BASE}/servicios/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(response.statusText);
  return response.json();
  // legacy aliases kept for backward compat
}

// Legacy aliases (no eliminar — aún importados en Config.tsx hasta que se migre)
export const obtenerAmenidades = obtenerServicios;
export const crearAmenidad = (a: { nombre: string; descripcion: string }) =>
  crearServicio({ nombre: a.nombre, icono: a.descripcion || '', es_acumulable: false, cantidad_total: 0 });
export const actualizarAmenidad = (id: string, u: any) => actualizarServicio(id, u);
export const eliminarAmenidad = eliminarServicio;



// Parámetros de Reserva
export async function actualizarParametrosReserva(params: {
  hora_checkin: string;
  hora_checkout: string;
  dias_minimos_reserva: number;
  dias_maximos_reserva: number;
}, hotelId?: string) {
  try {
    const headers: Record<string, string> = {};
    if (hotelId) {
      headers['X-Hotel-ID'] = hotelId;
    }
    const response = await fetchWithHotel(`${API_BASE}/parametros-reserva`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error updating reservation parameters:', error);
    throw error;
  }
}

// Hoteles
export async function obtenerHoteles() {
  try {
    const response = await fetchWithHotel(`${API_BASE}/hoteles`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error obtaining hotels:', error);
    throw error;
  }
}

export async function registrarHotel(hotel: {
  nombre_hotel: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  correo_contacto?: string;
  estrellas?: number;
  enlace_google_maps?: string;
}) {
  try {
    const response = await fetchWithHotel(`${API_BASE}/hoteles`, {
      method: 'POST',
      body: JSON.stringify(hotel),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error registering hotel:', error);
    throw error;
  }
}

export async function actualizarHotel(id: string, hotel: {
  nombre_hotel: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  correo_contacto?: string;
  estrellas?: number;
  enlace_google_maps?: string;
}) {
  try {
    const response = await fetchWithHotel(`${API_BASE}/hoteles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(hotel),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating hotel:', error);
    throw error;
  }
}
