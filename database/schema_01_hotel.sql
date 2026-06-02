-- =============================================================================
-- SOLARIS — MÓDULO HOTEL (ejecutar después de schema_00_base.sql)
-- =============================================================================

-- ── Hoteles ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hoteles (
  id_hotel           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_module          uuid        NOT NULL REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  nombre_hotel       varchar     NOT NULL,
  ciudad             varchar     NOT NULL,
  direccion          text        NOT NULL,
  telefono           varchar,
  correo_contacto    varchar,
  estrellas          integer     DEFAULT 3 CHECK (estrellas BETWEEN 1 AND 5),
  estado             varchar     NOT NULL DEFAULT 'activo'
                       CHECK (estado IN ('activo','inactivo','mantenimiento')),
  enlace_google_maps text,
  slug               varchar     UNIQUE,
  logo_url           text,
  color_primario     varchar(7)  DEFAULT '#1c1917',
  color_secundario   varchar(7),
  redes_sociales     jsonb       DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hoteles_pkey PRIMARY KEY (id_hotel)
);

-- FK diferidas: audit_log, usuarios_roles e invitaciones → hoteles
ALTER TABLE public.audit_log    ADD CONSTRAINT IF NOT EXISTS audit_log_hotel_fkey    FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel);
ALTER TABLE public.usuarios_roles ADD CONSTRAINT IF NOT EXISTS uroles_hotel_fkey     FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel);
ALTER TABLE public.invitaciones   ADD CONSTRAINT IF NOT EXISTS invitaciones_hotel_fkey FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel);

-- Índices hotel
CREATE INDEX IF NOT EXISTS idx_uroles_hotel ON public.usuarios_roles (id_hotel) WHERE id_hotel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_hotel  ON public.audit_log (id_hotel);
CREATE INDEX IF NOT EXISTS idx_hotel_module ON public.hoteles (id_module);
CREATE INDEX IF NOT EXISTS idx_hotel_estado ON public.hoteles (estado);
CREATE INDEX IF NOT EXISTS idx_hotel_slug   ON public.hoteles (slug) WHERE slug IS NOT NULL;

-- ── Configuración hotelera ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.configuracion_hotelera (
  id_config                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel                    uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  hora_check_in               time        NOT NULL DEFAULT '15:00:00',
  hora_check_out              time        NOT NULL DEFAULT '12:00:00',
  moneda                      varchar     NOT NULL DEFAULT 'HNL',
  moneda_alterna              varchar     DEFAULT 'USD',
  tipo_cambio_base            numeric     DEFAULT 26.58,
  tipo_cambio_actualizado_en  timestamptz,
  porcentaje_impuesto         numeric     DEFAULT 0.15 CHECK (porcentaje_impuesto >= 0),
  tasa_turistica              numeric     DEFAULT 0.04,
  descuento_tercera_edad      numeric     DEFAULT 25.00,
  edad_tercera_edad           integer     DEFAULT 60,
  permite_sobreventa          boolean     NOT NULL DEFAULT false,
  auto_confirmar_pagos        boolean     DEFAULT true,
  permitir_edicion_personal   boolean     DEFAULT true,
  horas_anticipacion_reserva  integer     DEFAULT 14,
  umbral_ocupacion            integer     DEFAULT 85,
  orientacion_calendario      varchar     DEFAULT 'vertical',
  nombre_red_hoteles          varchar     DEFAULT 'Hotel Manager',
  ciudad_base                 varchar,
  cargo_persona_extra         numeric     DEFAULT 0.00 CHECK (cargo_persona_extra >= 0),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configuracion_hotelera_pkey PRIMARY KEY (id_config),
  CONSTRAINT configuracion_hotel_unico   UNIQUE (id_hotel)
);

-- ── Tipos de habitación ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tipos_habitacion (
  id_tipo_habitacion uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel           uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre_tipo        varchar     NOT NULL,
  descripcion        text,
  capacidad_base     integer     DEFAULT 1 CHECK (capacidad_base > 0),
  estado             varchar     DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tipos_habitacion_pkey PRIMARY KEY (id_tipo_habitacion)
);

-- ── Categorías y tarifas ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.categorias_tarifa (
  id_categoria uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel     uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre       varchar     NOT NULL,
  descripcion  text,
  activa       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categorias_tarifa_pkey PRIMARY KEY (id_categoria)
);

CREATE TABLE IF NOT EXISTS public.tarifas (
  id_tarifa          uuid    NOT NULL DEFAULT gen_random_uuid(),
  id_tipo_habitacion uuid    NOT NULL REFERENCES public.tipos_habitacion(id_tipo_habitacion) ON DELETE CASCADE,
  id_categoria       uuid    NOT NULL REFERENCES public.categorias_tarifa(id_categoria),
  tarifa_noche       numeric NOT NULL DEFAULT 0.00 CHECK (tarifa_noche >= 0),
  tarifa_hora        numeric NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0),
  tarifa_pasadia     numeric NOT NULL DEFAULT 0.00 CHECK (tarifa_pasadia >= 0),
  vigente_desde      date    NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta      date,
  activa             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_pkey PRIMARY KEY (id_tarifa)
);

