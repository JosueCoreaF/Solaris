-- =============================================================================
-- HOTEL MANAGER SaaS — SCHEMA v2.0
-- Arquitectura limpia multi-tenant con Supabase Auth
--
-- PRINCIPIO DE DISEÑO:
--   • owner_id = auth.uid() del propietario (Supabase Auth ES el owner)
--   • owner_id solo en tablas raíz de cada módulo
--   • Tablas hijas se protegen por join a su padre en RLS
--   • Staff accede por usuarios_roles → vincula auth.uid() a un módulo + rol
--
-- JERARQUÍA:
--   auth.users → owners → business_modules → hoteles → habitaciones
--                                                     → reservas → pagos
--
-- Ejecutar completo en Supabase SQL Editor (service_role)
-- =============================================================================


-- =============================================================================
-- BLOQUE 1: EXTENSIONES
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================================
-- BLOQUE 2: OWNERS
-- id_owner = auth.uid() del propietario que se registró en el login principal
-- No se genera un UUID nuevo — se usa directamente el de Supabase Auth
-- =============================================================================
CREATE TABLE public.owners (
  id_owner          uuid        NOT NULL,
  -- id_owner = auth.uid() del propietario, no se genera aquí
  nombre_empresa    varchar     NOT NULL,
  email_contacto    varchar     NOT NULL UNIQUE,
  telefono_contacto varchar,
  estado            varchar     NOT NULL DEFAULT 'activo'
                      CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owners_pkey PRIMARY KEY (id_owner),
  CONSTRAINT owners_auth_fkey FOREIGN KEY (id_owner)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.owners IS
  'Un owner = un propietario registrado en el login principal del SaaS.
   id_owner es exactamente auth.uid() — no hay desincronización posible.
   Se crea automáticamente vía trigger al registrarse en Auth.';

-- Trigger: crear owner automáticamente cuando alguien se registra
-- en el login principal. El rol se determina por metadata de Auth.
CREATE OR REPLACE FUNCTION public.fn_crear_owner_al_registrarse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Solo crear owner si el usuario se registró como propietario
  -- (se detecta por raw_user_meta_data->>'tipo' = 'owner')
  IF (NEW.raw_user_meta_data ->> 'tipo') = 'owner' THEN
    INSERT INTO public.owners (id_owner, nombre_empresa, email_contacto)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'nombre_empresa', 'Mi Empresa'),
      NEW.email
    )
    ON CONFLICT (id_owner) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_owner ON auth.users;
CREATE TRIGGER trg_crear_owner
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_crear_owner_al_registrarse();


-- =============================================================================
-- BLOQUE 3: PLANES Y SUSCRIPCIONES
-- =============================================================================

-- Catálogo global de planes — sin owner_id, es del SaaS
CREATE TABLE public.planes_suscripcion (
  id_plan                 varchar     NOT NULL,
  tipo_modulo             varchar     NOT NULL DEFAULT 'hotel',
  nombre                  varchar     NOT NULL,
  descripcion             text,
  features                jsonb       NOT NULL DEFAULT '[]',
  stripe_price_id_mensual varchar,
  stripe_price_id_anual   varchar,
  limite_negocios         integer     NOT NULL DEFAULT 1,
  precio_mensual          numeric     NOT NULL DEFAULT 0.00,
  precio_anual            numeric     NOT NULL DEFAULT 0.00,
  activo                  boolean     NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planes_suscripcion_pkey PRIMARY KEY (id_plan)
);

-- Suscripción activa del owner por módulo
CREATE TABLE public.suscripciones_owner (
  id_suscripcion          uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id                uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  tipo_modulo             varchar     NOT NULL,
  id_plan                 varchar     NOT NULL REFERENCES public.planes_suscripcion(id_plan),
  stripe_customer_id      varchar,
  stripe_subscription_id  varchar,
  estado                  varchar     NOT NULL DEFAULT 'trial'
                            CHECK (estado IN ('activa','inactiva','cancelada','impaga','trial')),
  trial_end               timestamptz,
  current_period_end      timestamptz,
  negocios_extra          integer     NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suscripciones_owner_pkey PRIMARY KEY (id_suscripcion)
);


-- =============================================================================
-- BLOQUE 4: BUSINESS MODULES
-- Punto de entrada del dashboard del propietario.
-- owner_id aquí — es la única referencia al owner en los módulos.
-- Todo lo que cuelga de un módulo se protege llegando hasta aquí.
-- =============================================================================
CREATE TABLE public.business_modules (
  id_module     uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  tipo_modulo   varchar     NOT NULL
                  CHECK (tipo_modulo IN ('hotel','restaurant','gym','store')),
  nombre_modulo varchar     NOT NULL,
  estado        varchar     NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo','inactivo','mantenimiento')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_modules_pkey PRIMARY KEY (id_module)
);

COMMENT ON TABLE public.business_modules IS
  'Cada negocio registrado de un owner. owner_id vive aquí.
   El RLS de hoteles, restaurantes, etc. sube hasta esta tabla para verificar
   que el módulo pertenece al auth.uid() activo.';


-- =============================================================================
-- BLOQUE 5: MÓDULO HOTEL
-- Sin owner_id — el aislamiento llega por: habitacion→hotel→business_modules→owner
-- =============================================================================

CREATE TABLE public.hoteles (
  id_hotel            uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_module           uuid        NOT NULL REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  nombre_hotel        varchar     NOT NULL,
  ciudad              varchar     NOT NULL,
  direccion           text        NOT NULL,
  telefono            varchar,
  correo_contacto     varchar,
  estrellas           integer     DEFAULT 3 CHECK (estrellas BETWEEN 1 AND 5),
  estado              varchar     NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo','inactivo','mantenimiento')),
  enlace_google_maps  text,
  slug                varchar     UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hoteles_pkey PRIMARY KEY (id_hotel)
);

COMMENT ON TABLE public.hoteles IS
  'Sin owner_id. Para saber el owner: hoteles→business_modules→owner_id.
   El RLS usa un EXISTS hasta business_modules.';

