-- Migración: Super-Admin Solarys
-- Ejecutar una sola vez en Supabase SQL Editor

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS is_solarys_admin boolean NOT NULL DEFAULT false;

-- Política: solo el propio admin puede verse como tal (service_role bypasea esto)
DROP POLICY IF EXISTS "owners_self_read" ON public.owners;
CREATE POLICY "owners_self_read" ON public.owners
  FOR SELECT USING (id_owner = auth.uid() OR is_solarys_admin = true);
