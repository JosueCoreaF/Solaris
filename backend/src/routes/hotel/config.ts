import express, { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser, getOwnerIdsFromHotelId } from '../../utils/tenantHelper.js';

const router = express.Router();

// GET - Obtener configuracion hotelera
router.get('/hotelera', async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' });
    }
    const hotelId = req.headers['x-hotel-id'];

    // Sin hotel seleccionado → retorna null sin error (el frontend lo maneja)
    if (!hotelId || hotelId === '') {
      return res.json({ data: null });
    }

    if (hotelId === 'all') {
      const { data, error } = await supabaseAdmin
        .from('configuracion_hotelera')
        .select('*');
      
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const normalized = (data || []).map((item: any) => ({
        id: item.id_config,
        id_hotel: item.id_hotel,
        moneda_principal: item.moneda,
        moneda_alterna: item.moneda_alterna,
        tipo_cambio_base: Number(item.tipo_cambio_base),
        tipo_cambio_actualizado_en: item.tipo_cambio_actualizado_en,
        tasa_isv: Number(item.porcentaje_impuesto),
        tasa_turistica: Number(item.tasa_turistica ?? 0),
        hora_checkin: item.hora_check_in,
        hora_checkout: item.hora_check_out,
        descuento_tercera_edad: Number(item.descuento_tercera_edad),
        edad_tercera_edad: Number(item.edad_tercera_edad),
        ciudad_base: item.ciudad_base,
        actualizado_en: item.updated_at,
        nombre_red_hoteles: item.nombre_red_hoteles || 'Hotel Verona',
        permite_sobreventa: !!item.permite_sobreventa,
        auto_confirmar_pagos: !!item.auto_confirmar_pagos,
        permitir_edicion_personal: !!item.permitir_edicion_personal,
        horas_anticipacion_reserva: Number(item.horas_anticipacion_reserva ?? 14),
        umbral_ocupacion: Number(item.umbral_ocupacion ?? 85),
        orientacion_calendario: item.orientacion_calendario || 'vertical',
      }));

      return res.json({ data: normalized });
    }

    let { data, error } = await supabaseAdmin
      .from('configuracion_hotelera')
      .select('*')
      .eq('id_hotel', hotelId)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      // Si no existe configuración para este hotel, crear una con valores por defecto
      const { data: newConfig, error: insertError } = await supabaseAdmin
        .from('configuracion_hotelera')
        .insert([{
          id_hotel: hotelId,
          hora_check_in: '14:00:00',
          hora_check_out: '12:00:00',
          moneda: 'HNL',
          porcentaje_impuesto: 0.00,
          tasa_turistica: 0.04,
          permite_sobreventa: false,
          moneda_alterna: 'USD',
          tipo_cambio_base: 24.500000,
          descuento_tercera_edad: 25.00,
          edad_tercera_edad: 60,
          orientacion_calendario: 'vertical',
          ciudad_base: 'San Pedro Sula',
          horas_anticipacion_reserva: 14,
          umbral_ocupacion: 85,
          auto_confirmar_pagos: true,
          permitir_edicion_personal: true
        }])
        .select()
        .single();
      
      if (insertError) {
        return res.status(500).json({ error: 'Error creating default configuration for this hotel: ' + insertError.message });
      }
      data = newConfig;
    }

    const normalized = data ? {
      id: data.id_config,
      id_hotel: data.id_hotel,
      moneda_principal: data.moneda,
      moneda_alterna: data.moneda_alterna,
      tipo_cambio_base: data.tipo_cambio_base,
      tipo_cambio_actualizado_en: data.tipo_cambio_actualizado_en,
      tasa_isv: data.porcentaje_impuesto,
      tasa_turistica: data.tasa_turistica ?? 0,
      hora_checkin: data.hora_check_in,
      hora_checkout: data.hora_check_out,
      descuento_tercera_edad: data.descuento_tercera_edad,
      edad_tercera_edad: data.edad_tercera_edad,
      ciudad_base: data.ciudad_base,
      actualizado_en: data.updated_at,
      nombre_red_hoteles: data.nombre_red_hoteles || 'Hotel Verona',
      permite_sobreventa: !!data.permite_sobreventa,
      auto_confirmar_pagos: !!data.auto_confirmar_pagos,
      permitir_edicion_personal: !!data.permitir_edicion_personal,
      horas_anticipacion_reserva: Number(data.horas_anticipacion_reserva ?? 14),
      umbral_ocupacion: Number(data.umbral_ocupacion ?? 85),
      orientacion_calendario: data.orientacion_calendario || 'vertical',
    } : null;

    return res.json({ data: normalized });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching config' });
  }
});

