import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { getAuthUser } from '../utils/tenantHelper.js';

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
 * Lista usuarios con roles del hotel activo
 */
router.get('/usuarios', async (req, res) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;

    let query = supabaseAdmin!
      .from('usuarios_roles')
      .select('id, user_id, owner_id, id_hotel, rol, estado, created_at')
      .order('created_at', { ascending: false });

    if (hotelId && hotelId !== 'all') {
      query = query.eq('id_hotel', hotelId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data || []);
  } catch (err) {
    console.error('Error en /roles/usuarios:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