CREATE TABLE public.configuracion_hotelera (
  id_config                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel                    uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  hora_check_in               time        NOT NULL DEFAULT '15:00:00',
  hora_check_out              time        NOT NULL DEFAULT '12:00:00',
  moneda                      varchar     NOT NULL DEFAULT 'USD',
  moneda_alterna              varchar     DEFAULT 'HNL',
  tipo_cambio_base            numeric     DEFAULT 24.50,
  tipo_cambio_actualizado_en  timestamptz,
  porcentaje_impuesto         numeric     DEFAULT 0.00 CHECK (porcentaje_impuesto >= 0),
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
  CONSTRAINT configuracion_hotelera_pkey   PRIMARY KEY (id_config),
  CONSTRAINT configuracion_hotel_unico     UNIQUE (id_hotel)
);

CREATE TABLE public.tipos_habitacion (
  id_tipo_habitacion  uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel            uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre_tipo         varchar     NOT NULL,
  descripcion         text,
  capacidad_base      integer     DEFAULT 1 CHECK (capacidad_base > 0),
  estado              varchar     DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tipos_habitacion_pkey PRIMARY KEY (id_tipo_habitacion)
);

COMMENT ON TABLE public.tipos_habitacion IS
  'Ahora vinculada al hotel directamente, no al owner.
   Cada hotel define sus propios tipos (Simple, Doble, Suite, etc.).';

CREATE TABLE public.categorias_tarifa (
  id_categoria  uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel      uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre        varchar     NOT NULL,
  descripcion   text,
  activa        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categorias_tarifa_pkey PRIMARY KEY (id_categoria)
);

CREATE TABLE public.tarifas (
  id_tarifa           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_tipo_habitacion  uuid        NOT NULL REFERENCES public.tipos_habitacion(id_tipo_habitacion) ON DELETE CASCADE,
  id_categoria        uuid        NOT NULL REFERENCES public.categorias_tarifa(id_categoria),
  tarifa_noche        numeric     NOT NULL DEFAULT 0.00 CHECK (tarifa_noche >= 0),
  tarifa_hora         numeric     NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0),
  tarifa_pasadia      numeric     NOT NULL DEFAULT 0.00 CHECK (tarifa_pasadia >= 0),
  vigente_desde       date        NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta       date,
  activa              boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tarifas_pkey PRIMARY KEY (id_tarifa)
);

