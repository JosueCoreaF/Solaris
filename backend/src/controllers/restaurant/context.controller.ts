import { Request, Response } from 'express'
import { supabaseAdmin } from '../../config/supabase.js'

export const syncContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['business-id'] || req.query.business_id

    if (!businessId) {
      return res.status(400).json({ error: 'business_id es requerido en headers o query' })
    }

    const { data, error } = await supabaseAdmin!
      .from('business_modules')
      .select('*')
      .eq('id_module', businessId)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Módulo restaurant no encontrado' })
    }

    if (data.tipo_modulo !== 'restaurant') {
      return res.status(400).json({ error: 'El módulo encontrado no es de tipo restaurant' })
    }

    return res.status(200).json({ data })
  } catch (err: any) {
    console.error('Error en syncContext restaurant:', err)
    return res.status(500).json({ error: err.message })
  }
}
