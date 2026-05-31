import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const router = express.Router();
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await db.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

/**
 * Resuelve el owner_id del usuario según el nuevo schema:
 *  - PROPIETARIO: owners.id_owner = auth.uid()
 *  - Staff: usuarios_roles.user_id = auth.uid()
 */
async function resolveOwner(user: any): Promise<{
  ownerRow: any | null;
  ownerIds: string[];
  hotelIds: string[];
  error: any;
}> {
  // 1. ¿Es propietario directo?
  const { data: ownerRow, error: ownerErr } = await db
    .from('owners')
    .select('id_owner, nombre_empresa, email_contacto')
    .eq('id_owner', user.id)
    .maybeSingle();

  if (ownerErr) return { ownerRow: null, ownerIds: [], hotelIds: [], error: ownerErr };

  if (ownerRow) {
    // Obtener sus hoteles via business_modules
    const { data: mods } = await db
      .from('business_modules')
      .select('id_module')
      .eq('owner_id', ownerRow.id_owner);

    const moduleIds = (mods || []).map((m: any) => m.id_module);
    let hotelIds: string[] = [];

    if (moduleIds.length > 0) {
      const { data: hoteles } = await db
        .from('hoteles')
        .select('id_hotel')
        .in('id_module', moduleIds);
      hotelIds = (hoteles || []).map((h: any) => h.id_hotel);
    }

    return { ownerRow, ownerIds: [ownerRow.id_owner], hotelIds, error: null };
  }

  // 2. ¿Es staff?
  const { data: roles, error: rolesErr } = await db
    .from('usuarios_roles')
    .select('owner_id, id_hotel')
    .eq('user_id', user.id)
    .eq('estado', 'activo');

  if (rolesErr) return { ownerRow: null, ownerIds: [], hotelIds: [], error: rolesErr };

  const ownerIds = [...new Set((roles || []).map((r: any) => r.owner_id).filter(Boolean))];
  const hotelIds = [...new Set((roles || []).map((r: any) => r.id_hotel).filter(Boolean))];

  if (ownerIds.length === 0) return { ownerRow: null, ownerIds: [], hotelIds: [], error: null };

  const { data: staffOwner } = await db
    .from('owners')
    .select('id_owner, nombre_empresa, email_contacto')
    .eq('id_owner', ownerIds[0])
    .maybeSingle();

  return { ownerRow: staffOwner ?? null, ownerIds, hotelIds, error: null };
}

// ─── POST /hub/owner — Onboarding de propietario ─────────────────────────────

router.post('/owner', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { nombre_empresa, email_contacto, telefono_contacto } = req.body;
    if (!nombre_empresa?.trim()) {
      return res.status(400).json({ error: 'nombre_empresa es requerido.' });
    }

    // Verificar si ya existe
    const { data: existing } = await db
      .from('owners')
      .select('id_owner')
      .eq('id_owner', user.id)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Ya tienes un perfil de propietario.' });
    }

    // Crear owner — id_owner = auth.uid() (diseño del schema)
    const { data: owner, error: ownerErr } = await db
      .from('owners')
      .insert({
        id_owner:          user.id,
        nombre_empresa:    nombre_empresa.trim(),
        email_contacto:    (email_contacto || user.email || '').trim().toLowerCase(),
        telefono_contacto: telefono_contacto?.trim() || null,
        estado:            'activo',
      })
      .select('id_owner')
      .single();

    if (ownerErr) return res.status(400).json({ error: ownerErr.message });

    // Trial de 14 días
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await db.from('suscripciones_owner').insert({
      owner_id:  owner.id_owner,
      id_plan:   'hotel_starter',
      tipo_modulo: 'hotel',
      estado:    'trial',
      trial_end: trialEnd.toISOString(),
    });

    return res.status(201).json({ success: true, ownerId: owner.id_owner });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/businesses — Módulos activos del owner ─────────────────────────

router.get(['/business', '/businesses'], async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerIds, error } = await resolveOwner(user);
    if (error) return res.status(400).json({ error: error.message });
    if (ownerIds.length === 0) return res.json({ needsOwnerSetup: true });

    const { data, error: modErr } = await db
      .from('business_modules')
      .select('*')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    if (modErr) return res.status(400).json({ error: modErr.message });
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /hub/businesses — Crear nuevo negocio ──────────────────────────────

import { checkPlanLimits } from '../middlewares/checkPlanLimits.js';