-- ── Habitaciones ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habitaciones (
  id_habitacion      uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel           uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  id_tipo_habitacion uuid        NOT NULL REFERENCES public.tipos_habitacion(id_tipo_habitacion),
  id_tarifa_default  uuid        REFERENCES public.tarifas(id_tarifa),
  codigo_habitacion  varchar     NOT NULL,
  nombre_habitacion  varchar     NOT NULL,
  nombre_alias       text,
  piso               integer     CHECK (piso >= 0),
  capacidad          integer     DEFAULT 1 CHECK (capacidad > 0),
  numero_camas       integer     DEFAULT 1 CHECK (numero_camas > 0),
  tarifa_noche       numeric     DEFAULT 0.00 CHECK (tarifa_noche >= 0),
  imagen_360         text,
  estado             varchar     NOT NULL DEFAULT 'disponible'
                       CHECK (estado IN ('disponible','ocupada','mantenimiento','bloqueada','limpieza')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habitaciones_pkey         PRIMARY KEY (id_habitacion),
  CONSTRAINT habitaciones_codigo_unico UNIQUE (id_hotel, codigo_habitacion)
);

CREATE TABLE IF NOT EXISTS public.habitacion_comodidades (
  id_habitacion    uuid NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  nombre_comodidad text NOT NULL,
  CONSTRAINT habitacion_comodidades_pkey PRIMARY KEY (id_habitacion, nombre_comodidad)
);

CREATE TABLE IF NOT EXISTS public.habitacion_imagenes (
  id_imagen     uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_habitacion uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  url_imagen    text        NOT NULL,
  orden         integer     DEFAULT 0 CHECK (orden >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habitacion_imagenes_pkey PRIMARY KEY (id_imagen)
);

CREATE TABLE IF NOT EXISTS public.comodidades_hotel (
  id_comodidad_hotel uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel           uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre             text        NOT NULL,
  icono              text,
  es_acumulable      boolean     DEFAULT false,
  cantidad_total     integer     DEFAULT 0,
  created_at         timestamptz DEFAULT now(),
  CONSTRAINT comodidades_hotel_pkey PRIMARY KEY (id_comodidad_hotel)
);

CREATE TABLE IF NOT EXISTS public.servicios_adicionales (
  id_servicio    uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel       uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre         varchar     NOT NULL,
  descripcion    text,
  precio_defecto numeric     DEFAULT 0.00 CHECK (precio_defecto >= 0),
  activo         boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servicios_adicionales_pkey PRIMARY KEY (id_servicio)
);

CREATE TABLE IF NOT EXISTS public.bloqueos_habitacion (
  id_bloqueo    uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_habitacion uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  fecha_inicio  timestamptz NOT NULL,
  fecha_fin     timestamptz NOT NULL,
  motivo        text        NOT NULL,
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloqueos_habitacion_pkey PRIMARY KEY (id_bloqueo),
  CONSTRAINT bloqueos_fechas_check    CHECK (fecha_fin > fecha_inicio)
);

-- ── Huéspedes y empresas ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.huespedes (
  id_huesped          uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel            uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre_completo     varchar     NOT NULL,
  correo              varchar     NOT NULL,
  telefono            varchar,
  documento_identidad varchar,
  rtn                 varchar,
  ciudad              varchar,
  direccion           text,
  fecha_registro      timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT huespedes_pkey               PRIMARY KEY (id_huesped),
  CONSTRAINT huespedes_hotel_correo_unico UNIQUE (id_hotel, correo)
);

CREATE TABLE IF NOT EXISTS public.empresas (
  id_empresa        uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel          uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre            varchar     NOT NULL,
  rtn               varchar     NOT NULL,
  contacto_nombre   varchar,
  contacto_telefono varchar,
  contacto_correo   varchar,
  direccion         text,
  limite_credito    numeric     DEFAULT 0.00 CHECK (limite_credito >= 0),
  dias_credito      integer     DEFAULT 30   CHECK (dias_credito > 0),
  estado            varchar     DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','suspendido')),
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id_empresa)
);

-- ── Reservas y pagos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reservas_hotel (
  id_reserva_hotel uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel         uuid        NOT NULL REFERENCES public.hoteles(id_hotel),
  id_huesped       uuid        NOT NULL REFERENCES public.huespedes(id_huesped),
  id_habitacion    uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion),
  id_empresa       uuid        REFERENCES public.empresas(id_empresa),
  check_in         timestamptz NOT NULL,
  check_out        timestamptz NOT NULL,
  adultos          integer     NOT NULL DEFAULT 1 CHECK (adultos > 0),
  ninos            integer     NOT NULL DEFAULT 0 CHECK (ninos >= 0),
  estado           varchar     NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','confirmada','cancelada','check_in','check_out','no_show')),
  estado_display   varchar     DEFAULT 'reservada',
  tipo_reserva     varchar     DEFAULT 'noche' CHECK (tipo_reserva IN ('noche','hora','pasadia')),
  total_reserva    numeric     NOT NULL DEFAULT 0.00 CHECK (total_reserva >= 0),
  moneda           varchar     NOT NULL DEFAULT 'HNL',
  estado_pago      varchar     NOT NULL DEFAULT 'deuda'
                     CHECK (estado_pago IN ('pagado','cortesia','credito','deuda','abonada')),
  anticipo         numeric     NOT NULL DEFAULT 0.00 CHECK (anticipo >= 0),
  es_cortesia      boolean     NOT NULL DEFAULT false,
  observaciones    text,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_hotel_pkey   PRIMARY KEY (id_reserva_hotel),
  CONSTRAINT reservas_fechas_check CHECK (check_out > check_in)
);

CREATE TABLE IF NOT EXISTS public.pagos_hotel (
  id_pago_hotel           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_reserva_hotel        uuid        NOT NULL REFERENCES public.reservas_hotel(id_reserva_hotel),
  monto                   numeric     NOT NULL CHECK (monto >= 0),
  monto_en_moneda_reserva numeric     NOT NULL CHECK (monto_en_moneda_reserva >= 0),
  metodo_pago             varchar     NOT NULL
                            CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','deposito','canje','otro')),
  referencia              varchar,
  moneda                  varchar     NOT NULL DEFAULT 'HNL',
  estado                  varchar     NOT NULL DEFAULT 'registrado'
                            CHECK (estado IN ('registrado','aplicado','anulado')),
  notas                   text,
  fecha_pago              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid        REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_hotel_pkey PRIMARY KEY (id_pago_hotel)
);

