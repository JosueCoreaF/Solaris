-- =============================================================================
-- SOLARIS — SCHEMA COMPLETO MÓDULO HOTEL
-- Ejecutar en una base de datos Supabase limpia (requiere extension uuid-ossp).
-- Orden: base → hotel → tarifas por período → empresas y créditos
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- BASE: Infraestructura core
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.owners (
  id_owner          uuid        NOT NULL,
  nombre_empresa    varchar     NOT NULL,
  email_contacto    varchar     NOT NULL UNIQUE,
  telefono_contacto varchar,
  estado            varchar     NOT NULL DEFAULT 'activo'
                      CHECK (estado IN ('activo','inactivo','suspendido')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owners_pkey      PRIMARY KEY (id_owner),
  CONSTRAINT owners_auth_fkey FOREIGN KEY (id_owner) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.planes_suscripcion (
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

CREATE TABLE IF NOT EXISTS public.suscripciones_owner (
  id_suscripcion         uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id               uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  tipo_modulo            varchar     NOT NULL,
  id_plan                varchar     NOT NULL REFERENCES public.planes_suscripcion(id_plan),
  stripe_customer_id     varchar,
  stripe_subscription_id varchar,
  estado                 varchar     NOT NULL DEFAULT 'trial'
                           CHECK (estado IN ('activa','inactiva','cancelada','impaga','trial')),
  trial_end              timestamptz,
  current_period_end     timestamptz,
  negocios_extra         integer     NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suscripciones_owner_pkey PRIMARY KEY (id_suscripcion)
);

CREATE TABLE IF NOT EXISTS public.owner_metodos_pago (
  id_metodo  uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id   uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  brand      varchar     NOT NULL,
  last4      varchar     NOT NULL,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_metodos_pago_pkey PRIMARY KEY (id_metodo)
);

CREATE TABLE IF NOT EXISTS public.historial_pagos (
  id_pago        uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id       uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  id_suscripcion uuid        REFERENCES public.suscripciones_owner(id_suscripcion),
  concepto       varchar     NOT NULL,
  metodo_pago    varchar     NOT NULL,
  monto          numeric     NOT NULL DEFAULT 0.00,
  estado         varchar     NOT NULL DEFAULT 'completado'
                   CHECK (estado IN ('completado','fallido','pendiente')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historial_pagos_pkey PRIMARY KEY (id_pago)
);

CREATE TABLE IF NOT EXISTS public.preferencias_usuario (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema                   varchar     NOT NULL DEFAULT 'claro' CHECK (tema IN ('claro','oscuro')),
  idioma                 varchar     NOT NULL DEFAULT 'es'    CHECK (idioma IN ('es','en')),
  notificaciones_activas boolean     NOT NULL DEFAULT true,
  login_automatico       boolean     NOT NULL DEFAULT false,
  recordar_dispositivo   boolean     NOT NULL DEFAULT false,
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferencias_usuario_pkey       PRIMARY KEY (id),
  CONSTRAINT preferencias_usuario_uid_unique UNIQUE (usuario_id)
);

CREATE TABLE IF NOT EXISTS public.bitacora_actividad (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  usuario_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accion           varchar     NOT NULL,
  tabla_afectada   varchar     NOT NULL DEFAULT '',
  valores_antiguos jsonb,
  valores_nuevos   jsonb,
  timestamp        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bitacora_actividad_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.business_modules (
  id_module     uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  tipo_modulo   varchar     NOT NULL CHECK (tipo_modulo IN ('hotel','restaurant','gym','store')),
  nombre_modulo varchar     NOT NULL,
  estado        varchar     NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo','inactivo','mantenimiento')),
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_modules_pkey PRIMARY KEY (id_module)
);

CREATE TABLE IF NOT EXISTS public.usuarios_roles (
  id         uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id   uuid    NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  id_module  uuid    REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  id_hotel   uuid,   -- FK a hoteles se agrega después
  rol        varchar NOT NULL CHECK (rol IN (
               'ADMIN','RECEPCIONISTA','MANTENIMIENTO','CONTADOR',
               'MESERO','COCINA','ENTRENADOR','VENDEDOR'
             )),
  estado     varchar NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('activo','inactivo','suspendido','pendiente')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_roles_pkey             PRIMARY KEY (id),
  CONSTRAINT usuarios_roles_user_owner_unico UNIQUE (user_id, owner_id, id_module)
);

CREATE TABLE IF NOT EXISTS public.invitaciones (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  email        varchar     NOT NULL,
  codigo_unico varchar     NOT NULL UNIQUE,
  id_module    uuid        REFERENCES public.business_modules(id_module),
  id_hotel     uuid,       -- FK a hoteles se agrega después
  rol_sugerido varchar     NOT NULL DEFAULT 'RECEPCIONISTA'
                 CHECK (rol_sugerido IN ('ADMIN','RECEPCIONISTA','MANTENIMIENTO','CONTADOR','MESERO','COCINA','ENTRENADOR','VENDEDOR')),
  usado        boolean     NOT NULL DEFAULT false,
  user_id      uuid        REFERENCES auth.users(id),
  expira_en    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitaciones_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id         uuid        NOT NULL REFERENCES public.owners(id_owner),
  id_hotel         uuid,       -- FK a hoteles se agrega después
  accion           varchar     NOT NULL CHECK (accion IN (
                     'INSERT','UPDATE','DELETE','LOGIN','LOGOUT',
                     'CREATE_USER','CHANGE_ROLE','APPLY_BALANCE','CANCEL_PAYMENT',
                     'CREATE_INVOICE','CANCEL_RESERVATION','CHECK_IN','CHECK_OUT',
                     'BLOCK_ROOM','UNBLOCK_ROOM'
                   )),
  entidad          varchar     NOT NULL,
  entidad_id       uuid,
  usuario_id       uuid        REFERENCES auth.users(id),
  usuario_email    varchar,
  usuario_rol      varchar,
  datos_anteriores jsonb,
  datos_nuevos     jsonb,
  cambios_resumidos text,
  ip_cliente       varchar,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

-- ── Índices base ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bmod_owner    ON public.business_modules (owner_id);
CREATE INDEX IF NOT EXISTS idx_bmod_tipo     ON public.business_modules (owner_id, tipo_modulo);
CREATE INDEX IF NOT EXISTS idx_susc_owner    ON public.suscripciones_owner (owner_id);
CREATE INDEX IF NOT EXISTS idx_uroles_user   ON public.usuarios_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_uroles_owner  ON public.usuarios_roles (owner_id);
CREATE INDEX IF NOT EXISTS idx_uroles_module ON public.usuarios_roles (id_module) WHERE id_module IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uroles_estado ON public.usuarios_roles (owner_id, estado);
CREATE INDEX IF NOT EXISTS idx_inv_owner     ON public.invitaciones (owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_owner   ON public.audit_log (owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_fecha   ON public.audit_log (owner_id, created_at DESC);

-- ── RLS base ──────────────────────────────────────────────────────────────────
ALTER TABLE public.owners              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_suscripcion  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_modules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_select"  ON public.owners FOR SELECT USING (id_owner = auth.uid());
CREATE POLICY "owner_update"  ON public.owners FOR UPDATE USING (id_owner = auth.uid());
CREATE POLICY "owners_insert" ON public.owners FOR INSERT WITH CHECK (true);

CREATE POLICY "planes_select" ON public.planes_suscripcion FOR SELECT USING (true);

CREATE POLICY "susc_select" ON public.suscripciones_owner FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "susc_write"  ON public.suscripciones_owner FOR ALL   USING (owner_id = auth.uid());

CREATE POLICY "bmod_select" ON public.business_modules FOR SELECT
  USING (owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.usuarios_roles ur
    WHERE ur.user_id = auth.uid() AND ur.owner_id = business_modules.owner_id
      AND ur.id_module = business_modules.id_module AND ur.estado = 'activo'
  ));
CREATE POLICY "bmod_write" ON public.business_modules FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "uroles_select"      ON public.usuarios_roles FOR SELECT USING (owner_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "uroles_write"       ON public.usuarios_roles FOR ALL   USING (owner_id = auth.uid());
CREATE POLICY "uroles_insert_self" ON public.usuarios_roles FOR INSERT WITH CHECK (user_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "inv_all"      ON public.invitaciones FOR ALL    USING (owner_id = auth.uid());
CREATE POLICY "audit_select" ON public.audit_log    FOR SELECT USING (owner_id = auth.uid());

-- ── Función helper RLS base ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.es_owner_de(p_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.uid() = p_owner_id;
$$;
GRANT EXECUTE ON FUNCTION public.es_owner_de(uuid) TO authenticated;

-- ── Vistas base ───────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_mis_modulos AS
SELECT bm.id_module, bm.owner_id, bm.tipo_modulo, bm.nombre_modulo, bm.estado,
  s.estado AS estado_suscripcion, s.id_plan, s.current_period_end, s.trial_end
FROM public.business_modules bm
LEFT JOIN public.suscripciones_owner s
  ON s.owner_id = bm.owner_id AND s.tipo_modulo = bm.tipo_modulo AND s.estado IN ('activa','trial')
WHERE bm.owner_id = auth.uid();
GRANT SELECT ON public.v_mis_modulos TO authenticated;

DROP VIEW IF EXISTS public.usuarios_roles_con_email CASCADE;
CREATE OR REPLACE VIEW public.usuarios_roles_con_email AS
SELECT ur.id, ur.user_id, ur.owner_id, ur.id_hotel, ur.rol, ur.estado,
  ur.created_at AS creado_en, ur.updated_at AS actualizado_en, au.email
FROM public.usuarios_roles ur
LEFT JOIN auth.users au ON au.id = ur.user_id;
GRANT SELECT ON public.usuarios_roles_con_email TO authenticated, service_role;

-- ── Trigger onboarding ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_id uuid; v_nombre varchar; v_email varchar;
BEGIN
  v_email  := COALESCE(NULLIF(TRIM(NEW.email),''), NEW.id::text || '@sin-email.local');
  v_nombre := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre_empresa'),''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'),''),
    split_part(v_email,'@',1)
  );
  INSERT INTO public.owners (id_owner, nombre_empresa, email_contacto, estado)
  VALUES (NEW.id, v_nombre, v_email, 'activo')
  RETURNING id_owner INTO v_owner_id;
  INSERT INTO public.usuarios_roles (owner_id, user_id, rol, estado)
  VALUES (v_owner_id, NEW.id, 'ADMIN', 'activo');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();
GRANT EXECUTE ON FUNCTION public.fn_handle_new_user() TO supabase_auth_admin;

-- ── Seed planes ───────────────────────────────────────────────────────────────
INSERT INTO public.planes_suscripcion (id_plan, tipo_modulo, nombre, descripcion, limite_negocios, precio_mensual, precio_anual, features)
VALUES
  ('hotel_starter',  'hotel',      'Starter',  '1 hotel',          1,  29.00,  290.00, '["1 hotel","Reservas","Chat","Reportes básicos"]'),
  ('hotel_pro',      'hotel',      'Pro',       'Hasta 5 hoteles',  5,  79.00,  790.00, '["5 hoteles","Todo Starter","Reportes avanzados"]'),
  ('hotel_business', 'hotel',      'Business',  'Hasta 20 hoteles', 20,199.00,1990.00, '["20 hoteles","Todo Pro","Soporte prioritario"]'),
  ('rest_starter',   'restaurant', 'Starter',   '1 restaurante',    1,  19.00,  190.00, '["1 restaurante","Inventario","Pagos"]'),
  ('rest_pro',       'restaurant', 'Pro',        '5 restaurantes',  5,  49.00,  490.00, '["5 restaurantes","Todo Starter","Reportes"]'),
  ('gym_starter',    'gym',        'Starter',   '1 gimnasio',       1,  19.00,  190.00, '["1 gimnasio","Miembros","Clases","Pagos"]'),
  ('gym_pro',        'gym',        'Pro',        '3 gimnasios',     3,  49.00,  490.00, '["3 gimnasios","Todo Starter","Reportes"]')
ON CONFLICT (id_plan) DO NOTHING;


-- =============================================================================
-- HOTEL: Tablas del módulo
-- =============================================================================

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

-- FKs diferidas a hoteles (tablas creadas antes)
-- Eliminadas para soportar polimorfismo en módulos (Gimnasios y Restaurantes comparten usuarios_roles/invitaciones)
-- ALTER TABLE public.audit_log      ADD CONSTRAINT IF NOT EXISTS audit_log_hotel_fkey      FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel);
-- ALTER TABLE public.usuarios_roles ADD CONSTRAINT IF NOT EXISTS uroles_hotel_fkey          FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel);
-- ALTER TABLE public.invitaciones   ADD CONSTRAINT IF NOT EXISTS invitaciones_hotel_fkey    FOREIGN KEY (id_hotel) REFERENCES public.hoteles(id_hotel);

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

-- ── Tarifas por período (por habitación individual) ───────────────────────────
-- es_base=true → tarifa permanente (fallback)
-- es_base=false → temporada especial con rango de fechas
CREATE TABLE IF NOT EXISTS public.habitacion_tarifas_periodo (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_habitacion  uuid        NOT NULL REFERENCES public.habitaciones(id_habitacion) ON DELETE CASCADE,
  id_tarifa      uuid        REFERENCES public.tarifas(id_tarifa) ON DELETE SET NULL,
  tarifa_noche   numeric     NOT NULL DEFAULT 0 CHECK (tarifa_noche >= 0),
  nombre_periodo varchar,
  fecha_desde    date,
  fecha_hasta    date,
  es_base        boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habitacion_tarifas_periodo_pkey PRIMARY KEY (id)
);

-- Solo puede haber una tarifa base por habitación
CREATE UNIQUE INDEX IF NOT EXISTS idx_htp_base_unico
  ON public.habitacion_tarifas_periodo(id_habitacion)
  WHERE es_base = true;

CREATE INDEX IF NOT EXISTS idx_htp_habitacion ON public.habitacion_tarifas_periodo(id_habitacion);
CREATE INDEX IF NOT EXISTS idx_htp_fechas     ON public.habitacion_tarifas_periodo(id_habitacion, fecha_desde, fecha_hasta);

-- ── Huéspedes y empresas ──────────────────────────────────────────────────────
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
  limite_credito    numeric     NOT NULL DEFAULT 0.00 CHECK (limite_credito >= 0),
  dias_credito      integer     NOT NULL DEFAULT 30   CHECK (dias_credito > 0),
  estado            varchar     NOT NULL DEFAULT 'activo'
                      CHECK (estado IN ('activo','inactivo','suspendido')),
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresas_pkey PRIMARY KEY (id_empresa)
);

-- Huéspedes vinculados a una empresa (para filtrar colaboradores en reservas)
CREATE TABLE IF NOT EXISTS public.empresa_colaboradores (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_empresa uuid        NOT NULL REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
  id_huesped uuid        NOT NULL REFERENCES public.huespedes(id_huesped) ON DELETE CASCADE,
  cargo      varchar,
  activo     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_colaboradores_pkey  PRIMARY KEY (id),
  CONSTRAINT empresa_colaboradores_unico UNIQUE (id_empresa, id_huesped)
);

CREATE INDEX IF NOT EXISTS idx_emp_colab_empresa ON public.empresa_colaboradores(id_empresa);
CREATE INDEX IF NOT EXISTS idx_emp_colab_huesped ON public.empresa_colaboradores(id_huesped);

-- ── Reservas y pagos ──────────────────────────────────────────────────────────
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

-- Ledger de movimientos cargo/abono por empresa
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

-- Crédito pendiente por reserva (generado automáticamente al asignar empresa)
CREATE TABLE IF NOT EXISTS public.empresa_creditos (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_empresa        uuid        NOT NULL REFERENCES public.empresas(id_empresa) ON DELETE CASCADE,
  id_hotel          uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  id_reserva        uuid        REFERENCES public.reservas_hotel(id_reserva_hotel) ON DELETE SET NULL,
  monto             numeric     NOT NULL CHECK (monto >= 0),
  saldo_restante    numeric     NOT NULL CHECK (saldo_restante >= 0),
  fecha_emision     date        NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento date        NOT NULL,
  estado            varchar     NOT NULL DEFAULT 'activo'
                      CHECK (estado IN ('activo','pagado','vencido','anulado')),
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT empresa_creditos_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_emp_creditos_empresa ON public.empresa_creditos(id_empresa);
CREATE INDEX IF NOT EXISTS idx_emp_creditos_hotel   ON public.empresa_creditos(id_hotel);
CREATE INDEX IF NOT EXISTS idx_emp_creditos_vencim  ON public.empresa_creditos(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_emp_creditos_estado  ON public.empresa_creditos(estado);

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
  snapshot         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cierres_diarios_pkey      PRIMARY KEY (id),
  CONSTRAINT cierres_hotel_fecha_unico UNIQUE (id_hotel, fecha)
);

-- ── Mantenimiento ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tareas_mantenimiento (
  id_tarea        uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel        uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  owner_id        uuid        NOT NULL REFERENCES auth.users(id),
  id_habitacion   uuid        REFERENCES public.habitaciones(id_habitacion) ON DELETE SET NULL,
  titulo          text        NOT NULL,
  descripcion     text,
  prioridad       varchar     NOT NULL DEFAULT 'media'
                    CHECK (prioridad IN ('baja','media','alta','urgente')),
  estado          varchar     NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_progreso','completada','cancelada')),
  asignado_a      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  asignado_nombre varchar,
  creado_por      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_nombre   varchar,
  fecha_limite    date,
  completada_at   timestamptz,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tareas_mantenimiento_pkey PRIMARY KEY (id_tarea)
);

-- ── Chat operativo ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel     uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  name         varchar     NOT NULL,
  description  text,
  channel_type varchar     DEFAULT 'general'
                 CHECK (channel_type IN ('general','operativo','cliente','privado')),
  id_huesped   uuid        REFERENCES public.huespedes(id_huesped),
  created_by   uuid        REFERENCES auth.users(id),
  metadata     jsonb       DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_channels_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  channel_id    uuid        NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id     uuid        REFERENCES auth.users(id),
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

-- ── Notificaciones in-app ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id_notificacion uuid         NOT NULL DEFAULT gen_random_uuid(),
  id_hotel        uuid         NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  tipo            varchar(40)  NOT NULL,
  titulo          varchar(160) NOT NULL,
  mensaje         text,
  link            text,
  leida           boolean      NOT NULL DEFAULT false,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT notificaciones_pkey PRIMARY KEY (id_notificacion)
);

-- ── Índices hotel ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_uroles_hotel  ON public.usuarios_roles (id_hotel) WHERE id_hotel IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_hotel   ON public.audit_log (id_hotel);
CREATE INDEX IF NOT EXISTS idx_hotel_module  ON public.hoteles (id_module);
CREATE INDEX IF NOT EXISTS idx_hotel_estado  ON public.hoteles (estado);
CREATE INDEX IF NOT EXISTS idx_hotel_slug    ON public.hoteles (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_config_hotel  ON public.configuracion_hotelera (id_hotel);
CREATE INDEX IF NOT EXISTS idx_tipohab_hotel ON public.tipos_habitacion (id_hotel);
CREATE INDEX IF NOT EXISTS idx_hab_hotel     ON public.habitaciones (id_hotel);
CREATE INDEX IF NOT EXISTS idx_hab_estado    ON public.habitaciones (id_hotel, estado);
CREATE INDEX IF NOT EXISTS idx_bloq_hab      ON public.bloqueos_habitacion (id_habitacion);
CREATE INDEX IF NOT EXISTS idx_hues_hotel    ON public.huespedes (id_hotel);
CREATE INDEX IF NOT EXISTS idx_res_hotel     ON public.reservas_hotel (id_hotel);
CREATE INDEX IF NOT EXISTS idx_res_fechas    ON public.reservas_hotel (id_hotel, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_res_estado    ON public.reservas_hotel (id_hotel, estado);
CREATE INDEX IF NOT EXISTS idx_pag_reserva   ON public.pagos_hotel (id_reserva_hotel);
CREATE INDEX IF NOT EXISTS idx_fact_hotel    ON public.facturas (id_hotel);
CREATE INDEX IF NOT EXISTS idx_cierre_hotel  ON public.cierres_diarios (id_hotel);
CREATE INDEX IF NOT EXISTS idx_chch_hotel    ON public.chat_channels (id_hotel);
CREATE INDEX IF NOT EXISTS idx_chmsg_channel ON public.chat_messages (channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entidad ON public.audit_log (owner_id, entidad, entidad_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_hotel_created ON public.notificaciones (id_hotel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_hotel_unread  ON public.notificaciones (id_hotel, leida) WHERE leida = false;


-- =============================================================================
-- FUNCIONES RLS HOTEL
-- =============================================================================

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
    WHEN EXISTS (
      SELECT 1 FROM public.hoteles h
      JOIN public.business_modules bm ON bm.id_module = h.id_module
      WHERE h.id_hotel = p_id_hotel AND bm.owner_id = auth.uid()
    ) THEN 'PROPIETARIO'
    ELSE (
      SELECT ur.rol FROM public.usuarios_roles ur
      JOIN public.hoteles h ON h.id_hotel = p_id_hotel
      JOIN public.business_modules bm ON bm.id_module = h.id_module
      WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id
        AND ur.estado = 'activo' AND (ur.id_hotel = p_id_hotel OR ur.id_hotel IS NULL)
      ORDER BY CASE ur.rol WHEN 'ADMIN' THEN 1 WHEN 'CONTADOR' THEN 2 ELSE 3 END
      LIMIT 1
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.tiene_acceso_hotel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rol_en_hotel(uuid)       TO authenticated;


-- =============================================================================
-- RLS HOTEL
-- =============================================================================

ALTER TABLE public.hoteles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_hotelera    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_habitacion          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_tarifa         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarifas                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitaciones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitacion_comodidades    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitacion_imagenes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comodidades_hotel         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios_adicionales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos_habitacion       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habitacion_tarifas_periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huespedes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_colaboradores     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_hotel            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_hotel               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_comodidades       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserva_servicios         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saldos_clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creditos_empresa          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_creditos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_diarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_mantenimiento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_status          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_references           ENABLE ROW LEVEL SECURITY;

-- Hoteles
CREATE POLICY "hotel_select"        ON public.hoteles FOR SELECT USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "hotel_public_select" ON public.hoteles FOR SELECT TO anon, authenticated USING (estado = 'activo');
CREATE POLICY "hotel_insert" ON public.hoteles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = hoteles.id_module AND bm.owner_id = auth.uid()));
CREATE POLICY "hotel_update" ON public.hoteles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = hoteles.id_module AND bm.owner_id = auth.uid()));
CREATE POLICY "hotel_delete" ON public.hoteles FOR DELETE USING (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = hoteles.id_module AND bm.owner_id = auth.uid()));

-- Configuración / tipos / categorías
CREATE POLICY "config_all"           ON public.configuracion_hotelera    FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "config_public_select" ON public.configuracion_hotelera    FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.hoteles h WHERE h.id_hotel = configuracion_hotelera.id_hotel AND h.estado = 'activo'));
CREATE POLICY "tipohab_all"          ON public.tipos_habitacion           FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "tipohab_public_select" ON public.tipos_habitacion          FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.hoteles h WHERE h.id_hotel = tipos_habitacion.id_hotel AND h.estado = 'activo'));
CREATE POLICY "cattarifa_all"        ON public.categorias_tarifa          FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "tar_all"              ON public.tarifas                    FOR ALL    USING (EXISTS (SELECT 1 FROM public.tipos_habitacion th WHERE th.id_tipo_habitacion = tarifas.id_tipo_habitacion AND public.tiene_acceso_hotel(th.id_hotel)));

-- Habitaciones
CREATE POLICY "hab_all"              ON public.habitaciones               FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "hab_public_select"    ON public.habitaciones               FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.hoteles h WHERE h.id_hotel = habitaciones.id_hotel AND h.estado = 'activo'));
CREATE POLICY "habcomod_all"         ON public.habitacion_comodidades     FOR ALL    USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = habitacion_comodidades.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "habcomod_public_select" ON public.habitacion_comodidades   FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.habitaciones hab JOIN public.hoteles h ON h.id_hotel = hab.id_hotel WHERE hab.id_habitacion = habitacion_comodidades.id_habitacion AND h.estado = 'activo'));
CREATE POLICY "habimg_all"           ON public.habitacion_imagenes        FOR ALL    USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = habitacion_imagenes.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "habimg_public_select" ON public.habitacion_imagenes        FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.habitaciones hab JOIN public.hoteles h ON h.id_hotel = hab.id_hotel WHERE hab.id_habitacion = habitacion_imagenes.id_habitacion AND h.estado = 'activo'));
CREATE POLICY "comod_all"            ON public.comodidades_hotel          FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "srv_all"              ON public.servicios_adicionales      FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "bloq_all"             ON public.bloqueos_habitacion        FOR ALL    USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = bloqueos_habitacion.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "htp_all"              ON public.habitacion_tarifas_periodo FOR ALL    USING (EXISTS (SELECT 1 FROM public.habitaciones h WHERE h.id_habitacion = habitacion_tarifas_periodo.id_habitacion AND public.tiene_acceso_hotel(h.id_hotel)));
CREATE POLICY "htp_public_select"    ON public.habitacion_tarifas_periodo FOR SELECT USING (true);