router.post(['/business', '/businesses'], checkPlanLimits, async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerIds, error: ownerError } = await resolveOwner(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) return res.status(400).json({ error: 'Perfil de propietario no encontrado.', needsOwnerSetup: true });

    const { tipo_modulo = 'hotel', nombre_modulo, ciudad, direccion, telefono, correo_contacto } = req.body;
    const owner_id = ownerIds[0];

    const { data: mod, error: modErr } = await db
      .from('business_modules')
      .insert({ owner_id, tipo_modulo: tipo_modulo.toLowerCase(), nombre_modulo, estado: 'activo' })
      .select('id_module')
      .single();

    if (modErr) return res.status(400).json({ error: modErr.message });

    let businessId = mod.id_module;

    if (tipo_modulo.toLowerCase() === 'hotel') {
      const { data: hotel, error: hotelErr } = await db
        .from('hoteles')
        .insert({
          id_module:       mod.id_module,
          nombre_hotel:    nombre_modulo,
          ciudad:          ciudad    ?? 'Sin definir',
          direccion:       direccion ?? 'Sin definir',
          telefono:        telefono  ?? null,
          correo_contacto: correo_contacto ?? null,
          estado:          'activo',
        })
        .select()
        .single();

      if (hotelErr) {
        await db.from('business_modules').delete().eq('id_module', mod.id_module);
        return res.status(400).json({ error: hotelErr.message });
      }
      businessId = hotel.id_hotel;
    }

    return res.status(201).json({ success: true, businessId, moduleId: mod.id_module, type: tipo_modulo, name: nombre_modulo });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/dashboard-summary ──────────────────────────────────────────────

