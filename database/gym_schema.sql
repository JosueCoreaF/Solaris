-- ============================================================
-- SCHEMA GIMNASIO - Solaris Platform
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Tabla principal del gimnasio (equivalente a hoteles)
CREATE TABLE IF NOT EXISTS public.gimnasios (
  id_gimnasio uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_module uuid,
  nombre_gimnasio character varying NOT NULL,
  ciudad character varying NOT NULL,
  direccion text NOT NULL,
  telefono character varying,
  correo_contacto character varying,
  estado character varying DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'mantenimiento')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gimnasios_pkey PRIMARY KEY (id_gimnasio),
  CONSTRAINT gimnasios_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT gimnasios_id_module_fkey FOREIGN KEY (id_module) REFERENCES public.business_modules(id_module)
);

-- Planes de membresía (Mensual, Trimestral, Anual, Estudiante, etc.)
CREATE TABLE IF NOT EXISTS public.planes_membresia (
  id_plan uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_gimnasio uuid NOT NULL,
  nombre character varying NOT NULL,
  descripcion text,
  duracion_dias integer NOT NULL DEFAULT 30,
  precio numeric NOT NULL DEFAULT 0.00 CHECK (precio >= 0),
  acceso_clases boolean DEFAULT true,
  acceso_gym boolean DEFAULT true,
  activo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT planes_membresia_pkey PRIMARY KEY (id_plan),
  CONSTRAINT planes_membresia_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT planes_membresia_id_gimnasio_fkey FOREIGN KEY (id_gimnasio) REFERENCES public.gimnasios(id_gimnasio)
);

-- Miembros del gimnasio (equivalente a huespedes)
CREATE TABLE IF NOT EXISTS public.miembros (
  id_miembro uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nombre_completo character varying NOT NULL,
  correo character varying NOT NULL,
  telefono character varying,
  documento_identidad character varying,
  fecha_nacimiento date,
  genero character varying CHECK (genero IN ('masculino', 'femenino', 'otro')),
  direccion text,
  contacto_emergencia character varying,
  telefono_emergencia character varying,
  observaciones text,
  estado character varying DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo', 'suspendido')),
  fecha_registro timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT miembros_pkey PRIMARY KEY (id_miembro),
  CONSTRAINT miembros_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner)
);

-- Entrenadores / Instructores
CREATE TABLE IF NOT EXISTS public.entrenadores (
  id_entrenador uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_gimnasio uuid NOT NULL,
  nombre_completo character varying NOT NULL,
  especialidad character varying,
  correo character varying,
  telefono character varying,
  estado character varying DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT entrenadores_pkey PRIMARY KEY (id_entrenador),
  CONSTRAINT entrenadores_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT entrenadores_id_gimnasio_fkey FOREIGN KEY (id_gimnasio) REFERENCES public.gimnasios(id_gimnasio)
);

-- Clases grupales
CREATE TABLE IF NOT EXISTS public.clases_gym (
  id_clase uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_gimnasio uuid NOT NULL,
  id_entrenador uuid,
  nombre_clase character varying NOT NULL,
  descripcion text,
  dia_semana character varying NOT NULL CHECK (dia_semana IN ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  capacidad_maxima integer DEFAULT 20 CHECK (capacidad_maxima > 0),
  activa boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT clases_gym_pkey PRIMARY KEY (id_clase),
  CONSTRAINT clases_gym_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT clases_gym_id_gimnasio_fkey FOREIGN KEY (id_gimnasio) REFERENCES public.gimnasios(id_gimnasio),
  CONSTRAINT clases_gym_id_entrenador_fkey FOREIGN KEY (id_entrenador) REFERENCES public.entrenadores(id_entrenador)
);

-- Inscripciones de membresías (equivalente a reservas_hotel)
CREATE TABLE IF NOT EXISTS public.inscripciones_gym (
  id_inscripcion uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_miembro uuid NOT NULL,
  id_gimnasio uuid NOT NULL,
  id_plan uuid NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado character varying DEFAULT 'activa' CHECK (estado IN ('activa', 'vencida', 'cancelada', 'congelada')),
  estado_pago character varying DEFAULT 'deuda' CHECK (estado_pago IN ('pagado', 'deuda', 'cortesia')),
  total numeric NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  anticipo numeric DEFAULT 0.00 CHECK (anticipo >= 0),
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT inscripciones_gym_pkey PRIMARY KEY (id_inscripcion),
  CONSTRAINT inscripciones_gym_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT inscripciones_gym_id_miembro_fkey FOREIGN KEY (id_miembro) REFERENCES public.miembros(id_miembro),
  CONSTRAINT inscripciones_gym_id_gimnasio_fkey FOREIGN KEY (id_gimnasio) REFERENCES public.gimnasios(id_gimnasio),
  CONSTRAINT inscripciones_gym_id_plan_fkey FOREIGN KEY (id_plan) REFERENCES public.planes_membresia(id_plan)
);

-- Pagos del gimnasio (equivalente a pagos_hotel)
CREATE TABLE IF NOT EXISTS public.pagos_gym (
  id_pago_gym uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_inscripcion uuid NOT NULL,
  monto numeric NOT NULL CHECK (monto >= 0),
  metodo_pago character varying NOT NULL CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'otro')),
  referencia character varying,
  fecha_pago timestamp with time zone NOT NULL DEFAULT now(),
  estado character varying DEFAULT 'registrado' CHECK (estado IN ('registrado', 'aplicado', 'anulado')),
  notas text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pagos_gym_pkey PRIMARY KEY (id_pago_gym),
  CONSTRAINT pagos_gym_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT pagos_gym_id_inscripcion_fkey FOREIGN KEY (id_inscripcion) REFERENCES public.inscripciones_gym(id_inscripcion)
);

