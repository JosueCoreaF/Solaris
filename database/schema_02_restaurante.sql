-- =============================================================================
-- SOLARIS — MÓDULO RESTAURANTE (ejecutar después de schema_00_base.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.restaurante (
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

CREATE TABLE IF NOT EXISTS public.inventario_costos (
  id_prod        bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante bigint      NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  nombre_producto text        NOT NULL,
  cantidad        integer     NOT NULL,
  precio          numeric     NOT NULL,
  categoria       text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventario_costos_pkey PRIMARY KEY (id_prod)
);

CREATE TABLE IF NOT EXISTS public.categorias_gasto_rest (
  id_categoria   bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante bigint  NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  nombre         varchar NOT NULL,
  CONSTRAINT categorias_gasto_rest_pkey PRIMARY KEY (id_categoria)
);

CREATE TABLE IF NOT EXISTS public.pagos_rest (
  id_pago        bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante bigint  NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  id_categoria   bigint  NOT NULL REFERENCES public.categorias_gasto_rest(id_categoria),
  fecha_pago     date    NOT NULL DEFAULT CURRENT_DATE,
  monto          numeric NOT NULL,
  estado         text    NOT NULL DEFAULT 'Por pagar' CHECK (estado IN ('Por pagar','Pagado')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_rest_pkey PRIMARY KEY (id_pago)
);

CREATE INDEX IF NOT EXISTS idx_rest_module   ON public.restaurante (id_module);
CREATE INDEX IF NOT EXISTS idx_invcost_rest  ON public.inventario_costos (id_restaurante);
CREATE INDEX IF NOT EXISTS idx_pagrest_rest  ON public.pagos_rest (id_restaurante);

-- Función RLS (después de la tabla)
CREATE OR REPLACE FUNCTION public.tiene_acceso_restaurante(p_id_restaurante bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurante r
    JOIN public.business_modules bm ON bm.id_module = r.id_module
    WHERE r.id_restaurante = p_id_restaurante AND (
      bm.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.usuarios_roles ur WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id AND ur.id_module = r.id_module AND ur.estado = 'activo')
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_restaurante(bigint) TO authenticated;

ALTER TABLE public.restaurante           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_costos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gasto_rest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_rest            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rest_all"    ON public.restaurante           FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
CREATE POLICY "invcost_all" ON public.inventario_costos     FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
CREATE POLICY "catrest_all" ON public.categorias_gasto_rest FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
CREATE POLICY "pagrest_all" ON public.pagos_rest            FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