router.get('/dashboard-summary', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerRow, ownerIds, hotelIds, error: ownerError } = await resolveOwner(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) return res.json({ needsOwnerSetup: true });

    const owner_id = ownerIds[0];

    // Módulos activos
    const { data: modules, error: modulesErr } = await db
      .from('business_modules')
      .select('id_module, tipo_modulo, nombre_modulo, estado')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    if (modulesErr) return res.status(400).json({ error: modulesErr.message });

    // Hoteles activos via business_modules (sin owner_id directo en hoteles)
    const moduleIds = (modules || []).map((m: any) => m.id_module);
    let hoteles: any[] = [];
    if (moduleIds.length > 0) {
      const { data: h } = await db
        .from('hoteles')
        .select('id_hotel, nombre_hotel, estado, id_module')
        .in('id_module', moduleIds)
        .eq('estado', 'activo');
      hoteles = h || [];
    }

    const moduleSet = new Set((modules || []).map((m: any) => m.id_module));
    const combinedModules = [
      ...(modules || []).map((m: any) => ({
        id: m.id_module,
        type: m.tipo_modulo?.toLowerCase() ?? 'hotel',
        reference_id: m.id_module,
        is_active: m.estado === 'activo',
        name: m.nombre_modulo,
      })),
      ...hoteles
        .filter((h: any) => !moduleSet.has(h.id_module))
        .map((h: any) => ({
          id: h.id_hotel,
          type: 'hotel',
          reference_id: h.id_module || h.id_hotel,
          is_active: h.estado === 'activo',
          name: h.nombre_hotel,
        })),
    ];

    // Reservas del mes — filtrar por hotel IDs (sin owner_id en reservas_hotel)
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

    let reservas: any[] = [];
    const allHotelIds = [...new Set([...hotelIds, ...hoteles.map((h: any) => h.id_hotel)])];
    if (allHotelIds.length > 0) {
      const { data: r } = await db
        .from('reservas_hotel')
        .select('id_hotel, total_reserva, estado')
        .in('id_hotel', allHotelIds)
        .gte('created_at', startOfMonth.toISOString());
      reservas = r || [];
    }

    const hotelStats = reservas.reduce((acc: any, r: any) => {
      const hid = r.id_hotel;
      if (!acc[hid]) acc[hid] = { ingresos: 0, ocupacion: 0, total_reservas: 0 };
      acc[hid].total_reservas += 1;
      if (['confirmada', 'check_in', 'check_out'].includes(r.estado)) {
        acc[hid].ingresos  += Number(r.total_reserva || 0);
        acc[hid].ocupacion += 1;
      }
      return acc;
    }, {});

    let globalIngresos = 0, globalOcupacion = 0;

    const modulesWithKpis = combinedModules.map((mod: any) => {
      const stats = hotelStats[mod.reference_id] || { ingresos: 0, ocupacion: 0, total_reservas: 0 };
      const ocPercent = stats.ocupacion > 0 ? Math.min(100, Math.round((stats.ocupacion / 30) * 100)) : 0;
      globalIngresos  += stats.ingresos;
      globalOcupacion += ocPercent;
      return { ...mod, kpis: { ingresos: stats.ingresos, ocupacion: ocPercent, tareas: 0 } };
    });

    const avgOcupacion = modulesWithKpis.length > 0 ? Math.round(globalOcupacion / modulesWithKpis.length) : 0;
    const aiRecommendation = modulesWithKpis.length === 0
      ? 'Aún no tienes negocios registrados. Añade tu primer módulo para comenzar a operar.'
      : avgOcupacion < 30
        ? `Ocupación promedio baja (${avgOcupacion}%). Considera tarifas promocionales para atraer más clientes.`
        : avgOcupacion > 80
          ? `¡Excelente ocupación del ${avgOcupacion}%! Considera incrementar tarifas temporalmente.`
          : `Ocupación estable (${avgOcupacion}%). Mantén el monitoreo diario de operaciones.`;

    return res.json({
      owner: {
        nombre: ownerRow?.nombre_empresa || user.email?.split('@')[0] || 'Usuario',
        plan:   'Profesional',
      },
      modules:          modulesWithKpis,
      kpis: {
        ingresos:         globalIngresos,
        negocios_activos: modulesWithKpis.filter((m: any) => m.is_active).length,
        ocupacion:        avgOcupacion,
        tareas:           0,
      },
      ai_recommendation: aiRecommendation,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/notifications ───────────────────────────────────────────────────

router.get('/notifications', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { hotelIds, error: ownerError } = await resolveOwner(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (hotelIds.length === 0) return res.json([]);

    const now       = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);

    const [{ data: checkins }, { data: pagosDeuda }] = await Promise.all([
      db.from('reservas_hotel')
        .select('id_reserva_hotel, check_in, estado, id_hotel, huespedes(nombre_completo)')
        .in('id_hotel', hotelIds)
        .gte('check_in', todayStart.toISOString())
        .lte('check_in', tomorrowEnd.toISOString())
        .in('estado', ['confirmada', 'pendiente'])
        .limit(20),
      db.from('reservas_hotel')
        .select('id_reserva_hotel, total_reserva, estado_pago, id_hotel, huespedes(nombre_completo)')
        .in('id_hotel', hotelIds)
        .eq('estado_pago', 'deuda')
        .in('estado', ['check_in', 'check_out', 'confirmada'])
        .limit(10),
    ]);

    const notifications: any[] = [];

    (checkins || []).forEach((r: any) => {
      const huesped    = Array.isArray(r.huespedes) ? r.huespedes[0] : r.huespedes;
      const checkInDate = new Date(r.check_in);
      const isToday    = checkInDate >= todayStart && checkInDate < new Date(todayStart.getTime() + 86400000);
      notifications.push({
        id:          `checkin-${r.id_reserva_hotel}`,
        type:        'checkin',
        title:       isToday ? 'Check-in Hoy' : 'Check-in Mañana',
        description: `${huesped?.nombre_completo || 'Huésped'} — ${checkInDate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`,
        severity:    isToday ? 'high' : 'medium',
        created_at:  r.check_in,
        reference_id: r.id_hotel,
      });
    });

    (pagosDeuda || []).forEach((r: any) => {
      const huesped = Array.isArray(r.huespedes) ? r.huespedes[0] : r.huespedes;
      notifications.push({
        id:          `deuda-${r.id_reserva_hotel}`,
        type:        'payment',
        title:       'Pago Pendiente',
        description: `${huesped?.nombre_completo || 'Huésped'} — $${Number(r.total_reserva).toLocaleString()}`,
        severity:    'high',
        created_at:  new Date().toISOString(),
        reference_id: r.id_hotel,
      });
    });

    notifications.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity as string] ?? 2) - ({ high: 0, medium: 1, low: 2 }[b.severity as string] ?? 2));

    return res.json(notifications);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/chat/channels ───────────────────────────────────────────────────

router.get('/chat/channels', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { hotelIds, error: ownerError } = await resolveOwner(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (hotelIds.length === 0) return res.json([]);

    const { data: channels, error: chErr } = await db
      .from('chat_channels')
      .select('id, name, channel_type, created_at, metadata')
      .in('id_hotel', hotelIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (chErr) return res.status(400).json({ error: chErr.message });

    const channelsWithLastMsg = await Promise.all((channels || []).map(async (ch: any) => {
      const { data: lastMsg } = await db
        .from('chat_messages')
        .select('content, sender_name, created_at')
        .eq('channel_id', ch.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { ...ch, last_message: lastMsg || null };
    }));

    return res.json(channelsWithLastMsg);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
