import express from 'express';
import { supabaseAdmin } from '../../config/supabase.js';

const router = express.Router();

interface CrearUsuarioRequest {
  email: string;
  password: string;
  nombre: string;
  rol: string;
  estado: string;
}

/**
 * POST /api/users/crear
 * Crear usuario manualmente usando RPC function (evita rate limits)
 */
router.post('/crear', async (req, res) => {
  try {
    const { email, password, nombre, rol, estado }: CrearUsuarioRequest = req.body;

    // Validar campos
    if (!email || !password || !nombre || !rol) {
      return res.status(400).json({
        error: 'Faltan campos requeridos: email, password, nombre, rol',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres',
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'El servicio de administración de Supabase no está configurado (falta SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    // Create user in auth via Supabase Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { nombre: nombre },
    });

    if (authError) {
      console.error('Error creating auth user via Supabase Admin:', authError);
      return res.status(400).json({ error: authError.message });
    }

    if (!authData || !authData.user) {
      return res.status(400).json({ 
        error: 'No se pudo crear el usuario en el sistema de autenticación' 
      });
    }

    const userId = authData.user.id;

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
      usuario_id: userId,
      id_hotel: null,
      rol: rol,
      estado: estado,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
      ...(isMultiTenant && owner_id ? { owner_id } : {}),
    };

    const { error: roleError } = await supabaseAdmin!.from('usuarios_roles').insert(insertPayload);

    if (roleError) {
      console.error('Error creating role entry:', roleError);
      return res.status(400).json({ error: 'Error al crear entrada de rol: ' + roleError.message });
    }

    return res.json({
      success: true,
      user_id: userId,
      email,
      nombre,
      rol,
      estado,
      message: 'Usuario creado exitosamente. El usuario puede ingresar con su correo y contraseña.',
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
