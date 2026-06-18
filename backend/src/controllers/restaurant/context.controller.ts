import { Request, Response } from 'express'
import { supabaseAdmin } from '../../config/supabase.js'
import { getAuthUser } from '../../utils/tenantHelper.js'

export const syncContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['business-id'] || req.query.business_id

    let restaurante: any = null

    if (businessId) {
      // 1. Buscar restaurant por id_module
      const { data: byModule } = await supabaseAdmin!
        .from('restaurant')
        .select('*')
        .eq('id_module', businessId)
        .maybeSingle()

      restaurante = byModule ?? null

      // 2. Fallback: buscar por id_restaurant directamente
      if (!restaurante) {
        const { data: byId } = await supabaseAdmin!
          .from('restaurant')
          .select('*')
          .eq('id_restaurant', businessId)
          .maybeSingle()
        restaurante = byId ?? null
      }
    }

    // 3. Fallback final: buscar el restaurante del usuario autenticado
    if (!restaurante) {
      const user = await getAuthUser(req)
      if (user) {
        // 3a. ¿Es el dueño?
        const { data: ownerRow } = await supabaseAdmin!
          .from('owners')
          .select('id_owner')
          .eq('id_owner', user.id)
          .maybeSingle()

        if (ownerRow) {
          const { data: module } = await supabaseAdmin!
            .from('business_modules')
            .select('id_module')
            .eq('owner_id', ownerRow.id_owner)
            .eq('tipo_modulo', 'restaurant')
            .maybeSingle()

          if (module?.id_module) {
            const { data: restByOwner } = await supabaseAdmin!
              .from('restaurant')
              .select('*')
              .eq('id_module', module.id_module)
              .maybeSingle()
            restaurante = restByOwner ?? null
          }
        } else {
          // 3b. ¿Es staff de restaurante?
          const { data: roleRow } = await supabaseAdmin!
            .from('usuarios_roles')
            .select('owner_id, id_module')
            .eq('user_id', user.id)
            .eq('estado', 'activo')
            .limit(1)
            .maybeSingle()

          if (roleRow?.id_module) {
            const { data: restByRole } = await supabaseAdmin!
              .from('restaurant')
              .select('*')
              .eq('id_module', roleRow.id_module)
              .maybeSingle()
            restaurante = restByRole ?? null
          }
        }
      }
    }

    if (!restaurante) {
      return res.status(404).json({ error: 'Restaurante no encontrado' })
    }

    // Resolver plan de suscripción del owner
    let plan: any = { id_plan: null, nombre: null, estado: null, feature_flags: [] }

    if (restaurante.id_module) {
      const { data: businessModule } = await supabaseAdmin!
        .from('business_modules')
        .select('owner_id')
        .eq('id_module', restaurante.id_module)
        .maybeSingle()

      if (businessModule?.owner_id) {
        const { data: sub } = await supabaseAdmin!
          .from('suscripciones_owner')
          .select('id_plan, estado, planes_suscripcion(nombre, feature_flags)')
          .eq('owner_id', businessModule.owner_id)
          .eq('tipo_modulo', 'restaurant')
          .maybeSingle()

        if (sub) {
          plan = {
            id_plan: sub.id_plan,
            estado: sub.estado,
            nombre: (sub.planes_suscripcion as any)?.nombre ?? null,
            feature_flags: (sub.planes_suscripcion as any)?.feature_flags ?? [],
          }
        }
      }
    }

    return res.status(200).json({ data: { ...restaurante, plan } })
  } catch (err: any) {
    console.error('Error en syncContext restaurant:', err)
    return res.status(500).json({ error: err.message })
  }
}