CREATE TABLE IF NOT EXISTS public.reserva_comodidades (
  id               uuid NOT NULL DEFAULT gen_random_uuid(),
  id_reserva_hotel uuid NOT NULL REFERENCES public.reservas_hotel(id_reserva_hotel) ON DELETE CASCADE,
  id_comodidad     uuid NOT NULL REFERENCES public.comodidades_hotel(id_comodidad_hotel),
  cantidad         integer DEFAULT 1,
  CONSTRAINT reserva_comodidades_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.reserva_servicios (
  id_reserva_hotel uuid    NOT NULL REFERENCES public.reservas_hotel(id_reserva_hotel) ON DELETE CASCADE,
  id_servicio      uuid    NOT NULL REFERENCES public.servicios_adicionales(id_servicio),
  cantidad         integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario  numeric NOT NULL CHECK (precio_unitario >= 0),
  CONSTRAINT reserva_servicios_pkey PRIMARY KEY (id_reserva_hotel, id_servicio)
);

CREATE TABLE IF NOT EXISTS public.saldos_clientes (
  id_saldo         uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_huesped       uuid        NOT NULL REFERENCES public.huespedes(id_huesped),
  monto            numeric     NOT NULL,
  tipo             varchar     NOT NULL CHECK (tipo IN ('credito','debito','devolucion','ajuste')),
  descripcion      varchar     NOT NULL DEFAULT '',
  aplicado         boolean     NOT NULL DEFAULT false,
  fecha_aplicacion timestamptz,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saldos_clientes_pkey PRIMARY KEY (id_saldo)
);

CREATE TABLE IF NOT EXISTS public.creditos_empresa (
  id_credito       uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_empresa       uuid        NOT NULL REFERENCES public.empresas(id_empresa),
  id_reserva_hotel uuid        REFERENCES public.reservas_hotel(id_reserva_hotel),
  tipo_movimiento  varchar     NOT NULL CHECK (tipo_movimiento IN ('cargo','abono')),
  monto            numeric     NOT NULL CHECK (monto > 0),
  moneda           varchar     NOT NULL DEFAULT 'HNL',
  descripcion      text,
  referencia       varchar,
  fecha_movimiento timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creditos_empresa_pkey PRIMARY KEY (id_credito)
);

-- ── Finanzas ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facturas (
  id_factura           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel             uuid        NOT NULL REFERENCES public.hoteles(id_hotel),
  fecha                date        NOT NULL,
  proveedor            text        NOT NULL,
  no_factura           text,
  rtn_proveedor        text,
  tipo                 text        NOT NULL DEFAULT 'general' CHECK (tipo IN ('general','caja_chica')),
  categoria_general_id integer,
  categoria_chica_id   integer,
  descripcion          text,
  subtotal             numeric     DEFAULT 0,
  isv_15               numeric     DEFAULT 0,
  isv_18               numeric     DEFAULT 0,
  monto_total          numeric     NOT NULL,
  imagen_url           text,
  created_by           uuid        REFERENCES auth.users(id),
  created_at           timestamptz DEFAULT now(),
  CONSTRAINT facturas_pkey PRIMARY KEY (id_factura)
);

CREATE TABLE IF NOT EXISTS public.cierres_diarios (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel         uuid        NOT NULL REFERENCES public.hoteles(id_hotel),
  fecha            date        NOT NULL,
  encargado_id     uuid        REFERENCES auth.users(id),
  encargado_nombre varchar,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cierres_diarios_pkey      PRIMARY KEY (id),
  CONSTRAINT cierres_hotel_fecha_unico UNIQUE (id_hotel, fecha)
);

-- ── Chat ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel     uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  name         varchar     NOT NULL,
  description  text,
  channel_type varchar     DEFAULT 'general'
                 CHECK (channel_type IN ('general','operativo','cliente','privado')),
  id_huesped   uuid        REFERENCES public.huespedes(id_huesped),
  created_by   uuid        NOT NULL REFERENCES auth.users(id),
  metadata     jsonb       DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_channels_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  channel_id    uuid        NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id     uuid        NOT NULL REFERENCES auth.users(id),
  sender_name   varchar     NOT NULL,
  sender_avatar text,
  content       text        NOT NULL CHECK (length(content) <= 4000),
  message_type  varchar     DEFAULT 'text'
                  CHECK (message_type IN ('text','data_card','system','file')),
  file_url      text,
  file_name     text,
  is_deleted    boolean     NOT NULL DEFAULT false,
  edited_at     timestamptz,
  metadata      jsonb       DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_read_status (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id   uuid        NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  unread_count integer     NOT NULL DEFAULT 0,
  last_read_at timestamptz DEFAULT now(),
  CONSTRAINT chat_read_status_pkey          PRIMARY KEY (id),
  CONSTRAINT chat_read_status_user_ch_unico UNIQUE (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS public.chat_references (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  entity_type varchar     NOT NULL CHECK (entity_type IN ('reserva','pago','huesped','habitacion','factura')),
  entity_id   uuid        NOT NULL,
  entity_data jsonb       DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_references_pkey PRIMARY KEY (id)
);

-- ── Índices hotel ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_config_hotel    ON public.configuracion_hotelera (id_hotel);
CREATE INDEX IF NOT EXISTS idx_tipohab_hotel   ON public.tipos_habitacion (id_hotel);
CREATE INDEX IF NOT EXISTS idx_hab_hotel       ON public.habitaciones (id_hotel);
CREATE INDEX IF NOT EXISTS idx_hab_estado      ON public.habitaciones (id_hotel, estado);
CREATE INDEX IF NOT EXISTS idx_bloq_hab        ON public.bloqueos_habitacion (id_habitacion);
CREATE INDEX IF NOT EXISTS idx_hues_hotel      ON public.huespedes (id_hotel);
CREATE INDEX IF NOT EXISTS idx_res_hotel       ON public.reservas_hotel (id_hotel);
CREATE INDEX IF NOT EXISTS idx_res_fechas      ON public.reservas_hotel (id_hotel, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_res_estado      ON public.reservas_hotel (id_hotel, estado);
CREATE INDEX IF NOT EXISTS idx_pag_reserva     ON public.pagos_hotel (id_reserva_hotel);
CREATE INDEX IF NOT EXISTS idx_fact_hotel      ON public.facturas (id_hotel);
CREATE INDEX IF NOT EXISTS idx_cierre_hotel    ON public.cierres_diarios (id_hotel);
CREATE INDEX IF NOT EXISTS idx_chch_hotel      ON public.chat_channels (id_hotel);
CREATE INDEX IF NOT EXISTS idx_chmsg_channel   ON public.chat_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidad   ON public.audit_log (owner_id, entidad, entidad_id);

-- ── Funciones RLS hotel ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tiene_acceso_hotel(p_id_hotel uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hoteles h
    JOIN public.business_modules bm ON bm.id_module = h.id_module
    WHERE h.id_hotel = p_id_hotel AND bm.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.usuarios_roles ur
    JOIN public.hoteles h ON h.id_hotel = p_id_hotel
    JOIN public.business_modules bm ON bm.id_module = h.id_module
    WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id
      AND ur.estado = 'activo' AND (ur.id_hotel = p_id_hotel OR ur.id_hotel IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.rol_en_hotel(p_id_hotel uuid)
RETURNS varchar LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.hoteles h JOIN public.business_modules bm ON bm.id_module = h.id_module
      WHERE h.id_hotel = p_id_hotel AND bm.owner_id = auth.uid()) THEN 'PROPIETARIO'
    ELSE (SELECT ur.rol FROM public.usuarios_roles ur
      JOIN public.hoteles h ON h.id_hotel = p_id_hotel
      JOIN public.business_modules bm ON bm.id_module = h.id_module
      WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id
        AND ur.estado = 'activo' AND (ur.id_hotel = p_id_hotel OR ur.id_hotel IS NULL)
      ORDER BY CASE ur.rol WHEN 'ADMIN' THEN 1 WHEN 'CONTADOR' THEN 2 ELSE 3 END LIMIT 1)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.tiene_acceso_hotel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rol_en_hotel(uuid)       TO authenticated;

-- ── RLS hotel ─────────────────────────────────────────────────────────────────
ALTER TABLE public.hoteles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_hotelera ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_habitacion      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_tarifa     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitaciones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitacion_comodidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitacion_imagenes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comodidades_hotel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_adicionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos_habitacion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huespedes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_hotel        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_hotel           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_comodidades   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_servicios     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos_clientes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos_empresa      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_diarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_status      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_references       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hotel_select" ON public.hoteles FOR SELECT USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "hotel_insert" ON public.hoteles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = hoteles.id_module AND bm.owner_id = auth.uid()));
CREATE POLICY "hotel_update" ON public.hoteles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = hoteles.id_module AND bm.owner_id = auth.uid()));
CREATE POLICY "hotel_delete" ON public.hoteles FOR DELETE USING (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = hoteles.id_module AND bm.owner_id = auth.uid()));

CREATE POLICY "config_all"    ON public.configuracion_hotelera FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "tipohab_all"   ON public.tipos_habitacion       FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "cattarifa_all" ON public.categorias_tarifa      FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "tar_all" ON public.tarifas FOR ALL USING (EXISTS (SELECT 1 FROM public.tipos_habitacion th WHERE th.id_tipo_habitacion = tarifas.id_tipo_habitacion AND public.tiene_acceso_hotel(th.id_hotel)));
CREATE POLICY "hab_all"      ON public.habitaciones         FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "habcomod_all" ON public.habitacion_comodidades FOR ALL USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = habitacion_comodidades.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "habimg_all"   ON public.habitacion_imagenes   FOR ALL USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = habitacion_imagenes.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "comod_all"    ON public.comodidades_hotel      FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "srv_all"      ON public.servicios_adicionales  FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "bloq_all" ON public.bloqueos_habitacion FOR ALL USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = bloqueos_habitacion.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "hues_all"  ON public.huespedes      FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "emp_all"   ON public.empresas       FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "res_all"   ON public.reservas_hotel FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "pag_all"   ON public.pagos_hotel    FOR ALL USING (EXISTS (SELECT 1 FROM public.reservas_hotel r WHERE r.id_reserva_hotel = pagos_hotel.id_reserva_hotel AND public.tiene_acceso_hotel(r.id_hotel)));
CREATE POLICY "rescomod_all" ON public.reserva_comodidades FOR ALL USING (EXISTS (SELECT 1 FROM public.reservas_hotel r WHERE r.id_reserva_hotel = reserva_comodidades.id_reserva_hotel AND public.tiene_acceso_hotel(r.id_hotel)));
CREATE POLICY "ressrv_all"   ON public.reserva_servicios   FOR ALL USING (EXISTS (SELECT 1 FROM public.reservas_hotel r WHERE r.id_reserva_hotel = reserva_servicios.id_reserva_hotel AND public.tiene_acceso_hotel(r.id_hotel)));
CREATE POLICY "saldos_all"   ON public.saldos_clientes     FOR ALL USING (EXISTS (SELECT 1 FROM public.huespedes hg WHERE hg.id_huesped = saldos_clientes.id_huesped AND public.tiene_acceso_hotel(hg.id_hotel)));
CREATE POLICY "creditemp_all" ON public.creditos_empresa   FOR ALL USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = creditos_empresa.id_empresa AND public.tiene_acceso_hotel(e.id_hotel)));
CREATE POLICY "fact_all"   ON public.facturas        FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "cierre_all" ON public.cierres_diarios FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "chch_all"   ON public.chat_channels   FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "chmsg_select" ON public.chat_messages FOR SELECT USING (is_deleted = false AND EXISTS (SELECT 1 FROM public.chat_channels cc WHERE cc.id = chat_messages.channel_id AND public.tiene_acceso_hotel(cc.id_hotel)));
CREATE POLICY "chmsg_insert" ON public.chat_messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_channels cc WHERE cc.id = chat_messages.channel_id AND public.tiene_acceso_hotel(cc.id_hotel)));
CREATE POLICY "chmsg_update" ON public.chat_messages FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY "chread_all"   ON public.chat_read_status FOR ALL USING (user_id = auth.uid());
CREATE POLICY "chref_all"    ON public.chat_references  FOR ALL USING (EXISTS (SELECT 1 FROM public.chat_messages cm JOIN public.chat_channels cc ON cc.id = cm.channel_id WHERE cm.id = chat_references.message_id AND public.tiene_acceso_hotel(cc.id_hotel)));

