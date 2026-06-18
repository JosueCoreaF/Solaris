import express from 'express'
import { syncContext } from '../../controllers/restaurant/context.controller.js'
import { supabaseAdmin } from '../../config/supabase.js'
import { checkAccountStatus, getAuthUser } from '../../utils/tenantHelper.js'

const router = express.Router()

router.get('/', (_req, res) => {
  res.json({ module: 'restaurant', message: 'Restaurant API placeholder' })
})

router.get('/account-status', async (req, res) => {
  try {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'INVALID_SESSION', message: 'Sesión inválida.' })

    let ownerId: string | null = null
    let estado: string | null = null
    let nombre_empresa: string | null = null

    const { data: owner } = await supabaseAdmin!
      .from('owners')
      .select('id_owner, estado, nombre_empresa')
      .eq('id_owner', user.id)
      .maybeSingle()

    if (owner) {
      ownerId = owner.id_owner
      estado = owner.estado
      nombre_empresa = owner.nombre_empresa
    } else {
      const { data: role } = await supabaseAdmin!
        .from('usuarios_roles')
        .select('owner_id')
        .eq('user_id', user.id)
        .eq('estado', 'activo')
        .limit(1)
        .maybeSingle()
      if (role?.owner_id) {
        ownerId = role.owner_id
        const { data: ownerData } = await supabaseAdmin!
          .from('owners')
          .select('estado, nombre_empresa')
          .eq('id_owner', role.owner_id)
          .maybeSingle()
        estado = ownerData?.estado ?? null
        nombre_empresa = ownerData?.nombre_empresa ?? null
      }
    }

    if (estado === 'suspendido') return res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'Tu cuenta ha sido suspendida. Contacta con soporte.', nombre_empresa })
    if (estado === 'inactivo')   return res.status(403).json({ error: 'ACCOUNT_INACTIVE',  message: 'Tu cuenta está inactiva.', nombre_empresa })

    if (ownerId) {
      const { data: module } = await supabaseAdmin!
        .from('business_modules')
        .select('id_module, is_active, estado')
        .eq('owner_id', ownerId)
        .eq('tipo_modulo', 'restaurant')
        .maybeSingle()

      if (module && (module.is_active === false || module.estado === 'inactivo')) {
        return res.status(403).json({ error: 'MODULE_SUSPENDED', message: 'Este negocio ha sido suspendido. Contacta con soporte.', nombre_empresa })
      }

      // Verificar que el restaurante individual también esté activo
      if (module?.id_module) {
        const { data: rest } = await supabaseAdmin!
          .from('restaurant')
          .select('activo')
          .eq('id_module', module.id_module)
          .maybeSingle()

        if (rest && rest.activo === false) {
          return res.status(403).json({ error: 'MODULE_SUSPENDED', message: 'Este restaurante ha sido desactivado. Contacta con soporte.', nombre_empresa })
        }
      }
    }

    return res.json({ status: 'active', nombre_empresa })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

router.use(checkAccountStatus('restaurant'))

router.get('/sync-context', syncContext)

/**
 * GET /api/restaurant/usuarios
 * Lista todos los usuarios con acceso al módulo de restaurante del owner autenticado
 */
router.get('/usuarios', async (req, res) => {
  try {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })

    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' })

    // Resolver owner_id
    let ownerId: string | null = null
    const { data: ownerRow } = await supabaseAdmin
      .from('owners').select('id_owner').eq('id_owner', user.id).maybeSingle()
    if (ownerRow) {
      ownerId = ownerRow.id_owner
    } else {
      const { data: role } = await supabaseAdmin
        .from('usuarios_roles').select('owner_id').eq('user_id', user.id).eq('estado', 'activo').limit(1).maybeSingle()
      ownerId = role?.owner_id ?? null
    }
    if (!ownerId) return res.status(400).json({ error: 'Owner no encontrado' })

    // Obtener módulos de tipo restaurant del owner
    const { data: mods } = await supabaseAdmin
      .from('business_modules').select('id_module')
      .eq('owner_id', ownerId).eq('tipo_modulo', 'restaurant')

    const moduleIds = (mods || []).map((m: any) => m.id_module)
    if (moduleIds.length === 0) return res.json([])

    // Obtener usuarios con roles en estos módulos
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('usuarios_roles').select('*')
      .eq('owner_id', ownerId)
      .in('id_module', moduleIds)

    if (rolesErr) return res.status(400).json({ error: rolesErr.message })

    // Obtener emails desde auth.users via admin
    const userIds = [...new Set((roles || []).map((r: any) => r.user_id))]
    const usersWithEmail: Record<string, string> = {}
    for (const uid of userIds) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid)
      if (authUser?.user?.email) usersWithEmail[uid] = authUser.user.email
    }

    const result = (roles || []).map((r: any) => ({
      ...r,
      email: usersWithEmail[r.user_id] || null,
    }))

    return res.json(result)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/restaurant/usuarios
 * Crear usuario de restaurante (staff)
 */
