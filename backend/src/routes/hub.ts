import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper: extraer user desde Bearer token
async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getOwnerIdsFromRoles(user: any) {
  const { data: roles, error } = await supabaseAdmin
    .from('usuarios_roles')
    .select('owner_id')
    .eq('usuario_id', user.id)
    .eq('rol', 'PROPIETARIO')
    .eq('estado', 'activo')
    .not('owner_id', 'is', null);

  if (error) return { ownerIds: [], error };

  const ownerIds = Array.from(new Set((roles || []).map((item: any) => item.owner_id).filter(Boolean)));
  return { ownerIds, error: null };
}

async function findOwnerForUser(user: any) {
  const email = user.email?.toLowerCase() ?? '';
  const { ownerIds, error: rolesError } = await getOwnerIdsFromRoles(user);
  if (rolesError) return { ownerRow: null, ownerIds: [], error: rolesError };

  if (ownerIds.length > 0) {
    const { data: ownerRow, error } = await supabaseAdmin
      .from('owners')
      .select('id_owner, nombre_empresa, email_contacto')
      .in('id_owner', ownerIds)
      .limit(1)
      .maybeSingle();

    return { ownerRow, ownerIds, error };
  }

  const { data: ownerRow, error } = await supabaseAdmin
    .from('owners')
    .select('id_owner, nombre_empresa, email_contacto')
    .eq('email_contacto', email)
    .maybeSingle();

  return { ownerRow, ownerIds: ownerRow ? [ownerRow.id_owner] : [], error };
}