// PUT - Actualizar configuracion hotelera
router.put('/hotelera', async (req: Request, res: Response) => {
  try {
    const {
      moneda_principal,
      moneda_alterna,
      tipo_cambio_base,
      tasa_isv,
      tasa_turistica,
      nombre_red_hoteles,
      hora_checkin,
      hora_checkout,
      descuento_tercera_edad,
      edad_tercera_edad,
      permite_sobreventa,
      auto_confirmar_pagos,
      permitir_edicion_personal,
      horas_anticipacion_reserva,
      umbral_ocupacion,
      orientacion_calendario,
      ciudad_base
    } = req.body;
    
    const hotelId = req.headers['x-hotel-id'];

    if (!moneda_principal || tipo_cambio_base === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const updateData: any = {
      moneda: moneda_principal,
      moneda_alterna,
      tipo_cambio_base: parseFloat(tipo_cambio_base),
    };
    if (tasa_isv !== undefined) {
      updateData.porcentaje_impuesto = parseFloat(tasa_isv);
    }
    if (tasa_turistica !== undefined) {
      updateData.tasa_turistica = parseFloat(tasa_turistica);
    }
    if (nombre_red_hoteles !== undefined) {
      updateData.nombre_red_hoteles = nombre_red_hoteles;
    }
    if (hora_checkin !== undefined) {
      let formattedCheckin = hora_checkin;
      if (formattedCheckin && formattedCheckin.length === 5) formattedCheckin += ':00';
      updateData.hora_check_in = formattedCheckin;
    }
    if (hora_checkout !== undefined) {
      let formattedCheckout = hora_checkout;
      if (formattedCheckout && formattedCheckout.length === 5) formattedCheckout += ':00';
      updateData.hora_check_out = formattedCheckout;
    }
    if (descuento_tercera_edad !== undefined) {
      updateData.descuento_tercera_edad = parseFloat(descuento_tercera_edad);
    }
    if (edad_tercera_edad !== undefined) {
      updateData.edad_tercera_edad = parseInt(edad_tercera_edad);
    }
    if (permite_sobreventa !== undefined) {
      updateData.permite_sobreventa = !!permite_sobreventa;
    }
    if (auto_confirmar_pagos !== undefined) {
      updateData.auto_confirmar_pagos = !!auto_confirmar_pagos;
    }
    if (permitir_edicion_personal !== undefined) {
      updateData.permitir_edicion_personal = !!permitir_edicion_personal;
    }
    if (horas_anticipacion_reserva !== undefined) {
      updateData.horas_anticipacion_reserva = parseInt(horas_anticipacion_reserva);
    }
    if (umbral_ocupacion !== undefined) {
      updateData.umbral_ocupacion = parseInt(umbral_ocupacion);
    }
    if (orientacion_calendario !== undefined) {
      updateData.orientacion_calendario = orientacion_calendario;
    }
    if (ciudad_base !== undefined) {
      updateData.ciudad_base = ciudad_base;
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' });
    }

    const { data, error } = await supabaseAdmin
      .from('configuracion_hotelera')
      .update(updateData)
      .eq('id_hotel', hotelId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const normalized = data ? {
      id: data.id_config,
      id_hotel: data.id_hotel,
      moneda_principal: data.moneda,
      moneda_alterna: data.moneda_alterna,
      tipo_cambio_base: data.tipo_cambio_base,
      tipo_cambio_actualizado_en: data.tipo_cambio_actualizado_en,
      tasa_isv: data.porcentaje_impuesto,
      tasa_turistica: data.tasa_turistica ?? 0,
      hora_checkin: data.hora_check_in,
      hora_checkout: data.hora_check_out,
      descuento_tercera_edad: data.descuento_tercera_edad,
      edad_tercera_edad: data.edad_tercera_edad,
      ciudad_base: data.ciudad_base,
      actualizado_en: data.updated_at,
      nombre_red_hoteles: data.nombre_red_hoteles || 'Hotel Verona',
      permite_sobreventa: !!data.permite_sobreventa,
      auto_confirmar_pagos: !!data.auto_confirmar_pagos,
      permitir_edicion_personal: !!data.permitir_edicion_personal,
      horas_anticipacion_reserva: Number(data.horas_anticipacion_reserva ?? 14),
      umbral_ocupacion: Number(data.umbral_ocupacion ?? 85),
      orientacion_calendario: data.orientacion_calendario || 'vertical',
    } : null;

    return res.json({ data: normalized, message: 'Configuration updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Error updating config' });
  }
});

// GET - Obtener tipos de habitacion
router.get('/tipos-habitacion', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] || 'all';

    let query = supabaseAdmin
      .from('tipos_habitacion')
      .select('*')
      .order('nombre_tipo', { ascending: true });

    if (hotelId && hotelId !== 'all') {
      query = query.eq('id_hotel', hotelId);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    const list = data ?? [];

    const mapped = list.map((x: any) => ({
      id: x.id_tipo_habitacion,
      nombre: x.nombre_tipo,
      descripcion: x.descripcion,
      precio_base: parseFloat(x.tarifa_base || 0),
      estado: x.estado
    }));

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching room types' });
  }
});

