import { supabase } from './supabase';

const API_BASE = 'http://localhost:4000/api/config';

// Helper centralizado para inyectar token de autorización y cabecera de hotel activo
async function fetchWithHotel(url: string, options?: RequestInit) {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '2816eaed-e555-44b1-a7dc-f5772e4784de';
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
export async function obtenerTiposHabitacion() {
  try {
    const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('Error obtaining room types:', error);
    throw error;
  }
}

export async function crearTipoHabitacion(tipo: {
  nombre: string;
  descripcion: string;
  precio_base: number;
  id_hotel?: string;
}) {
  try {
    const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion`, {
      method: 'POST',
      body: JSON.stringify(tipo),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('Error creating room type:', error);
    throw error;
  }
}

export async function actualizarTipoHabitacion(
  id: string,
  tipo: {
    nombre: string;
    descripcion: string;
    precio_base: number;
  }
) {
  try {
    const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tipo),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('Error updating room type:', error);
    throw error;
  }
}

export async function eliminarTipoHabitacion(id: string) {
  try {
    const response = await fetchWithHotel(`${API_BASE}/tipos-habitacion/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error deleting room type:', error);
    throw error;
  }
}

// Amenidades
export async function obtenerAmenidades() {
  try {
    const response = await fetchWithHotel(`${API_BASE}/amenidades`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('Error obtaining amenities:', error);
    throw error;
  }
}

export async function actualizarAmenidad(
  id: string,
  activa: boolean
) {
  try {
    const response = await fetchWithHotel(`${API_BASE}/amenidades/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ activa }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data || result;
  } catch (error) {
    console.error('Error updating amenity:', error);
    throw error;
  }
}

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