-- Huéspedes / empresas / colaboradores
CREATE POLICY "hues_all"       ON public.huespedes            FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "emp_all"        ON public.empresas             FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "empcolab_all"   ON public.empresa_colaboradores FOR ALL USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = empresa_colaboradores.id_empresa AND public.tiene_acceso_hotel(e.id_hotel)));

-- Reservas / pagos / servicios
CREATE POLICY "res_all"      ON public.reservas_hotel      FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "pag_all"      ON public.pagos_hotel         FOR ALL USING (EXISTS (SELECT 1 FROM public.reservas_hotel r WHERE r.id_reserva_hotel = pagos_hotel.id_reserva_hotel AND public.tiene_acceso_hotel(r.id_hotel)));
CREATE POLICY "rescomod_all" ON public.reserva_comodidades FOR ALL USING (EXISTS (SELECT 1 FROM public.reservas_hotel r WHERE r.id_reserva_hotel = reserva_comodidades.id_reserva_hotel AND public.tiene_acceso_hotel(r.id_hotel)));
CREATE POLICY "ressrv_all"   ON public.reserva_servicios   FOR ALL USING (EXISTS (SELECT 1 FROM public.reservas_hotel r WHERE r.id_reserva_hotel = reserva_servicios.id_reserva_hotel AND public.tiene_acceso_hotel(r.id_hotel)));
CREATE POLICY "saldos_all"   ON public.saldos_clientes     FOR ALL USING (EXISTS (SELECT 1 FROM public.huespedes hg WHERE hg.id_huesped = saldos_clientes.id_huesped AND public.tiene_acceso_hotel(hg.id_hotel)));
CREATE POLICY "creditemp_all" ON public.creditos_empresa   FOR ALL USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id_empresa = creditos_empresa.id_empresa AND public.tiene_acceso_hotel(e.id_hotel)));
CREATE POLICY "empcred_all"  ON public.empresa_creditos    FOR ALL USING (public.tiene_acceso_hotel(id_hotel));

