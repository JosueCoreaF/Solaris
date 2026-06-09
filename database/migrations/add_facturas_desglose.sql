-- Agrega columna desglose (JSONB) a facturas para almacenar el desglose de ítems
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS desglose jsonb NOT NULL DEFAULT '[]'::jsonb;
