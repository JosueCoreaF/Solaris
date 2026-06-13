import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { getAuthUser } from '../../utils/tenantHelper.js';

export const syncContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['business-id'] || req.query.business_id;

    let hotel: any = null;

    if (businessId) {
      // 1. Buscar por id_module (ID del módulo proveniente del Hub)
      const { data: byModule } = await supabaseAdmin!
        .from('hoteles')
        .select('*')
        .eq('id_module', businessId)
        .maybeSingle();

      hotel = byModule ?? null;

      // 2. Fallback: buscar por id_hotel directamente
      if (!hotel) {
        const { data: byId } = await supabaseAdmin!
          .from('hoteles')
          .select('*')
          .eq('id_hotel', businessId)
          .maybeSingle();
        hotel = byId ?? null;
      }
    }

    // 3. Fallback final: buscar el hotel del usuario autenticado vía business_modules
    if (!hotel) {
      const user = await getAuthUser(req);
      if (user) {
        // Resolver owner_id: el usuario puede ser owner directo o staff
        let ownerId: string | null = user.id;

        const { data: ownerRow } = await supabaseAdmin!
          .from('owners')
          .select('id_owner')
          .eq('id_owner', user.id)
          .maybeSingle();

        if (!ownerRow) {
          const { data: roleRow } = await supabaseAdmin!
            .from('usuarios_roles')
            .select('owner_id')
            .eq('user_id', user.id)
            .eq('estado', 'activo')
            .limit(1)
            .maybeSingle();
          ownerId = roleRow?.owner_id ?? null;
        }

        if (ownerId) {
          const { data: module } = await supabaseAdmin!
            .from('business_modules')
            .select('id_module')
            .eq('owner_id', ownerId)
            .eq('tipo_modulo', 'hotel')
            .maybeSingle();

          if (module?.id_module) {
            const { data: hotelByOwner } = await supabaseAdmin!
              .from('hoteles')
              .select('*')
              .eq('id_module', module.id_module)
              .maybeSingle();
            hotel = hotelByOwner ?? null;

            // Actualizar localStorage con el id_module correcto para futuras visitas
            if (hotel && businessId && businessId !== module.id_module) {
              res.setHeader('X-Correct-Business-Id', module.id_module);
            }
          }
        }
      }
    }

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado' });
    }

    // Resolver el plan de suscripción del owner para exponer feature_flags al frontend
    let plan: any = { id_plan: null, nombre: null, estado: null, feature_flags: [] };

    if (hotel.id_module) {
      const { data: businessModule } = await supabaseAdmin!
        .from('business_modules')
        .select('owner_id')
        .eq('id_module', hotel.id_module)
        .maybeSingle();

      if (businessModule?.owner_id) {
        const { data: sub } = await supabaseAdmin!
          .from('suscripciones_owner')
          .select('id_plan, estado, planes_suscripcion(nombre, feature_flags)')
          .eq('owner_id', businessModule.owner_id)
          .eq('tipo_modulo', 'hotel')
          .maybeSingle();

        if (sub) {
          plan = {
            id_plan: sub.id_plan,
            estado: sub.estado,
            nombre: (sub.planes_suscripcion as any)?.nombre ?? null,
            feature_flags: (sub.planes_suscripcion as any)?.feature_flags ?? [],
          };
        }
      }
    }

    return res.status(200).json({ data: { ...hotel, plan } });
  } catch (err: any) {
    console.error('Error en syncContext:', err);
    return res.status(500).json({ error: err.message });
  }
};