CREATE TABLE public.habitaciones (
  id_habitacion       uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel            uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  id_tipo_habitacion  uuid        NOT NULL REFERENCES public.tipos_habitacion(id_tipo_habitacion),
  id_tarifa_default   uuid        REFERENCES public.tarifas(id_tarifa),
  codigo_habitacion   varchar     NOT NULL,
  nombre_habitacion   varchar     NOT NULL,
  nombre_alias        text,
  piso                integer     CHECK (piso >= 0),
  capacidad           integer     DEFAULT 1 CHECK (capacidad > 0),
  numero_camas        integer     DEFAULT 1 CHECK (numero_camas > 0),
  tarifa_noche        numeric     DEFAULT 0.00 CHECK (tarifa_noche >= 0),
  imagen_360          text,
  estado              varchar     NOT NULL DEFAULT 'disponible'
                        CHECK (estado IN ('disponible','ocupada','mantenimiento','bloqueada','limpieza')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habitaciones_pkey              PRIMARY KEY (id_habitacion),
  CONSTRAINT habitaciones_codigo_unico      UNIQUE (id_hotel, codigo_habitacion)
);

CREATE TABLE public.habitacion_comodidades (
  id_habitacion     uuid  NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  nombre_comodidad  text  NOT NULL,
  CONSTRAINT habitacion_comodidades_pkey PRIMARY KEY (id_habitacion, nombre_comodidad)
);

CREATE TABLE public.habitacion_imagenes (
  id_imagen     uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_habitacion uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  url_imagen    text        NOT NULL,
  orden         integer     DEFAULT 0 CHECK (orden >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habitacion_imagenes_pkey PRIMARY KEY (id_imagen)
);

CREATE TABLE public.comodidades_hotel (
  id_comodidad_hotel  uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel            uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre              text        NOT NULL,
  icono               text,
  es_acumulable       boolean     DEFAULT false,
  cantidad_total      integer     DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT comodidades_hotel_pkey PRIMARY KEY (id_comodidad_hotel)
);

CREATE TABLE public.servicios_adicionales (
  id_servicio     uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel        uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  nombre          varchar     NOT NULL,
  descripcion     text,
  precio_defecto  numeric     DEFAULT 0.00 CHECK (precio_defecto >= 0),
  activo          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT servicios_adicionales_pkey PRIMARY KEY (id_servicio)
);

CREATE TABLE public.bloqueos_habitacion (
  id_bloqueo    uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_habitacion uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  fecha_inicio  timestamptz NOT NULL,
  fecha_fin     timestamptz NOT NULL,
  motivo        text        NOT NULL,
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bloqueos_habitacion_pkey   PRIMARY KEY (id_bloqueo),
  CONSTRAINT bloqueos_fechas_check      CHECK (fecha_fin > fecha_inicio)
);


-- =============================================================================
-- BLOQUE 6: HUÉSPEDES Y EMPRESAS
-- Vinculados al hotel — un huésped existe en el contexto de un hotel
-- =============================================================================

CREATE TABLE public.huespedes (
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

COMMENT ON TABLE public.huespedes IS
  'Huéspedes por hotel. Si el owner tiene 3 hoteles y el mismo cliente
   se hospeda en todos, puede aparecer en los 3 — o puedes deduplicar
   en la app consultando por correo + documento.';

CREATE TABLE public.empresas (
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
  estado            varchar     DEFAULT 'activo'
                      CHECK (estado IN ('activo','inactivo','suspendido')),
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id_empresa)
);


-- =============================================================================
-- BLOQUE 7: RESERVAS Y PAGOS
-- =============================================================================

CREATE TABLE public.reservas_hotel (
  id_reserva_hotel  uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel          uuid        NOT NULL REFERENCES public.hoteles(id_hotel),
  id_huesped        uuid        NOT NULL REFERENCES public.huespedes(id_huesped),
  id_habitacion     uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion),
  id_empresa        uuid        REFERENCES public.empresas(id_empresa),
  check_in          timestamptz NOT NULL,
  check_out         timestamptz NOT NULL,
  adultos           integer     NOT NULL DEFAULT 1 CHECK (adultos > 0),
  ninos             integer     NOT NULL DEFAULT 0 CHECK (ninos >= 0),
  estado            varchar     NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','confirmada','cancelada','check_in','check_out','no_show')),
  estado_display    varchar     DEFAULT 'reservada',
  tipo_reserva      varchar     DEFAULT 'noche'
                      CHECK (tipo_reserva IN ('noche','hora','pasadia')),
  total_reserva     numeric     NOT NULL DEFAULT 0.00 CHECK (total_reserva >= 0),
  moneda            varchar     NOT NULL DEFAULT 'USD',
  estado_pago       varchar     NOT NULL DEFAULT 'deuda'
                      CHECK (estado_pago IN ('pagado','cortesia','credito','deuda','abonada')),
  anticipo          numeric     NOT NULL DEFAULT 0.00 CHECK (anticipo >= 0),
  es_cortesia       boolean     NOT NULL DEFAULT false,
  observaciones     text,
  created_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reservas_hotel_pkey    PRIMARY KEY (id_reserva_hotel),
  CONSTRAINT reservas_fechas_check  CHECK (check_out > check_in)
);

CREATE TABLE public.pagos_hotel (
  id_pago_hotel           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_reserva_hotel        uuid        NOT NULL REFERENCES public.reservas_hotel(id_reserva_hotel),
  monto                   numeric     NOT NULL CHECK (monto >= 0),
  monto_en_moneda_reserva numeric     NOT NULL CHECK (monto_en_moneda_reserva >= 0),
  metodo_pago             varchar     NOT NULL
                            CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','deposito','canje','otro')),
  referencia              varchar,
  moneda                  varchar     NOT NULL DEFAULT 'USD',
  estado                  varchar     NOT NULL DEFAULT 'registrado'
                            CHECK (estado IN ('registrado','aplicado','anulado')),
  notas                   text,
  fecha_pago              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid        REFERENCES auth.users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_hotel_pkey PRIMARY KEY (id_pago_hotel)
);

CREATE TABLE public.reserva_comodidades (
  id              uuid    NOT NULL DEFAULT gen_random_uuid(),
  id_reserva_hotel uuid   NOT NULL REFERENCES public.reservas_hotel(id_reserva_hotel) ON DELETE CASCADE,
  id_comodidad    uuid    NOT NULL REFERENCES public.comodidades_hotel(id_comodidad_hotel),
  cantidad        integer DEFAULT 1,
  CONSTRAINT reserva_comodidades_pkey PRIMARY KEY (id)
);

CREATE TABLE public.reserva_servicios (
  id_reserva_hotel  uuid    NOT NULL REFERENCES public.reservas_hotel(id_reserva_hotel) ON DELETE CASCADE,
  id_servicio       uuid    NOT NULL REFERENCES public.servicios_adicionales(id_servicio),
  cantidad          integer NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario   numeric NOT NULL CHECK (precio_unitario >= 0),
  CONSTRAINT reserva_servicios_pkey PRIMARY KEY (id_reserva_hotel, id_servicio)
);

CREATE TABLE public.saldos_clientes (
  id_saldo          uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_huesped        uuid        NOT NULL REFERENCES public.huespedes(id_huesped),
  monto             numeric     NOT NULL,
  tipo              varchar     NOT NULL
                      CHECK (tipo IN ('credito','debito','devolucion','ajuste')),
  descripcion       varchar     NOT NULL DEFAULT '',
  aplicado          boolean     NOT NULL DEFAULT false,
  fecha_aplicacion  timestamptz,
  created_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saldos_clientes_pkey PRIMARY KEY (id_saldo)
);

CREATE TABLE public.creditos_empresa (
  id_credito        uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_empresa        uuid        NOT NULL REFERENCES public.empresas(id_empresa),
  id_reserva_hotel  uuid        REFERENCES public.reservas_hotel(id_reserva_hotel),
  tipo_movimiento   varchar     NOT NULL CHECK (tipo_movimiento IN ('cargo','abono')),
  monto             numeric     NOT NULL CHECK (monto > 0),
  moneda            varchar     NOT NULL DEFAULT 'HNL',
  descripcion       text,
  referencia        varchar,
  fecha_movimiento  timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT creditos_empresa_pkey PRIMARY KEY (id_credito)
);


-- =============================================================================
-- BLOQUE 8: FINANZAS DEL HOTEL
-- =============================================================================

CREATE TABLE public.facturas (
  id_factura            uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel              uuid        NOT NULL REFERENCES public.hoteles(id_hotel),
  fecha                 date        NOT NULL,
  proveedor             text        NOT NULL,
  no_factura            text,
  rtn_proveedor         text,
  tipo                  text        NOT NULL DEFAULT 'general'
                          CHECK (tipo IN ('general','caja_chica')),
  categoria_general_id  integer,
  categoria_chica_id    integer,
  descripcion           text,
  subtotal              numeric     DEFAULT 0,
  isv_15                numeric     DEFAULT 0,
  isv_18                numeric     DEFAULT 0,
  monto_total           numeric     NOT NULL,
  imagen_url            text,
  created_by            uuid        REFERENCES auth.users(id),
  created_at            timestamptz DEFAULT now(),
  CONSTRAINT facturas_pkey PRIMARY KEY (id_factura)
);

CREATE TABLE public.cierres_diarios (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel          uuid        NOT NULL REFERENCES public.hoteles(id_hotel),
  fecha             date        NOT NULL,
  encargado_id      uuid        REFERENCES auth.users(id),
  encargado_nombre  varchar,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cierres_diarios_pkey           PRIMARY KEY (id),
  CONSTRAINT cierres_hotel_fecha_unico      UNIQUE (id_hotel, fecha)
);


-- =============================================================================
-- BLOQUE 9: USUARIOS Y ROLES
-- Vincula el staff (auth.uid()) a un owner + módulo + rol
-- El owner se registró en el login principal
-- El staff se registra en el login del módulo y el owner le asigna rol
-- =============================================================================

CREATE TABLE public.usuarios_roles (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id      uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  id_module     uuid        REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  id_hotel      uuid        REFERENCES public.hoteles(id_hotel),
  -- id_hotel: asignación específica a un hotel (para RECEPCIONISTA, MANTENIMIENTO, etc.)
  -- NULL = acceso a todos los hoteles del owner (para ADMIN, CONTADOR)
  rol           varchar     NOT NULL CHECK (rol IN (
                  'ADMIN',
                  'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR',
                  'MESERO', 'COCINA',
                  'ENTRENADOR',
                  'VENDEDOR'
                )),
  estado        varchar     NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('activo','inactivo','suspendido','pendiente')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_roles_pkey              PRIMARY KEY (id),
  CONSTRAINT usuarios_roles_user_owner_unico  UNIQUE (user_id, owner_id, id_module)
);

COMMENT ON TABLE public.usuarios_roles IS
  'El owner (PROPIETARIO) no aparece aquí — él es auth.uid() = owners.id_owner.
   Esta tabla es solo para el staff que trabaja bajo un owner.
   id_hotel NULL = el usuario ve todos los hoteles del owner (ADMIN, CONTADOR).
   id_hotel SET  = el usuario solo ve ese hotel (RECEPCIONISTA, MANTENIMIENTO).';

CREATE TABLE public.invitaciones (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  email         varchar     NOT NULL,
  codigo_unico  varchar     NOT NULL UNIQUE,
  id_module     uuid        REFERENCES public.business_modules(id_module),
  id_hotel      uuid        REFERENCES public.hoteles(id_hotel),
  rol_sugerido  varchar     NOT NULL DEFAULT 'RECEPCIONISTA'
                  CHECK (rol_sugerido IN ('ADMIN','RECEPCIONISTA','MANTENIMIENTO','CONTADOR','MESERO','COCINA','ENTRENADOR','VENDEDOR')),
  usado         boolean     NOT NULL DEFAULT false,
  user_id       uuid        REFERENCES auth.users(id),
  expira_en     timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitaciones_pkey PRIMARY KEY (id)
);


-- =============================================================================
-- BLOQUE 10: CHAT INTERNO (por hotel)
-- =============================================================================

CREATE TABLE public.chat_channels (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel      uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  name          varchar     NOT NULL,
  description   text,
  channel_type  varchar     DEFAULT 'general'
                  CHECK (channel_type IN ('general','operativo','cliente','privado')),
  id_huesped    uuid        REFERENCES public.huespedes(id_huesped),
  created_by    uuid        NOT NULL REFERENCES auth.users(id),
  metadata      jsonb       DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_channels_pkey PRIMARY KEY (id)
);

CREATE TABLE public.chat_messages (
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

CREATE TABLE public.chat_read_status (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id    uuid        NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  unread_count  integer     NOT NULL DEFAULT 0,
  last_read_at  timestamptz DEFAULT now(),
  CONSTRAINT chat_read_status_pkey            PRIMARY KEY (id),
  CONSTRAINT chat_read_status_user_ch_unico   UNIQUE (user_id, channel_id)
);

CREATE TABLE public.chat_references (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  entity_type varchar     NOT NULL
                CHECK (entity_type IN ('reserva','pago','huesped','habitacion','factura')),
  entity_id   uuid        NOT NULL,
  entity_data jsonb       DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_references_pkey PRIMARY KEY (id)
);


-- =============================================================================
-- BLOQUE 11: AUDITORÍA
-- owner_id se mantiene aquí para poder filtrar logs por propietario
-- =============================================================================

CREATE TABLE public.audit_log (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id          uuid        NOT NULL REFERENCES public.owners(id_owner),
  -- owner_id en audit_log: necesario para filtrar logs en el dashboard del owner
  -- sin recorrer joins. Es la única excepción justificada.
  id_hotel          uuid        REFERENCES public.hoteles(id_hotel),
  accion            varchar     NOT NULL CHECK (accion IN (
                      'INSERT','UPDATE','DELETE',
                      'LOGIN','LOGOUT',
                      'CREATE_USER','CHANGE_ROLE',
                      'APPLY_BALANCE','CANCEL_PAYMENT',
                      'CREATE_INVOICE','CANCEL_RESERVATION',
                      'CHECK_IN','CHECK_OUT',
                      'BLOCK_ROOM','UNBLOCK_ROOM'
                    )),
  entidad           varchar     NOT NULL,
  entidad_id        uuid,
  usuario_id        uuid        REFERENCES auth.users(id),
  usuario_email     varchar,
  usuario_rol       varchar,
  datos_anteriores  jsonb,
  datos_nuevos      jsonb,
  cambios_resumidos text,
  ip_cliente        varchar,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

COMMENT ON COLUMN public.audit_log.owner_id IS
  'Excepción justificada: owner_id en audit_log permite filtrar logs
   del dashboard del propietario en O(1) sin joins costosos.';


-- =============================================================================
-- BLOQUE 12: MÓDULO RESTAURANTE
-- Mismo patrón: owner_id solo en business_modules, resto por joins
-- =============================================================================

CREATE TABLE public.restaurante (
  id_restaurante        bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_module             uuid        NOT NULL REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  nombre_restaurante    text        NOT NULL,
  ciudad                text        NOT NULL,
  direccion_restaurante text        NOT NULL,
  correo_restaurante    varchar     NOT NULL,
  telefono_restaurante  varchar     NOT NULL,
  estado                varchar     NOT NULL DEFAULT 'activo'
                          CHECK (estado IN ('activo','inactivo','mantenimiento')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurante_pkey PRIMARY KEY (id_restaurante)
);

CREATE TABLE public.inventario_costos (
  id_prod         bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante  bigint      NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  nombre_producto text        NOT NULL,
  cantidad        integer     NOT NULL,
  precio          numeric     NOT NULL,
  categoria       text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventario_costos_pkey PRIMARY KEY (id_prod)
);

CREATE TABLE public.categorias_gasto_rest (
  id_categoria    bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante  bigint      NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  nombre          varchar     NOT NULL,
  CONSTRAINT categorias_gasto_rest_pkey PRIMARY KEY (id_categoria)
);

CREATE TABLE public.pagos_rest (
  id_pago         bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante  bigint      NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  id_categoria    bigint      NOT NULL REFERENCES public.categorias_gasto_rest(id_categoria),
  fecha_pago      date        NOT NULL DEFAULT CURRENT_DATE,
  monto           numeric     NOT NULL,
  estado          text        NOT NULL DEFAULT 'Por pagar'
                    CHECK (estado IN ('Por pagar','Pagado')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_rest_pkey PRIMARY KEY (id_pago)
);


-- =============================================================================
-- BLOQUE 13: ÍNDICES
-- Sin owner_id en tablas hijas → los índices van por id_hotel, id_module, etc.
-- =============================================================================

-- business_modules
CREATE INDEX idx_bmod_owner       ON public.business_modules (owner_id);
CREATE INDEX idx_bmod_tipo        ON public.business_modules (owner_id, tipo_modulo);

-- suscripciones
CREATE INDEX idx_susc_owner       ON public.suscripciones_owner (owner_id);
CREATE INDEX idx_susc_estado      ON public.suscripciones_owner (owner_id, estado);

-- hoteles
CREATE INDEX idx_hotel_module     ON public.hoteles (id_module);
CREATE INDEX idx_hotel_estado     ON public.hoteles (estado);
CREATE INDEX idx_hotel_slug       ON public.hoteles (slug) WHERE slug IS NOT NULL;

-- configuracion
CREATE INDEX idx_config_hotel     ON public.configuracion_hotelera (id_hotel);

-- tipos_habitacion
CREATE INDEX idx_tipohab_hotel    ON public.tipos_habitacion (id_hotel);

-- tarifas
CREATE INDEX idx_tar_tipo         ON public.tarifas (id_tipo_habitacion);
CREATE INDEX idx_tar_activa       ON public.tarifas (id_tipo_habitacion, activa);

-- habitaciones
CREATE INDEX idx_hab_hotel        ON public.habitaciones (id_hotel);
CREATE INDEX idx_hab_estado       ON public.habitaciones (id_hotel, estado);
CREATE INDEX idx_hab_tipo         ON public.habitaciones (id_tipo_habitacion);

-- bloqueos
CREATE INDEX idx_bloq_hab         ON public.bloqueos_habitacion (id_habitacion);
CREATE INDEX idx_bloq_fechas      ON public.bloqueos_habitacion (id_habitacion, fecha_inicio, fecha_fin);

-- huespedes
CREATE INDEX idx_hues_hotel       ON public.huespedes (id_hotel);
CREATE INDEX idx_hues_doc         ON public.huespedes (id_hotel, documento_identidad)
  WHERE documento_identidad IS NOT NULL;

-- empresas
CREATE INDEX idx_emp_hotel        ON public.empresas (id_hotel);

-- reservas
CREATE INDEX idx_res_hotel        ON public.reservas_hotel (id_hotel);
CREATE INDEX idx_res_huesped      ON public.reservas_hotel (id_huesped);
CREATE INDEX idx_res_habitacion   ON public.reservas_hotel (id_habitacion);
CREATE INDEX idx_res_estado       ON public.reservas_hotel (id_hotel, estado);
CREATE INDEX idx_res_fechas       ON public.reservas_hotel (id_hotel, check_in, check_out);
CREATE INDEX idx_res_estado_pago  ON public.reservas_hotel (id_hotel, estado_pago);

-- pagos hotel
CREATE INDEX idx_pag_reserva      ON public.pagos_hotel (id_reserva_hotel);
CREATE INDEX idx_pag_fecha        ON public.pagos_hotel (fecha_pago);
CREATE INDEX idx_pag_estado       ON public.pagos_hotel (estado);

-- saldos
CREATE INDEX idx_saldos_huesped   ON public.saldos_clientes (id_huesped);
CREATE INDEX idx_saldos_aplicado  ON public.saldos_clientes (id_huesped, aplicado);

-- facturas
CREATE INDEX idx_fact_hotel       ON public.facturas (id_hotel);
CREATE INDEX idx_fact_fecha       ON public.facturas (id_hotel, fecha DESC);

-- cierres
CREATE INDEX idx_cierre_hotel     ON public.cierres_diarios (id_hotel);
CREATE INDEX idx_cierre_fecha     ON public.cierres_diarios (id_hotel, fecha DESC);

-- usuarios_roles
CREATE INDEX idx_uroles_user      ON public.usuarios_roles (user_id);
CREATE INDEX idx_uroles_owner     ON public.usuarios_roles (owner_id);
CREATE INDEX idx_uroles_module    ON public.usuarios_roles (id_module) WHERE id_module IS NOT NULL;
CREATE INDEX idx_uroles_hotel     ON public.usuarios_roles (id_hotel) WHERE id_hotel IS NOT NULL;
CREATE INDEX idx_uroles_estado    ON public.usuarios_roles (owner_id, estado);

-- invitaciones
CREATE INDEX idx_inv_owner        ON public.invitaciones (owner_id);
CREATE INDEX idx_inv_codigo       ON public.invitaciones (codigo_unico);

-- chat
CREATE INDEX idx_chch_hotel       ON public.chat_channels (id_hotel);
CREATE INDEX idx_chmsg_channel    ON public.chat_messages (channel_id, created_at DESC);
CREATE INDEX idx_chmsg_deleted    ON public.chat_messages (channel_id, is_deleted);
CREATE INDEX idx_chread_user      ON public.chat_read_status (user_id);

-- audit
CREATE INDEX idx_audit_owner      ON public.audit_log (owner_id);
CREATE INDEX idx_audit_hotel      ON public.audit_log (id_hotel);
CREATE INDEX idx_audit_fecha      ON public.audit_log (owner_id, created_at DESC);
CREATE INDEX idx_audit_entidad    ON public.audit_log (owner_id, entidad, entidad_id);

-- restaurante
CREATE INDEX idx_rest_module      ON public.restaurante (id_module);
CREATE INDEX idx_invcost_rest     ON public.inventario_costos (id_restaurante);
CREATE INDEX idx_pagrest_rest     ON public.pagos_rest (id_restaurante);


-- =============================================================================
-- BLOQUE 14: FUNCIONES HELPER PARA RLS
-- =============================================================================

-- ¿El usuario autenticado es propietario de este owner_id?
-- (su auth.uid() coincide directamente con owners.id_owner)
CREATE OR REPLACE FUNCTION public.es_owner_de(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid() = p_owner_id;
$$;

-- ¿El usuario autenticado tiene acceso a este hotel?
-- (es el owner del módulo al que pertenece, o tiene un rol asignado)
CREATE OR REPLACE FUNCTION public.tiene_acceso_hotel(p_id_hotel uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    -- Es el owner del módulo
    SELECT 1
    FROM public.hoteles h
    JOIN public.business_modules bm ON bm.id_module = h.id_module
    WHERE h.id_hotel = p_id_hotel
      AND bm.owner_id = auth.uid()
  )
  OR EXISTS (
    -- Es staff con acceso a ese hotel o a todos los del owner
    SELECT 1
    FROM public.usuarios_roles ur
    JOIN public.hoteles h ON h.id_hotel = p_id_hotel
    JOIN public.business_modules bm ON bm.id_module = h.id_module
    WHERE ur.user_id = auth.uid()
      AND ur.owner_id = bm.owner_id
      AND ur.estado = 'activo'
      AND (ur.id_hotel = p_id_hotel OR ur.id_hotel IS NULL)
  );
$$;

-- Rol del usuario en el contexto de un hotel
CREATE OR REPLACE FUNCTION public.rol_en_hotel(p_id_hotel uuid)
RETURNS varchar
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Si es el owner, retorna 'PROPIETARIO'
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.hoteles h
      JOIN public.business_modules bm ON bm.id_module = h.id_module
      WHERE h.id_hotel = p_id_hotel AND bm.owner_id = auth.uid()
    ) THEN 'PROPIETARIO'
    ELSE (
      SELECT ur.rol
      FROM public.usuarios_roles ur
      JOIN public.hoteles h ON h.id_hotel = p_id_hotel
      JOIN public.business_modules bm ON bm.id_module = h.id_module
      WHERE ur.user_id = auth.uid()
        AND ur.owner_id = bm.owner_id
        AND ur.estado = 'activo'
        AND (ur.id_hotel = p_id_hotel OR ur.id_hotel IS NULL)
      ORDER BY
        CASE ur.rol
          WHEN 'ADMIN'    THEN 1
          WHEN 'CONTADOR' THEN 2
          ELSE 3
        END
      LIMIT 1
    )
  END;
$$;

-- ¿El usuario tiene acceso al módulo de restaurante?
CREATE OR REPLACE FUNCTION public.tiene_acceso_restaurante(p_id_restaurante bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurante r
    JOIN public.business_modules bm ON bm.id_module = r.id_module
    WHERE r.id_restaurante = p_id_restaurante
      AND (
        bm.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.usuarios_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.owner_id = bm.owner_id
            AND ur.id_module = r.id_module
            AND ur.estado = 'activo'
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.es_owner_de(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_hotel(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.rol_en_hotel(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_restaurante(bigint) TO authenticated;


-- =============================================================================
-- BLOQUE 15: ROW LEVEL SECURITY
-- Patrón: subir por la jerarquía hasta business_modules para verificar owner
-- =============================================================================

-- owners -------------------------------------------------------
-- El owner solo ve y edita su propio registro (auth.uid() = id_owner)
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON public.owners FOR SELECT
  USING (id_owner = auth.uid());
CREATE POLICY "owner_update" ON public.owners FOR UPDATE
  USING (id_owner = auth.uid());

-- planes_suscripcion -------------------------------------------
-- Tabla global, cualquier usuario autenticado puede ver los planes
ALTER TABLE public.planes_suscripcion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planes_select" ON public.planes_suscripcion FOR SELECT
  USING (true);

-- suscripciones_owner ------------------------------------------
ALTER TABLE public.suscripciones_owner ENABLE ROW LEVEL SECURITY;
CREATE POLICY "susc_select" ON public.suscripciones_owner FOR SELECT
  USING (owner_id = auth.uid());
CREATE POLICY "susc_write" ON public.suscripciones_owner FOR ALL
  USING (owner_id = auth.uid());

-- business_modules ---------------------------------------------
ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bmod_select" ON public.business_modules FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.usuarios_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.owner_id = business_modules.owner_id
        AND ur.id_module = business_modules.id_module
        AND ur.estado = 'activo'
    )
  );
CREATE POLICY "bmod_write" ON public.business_modules FOR ALL
  USING (owner_id = auth.uid());

-- hoteles ------------------------------------------------------
ALTER TABLE public.hoteles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hotel_select" ON public.hoteles FOR SELECT
  USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "hotel_insert" ON public.hoteles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_modules bm
      WHERE bm.id_module = hoteles.id_module
        AND bm.owner_id = auth.uid()
    )
  );
CREATE POLICY "hotel_update" ON public.hoteles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_modules bm
      WHERE bm.id_module = hoteles.id_module
        AND bm.owner_id = auth.uid()
    )
  );
CREATE POLICY "hotel_delete" ON public.hoteles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.business_modules bm
      WHERE bm.id_module = hoteles.id_module
        AND bm.owner_id = auth.uid()
    )
  );

-- configuracion_hotelera ----------------------------------------
ALTER TABLE public.configuracion_hotelera ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_all" ON public.configuracion_hotelera FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- tipos_habitacion ---------------------------------------------
ALTER TABLE public.tipos_habitacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipohab_all" ON public.tipos_habitacion FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- categorias_tarifa --------------------------------------------
ALTER TABLE public.categorias_tarifa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cattarifa_all" ON public.categorias_tarifa FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- tarifas ------------------------------------------------------
ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tar_all" ON public.tarifas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tipos_habitacion th
      WHERE th.id_tipo_habitacion = tarifas.id_tipo_habitacion
        AND public.tiene_acceso_hotel(th.id_hotel)
    )
  );

