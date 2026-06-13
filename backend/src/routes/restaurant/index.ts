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
        .select('is_active, estado')
        .eq('owner_id', ownerId)
        .eq('tipo_modulo', 'restaurant')
        .maybeSingle()

      if (module && (module.is_active === false || module.estado === 'inactivo')) {
        return res.status(403).json({ error: 'MODULE_SUSPENDED', message: 'Este negocio ha sido suspendido. Contacta con soporte.', nombre_empresa })
      }
    }

    return res.json({ status: 'active', nombre_empresa })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

router.use(checkAccountStatus('restaurant'))

router.get('/sync-context', syncContext)

export default router