-- Asistencia a clases
CREATE TABLE IF NOT EXISTS public.asistencia_clases (
  id_asistencia uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_clase uuid NOT NULL,
  id_miembro uuid NOT NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado character varying DEFAULT 'asistio' CHECK (estado IN ('asistio', 'falto', 'cancelado')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT asistencia_clases_pkey PRIMARY KEY (id_asistencia),
  CONSTRAINT asistencia_clases_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT asistencia_clases_id_clase_fkey FOREIGN KEY (id_clase) REFERENCES public.clases_gym(id_clase),
  CONSTRAINT asistencia_clases_id_miembro_fkey FOREIGN KEY (id_miembro) REFERENCES public.miembros(id_miembro)
);

-- Configuración del gimnasio
CREATE TABLE IF NOT EXISTS public.configuracion_gym (
  id_config uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  id_gimnasio uuid NOT NULL,
  moneda character varying DEFAULT 'HNL',
  porcentaje_impuesto numeric DEFAULT 0.00 CHECK (porcentaje_impuesto >= 0),
  hora_apertura time DEFAULT '05:00:00',
  hora_cierre time DEFAULT '22:00:00',
  dias_aviso_vencimiento integer DEFAULT 7,
  permitir_congelar_membresia boolean DEFAULT true,
  nombre_negocio character varying DEFAULT 'Mi Gimnasio',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT configuracion_gym_pkey PRIMARY KEY (id_config),
  CONSTRAINT configuracion_gym_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.owners(id_owner),
  CONSTRAINT configuracion_gym_id_gimnasio_fkey FOREIGN KEY (id_gimnasio) REFERENCES public.gimnasios(id_gimnasio)
);

-- ============================================================
-- RLS Policies (Row Level Security)
-- ============================================================

ALTER TABLE public.gimnasios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes_membresia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entrenadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clases_gym ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones_gym ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_gym ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencia_clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_gym ENABLE ROW LEVEL SECURITY;

-- Policies: acceso solo a usuarios autenticados con rol activo en el owner
CREATE POLICY "gimnasios_owner_access" ON public.gimnasios
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "miembros_owner_access" ON public.miembros
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "planes_membresia_owner_access" ON public.planes_membresia
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "entrenadores_owner_access" ON public.entrenadores
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "clases_gym_owner_access" ON public.clases_gym
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "inscripciones_gym_owner_access" ON public.inscripciones_gym
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "pagos_gym_owner_access" ON public.pagos_gym
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "asistencia_clases_owner_access" ON public.asistencia_clases
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

CREATE POLICY "configuracion_gym_owner_access" ON public.configuracion_gym
  FOR ALL USING (
    owner_id IN (
      SELECT owner_id FROM public.usuarios_roles
      WHERE usuario_id = auth.uid() AND estado = 'activo'
    )
  );

-- ============================================================
-- Función para auto-expirar inscripciones vencidas
-- ============================================================
CREATE OR REPLACE FUNCTION public.actualizar_inscripciones_vencidas()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.inscripciones_gym
  SET estado = 'vencida', updated_at = now()
  WHERE estado = 'activa' AND fecha_fin < CURRENT_DATE;
END;
$$;
