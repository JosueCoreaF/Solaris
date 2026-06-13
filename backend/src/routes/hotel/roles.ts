import express from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../../utils/tenantHelper.js';

const router = express.Router();

/**
 * POST /api/roles/crear
 * Crear o actualizar entrada en usuarios_roles
 */
router.post('/crear', async (req, res) => {
  try {
    const { user_id, id_hotel, rol, estado } = req.body;

    if (!user_id || !rol || !estado) {
      return res.status(400).json({ error: 'Campos requeridos: user_id, rol, estado' });
    }

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(400).json({ error: 'No se pudo resolver el owner_id' });

    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no disponible' });

    // Upsert basado en user_id + owner_id (la única constraint real de la tabla)
    const { data: existing } = await supabaseAdmin
      .from('usuarios_roles')
      .select('id')
      .eq('user_id', user_id)
      .eq('owner_id', owner_id)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from('usuarios_roles')
        .update({ rol, estado, id_hotel: id_hotel || null, updated_at: new Date().toISOString() })
        .eq('user_id', user_id)
        .eq('owner_id', owner_id)
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('usuarios_roles')
        .insert({ user_id, owner_id, id_hotel: id_hotel || null, rol, estado })
        .select()
        .single();
      if (error) return res.status(400).json({ error: error.message });
      result = data;
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/roles/estado
 * Cambiar estado de un usuario
 */
router.put('/estado', async (req, res) => {
  try {
    const { user_id, estado } = req.body;
    if (!user_id || !estado) return res.status(400).json({ error: 'user_id y estado son requeridos' });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(400).json({ error: 'owner_id no resuelto' });
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no disponible' });

    const { error } = await supabaseAdmin
      .from('usuarios_roles')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('owner_id', owner_id);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/roles/usuarios
 * Obtener todos los usuarios con sus roles y emails (usa admin client para evitar RLS)
 */
router.get('/usuarios', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];

    const db = supabaseAdmin ?? supabase;
    const query = db
      .from('usuarios_roles_con_email')
      .select('*')
      .order('creado_en', { ascending: false });

    if (owner_id) query.eq('owner_id', owner_id);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error('Error fetching usuarios:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
