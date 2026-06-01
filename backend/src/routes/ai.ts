import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

config();

const router = express.Router();
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const geminiKey = process.env.GEMINI_API_KEY?.split(',')[0]?.trim() || '';
const genai = new GoogleGenAI({ apiKey: geminiKey });

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await db.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

async function resolveOwner(user: any) {
  const { data: ownerRow } = await db.from('owners')
    .select('id_owner, nombre_empresa, email_contacto')
    .eq('id_owner', user.id).maybeSingle();

  if (ownerRow) {
    const { data: mods } = await db.from('business_modules')
      .select('id_module').eq('owner_id', ownerRow.id_owner);
    const moduleIds = (mods || []).map((m: any) => m.id_module);
    let hotelIds: string[] = [];
    if (moduleIds.length > 0) {
      const { data: h } = await db.from('hoteles').select('id_hotel').in('id_module', moduleIds);
      hotelIds = (h || []).map((x: any) => x.id_hotel);
    }
    return { ownerRow, ownerIds: [ownerRow.id_owner], hotelIds, error: null };
  }

  const { data: roles, error } = await db.from('usuarios_roles')
    .select('owner_id, id_hotel').eq('user_id', user.id).eq('estado', 'activo');
  if (error) return { ownerRow: null, ownerIds: [] as string[], hotelIds: [] as string[], error };
  const ownerIds = [...new Set((roles || []).map((r: any) => r.owner_id).filter(Boolean))] as string[];
  const hotelIds = [...new Set((roles || []).map((r: any) => r.id_hotel).filter(Boolean))] as string[];
  const { data: staffOwner } = await db.from('owners')
    .select('id_owner, nombre_empresa, email_contacto').eq('id_owner', ownerIds[0]).maybeSingle();
  return { ownerRow: staffOwner ?? null, ownerIds, hotelIds, error: null };
}

// ─── Herramientas de consulta ─────────────────────────────────────────────────

async function fn_get_businesses({ ownerIds }: { ownerIds: string[] }) {
  const { data: modules } = await db.from('business_modules')
    .select('id_module, tipo_modulo, nombre_modulo, estado').in('owner_id', ownerIds);
  const moduleIds = (modules || []).map((m: any) => m.id_module);
  let hoteles: any[] = [];
  if (moduleIds.length > 0) {
    const { data: h } = await db.from('hoteles')
      .select('id_hotel, nombre_hotel, estado, id_module, slug, ciudad').in('id_module', moduleIds);
    hoteles = h || [];
  }
  return { modules, hoteles };
}

async function fn_get_hotel_info({ hotel_id }: { hotel_id: string }) {
  const { data: hotel } = await db.from('hoteles')
    .select('*').eq('id_hotel', hotel_id).maybeSingle();
  const { data: config } = await db.from('configuracion_hotelera')
    .select('*').eq('id_hotel', hotel_id).maybeSingle();
  const { data: rooms } = await db.from('habitaciones')
    .select('estado, count:id_habitacion').eq('id_hotel', hotel_id);
  return { hotel, config, rooms };
}

