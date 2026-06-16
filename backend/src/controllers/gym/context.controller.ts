import { Request, Response } from 'express'
import { supabaseAdmin } from '../../config/supabase.js'
import { getAuthUser } from '../../utils/tenantHelper.js'

export const syncContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['business-id'] || req.query.business_id

    let gimnasio: any = null

    if (businessId) {
      // 1. Buscar por id_module (ID del módulo proveniente del Hub)
      const { data: byModule } = await supabaseAdmin!
        .from('gimnasios')
        .select('*')
        .eq('id_module', businessId)
        .maybeSingle()

      gimnasio = byModule ?? null

      // 2. Fallback: buscar por id_gimnasio directamente
      if (!gimnasio) {
        const { data: byId } = await supabaseAdmin!
          .from('gimnasios')
          .select('*')
          .eq('id_gimnasio', businessId)
          .maybeSingle()
        gimnasio = byId ?? null
      }
    }

    // 3. Fallback final: buscar el gimnasio del usuario autenticado
    if (!gimnasio) {
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
            .eq('tipo_modulo', 'gym')
            .maybeSingle()

          if (module?.id_module) {
            const { data: gymByOwner } = await supabaseAdmin!
              .from('gimnasios')
              .select('*')
              .eq('id_module', module.id_module)
              .maybeSingle()
            gimnasio = gymByOwner ?? null
          }
        } else {
          // 3b. ¿Es staff de gimnasio? Buscar primer gimnasio al que tiene acceso activo
          const { data: gymRole } = await supabaseAdmin!
            .from('usuarios_roles_gym')
            .select('id_gimnasio')
            .eq('user_id', user.id)
            .eq('estado', 'activo')
            .limit(1)
            .maybeSingle()

          if (gymRole?.id_gimnasio) {
            const { data: gymByRole } = await supabaseAdmin!
              .from('gimnasios')
              .select('*')
              .eq('id_gimnasio', gymRole.id_gimnasio)
              .maybeSingle()
            gimnasio = gymByRole ?? null
          } else {
            // 3c. Fallback de hotel/genérico (por compatibilidad)
            const { data: roleRow } = await supabaseAdmin!
              .from('usuarios_roles')
              .select('owner_id')
              .eq('user_id', user.id)
              .eq('estado', 'activo')
              .limit(1)
              .maybeSingle()

            if (roleRow?.owner_id) {
              const { data: module } = await supabaseAdmin!
                .from('business_modules')
                .select('id_module')
                .eq('owner_id', roleRow.owner_id)
                .eq('tipo_modulo', 'gym')
                .maybeSingle()

              if (module?.id_module) {
                const { data: gymByOwner } = await supabaseAdmin!
                  .from('gimnasios')
                  .select('*')
                  .eq('id_module', module.id_module)
                  .maybeSingle()
                gimnasio = gymByOwner ?? null
              }
            }
          }
        }
      }
    }

    if (!gimnasio) {
      return res.status(404).json({ error: 'Gimnasio no encontrado' })
    }

    // Resolver el plan de suscripción del owner para exponer feature_flags al frontend
    let plan: any = { id_plan: null, nombre: null, estado: null, feature_flags: [] }

    if (gimnasio.id_module) {
      const { data: businessModule } = await supabaseAdmin!
        .from('business_modules')
        .select('owner_id')
        .eq('id_module', gimnasio.id_module)
        .maybeSingle()

      if (businessModule?.owner_id) {
        const { data: sub } = await supabaseAdmin!
          .from('suscripciones_owner')
          .select('id_plan, estado, planes_suscripcion(nombre, feature_flags)')
          .eq('owner_id', businessModule.owner_id)
          .eq('tipo_modulo', 'gym')
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

    return res.status(200).json({ data: { ...gimnasio, plan } })
  } catch (err: any) {
    console.error('Error en syncContext gym:', err)
    return res.status(500).json({ error: err.message })
  }
}
