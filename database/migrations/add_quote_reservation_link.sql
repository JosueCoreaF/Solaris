-- Migración: Relacionar reservas con cotizaciones para bloqueo de cupo
ALTER TABLE public.reservas_hotel 
  ADD COLUMN IF NOT EXISTS id_cotizacion uuid REFERENCES public.cotizaciones(id_cotizacion) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_res_cotizacion ON public.reservas_hotel (id_cotizacion);
