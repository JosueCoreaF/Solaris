import express from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../../utils/tenantHelper.js';
import { sendInvitationEmail } from '../../utils/emailService.js';

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

    // Resolve owner_id for multi-tenant insert from auth session
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) {
      return res.status(400).json({ error: 'No se pudo resolver el owner_id para el propietario autenticado' });
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

    // Insert role entry directly into usuarios_roles using supabaseAdmin (bypasses RLS)
    const insertPayload: Record<string, any> = {
      user_id: userId,
      id_hotel: null,
      rol: rol,
      estado: estado,
      owner_id: owner_id,
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
 * POST /api/hotel/usuarios/invitar
 * Crea una invitación con código único y envía el correo al destinatario.
 */
router.post('/invitar', async (req, res) => {
  try {
    const { email, rol_sugerido = 'RECEPCIONISTA' } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: 'email es requerido' });

    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(400).json({ error: 'No se pudo resolver el owner_id' });

    const hotelId = req.headers['x-hotel-id'] as string | undefined;
    const hotelIdFinal = hotelId && hotelId !== 'all' ? hotelId : null;

    // Nombre del hotel para el correo
    let hotelName = 'Solaris Hotel';
    if (hotelIdFinal) {
      const { data: hotel } = await supabaseAdmin
        .from('hoteles')
        .select('nombre_hotel')
        .eq('id_hotel', hotelIdFinal)
        .maybeSingle();
      if (hotel?.nombre_hotel) hotelName = hotel.nombre_hotel;
    }

    // Nombre del sender (empresa del owner)
    const { data: ownerData } = await supabaseAdmin
      .from('owners')
      .select('nombre_empresa')
      .eq('id_owner', owner_id)
      .maybeSingle();

    // Verificar que no exista invitación activa para este email
    const { data: existing } = await supabaseAdmin
      .from('invitaciones')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .eq('usado', false)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una invitación activa para ese correo' });
    }

    const codigo_unico = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expira_en = new Date();
    expira_en.setDate(expira_en.getDate() + 7);

    const { data: inv, error: invErr } = await supabaseAdmin
      .from('invitaciones')
      .insert({
        email:         email.toLowerCase().trim(),
        codigo_unico,
        id_hotel:      hotelIdFinal,
        rol_sugerido,
        usado:         false,
        owner_id,
        expira_en:     expira_en.toISOString(),
      })
      .select()
      .single();

    if (invErr) return res.status(400).json({ error: invErr.message });

    void sendInvitationEmail({
      recipientEmail:   email.toLowerCase().trim(),
      hotelName,
      codigoInvitacion: codigo_unico,
      rolSugerido:      rol_sugerido,
      senderName:       ownerData?.nombre_empresa,
    });

    return res.status(201).json(inv);
  } catch (err: any) {
    console.error('[POST /usuarios/invitar]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