-- habitaciones -------------------------------------------------
ALTER TABLE public.habitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hab_all" ON public.habitaciones FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- habitacion_comodidades ---------------------------------------
ALTER TABLE public.habitacion_comodidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habcomod_all" ON public.habitacion_comodidades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habitaciones h
      WHERE h.id_habitacion = habitacion_comodidades.id_habitacion
        AND public.tiene_acceso_hotel(h.id_hotel)
    )
  );

-- habitacion_imagenes ------------------------------------------
ALTER TABLE public.habitacion_imagenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "habimg_all" ON public.habitacion_imagenes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habitaciones h
      WHERE h.id_habitacion = habitacion_imagenes.id_habitacion
        AND public.tiene_acceso_hotel(h.id_hotel)
    )
  );

-- comodidades_hotel --------------------------------------------
ALTER TABLE public.comodidades_hotel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comod_all" ON public.comodidades_hotel FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- servicios_adicionales ----------------------------------------
ALTER TABLE public.servicios_adicionales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "srv_all" ON public.servicios_adicionales FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- bloqueos_habitacion ------------------------------------------
ALTER TABLE public.bloqueos_habitacion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bloq_all" ON public.bloqueos_habitacion FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habitaciones h
      WHERE h.id_habitacion = bloqueos_habitacion.id_habitacion
        AND public.tiene_acceso_hotel(h.id_hotel)
    )
  );

