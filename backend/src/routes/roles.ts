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

    // Resolver owner_id: puede venir en el body, o se busca via id_hotel
    let owner_id = bodyOwnerId || null;
    if (!owner_id && id_hotel) {
      const { data: hotelData } = await supabaseAdmin!
        .from('hoteles')
        .select('business_modules!inner(owner_id)')
        .eq('id_hotel', id_hotel)
        .maybeSingle();
      owner_id = (hotelData as any)?.business_modules?.owner_id || null;
    }

    if (!owner_id) {
      return res.status(400).json({ error: 'No se pudo resolver el owner_id. Proporciona owner_id o id_hotel válido.' });
    }

    const { data, error } = await supabaseAdmin!
      .from('usuarios_roles')
      .upsert({
        user_id,
        owner_id,
        id_hotel: id_hotel || null,
        rol,
        estado,
      }, { onConflict: 'user_id,owner_id,id_module' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creando rol:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error en /roles/crear:', err);
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
