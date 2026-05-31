-- =============================================================================
-- STORED PROCEDURES, VISTAS Y FUNCIONES DE TRANSACCIÓN
-- Adaptado al schema real: sin owner_id en habitaciones/reservas/pagos
-- Aislamiento multi-tenant: habitacion → hotel → business_modules.owner_id
-- =============================================================================


-- =============================================================================
-- VISTA: habitaciones_con_detalles
-- =============================================================================
DROP VIEW IF EXISTS public.habitaciones_con_detalles CASCADE;

CREATE OR REPLACE VIEW public.habitaciones_con_detalles AS
SELECT
  h.id_habitacion,
  h.id_hotel,
  h.codigo_habitacion,
  h.nombre_habitacion,
  h.nombre_alias,
  h.piso,
  h.capacidad,
  h.numero_camas,
  h.tarifa_noche,
  h.imagen_360,
  h.estado,
  t.nombre_tipo AS tipo,
  COALESCE(
    (SELECT array_agg(hc.nombre_comodidad ORDER BY hc.nombre_comodidad)
     FROM public.habitacion_comodidades hc
     WHERE hc.id_habitacion = h.id_habitacion),
    '{}'::text[]
  ) AS comodidades,
  COALESCE(
    (SELECT array_agg(hi.url_imagen ORDER BY hi.orden)
     FROM public.habitacion_imagenes hi
     WHERE hi.id_habitacion = h.id_habitacion),
    '{}'::text[]
  ) AS imagenes
FROM  public.habitaciones h
LEFT JOIN public.tipos_habitacion t ON t.id_tipo_habitacion = h.id_tipo_habitacion;

GRANT SELECT ON public.habitaciones_con_detalles TO authenticated;


