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

// ─── Seed de habitaciones base al crear un hotel ─────────────────────────────

async function seedHotelDefaults(hotelId: string) {
  // 3 tipos de habitación
  const tiposData = [
    { nombre_tipo: 'Estándar',  descripcion: 'Habitación estándar con cama doble',     capacidad_base: 2 },
    { nombre_tipo: 'Doble',     descripcion: 'Habitación doble con dos camas individuales', capacidad_base: 2 },
    { nombre_tipo: 'Suite',     descripcion: 'Suite con área de sala y vistas al exterior', capacidad_base: 4 },
  ];

  const { data: tipos, error: tipoErr } = await db
    .from('tipos_habitacion')
    .insert(tiposData.map(t => ({ ...t, id_hotel: hotelId, estado: 'activo' })))
    .select('id_tipo_habitacion, nombre_tipo, capacidad_base');

  if (tipoErr || !tipos) return;

  // 3 categorías de tarifa
  const categoriasData = [
    { nombre: 'Regular',         descripcion: 'Tarifa entre semana' },
    { nombre: 'Fines de Semana', descripcion: 'Tarifa viernes, sábado y domingo' },
    { nombre: 'Temporada Alta',  descripcion: 'Tarifa en temporada alta y feriados' },
  ];

  const { data: categorias, error: catErr } = await db
    .from('categorias_tarifa')
    .insert(categoriasData.map(c => ({ ...c, id_hotel: hotelId, activa: true })))
    .select('id_categoria, nombre');

  if (catErr || !categorias) return;

  // Precios base por tipo (Regular / Fines de Semana / Temporada Alta)
  const precios: Record<string, [number, number, number]> = {
    'Estándar': [60,  80,  100],
    'Doble':    [90,  115, 140],
    'Suite':    [150, 190, 240],
  };

  const tarifasRows: any[] = [];
  for (const tipo of tipos) {
    const [precReg, precFds, precTA] = precios[tipo.nombre_tipo] ?? [60, 80, 100];
    for (const [i, cat] of categorias.entries()) {
      const tarifa_noche = i === 0 ? precReg : i === 1 ? precFds : precTA;
      tarifasRows.push({
        id_tipo_habitacion: tipo.id_tipo_habitacion,
        id_categoria:       cat.id_categoria,
        tarifa_noche,
        tarifa_hora:    parseFloat((tarifa_noche / 6).toFixed(2)),
        tarifa_pasadia: parseFloat((tarifa_noche * 0.6).toFixed(2)),
        activa:         true,
      });
    }
  }

  const { data: tarifas, error: tarErr } = await db
    .from('tarifas')
    .insert(tarifasRows)
    .select('id_tarifa, id_tipo_habitacion, id_categoria');

  if (tarErr || !tarifas) return;

  // id_categoria Regular para obtener la tarifa default
  const catRegularId = categorias.find(c => c.nombre === 'Regular')?.id_categoria ?? categorias[0].id_categoria;

  // Mapa tipo → tarifa Regular
  const tarifaDefaultByTipo: Record<string, string> = {};
  for (const t of tarifas) {
    if (t.id_categoria === catRegularId) {
      tarifaDefaultByTipo[t.id_tipo_habitacion] = t.id_tarifa;
    }
  }

  // 6 habitaciones — 2 por tipo
  const habitacionesRows: any[] = [];
  const pisoByTipo: Record<string, number> = {};
  tipos.forEach((t, i) => { pisoByTipo[t.id_tipo_habitacion] = i + 1; });

  let numBase: Record<string, number> = {};
  tipos.forEach((t, i) => { numBase[t.id_tipo_habitacion] = (i + 1) * 100; });

  for (const tipo of tipos) {
    const piso = pisoByTipo[tipo.id_tipo_habitacion];
    const base = numBase[tipo.id_tipo_habitacion];
    const tarifaId = tarifaDefaultByTipo[tipo.id_tipo_habitacion] ?? null;

    // Buscar la tarifa_noche Regular para precargarla en la habitación
    const tarifaNoche = tarifasRows.find(
      r => r.id_tipo_habitacion === tipo.id_tipo_habitacion && r.id_categoria === catRegularId
    )?.tarifa_noche ?? 0;

    for (let n = 1; n <= 2; n++) {
      const codigo = `${base + n}`;
      habitacionesRows.push({
        id_hotel:           hotelId,
        id_tipo_habitacion: tipo.id_tipo_habitacion,
        id_tarifa_default:  tarifaId,
        codigo_habitacion:  codigo,
        nombre_habitacion:  `Habitación ${codigo}`,
        piso,
        capacidad:          tipo.capacidad_base,
        numero_camas:       tipo.capacidad_base <= 2 ? 1 : 2,
        tarifa_noche:       tarifaNoche,
        estado:             'disponible',
      });
    }
  }

  await db.from('habitaciones').insert(habitacionesRows);

  // Canales de chat por defecto para el hotel
  const chatChannelsRows = [
    { id_hotel: hotelId, name: 'General', description: 'Canal general de comunicación del hotel', channel_type: 'general' },
    { id_hotel: hotelId, name: 'Operativo', description: 'Coordinación operativa interna', channel_type: 'operativo' }
  ];
  await db.from('chat_channels').insert(chatChannelsRows);
}

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
    let hotelSlug: string | null = null;

    if (tipo_modulo.toLowerCase() === 'hotel') {
      // Generar slug único a partir del nombre
      const baseSlug = nombre_modulo
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');

      hotelSlug = baseSlug;
      let attempt = 1;
      while (true) {
        const { data: existing } = await db.from('hoteles').select('id_hotel').eq('slug', hotelSlug).maybeSingle();
        if (!existing) break;
        attempt++;
        hotelSlug = `${baseSlug}-${attempt}`;
      }

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
          slug:            hotelSlug,
        })
        .select()
        .single();

      if (hotelErr) {
        await db.from('business_modules').delete().eq('id_module', mod.id_module);
        return res.status(400).json({ error: hotelErr.message });
      }
      businessId = hotel.id_hotel;

      // Seed: 3 tipos, 3 categorías de tarifa, 9 tarifas, 6 habitaciones base
      void seedHotelDefaults(hotel.id_hotel);
    }

    if (tipo_modulo.toLowerCase() === 'gym') {
      const { data: gym, error: gymErr } = await db
        .from('gimnasios')
        .insert({
          id_module:       mod.id_module,
          nombre_gimnasio: nombre_modulo,
          ciudad:          ciudad    ?? 'Sin definir',
          direccion:       direccion ?? 'Sin definir',
          telefono:        telefono  ?? null,
          correo_contacto: correo_contacto ?? null,
          estado:          'activo',
        })
        .select('id_gimnasio')
        .single();

      if (gymErr) {
        await db.from('business_modules').delete().eq('id_module', mod.id_module);
        return res.status(400).json({ error: gymErr.message });
      }
      businessId = gym.id_gimnasio;
    }

    if (tipo_modulo.toLowerCase() === 'restaurant') {
      const { data: rest, error: restErr } = await db
        .from('restaurant')
        .insert({
          id_owner:           owner_id,
          id_module:          mod.id_module,
          nombre_restaurante: nombre_modulo,
          ciudad:             ciudad     ?? 'Sin definir',
          direccion:          direccion  ?? 'Sin definir',
          telefono:           telefono   ?? null,
          correo:             correo_contacto ?? null,
          activo:             true,
        })
        .select('id_restaurant')
        .single();

      if (restErr) {
        await db.from('business_modules').delete().eq('id_module', mod.id_module);
        return res.status(400).json({ error: restErr.message });
      }
      businessId = rest.id_restaurant;
    }

    return res.status(201).json({ success: true, businessId, moduleId: mod.id_module, type: tipo_modulo, name: nombre_modulo, slug: hotelSlug });
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

    // Módulos activos
    const { data: modules, error: modulesErr } = await db
      .from('business_modules')
      .select('id_module, tipo_modulo, nombre_modulo, estado')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    if (modulesErr) return res.status(400).json({ error: modulesErr.message });

    const moduleIds = (modules || []).map((m: any) => m.id_module);

    // ── HOTELES ──
    let hoteles: any[] = [];
    if (moduleIds.length > 0) {
      const { data: h } = await db
        .from('hoteles')
        .select('id_hotel, nombre_hotel, estado, id_module, slug')
        .in('id_module', moduleIds)
        .eq('estado', 'activo');
      hoteles = h || [];
    }

    const toSlug = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    for (const hotel of hoteles) {
      if (!hotel.slug) {
        const base = toSlug(hotel.nombre_hotel) || `hotel-${hotel.id_hotel.slice(0, 8)}`;
        let candidato = base;
        let intento = 1;
        while (true) {
          const { data: existing } = await db.from('hoteles').select('id_hotel').eq('slug', candidato).maybeSingle();
          if (!existing) break;
          intento++;
          candidato = `${base}-${intento}`;
        }
        await db.from('hoteles').update({ slug: candidato }).eq('id_hotel', hotel.id_hotel);
        hotel.slug = candidato;
      }
    }

    // ── GIMNASIOS ──
    let gimnasios: any[] = [];
    if (moduleIds.length > 0) {
      const { data: g } = await db
        .from('gimnasios')
        .select('id_gimnasio, nombre_gimnasio, estado, id_module')
        .in('id_module', moduleIds)
        .eq('estado', 'activo');
      gimnasios = g || [];
    }

    // ── RESTAURANTES ──
    let restaurantes: any[] = [];
    if (moduleIds.length > 0) {
      const { data: r } = await db
        .from('restaurant')
        .select('id_restaurant, nombre_restaurante, activo, id_module')
        .in('id_module', moduleIds)
        .eq('activo', true);
      restaurantes = r || [];
    }

    // Mapas para encontrar el module_id desde el ID específico
    const moduleIdByHotel: Record<string, string> = {};
    const hotelIdByModule: Record<string, string> = {};
    const slugByModule: Record<string, string> = {};
    hoteles.forEach((h: any) => { 
      if (h.id_module) {
        moduleIdByHotel[h.id_hotel] = h.id_module;
        hotelIdByModule[h.id_module] = h.id_hotel;
        slugByModule[h.id_module] = h.slug;
      }
    });

    const moduleIdByGym: Record<string, string> = {};
    gimnasios.forEach((g: any) => {
      if (g.id_module) moduleIdByGym[g.id_gimnasio] = g.id_module;
    });

    const moduleIdByRest: Record<string, string> = {};
    restaurantes.forEach((r: any) => {
      if (r.id_module) moduleIdByRest[r.id_restaurant] = r.id_module;
    });

    const combinedModules = (modules || []).map((m: any) => ({
      id: m.id_module,
      type: m.tipo_modulo?.toLowerCase() ?? 'hotel',
      reference_id: m.id_module,
      is_active: m.estado === 'activo',
      name: m.nombre_modulo,
      slug: slugByModule[m.id_module] ?? null,
      hotel_id: hotelIdByModule[m.id_module] ?? null,
    }));

    // Fechas para métricas del mes
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const startIso = startOfMonth.toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();
    const tomorrowEnd = new Date(todayStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);
    const tomorrowIso = tomorrowEnd.toISOString();

    const statsByModule: Record<string, { ingresos: number, ocupacion: number, total_reservas: number, tareas: number }> = {};
    moduleIds.forEach((id: string) => {
      statsByModule[id] = { ingresos: 0, ocupacion: 0, total_reservas: 0, tareas: 0 };
    });

    // ── MÉTRICAS HOTELES ──
    const allHotelIds = hoteles.map((h: any) => h.id_hotel);
    if (allHotelIds.length > 0) {
      // Total de habitaciones por hotel (para calcular ocupación real)
      const { data: habsData } = await db
        .from('habitaciones')
        .select('id_hotel, estado')
        .in('id_hotel', allHotelIds);

      const totalHabsByHotel: Record<string, number> = {};
      const occupiedHabsByHotel: Record<string, number> = {};
      (habsData || []).forEach((h: any) => {
        if (!totalHabsByHotel[h.id_hotel]) totalHabsByHotel[h.id_hotel] = 0;
        totalHabsByHotel[h.id_hotel] += 1;
        // Habitaciones ocupadas = estado 'ocupada'
        if (h.estado === 'ocupada') {
          if (!occupiedHabsByHotel[h.id_hotel]) occupiedHabsByHotel[h.id_hotel] = 0;
          occupiedHabsByHotel[h.id_hotel] += 1;
        }
      });

      // Ingresos reales del mes - usar pagos_hotel y inner join a reservas_hotel para filtrar por hotel
      const { data: pagos } = await db
        .from('pagos_hotel')
        .select('monto, reservas_hotel!inner(id_hotel)')
        .in('reservas_hotel.id_hotel', allHotelIds)
        .gte('fecha_pago', startIso)
        .in('estado', ['registrado', 'aplicado']);

      (pagos || []).forEach((p: any) => {
        const hotelId = p.reservas_hotel?.id_hotel;
        const idModule = moduleIdByHotel[hotelId];
        if (idModule && statsByModule[idModule]) {
          statsByModule[idModule].ingresos += Number(p.monto || 0);
        }
      });

      // Calcular ocupación real: habitaciones ocupadas / total habitaciones
      hoteles.forEach((hotel: any) => {
        const idModule = moduleIdByHotel[hotel.id_hotel];
        if (idModule && statsByModule[idModule]) {
          const total = totalHabsByHotel[hotel.id_hotel] || 0;
          const occupied = occupiedHabsByHotel[hotel.id_hotel] || 0;
          // Guardamos total y ocupadas para calcular % después
          statsByModule[idModule].ocupacion = total > 0 ? Math.round((occupied / total) * 100) : 0;
        }
      });

      // Alertas de checkins
      const { data: res } = await db
        .from('reservas_hotel')
        .select('id_hotel, estado, estado_pago, check_in')
        .in('id_hotel', allHotelIds)
        .gte('check_in', startIso);

      (res || []).forEach((r: any) => {
        const idModule = moduleIdByHotel[r.id_hotel];
        if (idModule && statsByModule[idModule]) {
          // Tareas (checkins próximos o deudas)
          const isCheckinNear = (new Date(r.check_in) >= todayStart && new Date(r.check_in) <= tomorrowEnd && ['confirmada','pendiente'].includes(r.estado));
          const isDeuda = (r.estado_pago === 'deuda' && ['check_in','check_out','confirmada'].includes(r.estado));
          if (isCheckinNear || isDeuda) {
            statsByModule[idModule].tareas += 1;
          }
        }
      });
    }

    // ── MÉTRICAS GIMNASIOS ──
    const allGymIds = gimnasios.map((g: any) => g.id_gimnasio);
    if (allGymIds.length > 0) {
      // Ingresos reales (pagos_gym del mes)
      const { data: pagosG } = await db
        .from('pagos_gym')
        .select('monto, inscripciones_gym!inner(id_gimnasio)')
        .in('inscripciones_gym.id_gimnasio', allGymIds)
        .gte('fecha_pago', startIso)
        .in('estado', ['registrado', 'aplicado']);

      (pagosG || []).forEach((p: any) => {
        const idModule = moduleIdByGym[p.inscripciones_gym.id_gimnasio];
        if (idModule && statsByModule[idModule]) {
          statsByModule[idModule].ingresos += Number(p.monto || 0);
        }
      });

      // Ocupación y alertas (inscripciones activas y deudas)
      const { data: ins } = await db
        .from('inscripciones_gym')
        .select('id_gimnasio, estado, estado_pago, fecha_fin')
        .in('id_gimnasio', allGymIds);

      (ins || []).forEach((i: any) => {
        const idModule = moduleIdByGym[i.id_gimnasio];
        if (idModule && statsByModule[idModule]) {
          if (i.estado === 'activa') {
            statsByModule[idModule].ocupacion += 1; // Miembros activos
          }
          // Tareas (deudas o vencimientos cercanos)
          const isVencimientoNear = (new Date(i.fecha_fin) >= todayStart && new Date(i.fecha_fin) <= tomorrowEnd && i.estado === 'activa');
          if (i.estado_pago === 'deuda' || isVencimientoNear) {
            statsByModule[idModule].tareas += 1;
          }
        }
      });
    }

    // ── MÉTRICAS RESTAURANTES ──
    const allRestIds = restaurantes.map((r: any) => r.id_restaurant);
    if (allRestIds.length > 0) {
      // Ingresos del mes: facturas_restaurante
      const { data: facturas } = await db
        .from('factura_restaurante')
        .select('total, id_restaurant')
        .in('id_restaurant', allRestIds)
        .gte('fecha', startIso);

      (facturas || []).forEach((f: any) => {
        const idModule = moduleIdByRest[f.id_restaurant];
        if (idModule && statsByModule[idModule]) {
          statsByModule[idModule].ingresos += Number(f.total || 0);
        }
      });

      // Ocupación: mesas ocupadas vs total
      const { data: mesas } = await db
        .from('mesa_restaurante')
        .select('id_restaurant, estado')
        .in('id_restaurant', allRestIds);

      const mesasTotalesByRest: Record<string, number> = {};
      const mesasOcupadasByRest: Record<string, number> = {};
      (mesas || []).forEach((m: any) => {
        mesasTotalesByRest[m.id_restaurant] = (mesasTotalesByRest[m.id_restaurant] || 0) + 1;
        if (m.estado === 'ocupada') {
          mesasOcupadasByRest[m.id_restaurant] = (mesasOcupadasByRest[m.id_restaurant] || 0) + 1;
        }
      });

      restaurantes.forEach((r: any) => {
        const idModule = moduleIdByRest[r.id_restaurant];
        if (idModule && statsByModule[idModule]) {
          const total = mesasTotalesByRest[r.id_restaurant] || 0;
          const ocupadas = mesasOcupadasByRest[r.id_restaurant] || 0;
          statsByModule[idModule].ocupacion = total > 0 ? Math.round((ocupadas / total) * 100) : 0;
        }
      });

      // Tareas: pedidos pendientes
      const { data: pedidos } = await db
        .from('pedido_restaurante')
        .select('id_restaurant, estado_pedido')
        .in('id_restaurant', allRestIds)
        .in('estado_pedido', ['pendiente', 'preparando']);

      (pedidos || []).forEach((p: any) => {
        const idModule = moduleIdByRest[p.id_restaurant];
        if (idModule && statsByModule[idModule]) {
          statsByModule[idModule].tareas += 1;
        }
      });
    }

    let globalIngresos = 0, globalOcupacion = 0;

    const modulesWithKpis = combinedModules.map((mod: any) => {
      const stats = statsByModule[mod.reference_id] || { ingresos: 0, ocupacion: 0, total_reservas: 0, tareas: 0 };
      
      // Ocupación relativa
      let ocPercent = 0;
      if (mod.type === 'hotel') {
         ocPercent = stats.ocupacion; // Ya viene como % (hab_ocupadas / total_habs * 100)
      } else if (mod.type === 'gym') {
         ocPercent = stats.ocupacion > 0 ? Math.min(100, Math.round((stats.ocupacion / 50) * 100)) : 0; // max ~50 activos
      } else if (mod.type === 'restaurant') {
        ocPercent = stats.ocupacion; // ya viene como % de mesas ocupadas
      }

      globalIngresos  += stats.ingresos;
      globalOcupacion += ocPercent;

      return { 
        ...mod, 
        kpis: { 
          ingresos: stats.ingresos, 
          ocupacion: ocPercent, 
          tareas: stats.tareas 
        } 
      };
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
        tareas:           modulesWithKpis.reduce((sum: number, m: any) => sum + m.kpis.tareas, 0),
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

    const { ownerIds, hotelIds, error: ownerError } = await resolveOwner(user);
    if (ownerError) return res.status(400).json({ error: ownerError.message });
    if (ownerIds.length === 0) return res.json([]);

    const now         = new Date();
    const todayStart  = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);
    const in7Days     = new Date(now); in7Days.setDate(in7Days.getDate() + 7);

    // Obtener módulos activos del owner para sacar gym y restaurant IDs
    const { data: mods } = await db
      .from('business_modules')
      .select('id_module, tipo_modulo')
      .in('owner_id', ownerIds)
      .eq('estado', 'activo');

    const moduleIds = (mods || []).map((m: any) => m.id_module);

    let gymIds: string[]  = [];
    let restIds: string[] = [];

    if (moduleIds.length > 0) {
      const [{ data: gyms }, { data: rests }] = await Promise.all([
        db.from('gimnasios').select('id_gimnasio').in('id_module', moduleIds).eq('estado', 'activo'),
        db.from('restaurant').select('id_restaurant').in('id_module', moduleIds).eq('activo', true),
      ]);
      gymIds  = (gyms  || []).map((g: any) => g.id_gimnasio);
      restIds = (rests || []).map((r: any) => r.id_restaurant);
    }

    // Consultas en paralelo para los tres módulos
    const queries: Promise<any>[] = [
      // Hotel — check-ins de hoy y mañana
      hotelIds.length > 0
        ? db.from('reservas_hotel')
            .select('id_reserva_hotel, check_in, estado, id_hotel, huespedes(nombre_completo)')
            .in('id_hotel', hotelIds)
            .gte('check_in', todayStart.toISOString())
            .lte('check_in', tomorrowEnd.toISOString())
            .in('estado', ['confirmada', 'pendiente'])
            .limit(20)
        : Promise.resolve({ data: [] }),
      // Hotel — pagos con deuda
      hotelIds.length > 0
        ? db.from('reservas_hotel')
            .select('id_reserva_hotel, total_reserva, estado_pago, id_hotel, huespedes(nombre_completo)')
            .in('id_hotel', hotelIds)
            .eq('estado_pago', 'deuda')
            .in('estado', ['check_in', 'check_out', 'confirmada'])
            .limit(10)
        : Promise.resolve({ data: [] }),
      // Gym — solicitudes del portal pendientes de activar
      gymIds.length > 0
        ? db.from('miembros')
            .select('id_miembro, nombre, apellido, observaciones, id_gimnasio')
            .in('id_gimnasio', gymIds)
            .eq('estado', 'inactivo')
            .ilike('observaciones', 'Plan solicitado:%')
            .limit(20)
        : Promise.resolve({ data: [] }),
      // Gym — inscripciones activas por vencer en 7 días
      gymIds.length > 0
        ? db.from('inscripciones_gym')
            .select('id_inscripcion, fecha_fin, id_gimnasio, miembros(nombre, apellido)')
            .in('id_gimnasio', gymIds)
            .eq('estado', 'activa')
            .gte('fecha_fin', now.toISOString())
            .lte('fecha_fin', in7Days.toISOString())
            .limit(20)
        : Promise.resolve({ data: [] }),
      // Restaurante — reservas pendientes de hoy y mañana
      restIds.length > 0
        ? db.from('reserva')
            .select('id_reserva, fecha_reserva, hora_reserva, cantidad_personas, id_restaurant, clientes(nombre)')
            .in('id_restaurant', restIds)
            .eq('estado', 'pendiente')
            .gte('fecha_reserva', todayStart.toISOString().split('T')[0])
            .lte('fecha_reserva', tomorrowEnd.toISOString().split('T')[0])
            .limit(20)
        : Promise.resolve({ data: [] }),
    ];

    const [
      { data: checkins },
      { data: pagosDeuda },
      { data: solicitudesGym },
      { data: inscripcionesPorVencer },
      { data: reservasRest },
    ] = await Promise.all(queries);

    const notifications: any[] = [];

    // ── Hotel: check-ins ──
    (checkins || []).forEach((r: any) => {
      const huesped     = Array.isArray(r.huespedes) ? r.huespedes[0] : r.huespedes;
      const checkInDate = new Date(r.check_in);
      const isToday     = checkInDate >= todayStart && checkInDate < new Date(todayStart.getTime() + 86400000);
      notifications.push({
        id:           `checkin-${r.id_reserva_hotel}`,
        type:         'checkin',
        module:       'hotel',
        title:        isToday ? 'Check-in Hoy' : 'Check-in Mañana',
        description:  `${huesped?.nombre_completo || 'Huésped'} — ${checkInDate.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`,
        severity:     isToday ? 'high' : 'medium',
        created_at:   r.check_in,
        reference_id: r.id_hotel,
      });
    });

    // ── Hotel: pagos con deuda ──
    (pagosDeuda || []).forEach((r: any) => {
      const huesped = Array.isArray(r.huespedes) ? r.huespedes[0] : r.huespedes;
      notifications.push({
        id:           `deuda-${r.id_reserva_hotel}`,
        type:         'payment',
        module:       'hotel',
        title:        'Pago Pendiente — Hotel',
        description:  `${huesped?.nombre_completo || 'Huésped'} — L. ${Number(r.total_reserva).toLocaleString()}`,
        severity:     'high',
        created_at:   new Date().toISOString(),
        reference_id: r.id_hotel,
      });
    });

    // ── Gym: solicitudes del portal ──
    (solicitudesGym || []).forEach((m: any) => {
      const plan = (m.observaciones as string).replace('Plan solicitado: ', '');
      notifications.push({
        id:           `gym-solicitud-${m.id_miembro}`,
        type:         'gym_request',
        module:       'gym',
        title:        'Solicitud Portal — Gym',
        description:  `${m.nombre} ${m.apellido} — ${plan}`,
        severity:     'high',
        created_at:   new Date().toISOString(),
        reference_id: m.id_gimnasio,
      });
    });

    // ── Gym: inscripciones por vencer ──
    (inscripcionesPorVencer || []).forEach((i: any) => {
      const miembro  = Array.isArray(i.miembros) ? i.miembros[0] : i.miembros;
      const diasLeft = Math.ceil((new Date(i.fecha_fin).getTime() - now.getTime()) / 86400000);
      notifications.push({
        id:           `gym-vence-${i.id_inscripcion}`,
        type:         'gym_expiry',
        module:       'gym',
        title:        'Membresía por Vencer',
        description:  `${miembro?.nombre || ''} ${miembro?.apellido || ''} — vence en ${diasLeft} día${diasLeft !== 1 ? 's' : ''}`,
        severity:     diasLeft <= 2 ? 'high' : 'medium',
        created_at:   new Date().toISOString(),
        reference_id: i.id_gimnasio,
      });
    });

    // ── Restaurante: reservas pendientes ──
    (reservasRest || []).forEach((r: any) => {
      const cliente  = Array.isArray(r.clientes) ? r.clientes[0] : r.clientes;
      const fecha    = new Date(`${r.fecha_reserva}T${r.hora_reserva}`);
      const isToday  = r.fecha_reserva === todayStart.toISOString().split('T')[0];
      notifications.push({
        id:           `rest-reserva-${r.id_reserva}`,
        type:         'checkin',
        module:       'restaurant',
        title:        isToday ? 'Reserva Hoy — Restaurante' : 'Reserva Mañana — Restaurante',
        description:  `${cliente?.nombre || 'Cliente'} — ${fecha.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}, ${r.cantidad_personas} persona${r.cantidad_personas !== 1 ? 's' : ''}`,
        severity:     isToday ? 'high' : 'medium',
        created_at:   new Date().toISOString(),
        reference_id: r.id_restaurant,
      });
    });

    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    notifications.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

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

// ─── MCP TOKENS MANAGEMENT ───────────────────────────────────────────────────

/**
 * GET /hub/mcp/tokens
 * Lista los tokens MCP activos del usuario propietario
 */
router.get('/mcp/tokens', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { data, error } = await db
      .from('user_tokens')
      .select('id, api_token, token_expires, created_at, last_used_at, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    // Enmascarar tokens para seguridad antes de enviarlos (solo mostrar los primeros 4 y últimos 4)
    const masked = (data || []).map((t: any) => ({
      ...t,
      api_token: t.api_token ? `${t.api_token.slice(0, 4)}...${t.api_token.slice(-4)}` : ''
    }));

    return res.json(masked);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /hub/mcp/token
 * Genera un nuevo token MCP para el propietario autenticado
 */
router.post('/mcp/token', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { description } = req.body;

    const { data, error } = await db.rpc('generate_api_token', {
      p_user_id: user.id
    });

    if (error) return res.status(400).json({ error: error.message });
    if (!data || data.length === 0) return res.status(500).json({ error: 'No se pudo generar el token' });

    const createdToken = data[0];

    // Si hay una descripción, actualizar el registro
    if (description?.trim()) {
      await db
        .from('user_tokens')
        .update({ description: description.trim() })
        .eq('api_token', createdToken.token);
    }

    return res.status(201).json({
      success: true,
      token: createdToken.token, // Devolvemos el token completo una sola vez
      user_email: createdToken.user_email,
      negocios_acceso: createdToken.negocios_acceso,
      expira: createdToken.expira,
      description: description?.trim() || null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /hub/mcp/token/:id/reveal
 * Devuelve el valor completo de un token MCP existente del usuario autenticado
 */
router.get('/mcp/token/:id/reveal', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { data, error } = await db
      .from('user_tokens')
      .select('api_token')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Token no encontrado' });

    return res.json({ token: data.api_token });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /hub/mcp/token/:id
 * Revoca y elimina un token MCP
 */
router.delete('/mcp/token/:id', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { error } = await db
      .from('user_tokens')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', user.id);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