router.post('/usuarios', async (req, res) => {
  try {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' })

    const { email, password, nombre, rol, id_module } = req.body
    if (!email || !password || !nombre || !rol || !id_module) {
      return res.status(400).json({ error: 'email, password, nombre, rol e id_module son requeridos' })
    }
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' })

    // Resolver owner_id
    let ownerId: string | null = null
    const { data: ownerRow } = await supabaseAdmin
      .from('owners').select('id_owner').eq('id_owner', user.id).maybeSingle()
    ownerId = ownerRow?.id_owner ?? null
    if (!ownerId) return res.status(403).json({ error: 'Solo el propietario puede crear usuarios' })

    // Verificar que el módulo pertenece a este owner y es de tipo restaurant
    const { data: mod } = await supabaseAdmin
      .from('business_modules').select('id_module, tipo_modulo')
      .eq('id_module', id_module).eq('owner_id', ownerId).maybeSingle()
    if (!mod || mod.tipo_modulo !== 'restaurant') {
      return res.status(403).json({ error: 'Módulo no válido para este propietario' })
    }

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nombre }
    })
    if (authError) return res.status(400).json({ error: authError.message })

    const userId = authData.user!.id

    // Insertar en usuarios_roles con id_module del restaurante
    const { error: roleErr } = await supabaseAdmin
      .from('usuarios_roles')
      .insert({ user_id: userId, owner_id: ownerId, id_module, rol, estado: 'activo' })

    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return res.status(400).json({ error: roleErr.message })
    }

    return res.status(201).json({ success: true, user_id: userId, email, nombre, rol })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * PATCH /api/restaurant/usuarios/:userId/estado
 * Activar o desactivar un usuario del restaurante
 */
router.patch('/usuarios/:userId/estado', async (req, res) => {
  try {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' })

    const { userId } = req.params
    const { estado, id_module } = req.body
    if (!estado || !['activo', 'inactivo'].includes(estado)) {
      return res.status(400).json({ error: 'estado debe ser "activo" o "inactivo"' })
    }

    // Resolver owner_id y verificar permisos
    const { data: ownerRow } = await supabaseAdmin
      .from('owners').select('id_owner').eq('id_owner', user.id).maybeSingle()
    if (!ownerRow) return res.status(403).json({ error: 'Solo el propietario puede modificar usuarios' })

    const { error } = await supabaseAdmin
      .from('usuarios_roles')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('owner_id', ownerRow.id_owner)
      .eq('id_module', id_module)

    if (error) return res.status(400).json({ error: error.message })
    return res.json({ success: true, estado })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /api/restaurant/usuarios/:userId
 * Eliminar usuario de un módulo de restaurante
 */
router.delete('/usuarios/:userId', async (req, res) => {
  try {
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' })

    const { userId } = req.params
    const id_module = req.query.id_module as string

    const { data: ownerRow } = await supabaseAdmin
      .from('owners').select('id_owner').eq('id_owner', user.id).maybeSingle()
    if (!ownerRow) return res.status(403).json({ error: 'Solo el propietario puede eliminar usuarios' })

    const { error } = await supabaseAdmin
      .from('usuarios_roles')
      .delete()
      .eq('user_id', userId)
      .eq('owner_id', ownerRow.id_owner)
      .eq('id_module', id_module)

    if (error) return res.status(400).json({ error: error.message })
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