-- huespedes ----------------------------------------------------
ALTER TABLE public.huespedes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hues_all" ON public.huespedes FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- empresas -----------------------------------------------------
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp_all" ON public.empresas FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- reservas_hotel -----------------------------------------------
ALTER TABLE public.reservas_hotel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "res_all" ON public.reservas_hotel FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- pagos_hotel --------------------------------------------------
ALTER TABLE public.pagos_hotel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pag_all" ON public.pagos_hotel FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reservas_hotel r
      WHERE r.id_reserva_hotel = pagos_hotel.id_reserva_hotel
        AND public.tiene_acceso_hotel(r.id_hotel)
    )
  );

-- reserva_comodidades ------------------------------------------
ALTER TABLE public.reserva_comodidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rescomod_all" ON public.reserva_comodidades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reservas_hotel r
      WHERE r.id_reserva_hotel = reserva_comodidades.id_reserva_hotel
        AND public.tiene_acceso_hotel(r.id_hotel)
    )
  );

-- reserva_servicios --------------------------------------------
ALTER TABLE public.reserva_servicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ressrv_all" ON public.reserva_servicios FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reservas_hotel r
      WHERE r.id_reserva_hotel = reserva_servicios.id_reserva_hotel
        AND public.tiene_acceso_hotel(r.id_hotel)
    )
  );

