-- Migration: Add Dedicated Gym Roles and Invitations Tables

CREATE TABLE IF NOT EXISTS public.usuarios_roles_gym (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id     uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  id_gimnasio  uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  rol          varchar     NOT NULL CHECK (rol IN ('ADMIN', 'ENTRENADOR', 'RECEPCIONISTA', 'CONTADOR', 'VENDEDOR')),
  estado       varchar     NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('activo', 'inactivo', 'suspendido', 'pendiente')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_roles_gym_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_roles_gym_user_owner_unico UNIQUE (user_id, owner_id, id_gimnasio)
);

CREATE TABLE IF NOT EXISTS public.invitaciones_gym (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_id      uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  email         varchar     NOT NULL,
  codigo_unico  varchar     NOT NULL UNIQUE,
  id_gimnasio   uuid        NOT NULL REFERENCES public.gimnasios(id_gimnasio) ON DELETE CASCADE,
  rol_sugerido  varchar     NOT NULL DEFAULT 'ENTRENADOR' CHECK (rol_sugerido IN ('ADMIN', 'ENTRENADOR', 'RECEPCIONISTA', 'CONTADOR', 'VENDEDOR')),
  usado         boolean     NOT NULL DEFAULT false,
  user_id       uuid        REFERENCES auth.users(id),
  expira_en     timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitaciones_gym_pkey PRIMARY KEY (id)
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_uroles_gym_user ON public.usuarios_roles_gym (user_id);
CREATE INDEX IF NOT EXISTS idx_uroles_gym_owner ON public.usuarios_roles_gym (owner_id);
CREATE INDEX IF NOT EXISTS idx_uroles_gym_gimnasio ON public.usuarios_roles_gym (id_gimnasio);
CREATE INDEX IF NOT EXISTS idx_inv_gym_owner ON public.invitaciones_gym (owner_id);
CREATE INDEX IF NOT EXISTS idx_inv_gym_gimnasio ON public.invitaciones_gym (id_gimnasio);

-- RLS
ALTER TABLE public.usuarios_roles_gym ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones_gym ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uroles_gym_select" ON public.usuarios_roles_gym FOR SELECT USING (owner_id = auth.uid() OR user_id = auth.uid());
CREATE POLICY "uroles_gym_write" ON public.usuarios_roles_gym FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "uroles_gym_insert_self" ON public.usuarios_roles_gym FOR INSERT WITH CHECK (user_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "inv_gym_all" ON public.invitaciones_gym FOR ALL USING (owner_id = auth.uid());

-- View con email
DROP VIEW IF EXISTS public.usuarios_roles_gym_con_email CASCADE;
CREATE OR REPLACE VIEW public.usuarios_roles_gym_con_email AS
SELECT ur.id, ur.user_id, ur.owner_id, ur.id_gimnasio AS id_hotel, ur.rol, ur.estado,
  ur.created_at AS creado_en, ur.updated_at AS actualizado_en, au.email
FROM public.usuarios_roles_gym ur
LEFT JOIN auth.users au ON au.id = ur.user_id;
GRANT SELECT ON public.usuarios_roles_gym_con_email TO authenticated, service_role;

-- Modificar tiene_acceso_gimnasio para leer de usuarios_roles_gym
CREATE OR REPLACE FUNCTION public.tiene_acceso_gimnasio(p_id_gimnasio uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.gimnasios g
    JOIN public.business_modules bm ON bm.id_module = g.id_module
    WHERE g.id_gimnasio = p_id_gimnasio AND bm.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.usuarios_roles_gym ur
    JOIN public.gimnasios g ON g.id_gimnasio = p_id_gimnasio
    JOIN public.business_modules bm ON bm.id_module = g.id_module
    WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id
      AND ur.estado = 'activo' AND (ur.id_gimnasio = p_id_gimnasio)
  );
$$;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_gimnasio(uuid) TO authenticated;
