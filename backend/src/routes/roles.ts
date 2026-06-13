import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../utils/tenantHelper.js';

const router = express.Router();

/**
 * POST /api/roles/crear
 * Crea entrada en usuarios_roles (staff invitado via código de invitación)
 * El propietario (owner) no necesita fila aquí — se identifica por owners.id_owner = auth.uid()
 */
router.post('/crear', async (req, res) => {
  try {
    const { user_id, id_hotel, rol, estado, owner_id: bodyOwnerId } = req.body;

    if (!user_id || !rol || !estado) {
      return res.status(400).json({ error: 'Faltan campos requeridos: user_id, rol, estado' });
    }

    // Resolver owner_id e id_module desde el hotel si se provee id_hotel
    let owner_id  = bodyOwnerId || null;
    let id_module: string | null = null;

    if (id_hotel) {
      const { data: hotelData } = await supabaseAdmin!
        .from('hoteles')
        .select('id_module, business_modules!inner(owner_id)')
        .eq('id_hotel', id_hotel)
        .maybeSingle();
      if (hotelData) {
        id_module = (hotelData as any).id_module || null;
        if (!owner_id) owner_id = (hotelData as any).business_modules?.owner_id || null;
      }
    }

    if (!owner_id) {
      const caller = await getAuthUser(req);
      if (caller) {
        const { ownerIds } = await getOwnerHotelIdsForUser(caller);
        owner_id = ownerIds[0] || null;
      }
    }

    if (!owner_id) {
      return res.status(400).json({ error: 'No se pudo resolver el owner_id.' });
    }

    // Select explícito en vez de upsert — PostgreSQL trata NULL != NULL en UNIQUE,
    // así que el upsert con onConflict:'user_id,owner_id,id_module' crea duplicados
    // cuando id_module es NULL. Usamos .is() / .eq() para manejar null correctamente.
    const existingQuery = supabaseAdmin!
      .from('usuarios_roles')
      .select('id')
      .eq('user_id', user_id)
      .eq('owner_id', owner_id);

    const { data: existing } = id_module
      ? await existingQuery.eq('id_module', id_module).maybeSingle()
      : await existingQuery.is('id_module', null).maybeSingle();

    let result: any;

    if (existing) {
      const updateQuery = supabaseAdmin!
        .from('usuarios_roles')
        .update({
          rol,
          estado,
          id_hotel:  id_hotel  || null,
          id_module: id_module || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user_id)
        .eq('owner_id', owner_id);

      const { data, error } = id_module
        ? await updateQuery.eq('id_module', id_module).select().single()
        : await updateQuery.is('id_module', null).select().single();

      if (error) return res.status(400).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await supabaseAdmin!
        .from('usuarios_roles')
        .insert({ user_id, owner_id, id_hotel: id_hotel || null, id_module: id_module || null, rol, estado })
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error en /roles/crear:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/roles/mi-rol
 * Devuelve el rol real del usuario autenticado leyendo usuarios_roles y owners.
 * Prioridad: staff (owner_id != user.id) > propietario (tiene business_modules) > INVITADO
 */
router.get('/mi-rol', async (req, res) => {
  try {
    const caller = await getAuthUser(req);
    if (!caller) return res.json({ rol: 'INVITADO', owner_id: null });

    // 1. Buscar rol de staff — fila donde user_id = uid pero owner_id ≠ uid
    //    (owner_id === uid son filas auto-generadas por el trigger antiguo, las ignoramos)
    const { data: staffRow } = await supabaseAdmin!
      .from('usuarios_roles')
      .select('rol, owner_id')
      .eq('user_id', caller.id)
      .neq('owner_id', caller.id)
      .eq('estado', 'activo')
      .limit(1)
      .maybeSingle();

    if (staffRow) {
      return res.json({ rol: staffRow.rol, owner_id: staffRow.owner_id });
    }

    // 2. Verificar si es propietario real (tiene módulos de negocio registrados)
    const { data: moduloRow } = await supabaseAdmin!
      .from('business_modules')
      .select('owner_id')
      .eq('owner_id', caller.id)
      .limit(1)
      .maybeSingle();

    if (moduloRow) {
      return res.json({ rol: 'PROPIETARIO', owner_id: caller.id });
    }

    return res.json({ rol: 'INVITADO', owner_id: null });
  } catch (err) {
    console.error('Error en /roles/mi-rol:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/roles/usuarios
 * Lista usuarios con roles y email del owner autenticado
 */
router.get('/usuarios', async (req, res) => {
  try {
    const caller = await getAuthUser(req);
    if (!caller) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(caller);
    const owner_id = ownerIds[0];

    let query = supabaseAdmin!
      .from('usuarios_roles_con_email')
      .select('*')
      .order('creado_en', { ascending: false });

    if (owner_id) query = query.eq('owner_id', owner_id);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error en /roles/usuarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/roles/estado
 * Cambiar estado de un usuario
 */
router.put('/estado', async (req, res) => {
  try {
    const { user_id, estado } = req.body;
    if (!user_id || !estado) return res.status(400).json({ error: 'user_id y estado requeridos' });

    const caller = await getAuthUser(req);
    if (!caller) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(caller);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(400).json({ error: 'owner_id no resuelto' });

    const { error } = await supabaseAdmin!
      .from('usuarios_roles')
      .update({ estado })
      .eq('user_id', user_id)
      .eq('owner_id', owner_id);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
