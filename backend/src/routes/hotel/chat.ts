import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { supabaseAdmin } from '../../config/supabase';
import { extractToken, getInfoFromToken } from '../../utils/auditHelper.js';

const router = Router();
let io: SocketIOServer;

const isMultiTenant = process.env.SUPABASE_URL?.includes('yefaoqzyjfqpwrnzgofb') || false;

export function setIO(socketServer: SocketIOServer) {
  io = socketServer;
}

export function getIO() {
  return io;
}

async function getOwnerId(hotelId?: any): Promise<string> {
  if (!isMultiTenant) return '';
  let ownerId: string | null = null;
  if (hotelId && hotelId !== 'all') {
    const { data } = await supabaseAdmin
      .from('hoteles')
      .select('owner_id')
      .eq('id_hotel', hotelId)
      .maybeSingle();
    if (data?.owner_id) {
      ownerId = data.owner_id;
    }
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

// ════ REST ENDPOINTS ════════════════════════════════════════════

// GET /api/chat/channels - Listar canales del usuario
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    const { email } = getInfoFromToken(token);
    const userId = email ?? 'anon';

    const hotelId = req.headers['x-hotel-id'];

    // Canales operativos + privados donde participa el usuario
    let query = supabaseAdmin
      .from('chat_channels')
      .select('id, name, channel_type, created_by, metadata, id_huesped')
      .in('channel_type', ['general', 'hotel', 'operativo', 'cierre', 'cliente']);

    if (hotelId && hotelId !== 'all') {
      if (isMultiTenant) {
        query = query.or(`metadata->>hotel_id.eq.${hotelId},metadata->>hotel_id.is.null`);
      } else {
        query = query.or(`id_hotel.eq.${hotelId},id_hotel.is.null`);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    // Agregar conteo de sin leer para cada canal
    const channelsWithUnread = await Promise.all(
      (data || []).map(async (channel: any) => {
        const { data: unreadData } = await supabaseAdmin
          .from('chat_read_status')
          .select('unread_count')
          .eq('user_id', userId)
          .eq('channel_id', channel.id)
          .maybeSingle();

        return {
          ...channel,
          guest_id: channel.id_huesped ?? null, // alias for frontend compatibility
          guest_email: channel.metadata?.email ?? null,
          guest_name: channel.metadata?.guest_name ?? null,
          unread_count: unreadData?.unread_count || 0,
        };
      })
    );

    return res.json(channelsWithUnread);
  } catch (error: any) {
    console.error('Error en chat/channels:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/chat/channels/:id/messages - Obtener mensajes
router.get('/channels/:channelId/messages', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        id,
        channel_id,
        sender_id,
        sender_name,
        sender_avatar,
        content,
        message_type,
        file_url,
        file_name,
        created_at,
        edited_at,
        chat_references (
          id,
          entity_type,
          entity_id,
          entity_data
        )
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    return res.json((data || []).reverse()); // Orden cronológico ascendente
  } catch (error: any) {
    console.error('Error en chat/messages:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// POST /api/chat/channels/:id/messages - Enviar mensaje
router.post('/channels/:channelId/messages', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const token = extractToken(req);
    const { email } = token ? getInfoFromToken(token) : { email: null };
    const userId = email ?? 'anon';
    
    let rawSenderName = req.body.sender_name || userId.split('@')[0] || 'Usuario';
    // Capitalizar la primera letra
    if (rawSenderName) {
      rawSenderName = rawSenderName.charAt(0).toUpperCase() + rawSenderName.slice(1);
    }

    let senderName = rawSenderName;

    // Obtener información del canal para verificar el tipo e incluir el nombre
    const { data: channel } = await supabaseAdmin
      .from('chat_channels')
      .select('name, channel_type, metadata, owner_id')
      .eq('id', channelId)
      .maybeSingle();

    if (channel?.channel_type === 'cliente') {
      // Si es un canal de tipo cliente y el remitente es personal (no empieza con guest:)
      if (!userId.startsWith('guest:')) {
        if (!senderName.includes('(Recepción)')) {
          senderName = `${senderName} (Recepción)`;
        }
        // Desactivar el bot automáticamente al intervenir personal humano
        const currentMetadata = channel.metadata || {};
        if (!currentMetadata.bot_disabled) {
          await supabaseAdmin
            .from('chat_channels')
            .update({
              metadata: {
                ...currentMetadata,
                bot_disabled: true
              }
            })
            .eq('id', channelId);
        }
      }
    }

    const { content, message_type = 'text', metadata = {} } = req.body;
    if (!content) return res.status(400).json({ error: 'Contenido requerido' });

    const owner_id = channel?.owner_id || await getOwnerId(channel?.metadata?.hotel_id);

    // Insertar mensaje
    const { data: messageData, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...(isMultiTenant ? { owner_id } : {}),
        channel_id: channelId,
        sender_id: userId,
        sender_name: senderName,
        content,
        message_type,
        metadata,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Extraer menciones (@entity:id) y crear referencias
    const mentionRegex = /@(reserva|pago|huesped|habitacion|factura|cierre|personal):([0-9a-f-]{36})/gi;
    const mentions = [...content.matchAll(mentionRegex)];

    if (mentions.length > 0) {
      const references = mentions.map(([, entityType, entityId]) => ({
        ...(isMultiTenant ? { owner_id } : {}),
        message_id: messageData.id,
        entity_type: entityType,
        entity_id: entityId,
      }));

      await supabaseAdmin.from('chat_references').insert(references);
    }

    // Emitir por WebSocket
    if (io) {
      io.to(`channel:${channelId}`).emit('new_message', {
        ...messageData,
        channel_name: channel?.name || 'General',
        chat_references: mentions.map(([, type, id]) => ({
          entity_type: type,
          entity_id: id,
        })),
      });

      // Notificar conteo sin leer
      io.emit('unread_update', { channelId });
    }

    return res.status(201).json(messageData);
  } catch (error: any) {
    console.error('Error enviando mensaje:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// POST /api/chat/channels - Crear canal
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const { name, channel_type = 'operativo', description } = req.body;
    const userId = (req as any).user?.id;
    const email = (req as any).user?.email;

    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    const hotelId = req.headers['x-hotel-id'];
    const finalMetadata: any = {};
    if (hotelId && hotelId !== 'all') {
      finalMetadata.hotel_id = hotelId;
    }

    const owner_id = await getOwnerId(hotelId);

    const { data, error } = await supabaseAdmin
      .from('chat_channels')
      .insert({
        ...(isMultiTenant ? { owner_id } : { id_hotel: hotelId && hotelId !== 'all' ? hotelId : null }),
        name,
        channel_type,
        created_by: email || 'system',
        metadata: finalMetadata,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creando canal:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// DELETE /api/chat/channels/:id - Eliminar canal (solo propietario/admin)
router.delete('/channels/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    // Verificar que el canal existe
    const { data: channel, error: fetchErr } = await supabaseAdmin
      .from('chat_channels')
      .select('id, name, created_by')
      .eq('id', channelId)
      .single();

    if (fetchErr || !channel) return res.status(404).json({ error: 'Canal no encontrado' });

    // Eliminar — los mensajes se borran en CASCADE desde la BD
    const { error } = await supabaseAdmin
      .from('chat_channels')
      .delete()
      .eq('id', channelId);

    if (error) throw error;
    return res.json({ success: true, deleted: channel.name });
  } catch (error: any) {
    console.error('Error eliminando canal:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// PUT /api/chat/channels/:id/read - Marcar como leído
router.put('/channels/:channelId/read', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    const { email: userId } = getInfoFromToken(token);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    // Intentar marcar como leído — no fatal si falla (e.g. user_id es email, no UUID)
    try {
      await supabaseAdmin
        .from('chat_read_status')
        .upsert(
          { user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString(), unread_count: 0 },
          { onConflict: 'user_id,channel_id' }
        );
    } catch (upsertErr: any) {
      console.warn('[chat/read] upsert silenced:', upsertErr?.message);
    }

    // Emitir unread_update para alertar a otros clientes/pestañas
    if (io) {
      io.emit('unread_update', { channelId });
    }

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('Error marcando como leído:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/chat/entity/:type/:id - Resolver entidad
router.get('/entity/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;

    let data;
    switch (type) {
      case 'reserva':
        const { data: res1 } = await supabaseAdmin
          .from('reservas_hotel')
          .select('*, huespedes(*), habitaciones(*)')
          .eq('id_reserva_hotel', id)
          .single();
        data = res1;
        break;

      case 'pago':
        const { data: res2 } = await supabaseAdmin
          .from('pagos_hotel')
          .select('*, reservas_hotel(*, huespedes(*))')
          .eq('id_pago_hotel', id)
          .single();
        data = res2;
        break;

      case 'huesped':
        const { data: res3 } = await supabaseAdmin
          .from('huespedes')
          .select('*')
          .eq('id_huesped', id)
          .single();
        data = res3;
        break;

      case 'factura':
        const { data: res4 } = await supabaseAdmin
          .from('facturas')
          .select('*')
          .eq('id_factura', id)
          .single();
        data = res4;
        break;

      default:
        return res.status(400).json({ error: 'Tipo de entidad no válido' });
    }

    return res.json(data || {});
  } catch (error: any) {
    console.error('Error resolviendo entidad:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// ════ CANAL PÚBLICO (Clientes) ════════════════════════════════

// POST /api/chat/public/init - Crear canal para cliente
router.post('/public/init', async (req: Request, res: Response) => {
  try {
    const { guest_email, guest_name, guest_phone } = req.body;

    if (!guest_email || !guest_name) {
      return res.status(400).json({ error: 'Email y nombre requeridos' });
    }

    let finalHotelId = req.body.hotelId || req.headers['x-hotel-id'];

    // Resolve owner_id early
    const owner_id = await getOwnerId(finalHotelId);

    // Buscar o registrar al huésped para asignarlo al canal
    let huespedId: string | null = null;
    if (guest_email?.trim()) {
      const { data: existingHuesped } = await supabaseAdmin
        .from('huespedes')
        .select('id_huesped')
        .eq('correo', guest_email.trim().toLowerCase())
        .maybeSingle();
      if (existingHuesped) {
        huespedId = existingHuesped.id_huesped;
      }
    }

    if (!huespedId) {
      const { data: nuevoHuesped } = await supabaseAdmin
        .from('huespedes')
        .insert({
          ...(isMultiTenant ? { owner_id } : {}),
          nombre_completo: guest_name.trim().toUpperCase(),
          correo: guest_email.trim().toLowerCase(),
          telefono: guest_phone?.trim() || null
        })
        .select('id_huesped')
        .single();
      if (nuevoHuesped) {
        huespedId = nuevoHuesped.id_huesped;
      }
    }

    // Buscar si ya existe un canal para este huésped
    const { data: existingChannel } = await supabaseAdmin
      .from('chat_channels')
      .select('id')
      .eq('channel_type', 'cliente')
      .eq('id_huesped', huespedId)
      .maybeSingle();

    if ((!finalHotelId || finalHotelId === 'all') && huespedId) {
      const { data: latestRes } = await supabaseAdmin
        .from('reservas_hotel')
        .select('id_hotel')
        .eq('id_huesped', huespedId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestRes) {
        finalHotelId = latestRes.id_hotel;
      }
    }

    let channelId = existingChannel?.id;

    if (!channelId) {
      // Crear canal
      const { data: newChannel, error: insertErr } = await supabaseAdmin
        .from('chat_channels')
        .insert({
          ...(isMultiTenant ? { owner_id } : { id_hotel: finalHotelId && finalHotelId !== 'all' ? finalHotelId : null }),
          name: `🟢 ${guest_name}`,
          channel_type: 'cliente',
          created_by: 'system',
          id_huesped: huespedId,
          metadata: finalHotelId && finalHotelId !== 'all' ? { hotel_id: finalHotelId } : {}
        })
        .select('id')
        .single();

      if (insertErr) throw insertErr;
      channelId = newChannel.id;
    }

    return res.json({ channelId, guestId: `guest:${guest_email}` });
  } catch (error: any) {
    console.error('Error en chat/public/init:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// POST /api/chat/public/send - Cliente envía mensaje
router.post('/public/send', async (req: Request, res: Response) => {
  try {
    const { channel_id, guest_email, guest_name, content } = req.body;

    if (!channel_id || !content) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const { data: chanInfo } = await supabaseAdmin
      .from('chat_channels')
      .select('name, owner_id, metadata')
      .eq('id', channel_id)
      .maybeSingle();

    const owner_id = chanInfo?.owner_id || await getOwnerId(chanInfo?.metadata?.hotel_id);

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...(isMultiTenant ? { owner_id } : {}),
        channel_id,
        sender_id: `guest:${guest_email}`,
        sender_name: guest_name,
        content,
        message_type: 'text',
      })
      .select()
      .single();

    if (error) throw error;

    // Emitir por WebSocket
    if (io) {
      io.to(`channel:${channel_id}`).emit('new_message', {
        ...data,
        channel_name: chanInfo?.name || 'General',
      });
      io.emit('unread_update', { channelId: channel_id });
    }

    return res.status(201).json(data);
  } catch (error: any) {
    console.error('Error enviando mensaje público:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// ════ BOT CON CONTEXTO ════════════════════════════════════════════

// POST /api/chat/bot/respond - Bot responde con contexto mejorado
router.post('/bot/respond', async (req: Request, res: Response) => {
  try {
    const { message, userId, channelId, hotelId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    // Obtener contexto del hotel
    const { data: hotelData } = await supabaseAdmin
      .from('hoteles')
      .select('*')
      .eq('id_hotel', hotelId || '1')
      .single();

    // Obtener todos los hoteles de la base de datos para contexto de multi-sede / cadena
    const { data: todosHoteles } = await supabaseAdmin
      .from('hoteles')
      .select('id_hotel, nombre_hotel, ciudad');

    // Obtener reservas del usuario si existe
    let userReservations = null;
    if (userId) {
      const { data: reservas } = await supabaseAdmin
        .from('reservas_hotel')
        .select('*')
        .eq('id_huesped', userId)
        .in('estado', ['confirmada', 'check_in'])
        .limit(1);
      userReservations = reservas?.[0] || null;
    }

    // Construir contexto para mejorar respuesta
    const hotelContext = hotelData
      ? {
          nombre: hotelData.nombre_hotel,
          ciudad: hotelData.ciudad,
          telefono: hotelData.telefono,
          email: hotelData.correo_contacto,
        }
      : null;

    // Construir system prompt con contexto y lista de todos los hoteles
    const systemPrompt = buildBotSystemPrompt(hotelContext, userReservations, todosHoteles || []);
    let botResponse = await callGeminiChat(message, systemPrompt);

    if (!botResponse) {
      // Fallback a respuesta automática basada en palabras clave
      botResponse = getSimpleAutoResponse(message, hotelContext, todosHoteles || []);
    }

    // Obtener owner_id del canal
    const { data: channelInfo } = await supabaseAdmin
      .from('chat_channels')
      .select('owner_id, metadata')
      .eq('id', channelId)
      .maybeSingle();

    const owner_id = channelInfo?.owner_id || await getOwnerId(hotelId || channelInfo?.metadata?.hotel_id);

    // Guardar respuesta del bot en la BD
    const { data: botMessage, error: botError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        ...(isMultiTenant ? { owner_id } : {}),
        channel_id: channelId,
        sender_id: 'bot:concierge',
        sender_name: 'Concierge Bot',
        content: botResponse || 'Por favor, contacta a recepción para más información.',
        message_type: 'text',
      })
      .select()
      .single();

    if (botError) throw botError;

    // Emitir por WebSocket
    if (io && channelId) {
      io.to(`channel:${channelId}`).emit('new_message', {
        ...botMessage,
        channel_name: hotelContext?.nombre || 'Chat',
      });
    }

    return res.json({ response: botResponse, message: botMessage });
  } catch (error: any) {
    console.error('Error en bot/respond:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// ════ FUNCIONES AUXILIARES ════════════════════════════════════════════

export function buildBotSystemPrompt(
  hotelContext: any,
  userReservations: any,
  todosHoteles: any[] = [],
  habitaciones: any[] = [],
  reservasActivas: any[] = [],
  userInfo: any = null
): string {
  const hotelName = hotelContext?.nombre || 'Hotel Verona';
  const city = hotelContext?.ciudad || 'Tegucigalpa';
  const currentDate = new Date().toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Construir la lista de hoteles de la cadena para que el bot la conozca
  const cadenaHotelesStr = todosHoteles.length > 0
    ? todosHoteles.map(h => `- ${h.nombre_hotel} (en ${h.ciudad || 'Honduras'})`).join('\n')
    : `- Hotel Verona\n- Hotel la Costa`;

  let prompt = `Eres un asistente de concierge profesional de ${hotelName}, ubicado en ${city}.
La fecha de hoy es: ${currentDate}.
Tu hotel pertenece a un grupo consolidado de propiedades compartidas. Los hoteles de nuestro grupo/cadena son:
${cadenaHotelesStr}

INFORMACIÓN DEL HOTEL ACTUAL DONDE TE UBICAS:
- Nombre: ${hotelName}
- Ciudad: ${city}
- Teléfono: ${hotelContext?.telefono || 'No disponible'}
- Email: ${hotelContext?.email || 'No disponible'}

${userInfo ? `INFORMACIÓN DEL CLIENTE ACTUAL:
- Nombre: ${userInfo.nombre_completo || 'No especificado'}
- Correo: ${userInfo.correo || 'No especificado'}
- Teléfono: ${userInfo.telefono || 'No especificado'}
(NOTA: YA TIENES LOS DATOS DEL CLIENTE, NO SE LOS PIDAS DE NUEVO PARA RESERVAR).` : ''}

POLÍTICAS IMPORTANTES:
- Check-in: 3:00 PM (sujeto a disponibilidad)
- Check-out: 12:00 PM
- Cancelación gratuita: Hasta 48 horas antes del check-in
- Mascotas pequeñas: Permitidas con cargo adicional

CONTEXTO DEL CLIENTE:
${
  Array.isArray(userReservations) && userReservations.length > 0
    ? `- Cliente con reservas activas:\n${userReservations.map((r: any) => `  * ID Reserva: ${r.id_reserva_hotel} | Habitación: ${r.habitaciones?.nombre_habitacion || r.id_habitacion} | Check-in: ${r.check_in.split('T')[0]} | Check-out: ${r.check_out.split('T')[0]} | Adultos: ${r.adultos} | Estado: ${r.estado}`).join('\n')}`
    : '- Cliente nuevo (sin reserva actual)'
}

REGLAS DE INTERACCIÓN (SÍGUELAS ESTRICTAMENTE):
1. **SÉ BREVE Y DIRECTO:** Responde con un máximo de 2-3 oraciones breves. No des explicaciones largas.
2. **DISPONIBILIDAD REAL EN VIVO:** Puedes consultar el catálogo debajo para ver qué habitaciones están "✅ DISPONIBLES HOY". Si el cliente pregunta por disponibilidad para "hoy", responde informando las opciones disponibles y sus tarifas. Si pregunta por otra fecha futura, asiste con amabilidad y ofrece conectarle con recepción para revisar el sistema.
3. **NO INVENTES DATOS:** Usa exclusivamente las tarifas y habitaciones listadas abajo.
4. Responde en español (Honduras/Centroamérica).
5. Sé amable, profesional y servicial usando emojis moderadamente.
6. Si el cliente solicita hablar con un agente, ofrécete a conectarlo de inmediato.
7. Regla multi-sede: Si preguntan por otro hotel de la red, confírmalo positivamente.`;

  // Añadir catálogo de habitaciones y disponibilidad en tiempo real si se proveen los datos
  if (habitaciones && habitaciones.length > 0) {
    const today = new Date();
    today.setHours(0,0,0,0);

    prompt += `\n\n--- CATÁLOGO DE HABITACIONES Y DISPONIBILIDAD PARA HOY (${currentDate}) ---\n`;
    habitaciones.forEach(hab => {
      let disponibleHoy = true;
      if (reservasActivas && reservasActivas.length > 0) {
        for (const res of reservasActivas) {
          if (res.id_habitacion === hab.id_habitacion) {
            const ci = new Date(res.check_in.split('T')[0] + 'T00:00:00');
            const co = new Date(res.check_out.split('T')[0] + 'T00:00:00');
            if (today >= ci && today < co) {
              disponibleHoy = false;
              break;
            }
          }
        }
      }
      
      const tarifa = hab.tarifa_noche || hab.precio_noche || hab.costo || 0;
      const tipo = hab.tipo_habitacion || hab.tipo_nombre || hab.tipo || 'Estándar';
      prompt += `- ${hab.nombre_habitacion} (ID interno: ${hab.id_habitacion} | Tipo: ${tipo} | Capacidad: ${hab.capacidad || 2} pers | Tarifa: ${tarifa} HNL) -> Estado: ${disponibleHoy ? '✅ DISPONIBLE HOY' : '❌ OCUPADA HOY'}\n`;
    });
  }

  return prompt;
}

export function getSimpleAutoResponse(message: string, hotelContext: any, todosHoteles: any[] = []): string {
  const lower = message.toLowerCase();
  const hotelName = hotelContext?.nombre || 'Hotel Verona';

  // 1. Saludos
  if (
    lower.includes('hola') ||
    lower.includes('buenos') ||
    lower.includes('buenas') ||
    lower.includes('hols') ||
    lower.includes('👋') ||
    lower.includes('saludos') ||
    lower.includes('hi')
  ) {
    return `👋 ¡Hola! Qué gusto saludarte. Soy tu Concierge Virtual. ¿En qué te puedo asistir hoy? Con gusto te daré información de nuestras tarifas, habitaciones, piscina, desayuno y ubicaciones. 😊`;
  }

  // 2. Red de Hoteles / Cuantos Hoteles son
  if (
    lower.includes('cuantos') ||
    lower.includes('cuántos') ||
    lower.includes('hoteles') ||
    lower.includes('sedes') ||
    lower.includes('sucursales') ||
    lower.includes('cadena') ||
    lower.includes('grupo')
  ) {
    const cadenaHotelesStr = todosHoteles.length > 0
      ? todosHoteles.map(h => `- ${h.nombre_hotel} (en ${h.ciudad || 'Honduras'})`).join('\n')
      : `- Hotel Verona\n- Hotel la Costa`;
    return `🏨 Formamos parte de una red de sedes compartidas. Contamos con las siguientes propiedades:\n${cadenaHotelesStr}\nPuedes explorar las habitaciones de cada una y reservar directamente alternando la sede en el selector del portal. ¡Nos encantará recibirte en cualquiera de ellas!`;
  }

  // 3. Tarifas / Precios / Costos
  if (
    lower.includes('tarifa') ||
    lower.includes('tarifas') ||
    lower.includes('precio') ||
    lower.includes('precios') ||
    lower.includes('costo') ||
    lower.includes('costos') ||
    lower.includes('cuanto') ||
    lower.includes('cuánto') ||
    lower.includes('valor') ||
    lower.includes('pecio')
  ) {
    return `💰 Nuestras tarifas varían de acuerdo al tipo de habitación (Individual, Doble o Suite) y temporada. Para ver la tarifa exacta calculada para tus fechas con todos los impuestos incluidos, te invitamos a visitar la sección "Habitaciones" o simular tu reserva en "Reservar". ¡Contamos con opciones muy cómodas! 💳`;
  }

  // 4. Disponibilidad / Habitaciones
  if (
    lower.includes('disponibilidad') ||
    lower.includes('disponible') ||
    lower.includes('habitacion') ||
    lower.includes('habitaciones') ||
    lower.includes('habitación') ||
    lower.includes('habitaciónes') ||
    lower.includes('cuarto') ||
    lower.includes('cuartos') ||
    lower.includes('camas')
  ) {
    return `🛏️ Contamos con una hermosa selección de habitaciones (desde sencillas ejecutivas hasta amplias suites familiares). Puedes consultar la disponibilidad en tiempo real para el día de hoy o cualquier fecha seleccionando tu estancia en la pestaña "Habitaciones" o ingresando las fechas en "Reservar".`;
  }

  // 5. Ubicación / Dónde
  if (
    lower.includes('ubicacion') ||
    lower.includes('ubicación') ||
    lower.includes('direccion') ||
    lower.includes('dirección') ||
    lower.includes('donde') ||
    lower.includes('dónde') ||
    lower.includes('llegar') ||
    lower.includes('queda')
  ) {
    const ciudad = hotelContext?.ciudad || 'Tegucigalpa';
    return `📍 Nos ubicamos en una zona céntrica, segura y de fácil acceso en ${ciudad}. Puedes consultar la dirección completa, mapa interactivo y datos telefónicos en la sección "Info" de nuestro portal. 🗺️`;
  }

  // 6. Gracias
  if (
    lower.includes('gracias') ||
    lower.includes('thank') ||
    lower.includes('agradezco') ||
    lower.includes('excelente')
  ) {
    return `😊 ¡Con el mayor de los gustos! Es un verdadero placer poder servirte. Quedo a tus órdenes por si necesitas cualquier otra información de nuestro hotel.`;
  }

  if (lower.includes('la costa') || lower.includes('hotel la costa') || lower.includes('costa')) {
    return `✨ ¡Hola! Sí, el Hotel la Costa es un hotel hermano de nuestro mismo grupo. Con gusto podemos ayudarte a reservar. Puedes seleccionar "Hotel la Costa" en el selector de sedes del portal para gestionar tu reserva directamente, o si gustas, indícame la fecha de check-in, check-out y tipo de habitación y yo tomaré nota para pasárselo a recepción.`;
  }

  if (
    lower.includes('check-in') ||
    lower.includes('checkin') ||
    lower.includes('entrada')
  ) {
    return `✅ El check-in en ${hotelName} es a partir de las 3:00 PM. Si llegas antes, podemos intentar asignarte una habitación según disponibilidad. ¿Necesitas ayuda adicional?`;
  }

  if (
    lower.includes('check-out') ||
    lower.includes('checkout') ||
    lower.includes('salida')
  ) {
    return `✅ El check-out es hasta las 12:00 PM. Si necesitas permanecer más tiempo, contáctanos con anticipación para un posible late check-out.`;
  }

  if (lower.includes('wifi') || lower.includes('internet')) {
    return `📶 Tenemos WiFi de alta velocidad disponible en todas las habitaciones y áreas comunes. La contraseña está en tu habitación. ¿Necesitas asistencia técnica?`;
  }

  if (
    lower.includes('transporte') ||
    lower.includes('aeropuerto') ||
    lower.includes('taxi')
  ) {
    return `🚗 Ofrecemos servicio de transporte privado al aeropuerto a tarifa especial. Contacta a recepción para reservar con anticipación.`;
  }

  if (lower.includes('piscina') || lower.includes('piscinar') || lower.includes('pool')) {
    return `🏊 Nuestra piscina está disponible de 7:00 AM a 8:00 PM. Te proporcionaremos toallas limpias en recepción.`;
  }

  if (lower.includes('desayuno') || lower.includes('buffet')) {
    return `🍳 El desayuno buffet se sirve de 6:30 AM a 10:00 AM en el comedor. Incluye frutas, pan, huevos, jamón, queso, café, jugo y té.`;
  }

  if (lower.includes('cancelación') || lower.includes('cancelar')) {
    return `📋 Las cancelaciones gratuitas se aceptan hasta 48 horas antes del check-in. Después de ese período, se cobra la tarifa completa. Para proceder, contacta a recepción o llama directamente.`;
  }

  if (lower.includes('agente') || lower.includes('recepción') || lower.includes('humano') || lower.includes('recepcion')) {
    return `📞 Claro, voy a conectarte con un agente de recepción ahora. Uno de nuestros representantes se comunicará contigo en breve.`;
  }

  // Respuesta genérica
  return `Entendido. Para información específica sobre "${message}", te recomiendo contactar directamente a recepción. 📞 Estamos disponibles 24/7 para asistirte.`;
}

export async function callGeminiChat(messageOrHistory: string | any[], systemPrompt: string, userInfo?: any): Promise<string | null> {
  const apiKeys = (
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).split(',').map(k => k.trim()).filter(Boolean);

  if (apiKeys.length === 0) {
    return null;
  }

  const contents = Array.isArray(messageOrHistory) ? messageOrHistory : [
    { role: 'user', parts: [{ text: messageOrHistory }] }
  ];

  const tools = [{
    functionDeclarations: [
      {
        name: 'solicitarReserva',
        description: 'Crea una solicitud de reserva en el hotel para el cliente actual. OBLIGATORIO: Pide al cliente su correo, teléfono y nombre ANTES de llamar esta función.',
        parameters: {
          type: 'OBJECT',
          properties: {
            nombreCompleto: { type: 'STRING' },
            correo: { type: 'STRING' },
            telefono: { type: 'STRING' },
            idHabitacion: { type: 'STRING', description: 'El "ID interno" exacto de la habitación elegida que aparece en el catálogo (ej. un código UUID). NO pongas el nombre.' },
            checkIn: { type: 'STRING', description: 'Fecha de entrada en formato YYYY-MM-DD' },
            checkOut: { type: 'STRING', description: 'Fecha de salida en formato YYYY-MM-DD' },
            adultos: { type: 'NUMBER' }
          },
          required: ['nombreCompleto', 'correo', 'telefono', 'idHabitacion', 'checkIn', 'checkOut', 'adultos']
        }
      },
      {
        name: 'modificarReserva',
        description: 'Modifica una reserva activa existente del cliente. SOLO USA ESTA HERRAMIENTA SI EL ID RESERVA APARECE EN EL CONTEXTO DEL CLIENTE. Modifica fechas o cantidad de adultos.',
        parameters: {
          type: 'OBJECT',
          properties: {
            idReserva: { type: 'STRING', description: 'El ID de la reserva que aparece en el contexto del cliente.' },
            checkIn: { type: 'STRING', description: 'Nueva fecha de check-in (YYYY-MM-DD)' },
            checkOut: { type: 'STRING', description: 'Nueva fecha de check-out (YYYY-MM-DD)' },
            adultos: { type: 'NUMBER', description: 'Nueva cantidad de adultos' }
          },
          required: ['idReserva']
        }
      },
      {
        name: 'cancelarReserva',
        description: 'Cancela una reserva activa del cliente. SOLO USA ESTA HERRAMIENTA SI EL ID RESERVA APARECE EN EL CONTEXTO DEL CLIENTE.',
        parameters: {
          type: 'OBJECT',
          properties: {
            idReserva: { type: 'STRING', description: 'El ID de la reserva que aparece en el contexto del cliente.' }
          },
          required: ['idReserva']
        }
      }
    ]
  }];

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: any = await response.json();
      const candidate = data.candidates?.[0];
      const functionCallParts = candidate?.content?.parts?.filter((p: any) => p.functionCall) || [];

      if (functionCallParts.length > 0) {
        const functionResponses = [];

        for (const fPart of functionCallParts) {
          const { name, args } = fPart.functionCall;
          if (name === 'solicitarReserva') {
            let functionResultText = '';
            try {
              // 1. Obtener tarifa de la habitación y el owner_id
              const selectFields = isMultiTenant ? 'id_hotel, tarifa_noche, owner_id' : 'id_hotel, tarifa_noche';
              const { data: habitacion, error: habErr } = await (supabaseAdmin
                .from('habitaciones')
                .select(selectFields as any)
                .eq('id_habitacion', args.idHabitacion)
                .single() as any);

              if (habErr || !habitacion) throw new Error('Habitación no encontrada.');

              // 2. Buscar o crear huesped
              let huespedId = '';
              const { data: existingGuest } = await supabaseAdmin
                .from('huespedes')
                .select('id_huesped')
                .eq('correo', args.correo)
                .maybeSingle();

              if (existingGuest) {
                huespedId = existingGuest.id_huesped;
              } else {
                const { data: newGuest, error: guestErr } = await supabaseAdmin
                  .from('huespedes')
                  .insert({
                    ...(isMultiTenant ? { owner_id: (habitacion as any).owner_id } : {}),
                    nombre_completo: args.nombreCompleto,
                    correo: args.correo,
                    telefono: args.telefono
                  })
                  .select()
                  .single();
                if (guestErr) throw guestErr;
                huespedId = newGuest.id_huesped;
              }

              const ci = new Date(args.checkIn);
              const co = new Date(args.checkOut);
              const msPerDay = 1000 * 60 * 60 * 24;
              const noches = Math.max(1, Math.round((co.getTime() - ci.getTime()) / msPerDay));
              const totalEstimado = (habitacion.tarifa_noche || 0) * noches;

              // 3. Crear reserva
              const checkInDT = args.checkIn.includes('T') ? args.checkIn : args.checkIn + 'T14:00:00';
              const checkOutDT = args.checkOut.includes('T') ? args.checkOut : args.checkOut + 'T12:00:00';
              
              const { data: newRes, error: resErr } = await supabaseAdmin
                .from('reservas_hotel')
                .insert({
                  ...(isMultiTenant ? { owner_id: (habitacion as any).owner_id } : {}),
                  id_huesped: huespedId,
                  id_habitacion: args.idHabitacion,
                  id_hotel: habitacion.id_hotel,
                  check_in: checkInDT,
                  check_out: checkOutDT,
                  adultos: args.adultos,
                  ninos: 0,
                  estado: 'pendiente',
                  tipo_reserva: 'noche',
                  total_reserva: totalEstimado,
                  moneda: 'HNL',
                  estado_pago: 'reservada',
                  anticipo: 0,
                  es_cortesia: false,
                  observaciones: '[WEB] Reserva creada automáticamente vía Chatbot Público'
                })
                .select()
                .single();

              if (resErr) throw resErr;
              functionResultText = `¡Reserva exitosa! ID de reserva: ${newRes.id_reserva_hotel}. Estado: Pendiente. Dile al cliente que su reserva está confirmada y será revisada por recepción en breve.`;

            } catch (err: any) {
              functionResultText = `Error al crear reserva: ${err.message}. Pide disculpas y sugiere conectar con recepción.`;
            }

            functionResponses.push({
              functionResponse: { name, response: { result: functionResultText } }
            });
          } else if (name === 'modificarReserva') {
            let functionResultText = '';
            try {
              if (!userInfo?.id_huesped) throw new Error('No se puede validar la identidad del cliente actual. Conéctelo con recepción.');

              // Validar que la reserva le pertenece y obtener tarifa
              const { data: reserva, error: resErr } = await supabaseAdmin
                .from('reservas_hotel')
                .select('id_reserva_hotel, habitaciones(tarifa_noche, precio_noche, costo)')
                .eq('id_reserva_hotel', args.idReserva)
                .eq('id_huesped', userInfo.id_huesped)
                .single();

              if (resErr || !reserva) throw new Error('Reserva no encontrada o no pertenece a este cliente.');

              const updates: any = {};
              if (args.checkIn) updates.check_in = args.checkIn.includes('T') ? args.checkIn : args.checkIn + 'T14:00:00';
              if (args.checkOut) updates.check_out = args.checkOut.includes('T') ? args.checkOut : args.checkOut + 'T12:00:00';
              if (args.adultos !== undefined) updates.adultos = args.adultos;

              // Recalcular total si cambian fechas
              if (args.checkIn || args.checkOut) {
                const ci = new Date(args.checkIn || updates.check_in);
                const co = new Date(args.checkOut || updates.check_out);
                const msPerDay = 1000 * 60 * 60 * 24;
                const noches = Math.max(1, Math.round((co.getTime() - ci.getTime()) / msPerDay));
                const tarifa = (reserva.habitaciones as any)?.tarifa_noche || (reserva.habitaciones as any)?.precio_noche || (reserva.habitaciones as any)?.costo || 0;
                updates.total_reserva = tarifa * noches;
              }

              const { error: updErr } = await supabaseAdmin
                .from('reservas_hotel')
                .update(updates)
                .eq('id_reserva_hotel', args.idReserva);

              if (updErr) throw updErr;
              functionResultText = `Reserva modificada exitosamente. Total recalculado (si aplicaba). Confirmalo al cliente.`;
            } catch (err: any) {
              functionResultText = `Error al modificar: ${err.message}`;
            }

            functionResponses.push({
              functionResponse: { name, response: { result: functionResultText } }
            });
          } else if (name === 'cancelarReserva') {
            let functionResultText = '';
            try {
              if (!userInfo?.id_huesped) throw new Error('No se puede validar la identidad del cliente actual. Conéctelo con recepción.');

              // Validar que le pertenece y que su estado permita cancelación
              const { data: reserva, error: resErr } = await supabaseAdmin
                .from('reservas_hotel')
                .select('id_reserva_hotel, estado_pago, anticipo')
                .eq('id_reserva_hotel', args.idReserva)
                .eq('id_huesped', userInfo.id_huesped)
                .single();

              if (resErr || !reserva) throw new Error('Reserva no encontrada o no pertenece a este cliente.');

              // Verificación simple: si ya pagó, sugerir humano (por simplificación solicitada en el plan)
              if (reserva.estado_pago === 'pagada' || reserva.anticipo > 0) {
                throw new Error('Esta reserva tiene pagos asociados. Por políticas, debe ser cancelada por recepción para procesar el reembolso.');
              }

              const { error: cancelErr } = await supabaseAdmin
                .from('reservas_hotel')
                .update({ estado: 'cancelada' })
                .eq('id_reserva_hotel', args.idReserva);

              if (cancelErr) throw cancelErr;
              functionResultText = `Reserva cancelada exitosamente. Confirmalo al cliente y despídete amablemente.`;
            } catch (err: any) {
              functionResultText = `Error al cancelar: ${err.message}`;
            }

            functionResponses.push({
              functionResponse: { name, response: { result: functionResultText } }
            });
          }
        }

        if (functionResponses.length > 0) {
          // Follow-up API call
          const followUpContents = [
            ...contents,
            candidate.content,
            {
              role: 'user',
              parts: functionResponses
            }
          ];

          const followUpRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: followUpContents,
                generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
              })
            }
          );

          if (followUpRes.ok) {
            const followData: any = await followUpRes.json();
            const textPart = followData.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
            if (textPart?.text) {
              return textPart.text;
            } else {
              console.warn('⚠️ Gemini follow-up OK pero no hay texto:', JSON.stringify(followData));
            }
          } else {
            const errText = await followUpRes.text();
            console.error('⚠️ Gemini follow-up failed:', followUpRes.status, errText);
          }
        }
      }

      const textPart = candidate?.content?.parts?.find((p: any) => p.text);
      const content = textPart?.text || null;
      if (content) return content;
    } catch (err: any) {
      console.warn(`⚠️ Error calling Gemini with key: ${err.message}`);
    }
  }

  return null;
}

export default router;