// POST - Crear tipo de habitacion
router.post('/tipos-habitacion', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

    const { nombre, descripcion, capacidad_base, estado } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const { data, error } = await supabaseAdmin
      .from('tipos_habitacion')
      .insert([{
        id_hotel: hotelId,
        nombre_tipo: nombre,
        descripcion: descripcion || '',
        capacidad_base: capacidad_base ?? 2,
        estado: estado ?? 'activo',
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json({
      data: { id: data.id_tipo_habitacion, nombre: data.nombre_tipo, descripcion: data.descripcion, capacidad_base: data.capacidad_base, estado: data.estado },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creating room type' });
  }
});

// PUT - Actualizar tipo de habitacion
router.put('/tipos-habitacion/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, capacidad_base, estado } = req.body;

    const updates: any = {};
    if (nombre         !== undefined) updates.nombre_tipo    = nombre;
    if (descripcion    !== undefined) updates.descripcion    = descripcion;
    if (capacidad_base !== undefined) updates.capacidad_base = capacidad_base;
    if (estado         !== undefined) updates.estado         = estado;

    const { data, error } = await supabaseAdmin
      .from('tipos_habitacion')
      .update(updates)
      .eq('id_tipo_habitacion', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      data: { id: data.id_tipo_habitacion, nombre: data.nombre_tipo, descripcion: data.descripcion, capacidad_base: data.capacidad_base, estado: data.estado },
    });
  } catch (err) {
    res.status(500).json({ error: 'Error updating room type' });
  }
});

// DELETE - Eliminar tipo de habitacion
router.delete('/tipos-habitacion/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('tipos_habitacion').delete().eq('id_tipo_habitacion', id);
    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting room type' });
  }
});

