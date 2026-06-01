import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { getIO, buildBotSystemPrompt, getSimpleAutoResponse, callGeminiChat } from './hotel/chat.js';
import { verificarCamasExtrasDisponibles, verificarNeveritasDisponibles, verificarPlanchasDisponibles } from './hotel/bookings.js';
import { sendBookingConfirmation, sendHotelNotificationEmail } from '../utils/emailService.js';

const router = Router();
const db = () => supabaseAdmin ?? supabase;

// isMultiTenant no usado — schema actual usa id_hotel, no owner_id
const isMultiTenant = false;

async function getOwnerId(hotelId?: any): Promise<string> {
  if (!isMultiTenant) return '';
  let ownerId: string | null = null;
  if (hotelId && hotelId !== 'all') {
    const { data } = await supabaseAdmin
      .from('hoteles')
      .select('owner_id')
      .eq('id_hotel', hotelId)
      .maybeSingle();
    if (data?.owner_id) ownerId = data.owner_id;
  }
  if (!ownerId) {
    const { data } = await supabaseAdmin
      .from('owners')
      .select('id_owner')
      .limit(1)
      .maybeSingle();
    ownerId = data?.id_owner || '';
  }
  return ownerId;
}

// GET /api/public/hotel/:slug — datos públicos de un hotel por su slug
router.get('/hotel/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // Query 1: hotel básico (sin nested select para evitar problemas de FK en PostgREST)
    const { data: hotel, error: hotelErr } = await db()
      .from('hoteles')
      .select('id_hotel, nombre_hotel, slug, ciudad, direccion, telefono, correo_contacto, estrellas, enlace_google_maps, estado')
      .ilike('slug', slug)          // ilike para búsqueda case-insensitive
      .eq('estado', 'activo')
      .maybeSingle();

    if (hotelErr) {
      console.error('[portal/hotel/:slug] error hoteles:', hotelErr.message);
      return res.status(500).json({ error: hotelErr.message });
    }
    if (!hotel) {
      console.warn('[portal/hotel/:slug] no encontrado:', slug);
      return res.status(404).json({ error: 'Hotel no encontrado.' });
    }

    // Query 2: configuración del hotel (query separada)
    const { data: config } = await db()
      .from('configuracion_hotelera')
      .select('moneda, tipo_cambio_base, porcentaje_impuesto, tasa_turistica, hora_check_in, hora_check_out, cargo_persona_extra')
      .eq('id_hotel', hotel.id_hotel)
      .maybeSingle();

    return res.json({
      id:                 hotel.id_hotel,
      nombre:             hotel.nombre_hotel,
      slug:               hotel.slug,
      ciudad:             hotel.ciudad,
      direccion:          hotel.direccion,
      telefono:           hotel.telefono,
      correo:             hotel.correo_contacto,
      estrellas:          hotel.estrellas ?? 3,
      mapsUrl:            hotel.enlace_google_maps,
      moneda:             config?.moneda             ?? 'HNL',
      tipoCambio:         Number(config?.tipo_cambio_base    ?? 26.58),
      tasaIsv:            Number(config?.porcentaje_impuesto ?? 0.15),
      tasaTuristica:      Number(config?.tasa_turistica      ?? 0.04),
      horaCheckin:        (config?.hora_check_in  as string)?.substring(0, 5) ?? '15:00',
      horaCheckout:       (config?.hora_check_out as string)?.substring(0, 5) ?? '12:00',
      cargoPersonaExtra:  Number(config?.cargo_persona_extra ?? 0),
    });
  } catch (err: any) {
    console.error('[portal/hotel/:slug] catch:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/public/buscar-huesped — busca huésped por correo en un hotel
router.post('/buscar-huesped', async (req: Request, res: Response) => {
  try {
    const { correo, id_hotel } = req.body;
    if (!correo || !id_hotel) return res.status(400).json({ error: 'correo e id_hotel son requeridos' });

    const { data, error } = await db()
      .from('huespedes')
      .select('id_huesped, nombre_completo, correo, telefono, documento_identidad')
      .eq('id_hotel', id_hotel)
      .ilike('correo', correo.trim())
      .maybeSingle();

    if (error) throw error;

    if (!data) return res.json({ encontrado: false });

    return res.json({
      encontrado: true,
      huesped: {
        id:       data.id_huesped,
        nombre:   data.nombre_completo,
        correo:   data.correo,
        telefono: data.telefono,
        dni:      data.documento_identidad,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/public/registrar-huesped — registra nuevo huésped en el hotel
router.post('/registrar-huesped', async (req: Request, res: Response) => {
  try {
    const { nombre_completo, correo, telefono, id_hotel } = req.body;
    if (!nombre_completo || !correo || !id_hotel)
      return res.status(400).json({ error: 'nombre_completo, correo e id_hotel son requeridos' });

    // Verificar si ya existe (correo único por hotel)
    const { data: existing } = await db()
      .from('huespedes')
      .select('id_huesped, nombre_completo, correo, telefono')
      .eq('id_hotel', id_hotel)
      .ilike('correo', correo.trim())
      .maybeSingle();

    if (existing) {
      return res.json({
        registrado: false,
        encontrado: true,
        huesped: { id: existing.id_huesped, nombre: existing.nombre_completo, correo: existing.correo, telefono: existing.telefono },
      });
    }

    const { data, error } = await db()
      .from('huespedes')
      .insert({ id_hotel, nombre_completo: nombre_completo.trim(), correo: correo.trim().toLowerCase(), telefono: telefono?.trim() || null })
      .select('id_huesped, nombre_completo, correo, telefono')
      .single();

    if (error) throw error;

    return res.status(201).json({
      registrado: true,
      huesped: { id: data.id_huesped, nombre: data.nombre_completo, correo: data.correo, telefono: data.telefono },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/public/validar-nuevo-huesped
router.post('/validar-nuevo-huesped', async (req: Request, res: Response) => {
  try {
    const { dni, nombre, correo, telefono } = req.body;
    if (!dni || !nombre || !correo || !telefono) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios para el registro.' });
    }

    const clean = (s: string) => s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "");
    const cleanDni = clean(dni);
    const cleanNombre = clean(nombre);
    const cleanCorreo = correo.trim().toLowerCase();
    const cleanTelefono = telefono.trim();

    // 1. Validar formato de teléfono (debe tener código de área, ej. +50499998888 o +504 99998888)
    const phoneRegex = /^\+([1-9]\d{1,3})\s?\d{4,12}$/;
    const cleanPhoneForReg = cleanTelefono.replace(/\-/g, '');
    if (!phoneRegex.test(cleanPhoneForReg)) {
      return res.status(400).json({ error: 'El teléfono debe incluir un código de área internacional válido (ej. +504 99998888).' });
    }

    // 2. Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanCorreo)) {
      return res.status(400).json({ error: 'El correo electrónico no tiene un formato válido.' });
    }

    // 3. Validar formato de DNI (mínimo 5 caracteres)
    if (cleanDni.length < 5) {
      return res.status(400).json({ error: 'El DNI o documento debe tener al menos 5 caracteres.' });
    }

    // 4. Validar formato de Nombre (mínimo 3 letras, solo letras y espacios)
    const nameRegex = /^[A-ZÁÉÍÓÚÑ\s]{3,}$/;
    if (!nameRegex.test(cleanNombre)) {
      return res.status(400).json({ error: 'El nombre debe tener al menos 3 caracteres y contener solo letras.' });
    }

    // 5. Verificar si el DNI ya está registrado
    const { data: dniExist, error: dniErr } = await db()
      .from('huespedes')
      .select('id_huesped')
      .eq('documento_identidad', cleanDni)
      .maybeSingle();

    if (dniErr) throw dniErr;
    if (dniExist) {
      return res.status(400).json({ error: 'Este DNI o documento ya está registrado. Si ya eres cliente, por favor selecciona "Ya soy cliente".' });
    }

    // 6. Verificar si el correo ya está registrado
    const { data: emailExist, error: emailErr } = await db()
      .from('huespedes')
      .select('id_huesped')
      .eq('correo', cleanCorreo)
      .maybeSingle();

    if (emailErr) throw emailErr;
    if (emailExist) {
      return res.status(400).json({ error: 'Este correo electrónico ya está registrado por otro huésped.' });
    }

    return res.json({ valido: true });
  } catch (error: any) {
    console.error('Error al validar nuevo huésped:', error);
    return res.status(500).json({ error: error.message || 'Error interno al validar datos.' });
  }
});

// POST /api/public/verificar-huesped-dni
router.post('/verificar-huesped-dni', async (req: Request, res: Response) => {
  try {
    const { dni, nombre } = req.body;
    if (!dni || !nombre) {
      return res.status(400).json({ error: 'DNI/Documento y Nombre completo son obligatorios.' });
    }

    const clean = (s: string) => s.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "");
    const cleanDni = clean(dni);
    const cleanNombre = clean(nombre);

    // Buscar huésped por DNI
    const { data: huesped, error } = await db()
      .from('huespedes')
      .select('*')
      .eq('documento_identidad', cleanDni)
      .maybeSingle();

    if (error) throw error;

    if (!huesped) {
      // No existe, es un nuevo registro
      return res.json({ existe: false });
    }

    // Existe, validar similitud de nombre de forma ultra-segura
    const storedNombreClean = clean(huesped.nombre_completo);

    // Separar en palabras completas (ignorando conectores cortos de 1 o 2 letras)
    const wordsStored = storedNombreClean.split(/\s+/).filter(w => w.length > 2);
    const wordsInput = cleanNombre.split(/\s+/).filter(w => w.length > 2);

    // Coincidencia exacta
    let similar = storedNombreClean === cleanNombre;

    if (!similar && wordsInput.length > 0) {
      const intersection = wordsStored.filter(w => wordsInput.includes(w));
      if (wordsInput.length === 1) {
        // Si ingresó solo 1 palabra, debe ser exactamente igual a una de las palabras del nombre almacenado
        similar = intersection.length === 1;
      } else {
        // Si ingresó 2 o más palabras, al menos 2 deben coincidir exactamente con el nombre almacenado
        similar = intersection.length >= 2;
      }
    }

    if (similar) {
      return res.json({
        existe: true,
        valido: true,
        huesped: {
          id_huesped: huesped.id_huesped,
          nombre_completo: huesped.nombre_completo,
          correo: huesped.correo,
          telefono: huesped.telefono,
          documento_identidad: huesped.documento_identidad
        }
      });
    } else {
      return res.status(400).json({
        existe: true,
        valido: false,
        error: 'El documento de identidad ya está registrado con otro nombre.'
      });
    }
  } catch (error: any) {
    console.error('Error en /verificar-huesped-dni:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// POST /api/public/solicitud-reserva
router.post('/solicitud-reserva', async (req: Request, res: Response) => {
  try {
    const {
      nombre,
      correo,
      telefono,
      dni,
      habitacionId,
      checkIn,
      checkOut,
      adultos,
      ninos,
      observaciones,
      camaExtra,
      cama_extra,
      limpiezaDiaria,
      limpieza_diaria,
      neverita,
      plancha,
    } = req.body;

    const finalCamaExtra = !!(camaExtra || cama_extra);
    const finalLimpiezaDiaria = !!(limpiezaDiaria || limpieza_diaria);
    const finalNeverita = !!neverita;
    const finalPlancha = !!plancha;

    if (!nombre || !habitacionId || !checkIn || !checkOut) {
      return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    // 1. Obtener habitación primero (necesitamos id_hotel para crear huésped)
    const { data: habitacion, error: habErr } = await db()
      .from('habitaciones_con_detalles')
      .select('id_hotel, tarifa_noche, nombre_habitacion, nombre_alias')
      .eq('id_habitacion', habitacionId)
      .maybeSingle();

    if (habErr) {
      console.error('Error buscando habitación:', habErr);
      return res.status(400).json({ error: 'Error al verificar la habitación.' });
    }
    if (!habitacion) {
      return res.status(400).json({ error: 'Habitación no encontrada o no disponible.' });
    }

    // Verificar disponibilidad de camas extras si se solicita una
    if (finalCamaExtra) {
      const checkExtra = await verificarCamasExtrasDisponibles(checkIn, checkOut);
      if (!checkExtra.disponible) {
        const fechas = (checkExtra.fechasConSobrecupo || []).join(', ');
        return res.status(400).json({
          error: `No hay camas extras unipersonales disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 3.`
        });
      }
    }

    // Verificar disponibilidad de neveritas si se solicita una
    if (finalNeverita) {
      const checkNevera = await verificarNeveritasDisponibles(checkIn, checkOut);
      if (!checkNevera.disponible) {
        const fechas = (checkNevera.fechasConSobrecupo || []).join(', ');
        return res.status(400).json({
          error: `No hay neveritas/minibares disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 1.`
        });
      }
    }

    // Verificar disponibilidad de planchas si se solicita una
    if (finalPlancha) {
      const checkPlancha = await verificarPlanchasDisponibles(checkIn, checkOut);
      if (!checkPlancha.disponible) {
        const fechas = (checkPlancha.fechasConSobrecupo || []).join(', ');
        return res.status(400).json({
          error: `No hay planchas de ropa disponibles para las siguientes fechas: [${fechas}]. Capacidad máxima del hotel: 8.`
        });
      }
    }

    // 2. Obtener o crear huésped
    const dniUpper = dni ? dni.trim().toUpperCase() : null;
    const nombreUpper = nombre.trim().toUpperCase();
    const correoFinal = correo?.trim() ? correo.trim().toLowerCase() : `WEB-${Date.now()}@PARTNERCENTRAL.LOCAL`;
    const telefonoFinal = telefono?.trim() || null;

    let huespedId: string;
    let huespedExistente: any = null;

    if (dniUpper) {
      const { data } = await db().from('huespedes')
        .select('id_huesped, nombre_completo, correo, telefono')
        .eq('documento_identidad', dniUpper).maybeSingle();
      huespedExistente = data;
    }
    if (!huespedExistente && correoFinal && !correoFinal.startsWith('WEB-')) {
      const { data } = await db().from('huespedes')
        .select('id_huesped, nombre_completo, correo, telefono')
        .eq('correo', correoFinal).maybeSingle();
      huespedExistente = data;
    }

    if (huespedExistente) {
      huespedId = huespedExistente.id_huesped;
      await db().from('huespedes').update({
        nombre_completo: nombreUpper,
        telefono: telefonoFinal || huespedExistente.telefono,
        documento_identidad: dniUpper || huespedExistente.documento_identidad || null,
        correo: correoFinal || huespedExistente.correo
      }).eq('id_huesped', huespedId);
    } else {
      const { data: nuevoHuesped, error: errHuesped } = await db()
        .from('huespedes')
        .insert({
          id_hotel: habitacion.id_hotel,
          nombre_completo: nombreUpper,
          documento_identidad: dniUpper || null,
          correo: correoFinal,
          telefono: telefonoFinal,
        })
        .select('id_huesped').single();
      if (errHuesped) throw errHuesped;
      huespedId = nuevoHuesped.id_huesped;
    }

    // Calcular noches
    const ci = new Date(checkIn);
    const co = new Date(checkOut);
    const msPerDay = 1000 * 60 * 60 * 24;
    const noches = Math.max(1, Math.round((co.getTime() - ci.getTime()) / msPerDay));
    const totalEstimado = (habitacion.tarifa_noche || 0) * noches;

    // 3. Crear reserva
    const { data: nuevaReserva, error: reservaErr } = await db()
      .from('reservas_hotel')
      .insert({
        id_huesped: huespedId,
        id_habitacion: habitacionId,
        id_hotel: habitacion.id_hotel,
        check_in: checkIn,
        check_out: checkOut,
        adultos,
        ninos,
        estado: 'pendiente',
        total_reserva: totalEstimado,
        moneda: 'HNL',
        observaciones: observaciones ? `[WEB] ${observaciones}` : '[WEB] Solicitud desde el Portal B2C',
        estado_pago: 'deuda', // pendiente de pago — reserva web
        anticipo: 0,
        es_cortesia: false,
      })
      .select()
      .single();

    if (reservaErr) throw reservaErr;

    // Registrar servicios adicionales contratados en la tabla intermedia
    if (nuevaReserva && nuevaReserva.id_reserva_hotel) {
      const servicesToInsert = [];
      if (finalCamaExtra) servicesToInsert.push({ name: 'Cama Extra' });
      if (finalNeverita) servicesToInsert.push({ name: 'Neverita' });
      if (finalPlancha) servicesToInsert.push({ name: 'Plancha' });
      if (finalLimpiezaDiaria) servicesToInsert.push({ name: 'Limpieza Diaria' });

      if (servicesToInsert.length > 0) {
        const { data: dbServices } = await db()
          .from('servicios_adicionales')
          .select('id_servicio, nombre, precio_defecto')
          .in('nombre', servicesToInsert.map(s => s.name));

        if (dbServices && dbServices.length > 0) {
          await db().from('reserva_servicios').insert(
            dbServices.map(s => ({
              id_reserva_hotel: nuevaReserva.id_reserva_hotel,
              id_servicio: s.id_servicio,
              cantidad: 1,
              precio_unitario: s.precio_defecto
            }))
          );
        }
      }
    }

    // 4. Emitir evento Socket para notificar a recepción
    const io = getIO();
    if (io) {
      const habNombre = habitacion.nombre_alias || habitacion.nombre_habitacion;
      io.emit('nueva_solicitud_reserva', {
        reserva: nuevaReserva,
        mensaje: `Nueva solicitud web: ${nombre} (${habNombre})`
      });
    }

    // 5. Enviar correo de confirmación de forma asíncrona
    if (nuevaReserva?.id_reserva_hotel) {
      (async () => {
        try {
          const { data: hotel } = await db()
            .from('hoteles')
            .select('nombre_hotel, correo_contacto')
            .eq('id_hotel', habitacion.id_hotel)
            .single();

          if (hotel && hotel.nombre_hotel) {
            const emailData = {
              guestName: nombre,
              guestEmail: correoFinal,
              bookingId: nuevaReserva.id_reserva_hotel,
              checkIn: checkIn,
              checkOut: checkOut,
              totalAmount: totalEstimado,
              currency: 'HNL',
              hotelName: hotel.nombre_hotel,
              roomType: (habitacion as any).tipo || 'Habitación Estándar',
              adults: adultos,
              children: ninos,
              services: [
                finalCamaExtra && 'Cama Extra',
                finalNeverita && 'Neverita/Minibar',
                finalPlancha && 'Plancha de ropa',
                finalLimpiezaDiaria && 'Limpieza Diaria'
              ].filter(Boolean) as string[]
            };

            // 1. Enviar correo al huésped
            if (correoFinal) {
              await sendBookingConfirmation(emailData);
            }

            // 2. Enviar correo de notificación al hotel
            if (hotel.correo_contacto) {
              await sendHotelNotificationEmail(emailData, hotel.correo_contacto);
            }
          }
        } catch (err) {
          console.error('Error enviando correo post-reserva (public):', err);
        }
      })();
    }

    return res.status(201).json({ success: true, reserva: nuevaReserva });
  } catch (error: any) {
    console.error('Error en /solicitud-reserva:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// POST /api/public/chat/init
router.post('/chat/init', async (req: Request, res: Response) => {
  try {
    const { nombre, correo, telefono, hotel_id } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'Nombre es requerido' });
    }

    // Resolver id_hotel — requerido por el schema
    let chatHotelId: string = hotel_id || (req.headers['x-hotel-id'] as string) || '';
    if (!chatHotelId) {
      const { data: firstHotel } = await supabaseAdmin
        .from('hoteles').select('id_hotel').eq('estado', 'activo').limit(1).maybeSingle();
      chatHotelId = firstHotel?.id_hotel || '';
    }
    if (!chatHotelId) return res.status(400).json({ error: 'hotel_id requerido' });

    const identifier = correo?.trim() || telefono?.trim() || `anon-${Date.now()}`;
    const channelName = `Cliente: ${nombre.split(' ')[0]}`;

    // Buscar o registrar al huésped para asignarlo al canal
    let huespedId: string | null = null;
    if (correo?.trim()) {
      const { data: existingHuesped } = await supabaseAdmin
        .from('huespedes')
        .select('id_huesped')
        .eq('correo', correo.trim().toLowerCase())
        .maybeSingle();
      if (existingHuesped) {
        huespedId = existingHuesped.id_huesped;
      }
    }

    if (!huespedId) {
      const { data: nuevoHuesped } = await supabaseAdmin
        .from('huespedes')
        .insert({
          id_hotel: chatHotelId,
          nombre_completo: nombre.trim().toUpperCase(),
          correo: correo?.trim() ? correo.trim().toLowerCase() : `CHAT-ANON-${Date.now()}@PARTNERCENTRAL.LOCAL`,
          telefono: telefono?.trim() || null
        })
        .select('id_huesped')
        .single();
      if (nuevoHuesped) {
        huespedId = nuevoHuesped.id_huesped;
      }
    }

    // Buscar si ya existe un canal para este identificador
    const { data: existingChannels } = await supabaseAdmin
      .from('chat_channels')
      .select('*')
      .eq('channel_type', 'cliente')
      .ilike('name', `%${nombre.split(' ')[0]}%`)
      .order('created_at', { ascending: false });

    // Filtrar por metadata (si usamos JSONB, esto es más robusto en memoria para este caso simple)
    let channel = existingChannels?.find((c: any) =>
      c.metadata?.email === correo || c.metadata?.phone === telefono || c.metadata?.identifier === identifier
    );

    let messages: any[] = [];
    if (channel) {
      const { data: existingMessages } = await supabaseAdmin
        .from('chat_messages')
        .select('id, channel_id, sender_id, sender_name, sender_avatar, content, message_type, created_at')
        .eq('channel_id', channel.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(50);
      messages = (existingMessages || []).reverse();
    } else {
      // Resolver owner_id para insert multi-tenant
      const owner_id = await getOwnerId();

      // Crear nuevo canal
      const insertData: Record<string, any> = {
        id_hotel: chatHotelId,
        name: channelName,
        channel_type: 'cliente',
        created_by: huespedId || 'portal-web',
        id_huesped: huespedId,
        metadata: {
          email: correo,
          phone: telefono,
          identifier,
          source: 'Portal B2C'
        }
      };

      const { data: newChannel, error: insertErr } = await supabaseAdmin
        .from('chat_channels')
        .insert(insertData)
        .select()
        .single();

      if (insertErr) throw insertErr;
      channel = newChannel;

      // Notificar al personal sobre un nuevo chat de cliente
      const io = getIO();
      if (io) {
        io.emit('new_channel', channel);
        io.emit('new_client_chat', { channel, mensaje: `Nuevo chat de cliente: ${nombre}` });
      }
    }

    return res.json({
      success: true,
      channelId: channel.id,
      guestId: channel.metadata?.identifier || identifier,
      messages
    });
  } catch (error: any) {
    console.error('Error en /chat/init:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// GET /api/public/chat/messages/:channelId
router.get('/chat/messages/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { after } = req.query; // message_id para paginar (opcional en UI actual, pero lo dejamos listo)

    // Obtener los últimos 50 mensajes de este canal
    let query = supabaseAdmin
      .from('chat_messages')
      .select('id, channel_id, sender_id, sender_name, sender_avatar, content, message_type, created_at')
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (after) {
      // Como el portal envía el timestamp de creación en 'after', filtramos por created_at > after
      query = query.gt('created_at', after);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Retornamos en orden cronológico ascendente (el más viejo arriba)
    return res.json((data || []).reverse());
  } catch (error: any) {
    console.error('Error en /chat/messages:', error);
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
});

// POST /api/public/chat/send
router.post('/chat/send', async (req: Request, res: Response) => {
  try {
    const { channelId, guestId, nombre, content } = req.body;

    if (!channelId || !content) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // Resolver owner_id del canal (requerido NOT NULL en chat_messages)
    let msgOwnerId: string | null = null;
    if (isMultiTenant) {
      const { data: chanData } = await supabaseAdmin
        .from('chat_channels')
        .select('owner_id')
        .eq('id', channelId)
        .maybeSingle();
      msgOwnerId = chanData?.owner_id || await getOwnerId();
    }

    // Insertar el mensaje
    const { data: messageData, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...(isMultiTenant && msgOwnerId ? { owner_id: msgOwnerId } : {}),
        channel_id: channelId,
        sender_id: guestId || 'guest',
        sender_name: nombre || 'Huésped Web',
        content: content,
        message_type: 'text'
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Emitir socket event para notificar en tiempo real al panel operativo
    const io = getIO();
    if (io) {
      io.to(`channel:${channelId}`).emit('new_message', messageData);
      io.emit('unread_update', { channelId });
    }

    // Reactivar bot si el usuario lo solicita explícitamente
    const lowerContent = content.trim().toLowerCase();
    if (lowerContent === 'bot' || lowerContent === 'volver al bot' || lowerContent === 'reiniciar') {
      const { data: channelForBot } = await supabaseAdmin
        .from('chat_channels')
        .select('metadata')
        .eq('id', channelId)
        .maybeSingle();

      if (channelForBot && channelForBot.metadata?.bot_disabled) {
        await supabaseAdmin
          .from('chat_channels')
          .update({
            metadata: {
              ...channelForBot.metadata,
              bot_disabled: false
            }
          })
          .eq('id', channelId);
      }
    }

    // Disparar procesamiento del chatbot en segundo plano
    void handleBotResponse(channelId, content);

    return res.status(201).json({ success: true, message: messageData });
  } catch (error: any) {
    console.error('Error en /chat/send:', error);
    return res.status(500).json({ error: error.message || 'Error interno' });
  }
});

// Función en segundo plano para procesar y responder con el chatbot
async function handleBotResponse(channelId: string, content: string) {
  try {
    // 1. Obtener la metadata del canal y el huésped para verificar si el bot está activo o desactivado
    const { data: channel } = await supabaseAdmin
      .from('chat_channels')
      .select('metadata, id_huesped, channel_type')
      .eq('id', channelId)
      .maybeSingle();

    // Solo auto-responder en canales de tipo cliente
    if (channel?.channel_type !== 'cliente') return;

    const metadata = channel.metadata || {};
    if (metadata.bot_disabled === true) return;

    const io = getIO();
    const lower = content.toLowerCase();

    // 2. Verificar si solicita un agente humano (handover)
    const isAgentRequested = lower.includes('agente') || lower.includes('recepcion') || lower.includes('recepción') || lower.includes('humano') || lower.includes('persona');

    if (isAgentRequested) {
      // Actualizar metadata del canal para desactivar el bot
      const newMetadata = { ...metadata, bot_disabled: true };
      await supabaseAdmin
        .from('chat_channels')
        .update({ metadata: newMetadata })
        .eq('id', channelId);

      // Alertar al personal en tiempo real
      if (io) {
        io.emit('new_client_chat', {
          channel: { id: channelId, ...channel, metadata: newMetadata },
          mensaje: `🔔 Un cliente solicita hablar con un agente en recepción`
        });
      }

      // Enviar mensaje de confirmación del bot
      const botResponse = "Entendido. He notificado a recepción y te he conectado con un agente humano. En un momento te asistiremos. 📞";

      // Resolver owner_id para el mensaje del bot
      let botOwnerId: string | null = null;
      if (isMultiTenant) {
        const { data: chanInfo } = await supabaseAdmin.from('chat_channels').select('owner_id').eq('id', channelId).maybeSingle();
        botOwnerId = chanInfo?.owner_id || await getOwnerId();
      }

      const { data: botMsg } = await supabaseAdmin
        .from('chat_messages')
        .insert({
          ...(isMultiTenant && botOwnerId ? { owner_id: botOwnerId } : {}),
          channel_id: channelId,
          sender_id: 'bot:concierge',
          sender_name: 'Concierge Bot',
          content: botResponse,
          message_type: 'text'
        })
        .select()
        .single();

      if (botMsg && io) {
        io.to(`channel:${channelId}`).emit('new_message', botMsg);
      }
      return;
    }

    // 3. Obtener contexto del hotel (usando hotelId guardado en la metadata del canal o por defecto '1')
    const hotelId = metadata.hotelId || '1';
    const { data: hotelData } = await supabaseAdmin
      .from('hoteles')
      .select('*')
      .eq('id_hotel', hotelId)
      .single();

    // Obtener todos los hoteles de la base de datos para contexto de cadena/multi-sede
    const { data: todosHoteles } = await supabaseAdmin
      .from('hoteles')
      .select('id_hotel, nombre_hotel, ciudad');

    // Obtener reservas del huésped si existe
    let userReservations = null;
    let userInfo = null;
    let dbGuestId = channel.id_huesped;

    // Fallback: si el canal es antiguo y no tiene id_huesped pero sí metadata
    if (!dbGuestId && (channel.metadata?.email || channel.metadata?.phone)) {
      let query = supabaseAdmin.from('huespedes').select('id_huesped').limit(1);
      if (channel.metadata?.email) query = query.eq('correo', channel.metadata.email);
      else if (channel.metadata?.phone) query = query.eq('telefono', channel.metadata.phone);

      const { data: g } = await query.single();
      if (g) dbGuestId = g.id_huesped;
    }

    if (dbGuestId) {
      const { data: guestData } = await supabaseAdmin
        .from('huespedes')
        .select('id_huesped, nombre_completo, correo, telefono')
        .eq('id_huesped', dbGuestId)
        .single();
      userInfo = guestData;

      const { data: reservas } = await supabaseAdmin
        .from('reservas_hotel')
        .select('*, habitaciones(nombre_habitacion)')
        .eq('id_huesped', dbGuestId)
        .in('estado', ['confirmada', 'check_in', 'pendiente']);
      userReservations = reservas || [];
    }

    // Construir contexto del hotel
    const hotelContext = hotelData
      ? {
        nombre: hotelData.nombre_hotel,
        ciudad: hotelData.ciudad,
        telefono: hotelData.telefono,
        email: hotelData.correo_contacto,
      }
      : null;

    // Obtener catálogo de habitaciones para contexto seguro del bot público
    const { data: habitaciones } = await supabaseAdmin
      .from('habitaciones_con_detalles')
      .select('*');

    // Obtener reservas activas para que el bot pueda calcular disponibilidad matemática
    const { data: reservas } = await supabaseAdmin
      .from('reservas_hotel')
      .select('id_habitacion, check_in, check_out, estado')
      .in('estado', ['pendiente', 'confirmada', 'check_in']);

    // Obtener historial de mensajes para contexto
    const { data: history } = await supabaseAdmin
      .from('chat_messages')
      .select('sender_id, content')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(10);

    const formattedHistory = (history || []).reverse().map(msg => ({
      role: msg.sender_id.startsWith('bot') ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Construir system prompt con contexto y lista de todos los hoteles
    const systemPrompt = buildBotSystemPrompt(hotelContext, userReservations, todosHoteles || [], habitaciones || [], reservas || [], userInfo);
    let botResponse = await callGeminiChat(formattedHistory, systemPrompt);

    if (!botResponse) {
      // Fallback a respuesta automática basada en palabras clave
      botResponse = getSimpleAutoResponse(content, hotelContext, todosHoteles || []);
    }

    // Guardar respuesta del bot en la BD
    // Resolver owner_id del canal para el insert
    let finalBotOwnerId: string | null = null;
    if (isMultiTenant) {
      const { data: chanOwner } = await supabaseAdmin.from('chat_channels').select('owner_id').eq('id', channelId).maybeSingle();
      finalBotOwnerId = chanOwner?.owner_id || await getOwnerId();
    }

    const { data: botMsg, error: botError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...(isMultiTenant && finalBotOwnerId ? { owner_id: finalBotOwnerId } : {}),
        channel_id: channelId,
        sender_id: 'bot:concierge',
        sender_name: 'Concierge Bot',
        content: botResponse || 'Por favor, contacta a recepción para más información.',
        message_type: 'text',
      })
      .select()
      .single();

    if (botError) throw botError;

    // Emitir WebSocket
    if (io && botMsg) {
      io.to(`channel:${channelId}`).emit('new_message', botMsg);
    }
  } catch (error) {
    console.error('Error procesando respuesta del bot:', error);
  }
}

// GET /api/public/config
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('configuracion_hotelera')
      .select('porcentaje_impuesto, tipo_cambio_base, moneda, nombre_red_hoteles')
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return res.json({
      success: true,
      tipoCambio: data ? Number(data.tipo_cambio_base) : 26.5768,
      taxPercent: data ? Number(data.porcentaje_impuesto) : 0.15,
      monedaBase: data ? data.moneda : 'HNL',
      nombreRedHoteles: data ? (data.nombre_red_hoteles || 'Hotel Verona') : 'Hotel Verona'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/public/hoteles
router.get('/hoteles', async (req: Request, res: Response) => {
  try {
    let query = db()
      .from('hoteles')
      .select('id_hotel, nombre_hotel, direccion, telefono, correo_contacto, ciudad, estado, owner_id')
      .eq('estado', 'activo');

    const hotelId = req.query.hotel_id as string | undefined;
    const ownerId = req.query.owner_id as string | undefined;

    if (hotelId) {
      query = query.eq('id_hotel', hotelId);
    } else if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Mapear al modelo HotelPublic del frontend
    const mapped = (data || []).map((h: any) => ({
      id: h.id_hotel,
      nombre: h.nombre_hotel,
      direccion: h.direccion,
      telefono: h.telefono,
      correo: h.correo_contacto,
      descripcion: h.ciudad ? `Ubicado en la hermosa ciudad de ${h.ciudad}` : null
    }));

    return res.json(mapped);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/public/disponibilidad
router.get('/disponibilidad', async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut, hotel_id } = req.query;

    let roomQuery = db()
      .from('habitaciones_con_detalles')
      .select('id_habitacion, id_hotel, nombre_habitacion, nombre_alias, tipo, tarifa_noche, numero_camas, capacidad, imagenes, imagen_360, comodidades')
      .eq('estado', 'disponible');

    if (hotel_id) roomQuery = roomQuery.eq('id_hotel', hotel_id as string);

    // Obtener todas las habitaciones marcadas como disponibles desde la vista 3NF
    const { data: rooms, error: roomsError } = await roomQuery;

    if (roomsError) throw roomsError;

    let availableRooms = rooms || [];

    // Si se especificaron checkIn y checkOut, filtrar por disponibilidad real
    if (checkIn && checkOut) {
      const checkInStr = (checkIn as string).split('T')[0];
      const checkOutStr = (checkOut as string).split('T')[0];

      // Obtener todas las reservas que NO estén canceladas ni no_show
      const { data: bookings, error: bookingsError } = await db()
        .from('reservas_hotel')
        .select('id_habitacion, check_in, check_out, estado')
        .not('estado', 'in', '("cancelada","no_show")');

      if (bookingsError) throw bookingsError;

      const bookedRoomIds = new Set<string>();
      for (const b of bookings || []) {
        if (b.id_habitacion && b.check_in && b.check_out) {
          const bIn = b.check_in.split('T')[0];
          const bOut = b.check_out.split('T')[0];
          // Hay cruce de fechas si: entrada_reserva < salida_busqueda Y salida_reserva > entrada_busqueda
          if (bIn < checkOutStr && bOut > checkInStr) {
            bookedRoomIds.add(b.id_habitacion);
          }
        }
      }

      // Filtrar habitaciones que no tengan cruces de reservas
      availableRooms = availableRooms.filter((r: any) => !bookedRoomIds.has(r.id_habitacion));
    }

    // Renombrar campos para el frontend
    // Obtener cargo_persona_extra de cada hotel (una sola query para todos los hoteles únicos)
    const hotelIds = [...new Set(availableRooms.map((h: any) => h.id_hotel).filter(Boolean))];
    const cargoMap: Record<string, number> = {};
    if (hotelIds.length > 0) {
      const { data: configs } = await db()
        .from('configuracion_hotelera')
        .select('id_hotel, cargo_persona_extra')
        .in('id_hotel', hotelIds);
      (configs || []).forEach((c: any) => {
        cargoMap[c.id_hotel] = Number(c.cargo_persona_extra ?? 0);
      });
    }

    const formatted = availableRooms.map((h: any) => ({
      id:              h.id_habitacion,
      id_hotel:        h.id_hotel,
      nombre:          h.nombre_habitacion,
      nombreAlias:     h.nombre_alias,
      tipo:            h.tipo,
      tarifaNoche:     h.tarifa_noche,
      numeroCamas:     h.numero_camas,
      capacidad:       h.capacidad,
      cargoPersonaExtra: cargoMap[h.id_hotel] ?? 0,
      imagenes:        h.imagenes || [],
      imagen_360:      h.imagen_360,
      comodidades:     h.comodidades || [],
      disponible:      true,
    }));

    return res.json(formatted);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/public/comodidades-disponibilidad
router.get('/comodidades-disponibilidad', async (req: Request, res: Response) => {
  try {
    const { checkIn, checkOut } = req.query;
    if (!checkIn || !checkOut) {
      return res.json({ cama_extra: true, neverita: true, plancha: true });
    }

    // Usar la fecha local eliminando desfase
    const startStr = (checkIn as string).split('T')[0];
    const endStr = (checkOut as string).split('T')[0];

    // Obtener todas las reservas activas (no canceladas ni no_show) con sus servicios adicionales
    const { data: bookings, error } = await db()
      .from('reservas_hotel')
      .select(`
        check_in, 
        check_out, 
        reserva_servicios (
          servicios_adicionales ( nombre )
        )
      `)
      .not('estado', 'in', '("cancelada","no_show")');

    if (error) throw error;

    let maxCamas = 0;
    let maxNeveras = 0;
    let maxPlanchas = 0;

    for (let d = new Date(startStr + 'T12:00:00Z'); d < new Date(endStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let dayCamas = 0;
      let dayNeveras = 0;
      let dayPlanchas = 0;

      for (const b of bookings || []) {
        // Normalizar fechas de la reserva a string 'YYYY-MM-DD'
        const bIn = String(b.check_in).split('T')[0].split(' ')[0];
        const bOut = String(b.check_out).split('T')[0].split(' ')[0];
        if (dateStr >= bIn && dateStr < bOut) {
          const hasService = (name: string) => {
            const services = b.reserva_servicios as any;
            if (!services || !Array.isArray(services)) return false;
            return services.some((rs: any) => rs.servicios_adicionales?.nombre === name);
          };
          if (hasService('Cama Extra')) dayCamas++;
          if (hasService('Neverita')) dayNeveras++;
          if (hasService('Plancha')) dayPlanchas++;
        }
      }

      if (dayCamas > maxCamas) maxCamas = dayCamas;
      if (dayNeveras > maxNeveras) maxNeveras = dayNeveras;
      if (dayPlanchas > maxPlanchas) maxPlanchas = dayPlanchas;
    }

    return res.json({
      cama_extra: maxCamas < 3,
      neverita: maxNeveras < 1,
      plancha: maxPlanchas < 8
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/public/local-guide
router.get('/local-guide', async (req: Request, res: Response) => {
  try {
    // Placeholder para la guía local
    return res.json([]);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
