-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  accion character varying NOT NULL CHECK (accion::text = ANY (ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying, 'LOGIN'::character varying, 'LOGOUT'::character varying, 'CREATE_USER'::character varying, 'CHANGE_ROLE'::character varying, 'APPLY_BALANCE'::character varying, 'CANCEL_PAYMENT'::character varying, 'CREATE_INVOICE'::character varying]::text[])),
  entidad character varying NOT NULL CHECK (entidad::text = ANY (ARRAY['reservas_hotel'::character varying, 'pagos_hotel'::character varying, 'huespedes'::character varying, 'saldos_clientes'::character varying, 'usuarios_roles'::character varying, 'auth_users'::character varying, 'habitaciones'::character varying, 'reportes_financieros'::character varying]::text[])),
  entidad_id uuid,
  usuario_id uuid,
  usuario_email character varying,
  usuario_rol character varying,
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  cambios_resumidos text,
  ip_cliente character varying,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.bloqueos_habitacion (
  id_bloqueo uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_habitacion uuid NOT NULL,
  fecha_inicio timestamp with time zone NOT NULL,
  fecha_fin timestamp with time zone NOT NULL,
  motivo text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bloqueos_habitacion_pkey PRIMARY KEY (id_bloqueo),
  CONSTRAINT bloqueos_habitacion_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT bloqueos_habitacion_id_habitacion_fkey FOREIGN KEY (id_habitacion) REFERENCES public.habitaciones(id_habitacion)
);
CREATE TABLE public.business_modules (
  id_module uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tipo_modulo character varying NOT NULL CHECK (tipo_modulo::text = ANY (ARRAY['hotel'::character varying, 'gym'::character varying, 'restaurant'::character varying, 'store'::character varying]::text[])),
  nombre_modulo character varying NOT NULL,
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying, 'mantenimiento'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT business_modules_pkey PRIMARY KEY (id_module),
  CONSTRAINT business_modules_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.categorias_tarifa (
  id_categoria uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nombre character varying NOT NULL CHECK (nombre::text = ANY (ARRAY['Normal'::character varying, 'Corporativa'::character varying, 'Especial'::character varying]::text[])),
  descripcion text,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categorias_tarifa_pkey PRIMARY KEY (id_categoria),
  CONSTRAINT categorias_tarifa_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.chat_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  channel_type character varying DEFAULT 'general'::character varying CHECK (channel_type::text = ANY (ARRAY['general'::character varying, 'hotel'::character varying, 'operativo'::character varying, 'cliente'::character varying, 'privado'::character varying]::text[])),
  id_huesped uuid,
  created_by character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT chat_channels_pkey PRIMARY KEY (id),
  CONSTRAINT chat_channels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT chat_channels_id_huesped_fkey FOREIGN KEY (id_huesped) REFERENCES public.huespedes(id_huesped)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  sender_id character varying NOT NULL,
  sender_name character varying NOT NULL,
  content text NOT NULL CHECK (length(content) <= 4000),
  message_type character varying DEFAULT 'text'::character varying CHECK (message_type::text = ANY (ARRAY['text'::character varying, 'data_card'::character varying, 'system'::character varying, 'file'::character varying]::text[])),
  file_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id)
);
CREATE TABLE public.chat_references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  message_id uuid NOT NULL,
  entity_type character varying NOT NULL CHECK (entity_type::text = ANY (ARRAY['reserva'::character varying, 'pago'::character varying, 'huesped'::character varying, 'habitacion'::character varying, 'factura'::character varying]::text[])),
  entity_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_references_pkey PRIMARY KEY (id),
  CONSTRAINT chat_references_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT chat_references_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id)
);
CREATE TABLE public.cierres_diarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  fecha date NOT NULL,
  id_hotel uuid NOT NULL,
  encargado_id uuid,
  encargado_nombre character varying,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cierres_diarios_pkey PRIMARY KEY (id),
  CONSTRAINT cierres_diarios_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT cierres_diarios_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel)
);
CREATE TABLE public.cierres_diarios_detalles (
  id_cierre_detalle uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_cierre uuid NOT NULL,
  tipo_registro character varying NOT NULL CHECK (tipo_registro::text = ANY (ARRAY['reserva'::character varying, 'pago'::character varying, 'habitacion'::character varying]::text[])),
  entidad_id uuid NOT NULL,
  monto_registrado numeric NOT NULL DEFAULT 0.00,
  estado_congelado character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cierres_diarios_detalles_pkey PRIMARY KEY (id_cierre_detalle),
  CONSTRAINT cierres_diarios_detalles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT cierres_diarios_detalles_id_cierre_fkey FOREIGN KEY (id_cierre) REFERENCES public.cierres_diarios(id)
);
CREATE TABLE public.configuracion_hotelera (
  id_config uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  hora_check_in time without time zone NOT NULL DEFAULT '15:00:00'::time without time zone,
  hora_check_out time without time zone NOT NULL DEFAULT '12:00:00'::time without time zone,
  moneda character varying NOT NULL DEFAULT 'USD'::character varying,
  porcentaje_impuesto numeric DEFAULT 0.00 CHECK (porcentaje_impuesto >= 0.00),
  permite_sobreventa boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tipo_cambio_actualizado_en timestamp with time zone,
  id_hotel uuid,
  moneda_alterna character varying DEFAULT 'USD'::character varying,
  tipo_cambio_base numeric DEFAULT 24.5000,
  tasa_turistica numeric DEFAULT 0.04,
  descuento_tercera_edad numeric DEFAULT 25.00,
  edad_tercera_edad integer DEFAULT 60,
  orientacion_calendario character varying DEFAULT 'vertical'::character varying,
  ciudad_base character varying DEFAULT 'San Pedro Sula'::character varying,
  horas_anticipacion_reserva integer DEFAULT 14,
  umbral_ocupacion integer DEFAULT 85,
  auto_confirmar_pagos boolean DEFAULT true,
  permitir_edicion_personal boolean DEFAULT true,
  nombre_red_hoteles character varying DEFAULT 'Hotel Verona'::character varying,
  CONSTRAINT configuracion_hotelera_pkey PRIMARY KEY (id_config),
  CONSTRAINT configuracion_hotelera_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT configuracion_hotelera_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel)
);
CREATE TABLE public.creditos_empresa (
  id_credito uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_empresa uuid NOT NULL,
  id_reserva_hotel uuid,
  tipo_movimiento character varying NOT NULL CHECK (tipo_movimiento::text = ANY (ARRAY['cargo'::character varying, 'abono'::character varying]::text[])),
  monto numeric NOT NULL CHECK (monto > 0.00),
  moneda character varying NOT NULL DEFAULT 'HNL'::character varying,
  descripcion text,
  referencia character varying,
  fecha_movimiento timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT creditos_empresa_pkey PRIMARY KEY (id_credito),
  CONSTRAINT creditos_empresa_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT creditos_empresa_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id_empresa),
  CONSTRAINT creditos_empresa_id_reserva_hotel_fkey FOREIGN KEY (id_reserva_hotel) REFERENCES public.reservas_hotel(id_reserva_hotel)
);
CREATE TABLE public.descuento_dias (
  id_descuento uuid NOT NULL,
  owner_id uuid NOT NULL,
  dia_semana character varying NOT NULL CHECK (dia_semana::text = ANY (ARRAY['lunes'::character varying, 'martes'::character varying, 'miercoles'::character varying, 'jueves'::character varying, 'viernes'::character varying, 'sabado'::character varying, 'domingo'::character varying]::text[])),
  CONSTRAINT descuento_dias_pkey PRIMARY KEY (id_descuento, dia_semana),
  CONSTRAINT descuento_dias_id_descuento_fkey FOREIGN KEY (id_descuento) REFERENCES public.descuentos_tarifa(id_descuento),
  CONSTRAINT descuento_dias_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.descuentos_tarifa (
  id_descuento uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_tarifa uuid NOT NULL,
  nombre character varying NOT NULL,
  descripcion text,
  tipo_descuento character varying NOT NULL CHECK (tipo_descuento::text = ANY (ARRAY['porcentaje'::character varying, 'fijo'::character varying]::text[])),
  valor numeric NOT NULL CHECK (valor >= 0.00),
  noches_minimas integer DEFAULT 1 CHECK (noches_minimas > 0),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT descuentos_tarifa_pkey PRIMARY KEY (id_descuento),
  CONSTRAINT descuentos_tarifa_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT descuentos_tarifa_id_tarifa_fkey FOREIGN KEY (id_tarifa) REFERENCES public.tarifas(id_tarifa)
);
CREATE TABLE public.empresas (
  id_empresa uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nombre character varying NOT NULL,
  rtn character varying NOT NULL,
  contacto_nombre character varying,
  contacto_telefono character varying,
  contacto_correo character varying,
  direccion text,
  limite_credito numeric DEFAULT 0.00 CHECK (limite_credito >= 0.00),
  dias_credito integer DEFAULT 30 CHECK (dias_credito > 0),
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying, 'suspendido'::character varying]::text[])),
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id_empresa),
  CONSTRAINT empresas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.facturas (
  id_factura uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  fecha date NOT NULL,
  proveedor text NOT NULL,
  no_factura text,
  rtn_proveedor text,
  tipo text NOT NULL DEFAULT 'general'::text CHECK (tipo = ANY (ARRAY['general'::text, 'caja_chica'::text])),
  categoria_general_id integer,
  categoria_chica_id integer,
  descripcion text,
  subtotal numeric DEFAULT 0,
  isv_15 numeric DEFAULT 0,
  isv_18 numeric DEFAULT 0,
  monto_total numeric NOT NULL,
  imagen_url text,
  created_at timestamp with time zone DEFAULT now(),
  created_by text,
  id_hotel uuid,
  CONSTRAINT facturas_pkey PRIMARY KEY (id_factura),
  CONSTRAINT facturas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT facturas_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel)
);
CREATE TABLE public.habitacion_comodidades (
  id_comodidad uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_habitacion uuid NOT NULL,
  nombre_comodidad character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habitacion_comodidades_pkey PRIMARY KEY (id_comodidad),
  CONSTRAINT habitacion_comodidades_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT habitacion_comodidades_id_habitacion_fkey FOREIGN KEY (id_habitacion) REFERENCES public.habitaciones(id_habitacion)
);
CREATE TABLE public.habitacion_imagenes (
  id_imagen uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_habitacion uuid NOT NULL,
  url_imagen text NOT NULL,
  orden integer DEFAULT 0 CHECK (orden >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habitacion_imagenes_pkey PRIMARY KEY (id_imagen),
  CONSTRAINT habitacion_imagenes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT habitacion_imagenes_id_habitacion_fkey FOREIGN KEY (id_habitacion) REFERENCES public.habitaciones(id_habitacion)
);
CREATE TABLE public.habitaciones (
  id_habitacion uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_tipo_habitacion uuid NOT NULL,
  id_hotel uuid NOT NULL,
  codigo_habitacion character varying NOT NULL,
  nombre_habitacion character varying NOT NULL,
  piso integer CHECK (piso >= 0),
  capacidad integer DEFAULT 1 CHECK (capacidad > 0),
  tarifa_noche numeric DEFAULT 0.00 CHECK (tarifa_noche >= 0.00),
  numero_camas integer DEFAULT 1 CHECK (numero_camas > 0),
  imagen_360 text,
  estado character varying DEFAULT 'disponible'::character varying CHECK (estado::text = ANY (ARRAY['disponible'::character varying, 'ocupada'::character varying, 'mantenimiento'::character varying, 'bloqueada'::character varying, 'limpieza'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT habitaciones_pkey PRIMARY KEY (id_habitacion),
  CONSTRAINT habitaciones_id_tipo_habitacion_fkey FOREIGN KEY (id_tipo_habitacion) REFERENCES public.tipos_habitacion(id_tipo_habitacion),
  CONSTRAINT habitaciones_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel),
  CONSTRAINT habitaciones_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.hoteles (
  id_hotel uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_module uuid,
  nombre_hotel character varying NOT NULL,
  ciudad character varying NOT NULL,
  direccion text NOT NULL,
  telefono character varying,
  correo_contacto character varying,
  estrellas integer DEFAULT 3 CHECK (estrellas >= 1 AND estrellas <= 5),
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying, 'mantenimiento'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  enlace_google_maps text,
  CONSTRAINT hoteles_pkey PRIMARY KEY (id_hotel),
  CONSTRAINT hoteles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT hoteles_id_module_fkey FOREIGN KEY (id_module) REFERENCES public.business_modules(id_module)
);
CREATE TABLE public.huespedes (
  id_huesped uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nombre_completo character varying NOT NULL,
  correo character varying NOT NULL CHECK (correo::text ~~ '%@%.%'::text),
  telefono character varying,
  documento_identidad character varying,
  rtn character varying,
  ciudad character varying,
  direccion text,
  fecha_registro timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT huespedes_pkey PRIMARY KEY (id_huesped),
  CONSTRAINT huespedes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.invitaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email character varying NOT NULL,
  codigo_unico character varying NOT NULL UNIQUE,
  id_hotel uuid,
  rol_sugerido character varying DEFAULT 'RECEPCIONISTA'::character varying CHECK (rol_sugerido::text = ANY (ARRAY['RECEPCIONISTA'::character varying, 'MANTENIMIENTO'::character varying, 'CONTADOR'::character varying, 'ADMIN'::character varying]::text[])),
  usado boolean NOT NULL DEFAULT false,
  usuario_id uuid,
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  actualizado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT invitaciones_pkey PRIMARY KEY (id),
  CONSTRAINT invitaciones_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT invitaciones_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel)
);
CREATE TABLE public.owners (
  id_owner uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre_empresa character varying NOT NULL,
  email_contacto character varying NOT NULL UNIQUE,
  telefono_contacto character varying,
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying, 'suspendido'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT owners_pkey PRIMARY KEY (id_owner)
);
CREATE TABLE public.pagos_hotel (
  id_pago_hotel uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_reserva_hotel uuid NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0.00),
  metodo_pago character varying NOT NULL CHECK (metodo_pago::text = ANY (ARRAY['efectivo'::character varying, 'tarjeta'::character varying, 'transferencia'::character varying, 'deposito'::character varying, 'canje'::character varying, 'otro'::character varying]::text[])),
  referencia character varying,
  fecha_pago timestamp with time zone NOT NULL DEFAULT now(),
  estado character varying NOT NULL DEFAULT 'registrado'::character varying CHECK (estado::text = ANY (ARRAY['registrado'::character varying, 'aplicado'::character varying, 'anulado'::character varying]::text[])),
  moneda character varying NOT NULL DEFAULT 'USD'::character varying,
  monto_en_moneda_reserva numeric NOT NULL CHECK (monto_en_moneda_reserva >= 0.00),
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pagos_hotel_pkey PRIMARY KEY (id_pago_hotel),
  CONSTRAINT pagos_hotel_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT pagos_hotel_id_reserva_hotel_fkey FOREIGN KEY (id_reserva_hotel) REFERENCES public.reservas_hotel(id_reserva_hotel)
);
CREATE TABLE public.reserva_servicios (
  id_reserva_hotel uuid NOT NULL,
  owner_id uuid NOT NULL,
  id_servicio uuid NOT NULL,
  cantidad integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0.00),
  CONSTRAINT reserva_servicios_pkey PRIMARY KEY (id_reserva_hotel, id_servicio),
  CONSTRAINT reserva_servicios_id_reserva_hotel_fkey FOREIGN KEY (id_reserva_hotel) REFERENCES public.reservas_hotel(id_reserva_hotel),
  CONSTRAINT reserva_servicios_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT reserva_servicios_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios_adicionales(id_servicio)
);
CREATE TABLE public.reservas_hotel (
  id_reserva_hotel uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_huesped uuid NOT NULL,
  id_hotel uuid NOT NULL,
  id_habitacion uuid NOT NULL,
  check_in timestamp with time zone NOT NULL,
  check_out timestamp with time zone NOT NULL,
  adultos integer NOT NULL DEFAULT 1 CHECK (adultos > 0),
  ninos integer NOT NULL DEFAULT 0 CHECK (ninos >= 0),
  estado character varying NOT NULL DEFAULT 'pendiente'::character varying CHECK (estado::text = ANY (ARRAY['pendiente'::character varying, 'confirmada'::character varying, 'cancelada'::character varying, 'check_in'::character varying, 'check_out'::character varying, 'no_show'::character varying]::text[])),
  total_reserva numeric NOT NULL DEFAULT 0.00 CHECK (total_reserva >= 0.00),
  moneda character varying NOT NULL DEFAULT 'USD'::character varying,
  estado_pago character varying NOT NULL DEFAULT 'deuda'::character varying CHECK (estado_pago::text = ANY (ARRAY['pagado'::character varying, 'cortesia'::character varying, 'credito'::character varying, 'deuda'::character varying, 'abonada'::character varying]::text[])),
  anticipo numeric NOT NULL DEFAULT 0.00 CHECK (anticipo >= 0.00),
  es_cortesia boolean NOT NULL DEFAULT false,
  id_empresa uuid,
  observaciones text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  estado_display character varying DEFAULT 'reservada'::character varying,
  tipo_reserva character varying DEFAULT 'noche'::character varying,
  CONSTRAINT reservas_hotel_pkey PRIMARY KEY (id_reserva_hotel),
  CONSTRAINT reservas_hotel_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT reservas_hotel_id_huesped_fkey FOREIGN KEY (id_huesped) REFERENCES public.huespedes(id_huesped),
  CONSTRAINT reservas_hotel_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel),
  CONSTRAINT reservas_hotel_id_habitacion_fkey FOREIGN KEY (id_habitacion) REFERENCES public.habitaciones(id_habitacion),
  CONSTRAINT reservas_hotel_id_empresa_fkey FOREIGN KEY (id_empresa) REFERENCES public.empresas(id_empresa)
);
CREATE TABLE public.saldos_clientes (
  id_saldo uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_huesped uuid NOT NULL,
  monto numeric NOT NULL,
  tipo character varying NOT NULL CHECK (tipo::text = ANY (ARRAY['credito'::character varying, 'debito'::character varying, 'devolucion'::character varying, 'ajuste'::character varying]::text[])),
  descripcion character varying NOT NULL DEFAULT ''::character varying,
  aplicado boolean NOT NULL DEFAULT false,
  fecha_creacion timestamp with time zone NOT NULL DEFAULT now(),
  fecha_aplicacion timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT saldos_clientes_pkey PRIMARY KEY (id_saldo),
  CONSTRAINT saldos_clientes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT saldos_clientes_id_huesped_fkey FOREIGN KEY (id_huesped) REFERENCES public.huespedes(id_huesped)
);
CREATE TABLE public.servicios_adicionales (
  id_servicio uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nombre character varying NOT NULL,
  descripcion text,
  precio_defecto numeric DEFAULT 0.00 CHECK (precio_defecto >= 0.00),
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT servicios_adicionales_pkey PRIMARY KEY (id_servicio),
  CONSTRAINT servicios_adicionales_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.tarifas (
  id_tarifa uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_tipo_habitacion uuid NOT NULL,
  id_categoria uuid NOT NULL,
  tarifa_noche numeric NOT NULL DEFAULT 0.00 CHECK (tarifa_noche >= 0.00),
  tarifa_hora numeric NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0.00),
  tarifa_pasadia numeric NOT NULL DEFAULT 0.00 CHECK (tarifa_pasadia >= 0.00),
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  activa boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_pkey PRIMARY KEY (id_tarifa),
  CONSTRAINT tarifas_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT tarifas_id_tipo_habitacion_fkey FOREIGN KEY (id_tipo_habitacion) REFERENCES public.tipos_habitacion(id_tipo_habitacion),
  CONSTRAINT tarifas_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categorias_tarifa(id_categoria)
);
CREATE TABLE public.tipo_cambio_historial (
  id_tipo_cambio uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  moneda_origen character varying NOT NULL,
  moneda_destino character varying NOT NULL,
  factor_conversion numeric NOT NULL CHECK (factor_conversion > 0.00),
  fecha_actualizacion timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tipo_cambio_historial_pkey PRIMARY KEY (id_tipo_cambio),
  CONSTRAINT tipo_cambio_historial_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.tipos_habitacion (
  id_tipo_habitacion uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nombre_tipo character varying NOT NULL,
  descripcion text,
  capacidad_base integer DEFAULT 1 CHECK (capacidad_base > 0),
  estado character varying DEFAULT 'activo'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying]::text[])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tipos_habitacion_pkey PRIMARY KEY (id_tipo_habitacion),
  CONSTRAINT tipos_habitacion_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);
