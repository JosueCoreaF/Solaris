-- =============================================================================
-- SOLARIS — MÓDULO GYM (ejecutar después de schema_00_base.sql)
-- =============================================================================

-- Tabla primero, función después (PostgreSQL valida referencias en funciones SQL)
CREATE TABLE IF NOT EXISTS public.gimnasios (
  id_gimnasio     uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_module       uuid        NOT NULL REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  nombre_gimnasio varchar     NOT NULL,
  ciudad          varchar     NOT NULL,
  direccion       text        NOT NULL,
  telefono        varchar,
  correo_contacto varchar,
  estado          varchar     NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','inactivo','mantenimiento')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gimnasios_pkey PRIMARY KEY (id_gimnasio)
);

CREATE OR REPLACE FUNCTION public.tiene_acceso_gimnasio(p_id_gimnasio uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gimnasios g
    JOIN public.business_modules bm ON bm.id_module = g.id_module
    WHERE g.id_gimnasio = p_id_gimnasio AND bm.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.usuarios_roles ur
    JOIN public.gimnasios g ON g.id_gimnasio = p_id_gimnasio
    JOIN public.business_modules bm ON bm.id_module = g.id_module
    WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id
      AND ur.estado = 'activo' AND (ur.id_hotel = p_id_gimnasio OR ur.id_hotel IS NULL)
  );
