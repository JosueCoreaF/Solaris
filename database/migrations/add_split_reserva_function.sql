-- Función para dividir una reserva (Split Stay): recorta la reserva original
-- hasta la fecha indicada y crea una nueva reserva (misma habitación/huésped)
-- con las noches restantes, prorrateando el total según el precio por noche.
CREATE OR REPLACE FUNCTION public.fn_split_reserva(
  p_id_reserva_hotel uuid,
  p_fecha_split      date,
  p_owner_id         uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reserva          record;
  v_nuevo_check_out  timestamptz;
  v_nuevo_check_in   timestamptz;
  v_noches_total     integer;
  v_noches_original  integer;
  v_precio_noche     numeric;
  v_total_original   numeric;
  v_total_nueva      numeric;
  v_estado_pago_nueva varchar;
  v_id_nueva_reserva uuid;
BEGIN
  SELECT r.* INTO v_reserva
  FROM public.reservas_hotel r
  JOIN public.hoteles h ON h.id_hotel = r.id_hotel
  JOIN public.business_modules bm ON bm.id_module = h.id_module
  WHERE r.id_reserva_hotel = p_id_reserva_hotel
    AND (p_owner_id IS NULL OR bm.owner_id = p_owner_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVA_NO_ENCONTRADA: %', p_id_reserva_hotel; END IF;

  IF v_reserva.estado IN ('cancelada','no_show','check_out') THEN
    RAISE EXCEPTION 'ESTADO_INVALIDO: %', v_reserva.estado;
  END IF;

  -- La estancia original se recorta hasta p_fecha_split (con la hora de check-out original)
  -- y la nueva reserva inicia ese mismo día (con la hora de check-in original).
  v_nuevo_check_out := p_fecha_split + v_reserva.check_out::time;
  v_nuevo_check_in  := p_fecha_split + v_reserva.check_in::time;

  IF v_nuevo_check_out <= v_reserva.check_in OR v_nuevo_check_in >= v_reserva.check_out THEN
    RAISE EXCEPTION 'FECHA_SPLIT_INVALIDA: %', p_fecha_split;
  END IF;

  v_noches_total    := v_reserva.check_out::date - v_reserva.check_in::date;
  v_noches_original := v_nuevo_check_out::date  - v_reserva.check_in::date;

  IF v_noches_total <= 0 THEN
    v_precio_noche := v_reserva.total_reserva;
  ELSE
    v_precio_noche := v_reserva.total_reserva / v_noches_total;
  END IF;

  v_total_original := round(v_precio_noche * v_noches_original, 2);
  v_total_nueva    := round(v_reserva.total_reserva - v_total_original, 2);

  -- Recorta la reserva original
  UPDATE public.reservas_hotel
  SET check_out     = v_nuevo_check_out,
      total_reserva = v_total_original,
      updated_at    = now()
  WHERE id_reserva_hotel = p_id_reserva_hotel;

  IF v_reserva.es_cortesia THEN
    v_estado_pago_nueva := 'cortesia';
  ELSIF v_reserva.id_empresa IS NOT NULL THEN
    v_estado_pago_nueva := 'credito';
  ELSE
    v_estado_pago_nueva := 'deuda';
  END IF;

  -- Crea la nueva reserva con las noches restantes
  INSERT INTO public.reservas_hotel (
    id_hotel, id_huesped, id_habitacion, id_empresa,
    check_in, check_out, adultos, ninos,
    estado, estado_display, tipo_reserva,
    total_reserva, moneda, estado_pago, anticipo, es_cortesia,
    observaciones, created_by
  ) VALUES (
    v_reserva.id_hotel, v_reserva.id_huesped, v_reserva.id_habitacion, v_reserva.id_empresa,
    v_nuevo_check_in, v_reserva.check_out, v_reserva.adultos, v_reserva.ninos,
    v_reserva.estado, v_reserva.estado_display, v_reserva.tipo_reserva,
    v_total_nueva, v_reserva.moneda, v_estado_pago_nueva, 0, v_reserva.es_cortesia,
    v_reserva.observaciones, v_reserva.created_by
  )
  RETURNING id_reserva_hotel INTO v_id_nueva_reserva;

  -- Copia comodidades y servicios adicionales a la nueva reserva
  INSERT INTO public.reserva_comodidades (id_reserva_hotel, id_comodidad, cantidad)
  SELECT v_id_nueva_reserva, id_comodidad, cantidad
  FROM public.reserva_comodidades WHERE id_reserva_hotel = p_id_reserva_hotel;

  INSERT INTO public.reserva_servicios (id_reserva_hotel, id_servicio, cantidad, precio_unitario)
  SELECT v_id_nueva_reserva, id_servicio, cantidad, precio_unitario
  FROM public.reserva_servicios WHERE id_reserva_hotel = p_id_reserva_hotel;

  RETURN jsonb_build_object(
    'success', true,
    'id_reserva_original', p_id_reserva_hotel,
    'id_reserva_nueva', v_id_nueva_reserva,
    'total_original', v_total_original,
    'total_nueva', v_total_nueva
  );
EXCEPTION WHEN OTHERS THEN RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_split_reserva TO authenticated;