CREATE TABLE public.usuarios_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  id_hotel uuid,
  rol character varying NOT NULL CHECK (rol::text = ANY (ARRAY['PROPIETARIO'::character varying, 'ADMIN'::character varying, 'RECEPCIONISTA'::character varying, 'MANTENIMIENTO'::character varying, 'CONTADOR'::character varying]::text[])),
  estado character varying DEFAULT 'pendiente_aprobacion'::character varying CHECK (estado::text = ANY (ARRAY['activo'::character varying, 'inactivo'::character varying, 'suspendido'::character varying, 'pendiente_aprobacion'::character varying]::text[])),
  creado_en timestamp with time zone NOT NULL DEFAULT now(),
  actualizado_en timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_roles_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_roles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT usuarios_roles_id_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel)
);

-- ═══════════════════════════════════════════════════════════
-- MÓDULO CHAT OPERATIVO
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.chat_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  channel_type character varying DEFAULT 'general'::character varying,
  id_huesped uuid,
  created_by character varying NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT chat_channels_pkey PRIMARY KEY (id),
  CONSTRAINT chat_channels_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT chat_channels_id_huesped_fkey FOREIGN KEY (id_huesped) REFERENCES public.huespedes(id_huesped)
);

CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  sender_id character varying NOT NULL,
  sender_name character varying NOT NULL,
  sender_avatar text,
  content text NOT NULL,
  message_type character varying,
  file_url text,
  file_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  edited_at timestamp with time zone,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT chat_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE
);

CREATE TABLE public.chat_references (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid,
  message_id uuid NOT NULL,
  entity_type character varying NOT NULL,
  entity_id uuid NOT NULL,
  entity_data jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT chat_references_pkey PRIMARY KEY (id),
  CONSTRAINT chat_references_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.chat_messages(id) ON DELETE CASCADE
);

CREATE TABLE public.chat_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid,
  user_id character varying NOT NULL,
  channel_id uuid NOT NULL,
  unread_count integer NOT NULL DEFAULT 0,
  last_read_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_read_status_pkey PRIMARY KEY (id),
  CONSTRAINT chat_read_status_user_channel_unique UNIQUE (user_id, channel_id),
  CONSTRAINT chat_read_status_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.chat_channels(id) ON DELETE CASCADE
);