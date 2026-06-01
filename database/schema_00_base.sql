-- =============================================================================
-- SOLARIS — MÓDULO BASE (ejecutar primero)
-- Infraestructura core: owners, módulos, roles, suscripciones, auditoría
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Owners ───────────────────────────────────────────────────────────────────
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

-- ── Planes de suscripción ────────────────────────────────────────────────────
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

-- ── Suscripciones ────────────────────────────────────────────────────────────
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

-- ── Business Modules ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_modules (
  id_module     uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  tipo_modulo   varchar     NOT NULL CHECK (tipo_modulo IN ('hotel','restaurant','gym','store')),
  nombre_modulo varchar     NOT NULL,
  estado        varchar     NOT NULL DEFAULT 'activo'
                  CHECK (estado IN ('activo','inactivo','mantenimiento')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_modules_pkey PRIMARY KEY (id_module)
);

-- ── Usuarios y roles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios_roles (
  id        uuid    NOT NULL DEFAULT gen_random_uuid(),
  user_id   uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id  uuid    NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  id_module uuid    REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  id_hotel  uuid,   -- FK a hoteles se agrega en schema_01_hotel.sql
  rol       varchar NOT NULL CHECK (rol IN (
              'ADMIN','RECEPCIONISTA','MANTENIMIENTO','CONTADOR',
              'MESERO','COCINA','ENTRENADOR','VENDEDOR'
            )),
  estado    varchar NOT NULL DEFAULT 'pendiente'
              CHECK (estado IN ('activo','inactivo','suspendido','pendiente')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_roles_pkey             PRIMARY KEY (id),
  CONSTRAINT usuarios_roles_user_owner_unico UNIQUE (user_id, owner_id, id_module)
);

-- ── Invitaciones ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitaciones (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  email        varchar     NOT NULL,
  codigo_unico varchar     NOT NULL UNIQUE,
  id_module    uuid        REFERENCES public.business_modules(id_module),
  id_hotel     uuid,       -- FK a hoteles se agrega en schema_01_hotel.sql
  rol_sugerido varchar     NOT NULL DEFAULT 'RECEPCIONISTA'
                 CHECK (rol_sugerido IN ('ADMIN','RECEPCIONISTA','MANTENIMIENTO','CONTADOR','MESERO','COCINA','ENTRENADOR','VENDEDOR')),
  usado        boolean     NOT NULL DEFAULT false,
  user_id      uuid        REFERENCES auth.users(id),
  expira_en    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitaciones_pkey PRIMARY KEY (id)
);

-- ── Auditoría ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id         uuid        NOT NULL REFERENCES public.owners(id_owner),
  id_hotel         uuid,       -- FK a hoteles se agrega en schema_01_hotel.sql
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

-- ── Funciones helper RLS ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.es_owner_de(p_owner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT auth.uid() = p_owner_id;
$$;
GRANT EXECUTE ON FUNCTION public.es_owner_de(uuid) TO authenticated;

-- ── RLS base ──────────────────────────────────────────────────────────────────
ALTER TABLE public.owners             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_suscripcion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_modules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log          ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "inv_all"    ON public.invitaciones FOR ALL   USING (owner_id = auth.uid());
CREATE POLICY "audit_select" ON public.audit_log FOR SELECT USING (owner_id = auth.uid());

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
  VALUES (gen_random_uuid(), v_nombre, v_email, 'activo')
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