-- ── Trigger auditoría hotel ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner_id uuid; v_hotel_id uuid; v_row jsonb;
BEGIN
  v_row := CASE TG_OP WHEN 'DELETE' THEN row_to_json(OLD)::jsonb ELSE row_to_json(NEW)::jsonb END;
  BEGIN v_hotel_id := (v_row->>'id_hotel')::uuid; EXCEPTION WHEN others THEN v_hotel_id := NULL; END;
  IF v_hotel_id IS NOT NULL THEN
    SELECT bm.owner_id INTO v_owner_id FROM public.hoteles h JOIN public.business_modules bm ON bm.id_module = h.id_module WHERE h.id_hotel = v_hotel_id;
  ELSE
    BEGIN v_owner_id := (v_row->>'owner_id')::uuid; EXCEPTION WHEN others THEN v_owner_id := NULL; END;
  END IF;
  IF v_owner_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  INSERT INTO public.audit_log (owner_id, id_hotel, accion, entidad, entidad_id, usuario_id, usuario_email, datos_anteriores, datos_nuevos, cambios_resumidos)
  VALUES (v_owner_id, v_hotel_id, TG_OP, TG_TABLE_NAME, (v_row->>'id')::uuid, auth.uid(), auth.email(),
    CASE TG_OP WHEN 'DELETE' THEN v_row WHEN 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE v_row END, TG_OP || ' en ' || TG_TABLE_NAME);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reservas_hotel','pagos_hotel','habitaciones','huespedes','bloqueos_habitacion','saldos_clientes','usuarios_roles','empresas','cierres_diarios','hoteles']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I; CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();',t,t,t,t);
  END LOOP;
