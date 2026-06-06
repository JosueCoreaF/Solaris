-- Migración: Tracking de consumo de IA por propietario
-- Ejecutar una sola vez en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid        NOT NULL,
  provider     text        NOT NULL DEFAULT 'gemini',
  input_tokens  integer    NOT NULL DEFAULT 0,
  output_tokens integer    NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_owner_created
  ON public.ai_usage_log(owner_id, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede leer/escribir (sin acceso directo desde el cliente)
CREATE POLICY "ai_usage_service_only" ON public.ai_usage_log
  FOR ALL USING (false);
