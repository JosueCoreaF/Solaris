import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/roles/crear
 * Crear entrada en usuarios_roles via RPC function con SECURITY DEFINER
 */
router.post('/crear', async (req, res) => {
  try {
    const { usuario_id, id_hotel, rol, estado, email } = req.body;

    if (!usuario_id || !rol || !estado) {
      return res.status(400).json({
        error: 'Missing required fields: usuario_id, rol, estado',
      });
    }

    // Resolve owner_id for multi-tenant insert
    const isMultiTenant = process.env.SUPABASE_URL?.includes('yefaoqzyjfqpwrnzgofb') || false;
    let owner_id: string | null = null;
    if (isMultiTenant) {
      const { data: ownerData } = await supabaseAdmin!.from('owners').select('id_owner').limit(1).maybeSingle();
      owner_id = ownerData?.id_owner || null;
      if (!owner_id) {
        return res.status(500).json({ error: 'No se pudo resolver el owner_id del sistema' });
      }
    }

    // Insert role entry directly into usuarios_roles using supabaseAdmin (bypasses RLS)
    const insertPayload: Record<string, any> = {
      usuario_id,
      id_hotel: id_hotel || null,
      rol,
      estado,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
      ...(isMultiTenant && owner_id ? { owner_id } : {}),
    };

    const { data, error } = await supabaseAdmin!.from('usuarios_roles').upsert(insertPayload, {
      onConflict: 'usuario_id,id_hotel',
    }).select().maybeSingle();

    if (error) {
      console.error('Error calling RPC function:', error);
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/roles/usuarios
 * Obtener todos los usuarios con sus roles y emails
 */
router.get('/usuarios', async (req, res) => {
  try {
    // Get usuarios_roles dynamically joined with emails from auth.users via the 3NF view
    const { data: usuariosRoles, error: rolesError } = await supabase
      .from('usuarios_roles_con_email')
      .select('*')
      .order('creado_en', { ascending: false });

    if (rolesError) throw rolesError;

    // Get auth users (using admin API requires service_role key - this won't work from backend with anon key)
    // Instead, we'll need to modify the approach
    // For now, return the usuarios_roles and let the frontend handle it
    return res.json(usuariosRoles || []);
  } catch (err) {
    console.error('Error fetching usuarios:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
