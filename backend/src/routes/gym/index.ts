import express from 'express'
import { syncContext } from '../../controllers/gym/context.controller.js'
import { supabaseAdmin } from '../../config/supabase.js'

const router = express.Router()

router.get('/sync-context', syncContext)

router.get('/health', (_req, res) => {
  res.json({ module: 'gym', status: 'ok' })
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
