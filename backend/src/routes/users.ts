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
  id_hotel?: string;
}

/**
 * POST /api/users/crear
 * Crear usuario manualmente usando RPC function (evita rate limits)
 */
router.post('/crear', async (req, res) => {
  try {
    const { email, password, nombre, rol, estado, id_hotel }: CrearUsuarioRequest = req.body;

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

    // Resolver id_module desde el hotel si se proporcionó id_hotel
    let id_module: string | null = null;
    if (id_hotel) {
      const { data: hotelRow } = await supabaseAdmin!
        .from('hoteles')
        .select('id_module')
        .eq('id_hotel', id_hotel)
        .maybeSingle();
      id_module = (hotelRow as any)?.id_module || null;
    }

    const insertPayload: Record<string, any> = {
      user_id:   userId,
      owner_id,
      id_hotel:  id_hotel  || null,
      id_module: id_module || null,
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

    const { ownerIds } = await getOwnerHotelIdsForUser(caller);
    const callerOwnerId = ownerIds[0];
    if (!callerOwnerId) {
      return res.status(400).json({ error: 'No se pudo resolver el owner_id del propietario' });
    }

    const email = (req.query.email as string)?.toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'Parámetro email requerido' });

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return res.status(400).json({ error: error.message });

    const found = (data.users as any[]).find(u => u.email?.toLowerCase() === email);
    if (!found) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Si el usuario encontrado es otro propietario (en_owners es true) y no es el propio llamador, ocultar
    const { data: ownerRow } = await supabaseAdmin
      .from('owners')
      .select('id_owner, email_contacto, nombre_empresa, estado')
      .eq('id_owner', found.id)
      .maybeSingle();

    if (ownerRow && found.id !== caller.id) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Revisar si está en usuarios_roles
    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('rol, estado, owner_id')
      .eq('user_id', found.id);

    // Si no es el propio llamador y no tiene ningún rol asignado bajo el owner_id del llamador, no debe verlo
    const tieneRolEnOwner = roles && roles.some((r: any) => r.owner_id === callerOwnerId);
    if (found.id !== caller.id && !tieneRolEnOwner) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Filtrar los roles para mostrar únicamente los que corresponden al owner del llamador,
    // y además evitar que vea si tiene el rol de PROPIETARIO si no es él mismo
    const rolesFiltrados = (roles ?? []).filter((r: any) => r.owner_id === callerOwnerId);
    const esPropietario = rolesFiltrados.some((r: any) => r.rol === 'PROPIETARIO');
    if (esPropietario && found.id !== caller.id) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    return res.json({
      user_id:       found.id,
      email:         found.email,
      created_at:    found.created_at,
      en_owners:     !!ownerRow,
      nombre_empresa: ownerRow?.nombre_empresa ?? null,
      roles:         rolesFiltrados,
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

    const target = (data.users as any[]).find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    const uid = target.id;

    const { ownerIds } = await getOwnerHotelIdsForUser(caller);
    const callerOwnerId = ownerIds[0];
    if (!callerOwnerId) {
      return res.status(400).json({ error: 'No se pudo resolver el owner_id del propietario' });
    }

    // Verificar si es propietario/owner
    const { data: ownerRow } = await supabaseAdmin
      .from('owners')
      .select('id_owner')
      .eq('id_owner', uid)
      .maybeSingle();

    if (ownerRow) {
      return res.status(400).json({ error: 'No se puede eliminar una cuenta de propietario desde este panel.' });
    }

    // Obtener los roles del usuario a eliminar
    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('rol, owner_id')
      .eq('user_id', uid);

    // Validar que el usuario a eliminar pertenezca al owner del llamador
    const tieneRolEnOwner = roles && roles.some((r: any) => r.owner_id === callerOwnerId);
    if (!tieneRolEnOwner) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar a este usuario.' });
    }

    const esPropietario = roles && roles.some((r: any) => r.rol === 'PROPIETARIO');
    if (esPropietario) {
      return res.status(400).json({ error: 'No se puede eliminar una cuenta de propietario desde este panel.' });
    }

    // Eliminar via admin API — Supabase limpia auth.identities y auth.users,
    // luego el cascade propaga a owners → business_modules → hoteles → data hotelera,
    // usuarios_roles, invitaciones, etc.
    // audit_log.owner_id y audit_log.usuario_id tienen ON DELETE SET NULL
    // (schema_05_patch_audit.sql) así que no bloquean el cascade.
    // fn_audit_trigger tiene EXCEPTION handler para ser resiliente en cascades.
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

    // Verificar si el rol a eliminar es PROPIETARIO
    const { data: roleRow } = await supabaseAdmin
      .from('usuarios_roles')
      .select('rol')
      .eq('user_id', id)
      .eq('owner_id', owner_id)
      .maybeSingle();

    if (roleRow?.rol === 'PROPIETARIO') {
      return res.status(400).json({ error: 'No se puede eliminar la cuenta o rol de un propietario.' });
    }

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