// POST - Crear perfil de propietario (primera vez / onboarding)
router.post('/owner', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { nombre_empresa, email_contacto, telefono_contacto } = req.body;
    if (!nombre_empresa?.trim() || !email_contacto?.trim()) {
      return res.status(400).json({ error: 'nombre_empresa y email_contacto son requeridos.' });
    }

    // Verificar si ya existe un owner para este user o el mismo correo
    const normalizedEmail = email_contacto.trim().toLowerCase();
    const { data: existingOwner, error: existingError } = await supabaseAdmin
      .from('owners')
      .select('id_owner, email_contacto')
      .eq('email_contacto', normalizedEmail)
      .maybeSingle();

    if (existingError) {
      return res.status(400).json({ error: existingError.message });
    }

    let finalOwnerId = existingOwner?.id_owner;

    if (existingOwner) {
      // El owner ya existe. Verificamos si este usuario YA está enlazado a él.
      const { data: checkRole } = await supabaseAdmin
        .from('usuarios_roles')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('owner_id', finalOwnerId)
        .maybeSingle();

      if (checkRole) {
        return res.status(400).json({ error: 'Ya tienes un perfil de propietario con este correo.' });
      }
      return res.status(400).json({ error: 'Esta empresa ya está registrada por otro usuario. Si eres el dueño, inicia sesión con la cuenta original.' });
    } else {
      // Crear el nuevo owner
      const { data: owner, error: ownerErr } = await supabaseAdmin
        .from('owners')
        .insert({
          nombre_empresa: nombre_empresa.trim(),
          email_contacto: normalizedEmail,
          telefono_contacto: telefono_contacto?.trim() || null,
          estado: 'activo',
        })
        .select('id_owner')
        .single();

      if (ownerErr || !owner) return res.status(400).json({ error: ownerErr?.message || 'Error al crear el perfil de propietario.' });
      finalOwnerId = owner.id_owner;

      // Iniciar 14 días de Trial solo si es un owner nuevo
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      await supabaseAdmin
        .from('suscripciones_owner')
        .insert({
          owner_id: finalOwnerId,
          id_plan: 'estandar', // Asignamos Estándar para el trial
          estado: 'trial',
          trial_end: trialEndDate.toISOString(),
        });
    }

    // Insertar el rol para enlazarlos
    const { error: roleErr } = await supabaseAdmin
      .from('usuarios_roles')
      .insert({
        usuario_id: user.id,
        owner_id: finalOwnerId,
        id_hotel: null,
        rol: 'PROPIETARIO',
        estado: 'activo',
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      });

    if (roleErr) {
      return res.status(500).json({ error: 'Perfil creado, pero no se pudo registrar el rol de propietario.' });
    }

    return res.status(201).json({ success: true, ownerId: finalOwnerId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET - Listar módulos del usuario autenticado
router.get(['/business', '/businesses'], async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerRow, ownerIds, error: ownerError } = await findOwnerForUser(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) {
      return res.status(200).json({ needsOwnerSetup: true });
    }

    const { data, error } = await supabaseAdmin
      .from('business_modules')
      .select('*')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { checkPlanLimits } from '../middlewares/checkPlanLimits.js';

// POST - Crear nuevo negocio genérico
router.post(['/business', '/businesses'], checkPlanLimits, async (req, res) => {
  try {
    const {
      tipo_modulo = 'hotel',
      nombre_modulo,
      ciudad,
      direccion,
      telefono,
      correo_contacto,
    } = req.body;

    const normalizedType = (tipo_modulo || 'hotel').toLowerCase();
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerRow, ownerIds, error: ownerError } = await findOwnerForUser(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) {
      return res.status(400).json({
        error: 'Perfil de propietario no encontrado. Completa el setup primero.',
        needsOwnerSetup: true,
      });
    }

    const owner_id = ownerIds[0];

    const { data: mod, error: modErr } = await supabaseAdmin
      .from('business_modules')
      .insert({ owner_id, tipo_modulo: normalizedType, nombre_modulo, estado: 'activo' })
      .select('id_module')
      .single();

    if (modErr) return res.status(400).json({ error: modErr.message });

    let businessId = mod.id_module;

    if (normalizedType === 'hotel') {
      const { data: hotel, error: hotelErr } = await supabaseAdmin
        .from('hoteles')
        .insert({
          nombre_hotel: nombre_modulo,
          ciudad: ciudad ?? null,
          owner_id,
          id_module: mod.id_module,
          estado: 'activo',
          direccion: direccion ?? null,
          telefono: telefono ?? null,
          correo_contacto: correo_contacto ?? null,
        })
        .select()
        .single();

      if (hotelErr) {
        await supabaseAdmin.from('business_modules').delete().eq('id_module', mod.id_module);
        return res.status(400).json({ error: hotelErr.message });
      }

      businessId = hotel.id_hotel;
    }

    res.status(201).json({ success: true, businessId, moduleId: mod.id_module, type: normalizedType, name: nombre_modulo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Resumen del dashboard (KPIs + hoteles del owner)
router.get('/dashboard-summary', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    // Verificar si tiene perfil owner usando roles y/o contacto de owner
    const { ownerRow, ownerIds, error: ownerError } = await findOwnerForUser(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) {
      // Primera vez — sin perfil owner, el frontend redirige a /setup-owner
      return res.json({ needsOwnerSetup: true });
    }

    const owner_id = ownerIds[0];

    // Obtener módulos activos del owner
    const { data: modules, error: modulesErr } = await supabaseAdmin
      .from('business_modules')
      .select('id_module, tipo_modulo, nombre_modulo, estado')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    if (modulesErr) return res.status(400).json({ error: modulesErr.message });

    const { data: hoteles, error: hotelesErr } = await supabaseAdmin
      .from('hoteles')
      .select('id_hotel, nombre_hotel, estado, id_module')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    if (hotelesErr) {
      return res.status(400).json({ error: hotelesErr.message });
    }

    const moduleIds = new Set((modules || []).map((m: any) => m.id_module));
    const hotelFallbacks = (hoteles || [])
      .filter((hotel: any) => !hotel.id_module || !moduleIds.has(hotel.id_module))
      .map((hotel: any) => ({
        id: hotel.id_hotel,
        type: 'hotel',
        reference_id: hotel.id_module || hotel.id_hotel,
        is_active: hotel.estado === 'activo',
        name: hotel.nombre_hotel,
      }));

    let combinedModules = [
      ...(modules || []).map((m: any) => ({
        id: m.id_module,
        type: m.tipo_modulo?.toLowerCase() ?? 'hotel',
        reference_id: m.id_module,
        is_active: m.estado === 'activo',
        name: m.nombre_modulo,
      })),
      ...hotelFallbacks,
    ];

    // Fetch metricas reales de hoteles (reservas de este mes)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: reservas } = await supabaseAdmin
      .from('reservas_hotel')
      .select('id_hotel, total_reserva, estado, check_in')
      .in('owner_id', ownerIds)
      .gte('created_at', startOfMonth.toISOString());

    // Agrupar por id_hotel (o reference_id)
    const hotelStats = (reservas || []).reduce((acc: any, res: any) => {
      const hid = res.id_hotel;
      if (!acc[hid]) acc[hid] = { ingresos: 0, ocupacion: 0, total_reservas: 0 };
      acc[hid].total_reservas += 1;
      if (res.estado === 'confirmada' || res.estado === 'check_in' || res.estado === 'check_out') {
        acc[hid].ingresos += Number(res.total_reserva || 0);
        acc[hid].ocupacion += 1; // Simplificación por ahora
      }
      return acc;
    }, {});

    let globalIngresos = 0;
    let globalOcupacion = 0;
    let globalTareas = 0;

    combinedModules = combinedModules.map((mod: any) => {
      const stats = hotelStats[mod.reference_id] || { ingresos: 0, ocupacion: 0, total_reservas: 0 };
      
      // Simulación de ocupación porcentual basada en cantidad de reservas si no hay dato real de capacidad
      const ocPercent = stats.ocupacion > 0 ? Math.min(100, Math.round((stats.ocupacion / 30) * 100)) : 0;
      
      globalIngresos += stats.ingresos;
      globalOcupacion += ocPercent;
      
      return {
        ...mod,
        kpis: {
          ingresos: stats.ingresos,
          ocupacion: ocPercent,
          tareas: 0 // TODO: Conectar a sistema de tareas cuando exista
        }
      };
    });

    const avgOcupacion = combinedModules.length > 0 ? Math.round(globalOcupacion / combinedModules.length) : 0;

    let aiRecommendation = '';
    if (combinedModules.length === 0) {
      aiRecommendation = 'Aún no tienes negocios registrados. Te sugerimos añadir tu primer módulo (Hotel, Gym o Restaurante) para comenzar a operar y ver métricas reales.';
    } else if (avgOcupacion < 30) {
      aiRecommendation = `Hemos detectado una ocupación promedio baja del ${avgOcupacion}%. Te sugerimos crear tarifas promocionales o descuentos especiales para atraer más clientes este fin de semana.`;
    } else if (avgOcupacion > 80) {
      aiRecommendation = `¡Excelente! Tienes una alta ocupación promedio del ${avgOcupacion}%. Sugerimos habilitar la estrategia de sobreventa dinámica o revisar si puedes incrementar tus tarifas temporalmente.`;
    } else {
      aiRecommendation = `Tu ocupación actual es estable (${avgOcupacion}%). Mantén el monitoreo de tus operaciones diarias y asegúrate de ofrecer un buen servicio a tus clientes actuales.`;
    }

    return res.json({
      owner: {
        nombre: ownerRow.nombre_empresa || user.email?.split('@')[0] || 'Usuario',
        plan: 'Profesional',
      },
      modules: combinedModules,
      kpis: {
        ingresos: globalIngresos,
        negocios_activos: combinedModules.filter(m => m.is_active).length,
        ocupacion: avgOcupacion,
        tareas: globalTareas,
      },
      ai_recommendation: aiRecommendation,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Centro de Notificaciones: check-ins hoy/mañana, pagos en deuda
router.get('/notifications', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerIds, error: ownerError } = await findOwnerForUser(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) return res.json([]);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Check-ins de hoy y mañana
    const { data: checkins } = await supabaseAdmin
      .from('reservas_hotel')
      .select('id_reserva_hotel, check_in, estado, id_hotel, huespedes(nombre_completo)')
      .in('owner_id', ownerIds)
      .gte('check_in', todayStart.toISOString())
      .lte('check_in', tomorrowEnd.toISOString())
      .in('estado', ['confirmada', 'pendiente'])
      .limit(20);

    // Reservas con deuda (estado_pago = deuda)
    const { data: pagosDeuda } = await supabaseAdmin
      .from('reservas_hotel')
      .select('id_reserva_hotel, total_reserva, estado_pago, id_hotel, huespedes(nombre_completo)')
      .in('owner_id', ownerIds)
      .eq('estado_pago', 'deuda')
      .in('estado', ['check_in', 'check_out', 'confirmada'])
      .limit(10);

    const notifications: any[] = [];

    (checkins || []).forEach((r: any) => {
      const huesped = Array.isArray(r.huespedes) ? r.huespedes[0] : r.huespedes;
      const checkInDate = new Date(r.check_in);
      const isToday = checkInDate >= todayStart && checkInDate <= new Date(todayStart.getTime() + 86400000 - 1);
      notifications.push({
        id: `checkin-${r.id_reserva_hotel}`,
        type: 'checkin',
        title: isToday ? 'Check-in Hoy' : 'Check-in Mañana',
        description: `${huesped?.nombre_completo || 'Huésped'} — ${checkInDate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`,
        severity: isToday ? 'high' : 'medium',
        created_at: r.check_in,
        reference_id: r.id_hotel,
      });
    });

    (pagosDeuda || []).forEach((r: any) => {
      const huesped = Array.isArray(r.huespedes) ? r.huespedes[0] : r.huespedes;
      notifications.push({
        id: `deuda-${r.id_reserva_hotel}`,
        type: 'payment',
        title: 'Pago Pendiente',
        description: `${huesped?.nombre_completo || 'Huésped'} — $${Number(r.total_reserva).toLocaleString()}`,
        severity: 'high',
        created_at: new Date().toISOString(),
        reference_id: r.id_hotel,
      });
    });

    // Ordenar por severidad y fecha
    notifications.sort((a, b) => {
      const sevOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2);
    });

    res.json(notifications);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Chat del Hub: últimos mensajes de cada canal del owner
router.get('/chat/channels', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerIds, error: ownerError } = await findOwnerForUser(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) return res.json([]);

    const { data: channels, error: chErr } = await supabaseAdmin
      .from('chat_channels')
      .select('id, name, channel_type, created_at, metadata')
      .in('owner_id', ownerIds)
      .order('created_at', { ascending: false })
      .limit(20);

    if (chErr) return res.status(400).json({ error: chErr.message });

    // Para cada canal, traer el último mensaje
    const channelsWithLastMsg = await Promise.all((channels || []).map(async (ch: any) => {
      const { data: lastMsg } = await supabaseAdmin
        .from('chat_messages')
        .select('content, sender_name, created_at')
        .eq('channel_id', ch.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { ...ch, last_message: lastMsg || null };
    }));

    res.json(channelsWithLastMsg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