-- Finanzas / mantenimiento
CREATE POLICY "fact_all"   ON public.facturas             FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "cierre_all" ON public.cierres_diarios      FOR ALL USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "tarea_all"  ON public.tareas_mantenimiento FOR ALL USING (public.tiene_acceso_hotel(id_hotel));

-- Chat
CREATE POLICY "chch_all"     ON public.chat_channels    FOR ALL    USING (public.tiene_acceso_hotel(id_hotel));
CREATE POLICY "chmsg_select" ON public.chat_messages    FOR SELECT USING (is_deleted = false AND EXISTS (SELECT 1 FROM public.chat_channels cc WHERE cc.id = chat_messages.channel_id AND public.tiene_acceso_hotel(cc.id_hotel)));
CREATE POLICY "chmsg_insert" ON public.chat_messages    FOR INSERT WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_channels cc WHERE cc.id = chat_messages.channel_id AND public.tiene_acceso_hotel(cc.id_hotel)));
CREATE POLICY "chmsg_update" ON public.chat_messages    FOR UPDATE USING (sender_id = auth.uid());
CREATE POLICY "chread_all"   ON public.chat_read_status FOR ALL    USING (user_id = auth.uid());
CREATE POLICY "chref_all"    ON public.chat_references  FOR ALL    USING (EXISTS (SELECT 1 FROM public.chat_messages cm JOIN public.chat_channels cc ON cc.id = cm.channel_id WHERE cm.id = chat_references.message_id AND public.tiene_acceso_hotel(cc.id_hotel)));