$$;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_gimnasio(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.configuracion_gym (
  id_config                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_gimnasio                 uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  moneda                      varchar     NOT NULL DEFAULT 'HNL',
  porcentaje_impuesto         numeric     DEFAULT 0.00 CHECK (porcentaje_impuesto >= 0),
  hora_apertura               time        DEFAULT '05:00:00',
  hora_cierre                 time        DEFAULT '22:00:00',
  dias_aviso_vencimiento      integer     DEFAULT 7,
  permitir_congelar_membresia boolean     DEFAULT true,
  nombre_negocio              varchar     DEFAULT 'Mi Gimnasio',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT configuracion_gym_pkey  PRIMARY KEY (id_config),
  CONSTRAINT configuracion_gym_unico UNIQUE (id_gimnasio)
);

CREATE TABLE IF NOT EXISTS public.planes_membresia (
  id_plan       uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_gimnasio   uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  nombre        varchar     NOT NULL,
  descripcion   text,
  duracion_dias integer     NOT NULL DEFAULT 30 CHECK (duracion_dias > 0),
  precio        numeric     NOT NULL DEFAULT 0.00 CHECK (precio >= 0),
  acceso_clases boolean     DEFAULT true,
  acceso_gym    boolean     DEFAULT true,
  activo        boolean     DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planes_membresia_pkey PRIMARY KEY (id_plan)
);

CREATE TABLE IF NOT EXISTS public.miembros (
  id_miembro             uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_gimnasio            uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  nombre_completo        varchar     NOT NULL,
  correo                 varchar     NOT NULL,
  telefono               varchar,
  documento_identidad    varchar,
  fecha_nacimiento       date,
  genero                 varchar     CHECK (genero IN ('masculino','femenino','otro')),
  direccion              text,
  contacto_emergencia    varchar,
  telefono_emergencia    varchar,
  observaciones          text,
  estado                 varchar     NOT NULL DEFAULT 'activo'
                           CHECK (estado IN ('activo','inactivo','suspendido')),
  fecha_registro         timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT miembros_pkey                  PRIMARY KEY (id_miembro),
  CONSTRAINT miembros_gimnasio_correo_unico UNIQUE (id_gimnasio, correo)
);

CREATE TABLE IF NOT EXISTS public.entrenadores (
  id_entrenador   uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_gimnasio     uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  nombre_completo varchar     NOT NULL,
  especialidad    varchar,
  correo          varchar,
  telefono        varchar,
  estado          varchar     NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entrenadores_pkey PRIMARY KEY (id_entrenador)
);

CREATE TABLE IF NOT EXISTS public.clases_gym (
  id_clase         uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_gimnasio      uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  id_entrenador    uuid        REFERENCES public.entrenadores(id_entrenador) ON DELETE SET NULL,
  nombre_clase     varchar     NOT NULL,
  descripcion      text,
  dia_semana       varchar     NOT NULL
                     CHECK (dia_semana IN ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  hora_inicio      time        NOT NULL,
  hora_fin         time        NOT NULL,
  capacidad_maxima integer     DEFAULT 20 CHECK (capacidad_maxima > 0),
  activa           boolean     DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clases_gym_pkey PRIMARY KEY (id_clase)
);

CREATE TABLE IF NOT EXISTS public.inscripciones_gym (
  id_inscripcion  uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_gimnasio     uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio),
  id_miembro      uuid        NOT NULL REFERENCES public.miembros(id_miembro),
  id_plan         uuid        NOT NULL REFERENCES public.planes_membresia(id_plan),
  fecha_inicio    date        NOT NULL,
  fecha_fin       date        NOT NULL,
  estado          varchar     NOT NULL DEFAULT 'activa'
                    CHECK (estado IN ('activa','vencida','cancelada','congelada')),
  estado_pago     varchar     NOT NULL DEFAULT 'deuda'
                    CHECK (estado_pago IN ('pagado','deuda','cortesia','abonada')),
  total           numeric     NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  anticipo        numeric     DEFAULT 0.00 CHECK (anticipo >= 0),
  notas           text,
  created_by      uuid        REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inscripciones_gym_pkey     PRIMARY KEY (id_inscripcion),
  CONSTRAINT inscripciones_fechas_check CHECK (fecha_fin > fecha_inicio)
);

CREATE TABLE IF NOT EXISTS public.pagos_gym (
  id_pago_gym    uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_inscripcion uuid        NOT NULL REFERENCES public.inscripciones_gym(id_inscripcion),
  monto          numeric     NOT NULL CHECK (monto >= 0),
  metodo_pago    varchar     NOT NULL
                   CHECK (metodo_pago IN ('efectivo','tarjeta','transferencia','deposito','otro')),
  referencia     varchar,
  moneda         varchar     NOT NULL DEFAULT 'HNL',
  estado         varchar     NOT NULL DEFAULT 'registrado'
                   CHECK (estado IN ('registrado','aplicado','anulado')),
  notas          text,
  fecha_pago     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_gym_pkey PRIMARY KEY (id_pago_gym)
);

CREATE TABLE IF NOT EXISTS public.asistencia_clases (
  id_asistencia uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_clase      uuid        NOT NULL REFERENCES public.clases_gym(id_clase) ON DELETE CASCADE,
  id_miembro    uuid        NOT NULL REFERENCES public.miembros(id_miembro) ON DELETE CASCADE,
  fecha         date        NOT NULL DEFAULT CURRENT_DATE,
  estado        varchar     NOT NULL DEFAULT 'asistio'
                  CHECK (estado IN ('asistio','falto','cancelado')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asistencia_clases_pkey         PRIMARY KEY (id_asistencia),
  CONSTRAINT asistencia_clase_miembro_unico UNIQUE (id_clase, id_miembro, fecha)
);

-- Índices gym
CREATE INDEX IF NOT EXISTS idx_gym_module    ON public.gimnasios (id_module);
CREATE INDEX IF NOT EXISTS idx_plan_gym      ON public.planes_membresia (id_gimnasio);
CREATE INDEX IF NOT EXISTS idx_miembro_gym   ON public.miembros (id_gimnasio);
CREATE INDEX IF NOT EXISTS idx_entrena_gym   ON public.entrenadores (id_gimnasio);
CREATE INDEX IF NOT EXISTS idx_clase_gym     ON public.clases_gym (id_gimnasio, dia_semana);
CREATE INDEX IF NOT EXISTS idx_inscr_gym     ON public.inscripciones_gym (id_gimnasio);
CREATE INDEX IF NOT EXISTS idx_inscr_miembro ON public.inscripciones_gym (id_miembro);
CREATE INDEX IF NOT EXISTS idx_inscr_estado  ON public.inscripciones_gym (id_gimnasio, estado);
CREATE INDEX IF NOT EXISTS idx_pagogym_inscr ON public.pagos_gym (id_inscripcion);
CREATE INDEX IF NOT EXISTS idx_asist_clase   ON public.asistencia_clases (id_clase, fecha);

-- RLS gym
ALTER TABLE public.gimnasios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_gym  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_membresia   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrenadores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clases_gym         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones_gym  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_gym          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_clases  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gym_select" ON public.gimnasios FOR SELECT USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "gym_insert" ON public.gimnasios FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = gimnasios.id_module AND bm.owner_id = auth.uid()));
CREATE POLICY "gym_update" ON public.gimnasios FOR UPDATE USING (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = gimnasios.id_module AND bm.owner_id = auth.uid()));
CREATE POLICY "gym_delete" ON public.gimnasios FOR DELETE USING (EXISTS (SELECT 1 FROM public.business_modules bm WHERE bm.id_module = gimnasios.id_module AND bm.owner_id = auth.uid()));

CREATE POLICY "confgym_all" ON public.configuracion_gym FOR ALL USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "plan_all"    ON public.planes_membresia  FOR ALL USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "miembro_all" ON public.miembros          FOR ALL USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "entrena_all" ON public.entrenadores      FOR ALL USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "clase_all"   ON public.clases_gym        FOR ALL USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "inscr_all"   ON public.inscripciones_gym FOR ALL USING (public.tiene_acceso_gimnasio(id_gimnasio));
CREATE POLICY "pagogym_all" ON public.pagos_gym FOR ALL USING (
  EXISTS (SELECT 1 FROM public.inscripciones_gym i WHERE i.id_inscripcion = pagos_gym.id_inscripcion AND public.tiene_acceso_gimnasio(i.id_gimnasio))
);
CREATE POLICY "asist_all" ON public.asistencia_clases FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clases_gym c WHERE c.id_clase = asistencia_clases.id_clase AND public.tiene_acceso_gimnasio(c.id_gimnasio))
);

