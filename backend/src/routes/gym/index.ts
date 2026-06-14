import express from 'express'
import { syncContext } from '../../controllers/gym/context.controller.js'
import { supabaseAdmin } from '../../config/supabase.js'
import { checkAccountStatus, getAuthUser, getOwnerHotelIdsForUser } from '../../utils/tenantHelper.js'
import { sendInvitationEmail } from '../../utils/emailService.js'

const router = express.Router()

router.get('/health', (_req, res) => {
  res.json({ module: 'gym', status: 'ok' })
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
        .eq('tipo_modulo', 'gym')
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

router.use(checkAccountStatus('gym'))

router.get('/sync-context', syncContext)

/**
 * POST /api/gym/usuarios/invitar
 * Crea una invitación con código único y envía el correo al destinatario.
 */
router.post('/usuarios/invitar', async (req, res) => {
  try {
    const { email, rol_sugerido = 'ENTRENADOR' } = req.body
    if (!email?.trim()) return res.status(400).json({ error: 'email es requerido' })
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' })

    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })

    const { ownerIds } = await getOwnerHotelIdsForUser(user)
    const owner_id = ownerIds[0]
    if (!owner_id) return res.status(400).json({ error: 'No se pudo resolver el owner_id' })

    const gymId = req.headers['x-gym-id'] as string | undefined
    const gymIdFinal = gymId && gymId !== 'all' ? gymId : null

    if (!gymIdFinal) {
      return res.status(400).json({ error: 'Debe seleccionar un gimnasio para enviar la invitación' })
    }

    let gymName = 'Solaris Gym'
    const { data: gym } = await supabaseAdmin
      .from('gimnasios')
      .select('nombre_gimnasio')
      .eq('id_gimnasio', gymIdFinal)
      .maybeSingle()
    if (gym?.nombre_gimnasio) gymName = gym.nombre_gimnasio

    const { data: ownerData } = await supabaseAdmin
      .from('owners')
      .select('nombre_empresa')
      .eq('id_owner', owner_id)
      .maybeSingle()

    const { data: existing } = await supabaseAdmin
      .from('invitaciones_gym')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .eq('usado', false)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ error: 'Ya existe una invitación activa para ese correo en el gimnasio' })
    }

    const codigo_unico = Math.random().toString(36).substring(2, 8).toUpperCase()
    const expira_en = new Date()
    expira_en.setDate(expira_en.getDate() + 7)

    const { data: inv, error: invErr } = await supabaseAdmin
      .from('invitaciones_gym')
      .insert({
        email:         email.toLowerCase().trim(),
        codigo_unico,
        id_gimnasio:   gymIdFinal,
        rol_sugerido,
        usado:         false,
        owner_id,
        expira_en:     expira_en.toISOString(),
      })
      .select()
      .single()

    if (invErr) return res.status(400).json({ error: invErr.message })

    void sendInvitationEmail({
      recipientEmail:   email.toLowerCase().trim(),
      hotelName:        gymName,
      codigoInvitacion: codigo_unico,
      rolSugerido:      rol_sugerido,
      senderName:       ownerData?.nombre_empresa,
    })

    const mappedInv = inv ? { ...inv, id_hotel: inv.id_gimnasio } : null
    return res.status(201).json(mappedInv)
  } catch (err: any) {
    console.error('[POST /gym/usuarios/invitar]', err.message)
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/gym/usuarios — lista invitaciones y staff del owner autenticado
 */
router.get('/usuarios/invitaciones', async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Admin client no configurado' })
    const user = await getAuthUser(req)
    if (!user) return res.status(401).json({ error: 'No autorizado' })

    const { ownerIds } = await getOwnerHotelIdsForUser(user)
    const owner_id = ownerIds[0]
    if (!owner_id) return res.status(400).json({ error: 'No se pudo resolver el owner_id' })

    const gymId = req.headers['x-gym-id'] as string | undefined
    const gymIdFinal = gymId && gymId !== 'all' ? gymId : null

    let query = supabaseAdmin
      .from('invitaciones_gym')
      .select('*')
      .eq('owner_id', owner_id)

    if (gymIdFinal) {
      query = query.eq('id_gimnasio', gymIdFinal)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error

    const mapped = (data || []).map((inv: any) => ({
      ...inv,
      id_hotel: inv.id_gimnasio
    }))

    return res.json(mapped)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Miembros
router.get('/miembros', async (req, res) => {
  try {
    const ownerId = req.headers['x-owner-id']
    if (!ownerId) return res.status(400).json({ error: 'owner_id requerido' })
    const { data, error } = await supabaseAdmin!
      .from('miembros')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Inscripciones
router.get('/inscripciones', async (req, res) => {
  try {
    const ownerId = req.headers['x-owner-id']
    if (!ownerId) return res.status(400).json({ error: 'owner_id requerido' })
    const { data, error } = await supabaseAdmin!
      .from('inscripciones_gym')
      .select('*, miembros(nombre_completo, correo), planes_membresia(nombre, precio, duracion_dias)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json({ data })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Dashboard KPIs
router.get('/dashboard/kpis', async (req, res) => {
  try {
    const ownerId = req.headers['x-owner-id']
    if (!ownerId) return res.status(400).json({ error: 'owner_id requerido' })

    const now = new Date()
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const finMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

    const [
      { count: totalMiembros },
      { count: miembrosActivos },
      { count: inscripcionesActivas },
      { count: vencenEsteMes },
      { data: pagosMes },
    ] = await Promise.all([
      supabaseAdmin!.from('miembros').select('*', { count: 'exact', head: true }).eq('owner_id', ownerId),
      supabaseAdmin!.from('miembros').select('*', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('estado', 'activo'),
      supabaseAdmin!.from('inscripciones_gym').select('*', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('estado', 'activa'),
      supabaseAdmin!.from('inscripciones_gym').select('*', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('estado', 'activa').gte('fecha_fin', inicioMes).lte('fecha_fin', finMes),
      supabaseAdmin!.from('pagos_gym').select('monto').eq('owner_id', ownerId as string).neq('estado', 'anulado').gte('fecha_pago', inicioMes),
    ])

    const ingresosMes = (pagosMes ?? []).reduce((s: number, p: any) => s + Number(p.monto), 0)

    res.json({ data: { totalMiembros, miembrosActivos, inscripcionesActivas, vencenEsteMes, ingresosMes } })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
