-- =============================================================================
-- Avance 2 — Consultas Avanzadas asignadas a Grupo 3 (Solaris)
-- ABD2 · 2026 Q2 · Semana 8
--
-- Las 4 consultas de abajo son las asignadas en "Consultas_Solaris_Grupo3.docx".
-- Ejecutar cada SELECT por separado en el SQL Editor de Supabase / DBeaver /
-- pgAdmin para tomar el screenshot del resultado (entregable del Avance 2).
--
-- La función al final expone la Consulta 1 como endpoint REST:
--   GET /api/reportes/dashboard-ocupacion
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Consulta 1: Dashboard de Ocupación e Ingresos por Hotel
-- Tipo: JOIN múltiple + Agregación condicional (FILTER)
-- Retorna: una fila por hotel con habitaciones totales/ocupadas/disponibles,
--          % de ocupación e ingresos del mes actual, de mayor a menor ocupación.
-- -----------------------------------------------------------------------------
SELECT
  h.id_hotel,
  h.nombre_hotel,
  h.ciudad,
  h.estrellas,
  COUNT(DISTINCT hab.id_habitacion) AS habitaciones_totales,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')    AS habitaciones_ocupadas,
  COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'disponible') AS habitaciones_disponibles,
  ROUND(
    COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')::numeric
      / NULLIF(COUNT(DISTINCT hab.id_habitacion), 0) * 100,
    2
  ) AS porcentaje_ocupacion,
  COALESCE(SUM(p.monto) FILTER (
    WHERE p.estado != 'anulado'
      AND p.fecha_pago >= date_trunc('month', CURRENT_DATE)
      AND p.fecha_pago <  date_trunc('month', CURRENT_DATE) + interval '1 month'
  ), 0) AS ingresos_mes_actual
FROM public.hoteles h
LEFT JOIN public.habitaciones   hab ON hab.id_hotel = h.id_hotel
LEFT JOIN public.reservas_hotel r   ON r.id_habitacion = hab.id_habitacion
LEFT JOIN public.pagos_hotel    p   ON p.id_reserva_hotel = r.id_reserva_hotel
GROUP BY h.id_hotel, h.nombre_hotel, h.ciudad, h.estrellas
ORDER BY porcentaje_ocupacion DESC;


-- -----------------------------------------------------------------------------
-- Consulta 2: Huéspedes Frecuentes con Saldo de Crédito
-- Tipo: Subconsulta correlacionada + HAVING
-- Retorna: huéspedes con más de 1 reserva, su gasto total histórico, fecha de
--          última visita y saldo neto pendiente (positivo = debe, negativo =
--          crédito a favor), ordenado por número de reservas.
-- -----------------------------------------------------------------------------
SELECT
  hu.id_huesped,
  hu.nombre_completo,
  hu.correo,
  hu.ciudad,
  COUNT(r.id_reserva_hotel)         AS numero_reservas,
  COALESCE(SUM(r.total_reserva), 0) AS gasto_total,
  MAX(r.check_in)                   AS ultima_visita,
  (
    SELECT COALESCE(SUM(CASE WHEN s.tipo = 'debito'  THEN s.monto ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN s.tipo = 'credito' THEN s.monto ELSE 0 END), 0)
    FROM public.saldos_clientes s
    WHERE s.id_huesped = hu.id_huesped
      AND s.aplicado = false
  ) AS saldo_pendiente
FROM public.huespedes hu
JOIN public.reservas_hotel r ON r.id_huesped = hu.id_huesped
GROUP BY hu.id_huesped, hu.nombre_completo, hu.correo, hu.ciudad
HAVING COUNT(r.id_reserva_hotel) > 1
ORDER BY numero_reservas DESC;


-- -----------------------------------------------------------------------------
-- Consulta 3: Tipos de Habitación por Ingresos Estimados
-- Tipo: GROUP BY + HAVING + Subconsulta escalar + Agregación
-- Retorna: tipos de habitación con al menos una reserva completada (check_out),
--          ingresos estimados (noches x tarifa vigente), estadía promedio y
--          número de reservas completadas, ordenado por ingresos.
-- -----------------------------------------------------------------------------
SELECT
  th.id_tipo_habitacion,
  th.nombre_tipo,
  th.capacidad_base,
  COUNT(DISTINCT hab.id_habitacion) AS cantidad_habitaciones,
  COUNT(r.id_reserva_hotel)         AS reservas_completadas,
  ROUND(SUM(
    (EXTRACT(EPOCH FROM (r.check_out - r.check_in)) / 86400.0) *
    (
      SELECT t.tarifa_noche
      FROM public.tarifas t
      WHERE t.id_tipo_habitacion = th.id_tipo_habitacion
        AND t.activa = true
        AND t.vigente_desde <= CURRENT_DATE
        AND (t.vigente_hasta IS NULL OR t.vigente_hasta >= CURRENT_DATE)
      ORDER BY t.vigente_desde DESC
      LIMIT 1
    )
  ), 2) AS ingresos_estimados,
  ROUND(AVG(EXTRACT(EPOCH FROM (r.check_out - r.check_in)) / 86400.0), 2) AS estadia_promedio_noches
