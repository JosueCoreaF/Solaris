import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const router = express.Router();
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GEMINI_KEYS = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
    return { ownerRow, ownerIds: [ownerRow.id_owner], hotelIds };
  }

  const { data: roles } = await db.from('usuarios_roles')
    .select('owner_id, id_hotel').eq('user_id', user.id).eq('estado', 'activo');
  const ownerIds = [...new Set((roles || []).map((r: any) => r.owner_id).filter(Boolean))] as string[];
  const hotelIds = [...new Set((roles || []).map((r: any) => r.id_hotel).filter(Boolean))] as string[];
  const { data: staffOwner } = await db.from('owners')
    .select('id_owner, nombre_empresa, email_contacto').eq('id_owner', ownerIds[0]).maybeSingle();
  return { ownerRow: staffOwner ?? null, ownerIds, hotelIds };
}

// ─── Herramientas ─────────────────────────────────────────────────────────────
async function executeTool(name: string, args: any, ownerIds: string[], hotelIds: string[]): Promise<any> {
  switch (name) {

    case 'get_businesses': {
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

    case 'get_hotel_info': {
      const { data: hotel } = await db.from('hoteles').select('*').eq('id_hotel', args.hotel_id).maybeSingle();
      const { data: cfg } = await db.from('configuracion_hotelera').select('*').eq('id_hotel', args.hotel_id).maybeSingle();
      const { data: rooms } = await db.from('habitaciones').select('id_habitacion, estado, nombre_habitacion, tarifa_noche').eq('id_hotel', args.hotel_id);
      return { hotel, config: cfg, rooms };
    }

    case 'get_reservations': {
      let q = db.from('reservas_hotel')
        .select(`id_reserva_hotel, estado, estado_pago, total_reserva, moneda,
          check_in, check_out, adultos, ninos, observaciones, created_at,
          huespedes(nombre_completo, correo, telefono),
          habitaciones(nombre_habitacion, nombre_alias)`)
        .eq('id_hotel', args.hotel_id)
        .order('created_at', { ascending: false })
        .limit(args.limit || 20);
      if (args.estado) q = q.eq('estado', args.estado);
      if (args.fecha_desde) q = q.gte('check_in', args.fecha_desde);
      if (args.fecha_hasta) q = q.lte('check_in', args.fecha_hasta);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { reservations: data, count: data?.length };
    }

    case 'get_rooms': {
      const { data, error } = await db.from('habitaciones_con_detalles')
        .select('*').eq('id_hotel', args.hotel_id).order('nombre_habitacion');
      if (error) throw new Error(error.message);
      return { rooms: data };
    }

    case 'get_guests': {
      let q = db.from('huespedes')
        .select('id_huesped, nombre_completo, correo, telefono, documento_identidad, estado, created_at')
        .eq('id_hotel', args.hotel_id).order('created_at', { ascending: false }).limit(args.limit || 20);
      if (args.busqueda) q = q.or(`nombre_completo.ilike.%${args.busqueda}%,correo.ilike.%${args.busqueda}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { guests: data };
    }

    case 'get_payments': {
      const { data, error } = await db.from('pagos_hotel')
        .select('id_pago_hotel, monto, moneda, metodo_pago, estado, fecha_pago, notas, id_reserva_hotel')
        .in('id_reserva_hotel',
          (await db.from('reservas_hotel').select('id_reserva_hotel').eq('id_hotel', args.hotel_id)).data?.map((r: any) => r.id_reserva_hotel) || []
        )
        .order('fecha_pago', { ascending: false }).limit(args.limit || 20);
      if (error) throw new Error(error.message);
      return { payments: data };
    }

    case 'get_metrics': {
      const now = new Date();
      const y = args.anio || now.getFullYear();
      const m = args.mes || now.getMonth() + 1;
      const desde = `${y}-${String(m).padStart(2,'0')}-01`;
      const hasta = `${y}-${String(m).padStart(2,'0')}-31`;
      const [resData, habData] = await Promise.all([
        db.from('reservas_hotel').select('estado, total_reserva').eq('id_hotel', args.hotel_id).gte('check_in', desde).lte('check_in', hasta),
        db.from('habitaciones').select('estado').eq('id_hotel', args.hotel_id),
      ]);
      const reservas = resData.data || [];
      const habitaciones = habData.data || [];
      const ocupadas = habitaciones.filter((h: any) => h.estado === 'ocupada').length;
      return {
        periodo: `${m}/${y}`,
        total_reservas: reservas.length,
        confirmadas: reservas.filter((r: any) => r.estado === 'confirmada').length,
        canceladas: reservas.filter((r: any) => r.estado === 'cancelada').length,
        ingresos_estimados: reservas.filter((r: any) => !['cancelada','no_show'].includes(r.estado))
          .reduce((s: number, r: any) => s + Number(r.total_reserva || 0), 0),
        habitaciones_total: habitaciones.length,
        ocupadas,
        ocupacion_pct: habitaciones.length > 0 ? Math.round(ocupadas / habitaciones.length * 100) : 0,
      };
    }

    case 'check_in': {
      const { data: r } = await db.from('reservas_hotel').select('id_habitacion, estado').eq('id_reserva_hotel', args.id_reserva_hotel).single();
      if (!r) throw new Error('Reserva no encontrada');
      if (!['confirmada','pendiente'].includes(r.estado)) throw new Error(`Estado inválido para check-in: ${r.estado}`);
      await db.from('reservas_hotel').update({ estado: 'check_in' }).eq('id_reserva_hotel', args.id_reserva_hotel);
      await db.from('habitaciones').update({ estado: 'ocupada' }).eq('id_habitacion', r.id_habitacion);
      return { success: true, message: 'Check-in realizado.' };
    }

    case 'check_out': {
      const { data: r } = await db.from('reservas_hotel').select('id_habitacion, estado').eq('id_reserva_hotel', args.id_reserva_hotel).single();
      if (!r) throw new Error('Reserva no encontrada');
      if (r.estado !== 'check_in') throw new Error(`Estado inválido para check-out: ${r.estado}`);
      await db.from('reservas_hotel').update({ estado: 'check_out' }).eq('id_reserva_hotel', args.id_reserva_hotel);
      await db.from('habitaciones').update({ estado: 'disponible' }).eq('id_habitacion', r.id_habitacion);
      return { success: true, message: 'Check-out realizado.' };
    }

    case 'cancel_reservation': {
      await db.from('reservas_hotel').update({ estado: 'cancelada', observaciones: args.motivo || 'Cancelada desde Solaris AI' }).eq('id_reserva_hotel', args.id_reserva_hotel);
      return { success: true, message: 'Reserva cancelada.' };
    }

    case 'update_reservation': {
      const { data, error } = await db.from('reservas_hotel').update(args.campos).eq('id_reserva_hotel', args.id_reserva_hotel).select().single();
      if (error) throw new Error(error.message);
      return { success: true, reserva: data };
    }

    case 'register_payment': {
      const { data: reserva } = await db.from('reservas_hotel').select('total_reserva').eq('id_reserva_hotel', args.id_reserva_hotel).single();
      if (!reserva) throw new Error('Reserva no encontrada');
      await db.from('pagos_hotel').insert({ id_reserva_hotel: args.id_reserva_hotel, monto: args.monto, monto_en_moneda_reserva: args.monto, metodo_pago: args.metodo_pago, estado: 'registrado', notas: args.notas || null });
      const { data: pagos } = await db.from('pagos_hotel').select('monto_en_moneda_reserva').eq('id_reserva_hotel', args.id_reserva_hotel).neq('estado', 'anulado');
      const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto_en_moneda_reserva), 0);
      const estadoPago = totalPagado >= Number(reserva.total_reserva) - 0.01 ? 'pagado' : totalPagado > 0 ? 'abonada' : 'deuda';
      await db.from('reservas_hotel').update({ estado_pago: estadoPago }).eq('id_reserva_hotel', args.id_reserva_hotel);
      return { success: true, total_pagado: totalPagado, estado_pago: estadoPago };
    }

    case 'update_room': {
      const { data, error } = await db.from('habitaciones').update(args.campos).eq('id_habitacion', args.id_habitacion).select().single();
      if (error) throw new Error(error.message);
      return { success: true, habitacion: data };
    }

    case 'search_database': {
      const allowed = ['hoteles','habitaciones','huespedes','reservas_hotel','pagos_hotel','empresas','facturas','cierres_diarios','saldos_clientes','tipos_habitacion','comodidades_hotel','servicios_adicionales','habitaciones_con_detalles','business_modules'];
      if (!allowed.includes(args.tabla)) throw new Error(`Tabla no permitida. Disponibles: ${allowed.join(', ')}`);
      let q = (db.from(args.tabla) as any).select(args.columnas || '*').limit(args.limite || 20);
      if (args.filtros) for (const [k, v] of Object.entries(args.filtros)) q = q.eq(k, v);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return { tabla: args.tabla, data, count: data?.length };
    }

    default:
      return { error: `Herramienta '${name}' no reconocida.` };
  }
}

// ─── Definición de tools para Gemini REST API ─────────────────────────────────
const TOOLS = [{
  function_declarations: [
    { name: 'get_businesses', description: 'Obtiene todos los negocios, hoteles y módulos del propietario.', parameters: { type: 'OBJECT', properties: {}, required: [] } },
    { name: 'get_hotel_info', description: 'Información completa de un hotel: datos, configuración, habitaciones.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING', description: 'UUID del hotel' } }, required: ['hotel_id'] } },
    { name: 'get_reservations', description: 'Reservas de un hotel. Filtros: estado, fecha_desde, fecha_hasta, limit.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, limit: { type: 'INTEGER' }, estado: { type: 'STRING', description: 'pendiente/confirmada/check_in/check_out/cancelada/no_show' }, fecha_desde: { type: 'STRING', description: 'YYYY-MM-DD' }, fecha_hasta: { type: 'STRING', description: 'YYYY-MM-DD' } }, required: ['hotel_id'] } },
    { name: 'get_rooms', description: 'Lista todas las habitaciones con estado, tipo, tarifa y comodidades.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' } }, required: ['hotel_id'] } },
    { name: 'get_guests', description: 'Lista o busca huéspedes. Usa busqueda para filtrar por nombre o correo.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, busqueda: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['hotel_id'] } },
    { name: 'get_payments', description: 'Pagos recientes del hotel.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, limit: { type: 'INTEGER' } }, required: ['hotel_id'] } },
    { name: 'get_metrics', description: 'Métricas del hotel: ingresos, ocupación, reservas. Omite mes/anio para el mes actual.', parameters: { type: 'OBJECT', properties: { hotel_id: { type: 'STRING' }, mes: { type: 'INTEGER' }, anio: { type: 'INTEGER' } }, required: ['hotel_id'] } },
    { name: 'check_in', description: 'Realiza check-in de una reserva. Cambia estado a check_in y habitación a ocupada.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' } }, required: ['id_reserva_hotel'] } },
    { name: 'check_out', description: 'Realiza check-out de una reserva. Cambia estado a check_out y habitación a disponible.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' } }, required: ['id_reserva_hotel'] } },
    { name: 'cancel_reservation', description: 'Cancela una reserva con motivo opcional.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' }, motivo: { type: 'STRING' } }, required: ['id_reserva_hotel'] } },
    { name: 'update_reservation', description: 'Modifica campos de una reserva (observaciones, total_reserva, adultos, ninos, etc.).', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' }, campos: { type: 'OBJECT', description: 'Campos a actualizar ej: {"observaciones":"nota"}' } }, required: ['id_reserva_hotel', 'campos'] } },
    { name: 'register_payment', description: 'Registra un pago y recalcula estado_pago.', parameters: { type: 'OBJECT', properties: { id_reserva_hotel: { type: 'STRING' }, monto: { type: 'NUMBER' }, metodo_pago: { type: 'STRING', description: 'efectivo/tarjeta/transferencia/deposito/otro' }, notas: { type: 'STRING' } }, required: ['id_reserva_hotel', 'monto', 'metodo_pago'] } },
    { name: 'update_room', description: 'Modifica una habitación: estado, tarifa_noche, etc.', parameters: { type: 'OBJECT', properties: { id_habitacion: { type: 'STRING' }, campos: { type: 'OBJECT', description: 'Campos a actualizar ej: {"estado":"mantenimiento"}' } }, required: ['id_habitacion', 'campos'] } },
    { name: 'search_database', description: 'Consulta directa (solo lectura) a cualquier tabla de la BD.', parameters: { type: 'OBJECT', properties: { tabla: { type: 'STRING' }, filtros: { type: 'OBJECT' }, columnas: { type: 'STRING' }, limite: { type: 'INTEGER' } }, required: ['tabla'] } },
  ]
}];

// ─── Llamada a Gemini REST API ────────────────────────────────────────────────
async function callGemini(contents: any[], systemInstruction: string): Promise<any> {
  for (const key of GEMINI_KEYS) {
    try {
      const response = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents,
          tools: TOOLS,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini ${response.status}: ${err}`);
      }
      return await response.json();
    } catch (err: any) {
      console.error(`Gemini key failed: ${err.message}`);
      if (GEMINI_KEYS.indexOf(key) === GEMINI_KEYS.length - 1) throw err;
    }
  }
}

