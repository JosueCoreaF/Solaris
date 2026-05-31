// ============================================================================
// TIPOS FRONTEND — alineados con database/schema.sql
// ============================================================================

// ── Enumeraciones ─────────────────────────────────────────────────────────────

export type HabitacionEstado   = 'disponible' | 'ocupada' | 'mantenimiento' | 'bloqueada' | 'limpieza';
export type EstadoReserva      = 'pendiente' | 'confirmada' | 'cancelada' | 'check_in' | 'check_out' | 'no_show';
export type EstadoPago         = 'pagado' | 'cortesia' | 'credito' | 'deuda' | 'abonada';
export type MetodoPago         = 'efectivo' | 'tarjeta' | 'transferencia' | 'deposito' | 'canje' | 'otro';
export type Moneda             = 'USD' | 'HNL';
export type TipoReserva        = 'noche' | 'hora' | 'pasadia';

// ── Habitación ────────────────────────────────────────────────────────────────

export interface Habitacion {
  id_habitacion:       string;
  owner_id:            string;
  id_hotel:            string;
  id_tipo_habitacion:  string;
  codigo_habitacion:   string;
  nombre_habitacion:   string;
  nombre_alias?:       string;
  piso?:               number;
  capacidad:           number;
  numero_camas:        number;
  tarifa_noche:        number;
  imagen_360?:         string;
  estado:              HabitacionEstado;
  created_at:          string;
  updated_at:          string;
  // Joins enriquecidos
  tipo?:               string;
  comodidades?:        string[];
  imagenes?:           string[];
  hotel?:              string;
}

// ── Reserva ───────────────────────────────────────────────────────────────────

export interface Reserva {
  id_reserva_hotel:  string;
  owner_id:          string;
  id_huesped:        string;
  id_hotel:          string;
  id_habitacion:     string;
  id_empresa?:       string;
  check_in:          string;
  check_out:         string;
  adultos:           number;
  ninos:             number;
  estado:            EstadoReserva;
  estado_display?:   string;
  tipo_reserva:      TipoReserva;
  total_reserva:     number;
  moneda:            Moneda;
  estado_pago:       EstadoPago;
  anticipo:          number;
  es_cortesia:       boolean;
  observaciones?:    string;
  created_at?:       string;
  // Joins
  huesped?:          string;
  habitacion?:       string;
  hotel?:            string;
  pagos?:            Pago[];
  noches?:           number;
}

// ── Pago ──────────────────────────────────────────────────────────────────────

export interface Pago {
  id_pago_hotel:           string;
  owner_id:                string;
  id_reserva_hotel:        string;
  monto:                   number;
  monto_en_moneda_reserva: number;
  metodo_pago:             MetodoPago;
  referencia?:             string;
  moneda:                  Moneda;
  estado:                  'registrado' | 'aplicado' | 'anulado';
  notas?:                  string;
  fecha_pago:              string;
  created_at?:             string;
}

// ── Configuración Hotelera ────────────────────────────────────────────────────

export interface ConfiguracionHotelera {
  id_config:                   string;
  owner_id:                    string;
  id_hotel:                    string;
  hora_check_in:               string;
  hora_check_out:              string;
  moneda:                      Moneda;
  moneda_alterna?:             string;
  tipo_cambio_base?:           number;
  tipo_cambio_actualizado_en?: string;
  porcentaje_impuesto?:        number;
  tasa_turistica?:             number;
  descuento_tercera_edad?:     number;
  edad_tercera_edad?:          number;
  permite_sobreventa:          boolean;
  auto_confirmar_pagos?:       boolean;
  horas_anticipacion_reserva?: number;
  umbral_ocupacion?:           number;
  orientacion_calendario?:     string;
  nombre_red_hoteles?:         string;
  ciudad_base?:                string;
  created_at:                  string;
  updated_at:                  string;
}

// ── Respuesta de API ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?:    T;
  error?:   string;
  message?: string;
}
