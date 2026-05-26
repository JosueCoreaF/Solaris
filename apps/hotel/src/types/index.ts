// ============================================================================
// TIPOS Y INTERFACES - Frontend
// ============================================================================

export type HabitacionEstado = 'activo' | 'inactivo' | 'en_mantenimiento';
export type EstadoReserva = 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
export type Moneda = 'USD' | 'HNL';

// Habitación
export interface Habitacion {
  id_habitacion: string;
  id_hotel: string;
  numero_habitacion: string;
  tipo_habitacion: string;
  estado: HabitacionEstado;
  capacidad_personas: number;
  precio_noche_usd: number;
  precio_noche_hnl: number;
  created_at: string;
  updated_at: string;
}

// Reserva
export interface Reserva {
  id_reserva: string;
  id_habitacion: string;
  id_huesped: string;
  check_in: string;
  check_out: string;
  estado: EstadoReserva;
  total_reserva: number;
  moneda_pago: Moneda;
  notas?: string;
  created_at: string;
  updated_at: string;
}

// Configuración Hotelera
export interface ConfiguracionHotelera {
  id_config: string;
  id_hotel: string;
  tipo_cambio_base: number;
  moneda_base: Moneda;
  nombre_hotel: string;
  ciudad: string;
  pais: string;
  created_at: string;
  updated_at: string;
}

// Respuesta de API
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
