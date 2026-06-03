import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { supabaseAdmin } from '../../config/supabase.js';
import { extractToken } from '../../utils/auditHelper.js';

const router = Router();
let io: SocketIOServer;

export function setIO(socketServer: SocketIOServer) { io = socketServer; }
export function getIO() { return io; }

import fs from 'fs';

// Obtiene el UUID del usuario autenticado desde el JWT
async function getUserId(req: Request): Promise<string | null> {
  const token = extractToken(req);
  if (!token) {
    fs.appendFileSync('auth_debug.log', `[${new Date().toISOString()}] No token\n`);
    return null;
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) {
    fs.appendFileSync('auth_debug.log', `[${new Date().toISOString()}] getUser error: ${error.message} - token: ${token.slice(0, 15)}...\n`);
  } else {
    fs.appendFileSync('auth_debug.log', `[${new Date().toISOString()}] getUser OK: ${data?.user?.id}\n`);
  }
  return data?.user?.id ?? null;
}

// Tipos de canal y entidad válidos según el schema
const VALID_CHANNEL_TYPES = ['general', 'operativo', 'cliente', 'privado'] as const;
const VALID_ENTITY_TYPES  = ['reserva', 'pago', 'huesped', 'habitacion', 'factura'] as const;

// ════ REST ENDPOINTS ════════════════════════════════════════════

