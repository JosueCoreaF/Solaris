-- Nuevo feature flag: envío automático de emails de confirmación,
-- actualización y cancelación de reserva al huésped y al hotel.
-- Beneficio del plan Estándar (Pro) y Premium (Business) del módulo hotel.

UPDATE public.planes_suscripcion
  SET feature_flags = feature_flags || '["email_confirmaciones"]'::jsonb
  WHERE id_plan IN ('hotel_pro', 'hotel_business');

UPDATE public.planes_suscripcion
  SET features = features || '["Emails automáticos de confirmación de reserva"]'::jsonb
  WHERE id_plan IN ('hotel_pro', 'hotel_business');