END $$;

-- ── Vistas hotel ──────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.habitaciones_con_detalles CASCADE;
CREATE OR REPLACE VIEW public.habitaciones_con_detalles AS
SELECT h.id_habitacion, h.id_hotel, h.codigo_habitacion, h.nombre_habitacion, h.nombre_alias,
  h.piso, h.capacidad, h.numero_camas, h.tarifa_noche, h.imagen_360, h.estado,
  t.nombre_tipo AS tipo,
  COALESCE((SELECT array_agg(hc.nombre_comodidad ORDER BY hc.nombre_comodidad) FROM public.habitacion_comodidades hc WHERE hc.id_habitacion = h.id_habitacion),'{}'::text[]) AS comodidades,
  COALESCE((SELECT array_agg(hi.url_imagen ORDER BY hi.orden) FROM public.habitacion_imagenes hi WHERE hi.id_habitacion = h.id_habitacion),'{}'::text[]) AS imagenes
FROM public.habitaciones h
LEFT JOIN public.tipos_habitacion t ON t.id_tipo_habitacion = h.id_tipo_habitacion;
GRANT SELECT ON public.habitaciones_con_detalles TO authenticated;

CREATE OR REPLACE VIEW public.v_mis_hoteles AS
SELECT h.id_hotel, h.nombre_hotel, h.ciudad, h.estado, bm.owner_id,
  COUNT(DISTINCT hab.id_habitacion) AS total_hab,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado='disponible') AS disponibles,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado='ocupada') AS ocupadas,
  ROUND(100.0*COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado='ocupada')/NULLIF(COUNT(DISTINCT hab.id_habitacion),0),2) AS pct_ocupacion
FROM public.hoteles h JOIN public.business_modules bm ON bm.id_module=h.id_module
LEFT JOIN public.habitaciones hab ON hab.id_hotel=h.id_hotel
WHERE bm.owner_id=auth.uid() GROUP BY h.id_hotel,h.nombre_hotel,h.ciudad,h.estado,bm.owner_id;

CREATE OR REPLACE VIEW public.v_agenda_hoy AS
SELECT r.id_reserva_hotel, h.id_hotel, h.nombre_hotel, bm.owner_id, hg.nombre_completo AS huesped,
  hg.telefono, hab.codigo_habitacion, hab.nombre_habitacion, r.check_in, r.check_out, r.estado, r.estado_pago, r.total_reserva,
  CASE WHEN r.check_in::date=CURRENT_DATE AND r.estado='confirmada' THEN 'check_in_hoy'
       WHEN r.check_out::date=CURRENT_DATE AND r.estado='check_in' THEN 'check_out_hoy'
       ELSE r.estado END AS accion_hoy
FROM public.reservas_hotel r JOIN public.hoteles h ON h.id_hotel=r.id_hotel
JOIN public.business_modules bm ON bm.id_module=h.id_module
JOIN public.huespedes hg ON hg.id_huesped=r.id_huesped
JOIN public.habitaciones hab ON hab.id_habitacion=r.id_habitacion
WHERE bm.owner_id=auth.uid() AND (r.check_in::date=CURRENT_DATE OR r.check_out::date=CURRENT_DATE) AND r.estado NOT IN ('cancelada','no_show');

GRANT SELECT ON public.v_mis_hoteles TO authenticated;
GRANT SELECT ON public.v_agenda_hoy  TO authenticated;