-- =============================================================================
-- VISTAS HOTEL
-- =============================================================================

-- habitaciones_con_detalles: tarifa_noche toma el período base si existe,
-- o cae al campo estático de la habitación
DROP VIEW IF EXISTS public.habitaciones_con_detalles CASCADE;
CREATE OR REPLACE VIEW public.habitaciones_con_detalles AS
SELECT
  h.id_habitacion,
  h.id_hotel,
  h.codigo_habitacion,
  h.nombre_habitacion,
  h.nombre_alias,
  h.piso,
  h.capacidad,
  h.numero_camas,
  h.imagen_360,
  h.estado,
  h.id_tarifa_default,
  t.nombre_tipo AS tipo,
  COALESCE(
    (SELECT tp.tarifa_noche FROM public.habitacion_tarifas_periodo tp
     WHERE tp.id_habitacion = h.id_habitacion AND tp.es_base = true LIMIT 1),
    h.tarifa_noche
  ) AS tarifa_noche,
  COALESCE(
    (SELECT array_agg(hc.nombre_comodidad ORDER BY hc.nombre_comodidad)
     FROM public.habitacion_comodidades hc WHERE hc.id_habitacion = h.id_habitacion),
    '{}'::text[]
  ) AS comodidades,
  COALESCE(
    (SELECT array_agg(hi.url_imagen ORDER BY hi.orden)
     FROM public.habitacion_imagenes hi WHERE hi.id_habitacion = h.id_habitacion),
    '{}'::text[]
  ) AS imagenes
