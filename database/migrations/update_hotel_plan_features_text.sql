-- Alinea el texto descriptivo de "features" con los feature_flags reales
-- de gating (ver add_plan_feature_flags.sql), para que las cards de planes
-- muestren beneficios verídicos.

UPDATE public.planes_suscripcion SET features = '["1 hotel","Reservas y gestión de huéspedes","Chat operativo"]'::jsonb
  WHERE id_plan = 'hotel_starter';

UPDATE public.planes_suscripcion SET features = '["Hasta 5 hoteles","Todo lo de Starter","Cotizaciones","Email Studio (plantillas de correo)","Asistente IA"]'::jsonb
  WHERE id_plan = 'hotel_pro';

UPDATE public.planes_suscripcion SET features = '["Hasta 20 hoteles","Todo lo de Estándar","Auditoría cruzada","Multi-moneda","Reportes","Exportador de datos","Soporte prioritario"]'::jsonb
  WHERE id_plan = 'hotel_business';