-- ── Stored procedures hotel ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_verificar_disponibilidad_servicio(p_nombre_servicio text, p_check_in timestamptz, p_check_out timestamptz, p_max_cantidad integer, p_excluir_reserva_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_max integer:=0; v_cnt integer; v_dia date;
BEGIN
  v_dia:=p_check_in::date;
  WHILE v_dia<p_check_out::date LOOP
    SELECT COUNT(DISTINCT rs.id_reserva_hotel) INTO v_cnt FROM public.reserva_servicios rs
    JOIN public.servicios_adicionales sa ON sa.id_servicio=rs.id_servicio
    JOIN public.reservas_hotel r ON r.id_reserva_hotel=rs.id_reserva_hotel
    WHERE sa.nombre=p_nombre_servicio AND r.estado NOT IN ('cancelada','no_show')
      AND r.check_in::date<=v_dia AND r.check_out::date>v_dia
      AND (p_excluir_reserva_id IS NULL OR r.id_reserva_hotel!=p_excluir_reserva_id);
    IF v_cnt>v_max THEN v_max:=v_cnt; END IF; v_dia:=v_dia+1;
  END LOOP;
  RETURN jsonb_build_object('disponible',v_max<p_max_cantidad,'max_asignadas',v_max,'max_permitidas',p_max_cantidad);
END;$$;

CREATE OR REPLACE FUNCTION public.fn_crear_reserva_completa(p_owner_id uuid,p_id_huesped uuid,p_id_habitacion uuid,p_check_in timestamptz,p_check_out timestamptz,p_adultos integer DEFAULT 1,p_ninos integer DEFAULT 0,p_estado varchar DEFAULT 'confirmada',p_total_reserva numeric DEFAULT 0,p_moneda varchar DEFAULT 'HNL',p_observaciones text DEFAULT NULL,p_estado_pago varchar DEFAULT 'deuda',p_anticipo numeric DEFAULT 0,p_es_cortesia boolean DEFAULT false,p_id_empresa uuid DEFAULT NULL,p_tipo_reserva varchar DEFAULT 'noche',p_servicios text[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_hotel uuid; v_id_reserva uuid; v_nombre_servicio text; v_limite integer; v_check jsonb; v_servicio record;
  v_limites jsonb:='{"Cama Extra":3,"Neverita":1,"Plancha":8,"Limpieza Diaria":999}'::jsonb;
BEGIN
  SELECT h.id_hotel INTO v_id_hotel FROM public.habitaciones hab JOIN public.hoteles h ON h.id_hotel=hab.id_hotel
  JOIN public.business_modules bm ON bm.id_module=h.id_module WHERE hab.id_habitacion=p_id_habitacion AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'HABITACION_NO_ENCONTRADA: %',p_id_habitacion; END IF;
  IF p_check_out<=p_check_in THEN RAISE EXCEPTION 'FECHAS_INVALIDAS'; END IF;
  IF EXISTS (SELECT 1 FROM public.reservas_hotel WHERE id_habitacion=p_id_habitacion AND estado NOT IN ('cancelada','no_show','check_out') AND check_in<p_check_out AND check_out>p_check_in) THEN RAISE EXCEPTION 'HABITACION_OCUPADA'; END IF;
  FOREACH v_nombre_servicio IN ARRAY p_servicios LOOP
    v_limite:=(v_limites->>v_nombre_servicio)::integer;
    IF v_limite IS NOT NULL THEN
      v_check:=public.fn_verificar_disponibilidad_servicio(v_nombre_servicio,p_check_in,p_check_out,v_limite,NULL);
      IF NOT (v_check->>'disponible')::boolean THEN RAISE EXCEPTION 'SERVICIO_NO_DISPONIBLE: %',v_nombre_servicio; END IF;
    END IF;
  END LOOP;
  IF p_es_cortesia THEN p_estado_pago:='cortesia'; ELSIF p_id_empresa IS NOT NULL THEN p_estado_pago:='credito'; ELSIF p_estado_pago NOT IN ('pagado','cortesia','credito','deuda','abonada') THEN p_estado_pago:='deuda'; END IF;
  INSERT INTO public.reservas_hotel (id_hotel,id_huesped,id_habitacion,check_in,check_out,adultos,ninos,estado,total_reserva,moneda,observaciones,estado_pago,anticipo,es_cortesia,id_empresa,tipo_reserva)
  VALUES (v_id_hotel,p_id_huesped,p_id_habitacion,p_check_in,p_check_out,p_adultos,p_ninos,p_estado,p_total_reserva,p_moneda,p_observaciones,p_estado_pago,p_anticipo,p_es_cortesia,p_id_empresa,p_tipo_reserva) RETURNING id_reserva_hotel INTO v_id_reserva;
  IF array_length(p_servicios,1)>0 THEN
    FOR v_servicio IN SELECT id_servicio,precio_defecto FROM public.servicios_adicionales WHERE nombre=ANY(p_servicios) AND id_hotel=v_id_hotel AND activo=true
    LOOP INSERT INTO public.reserva_servicios(id_reserva_hotel,id_servicio,cantidad,precio_unitario) VALUES(v_id_reserva,v_servicio.id_servicio,1,v_servicio.precio_defecto); END LOOP;
  END IF;
  RETURN jsonb_build_object('id_reserva_hotel',v_id_reserva,'id_hotel',v_id_hotel);
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

CREATE OR REPLACE FUNCTION public.fn_check_in_reserva(p_id_reserva uuid,p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_estado varchar;
BEGIN
  SELECT r.id_habitacion,r.estado INTO v_id_habitacion,v_estado FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel=r.id_hotel JOIN public.business_modules bm ON bm.id_module=h.id_module
  WHERE r.id_reserva_hotel=p_id_reserva AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %',p_id_reserva; END IF;
  IF v_estado NOT IN ('confirmada','pendiente') THEN RAISE EXCEPTION 'ESTADO_INVALIDO: %',v_estado; END IF;
  UPDATE public.reservas_hotel SET estado='check_in', updated_at=now() WHERE id_reserva_hotel=p_id_reserva;
  UPDATE public.habitaciones   SET estado='ocupada',  updated_at=now() WHERE id_habitacion=v_id_habitacion;
  RETURN jsonb_build_object('success',true,'estado','check_in');
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

CREATE OR REPLACE FUNCTION public.fn_check_out_reserva(p_id_reserva uuid,p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_estado varchar;
BEGIN
  SELECT r.id_habitacion,r.estado INTO v_id_habitacion,v_estado FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel=r.id_hotel JOIN public.business_modules bm ON bm.id_module=h.id_module
  WHERE r.id_reserva_hotel=p_id_reserva AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %',p_id_reserva; END IF;
  IF v_estado!='check_in' THEN RAISE EXCEPTION 'ESTADO_INVALIDO: %',v_estado; END IF;
  UPDATE public.reservas_hotel SET estado='check_out',   updated_at=now() WHERE id_reserva_hotel=p_id_reserva;
  UPDATE public.habitaciones   SET estado='disponible',  updated_at=now() WHERE id_habitacion=v_id_habitacion;
  RETURN jsonb_build_object('success',true,'estado','check_out');
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_reserva(p_id_reserva uuid,p_owner_id uuid,p_anular_pagos boolean DEFAULT false,p_email_usuario text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_id_huesped uuid; v_estado varchar;
  v_total_pagado numeric:=0; v_pago record; v_notas text; v_credito_generado numeric:=0;
BEGIN
  SELECT r.id_habitacion,r.id_huesped,r.estado INTO v_id_habitacion,v_id_huesped,v_estado FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel=r.id_hotel JOIN public.business_modules bm ON bm.id_module=h.id_module
  WHERE r.id_reserva_hotel=p_id_reserva AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %',p_id_reserva; END IF;
  IF v_estado='cancelada' THEN RAISE EXCEPTION 'RESERVA_YA_CANCELADA'; END IF;
  IF p_anular_pagos THEN
    SELECT COALESCE(SUM(monto),0) INTO v_total_pagado FROM public.pagos_hotel WHERE id_reserva_hotel=p_id_reserva AND estado!='anulado';
    IF v_total_pagado>0 THEN
      v_notas:='Anulado por cancelación'||CASE WHEN p_email_usuario IS NOT NULL THEN ' ('||p_email_usuario||')' ELSE '' END;
      FOR v_pago IN SELECT id_pago_hotel,notas FROM public.pagos_hotel WHERE id_reserva_hotel=p_id_reserva AND estado!='anulado'
      LOOP UPDATE public.pagos_hotel SET estado='anulado', notas=CASE WHEN v_pago.notas IS NOT NULL THEN v_pago.notas||E'\n'||v_notas ELSE v_notas END, updated_at=now() WHERE id_pago_hotel=v_pago.id_pago_hotel; END LOOP;
      INSERT INTO public.saldos_clientes(id_huesped,monto,tipo,descripcion) VALUES(v_id_huesped,v_total_pagado,'credito','Crédito por cancelación '||p_id_reserva::text);
      v_credito_generado:=v_total_pagado;
    END IF;
  END IF;
  UPDATE public.reservas_hotel SET estado='cancelada',estado_display='cancelada',updated_at=now() WHERE id_reserva_hotel=p_id_reserva;
  IF v_estado='check_in' THEN UPDATE public.habitaciones SET estado='disponible',updated_at=now() WHERE id_habitacion=v_id_habitacion; END IF;
  RETURN jsonb_build_object('success',true,'credito_generado',v_credito_generado);
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

CREATE OR REPLACE FUNCTION public.fn_registrar_pago(p_owner_id uuid,p_id_reserva_hotel uuid,p_monto numeric,p_moneda varchar DEFAULT 'HNL',p_metodo_pago varchar DEFAULT 'efectivo',p_referencia varchar DEFAULT NULL,p_notas text DEFAULT NULL,p_fecha_pago date DEFAULT CURRENT_DATE)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_reserva record; v_id_pago uuid; v_tipo_cambio numeric; v_monto_en_moneda numeric; v_total_pagado numeric; v_nuevo_estado_pago varchar;
BEGIN
  SELECT r.total_reserva,r.moneda,r.es_cortesia,r.id_empresa INTO v_reserva FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel=r.id_hotel JOIN public.business_modules bm ON bm.id_module=h.id_module
  WHERE r.id_reserva_hotel=p_id_reserva_hotel AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %',p_id_reserva_hotel; END IF;
  IF p_monto<=0 THEN RAISE EXCEPTION 'MONTO_INVALIDO'; END IF;
  SELECT COALESCE(MAX(ch.tipo_cambio_base),26.58) INTO v_tipo_cambio FROM public.reservas_hotel r LEFT JOIN public.configuracion_hotelera ch ON ch.id_hotel=r.id_hotel WHERE r.id_reserva_hotel=p_id_reserva_hotel;
  IF p_moneda=v_reserva.moneda THEN v_monto_en_moneda:=p_monto;
  ELSIF p_moneda='USD' AND v_reserva.moneda='HNL' THEN v_monto_en_moneda:=p_monto*v_tipo_cambio;
  ELSIF p_moneda='HNL' AND v_reserva.moneda='USD' THEN v_monto_en_moneda:=p_monto/v_tipo_cambio;
  ELSE v_monto_en_moneda:=p_monto; END IF;
  INSERT INTO public.pagos_hotel(id_reserva_hotel,monto,monto_en_moneda_reserva,metodo_pago,referencia,moneda,estado,notas,fecha_pago)
  VALUES(p_id_reserva_hotel,p_monto,v_monto_en_moneda,p_metodo_pago,p_referencia,p_moneda,'registrado',p_notas,p_fecha_pago) RETURNING id_pago_hotel INTO v_id_pago;
  SELECT COALESCE(SUM(monto_en_moneda_reserva),0) INTO v_total_pagado FROM public.pagos_hotel WHERE id_reserva_hotel=p_id_reserva_hotel AND estado!='anulado';
  IF v_reserva.es_cortesia THEN v_nuevo_estado_pago:='cortesia';
  ELSIF v_reserva.id_empresa IS NOT NULL THEN v_nuevo_estado_pago:='credito';
  ELSIF v_total_pagado>=v_reserva.total_reserva-0.01 THEN v_nuevo_estado_pago:='pagado';
  ELSIF v_total_pagado>0 THEN v_nuevo_estado_pago:='abonada';
  ELSE v_nuevo_estado_pago:='deuda'; END IF;
  UPDATE public.reservas_hotel SET estado_pago=v_nuevo_estado_pago,updated_at=now() WHERE id_reserva_hotel=p_id_reserva_hotel;
  RETURN jsonb_build_object('id_pago_hotel',v_id_pago,'estado_pago',v_nuevo_estado_pago,'total_pagado',v_total_pagado);
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

CREATE OR REPLACE FUNCTION public.fn_aplicar_saldo_cliente(p_id_saldo uuid,p_id_reserva_hotel uuid,p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_saldo record; v_total_pagado numeric; v_total_reserva numeric; v_pendiente numeric; v_monto_aplicar numeric;
BEGIN
  SELECT id_saldo,monto,aplicado INTO v_saldo FROM public.saldos_clientes WHERE id_saldo=p_id_saldo;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALDO_NO_ENCONTRADO: %',p_id_saldo; END IF;
  IF v_saldo.aplicado THEN RAISE EXCEPTION 'SALDO_YA_APLICADO'; END IF;
  SELECT r.total_reserva INTO v_total_reserva FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel=r.id_hotel JOIN public.business_modules bm ON bm.id_module=h.id_module
  WHERE r.id_reserva_hotel=p_id_reserva_hotel AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %',p_id_reserva_hotel; END IF;
  SELECT COALESCE(SUM(monto_en_moneda_reserva),0) INTO v_total_pagado FROM public.pagos_hotel WHERE id_reserva_hotel=p_id_reserva_hotel AND estado!='anulado';
  v_pendiente:=GREATEST(v_total_reserva-v_total_pagado,0); v_monto_aplicar:=LEAST(v_saldo.monto,CASE WHEN v_pendiente>0 THEN v_pendiente ELSE v_saldo.monto END);
  INSERT INTO public.pagos_hotel(id_reserva_hotel,monto,monto_en_moneda_reserva,metodo_pago,moneda,estado,notas,fecha_pago)
  VALUES(p_id_reserva_hotel,v_monto_aplicar,v_monto_aplicar,'transferencia','HNL','registrado','Saldo aplicado (ID:'||p_id_saldo::text||')',CURRENT_DATE);
  UPDATE public.saldos_clientes SET aplicado=true,fecha_aplicacion=now(),updated_at=now() WHERE id_saldo=p_id_saldo;
  RETURN jsonb_build_object('success',true,'monto_aplicado',v_monto_aplicar);
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

CREATE OR REPLACE FUNCTION public.fn_anular_pago(p_id_pago_hotel uuid,p_owner_id uuid,p_motivo text DEFAULT NULL,p_email_usuario text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_pago record; v_reserva record; v_notas text; v_total_pagado numeric; v_nuevo_estado_pago varchar;
BEGIN
  SELECT p.id_pago_hotel,p.id_reserva_hotel,p.monto,p.estado,p.notas INTO v_pago FROM public.pagos_hotel p
  JOIN public.reservas_hotel r ON r.id_reserva_hotel=p.id_reserva_hotel
  JOIN public.hoteles h ON h.id_hotel=r.id_hotel JOIN public.business_modules bm ON bm.id_module=h.id_module
  WHERE p.id_pago_hotel=p_id_pago_hotel AND bm.owner_id=p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAGO_NO_ENCONTRADO: %',p_id_pago_hotel; END IF;
  IF v_pago.estado='anulado' THEN RAISE EXCEPTION 'PAGO_YA_ANULADO'; END IF;
  v_notas:='Anulado por: '||COALESCE(p_email_usuario,'sistema')||CASE WHEN p_motivo IS NOT NULL THEN ' ('||p_motivo||')' ELSE '' END;
  UPDATE public.pagos_hotel SET estado='anulado', notas=CASE WHEN v_pago.notas IS NOT NULL THEN v_pago.notas||E'\n'||v_notas ELSE v_notas END, updated_at=now() WHERE id_pago_hotel=p_id_pago_hotel;
  SELECT r.total_reserva,r.estado,r.es_cortesia,r.id_empresa,r.id_huesped INTO v_reserva FROM public.reservas_hotel r WHERE id_reserva_hotel=v_pago.id_reserva_hotel;
  IF FOUND AND NOT v_reserva.es_cortesia AND v_reserva.estado NOT IN ('cancelada','no_show') AND v_reserva.id_huesped IS NOT NULL THEN
    INSERT INTO public.saldos_clientes(id_huesped,monto,tipo,descripcion) VALUES(v_reserva.id_huesped,v_pago.monto,'credito','Pago anulado (reserva '||RIGHT(v_pago.id_reserva_hotel::text,8)||')');
    SELECT COALESCE(SUM(monto_en_moneda_reserva),0) INTO v_total_pagado FROM public.pagos_hotel WHERE id_reserva_hotel=v_pago.id_reserva_hotel AND estado!='anulado';
    IF v_reserva.id_empresa IS NOT NULL THEN v_nuevo_estado_pago:='credito';
    ELSIF v_total_pagado>=v_reserva.total_reserva-0.01 THEN v_nuevo_estado_pago:='pagado';
    ELSIF v_total_pagado>0 THEN v_nuevo_estado_pago:='abonada';
    ELSE v_nuevo_estado_pago:='deuda'; END IF;
    IF v_reserva.estado NOT IN ('cancelada','no_show','check_in','check_out') THEN
      UPDATE public.reservas_hotel SET estado_pago=v_nuevo_estado_pago,updated_at=now() WHERE id_reserva_hotel=v_pago.id_reserva_hotel;
    END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'id_pago_hotel',p_id_pago_hotel);
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;

GRANT EXECUTE ON FUNCTION public.fn_verificar_disponibilidad_servicio TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crear_reserva_completa             TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_in_reserva                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_out_reserva                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_reserva                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_pago                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_aplicar_saldo_cliente             TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_anular_pago                       TO authenticated;
