// ============================================================================
// TIPOS Y MODELOS — alineados con database/schema.sql
// ============================================================================

// ── Enumeraciones ─────────────────────────────────────────────────────────────

export type HabitacionEstado   = 'disponible' | 'ocupada' | 'mantenimiento' | 'bloqueada' | 'limpieza';
export type EstadoReserva      = 'pendiente' | 'confirmada' | 'cancelada' | 'check_in' | 'check_out' | 'no_show';
export type EstadoPago         = 'pagado' | 'cortesia' | 'credito' | 'deuda' | 'abonada';
export type MetodoPago         = 'efectivo' | 'tarjeta' | 'transferencia' | 'deposito' | 'canje' | 'otro';
export type Moneda             = 'USD' | 'HNL';
export type TipoReserva        = 'noche' | 'hora' | 'pasadia';
export type EstadoOwner        = 'activo' | 'inactivo' | 'suspendido';
export type EstadoHotel        = 'activo' | 'inactivo' | 'mantenimiento';
export type TipoModulo         = 'hotel' | 'gym' | 'restaurant' | 'store';
export type RolUsuario         = 'PROPIETARIO' | 'ADMIN' | 'RECEPCIONISTA' | 'MANTENIMIENTO' | 'CONTADOR' | 'MESERO' | 'COCINA' | 'ENTRENADOR' | 'VENDEDOR';
export type EstadoUsuarioRol   = 'activo' | 'inactivo' | 'suspendido' | 'pendiente_aprobacion';

// ── Owner ─────────────────────────────────────────────────────────────────────

export interface Owner {
  id_owner:          string;
  nombre_empresa:    string;
  email_contacto:    string;
  telefono_contacto?: string;
  estado:            EstadoOwner;
  created_at:        string;
  updated_at:        string;
}

// ── Hotel ─────────────────────────────────────────────────────────────────────

export interface Hotel {
  id_hotel:           string;
  owner_id:           string;
  id_module:          string;
  nombre_hotel:       string;
  ciudad:             string;
  direccion:          string;
  telefono?:          string;
  correo_contacto?:   string;
  estrellas?:         number;
  estado:             EstadoHotel;
  enlace_google_maps?: string;
  slug?:              string;
  created_at:         string;
  updated_at:         string;
}

// ── Configuración Hotelera ────────────────────────────────────────────────────

export interface ConfiguracionHotelera {
  id_config:                  string;
  owner_id:                   string;
  id_hotel:                   string;
  hora_check_in:              string;   // 'HH:MM:SS'
  hora_check_out:             string;
  moneda:                     Moneda;
  moneda_alterna?:            string;
  tipo_cambio_base?:          number;
  tipo_cambio_actualizado_en?: string;
  porcentaje_impuesto?:       number;
  tasa_turistica?:            number;
  descuento_tercera_edad?:    number;
  edad_tercera_edad?:         number;
  permite_sobreventa:         boolean;
  auto_confirmar_pagos?:      boolean;
  permitir_edicion_personal?: boolean;
  horas_anticipacion_reserva?: number;
  umbral_ocupacion?:          number;
  orientacion_calendario?:    string;
  nombre_red_hoteles?:        string;
  ciudad_base?:               string;
  created_at:                 string;
  updated_at:                 string;
}

// ── Tipos de Habitación ───────────────────────────────────────────────────────

export interface TipoHabitacion {
  id_tipo_habitacion: string;
  owner_id:           string;
  nombre_tipo:        string;
  descripcion?:       string;
  capacidad_base?:    number;
  estado?:            'activo' | 'inactivo';
  created_at:         string;
  updated_at:         string;
}

// ── Habitación ────────────────────────────────────────────────────────────────

export interface Habitacion {
  id_habitacion:       string;
  owner_id:            string;
  id_hotel:            string;
  id_tipo_habitacion:  string;
  id_tarifa_default?:  string;
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
  // Joins enriquecidos (vista habitaciones_con_detalles)
  tipo?:               string;
  comodidades?:        string[];
  imagenes?:           string[];
  hotel?:              string;
}

// ── Huésped ───────────────────────────────────────────────────────────────────

export interface Huesped {
  id_huesped:          string;
  owner_id:            string;
  nombre_completo:     string;
  correo:              string;
  telefono?:           string;
  documento_identidad?: string;
  rtn?:                string;
  ciudad?:             string;
  direccion?:          string;
  fecha_registro:      string;
  created_at:          string;
  updated_at:          string;
}

// ── Empresa ───────────────────────────────────────────────────────────────────

export interface Empresa {
  id_empresa:        string;
  owner_id:          string;
  nombre:            string;
  rtn:               string;
  contacto_nombre?:  string;
  contacto_telefono?: string;
  contacto_correo?:  string;
  direccion?:        string;
  limite_credito:    number;
  dias_credito:      number;
  estado:            'activo' | 'inactivo' | 'suspendido';
  notas?:            string;
  created_at:        string;
  updated_at:        string;
}