// ─── Endpoint ─────────────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerRow, ownerIds, hotelIds } = await resolveOwner(user);
    if (!ownerIds.length) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });
    if (!GEMINI_KEYS.length) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada.' });

    const { prompt, history = [] } = req.body;
    const now = new Date().toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' });

    const systemInstruction = `Eres "Solaris AI", el asistente inteligente del Hub de gestión de negocios.

Propietario: ${ownerRow?.nombre_empresa || 'Sin nombre'} (${ownerRow?.email_contacto || user.email})
Hoteles registrados: ${hotelIds.length}
Fecha y hora: ${now}

INSTRUCCIONES:
- Usa SIEMPRE las herramientas para obtener datos reales. NUNCA inventes información.
- Si necesitas el hotel_id, primero llama a get_businesses.
- Para check-in/check-out usa las herramientas específicas.
- Al modificar algo, confirma brevemente qué se hizo.
- Responde en español, claro y directo.
- Usa markdown para tablas y listas cuando muestres múltiples datos.`;

    // Construir historial en formato Gemini
    const contents: any[] = (history as { role: string; content: string }[])
      .filter(h => h.content?.trim())
      .map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] }));

    // Agregar mensaje actual
    contents.push({ role: 'user', parts: [{ text: prompt }] });

    const toolsUsed: string[] = [];
    let maxIter = 8;

    while (maxIter-- > 0) {
      const data = await callGemini(contents, systemInstruction);
      const candidate = data.candidates?.[0];

      if (!candidate) {
        return res.json({ reply: 'No se pudo obtener respuesta del modelo.', toolsUsed });
      }

      const parts = candidate.content?.parts || [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      // Sin llamadas a función → respuesta final
      if (functionCalls.length === 0) {
        const reply = textParts.map((p: any) => p.text).join('');
        return res.json({ reply: reply || '(Sin respuesta de texto)', toolsUsed });
      }

      // Ejecutar herramientas
      contents.push({ role: 'model', parts });

      const functionResponses: any[] = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        toolsUsed.push(name);
        let result: any;
        try {
          result = await executeTool(name, args || {}, ownerIds, hotelIds);
        } catch (e: any) {
          result = { error: e.message };
        }
        functionResponses.push({ functionResponse: { name, response: result } });
      }

      contents.push({ role: 'user', parts: functionResponses });
    }

    return res.json({ reply: 'Se alcanzó el límite de iteraciones.', toolsUsed });

  } catch (err: any) {
    console.error('AI Chat Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