-- =============================================================================
-- fn_verificar_disponibilidad_servicio
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_verificar_disponibilidad_servicio(
  p_nombre_servicio    text,
  p_check_in           timestamptz,
  p_check_out          timestamptz,
  p_max_cantidad       integer,
  p_excluir_reserva_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_max integer := 0; v_cnt integer; v_dia date;
BEGIN
  v_dia := p_check_in::date;
  WHILE v_dia < p_check_out::date LOOP
    SELECT COUNT(DISTINCT rs.id_reserva_hotel) INTO v_cnt
    FROM   public.reserva_servicios rs
    JOIN   public.servicios_adicionales sa ON sa.id_servicio = rs.id_servicio
    JOIN   public.reservas_hotel r ON r.id_reserva_hotel = rs.id_reserva_hotel
    WHERE  sa.nombre = p_nombre_servicio
      AND  r.estado NOT IN ('cancelada','no_show')
      AND  r.check_in::date <= v_dia AND r.check_out::date > v_dia
      AND  (p_excluir_reserva_id IS NULL OR r.id_reserva_hotel != p_excluir_reserva_id);
    IF v_cnt > v_max THEN v_max := v_cnt; END IF;
    v_dia := v_dia + 1;
  END LOOP;
  RETURN jsonb_build_object('disponible', v_max < p_max_cantidad, 'max_asignadas', v_max, 'max_permitidas', p_max_cantidad);
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_verificar_disponibilidad_servicio TO authenticated;


-- =============================================================================
-- fn_crear_reserva_completa
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_crear_reserva_completa(
  p_owner_id       uuid,
  p_id_huesped     uuid,
  p_id_habitacion  uuid,
  p_check_in       timestamptz,
  p_check_out      timestamptz,
  p_adultos        integer DEFAULT 1,
  p_ninos          integer DEFAULT 0,
  p_estado         varchar DEFAULT 'confirmada',
  p_total_reserva  numeric DEFAULT 0,
  p_moneda         varchar DEFAULT 'HNL',
  p_observaciones  text    DEFAULT NULL,
  p_estado_pago    varchar DEFAULT 'deuda',
  p_anticipo       numeric DEFAULT 0,
  p_es_cortesia    boolean DEFAULT false,
  p_id_empresa     uuid    DEFAULT NULL,
  p_tipo_reserva   varchar DEFAULT 'noche',
  p_servicios      text[]  DEFAULT '{}'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_hotel uuid; v_id_reserva uuid;
  v_nombre_servicio text; v_limite integer; v_check jsonb; v_servicio record;
  v_limites jsonb := '{"Cama Extra":3,"Neverita":1,"Plancha":8,"Limpieza Diaria":999}'::jsonb;
BEGIN
  -- Verificar que habitación pertenece al owner (via hotel → business_modules)
  SELECT h.id_hotel INTO v_id_hotel
  FROM   public.habitaciones hab
  JOIN   public.hoteles h ON h.id_hotel = hab.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  hab.id_habitacion = p_id_habitacion AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'HABITACION_NO_ENCONTRADA: Habitación % no existe o no pertenece al propietario', p_id_habitacion;
  END IF;
  IF p_check_out <= p_check_in THEN
    RAISE EXCEPTION 'FECHAS_INVALIDAS: check_out debe ser posterior a check_in';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reservas_hotel
    WHERE id_habitacion = p_id_habitacion AND estado NOT IN ('cancelada','no_show','check_out')
      AND check_in < p_check_out AND check_out > p_check_in
  ) THEN
    RAISE EXCEPTION 'HABITACION_OCUPADA: La habitación ya tiene una reserva que se solapa con las fechas indicadas';
  END IF;

  FOREACH v_nombre_servicio IN ARRAY p_servicios LOOP
    v_limite := (v_limites ->> v_nombre_servicio)::integer;
    IF v_limite IS NOT NULL THEN
      v_check := public.fn_verificar_disponibilidad_servicio(v_nombre_servicio, p_check_in, p_check_out, v_limite, NULL);
      IF NOT (v_check->>'disponible')::boolean THEN
        RAISE EXCEPTION 'SERVICIO_NO_DISPONIBLE: El servicio "%" no tiene stock disponible', v_nombre_servicio;
      END IF;
    END IF;
  END LOOP;

  IF p_es_cortesia THEN p_estado_pago := 'cortesia';
  ELSIF p_id_empresa IS NOT NULL THEN p_estado_pago := 'credito';
  ELSIF p_estado_pago NOT IN ('pagado','cortesia','credito','deuda','abonada') THEN p_estado_pago := 'deuda';
  END IF;

  INSERT INTO public.reservas_hotel (
    id_hotel, id_huesped, id_habitacion,
    check_in, check_out, adultos, ninos, estado,
    total_reserva, moneda, observaciones, estado_pago,
    anticipo, es_cortesia, id_empresa, tipo_reserva
  ) VALUES (
    v_id_hotel, p_id_huesped, p_id_habitacion,
    p_check_in, p_check_out, p_adultos, p_ninos, p_estado,
    p_total_reserva, p_moneda, p_observaciones, p_estado_pago,
    p_anticipo, p_es_cortesia, p_id_empresa, p_tipo_reserva
  ) RETURNING id_reserva_hotel INTO v_id_reserva;

  IF array_length(p_servicios, 1) > 0 THEN
    FOR v_servicio IN
      SELECT id_servicio, precio_defecto FROM public.servicios_adicionales
      WHERE nombre = ANY(p_servicios) AND id_hotel = v_id_hotel AND activo = true
    LOOP
      INSERT INTO public.reserva_servicios (id_reserva_hotel, id_servicio, cantidad, precio_unitario)
      VALUES (v_id_reserva, v_servicio.id_servicio, 1, v_servicio.precio_defecto);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id_reserva_hotel', v_id_reserva, 'id_hotel', v_id_hotel);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_crear_reserva_completa TO authenticated;


-- =============================================================================
-- fn_check_in_reserva
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_in_reserva(p_id_reserva uuid, p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_estado varchar;
BEGIN
  SELECT r.id_habitacion, r.estado INTO v_id_habitacion, v_estado
  FROM   public.reservas_hotel r
  JOIN   public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  r.id_reserva_hotel = p_id_reserva AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: Reserva % no existe o no pertenece al propietario', p_id_reserva; END IF;
  IF v_estado NOT IN ('confirmada','pendiente') THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: Solo se puede hacer check-in de reservas confirmadas o pendientes (estado actual: %)', v_estado;
  END IF;

  UPDATE public.reservas_hotel SET estado = 'check_in',   updated_at = now() WHERE id_reserva_hotel = p_id_reserva;
  UPDATE public.habitaciones   SET estado = 'ocupada',    updated_at = now() WHERE id_habitacion    = v_id_habitacion;

  RETURN jsonb_build_object('success', true, 'id_reserva_hotel', p_id_reserva, 'estado', 'check_in');
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_check_in_reserva TO authenticated;


-- =============================================================================
-- fn_check_out_reserva
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_out_reserva(p_id_reserva uuid, p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id_habitacion uuid; v_estado varchar;
BEGIN
  SELECT r.id_habitacion, r.estado INTO v_id_habitacion, v_estado
  FROM   public.reservas_hotel r
  JOIN   public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  r.id_reserva_hotel = p_id_reserva AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: Reserva % no existe o no pertenece al propietario', p_id_reserva; END IF;
  IF v_estado != 'check_in' THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: Solo se puede hacer check-out de reservas en estado check_in (estado actual: %)', v_estado;
  END IF;

  UPDATE public.reservas_hotel SET estado = 'check_out',  updated_at = now() WHERE id_reserva_hotel = p_id_reserva;
  UPDATE public.habitaciones   SET estado = 'disponible', updated_at = now() WHERE id_habitacion    = v_id_habitacion;

  RETURN jsonb_build_object('success', true, 'id_reserva_hotel', p_id_reserva, 'estado', 'check_out');
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_check_out_reserva TO authenticated;


-- =============================================================================
-- fn_cancelar_reserva
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_cancelar_reserva(
  p_id_reserva uuid, p_owner_id uuid, p_anular_pagos boolean DEFAULT false, p_email_usuario text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id_habitacion uuid; v_id_huesped uuid; v_estado varchar;
  v_total_pagado numeric := 0; v_pago record; v_notas_anulacion text; v_credito_generado numeric := 0;
BEGIN
  SELECT r.id_habitacion, r.id_huesped, r.estado INTO v_id_habitacion, v_id_huesped, v_estado
  FROM   public.reservas_hotel r
  JOIN   public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  r.id_reserva_hotel = p_id_reserva AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: Reserva % no existe o no pertenece al propietario', p_id_reserva; END IF;
  IF v_estado = 'cancelada' THEN RAISE EXCEPTION 'RESERVA_YA_CANCELADA: La reserva ya se encuentra cancelada'; END IF;

  IF p_anular_pagos THEN
    SELECT COALESCE(SUM(monto), 0) INTO v_total_pagado
    FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva AND estado != 'anulado';

    IF v_total_pagado > 0 THEN
      v_notas_anulacion := 'Anulado por cancelación de reserva' ||
        CASE WHEN p_email_usuario IS NOT NULL THEN ' (Usuario: ' || p_email_usuario || ')' ELSE '' END;
      FOR v_pago IN SELECT id_pago_hotel, notas FROM public.pagos_hotel
        WHERE id_reserva_hotel = p_id_reserva AND estado != 'anulado'
      LOOP
        UPDATE public.pagos_hotel
        SET estado = 'anulado',
            notas = CASE WHEN v_pago.notas IS NOT NULL THEN v_pago.notas || E'\n' || v_notas_anulacion ELSE v_notas_anulacion END,
            updated_at = now()
        WHERE id_pago_hotel = v_pago.id_pago_hotel;
      END LOOP;
      INSERT INTO public.saldos_clientes (id_huesped, monto, tipo, descripcion)
      VALUES (v_id_huesped, v_total_pagado, 'credito', 'Crédito por cancelación de reserva ' || p_id_reserva::text);
      v_credito_generado := v_total_pagado;
    END IF;
  END IF;

  UPDATE public.reservas_hotel SET estado = 'cancelada', estado_display = 'cancelada', updated_at = now()
  WHERE id_reserva_hotel = p_id_reserva;

  IF v_estado = 'check_in' THEN
    UPDATE public.habitaciones SET estado = 'disponible', updated_at = now() WHERE id_habitacion = v_id_habitacion;
  END IF;

  RETURN jsonb_build_object('success', true, 'id_reserva', p_id_reserva, 'pagos_anulados', p_anular_pagos, 'credito_generado', v_credito_generado);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_cancelar_reserva TO authenticated;


-- =============================================================================
-- fn_registrar_pago
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_registrar_pago(
  p_owner_id uuid, p_id_reserva_hotel uuid, p_monto numeric,
  p_moneda varchar DEFAULT 'HNL', p_metodo_pago varchar DEFAULT 'efectivo',
  p_referencia varchar DEFAULT NULL, p_notas text DEFAULT NULL, p_fecha_pago date DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reserva record; v_id_pago uuid; v_tipo_cambio numeric;
  v_monto_en_moneda numeric; v_total_pagado numeric; v_nuevo_estado_pago varchar;
BEGIN
  SELECT r.total_reserva, r.moneda, r.es_cortesia, r.id_empresa INTO v_reserva
  FROM   public.reservas_hotel r
  JOIN   public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  r.id_reserva_hotel = p_id_reserva_hotel AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: Reserva % no existe o no pertenece al propietario', p_id_reserva_hotel; END IF;
  IF p_monto <= 0 THEN RAISE EXCEPTION 'MONTO_INVALIDO: El monto debe ser mayor que 0'; END IF;

  SELECT COALESCE(MAX(ch.tipo_cambio_base), 24.50) INTO v_tipo_cambio
  FROM public.reservas_hotel r
  LEFT JOIN public.configuracion_hotelera ch ON ch.id_hotel = r.id_hotel
  WHERE r.id_reserva_hotel = p_id_reserva_hotel;

  IF    p_moneda = v_reserva.moneda                   THEN v_monto_en_moneda := p_monto;
  ELSIF p_moneda = 'USD' AND v_reserva.moneda = 'HNL' THEN v_monto_en_moneda := p_monto * v_tipo_cambio;
  ELSIF p_moneda = 'HNL' AND v_reserva.moneda = 'USD' THEN v_monto_en_moneda := p_monto / v_tipo_cambio;
  ELSE                                                      v_monto_en_moneda := p_monto;
  END IF;

  INSERT INTO public.pagos_hotel (
    id_reserva_hotel, monto, monto_en_moneda_reserva,
    metodo_pago, referencia, moneda, estado, notas, fecha_pago
  ) VALUES (
    p_id_reserva_hotel, p_monto, v_monto_en_moneda,
    p_metodo_pago, p_referencia, p_moneda, 'registrado', p_notas, p_fecha_pago
  ) RETURNING id_pago_hotel INTO v_id_pago;

  SELECT COALESCE(SUM(monto_en_moneda_reserva), 0) INTO v_total_pagado
  FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva_hotel AND estado != 'anulado';

  IF    v_reserva.es_cortesia                             THEN v_nuevo_estado_pago := 'cortesia';
  ELSIF v_reserva.id_empresa IS NOT NULL                  THEN v_nuevo_estado_pago := 'credito';
  ELSIF v_total_pagado >= v_reserva.total_reserva - 0.01  THEN v_nuevo_estado_pago := 'pagado';
  ELSIF v_total_pagado > 0                                THEN v_nuevo_estado_pago := 'abonada';
  ELSE                                                         v_nuevo_estado_pago := 'deuda';
  END IF;

  UPDATE public.reservas_hotel SET estado_pago = v_nuevo_estado_pago, updated_at = now()
  WHERE id_reserva_hotel = p_id_reserva_hotel;

  RETURN jsonb_build_object('id_pago_hotel', v_id_pago, 'monto', p_monto, 'estado_pago', v_nuevo_estado_pago, 'total_pagado', v_total_pagado);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_registrar_pago TO authenticated;


-- =============================================================================
-- fn_aplicar_saldo_cliente
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_aplicar_saldo_cliente(p_id_saldo uuid, p_id_reserva_hotel uuid, p_owner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_saldo record; v_total_pagado numeric; v_total_reserva numeric;
  v_pendiente numeric; v_monto_aplicar numeric;
BEGIN
  SELECT id_saldo, monto, aplicado INTO v_saldo FROM public.saldos_clientes WHERE id_saldo = p_id_saldo;
  IF NOT FOUND THEN RAISE EXCEPTION 'SALDO_NO_ENCONTRADO: Saldo % no existe', p_id_saldo; END IF;
  IF v_saldo.aplicado THEN RAISE EXCEPTION 'SALDO_YA_APLICADO: Este saldo ya fue aplicado'; END IF;

  SELECT r.total_reserva INTO v_total_reserva
  FROM   public.reservas_hotel r
  JOIN   public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  r.id_reserva_hotel = p_id_reserva_hotel AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: Reserva % no existe o no pertenece al propietario', p_id_reserva_hotel; END IF;

  SELECT COALESCE(SUM(monto_en_moneda_reserva), 0) INTO v_total_pagado
  FROM public.pagos_hotel WHERE id_reserva_hotel = p_id_reserva_hotel AND estado != 'anulado';

  v_pendiente     := GREATEST(v_total_reserva - v_total_pagado, 0);
  v_monto_aplicar := LEAST(v_saldo.monto, CASE WHEN v_pendiente > 0 THEN v_pendiente ELSE v_saldo.monto END);

  INSERT INTO public.pagos_hotel (id_reserva_hotel, monto, monto_en_moneda_reserva, metodo_pago, moneda, estado, notas, fecha_pago)
  VALUES (p_id_reserva_hotel, v_monto_aplicar, v_monto_aplicar, 'transferencia', 'HNL', 'registrado',
          'Aplicado desde saldo de cliente (saldo ID: ' || p_id_saldo::text || ')', CURRENT_DATE);

  UPDATE public.saldos_clientes SET aplicado = true, fecha_aplicacion = now(), updated_at = now() WHERE id_saldo = p_id_saldo;

  RETURN jsonb_build_object('success', true, 'monto_aplicado', v_monto_aplicar, 'diferencia', v_saldo.monto - v_monto_aplicar);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_aplicar_saldo_cliente TO authenticated;


-- =============================================================================
-- fn_anular_pago
-- =============================================================================
CREATE OR REPLACE FUNCTION public.fn_anular_pago(
  p_id_pago_hotel uuid, p_owner_id uuid, p_motivo text DEFAULT NULL, p_email_usuario text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pago record; v_reserva record; v_notas text;
  v_total_pagado numeric; v_nuevo_estado_pago varchar;
BEGIN
  SELECT p.id_pago_hotel, p.id_reserva_hotel, p.monto, p.estado, p.notas INTO v_pago
  FROM   public.pagos_hotel p
  JOIN   public.reservas_hotel r ON r.id_reserva_hotel = p.id_reserva_hotel
  JOIN   public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN   public.business_modules bm ON bm.id_module = h.id_module
  WHERE  p.id_pago_hotel = p_id_pago_hotel AND bm.owner_id = p_owner_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'PAGO_NO_ENCONTRADO: Pago % no existe o no pertenece al propietario', p_id_pago_hotel; END IF;
  IF v_pago.estado = 'anulado' THEN RAISE EXCEPTION 'PAGO_YA_ANULADO: El pago ya está anulado'; END IF;

  v_notas := 'Anulado por: ' || COALESCE(p_email_usuario, 'sistema') ||
             CASE WHEN p_motivo IS NOT NULL THEN ' (Motivo: ' || p_motivo || ')' ELSE '' END;

  UPDATE public.pagos_hotel
  SET estado = 'anulado',
      notas  = CASE WHEN v_pago.notas IS NOT NULL THEN v_pago.notas || E'\n' || v_notas ELSE v_notas END,
      updated_at = now()
  WHERE id_pago_hotel = p_id_pago_hotel;

  SELECT r.total_reserva, r.moneda, r.estado, r.es_cortesia, r.id_empresa, r.id_huesped INTO v_reserva
  FROM public.reservas_hotel r WHERE id_reserva_hotel = v_pago.id_reserva_hotel;

  IF FOUND AND NOT v_reserva.es_cortesia AND v_reserva.estado NOT IN ('cancelada','no_show') AND v_reserva.id_huesped IS NOT NULL THEN
    INSERT INTO public.saldos_clientes (id_huesped, monto, tipo, descripcion)
    VALUES (v_reserva.id_huesped, v_pago.monto, 'credito',
            'Pago anulado manualmente (reserva ' || RIGHT(v_pago.id_reserva_hotel::text, 8) || ')');

    SELECT COALESCE(SUM(monto_en_moneda_reserva), 0) INTO v_total_pagado
    FROM public.pagos_hotel WHERE id_reserva_hotel = v_pago.id_reserva_hotel AND estado != 'anulado';

    IF    v_reserva.id_empresa IS NOT NULL                           THEN v_nuevo_estado_pago := 'credito';
    ELSIF v_total_pagado >= v_reserva.total_reserva - 0.01          THEN v_nuevo_estado_pago := 'pagado';
    ELSIF v_total_pagado > 0                                         THEN v_nuevo_estado_pago := 'abonada';
    ELSE                                                                  v_nuevo_estado_pago := 'deuda';
    END IF;

    IF v_reserva.estado NOT IN ('cancelada','no_show','check_in','check_out') THEN
      UPDATE public.reservas_hotel SET estado_pago = v_nuevo_estado_pago, updated_at = now()
      WHERE id_reserva_hotel = v_pago.id_reserva_hotel;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id_pago_hotel', p_id_pago_hotel);
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fn_anular_pago TO authenticated;


-- =============================================================================
-- FIN — stored_procedures.sql
-- =============================================================================