// GET - Servicios
router.get('/servicios', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] || 'all';
    let query = supabaseAdmin.from('comodidades_hotel').select('*').order('nombre');
    if (hotelId && hotelId !== 'all') query = query.eq('id_hotel', hotelId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    const mapped = (data || []).map((s: any) => ({
      id:             s.id_comodidad_hotel,
      nombre:         s.nombre,
      icono:          s.icono || '',
      es_acumulable:  s.es_acumulable ?? false,
      cantidad_total: s.cantidad_total ?? 0,
    }));
    return res.json({ data: mapped });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST - Crear servicio
router.post('/servicios', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all')
      return res.status(400).json({ error: 'x-hotel-id es requerido' });
    const { nombre, icono, es_acumulable, cantidad_total } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const { data, error } = await supabaseAdmin
      .from('comodidades_hotel')
      .insert({ id_hotel: hotelId, nombre, icono: icono || '', es_acumulable: es_acumulable ?? false, cantidad_total: cantidad_total ?? 0 })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({
      data: { id: data.id_comodidad_hotel, nombre: data.nombre, icono: data.icono || '', es_acumulable: data.es_acumulable, cantidad_total: data.cantidad_total },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT - Actualizar servicio
router.put('/servicios/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, icono, es_acumulable, cantidad_total } = req.body;
    const updates: any = {};
    if (nombre         !== undefined) updates.nombre         = nombre;
    if (icono          !== undefined) updates.icono          = icono;
    if (es_acumulable  !== undefined) updates.es_acumulable  = es_acumulable;
    if (cantidad_total !== undefined) updates.cantidad_total = cantidad_total;
    const { data, error } = await supabaseAdmin
      .from('comodidades_hotel').update(updates).eq('id_comodidad_hotel', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      data: data ? { id: data.id_comodidad_hotel, nombre: data.nombre, icono: data.icono || '', es_acumulable: data.es_acumulable, cantidad_total: data.cantidad_total } : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE - Eliminar servicio
router.delete('/servicios/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('comodidades_hotel').delete().eq('id_comodidad_hotel', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PUT - Actualizar parametros de reserva
router.put('/parametros-reserva', async (req: Request, res: Response) => {
  try {
    const { hora_checkin, hora_checkout } = req.body;
    const hotelId = req.headers['x-hotel-id'];

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Supabase admin client not configured' });
    }

    let formattedCheckin = hora_checkin;
    let formattedCheckout = hora_checkout;
    if (formattedCheckin && formattedCheckin.length === 5) formattedCheckin += ':00';
    if (formattedCheckout && formattedCheckout.length === 5) formattedCheckout += ':00';

    const { data, error } = await supabaseAdmin
      .from('configuracion_hotelera')
      .update({
        hora_check_in: formattedCheckin,
        hora_check_out: formattedCheckout,
      })
      .eq('id_hotel', hotelId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ data, message: 'Reservation parameters updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error updating reservation parameters' });
  }
});

// ─── DEV ONLY: Create invitation for testing ───────────────────────────────────

router.post('/dev/create-invitation', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Endpoint only available in development' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Admin client not configured' });
  }

  try {
    const { email = 'test@example.com', rol = 'ADMIN' } = req.body;

    // Generate random code
    const codigo_unico = Math.random().toString(36).substring(2, 15).toUpperCase();

    // Get any hotel ID (or use a default)
    const { data: hotel } = await supabase
      .from('hoteles')
      .select('id_hotel')
      .limit(1)
      .single();

    const id_hotel = hotel?.id_hotel || '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabaseAdmin
      .from('invitaciones')
      .insert({
        email,
        codigo_unico,
        id_hotel,
        rol_sugerido: rol,
        usado: false,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      success: true, 
      email, 
      codigo: codigo_unico,
      message: 'Invitación creada. Úsala para registrarte.' 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEV ONLY: Full setup - Direct insert ────

router.post('/dev/full-setup', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Endpoint only available in development' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Admin client not configured' });
  }

  try {
    // 1. Create room types (we'll use a hardcoded hotel_id, or just insert without it if schema allows)
    await supabaseAdmin.from('tipos_habitacion').delete().neq('id_tipo_habitacion', '');

    const { data: tipos } = await supabaseAdmin
      .from('tipos_habitacion')
      .insert([
        { nombre_tipo: 'Sencilla', tarifa_base: 800, descripcion: 'Habitación sencilla' },
        { nombre_tipo: 'Doble', tarifa_base: 1200, descripcion: 'Habitación doble' },
        { nombre_tipo: 'Triple', tarifa_base: 1600, descripcion: 'Habitación triple' },
      ])
      .select();

    console.log('tipos created:', tipos?.length);

    // 2. Create categories
    await supabaseAdmin.from('categorias_tarifa').delete().neq('id_categoria', '');

    const { data: cats } = await supabaseAdmin
      .from('categorias_tarifa')
      .insert([
        { nombre: 'Normal', descripcion: 'Tarifa estándar' },
        { nombre: 'Corporativa', descripcion: 'Tarifa corporativa' },
        { nombre: 'Especial', descripcion: 'Tarifa especial' },
      ])
      .select();

    console.log('categories created:', cats?.length);

    // 3. Create tariffs
    await supabaseAdmin.from('tarifas').delete().neq('id_tarifa', '');

    const tarifasToInsert: any[] = [];
    
    const pricesByType: Record<string, Record<string, any>> = {
      'Sencilla': {
        'Normal': { noche: 800, hora: 150, pasadia: 400 },
        'Corporativa': { noche: 720, hora: 135, pasadia: 360 },
        'Especial': { noche: 640, hora: 120, pasadia: 320 },
      },
      'Doble': {
        'Normal': { noche: 1200, hora: 200, pasadia: 600 },
        'Corporativa': { noche: 1080, hora: 180, pasadia: 540 },
        'Especial': { noche: 960, hora: 160, pasadia: 480 },
      },
      'Triple': {
        'Normal': { noche: 1600, hora: 250, pasadia: 800 },
        'Corporativa': { noche: 1440, hora: 225, pasadia: 720 },
        'Especial': { noche: 1280, hora: 200, pasadia: 640 },
      },
    };

    tipos?.forEach(tipo => {
      cats?.forEach(cat => {
        const prices = pricesByType[tipo.nombre_tipo]?.[cat.nombre];
        if (prices) {
          tarifasToInsert.push({
            id_tipo_habitacion: tipo.id_tipo_habitacion,
            id_categoria: cat.id_categoria,
            tarifa_noche: prices.noche,
            tarifa_hora: prices.hora,
            tarifa_pasadia: prices.pasadia,
            vigente_desde: new Date().toLocaleDateString('en-CA'),
            vigente_hasta: null,
            activa: true,
          });
        }
      });
    });

    const { data: tarifas } = await supabaseAdmin
      .from('tarifas')
      .insert(tarifasToInsert)
      .select();

    console.log('tarifas created:', tarifas?.length);

    res.json({
      success: true,
      message: '✅ Setup completo',
      tipos: tipos?.length || 0,
      categorias: cats?.length || 0,
      tarifas: tarifas?.length || 0,
    });
  } catch (err: any) {
    console.error('Setup error:', err);
    res.status(500).json({ error: err.message, details: err.details || err.stack });
  }
});

// ─── DEV ONLY: Diagnostic check - detailed ────

router.get('/dev/check-tarifas-detail', async (req: Request, res: Response) => {
  try {
    const hoy = new Date().toLocaleDateString('en-CA');
    
    // Use admin to bypass RLS
    const [tarifas, categorias, tipos] = await Promise.all([
      supabaseAdmin.from('tarifas').select('*').limit(10),
      supabaseAdmin.from('categorias_tarifa').select('*'),
      supabaseAdmin.from('tipos_habitacion').select('*'),
    ]);

    res.json({
      today: hoy,
      tarifas_count: tarifas.data?.length || 0,
      tarifas_sample: tarifas.data?.[0],
      tarifas_all: tarifas.data,
      categorias: categorias.data?.map((c: any) => ({ id: c.id_categoria, nombre: c.nombre, activa: c.activa })),
      tipos: tipos.data?.map((t: any) => ({ id: t.id_tipo_habitacion, nombre: t.nombre_tipo })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEV ONLY: Diagnostic check ────

router.get('/dev/check-data', async (req: Request, res: Response) => {
  try {
    const [tipos, cats, tarifas, hoteles] = await Promise.all([
      supabase.from('tipos_habitacion').select('*'),
      supabase.from('categorias_tarifa').select('*'),
      supabase.from('tarifas').select('*'),
      supabase.from('hoteles').select('*').limit(1),
    ]);

    res.json({
      tipos: tipos.data?.length || 0,
      categorias: cats.data?.length || 0,
      tarifas: tarifas.data?.length || 0,
      hoteles: hoteles.data?.length || 0,
      hoteles_data: hoteles.data,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEV ONLY: Reset and initialize tarifas module ────

router.post('/dev/reset-tarifas', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Endpoint only available in development' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Admin client not configured' });
  }

  try {
    // Get a hotel ID
    const { data: hotel } = await supabase
      .from('hoteles')
      .select('id_hotel')
      .limit(1)
      .single();

    if (!hotel) {
      return res.status(400).json({ error: 'No hotel found in DB. Create one first.' });
    }

    const id_hotel = hotel.id_hotel;

    // 1. Delete and create room types
    await supabaseAdmin.from('tipos_habitacion').delete().eq('id_hotel', id_hotel);

    const { data: tipos, error: tiposErr } = await supabaseAdmin
      .from('tipos_habitacion')
      .insert([
        { nombre_tipo: 'Sencilla', tarifa_base: 800, descripcion: 'Habitación sencilla', id_hotel },
        { nombre_tipo: 'Doble', tarifa_base: 1200, descripcion: 'Habitación doble', id_hotel },
        { nombre_tipo: 'Triple', tarifa_base: 1600, descripcion: 'Habitación triple', id_hotel },
      ])
      .select();

    // 2. Delete and create categories
    await supabaseAdmin.from('categorias_tarifa').delete().neq('id_categoria', '');

    const { data: cats, error: catsErr } = await supabaseAdmin
      .from('categorias_tarifa')
      .insert([
        { nombre: 'Normal', descripcion: 'Tarifa estándar' },
        { nombre: 'Corporativa', descripcion: 'Tarifa corporativa' },
        { nombre: 'Especial', descripcion: 'Tarifa especial' },
      ])
      .select();

    // 3. Delete and create tariffs
    await supabaseAdmin.from('tarifas').delete().neq('id_tarifa', '');

    const tarifasToInsert: any[] = [];
    
    const pricesByType: Record<string, Record<string, any>> = {
      'Sencilla': {
        'Normal': { noche: 800, hora: 150, pasadia: 400 },
        'Corporativa': { noche: 720, hora: 135, pasadia: 360 },
        'Especial': { noche: 640, hora: 120, pasadia: 320 },
      },
      'Doble': {
        'Normal': { noche: 1200, hora: 200, pasadia: 600 },
        'Corporativa': { noche: 1080, hora: 180, pasadia: 540 },
        'Especial': { noche: 960, hora: 160, pasadia: 480 },
      },
      'Triple': {
        'Normal': { noche: 1600, hora: 250, pasadia: 800 },
        'Corporativa': { noche: 1440, hora: 225, pasadia: 720 },
        'Especial': { noche: 1280, hora: 200, pasadia: 640 },
      },
    };

    tipos?.forEach(tipo => {
      cats?.forEach(cat => {
        const prices = pricesByType[tipo.nombre_tipo]?.[cat.nombre];
        if (prices) {
          tarifasToInsert.push({
            id_tipo_habitacion: tipo.id_tipo_habitacion,
            id_categoria: cat.id_categoria,
            tarifa_noche: prices.noche,
            tarifa_hora: prices.hora,
            tarifa_pasadia: prices.pasadia,
            vigente_desde: new Date().toLocaleDateString('en-CA'),
            vigente_hasta: null,
            activa: true,
          });
        }
      });
    });

    const { data: tarifas, error: tarifasErr } = await supabaseAdmin
      .from('tarifas')
      .insert(tarifasToInsert)
      .select();

    res.json({
      success: true,
      message: '✅ Módulo de tarifas configurado',
      tipos: tipos?.length || 0,
      categorias: cats?.length || 0,
      tarifas: tarifas?.length || 0,
      errors: {
        tipos: tiposErr?.message,
        categorias: catsErr?.message,
        tarifas: tarifasErr?.message,
      },
    });
  } catch (err: any) {
    console.error('Reset error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// GET - Obtener todos los hoteles (para que el propietario los liste en el selector)
router.get('/hoteles', async (req: Request, res: Response) => {
  try {
    let ownerIds: string[] = [];
    let hotelIds: string[] = [];
    const user = await getAuthUser(req);

    if (user) {
      const result = await getOwnerHotelIdsForUser(user);
      if (result.error) {
        return res.status(400).json({ error: result.error.message || 'Error al resolver permisos del usuario.' });
      }
      ownerIds = result.ownerIds;
      hotelIds = result.hotelIds;
    } else {
      const activeHotelId = req.headers['x-hotel-id'];
      if (typeof activeHotelId === 'string' && activeHotelId !== 'all') {
        ownerIds = await getOwnerIdsFromHotelId(activeHotelId);
      }
    }

    if (ownerIds.length === 0 && hotelIds.length === 0) {
      return res.json([]);
    }

    let query = supabaseAdmin!
      .from('hoteles')
      .select('*')
      .order('nombre_hotel', { ascending: true });

    if (hotelIds.length > 0) {
      query = query.in('id_hotel', hotelIds);
    } else if (ownerIds.length > 0) {
      // hoteles no tiene owner_id — filtrar via business_modules
      const { data: mods } = await supabaseAdmin!
        .from('business_modules')
        .select('id_module')
        .in('owner_id', ownerIds);
      const moduleIds = (mods || []).map((m: any) => m.id_module);
      if (moduleIds.length === 0) return res.json([]);
      query = query.in('id_module', moduleIds);
    }

    const { data, error } = await query;
    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al obtener los hoteles' });
  }
});

// POST - Registrar un nuevo hotel
router.post('/hoteles', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(401).json({ error: 'No hay propietario asociado' });

    const { nombre_hotel, ciudad, direccion, telefono, correo_contacto, estrellas, enlace_google_maps } = req.body;

    if (!nombre_hotel) {
      return res.status(400).json({ error: 'El nombre_hotel es obligatorio' });
    }

    // Buscar o crear business_module para este owner
    const { data: existingMod } = await supabaseAdmin!
      .from('business_modules')
      .select('id_module')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', 'hotel')
      .limit(1)
      .maybeSingle();

    let id_module = existingMod?.id_module;
    if (!id_module) {
      const { data: newMod } = await supabaseAdmin!
        .from('business_modules')
        .insert({ owner_id, tipo_modulo: 'hotel', nombre_modulo: nombre_hotel, estado: 'activo' })
        .select('id_module')
        .single();
      id_module = newMod?.id_module;
    }

    const { data, error } = await supabaseAdmin!
      .from('hoteles')
      .insert([{
        id_module,
        nombre_hotel,
        ciudad: ciudad || 'Sin definir',
        direccion: direccion || 'Sin definir',
        telefono: telefono || null,
        correo_contacto: correo_contacto || null,
        estrellas: estrellas ? Number(estrellas) : 3,
        enlace_google_maps: enlace_google_maps || null,
        estado: 'activo'
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Hotel registrado exitosamente',
      data
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al registrar el hotel' });
  }
});

// PUT - Actualizar un hotel existente
router.put('/hoteles/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre_hotel, ciudad, direccion, telefono, correo_contacto, estrellas, enlace_google_maps, logo_url, color_primario, color_secundario, redes_sociales } = req.body;

    const { data, error } = await supabaseAdmin
      .from('hoteles')
      .update({
        nombre_hotel,
        ciudad: ciudad || null,
        direccion: direccion || null,
        telefono: telefono || null,
        correo_contacto: correo_contacto || null,
        estrellas: estrellas ? Number(estrellas) : 3,
        enlace_google_maps: enlace_google_maps || null,
        logo_url: logo_url || null,
        color_primario: color_primario || null,
        color_secundario: color_secundario || null,
        redes_sociales: redes_sociales || null
      })
      .eq('id_hotel', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Hotel actualizado exitosamente',
      data
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar el hotel' });
  }
});

export default router;