FROM public.tipos_habitacion th
JOIN public.habitaciones   hab ON hab.id_tipo_habitacion = th.id_tipo_habitacion
JOIN public.reservas_hotel r   ON r.id_habitacion = hab.id_habitacion AND r.estado = 'check_out'
GROUP BY th.id_tipo_habitacion, th.nombre_tipo, th.capacidad_base
HAVING COUNT(r.id_reserva_hotel) >= 1
ORDER BY ingresos_estimados DESC;


-- -----------------------------------------------------------------------------
-- Consulta 4: Ranking de Habitaciones por Ingresos con Acumulado
-- Tipo: Window Function — RANK() OVER + SUM() OVER (acumulado corrido)
-- Retorna: una fila por habitación con su ranking de ingresos dentro de su
--          hotel y el acumulado corrido de ingresos del hotel hasta esa
--          posición del ranking.
-- -----------------------------------------------------------------------------
SELECT
  h.nombre_hotel,
  hab.codigo_habitacion,
  th.nombre_tipo,
  hab.tarifa_noche,
  COUNT(DISTINCT r.id_reserva_hotel) AS total_reservas,
  COALESCE(SUM(p.monto), 0)          AS ingresos_totales,
  RANK() OVER (
    PARTITION BY h.id_hotel
    ORDER BY COALESCE(SUM(p.monto), 0) DESC
  ) AS ranking_en_hotel,
  SUM(COALESCE(SUM(p.monto), 0)) OVER (
    PARTITION BY h.id_hotel
    ORDER BY COALESCE(SUM(p.monto), 0) DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS acumulado_hotel
FROM public.habitaciones hab
JOIN public.hoteles          h  ON h.id_hotel = hab.id_hotel
JOIN public.tipos_habitacion th ON th.id_tipo_habitacion = hab.id_tipo_habitacion
LEFT JOIN public.reservas_hotel r ON r.id_habitacion = hab.id_habitacion
LEFT JOIN public.pagos_hotel    p ON p.id_reserva_hotel = r.id_reserva_hotel AND p.estado != 'anulado'
GROUP BY h.id_hotel, h.nombre_hotel, hab.id_habitacion, hab.codigo_habitacion, th.nombre_tipo, hab.tarifa_noche
ORDER BY h.nombre_hotel, ranking_en_hotel;


-- =============================================================================
-- Función que expone la Consulta 1 (Dashboard de Ocupación e Ingresos)
-- vía la API REST: GET /api/reportes/dashboard-ocupacion
-- p_hotel_id = NULL -> incluye todos los hoteles
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_dashboard_ocupacion_ingresos(p_hotel_id uuid DEFAULT NULL)
RETURNS TABLE (
  id_hotel uuid,
  nombre_hotel varchar,
  ciudad varchar,
  estrellas integer,
  habitaciones_totales bigint,
  habitaciones_ocupadas bigint,
  habitaciones_disponibles bigint,
  porcentaje_ocupacion numeric,
  ingresos_mes_actual numeric
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    h.id_hotel,
    h.nombre_hotel,
    h.ciudad,
    h.estrellas,
    COUNT(DISTINCT hab.id_habitacion) AS habitaciones_totales,
    COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')    AS habitaciones_ocupadas,
    COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'disponible') AS habitaciones_disponibles,
    ROUND(
      COUNT(DISTINCT hab.id_habitacion) FILTER (WHERE hab.estado = 'ocupada')::numeric
        / NULLIF(COUNT(DISTINCT hab.id_habitacion), 0) * 100,
      2
    ) AS porcentaje_ocupacion,
    COALESCE(SUM(p.monto) FILTER (
      WHERE p.estado != 'anulado'
        AND p.fecha_pago >= date_trunc('month', CURRENT_DATE)
        AND p.fecha_pago <  date_trunc('month', CURRENT_DATE) + interval '1 month'
    ), 0) AS ingresos_mes_actual
  FROM public.hoteles h
  LEFT JOIN public.habitaciones   hab ON hab.id_hotel = h.id_hotel
  LEFT JOIN public.reservas_hotel r   ON r.id_habitacion = hab.id_habitacion
  LEFT JOIN public.pagos_hotel    p   ON p.id_reserva_hotel = r.id_reserva_hotel
  WHERE p_hotel_id IS NULL OR h.id_hotel = p_hotel_id
  GROUP BY h.id_hotel, h.nombre_hotel, h.ciudad, h.estrellas
  ORDER BY porcentaje_ocupacion DESC;
$$;

GRANT EXECUTE ON FUNCTION public.fn_dashboard_ocupacion_ingresos TO authenticated;
