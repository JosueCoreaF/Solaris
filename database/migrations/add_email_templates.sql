CREATE TABLE IF NOT EXISTS public.plantillas_correo (
  id_plantilla         uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel             uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  tipo_plantilla       varchar     NOT NULL CHECK (tipo_plantilla IN ('confirmacion', 'actualizacion', 'cancelacion', 'cotizacion')),
  asunto               varchar     NOT NULL,
  cuerpo_personalizado text,
  estilos              jsonb       NOT NULL DEFAULT '{}'::jsonb, -- color_cabecera, fuente, tamano_letra, logo_url, firma
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plantillas_correo_pkey PRIMARY KEY (id_plantilla),
  CONSTRAINT unique_hotel_template UNIQUE (id_hotel, tipo_plantilla)
);

-- Habilitar RLS
ALTER TABLE public.plantillas_correo ENABLE ROW LEVEL SECURITY;

-- Política de RLS usando tiene_acceso_hotel
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'plantillas_correo' AND policyname = 'templates_all'
  ) THEN
    CREATE POLICY "templates_all" 
      ON public.plantillas_correo 
      FOR ALL 
      USING (public.tiene_acceso_hotel(id_hotel));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_pc_hotel_tipo ON public.plantillas_correo(id_hotel, tipo_plantilla);