// ── Reserva ───────────────────────────────────────────────────────────────────

export interface ReservaHotel {
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
  created_at:        string;
  updated_at:        string;
  // Joins
  huesped?:          string;
  habitacion?:       string;
  hotel?:            string;
  pagos?:            PagoHotel[];
}

// ── Pago ──────────────────────────────────────────────────────────────────────

export interface PagoHotel {
  id_pago_hotel:            string;
  owner_id:                 string;
  id_reserva_hotel:         string;
  monto:                    number;
  monto_en_moneda_reserva:  number;
  metodo_pago:              MetodoPago;
  referencia?:              string;
  moneda:                   Moneda;
  estado:                   'registrado' | 'aplicado' | 'anulado';
  notas?:                   string;
  fecha_pago:               string;
  created_at:               string;
  updated_at:               string;
}

// ── Servicio Adicional ────────────────────────────────────────────────────────

export interface ServicioAdicional {
  id_servicio:    string;
  owner_id:       string;
  nombre:         string;
  descripcion?:   string;
  precio_defecto: number;
  activo:         boolean;
  created_at:     string;
}

// ── Saldo Cliente ─────────────────────────────────────────────────────────────

export interface SaldoCliente {
  id_saldo:         string;
  owner_id:         string;
  id_huesped:       string;
  monto:            number;
  tipo:             'credito' | 'debito' | 'devolucion' | 'ajuste';
  descripcion:      string;
  aplicado:          boolean;
  fecha_aplicacion?: string;
  created_at:        string;
  updated_at:        string;
}

// ── Bloqueo Habitación ────────────────────────────────────────────────────────

export interface BloqueoHabitacion {
  id_bloqueo:    string;
  owner_id:      string;
  id_habitacion: string;
  fecha_inicio:  string;
  fecha_fin:     string;
  motivo:        string;
  created_at:    string;
  updated_at:    string;
}

// ── Factura ───────────────────────────────────────────────────────────────────

export interface Factura {
  id_factura:           string;
  owner_id:             string;
  id_hotel?:            string;
  fecha:                string;
  proveedor:            string;
  no_factura?:          string;
  rtn_proveedor?:       string;
  tipo:                 'general' | 'caja_chica';
  categoria_general_id?: number;
  categoria_chica_id?:  number;
  descripcion?:         string;
  subtotal?:            number;
  isv_15?:              number;
  isv_18?:              number;
  monto_total:          number;
  imagen_url?:          string;
  created_by?:          string;
  created_at:           string;
}

// ── Usuario Rol ───────────────────────────────────────────────────────────────

export interface UsuarioRol {
  id:              string;
  owner_id:        string;
  usuario_id:      string;
  id_module?:      string;
  tipo_negocio?:   TipoModulo;
  id_negocio?:     string;
  id_hotel?:       string;
  rol:             RolUsuario;
  estado:          EstadoUsuarioRol;
  creado_en:       string;
  actualizado_en:  string;
}

// ── Cotizaciones ──────────────────────────────────────────────────────────────

export interface Cotizacion {
  id_cotizacion:          string;
  id_hotel:               string;
  numero_cotizacion:      string;
  id_huesped?:            string;
  id_empresa?:            string;
  cliente_nombre:         string;
  cliente_identificacion?: string;
  cliente_correo:         string;
  cliente_telefono?:       string;
  fecha_emision:          string;
  fecha_vencimiento:      string;
  check_in:               string;
  check_out:              string;
  cant_noches:            number;
  adultos:                number;
  ninos:                  number;
  estado:                 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazada' | 'Expirada';
  subtotal:               number;
  impuesto_isv:           number;
  impuesto_turismo:       number;
  total:                  number;
  moneda:                 string;
  tipo_cambio:            number;
  clausula_no_fiscalidad?: string;
  politicas_cancelacion?:  string;
  vigencia_texto?:        string;
  cuentas_bancarias?:      string;
  notas?:                 string;
  owner_id:               string;
  created_at:             string;
  updated_at:             string;
  items?:                 CotizacionItem[];
}

export interface CotizacionItem {
  id_item:            string;
  id_cotizacion:      string;
  tipo_item:          'habitacion' | 'servicio';
  descripcion:        string;
  id_tipo_habitacion?: string;
  id_servicio?:        string;
  cantidad:           number;
  precio_unitario:    number;
  subtotal:           number;
  detalles_huespedes?: {
    adultos?: number;
    ninos?:   number;
  };
  created_at:         string;
}

// ── Respuesta API genérica ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?:    T;
  error?:   string;
  message?: string;
}