async function fn_get_reservations({ hotel_id, limit = 20, estado, fecha_desde, fecha_hasta }: {
  hotel_id: string; limit?: number; estado?: string; fecha_desde?: string; fecha_hasta?: string;
}) {
  let q = db.from('reservas_hotel')
    .select(`id_reserva_hotel, estado, estado_pago, total_reserva, moneda,
      check_in, check_out, adultos, ninos, observaciones, created_at,
      huespedes(nombre_completo, correo, telefono),
      habitaciones(nombre_habitacion, nombre_alias)`)
    .eq('id_hotel', hotel_id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (estado) q = q.eq('estado', estado);
  if (fecha_desde) q = q.gte('check_in', fecha_desde);
  if (fecha_hasta) q = q.lte('check_in', fecha_hasta);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { reservations: data, count: data?.length };
}

async function fn_get_rooms({ hotel_id }: { hotel_id: string }) {
  const { data, error } = await db.from('habitaciones_con_detalles')
    .select('*').eq('id_hotel', hotel_id).order('nombre_habitacion');
  if (error) throw new Error(error.message);
  return { rooms: data };
}

async function fn_get_guests({ hotel_id, busqueda, limit = 20 }: {
  hotel_id: string; busqueda?: string; limit?: number;
}) {
  let q = db.from('huespedes')
    .select('id_huesped, nombre_completo, correo, telefono, documento_identidad, estado, created_at')
    .eq('id_hotel', hotel_id).order('created_at', { ascending: false }).limit(limit);
  if (busqueda) q = q.or(`nombre_completo.ilike.%${busqueda}%,correo.ilike.%${busqueda}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { guests: data };
}

async function fn_get_payments({ hotel_id, limit = 20 }: { hotel_id: string; limit?: number }) {
  const { data, error } = await db.from('pagos_hotel')
    .select(`id_pago_hotel, monto, moneda, metodo_pago, estado, fecha_pago, notas,
      reservas_hotel!inner(id_hotel, huespedes(nombre_completo))`)
    .eq('reservas_hotel.id_hotel', hotel_id)
    .order('fecha_pago', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return { payments: data };
}

async function fn_get_metrics({ hotel_id, mes, anio }: {
  hotel_id: string; mes?: number; anio?: number;
}) {
  const now = new Date();
  const y = anio || now.getFullYear();
  const m = mes || now.getMonth() + 1;
  const desde = `${y}-${String(m).padStart(2,'0')}-01`;
  const hasta = `${y}-${String(m).padStart(2,'0')}-31`;

  const [resData, pagData, habData] = await Promise.all([
    db.from('reservas_hotel').select('estado, total_reserva, moneda')
      .eq('id_hotel', hotel_id).gte('check_in', desde).lte('check_in', hasta),
    db.from('pagos_hotel').select('monto, estado, metodo_pago')
      .eq('estado', 'registrado'),
    db.from('habitaciones').select('estado').eq('id_hotel', hotel_id),
  ]);

  const reservas = resData.data || [];
  const habitaciones = habData.data || [];
  const totalHab = habitaciones.length;
  const ocupadas = habitaciones.filter((h: any) => h.estado === 'ocupada').length;

  return {
    periodo: `${m}/${y}`,
    total_reservas: reservas.length,
    reservas_confirmadas: reservas.filter((r: any) => r.estado === 'confirmada').length,
    reservas_canceladas: reservas.filter((r: any) => r.estado === 'cancelada').length,
    ingresos_estimados: reservas
      .filter((r: any) => !['cancelada','no_show'].includes(r.estado))
      .reduce((s: number, r: any) => s + Number(r.total_reserva || 0), 0),
    habitaciones_total: totalHab,
    habitaciones_ocupadas: ocupadas,
    ocupacion_pct: totalHab > 0 ? Math.round(ocupadas / totalHab * 100) : 0,
  };
}

// ─── Herramientas de modificación ─────────────────────────────────────────────

async function fn_update_reservation({ id_reserva_hotel, campos }: {
  id_reserva_hotel: string;
  campos: Record<string, any>;
}) {
  const { data, error } = await db.from('reservas_hotel')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id_reserva_hotel', id_reserva_hotel).select().single();
  if (error) throw new Error(error.message);
  return { success: true, reserva: data };
}

async function fn_check_in({ id_reserva_hotel }: { id_reserva_hotel: string }) {
  const { data: reserva } = await db.from('reservas_hotel')
    .select('id_habitacion, estado').eq('id_reserva_hotel', id_reserva_hotel).single();
  if (!reserva) throw new Error('Reserva no encontrada');
  if (!['confirmada','pendiente'].includes(reserva.estado))
    throw new Error(`No se puede hacer check-in en estado: ${reserva.estado}`);
  await db.from('reservas_hotel').update({ estado: 'check_in', updated_at: new Date().toISOString() })
    .eq('id_reserva_hotel', id_reserva_hotel);
  await db.from('habitaciones').update({ estado: 'ocupada', updated_at: new Date().toISOString() })
    .eq('id_habitacion', reserva.id_habitacion);
  return { success: true, message: 'Check-in realizado correctamente' };
}

async function fn_check_out({ id_reserva_hotel }: { id_reserva_hotel: string }) {
  const { data: reserva } = await db.from('reservas_hotel')
    .select('id_habitacion, estado').eq('id_reserva_hotel', id_reserva_hotel).single();
  if (!reserva) throw new Error('Reserva no encontrada');
  if (reserva.estado !== 'check_in')
    throw new Error(`Solo se puede hacer check-out desde check_in. Estado actual: ${reserva.estado}`);
  await db.from('reservas_hotel').update({ estado: 'check_out', updated_at: new Date().toISOString() })
    .eq('id_reserva_hotel', id_reserva_hotel);
  await db.from('habitaciones').update({ estado: 'disponible', updated_at: new Date().toISOString() })
    .eq('id_habitacion', reserva.id_habitacion);
  return { success: true, message: 'Check-out realizado correctamente' };
}

async function fn_cancel_reservation({ id_reserva_hotel, motivo }: {
  id_reserva_hotel: string; motivo?: string;
}) {
  const { error } = await db.from('reservas_hotel')
    .update({ estado: 'cancelada', observaciones: motivo || 'Cancelada desde Solaris AI', updated_at: new Date().toISOString() })
    .eq('id_reserva_hotel', id_reserva_hotel);
  if (error) throw new Error(error.message);
  return { success: true, message: 'Reserva cancelada' };
}

async function fn_register_payment({ id_reserva_hotel, monto, metodo_pago, notas }: {
  id_reserva_hotel: string; monto: number; metodo_pago: string; notas?: string;
}) {
  const { data: reserva } = await db.from('reservas_hotel')
    .select('total_reserva').eq('id_reserva_hotel', id_reserva_hotel).single();
  if (!reserva) throw new Error('Reserva no encontrada');

  const { data: pago, error } = await db.from('pagos_hotel').insert({
    id_reserva_hotel, monto, monto_en_moneda_reserva: monto,
    metodo_pago, estado: 'registrado', notas: notas || null,
  }).select().single();
  if (error) throw new Error(error.message);

  // Recalcular estado_pago
  const { data: pagos } = await db.from('pagos_hotel')
    .select('monto_en_moneda_reserva').eq('id_reserva_hotel', id_reserva_hotel).neq('estado', 'anulado');
  const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto_en_moneda_reserva), 0);
  const estadoPago = totalPagado >= Number(reserva.total_reserva) - 0.01 ? 'pagado' : totalPagado > 0 ? 'abonada' : 'deuda';
  await db.from('reservas_hotel').update({ estado_pago: estadoPago }).eq('id_reserva_hotel', id_reserva_hotel);

  return { success: true, pago, estado_pago: estadoPago, total_pagado: totalPagado };
}

async function fn_update_room({ id_habitacion, campos }: {
  id_habitacion: string; campos: Record<string, any>;
}) {
  const { data, error } = await db.from('habitaciones')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id_habitacion', id_habitacion).select().single();
  if (error) throw new Error(error.message);
  return { success: true, habitacion: data };
}

async function fn_search_database({ tabla, filtros, columnas, limite }: {
  tabla: string; filtros?: Record<string, any>; columnas?: string; limite?: number;
}) {
  const tablesAllowed = [
    'hoteles','habitaciones','huespedes','reservas_hotel','pagos_hotel',
    'empresas','facturas','cierres_diarios','saldos_clientes',
    'tipos_habitacion','comodidades_hotel','servicios_adicionales',
    'habitaciones_con_detalles','business_modules'
  ];
  if (!tablesAllowed.includes(tabla))
    throw new Error(`Tabla ${tabla} no permitida. Tablas disponibles: ${tablesAllowed.join(', ')}`);

  let q = db.from(tabla).select(columnas || '*').limit(limite || 20);
  if (filtros) {
    for (const [k, v] of Object.entries(filtros)) {
      q = q.eq(k, v);
    }
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { tabla, data, count: data?.length };
}

// ─── Definición de herramientas para Gemini ───────────────────────────────────

const tools = [{
  functionDeclarations: [
    {
      name: 'get_businesses',
      description: 'Obtiene todos los negocios, hoteles y módulos del propietario. Úsala siempre que necesites saber qué negocios existen o sus IDs.',
      parameters: { type: Type.OBJECT, properties: {}, required: [] }
    },
    {
      name: 'get_hotel_info',
      description: 'Obtiene información detallada de un hotel: datos, configuración, dirección, tarifas.',
      parameters: {
        type: Type.OBJECT,
        properties: { hotel_id: { type: Type.STRING, description: 'UUID del hotel' } },
        required: ['hotel_id']
      }
    },
    {
      name: 'get_reservations',
      description: 'Obtiene reservas de un hotel. Puede filtrar por estado (pendiente/confirmada/check_in/check_out/cancelada/no_show) y por fechas.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          hotel_id: { type: Type.STRING, description: 'UUID del hotel' },
          limit: { type: Type.INTEGER, description: 'Número de resultados (default 20)' },
          estado: { type: Type.STRING, description: 'Filtro de estado de la reserva' },
          fecha_desde: { type: Type.STRING, description: 'Fecha inicio en formato YYYY-MM-DD' },
          fecha_hasta: { type: Type.STRING, description: 'Fecha fin en formato YYYY-MM-DD' },
        },
        required: ['hotel_id']
      }
    },
    {
      name: 'get_rooms',
      description: 'Lista todas las habitaciones de un hotel con su estado actual, tipo, tarifa y comodidades.',
      parameters: {
        type: Type.OBJECT,
        properties: { hotel_id: { type: Type.STRING, description: 'UUID del hotel' } },
        required: ['hotel_id']
      }
    },
    {
      name: 'get_guests',
      description: 'Lista o busca huéspedes de un hotel. Puede buscar por nombre o correo.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          hotel_id: { type: Type.STRING, description: 'UUID del hotel' },
          busqueda: { type: Type.STRING, description: 'Nombre o correo a buscar (opcional)' },
          limit: { type: Type.INTEGER, description: 'Límite de resultados' },
        },
        required: ['hotel_id']
      }
    },
    {
      name: 'get_payments',
      description: 'Obtiene los pagos recientes de un hotel.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          hotel_id: { type: Type.STRING, description: 'UUID del hotel' },
          limit: { type: Type.INTEGER, description: 'Límite de resultados' },
        },
        required: ['hotel_id']
      }
    },
    {
      name: 'get_metrics',
      description: 'Obtiene métricas clave de un hotel: ingresos, ocupación, número de reservas, para un mes/año específico.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          hotel_id: { type: Type.STRING, description: 'UUID del hotel' },
          mes: { type: Type.INTEGER, description: 'Mes (1-12). Omitir para mes actual.' },
          anio: { type: Type.INTEGER, description: 'Año. Omitir para año actual.' },
        },
        required: ['hotel_id']
      }
    },
    {
      name: 'update_reservation',
      description: 'Modifica campos de una reserva (estado, observaciones, total_reserva, adultos, ninos, etc.). NO usar para check-in/check-out — usar las herramientas específicas.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id_reserva_hotel: { type: Type.STRING, description: 'UUID de la reserva' },
          campos: { type: Type.OBJECT, description: 'Campos a actualizar (ej: { "observaciones": "Llegada tardía" })' },
        },
        required: ['id_reserva_hotel', 'campos']
      }
    },
    {
      name: 'check_in',
      description: 'Realiza el check-in de una reserva. Cambia estado a check_in y habitación a ocupada.',
      parameters: {
        type: Type.OBJECT,
        properties: { id_reserva_hotel: { type: Type.STRING, description: 'UUID de la reserva' } },
        required: ['id_reserva_hotel']
      }
    },
    {
      name: 'check_out',
      description: 'Realiza el check-out de una reserva. Cambia estado a check_out y habitación a disponible.',
      parameters: {
        type: Type.OBJECT,
        properties: { id_reserva_hotel: { type: Type.STRING, description: 'UUID de la reserva' } },
        required: ['id_reserva_hotel']
      }
    },
    {
      name: 'cancel_reservation',
      description: 'Cancela una reserva con un motivo opcional.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id_reserva_hotel: { type: Type.STRING, description: 'UUID de la reserva' },
          motivo: { type: Type.STRING, description: 'Motivo de cancelación (opcional)' },
        },
        required: ['id_reserva_hotel']
      }
    },
    {
      name: 'register_payment',
      description: 'Registra un pago para una reserva y actualiza el estado de pago automáticamente.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id_reserva_hotel: { type: Type.STRING, description: 'UUID de la reserva' },
          monto: { type: Type.NUMBER, description: 'Monto a pagar' },
          metodo_pago: { type: Type.STRING, description: 'efectivo / tarjeta / transferencia / deposito / otro' },
          notas: { type: Type.STRING, description: 'Notas del pago (opcional)' },
        },
        required: ['id_reserva_hotel', 'monto', 'metodo_pago']
      }
    },
    {
      name: 'update_room',
      description: 'Modifica una habitación: estado (disponible/ocupada/mantenimiento/bloqueada/limpieza), tarifa_noche, etc.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          id_habitacion: { type: Type.STRING, description: 'UUID de la habitación' },
          campos: { type: Type.OBJECT, description: 'Campos a actualizar (ej: { "estado": "mantenimiento", "tarifa_noche": 850 })' },
        },
        required: ['id_habitacion', 'campos']
      }
    },
    {
      name: 'search_database',
      description: 'Consulta directa a cualquier tabla de la base de datos. Solo lectura. Útil para consultas específicas no cubiertas por otras herramientas.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          tabla: { type: Type.STRING, description: 'Nombre de la tabla a consultar' },
          filtros: { type: Type.OBJECT, description: 'Filtros clave-valor (ej: { "id_hotel": "uuid..." })' },
          columnas: { type: Type.STRING, description: 'Columnas a seleccionar (default: *)' },
          limite: { type: Type.INTEGER, description: 'Número máximo de filas' },
        },
        required: ['tabla']
      }
    },
  ]
}];

// ─── Ejecutor de herramientas ─────────────────────────────────────────────────

async function executeTool(name: string, args: any, ownerIds: string[], hotelIds: string[]) {
  switch (name) {
    case 'get_businesses':        return fn_get_businesses({ ownerIds });
    case 'get_hotel_info':        return fn_get_hotel_info(args);
    case 'get_reservations':      return fn_get_reservations(args);
    case 'get_rooms':             return fn_get_rooms(args);
    case 'get_guests':            return fn_get_guests(args);
    case 'get_payments':          return fn_get_payments(args);
    case 'get_metrics':           return fn_get_metrics(args);
    case 'update_reservation':    return fn_update_reservation(args);
    case 'check_in':              return fn_check_in(args);
    case 'check_out':             return fn_check_out(args);
    case 'cancel_reservation':    return fn_cancel_reservation(args);
    case 'register_payment':      return fn_register_payment(args);
    case 'update_room':           return fn_update_room(args);
    case 'search_database':       return fn_search_database(args);
    // Compatibilidad con nombres anteriores
    case 'get_owner_businesses':  return fn_get_businesses({ ownerIds });
    case 'get_hotel_reservations': return fn_get_reservations({ hotel_id: args.hotel_id, limit: args.limit });
    case 'update_reservation_status': return fn_update_reservation({ id_reserva_hotel: args.id_reserva_hotel, campos: { estado: args.estado } });
    default: return { error: `Herramienta '${name}' no reconocida.` };
  }
}

// ─── Endpoint de Chat ─────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerRow, ownerIds, hotelIds, error: ownerError } = await resolveOwner(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });

    if (!geminiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada.' });

    const { prompt, history = [] } = req.body;
    const now = new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' });

    // Mapear historial del frontend al formato Gemini
    const geminiHistory = (history as { role: string; content: string }[])
      .filter(h => h.content?.trim())
      .map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      }));

    const chat = genai.chats.create({
      model: 'gemini-2.5-flash',
      history: geminiHistory,
      config: {
        tools,
        systemInstruction: `Eres "Solaris AI", el asistente inteligente del propietario en el Hub de gestión de negocios Solaris.

**Contexto del propietario:**
- Empresa: ${ownerRow?.nombre_empresa || 'No definida'}
- Email: ${ownerRow?.email_contacto || user.email}
- Negocios registrados: ${hotelIds.length} hotel(es)
- Fecha y hora actual: ${now}

**Tu rol:**
Eres el asistente con control total sobre la base de datos de sus negocios. Puedes consultar y modificar reservas, pagos, habitaciones, huéspedes y métricas bajo las órdenes del propietario.

**Instrucciones:**
- Usa SIEMPRE las herramientas para obtener datos reales. NUNCA inventes información.
- Si necesitas el ID de un hotel para otra herramienta, primero llama a get_businesses.
- Para check-in/check-out usa las herramientas específicas (check_in / check_out), no update_reservation.
- Cuando ejecutes una acción de modificación, confirma brevemente qué se hizo.
- Responde en español, de forma clara y directa.
- Formatea tablas y listas en markdown cuando muestres datos múltiples.
- Si hay un error en una herramienta, explícalo al usuario y sugiere alternativas.`,
      }
    });

    const toolsUsed: string[] = [];
    let response = await chat.sendMessage({ message: prompt });

    // Loop de function calling
    let maxIterations = 8;
    while (response.functionCalls && response.functionCalls.length > 0 && maxIterations-- > 0) {
      const calls = response.functionCalls;
      const results = await Promise.all(
        calls.map(async (call) => {
          toolsUsed.push(call.name || '');
          try {
            const result = await executeTool(call.name || '', call.args || {}, ownerIds, hotelIds);
            return { functionResponse: { name: call.name, response: result } };
          } catch (e: any) {
            return { functionResponse: { name: call.name, response: { error: e.message } } };
          }
        })
      );

      response = await chat.sendMessage({ message: results as any });
    }

    return res.json({ reply: response.text, toolsUsed });
  } catch (err: any) {
    console.error('AI Chat Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
