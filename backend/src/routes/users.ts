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
      email:         email,
      password:      password,
      email_confirm: true,
      user_metadata: { nombre, tipo_registro: 'staff' },
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

/**
 * GET /api/users/buscar?email=X
 * Busca un usuario en auth.users por email (para gestionar propietarios u otros).
 */
router.get('/buscar', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no disponible' });

    const caller = await getAuthUser(req);
    if (!caller) return res.status(401).json({ error: 'No autorizado' });

    const email = (req.query.email as string)?.toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Parámetro email requerido' });

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(400).json({ error: error.message });

    const found = data.users.find(u => u.email?.toLowerCase() === email);
    if (!found) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Revisar si está en owners
    const { data: ownerRow } = await supabaseAdmin
      .from('owners')
      .select('id_owner, email_contacto, nombre_empresa, estado')
      .eq('id_owner', found.id)
      .maybeSingle();

    // Revisar si está en usuarios_roles
    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('rol, estado, owner_id')
      .eq('user_id', found.id);

    return res.json({
      user_id:       found.id,
      email:         found.email,
      created_at:    found.created_at,
      en_owners:     !!ownerRow,
      nombre_empresa: ownerRow?.nombre_empresa ?? null,
      roles:         roles ?? [],
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/users/por-email
 * Elimina un usuario completamente del sistema.
 * audit_log no tiene ON DELETE CASCADE, por eso se limpia primero manualmente.
 * El resto de tablas (owners, business_modules, hoteles y toda su data) tienen
 * CASCADE encadenado, por lo que se limpian automáticamente al borrar auth.users.
 */
router.delete('/por-email', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no disponible' });

    const caller = await getAuthUser(req);
    if (!caller) return res.status(401).json({ error: 'No autorizado' });

    const { email } = req.body as { email: string };
    if (!email) return res.status(400).json({ error: 'email requerido' });

    if (caller.email?.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    // Buscar el usuario en auth
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(400).json({ error: error.message });

    const target = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    const uid = target.id;

    // 1. Limpiar audit_log — NO tiene ON DELETE CASCADE en ninguna de sus FKs.
    //    Hay que borrar tanto las filas donde es owner_id como donde es usuario_id.
    await supabaseAdmin.from('audit_log').delete().eq('owner_id', uid);
    await supabaseAdmin.from('audit_log').delete().eq('usuario_id', uid);

    // 2. Eliminar de auth.users — Supabase propaga CASCADE a:
    //    auth.users → owners (CASCADE) → business_modules (CASCADE)
    //                                  → suscripciones_owner (CASCADE)
    //                                  → owner_metodos_pago (CASCADE)
    //                                  → historial_pagos (CASCADE)
    //                                  → usuarios_roles [owner_id] (CASCADE)
    //                                  → invitaciones (CASCADE)
    //                  → business_modules → hoteles (CASCADE) → toda la data hotelera
    //    auth.users → usuarios_roles [user_id] (CASCADE)
    //    auth.users → preferencias_usuario (CASCADE)
    //    auth.users → bitacora_actividad (CASCADE)
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (delErr) return res.status(400).json({ error: delErr.message });

    return res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando usuario por email:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/users/:id
 * Elimina la entrada de usuarios_roles para este owner.
 * Si el usuario no tiene más roles en ningún owner, también se borra de auth.users.
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Admin client no disponible' });
    }

    const caller = await getAuthUser(req);
    if (!caller) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(caller);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(400).json({ error: 'owner_id no resuelto' });

    // Eliminar de usuarios_roles para este owner
    const { error } = await supabaseAdmin
      .from('usuarios_roles')
      .delete()
      .eq('user_id', id)
      .eq('owner_id', owner_id);

    if (error) return res.status(400).json({ error: error.message });

    // Si el usuario ya no tiene roles en ningún otro owner, eliminarlo de auth.users
    const { data: otrosRoles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('id')
      .eq('user_id', id)
      .limit(1);

    if (!otrosRoles || otrosRoles.length === 0) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando usuario:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
