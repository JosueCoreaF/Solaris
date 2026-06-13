import express, { Request, Response } from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';
import { getAuthUser, getOwnerIdsFromHotelId } from '../../utils/tenantHelper.js';
import { sendQuoteEmail } from '../../utils/emailService.js';
import { getIO } from './chat.js';
import { crearNotificacion } from '../../utils/notificaciones.js';
import { 
  allocateRoomsForQuote, 
  syncQuoteReservations 
} from '../../utils/quoteReservationHelper.js';

const router = express.Router();
const db = () => supabaseAdmin ?? supabase;

// GET /api/hotel/quotes — Listar todas las cotizaciones de un hotel
router.get('/', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'Hotel requerido' });

    const { estado } = req.query;

    let query = db()
      .from('cotizaciones')
      .select('*')
      .eq('id_hotel', hotelId)
      .order('created_at', { ascending: false });

    if (estado) {
      query = query.eq('estado', estado as string);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/hotel/quotes/disponibilidad?id_tipo_habitacion=...&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Para un tipo de habitación y una ventana de fechas, indica qué noches
// quedan completamente ocupadas (todas las habitaciones de ese tipo ya
// reservadas) y la tarifa de referencia. El formulario de cotización usa
// esto para que el selector de fechas solo permita elegir noches con
// disponibilidad real. Debe declararse antes de '/:id' para no chocar
// con ese parámetro de ruta.
router.get('/disponibilidad', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'Hotel requerido' });

    const { id_tipo_habitacion, desde, hasta } = req.query;
    if (!id_tipo_habitacion || !desde || !hasta) {
      return res.status(400).json({ error: 'id_tipo_habitacion, desde y hasta son requeridos' });
    }

    const desdeStr = String(desde).split('T')[0];
    const hastaStr = String(hasta).split('T')[0];
    if (!desdeStr || !hastaStr || desdeStr >= hastaStr) {
      return res.json({ totalHabitaciones: 0, fechasNoDisponibles: [], tarifaNoche: 0 });
    }

    const { data: habitaciones, error: habErr } = await db()
      .from('habitaciones')
      .select('id_habitacion, tarifa_noche')
      .eq('id_hotel', hotelId)
      .eq('id_tipo_habitacion', id_tipo_habitacion);

    if (habErr) return res.status(500).json({ error: habErr.message });

    const roomIds = (habitaciones || []).map((h: any) => h.id_habitacion);
    const totalHabitaciones = roomIds.length;

    if (totalHabitaciones === 0) {
      return res.json({ totalHabitaciones: 0, fechasNoDisponibles: [], disponiblesPorNoche: {}, tarifaNoche: 0, capacidadBase: 2 });
    }

    const tarifaNoche = Number(
      habitaciones!.reduce((s: number, h: any) => s + Number(h.tarifa_noche || 0), 0) / totalHabitaciones
    );

    const { data: tipoHab } = await db()
      .from('tipos_habitacion')
      .select('capacidad_base')
      .eq('id_tipo_habitacion', id_tipo_habitacion as string)
      .maybeSingle();
    const capacidadBase = Number(tipoHab?.capacidad_base ?? 2);

    const { data: reservas, error: resErr } = await db()
      .from('reservas_hotel')
      .select('id_habitacion, check_in, check_out, estado')
      .in('id_habitacion', roomIds)
      .not('estado', 'in', '("cancelada","no_show")');

    if (resErr) return res.status(500).json({ error: resErr.message });

    // Generar la lista de noches dentro de la ventana solicitada
    const noches: string[] = [];
    let cursor = new Date(desdeStr + 'T12:00:00Z');
    const fin = new Date(hastaStr + 'T12:00:00Z');
    while (cursor < fin) {
      noches.push(cursor.toISOString().split('T')[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const fechasNoDisponibles: string[] = [];
    const disponiblesPorNoche: Record<string, number> = {};

    for (const noche of noches) {
      const ocupadas = new Set<string>();
      for (const r of (reservas || [])) {
        const rIn = String(r.check_in).split('T')[0].split(' ')[0];
        const rOut = String(r.check_out).split('T')[0].split(' ')[0];
        if (noche >= rIn && noche < rOut) ocupadas.add(r.id_habitacion);
      }
      const disponibles = totalHabitaciones - ocupadas.size;
      disponiblesPorNoche[noche] = disponibles;
      if (disponibles <= 0) fechasNoDisponibles.push(noche);
    }

    return res.json({ totalHabitaciones, fechasNoDisponibles, disponiblesPorNoche, tarifaNoche, capacidadBase });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/hotel/quotes/:id — Obtener detalle de cotización con items
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const { data: quote, error: quoteErr } = await db()
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .eq('id_cotizacion', id)
      .eq('id_hotel', hotelId)
      .maybeSingle();

    if (quoteErr) return res.status(500).json({ error: quoteErr.message });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    // Buscar si ya existen reservas confirmadas para esta cotización
    const { data: bookings } = await db()
      .from('reservas_hotel')
      .select('id_reserva_hotel')
      .eq('id_hotel', hotelId)
      .eq('id_cotizacion', id)
      .eq('estado', 'confirmada');

    return res.json({
      ...quote,
      convertida: bookings && bookings.length > 0
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/hotel/quotes — Crear cotización
router.post('/', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const ownerIds = await getOwnerIdsFromHotelId(hotelId);
    if (!ownerIds || ownerIds.length === 0) {
      return res.status(403).json({ error: 'No tienes acceso a este hotel' });
    }

    const {
      id_huesped,
      id_empresa,
      cliente_nombre,
      cliente_identificacion,
      cliente_correo,
      cliente_telefono,
      fecha_emision,
      fecha_vencimiento,
      check_in,
      check_out,
      cant_noches,
      adultos,
      ninos,
      estado,
      subtotal,
      impuesto_isv,
      impuesto_turismo,
      total,
      moneda,
      tipo_cambio,
      impuestos_incluidos,
      clausula_no_fiscalidad,
      politicas_cancelacion,
      vigencia_texto,
      cuentas_bancarias,
      notes, // support both notes or notas
      notas,
      items
    } = req.body;

    if (!cliente_nombre || !cliente_correo || !check_in || !check_out) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // 1. Validar disponibilidad física antes de crear la cotización si el estado requiere bloqueo
    const roomItems = (items || []).filter((it: any) => it.tipo_item === 'habitacion');
    const targetStatus = estado || 'Borrador';
    const isHoldState = ['Borrador', 'Enviada', 'Aceptada'].includes(targetStatus);

    if (isHoldState && roomItems.length > 0) {
      const checkAlloc = await allocateRoomsForQuote(null, hotelId, roomItems, check_in, check_out);
      if (!checkAlloc.success) {
        return res.status(400).json({ error: checkAlloc.error });
      }
    }

    // Generar número de cotización único (COT-YYYY-XXXX).
    // Se basa en el correlativo más alto ya existente (no en un conteo de filas),
    // ya que cotizaciones eliminadas por rollback dejan huecos en la secuencia
    // y un conteo simple puede volver a generar un número ya usado, violando
    // el índice único (id_hotel, numero_cotizacion).
    const year = new Date(fecha_emision || new Date()).getFullYear();
    const prefix = `COT-${year}-`;
    const { data: lastQuote } = await db()
      .from('cotizaciones')
      .select('numero_cotizacion')
      .eq('id_hotel', hotelId)
      .like('numero_cotizacion', `${prefix}%`)
      .order('numero_cotizacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSeq = 1;
    const lastSeqMatch = lastQuote?.numero_cotizacion?.match(/(\d+)$/);
    if (lastSeqMatch) nextSeq = parseInt(lastSeqMatch[1], 10) + 1;

    const numCot = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    // Insertar la cotización
    const { data: quote, error: quoteErr } = await db()
      .from('cotizaciones')
      .insert({
        id_hotel: hotelId,
        numero_cotizacion: numCot,
        id_huesped: id_huesped || null,
        id_empresa: id_empresa || null,
        cliente_nombre,
        cliente_identificacion: cliente_identificacion || null,
        cliente_correo,
        cliente_telefono: cliente_telefono || null,
        fecha_emision: fecha_emision || new Date().toISOString().split('T')[0],
        fecha_vencimiento: fecha_vencimiento,
        check_in,
        check_out,
        cant_noches,
        adultos: adultos || 1,
        ninos: ninos || 0,
        estado: targetStatus,
        subtotal: subtotal || 0,
        impuesto_isv: impuesto_isv || 0,
        impuesto_turismo: impuesto_turismo || 0,
        total: total || 0,
        moneda: moneda || 'HNL',
        tipo_cambio: tipo_cambio || 26.58,
        impuestos_incluidos: impuestos_incluidos || false,
        clausula_no_fiscalidad: clausula_no_fiscalidad || null,
        politicas_cancelacion: politicas_cancelacion || null,
        vigencia_texto: vigencia_texto || null,
        cuentas_bancarias: cuentas_bancarias || null,
        notas: notas || notes || null,
        owner_id: ownerIds[0]
      })
      .select()
      .single();

    if (quoteErr) return res.status(500).json({ error: quoteErr.message });

    // Insertar items si existen
    if (items && Array.isArray(items) && items.length > 0) {
      const { error: itemsErr } = await db()
        .from('cotizacion_items')
        .insert(
          items.map(item => ({
            id_cotizacion: quote.id_cotizacion,
            tipo_item: item.tipo_item,
            descripcion: item.descripcion,
            id_tipo_habitacion: item.id_tipo_habitacion || null,
            id_servicio: item.id_servicio || null,
            cantidad: item.cantidad || 1,
            precio_unitario: item.precio_unitario || 0,
            subtotal: item.subtotal || 0,
            check_in: item.check_in || null,
            check_out: item.check_out || null,
            noches: item.noches || null,
            adultos: item.adultos || 1,
            ninos: item.ninos || 0,
            detalles_huespedes: item.detalles_huespedes || null
          }))
        );
      
      if (itemsErr) {
        // Rollback
        await db().from('cotizaciones').delete().eq('id_cotizacion', quote.id_cotizacion);
        return res.status(500).json({ error: `Error insertando ítems: ${itemsErr.message}` });
      }
    }

    // Sincronizar reservas de cupo (holds) en la base de datos
    const syncRes = await syncQuoteReservations(
      quote.id_cotizacion,
      hotelId,
      quote.estado,
      {
        cliente_nombre: quote.cliente_nombre,
        cliente_correo: quote.cliente_correo,
        cliente_telefono: quote.cliente_telefono,
        cliente_identificacion: quote.cliente_identificacion,
        id_huesped: quote.id_huesped,
        id_empresa: quote.id_empresa,
        check_in: quote.check_in,
        check_out: quote.check_out,
        adultos: quote.adultos,
        ninos: quote.ninos,
        moneda: quote.moneda,
        numero_cotizacion: quote.numero_cotizacion,
        notas: quote.notas,
        userId: user.id
      },
      items || []
    );

    if (!syncRes.success) {
      // Rollback
      await db().from('cotizaciones').delete().eq('id_cotizacion', quote.id_cotizacion);
      return res.status(400).json({ error: syncRes.error });
    }

    // Si se creó como Aceptada directamente, emitimos la notificación por sockets
    if (quote.estado === 'Aceptada') {
      const io = getIO();
      if (io && syncRes.bookings && syncRes.bookings.length > 0) {
        io.emit('nueva_solicitud_reserva', {
          reserva: syncRes.bookings[0],
          mensaje: `🆕 Cotización ${quote.numero_cotizacion} creada directamente como ACEPTADA!`
        });
      }

      await crearNotificacion({
        hotelId,
        tipo: 'cotizacion_aceptada',
        titulo: 'Cotización aceptada',
        mensaje: `Cotización ${quote.numero_cotizacion} creada directamente como ACEPTADA`,
        link: '/cotizaciones',
      });
    }

    return res.status(201).json(quote);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/hotel/quotes/:id — Actualizar cotización e items
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { items, ...quoteFields } = req.body;

    // Obtener cotización actual con sus items
    const { data: currentQuote, error: currentErr } = await db()
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .eq('id_cotizacion', id)
      .eq('id_hotel', hotelId)
      .maybeSingle();

    if (currentErr) return res.status(500).json({ error: currentErr.message });
    if (!currentQuote) return res.status(404).json({ error: 'Cotización no encontrada' });

    // Determinar valores finales que resultarán de esta actualización
    const targetCheckIn = quoteFields.check_in || currentQuote.check_in;
    const targetCheckOut = quoteFields.check_out || currentQuote.check_out;
    const targetEstado = quoteFields.estado || currentQuote.estado;
    const targetItems = items !== undefined ? items : (currentQuote.cotizacion_items || []);

    // 1. Validar disponibilidad real (excluyendo los holds de esta misma cotización)
    const roomItems = targetItems.filter((it: any) => it.tipo_item === 'habitacion');
    const isHoldState = ['Borrador', 'Enviada', 'Aceptada'].includes(targetEstado);

    if (isHoldState && roomItems.length > 0) {
      const checkAlloc = await allocateRoomsForQuote(id, hotelId, roomItems, targetCheckIn, targetCheckOut);
      if (!checkAlloc.success) {
        return res.status(400).json({ error: checkAlloc.error });
      }
    }

    // Actualizar cotización
    const { data: quote, error: quoteErr } = await db()
      .from('cotizaciones')
      .update({
        ...quoteFields,
        updated_at: new Date().toISOString()
      })
      .eq('id_cotizacion', id)
      .eq('id_hotel', hotelId)
      .select()
      .single();

    if (quoteErr) return res.status(500).json({ error: quoteErr.message });

    // Actualizar items si vienen
    if (items !== undefined && Array.isArray(items)) {
      // Eliminar items viejos
      const { error: deleteErr } = await db()
        .from('cotizacion_items')
        .delete()
        .eq('id_cotizacion', id);

      if (deleteErr) return res.status(500).json({ error: `Error al actualizar ítems: ${deleteErr.message}` });

      // Insertar nuevos items
      if (items.length > 0) {
        const { error: insertErr } = await db()
          .from('cotizacion_items')
          .insert(
            items.map(item => ({
              id_cotizacion: id,
              tipo_item: item.tipo_item,
              descripcion: item.descripcion,
              id_tipo_habitacion: item.id_tipo_habitacion || null,
              id_servicio: item.id_servicio || null,
              cantidad: item.cantidad || 1,
              precio_unitario: item.precio_unitario || 0,
              subtotal: item.subtotal || 0,
              check_in: item.check_in || null,
              check_out: item.check_out || null,
              noches: item.noches || null,
              adultos: item.adultos || 1,
              ninos: item.ninos || 0,
              detalles_huespedes: item.detalles_huespedes || null
            }))
          );

        if (insertErr) return res.status(500).json({ error: `Error al re-insertar ítems: ${insertErr.message}` });
      }
    }

    // Sincronizar reservas (holds) en la base de datos
    const syncRes = await syncQuoteReservations(
      id,
      hotelId,
      targetEstado,
      {
        cliente_nombre: quoteFields.cliente_nombre || quote.cliente_nombre,
        cliente_correo: quoteFields.cliente_correo || quote.cliente_correo,
        cliente_telefono: quoteFields.cliente_telefono !== undefined ? quoteFields.cliente_telefono : quote.cliente_telefono,
        cliente_identificacion: quoteFields.cliente_identificacion !== undefined ? quoteFields.cliente_identificacion : quote.cliente_identificacion,
        id_huesped: quoteFields.id_huesped || quote.id_huesped,
        id_empresa: quoteFields.id_empresa !== undefined ? quoteFields.id_empresa : quote.id_empresa,
        check_in: targetCheckIn,
        check_out: targetCheckOut,
        adultos: quoteFields.adultos !== undefined ? quoteFields.adultos : quote.adultos,
        ninos: quoteFields.ninos !== undefined ? quoteFields.ninos : quote.ninos,
        moneda: quoteFields.moneda || quote.moneda,
        numero_cotizacion: quote.numero_cotizacion,
        notas: quoteFields.notas !== undefined ? quoteFields.notas : quote.notas,
        userId: user.id
      },
      targetItems
    );

    if (!syncRes.success) {
      return res.status(400).json({ error: syncRes.error });
    }

    // Emitir notificación si se cambió el estado a Aceptada
    if (targetEstado === 'Aceptada') {
      const io = getIO();
      if (io && syncRes.bookings && syncRes.bookings.length > 0) {
        io.emit('nueva_solicitud_reserva', {
          reserva: syncRes.bookings[0],
          mensaje: `🆕 Cotización ${quote.numero_cotizacion} ACEPTADA/CONVERTIDA en reservas confirmadas!`
        });
      }

      await crearNotificacion({
        hotelId,
        tipo: 'cotizacion_aceptada',
        titulo: 'Cotización aceptada',
        mensaje: `Cotización ${quote.numero_cotizacion} fue aceptada y convertida en reserva`,
        link: '/cotizaciones',
      });
    }

    return res.json(quote);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/hotel/quotes/:id — Eliminar cotización
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const { error } = await db()
      .from('cotizaciones')
      .delete()
      .eq('id_cotizacion', id)
      .eq('id_hotel', hotelId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/hotel/quotes/:id/send-email — Enviar cotización por correo
router.post('/:id/send-email', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const { pdfBase64 } = req.body;

    // Obtener cotización
    const { data: quote, error: quoteErr } = await db()
      .from('cotizaciones')
      .select('*, hoteles(nombre_hotel)')
      .eq('id_cotizacion', id)
      .eq('id_hotel', hotelId)
      .maybeSingle();

    if (quoteErr) return res.status(500).json({ error: quoteErr.message });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    // Una cotización ya decidida (Aceptada/Rechazada) no puede reenviarse:
    // sus enlaces de aceptar/rechazar ya fueron resueltos y reenviar el
    // mismo correo solo confundiría al cliente. Si necesita ofrecer otra
    // propuesta, debe generar una nueva cotización.
    if (quote.estado === 'Aceptada' || quote.estado === 'Rechazada') {
      return res.status(409).json({
        error: `Esta cotización ya fue ${quote.estado === 'Aceptada' ? 'aceptada' : 'rechazada'} por el cliente y no puede reenviarse. Si deseas ofrecer una nueva propuesta, crea una nueva cotización.`
      });
    }

    // Enlaces de un solo clic: el correo lleva el PDF adjunto y estos
    // botones aplican la decisión directamente contra el backend
    // (responde con una página de confirmación, sin pasar por el frontend).
    const backendBaseUrl = process.env.BACKEND_PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const acceptUrl = `${backendBaseUrl}/api/public/quotes/${id}/decision?accion=aceptar`;
    const rejectUrl = `${backendBaseUrl}/api/public/quotes/${id}/decision?accion=rechazar`;

    const emailResult = await sendQuoteEmail({
      guestName: quote.cliente_nombre,
      guestEmail: quote.cliente_correo,
      quoteNumber: quote.numero_cotizacion,
      checkIn: quote.check_in,
      checkOut: quote.check_out,
      totalAmount: quote.total,
      currency: quote.moneda,
      hotelName: (quote.hoteles as any)?.nombre_hotel || 'Hotel Solaris',
      acceptUrl,
      rejectUrl,
      pdfBase64,
      id_hotel: quote.id_hotel || hotelId,
    });

    if (!emailResult.success) {
      return res.status(500).json({ error: emailResult.error || 'Error al enviar el correo' });
    }

    // Actualizar estado a "Enviada" si estaba en "Borrador"
    if (quote.estado === 'Borrador') {
      const { error: updErr } = await db()
        .from('cotizaciones')
        .update({ estado: 'Enviada', updated_at: new Date().toISOString() })
        .eq('id_cotizacion', id);
      
      if (!updErr) {
        // Sincronizar reservas para reflejar el estado "Enviada"
        const { data: items } = await db().from('cotizacion_items').select('*').eq('id_cotizacion', id);
        await syncQuoteReservations(
          id,
          hotelId,
          'Enviada',
          {
            cliente_nombre: quote.cliente_nombre,
            cliente_correo: quote.cliente_correo,
            cliente_telefono: quote.cliente_telefono,
            cliente_identificacion: quote.cliente_identificacion,
            id_huesped: quote.id_huesped,
            id_empresa: quote.id_empresa,
            check_in: quote.check_in,
            check_out: quote.check_out,
            adultos: quote.adultos,
            ninos: quote.ninos,
            moneda: quote.moneda,
            numero_cotizacion: quote.numero_cotizacion,
            notas: quote.notas,
            userId: null
          },
          items || []
        );
      }
    }

    return res.json({ success: true, message: 'Correo enviado correctamente' });
  } catch (err: any) {
    console.error('Error in /send-email route:', err);
    return res.status(500).json({ 
      error: err.message || 'Error desconocido en backend', 
      stack: err.stack,
      details: err
    });
  }
});

// POST /api/hotel/quotes/:id/convert-booking — Convertir cotización en reserva real
router.post('/:id/convert-booking', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    // Obtener cotización e items
    const { data: quote, error: quoteErr } = await db()
      .from('cotizaciones')
      .select('*, cotizacion_items(*)')
      .eq('id_cotizacion', id)
      .eq('id_hotel', hotelId)
      .maybeSingle();

    if (quoteErr) return res.status(500).json({ error: quoteErr.message });
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    const syncRes = await syncQuoteReservations(
      id,
      hotelId,
      'Aceptada',
      {
        cliente_nombre: quote.cliente_nombre,
        cliente_correo: quote.cliente_correo,
        cliente_telefono: quote.cliente_telefono,
        cliente_identificacion: quote.cliente_identificacion,
        id_huesped: quote.id_huesped,
        id_empresa: quote.id_empresa,
        check_in: quote.check_in,
        check_out: quote.check_out,
        adultos: quote.adultos,
        ninos: quote.ninos,
        moneda: quote.moneda,
        numero_cotizacion: quote.numero_cotizacion,
        notas: quote.notas,
        userId: user.id
      },
      quote.cotizacion_items || []
    );

    if (!syncRes.success) {
      return res.status(400).json({ error: syncRes.error });
    }

    // Actualizar estado de la cotización a "Aceptada"
    const { error: updErr } = await db()
      .from('cotizaciones')
      .update({ estado: 'Aceptada', updated_at: new Date().toISOString() })
      .eq('id_cotizacion', id);

    if (updErr) return res.status(500).json({ error: updErr.message });

    // Notificar en tiempo real al panel
    const io = getIO();
    if (io && syncRes.bookings && syncRes.bookings.length > 0) {
      io.emit('nueva_solicitud_reserva', {
        reserva: syncRes.bookings[0],
        mensaje: `🆕 Cotización ${quote.numero_cotizacion} convertida en ${syncRes.bookings.length} RESERVAS confirmadas!`
      });
    }

    await crearNotificacion({
      hotelId,
      tipo: 'cotizacion_aceptada',
      titulo: 'Cotización aceptada',
      mensaje: `El cliente aceptó la cotización ${quote.numero_cotizacion} (${syncRes.bookings?.length ?? 0} reserva${(syncRes.bookings?.length ?? 0) === 1 ? '' : 's'})`,
      link: '/cotizaciones',
    });

    return res.status(201).json({ success: true, bookings: syncRes.bookings });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