-- saldos_clientes ----------------------------------------------
ALTER TABLE public.saldos_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saldos_all" ON public.saldos_clientes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.huespedes hg
      WHERE hg.id_huesped = saldos_clientes.id_huesped
        AND public.tiene_acceso_hotel(hg.id_hotel)
    )
  );

-- creditos_empresa ---------------------------------------------
ALTER TABLE public.creditos_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creditemp_all" ON public.creditos_empresa FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id_empresa = creditos_empresa.id_empresa
        AND public.tiene_acceso_hotel(e.id_hotel)
    )
  );

-- facturas -----------------------------------------------------
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fact_all" ON public.facturas FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- cierres_diarios ----------------------------------------------
ALTER TABLE public.cierres_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cierre_all" ON public.cierres_diarios FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- usuarios_roles -----------------------------------------------
ALTER TABLE public.usuarios_roles ENABLE ROW LEVEL SECURITY;
-- El owner ve y gestiona todos los roles de su equipo
-- El staff solo ve su propio registro
CREATE POLICY "uroles_select" ON public.usuarios_roles FOR SELECT
  USING (
    owner_id = auth.uid()
    OR user_id = auth.uid()
  );
CREATE POLICY "uroles_write" ON public.usuarios_roles FOR ALL
  USING (owner_id = auth.uid());