-- Función pago gym
CREATE OR REPLACE FUNCTION public.fn_registrar_pago_gym(p_owner_id uuid, p_id_inscripcion uuid, p_monto numeric, p_metodo_pago varchar DEFAULT 'efectivo', p_referencia varchar DEFAULT NULL, p_notas text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_insc record; v_id_pago uuid; v_total_pagado numeric; v_nuevo_estado varchar;
BEGIN
  SELECT i.total INTO v_insc FROM public.inscripciones_gym i
  JOIN public.gimnasios g ON g.id_gimnasio = i.id_gimnasio
  JOIN public.business_modules bm ON bm.id_module = g.id_module
  WHERE i.id_inscripcion = p_id_inscripcion AND bm.owner_id = p_owner_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'INSCRIPCION_NO_ENCONTRADA: %', p_id_inscripcion; END IF;
  IF p_monto <= 0 THEN RAISE EXCEPTION 'MONTO_INVALIDO'; END IF;
  INSERT INTO public.pagos_gym (id_inscripcion, monto, metodo_pago, referencia, notas)
  VALUES (p_id_inscripcion, p_monto, p_metodo_pago, p_referencia, p_notas)
  RETURNING id_pago_gym INTO v_id_pago;
  SELECT COALESCE(SUM(monto), 0) INTO v_total_pagado FROM public.pagos_gym WHERE id_inscripcion = p_id_inscripcion AND estado != 'anulado';
  IF    v_total_pagado >= v_insc.total - 0.01 THEN v_nuevo_estado := 'pagado';
  ELSIF v_total_pagado > 0                    THEN v_nuevo_estado := 'abonada';
  ELSE                                             v_nuevo_estado := 'deuda'; END IF;
  UPDATE public.inscripciones_gym SET estado_pago = v_nuevo_estado, updated_at = now() WHERE id_inscripcion = p_id_inscripcion;
  RETURN jsonb_build_object('id_pago_gym', v_id_pago, 'estado_pago', v_nuevo_estado);
EXCEPTION WHEN OTHERS THEN RAISE; END;$$;
GRANT EXECUTE ON FUNCTION public.fn_registrar_pago_gym TO authenticated;