FROM public.habitaciones h
LEFT JOIN public.tipos_habitacion t ON t.id_tipo_habitacion = h.id_tipo_habitacion;
GRANT SELECT ON public.habitaciones_con_detalles TO authenticated;

-- Log de auditoría con fecha local (Tegucigalpa)
CREATE OR REPLACE VIEW public.vw_audit_log_legible AS
SELECT
  al.id, al.owner_id, al.id_hotel, al.accion, al.entidad, al.entidad_id,
  al.usuario_id, al.usuario_email, al.usuario_rol,
  al.datos_anteriores, al.datos_nuevos, al.cambios_resumidos, al.ip_cliente,
  al.created_at AS created_at_iso,
  to_char(al.created_at AT TIME ZONE 'America/Tegucigalpa', 'DD/MM/YYYY HH24:MI:SS') AS fecha_hora,
  EXTRACT(EPOCH FROM (now() - al.created_at))::integer AS segundos_atras,
  NULL::text AS user_agent,
  NULL::text AS referencia_externa,
  NULL::text AS notas
FROM public.audit_log al;
GRANT SELECT ON public.vw_audit_log_legible TO authenticated;

-- Resumen de hoteles del owner con ocupación
CREATE OR REPLACE VIEW public.v_mis_hoteles AS
SELECT
  h.id_hotel, h.nombre_hotel, h.ciudad, h.estado, bm.owner_id,
  COUNT(DISTINCT hab.id_habitacion) AS total_hab,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'disponible') AS disponibles,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')    AS ocupadas,
  ROUND(
    100.0 * COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')
    / NULLIF(COUNT(DISTINCT hab.id_habitacion), 0), 2
  ) AS pct_ocupacion
FROM public.hoteles h
JOIN public.business_modules bm ON bm.id_module = h.id_module
LEFT JOIN public.habitaciones hab ON hab.id_hotel = h.id_hotel
WHERE bm.owner_id = auth.uid()
GROUP BY h.id_hotel, h.nombre_hotel, h.ciudad, h.estado, bm.owner_id;
GRANT SELECT ON public.v_mis_hoteles TO authenticated;

-- Check-ins y check-outs del día actual
CREATE OR REPLACE VIEW public.v_agenda_hoy AS
SELECT
  r.id_reserva_hotel, h.id_hotel, h.nombre_hotel, bm.owner_id,
  hg.nombre_completo AS huesped, hg.telefono,
  hab.codigo_habitacion, hab.nombre_habitacion,
  r.check_in, r.check_out, r.estado, r.estado_pago, r.total_reserva,
  CASE
    WHEN r.check_in::date  = CURRENT_DATE AND r.estado = 'confirmada' THEN 'check_in_hoy'
    WHEN r.check_out::date = CURRENT_DATE AND r.estado = 'check_in'   THEN 'check_out_hoy'
    ELSE r.estado
  END AS accion_hoy
FROM public.reservas_hotel r
JOIN public.hoteles h         ON h.id_hotel         = r.id_hotel
JOIN public.business_modules bm ON bm.id_module     = h.id_module
JOIN public.huespedes hg      ON hg.id_huesped       = r.id_huesped
JOIN public.habitaciones hab  ON hab.id_habitacion   = r.id_habitacion
WHERE bm.owner_id = auth.uid()
  AND (r.check_in::date = CURRENT_DATE OR r.check_out::date = CURRENT_DATE)
  AND r.estado NOT IN ('cancelada','no_show');
GRANT SELECT ON public.v_agenda_hoy TO authenticated;