-- invitaciones -------------------------------------------------
ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_all" ON public.invitaciones FOR ALL
  USING (owner_id = auth.uid());

-- chat_channels ------------------------------------------------
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chch_all" ON public.chat_channels FOR ALL
  USING (public.tiene_acceso_hotel(id_hotel));

-- chat_messages ------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chmsg_select" ON public.chat_messages FOR SELECT
  USING (
    is_deleted = false
    AND EXISTS (
      SELECT 1 FROM public.chat_channels cc
      WHERE cc.id = chat_messages.channel_id
        AND public.tiene_acceso_hotel(cc.id_hotel)
    )
  );
CREATE POLICY "chmsg_insert" ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_channels cc
      WHERE cc.id = chat_messages.channel_id
        AND public.tiene_acceso_hotel(cc.id_hotel)
    )
  );
CREATE POLICY "chmsg_update" ON public.chat_messages FOR UPDATE
  USING (sender_id = auth.uid());
CREATE POLICY "chmsg_delete" ON public.chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels cc
      JOIN public.business_modules bm ON bm.id_module = cc.id_hotel
      WHERE cc.id = chat_messages.channel_id
        AND bm.owner_id = auth.uid()
    )
  );

-- chat_read_status ---------------------------------------------
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chread_all" ON public.chat_read_status FOR ALL
  USING (user_id = auth.uid());

-- chat_references ----------------------------------------------
ALTER TABLE public.chat_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chref_all" ON public.chat_references FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages cm
      JOIN public.chat_channels cc ON cc.id = cm.channel_id
      WHERE cm.id = chat_references.message_id
        AND public.tiene_acceso_hotel(cc.id_hotel)
    )
  );

-- audit_log ----------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select" ON public.audit_log FOR SELECT
  USING (owner_id = auth.uid());
-- INSERT solo desde triggers (service_role), no desde usuarios

-- restaurante --------------------------------------------------
ALTER TABLE public.restaurante ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rest_all" ON public.restaurante FOR ALL
  USING (public.tiene_acceso_restaurante(id_restaurante));

ALTER TABLE public.inventario_costos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invcost_all" ON public.inventario_costos FOR ALL
  USING (public.tiene_acceso_restaurante(id_restaurante));

ALTER TABLE public.categorias_gasto_rest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catrest_all" ON public.categorias_gasto_rest FOR ALL
  USING (public.tiene_acceso_restaurante(id_restaurante));

ALTER TABLE public.pagos_rest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pagrest_all" ON public.pagos_rest FOR ALL
  USING (public.tiene_acceso_restaurante(id_restaurante));


-- =============================================================================
-- BLOQUE 16: TRIGGER DE AUDITORÍA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_owner_id  uuid;
  v_hotel_id  uuid;
  v_row       jsonb;
