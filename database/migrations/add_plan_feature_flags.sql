-- Feature flags por plan de suscripción: gating progresivo de funcionalidad
-- Starter: sin extras. Estándar (hotel_pro): cotizaciones + email studio + asistente IA.
-- Premium (hotel_business): todo lo anterior + auditoría + multi-moneda + reportes + exportador.

ALTER TABLE public.planes_suscripcion
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '[]';

UPDATE public.planes_suscripcion SET feature_flags = '[]'::jsonb
  WHERE id_plan = 'hotel_starter';

UPDATE public.planes_suscripcion SET feature_flags = '["cotizaciones","email_studio","ai_asistente"]'::jsonb
  WHERE id_plan = 'hotel_pro';

UPDATE public.planes_suscripcion SET feature_flags = '["cotizaciones","email_studio","ai_asistente","auditoria","multimoneda","reportes","exportador_datos"]'::jsonb
  WHERE id_plan = 'hotel_business';
