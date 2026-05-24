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
      .or(`id_owner.eq.${user.id},email_contacto.eq.${normalizedEmail}`)
      .maybeSingle();

    if (existingError) {
      return res.status(400).json({ error: existingError.message });
    }

    if (existingOwner) {
      return res.status(400).json({ error: 'Ya existe un perfil de propietario con ese correo.' });
    }

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

    const { error: roleErr } = await supabaseAdmin
      .from('usuarios_roles')
      .insert({
        usuario_id: user.id,
        owner_id: owner.id_owner,
        id_hotel: null,
        rol: 'PROPIETARIO',
        estado: 'activo',
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString(),
      });

    if (roleErr) {
      return res.status(500).json({ error: 'Perfil creado, pero no se pudo registrar el rol de propietario.' });
    }

    return res.status(201).json({ success: true, ownerId: owner.id_owner });
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

    const combinedModules = [
      ...(modules || []).map((m: any) => ({
        id: m.id_module,
        type: m.tipo_modulo?.toLowerCase() ?? 'hotel',
        reference_id: m.id_module,
        is_active: m.estado === 'activo',
        name: m.nombre_modulo,
      })),
      ...hotelFallbacks,
    ];

    return res.json({
      owner: {
        nombre: ownerRow.nombre_empresa || user.email?.split('@')[0] || 'Usuario',
        plan: 'Profesional',
      },
      modules: combinedModules,
      kpis: {
        ingresos: 0,
        negocios_activos: combinedModules.length,
        ocupacion: 0,
        tareas: 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