// GET /api/chat/channels
router.get('/channels', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const hotelId = req.headers['x-hotel-id'] as string;

    let query = supabaseAdmin
      .from('chat_channels')
      .select('id, name, channel_type, created_by, metadata, id_huesped, created_at')
      .in('channel_type', VALID_CHANNEL_TYPES);

    if (hotelId && hotelId !== 'all') {
      query = query.eq('id_hotel', hotelId);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;

    // Agregar conteo de no leídos
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
          guest_id:      channel.id_huesped ?? null,
          guest_email:   channel.metadata?.email ?? null,
          guest_name:    channel.metadata?.guest_name ?? null,
          unread_count:  unreadData?.unread_count || 0,
        };
      })
    );

    return res.json(channelsWithUnread);
  } catch (err: any) {
    console.error('Error en chat/channels:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// GET /api/chat/channels/:id/messages
router.get('/channels/:channelId/messages', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select(`
        id, channel_id, sender_id, sender_name, sender_avatar,
        content, message_type, file_url, file_name,
        created_at, edited_at,
        chat_references ( id, entity_type, entity_id, entity_data )
      `)
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;
    return res.json((data || []).reverse());
  } catch (err: any) {
    console.error('Error en chat/messages:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// POST /api/chat/channels/:id/messages
router.post('/channels/:channelId/messages', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { content, message_type = 'text', metadata = {}, sender_name } = req.body;
    if (!content) return res.status(400).json({ error: 'Contenido requerido' });

    // Obtener canal para determinar tipo y ajustar nombre del remitente
    const { data: channel } = await supabaseAdmin
      .from('chat_channels')
      .select('name, channel_type, metadata')
      .eq('id', channelId)
      .maybeSingle();

    let senderName = sender_name || 'Usuario';
    if (channel?.channel_type === 'cliente' && !senderName.includes('(Recepción)')) {
      senderName = `${senderName} (Recepción)`;
      // Desactivar bot al intervenir personal
      if (!channel.metadata?.bot_disabled) {
        await supabaseAdmin.from('chat_channels').update({
          metadata: { ...(channel.metadata || {}), bot_disabled: true }
        }).eq('id', channelId);
      }
    }

    // Insertar mensaje (sin owner_id — no existe en esta tabla)
    const { data: messageData, error: msgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        channel_id:   channelId,
        sender_id:    userId,
        sender_name:  senderName,
        content,
        message_type: VALID_CHANNEL_TYPES.includes(message_type as any) ? message_type : 'text',
        metadata,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Extraer menciones válidas y crear referencias
    const mentionRegex = new RegExp(
      `@(${VALID_ENTITY_TYPES.join('|')}):([0-9a-f-]{36})`,
      'gi'
    );
    const mentions = [...content.matchAll(mentionRegex)];

    if (mentions.length > 0) {
      await supabaseAdmin.from('chat_references').insert(
        mentions.map(([, entityType, entityId]) => ({
          message_id:  messageData.id,
          entity_type: entityType.toLowerCase(),
          entity_id:   entityId,
        }))
      );
    }

    if (io) {
      io.to(`channel:${channelId}`).emit('new_message', {
        ...messageData,
        channel_name: channel?.name || 'General',
        chat_references: mentions.map(([, type, id]) => ({ entity_type: type, entity_id: id })),
      });
      io.emit('unread_update', { channelId });
    }

    return res.status(201).json(messageData);
  } catch (err: any) {
    console.error('Error enviando mensaje:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// POST /api/chat/channels — Crear canal
router.post('/channels', async (req: Request, res: Response) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { name, channel_type = 'operativo', description } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') {
      return res.status(400).json({ error: 'x-hotel-id requerido para crear canal' });
    }

    const finalType = VALID_CHANNEL_TYPES.includes(channel_type as any) ? channel_type : 'operativo';

    const { data, error } = await supabaseAdmin
      .from('chat_channels')
      .insert({
        id_hotel:     hotelId,
        name,
        channel_type: finalType,
        description:  description || null,
        created_by:   userId,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(data);
  } catch (err: any) {
    console.error('Error creando canal:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// DELETE /api/chat/channels/:id
router.delete('/channels/:channelId', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const { data: channel, error: fetchErr } = await supabaseAdmin
      .from('chat_channels')
      .select('id, name')
      .eq('id', channelId)
      .single();

    if (fetchErr || !channel) return res.status(404).json({ error: 'Canal no encontrado' });

    const { error } = await supabaseAdmin
      .from('chat_channels')
      .delete()
      .eq('id', channelId);

    if (error) throw error;
    return res.json({ success: true, deleted: channel.name });
  } catch (err: any) {
    console.error('Error eliminando canal:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// PUT /api/chat/channels/:id/read — Marcar como leído
router.put('/channels/:channelId/read', async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    // user_id en chat_read_status es UUID que referencia auth.users(id)
    await supabaseAdmin
      .from('chat_read_status')
      .upsert(
        { user_id: userId, channel_id: channelId, last_read_at: new Date().toISOString(), unread_count: 0 },
        { onConflict: 'user_id,channel_id' }
      );

    if (io) io.emit('unread_update', { channelId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Error marcando como leído:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// GET /api/chat/entity/:type/:id — Resolver entidad mencionada
router.get('/entity/:type/:id', async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    let data: any = null;

    switch (type) {
      case 'reserva':
        ({ data } = await supabaseAdmin.from('reservas_hotel')
          .select('*, huespedes(*), habitaciones(*)').eq('id_reserva_hotel', id).single());
        break;
      case 'pago':
        ({ data } = await supabaseAdmin.from('pagos_hotel')
          .select('*, reservas_hotel(*, huespedes(*))').eq('id_pago_hotel', id).single());
        break;
      case 'huesped':
        ({ data } = await supabaseAdmin.from('huespedes')
          .select('*').eq('id_huesped', id).single());
        break;
      case 'factura':
        ({ data } = await supabaseAdmin.from('facturas')
          .select('*').eq('id_factura', id).single());
        break;
      case 'habitacion':
        ({ data } = await supabaseAdmin.from('habitaciones')
          .select('*').eq('id_habitacion', id).single());
        break;
      default:
        return res.status(400).json({ error: `Tipo de entidad no válido: ${type}` });
    }

    if (!data) return res.status(404).json({ error: 'Entidad no encontrada' });
    return res.json(data);
  } catch (err: any) {
    console.error('Error resolviendo entidad:', err);
    return res.status(500).json({ error: err?.message || 'Error interno' });
  }
});

// isMultiTenant para compatibilidad con funciones del bot heredadas
const isMultiTenant = false;
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
