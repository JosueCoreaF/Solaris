import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../utils/tenantHelper.js';

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

    // Resolver owner_id desde el JWT del usuario autenticado
    const caller = await getAuthUser(req);
    if (!caller) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(caller);
    const owner_id = ownerIds[0];
    if (!owner_id) {
      return res.status(400).json({ error: 'No se pudo resolver el owner_id del propietario autenticado' });
    }

    // Insert en usuarios_roles (supabaseAdmin bypassa RLS)
    // Las columnas created_at y updated_at tienen DEFAULT en el schema
    const insertPayload: Record<string, any> = {
      user_id: userId,
      owner_id,
      id_hotel: null,
      rol,
      estado,
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
