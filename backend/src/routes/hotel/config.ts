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
    const hotelId = req.headers['x-hotel-id'] || '2816eaed-e555-44b1-a7dc-f5772e4784de';

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
      // Obtener el owner_id del hotel
      const { data: hotelData, error: hotelErr } = await supabaseAdmin
        .from('hoteles')
        .select('owner_id')
        .eq('id_hotel', hotelId)
        .single();
      
      if (hotelErr || !hotelData?.owner_id) {
        return res.status(400).json({ error: 'El hotel especificado no tiene un propietario asociado o no existe.' });
      }
      const owner_id = hotelData.owner_id;

      // Si no existe configuración para este hotel, crear una con valores por defecto
      const { data: newConfig, error: insertError } = await supabaseAdmin
        .from('configuracion_hotelera')
        .insert([{
          id_hotel: hotelId,
          owner_id,
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
    } : null;

    return res.json({ data: normalized });
  } catch (err) {
    return res.status(500).json({ error: 'Error fetching config' });
  }
});

// PUT - Actualizar configuracion hotelera
router.put('/hotelera', async (req: Request, res: Response) => {
  try {
    const { moneda_principal, moneda_alterna, tipo_cambio_base, tasa_isv, tasa_turistica, nombre_red_hoteles } = req.body;
    const hotelId = req.headers['x-hotel-id'] || '2816eaed-e555-44b1-a7dc-f5772e4784de';

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

    let list: any[] = [];
    if (hotelId && hotelId !== 'all') {
      // Obtener los ids de tipos de habitación presentes en las habitaciones de este hotel
      const { data: habs, error: hErr } = await supabaseAdmin
        .from('habitaciones')
        .select('id_tipo_habitacion')
        .eq('id_hotel', hotelId);

      if (hErr) return res.status(400).json({ error: hErr.message });

      const idsTipos = [...new Set((habs ?? []).map(h => h.id_tipo_habitacion).filter(Boolean))];

      if (idsTipos.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('tipos_habitacion')
          .select('*')
          .in('id_tipo_habitacion', idsTipos)
          .order('nombre_tipo', { ascending: true });

        if (error) return res.status(400).json({ error: error.message });
        list = data ?? [];
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('tipos_habitacion')
        .select('*')
        .order('nombre_tipo', { ascending: true });

      if (error) return res.status(400).json({ error: error.message });
      list = data ?? [];
    }

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
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(401).json({ error: 'No hay propietario asociado' });

    const { nombre, descripcion, precio_base } = req.body;

    if (!nombre || precio_base === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabase
      .from('tipos_habitacion')
      .insert([{
        owner_id,
        nombre_tipo: nombre,
        descripcion,
        tarifa_base: parseFloat(precio_base),
        capacidad_base: 1,
        estado: 'activo',
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data: { id: data.id_tipo_habitacion, nombre: data.nombre_tipo, descripcion: data.descripcion, precio_base: data.tarifa_base, estado: data.estado },
      message: 'Room type created successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Error creating room type' });
  }
});

// PUT - Actualizar tipo de habitacion
router.put('/tipos-habitacion/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, precio_base } = req.body;

    const { data, error } = await supabase
      .from('tipos_habitacion')
      .update({
        nombre_tipo: nombre,
        descripcion,
        tarifa_base: parseFloat(precio_base),
      })
      .eq('id_tipo_habitacion', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      data: { id: data.id_tipo_habitacion, nombre: data.nombre_tipo, descripcion: data.descripcion, precio_base: data.tarifa_base, estado: data.estado },
      message: 'Room type updated successfully',
    });
  } catch (err) {
    res.status(500).json({ error: 'Error updating room type' });
  }
});

// DELETE - Eliminar tipo de habitacion
router.delete('/tipos-habitacion/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('tipos_habitacion')
      .delete()
      .eq('id_tipo_habitacion', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Room type deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Error deleting room type' });
  }
});

// GET - Amenidades (tabla no existe - retorna vacio)
router.get('/amenidades', async (_req: Request, res: Response) => {
  res.json({ data: [] });
});

// PUT - Amenidades (tabla no existe - no-op)
router.put('/amenidades/:id', async (_req: Request, res: Response) => {
  res.json({ data: null, message: 'Amenity updated' });
});

// PUT - Actualizar parametros de reserva
router.put('/parametros-reserva', async (req: Request, res: Response) => {
  try {
    const { hora_checkin, hora_checkout } = req.body;
    const hotelId = req.headers['x-hotel-id'] || '2816eaed-e555-44b1-a7dc-f5772e4784de';

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

    if (ownerIds.length > 0 && hotelIds.length > 0) {
      const ownerIdsCsv = ownerIds.join(',');
      const hotelIdsCsv = hotelIds.join(',');
      query = query.or(`owner_id.in.(${ownerIdsCsv}),id_hotel.in.(${hotelIdsCsv})`);
    } else if (ownerIds.length > 0) {
      query = query.in('owner_id', ownerIds);
    } else if (hotelIds.length > 0) {
      query = query.in('id_hotel', hotelIds);
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

    const { data, error } = await supabaseAdmin
      .from('hoteles')
      .insert([{
        owner_id,
        nombre_hotel,
        ciudad: ciudad || null,
        direccion: direccion || null,
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
    const { nombre_hotel, ciudad, direccion, telefono, correo_contacto, estrellas, enlace_google_maps } = req.body;

    const { data, error } = await supabaseAdmin
      .from('hoteles')
      .update({
        nombre_hotel,
        ciudad: ciudad || null,
        direccion: direccion || null,
        telefono: telefono || null,
        correo_contacto: correo_contacto || null,
        estrellas: estrellas ? Number(estrellas) : 3,
        enlace_google_maps: enlace_google_maps || null
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
