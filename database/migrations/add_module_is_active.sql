-- Migración: agregar is_active a business_modules
-- Ejecutar una sola vez en Supabase SQL Editor

ALTER TABLE public.business_modules
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Sincronizar con el campo estado existente
UPDATE public.business_modules
  SET is_active = (estado = 'activo');