BEGIN
  v_row := CASE TG_OP WHEN 'DELETE' THEN row_to_json(OLD)::jsonb
                      ELSE row_to_json(NEW)::jsonb END;

  -- Intentar obtener id_hotel del registro
  BEGIN v_hotel_id := (v_row ->> 'id_hotel')::uuid; EXCEPTION WHEN others THEN v_hotel_id := NULL; END;

  -- Obtener owner_id subiendo por la jerarquía
  IF v_hotel_id IS NOT NULL THEN
    SELECT bm.owner_id INTO v_owner_id
    FROM public.hoteles h
    JOIN public.business_modules bm ON bm.id_module = h.id_module
    WHERE h.id_hotel = v_hotel_id;
  ELSE
    BEGIN v_owner_id := (v_row ->> 'owner_id')::uuid; EXCEPTION WHEN others THEN v_owner_id := NULL; END;
  END IF;

  IF v_owner_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  INSERT INTO public.audit_log (
    owner_id, id_hotel, accion, entidad, entidad_id,
    usuario_id, usuario_email, datos_anteriores, datos_nuevos, cambios_resumidos
  ) VALUES (
    v_owner_id,
    v_hotel_id,
    TG_OP,
    TG_TABLE_NAME,
    (v_row ->> 'id')::uuid,
    auth.uid(),
    auth.email(),
    CASE TG_OP WHEN 'DELETE' THEN v_row WHEN 'UPDATE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE v_row END,
    TG_OP || ' en ' || TG_TABLE_NAME
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reservas_hotel','pagos_hotel','habitaciones',
    'huespedes','bloqueos_habitacion','saldos_clientes',
    'usuarios_roles','empresas','cierres_diarios','hoteles'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;
       CREATE TRIGGER trg_audit_%I
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();',
      t, t, t, t);
  END LOOP;
END $$;


-- =============================================================================
-- BLOQUE 17: VISTAS DEL DASHBOARD
-- =============================================================================

-- Hoteles del owner autenticado con ocupación
CREATE OR REPLACE VIEW public.v_mis_hoteles AS
SELECT
  h.id_hotel,
  h.nombre_hotel,
  h.ciudad,
  h.estado,
  bm.owner_id,
  COUNT(DISTINCT hab.id_habitacion)                                               AS total_hab,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'disponible')     AS disponibles,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')        AS ocupadas,
  ROUND(100.0 * COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')
    / NULLIF(COUNT(DISTINCT hab.id_habitacion), 0), 2)                           AS pct_ocupacion
FROM public.hoteles h
JOIN public.business_modules bm ON bm.id_module = h.id_module
LEFT JOIN public.habitaciones hab ON hab.id_hotel = h.id_hotel
WHERE bm.owner_id = auth.uid()
GROUP BY h.id_hotel, h.nombre_hotel, h.ciudad, h.estado, bm.owner_id;

-- Agenda del día (check-ins y check-outs de hoy)
CREATE OR REPLACE VIEW public.v_agenda_hoy AS
SELECT
  r.id_reserva_hotel,
  h.id_hotel,
  h.nombre_hotel,
  bm.owner_id,
  hg.nombre_completo  AS huesped,
  hg.telefono,
  hab.codigo_habitacion,
  hab.nombre_habitacion,
  r.check_in,
  r.check_out,
  r.estado,
  r.estado_pago,
  r.total_reserva,
  CASE
    WHEN r.check_in::date  = CURRENT_DATE AND r.estado = 'confirmada' THEN 'check_in_hoy'
    WHEN r.check_out::date = CURRENT_DATE AND r.estado = 'check_in'   THEN 'check_out_hoy'
    ELSE r.estado
  END AS accion_hoy
FROM public.reservas_hotel r
JOIN public.hoteles h        ON h.id_hotel       = r.id_hotel
JOIN public.business_modules bm ON bm.id_module  = h.id_module
JOIN public.huespedes hg     ON hg.id_huesped    = r.id_huesped
JOIN public.habitaciones hab ON hab.id_habitacion = r.id_habitacion
WHERE bm.owner_id = auth.uid()
  AND (r.check_in::date = CURRENT_DATE OR r.check_out::date = CURRENT_DATE)
  AND r.estado NOT IN ('cancelada','no_show');

-- Módulos activos del owner
CREATE OR REPLACE VIEW public.v_mis_modulos AS
SELECT
  bm.id_module,
  bm.owner_id,
  bm.tipo_modulo,
  bm.nombre_modulo,
  bm.estado,
  s.estado           AS estado_suscripcion,
  s.id_plan,
  s.current_period_end,
  s.trial_end
FROM public.business_modules bm
LEFT JOIN public.suscripciones_owner s
  ON s.owner_id = bm.owner_id
 AND s.tipo_modulo = bm.tipo_modulo
 AND s.estado IN ('activa','trial')
WHERE bm.owner_id = auth.uid();

GRANT SELECT ON public.v_mis_hoteles  TO authenticated;
GRANT SELECT ON public.v_agenda_hoy   TO authenticated;
GRANT SELECT ON public.v_mis_modulos  TO authenticated;


-- =============================================================================
-- BLOQUE 18: SEED — Planes base del SaaS
-- =============================================================================
INSERT INTO public.planes_suscripcion
  (id_plan, tipo_modulo, nombre, descripcion, limite_negocios, precio_mensual, precio_anual, features)
VALUES
  ('hotel_starter',  'hotel',      'Starter',  '1 hotel',            1,  29.00,  290.00, '["1 hotel","Reservas","Chat","Reportes básicos"]'),
  ('hotel_pro',      'hotel',      'Pro',       'Hasta 5 hoteles',    5,  79.00,  790.00, '["5 hoteles","Todo Starter","API","Reportes avanzados"]'),
  ('hotel_business', 'hotel',      'Business',  'Hasta 20 hoteles',  20, 199.00, 1990.00, '["20 hoteles","Todo Pro","Soporte prioritario"]'),
  ('rest_starter',   'restaurant', 'Starter',   '1 restaurante',      1,  19.00,  190.00, '["1 restaurante","Inventario","Pagos"]'),
  ('rest_pro',       'restaurant', 'Pro',        '5 restaurantes',    5,  49.00,  490.00, '["5 restaurantes","Todo Starter","Reportes"]')
ON CONFLICT (id_plan) DO NOTHING;


-- =============================================================================
-- FIN — Hotel Manager SaaS Schema v2.0
-- auth.uid() = id_owner | owner_id solo en tablas raíz | joins limpios
-- =============================================================================