-- =============================================================================
-- STORED PROCEDURES HOTEL
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_verificar_disponibilidad_servicio(
  p_nombre_servicio   text,
  p_check_in          timestamptz,
  p_check_out         timestamptz,
  p_max_cantidad      integer,
  p_excluir_reserva_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_max integer := 0; v_cnt integer; v_dia date;
BEGIN
  v_dia := p_check_in::date;
  WHILE v_dia < p_check_out::date LOOP
    SELECT COUNT(DISTINCT rs.id_reserva_hotel) INTO v_cnt
    FROM public.reserva_servicios rs
    JOIN public.servicios_adicionales sa ON sa.id_servicio = rs.id_servicio
    JOIN public.reservas_hotel r ON r.id_reserva_hotel = rs.id_reserva_hotel
    WHERE sa.nombre = p_nombre_servicio
      AND r.estado NOT IN ('cancelada','no_show')
      AND r.check_in::date <= v_dia AND r.check_out::date > v_dia
      AND (p_excluir_reserva_id IS NULL OR r.id_reserva_hotel != p_excluir_reserva_id);
    IF v_cnt > v_max THEN v_max := v_cnt; END IF;
    v_dia := v_dia + 1;
  END LOOP;
  RETURN jsonb_build_object(
    'disponible',      v_max < p_max_cantidad,
    'max_asignadas',   v_max,
    'max_permitidas',  p_max_cantidad
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_crear_reserva_completa(
  p_owner_id       uuid,
  p_id_huesped     uuid,
  p_id_habitacion  uuid,
  p_check_in       timestamptz,
  p_check_out      timestamptz,
  p_adultos        integer   DEFAULT 1,
  p_ninos          integer   DEFAULT 0,
  p_estado         varchar   DEFAULT 'confirmada',
  p_total_reserva  numeric   DEFAULT 0,
  p_moneda         varchar   DEFAULT 'HNL',
  p_observaciones  text      DEFAULT NULL,
  p_estado_pago    varchar   DEFAULT 'deuda',
  p_anticipo       numeric   DEFAULT 0,
  p_es_cortesia    boolean   DEFAULT false,
  p_id_empresa     uuid      DEFAULT NULL,
  p_tipo_reserva   varchar   DEFAULT 'noche',
  p_servicios      text[]    DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_hotel      uuid;
  v_id_reserva    uuid;
  v_nombre_serv   text;
  v_limite        integer;
  v_check         jsonb;
  v_servicio      record;
  v_limites       jsonb := '{"Cama Extra":3,"Neverita":1,"Plancha":8,"Limpieza Diaria":999}'::jsonb;
BEGIN
  SELECT h.id_hotel INTO v_id_hotel
  FROM public.habitaciones hab
  JOIN public.hoteles h ON h.id_hotel = hab.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE hab.id_habitacion = p_id_habitacion AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'HABITACION_NO_ENCONTRADA: %', p_id_habitacion; END IF;

  IF p_check_out <= p_check_in THEN RAISE EXCEPTION 'FECHAS_INVALIDAS'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservas_hotel
    WHERE id_habitacion = p_id_habitacion
      AND estado NOT IN ('cancelada','no_show','check_out')
      AND check_in < p_check_out AND check_out > p_check_in
  ) THEN RAISE EXCEPTION 'HABITACION_OCUPADA'; END IF;

  FOREACH v_nombre_serv IN ARRAY p_servicios LOOP
    v_limite := (v_limites ->> v_nombre_serv)::integer;
    IF v_limite IS NOT NULL THEN
      v_check := public.fn_verificar_disponibilidad_servicio(v_nombre_serv, p_check_in, p_check_out, v_limite, NULL);
      IF NOT (v_check->>'disponible')::boolean THEN
        RAISE EXCEPTION 'SERVICIO_NO_DISPONIBLE: %', v_nombre_serv;
      END IF;
    END IF;
  END LOOP;

  IF p_es_cortesia THEN
    p_estado_pago := 'cortesia';
  ELSIF p_id_empresa IS NOT NULL THEN
    p_estado_pago := 'credito';
  ELSIF p_estado_pago NOT IN ('pagado','cortesia','credito','deuda','abonada') THEN
    p_estado_pago := 'deuda';
  END IF;

  INSERT INTO public.reservas_hotel
    (id_hotel, id_huesped, id_habitacion, check_in, check_out, adultos, ninos,
     estado, total_reserva, moneda, observaciones, estado_pago, anticipo, es_cortesia, id_empresa, tipo_reserva)
  VALUES
    (v_id_hotel, p_id_huesped, p_id_habitacion, p_check_in, p_check_out, p_adultos, p_ninos,
     p_estado, p_total_reserva, p_moneda, p_observaciones, p_estado_pago, p_anticipo, p_es_cortesia, p_id_empresa, p_tipo_reserva)
  RETURNING id_reserva_hotel INTO v_id_reserva;

  IF array_length(p_servicios, 1) > 0 THEN
    FOR v_servicio IN
      SELECT id_servicio, precio_defecto FROM public.servicios_adicionales
      WHERE nombre = ANY(p_servicios) AND id_hotel = v_id_hotel AND activo = true
    LOOP
      INSERT INTO public.reserva_servicios (id_reserva_hotel, id_servicio, cantidad, precio_unitario)
      VALUES (v_id_reserva, v_servicio.id_servicio, 1, v_servicio.precio_defecto);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id_reserva_hotel', v_id_reserva, 'id_hotel', v_id_hotel);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_check_in_reserva(p_id_reserva uuid, p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_estado varchar;
BEGIN
  SELECT r.id_habitacion, r.estado INTO v_id_habitacion, v_estado
  FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE r.id_reserva_hotel = p_id_reserva AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %', p_id_reserva; END IF;
  IF v_estado NOT IN ('confirmada','pendiente') THEN RAISE EXCEPTION 'ESTADO_INVALIDO: %', v_estado; END IF;
  UPDATE public.reservas_hotel SET estado = 'check_in',  updated_at = now() WHERE id_reserva_hotel = p_id_reserva;
  UPDATE public.habitaciones   SET estado = 'ocupada',   updated_at = now() WHERE id_habitacion = v_id_habitacion;
  RETURN jsonb_build_object('success', true, 'estado', 'check_in');
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_check_out_reserva(p_id_reserva uuid, p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_estado varchar;
BEGIN
  SELECT r.id_habitacion, r.estado INTO v_id_habitacion, v_estado
  FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE r.id_reserva_hotel = p_id_reserva AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %', p_id_reserva; END IF;
  IF v_estado != 'check_in' THEN RAISE EXCEPTION 'ESTADO_INVALIDO: %', v_estado; END IF;
  UPDATE public.reservas_hotel SET estado = 'check_out',   updated_at = now() WHERE id_reserva_hotel = p_id_reserva;
  UPDATE public.habitaciones   SET estado = 'disponible',  updated_at = now() WHERE id_habitacion = v_id_habitacion;
  RETURN jsonb_build_object('success', true, 'estado', 'check_out');
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cancelar_reserva(
  p_id_reserva   uuid,
  p_owner_id     uuid,
  p_anular_pagos boolean DEFAULT false,
  p_email_usuario text   DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_habitacion  uuid; v_id_huesped uuid; v_estado varchar;
  v_total_pagado   numeric := 0; v_pago record; v_notas text; v_credito_generado numeric := 0;
BEGIN
  SELECT r.id_habitacion, r.id_huesped, r.estado INTO v_id_habitacion, v_id_huesped, v_estado
  FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE r.id_reserva_hotel = p_id_reserva AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %', p_id_reserva; END IF;
  IF v_estado = 'cancelada' THEN RAISE EXCEPTION 'RESERVA_YA_CANCELADA'; END IF;

  IF p_anular_pagos THEN
    SELECT COALESCE(SUM(monto), 0) INTO v_total_pagado
    FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva AND estado != 'anulado';
    IF v_total_pagado > 0 THEN
      v_notas := 'Anulado por cancelación' || CASE WHEN p_email_usuario IS NOT NULL THEN ' (' || p_email_usuario || ')' ELSE '' END;
      FOR v_pago IN SELECT id_pago_hotel, notas FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva AND estado != 'anulado'
      LOOP
        UPDATE public.pagos_hotel
        SET estado = 'anulado',
            notas  = CASE WHEN v_pago.notas IS NOT NULL THEN v_pago.notas || E'\n' || v_notas ELSE v_notas END,
            updated_at = now()
        WHERE id_pago_hotel = v_pago.id_pago_hotel;
      END LOOP;
      INSERT INTO public.saldos_clientes (id_huesped, monto, tipo, descripcion)
      VALUES (v_id_huesped, v_total_pagado, 'credito', 'Crédito por cancelación ' || p_id_reserva::text);
      v_credito_generado := v_total_pagado;
    END IF;
  END IF;

  UPDATE public.reservas_hotel SET estado = 'cancelada', estado_display = 'cancelada', updated_at = now() WHERE id_reserva_hotel = p_id_reserva;
  IF v_estado = 'check_in' THEN
    UPDATE public.habitaciones SET estado = 'disponible', updated_at = now() WHERE id_habitacion = v_id_habitacion;
  END IF;
  RETURN jsonb_build_object('success', true, 'credito_generado', v_credito_generado);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_registrar_pago(
  p_owner_id          uuid,
  p_id_reserva_hotel  uuid,
  p_monto             numeric,
  p_moneda            varchar DEFAULT 'HNL',
  p_metodo_pago       varchar DEFAULT 'efectivo',
  p_referencia        varchar DEFAULT NULL,
  p_notas             text    DEFAULT NULL,
  p_fecha_pago        date    DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reserva         record;
  v_id_pago         uuid;
  v_tipo_cambio     numeric;
  v_monto_en_moneda numeric;
  v_total_pagado    numeric;
  v_nuevo_estado    varchar;
BEGIN
  SELECT r.total_reserva, r.moneda, r.es_cortesia, r.id_empresa INTO v_reserva
  FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE r.id_reserva_hotel = p_id_reserva_hotel AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %', p_id_reserva_hotel; END IF;
  IF p_monto <= 0 THEN RAISE EXCEPTION 'MONTO_INVALIDO'; END IF;

  SELECT COALESCE(MAX(ch.tipo_cambio_base), 26.58) INTO v_tipo_cambio
  FROM public.reservas_hotel r
  LEFT JOIN public.configuracion_hotelera ch ON ch.id_hotel = r.id_hotel
  WHERE r.id_reserva_hotel = p_id_reserva_hotel;

  IF p_moneda = v_reserva.moneda THEN
    v_monto_en_moneda := p_monto;
  ELSIF p_moneda = 'USD' AND v_reserva.moneda = 'HNL' THEN
    v_monto_en_moneda := p_monto * v_tipo_cambio;
  ELSIF p_moneda = 'HNL' AND v_reserva.moneda = 'USD' THEN
    v_monto_en_moneda := p_monto / v_tipo_cambio;
  ELSE
    v_monto_en_moneda := p_monto;
  END IF;

  INSERT INTO public.pagos_hotel
    (id_reserva_hotel, monto, monto_en_moneda_reserva, metodo_pago, referencia, moneda, estado, notas, fecha_pago)
  VALUES
    (p_id_reserva_hotel, p_monto, v_monto_en_moneda, p_metodo_pago, p_referencia, p_moneda, 'registrado', p_notas, p_fecha_pago)
  RETURNING id_pago_hotel INTO v_id_pago;

  SELECT COALESCE(SUM(monto_en_moneda_reserva), 0) INTO v_total_pagado
  FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva_hotel AND estado != 'anulado';

  IF v_reserva.es_cortesia THEN
    v_nuevo_estado := 'cortesia';
  ELSIF v_reserva.id_empresa IS NOT NULL THEN
    v_nuevo_estado := 'credito';
  ELSIF v_total_pagado >= v_reserva.total_reserva - 0.01 THEN
    v_nuevo_estado := 'pagado';
  ELSIF v_total_pagado > 0 THEN
    v_nuevo_estado := 'abonada';
  ELSE
    v_nuevo_estado := 'deuda';
  END IF;

  UPDATE public.reservas_hotel SET estado_pago = v_nuevo_estado, updated_at = now()
  WHERE id_reserva_hotel = p_id_reserva_hotel;

  RETURN jsonb_build_object('id_pago_hotel', v_id_pago, 'estado_pago', v_nuevo_estado, 'total_pagado', v_total_pagado);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_aplicar_saldo_cliente(
  p_id_saldo          uuid,
  p_id_reserva_hotel  uuid,
  p_owner_id          uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_saldo         record;
  v_total_pagado  numeric;
  v_total_reserva numeric;
  v_pendiente     numeric;
  v_monto_aplicar numeric;
BEGIN
  SELECT id_saldo, monto, aplicado INTO v_saldo FROM public.saldos_clientes WHERE id_saldo = p_id_saldo;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALDO_NO_ENCONTRADO: %', p_id_saldo; END IF;
  IF v_saldo.aplicado   THEN RAISE EXCEPTION 'SALDO_YA_APLICADO'; END IF;

  SELECT r.total_reserva INTO v_total_reserva
  FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE r.id_reserva_hotel = p_id_reserva_hotel AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %', p_id_reserva_hotel; END IF;

  SELECT COALESCE(SUM(monto_en_moneda_reserva), 0) INTO v_total_pagado
  FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva_hotel AND estado != 'anulado';

  v_pendiente     := GREATEST(v_total_reserva - v_total_pagado, 0);
  v_monto_aplicar := LEAST(v_saldo.monto, CASE WHEN v_pendiente > 0 THEN v_pendiente ELSE v_saldo.monto END);

  INSERT INTO public.pagos_hotel
    (id_reserva_hotel, monto, monto_en_moneda_reserva, metodo_pago, moneda, estado, notas, fecha_pago)
  VALUES
    (p_id_reserva_hotel, v_monto_aplicar, v_monto_aplicar, 'transferencia', 'HNL', 'registrado',
     'Saldo aplicado (ID:' || p_id_saldo::text || ')', CURRENT_DATE);

  UPDATE public.saldos_clientes SET aplicado = true, fecha_aplicacion = now(), updated_at = now()
  WHERE id_saldo = p_id_saldo;

  RETURN jsonb_build_object('success', true, 'monto_aplicado', v_monto_aplicar);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_anular_pago(
  p_id_pago_hotel uuid,
  p_owner_id      uuid,
  p_motivo        text DEFAULT NULL,
  p_email_usuario text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pago         record;
  v_reserva      record;
  v_notas        text;
  v_total_pagado numeric;
  v_nuevo_estado varchar;
BEGIN
  SELECT p.id_pago_hotel, p.id_reserva_hotel, p.monto, p.estado, p.notas INTO v_pago
  FROM public.pagos_hotel p
  JOIN public.reservas_hotel r ON r.id_reserva_hotel = p.id_reserva_hotel
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE p.id_pago_hotel = p_id_pago_hotel AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAGO_NO_ENCONTRADO: %', p_id_pago_hotel; END IF;
  IF v_pago.estado = 'anulado' THEN RAISE EXCEPTION 'PAGO_YA_ANULADO'; END IF;

  v_notas := 'Anulado por: ' || COALESCE(p_email_usuario, 'sistema') ||
             CASE WHEN p_motivo IS NOT NULL THEN ' (' || p_motivo || ')' ELSE '' END;

  UPDATE public.pagos_hotel
  SET estado = 'anulado',
      notas  = CASE WHEN v_pago.notas IS NOT NULL THEN v_pago.notas || E'\n' || v_notas ELSE v_notas END,
      updated_at = now()
  WHERE id_pago_hotel = p_id_pago_hotel;

  SELECT r.total_reserva, r.estado, r.es_cortesia, r.id_empresa, r.id_huesped INTO v_reserva
  FROM public.reservas_hotel r WHERE id_reserva_hotel = v_pago.id_reserva_hotel;

  IF FOUND AND NOT v_reserva.es_cortesia
     AND v_reserva.estado NOT IN ('cancelada','no_show')
     AND v_reserva.id_huesped IS NOT NULL THEN

    INSERT INTO public.saldos_clientes (id_huesped, monto, tipo, descripcion)
    VALUES (v_reserva.id_huesped, v_pago.monto, 'credito', 'Pago anulado (reserva ' || RIGHT(v_pago.id_reserva_hotel::text, 8) || ')');

    SELECT COALESCE(SUM(monto_en_moneda_reserva), 0) INTO v_total_pagado
    FROM public.pagos_hotel WHERE id_reserva_hotel = v_pago.id_reserva_hotel AND estado != 'anulado';

    IF v_reserva.id_empresa IS NOT NULL THEN
      v_nuevo_estado := 'credito';
    ELSIF v_total_pagado >= v_reserva.total_reserva - 0.01 THEN
      v_nuevo_estado := 'pagado';
    ELSIF v_total_pagado > 0 THEN
      v_nuevo_estado := 'abonada';
    ELSE
      v_nuevo_estado := 'deuda';
    END IF;

    IF v_reserva.estado NOT IN ('cancelada','no_show','check_in','check_out') THEN
      UPDATE public.reservas_hotel SET estado_pago = v_nuevo_estado, updated_at = now()
      WHERE id_reserva_hotel = v_pago.id_reserva_hotel;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id_pago_hotel', p_id_pago_hotel);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_estadisticas_auditoria(p_hotel_id uuid, p_dias integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_desde    timestamptz := now() - (p_dias || ' days')::interval;
  v_total    integer;
  v_por_tipo jsonb; v_por_user jsonb; v_por_ent jsonb;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.audit_log WHERE id_hotel = p_hotel_id AND created_at >= v_desde;

  SELECT jsonb_object_agg(accion, cnt) INTO v_por_tipo FROM (
    SELECT accion, COUNT(*) AS cnt FROM public.audit_log
    WHERE id_hotel = p_hotel_id AND created_at >= v_desde GROUP BY accion ORDER BY cnt DESC LIMIT 10
  ) t;

  SELECT jsonb_object_agg(email, cnt) INTO v_por_user FROM (
    SELECT COALESCE(usuario_email,'Sistema') AS email, COUNT(*) AS cnt FROM public.audit_log
    WHERE id_hotel = p_hotel_id AND created_at >= v_desde GROUP BY usuario_email ORDER BY cnt DESC LIMIT 10
  ) t;

  SELECT jsonb_object_agg(entidad, cnt) INTO v_por_ent FROM (
    SELECT entidad, COUNT(*) AS cnt FROM public.audit_log
    WHERE id_hotel = p_hotel_id AND created_at >= v_desde GROUP BY entidad ORDER BY cnt DESC LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'total_acciones',       v_total,
    'acciones_por_tipo',    COALESCE(v_por_tipo, '{}'::jsonb),
    'acciones_por_usuario', COALESCE(v_por_user, '{}'::jsonb),
    'acciones_por_entidad', COALESCE(v_por_ent,  '{}'::jsonb),
    'periodo',              p_dias || ' días'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_verificar_disponibilidad_servicio TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crear_reserva_completa             TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_in_reserva                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_out_reserva                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_reserva                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_registrar_pago                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_aplicar_saldo_cliente             TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_anular_pago                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_estadisticas_auditoria            TO authenticated;


-- =============================================================================
-- TRIGGER DE AUDITORÍA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_owner_id uuid; v_hotel_id uuid; v_row jsonb;
BEGIN
  v_row := CASE TG_OP WHEN 'DELETE' THEN row_to_json(OLD)::jsonb ELSE row_to_json(NEW)::jsonb END;
  BEGIN v_hotel_id := (v_row->>'id_hotel')::uuid; EXCEPTION WHEN others THEN v_hotel_id := NULL; END;
  IF v_hotel_id IS NOT NULL THEN
    SELECT bm.owner_id INTO v_owner_id
    FROM public.hoteles h JOIN public.business_modules bm ON bm.id_module = h.id_module
    WHERE h.id_hotel = v_hotel_id;
  ELSE
    BEGIN v_owner_id := (v_row->>'owner_id')::uuid; EXCEPTION WHEN others THEN v_owner_id := NULL; END;
  END IF;
  IF v_owner_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  INSERT INTO public.audit_log
    (owner_id, id_hotel, accion, entidad, entidad_id, usuario_id, usuario_email, datos_anteriores, datos_nuevos, cambios_resumidos)
  VALUES (
    v_owner_id, v_hotel_id, TG_OP, TG_TABLE_NAME, (v_row->>'id')::uuid,
    auth.uid(), auth.email(),
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
    'reservas_hotel','pagos_hotel','habitaciones','huespedes',
    'bloqueos_habitacion','saldos_clientes','usuarios_roles',
    'empresas','cierres_diarios','hoteles'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;
       CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ─── Tracking de consumo de IA por propietario ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL,
  provider      text        NOT NULL DEFAULT 'gemini',
  input_tokens  integer     NOT NULL DEFAULT 0,
  output_tokens integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_owner_created
  ON public.ai_usage_log(owner_id, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_service_only" ON public.ai_usage_log
  FOR ALL USING (false);
