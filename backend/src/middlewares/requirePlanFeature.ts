import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { getAuthUser } from '../utils/tenantHelper.js';

/**
 * Middleware factory: bloquea el acceso si el plan de suscripción del owner
 * no incluye el feature flag indicado (planes_suscripcion.feature_flags).
 */
export function requirePlanFeature(featureKey: string, tipoModulo: string = 'hotel') {
  return async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Resolver owner_id: propietario directo o staff vía usuarios_roles
    let ownerId: string | null = null;

    const { data: owner } = await supabaseAdmin!
      .from('owners')
      .select('id_owner')
      .eq('id_owner', user.id)
      .maybeSingle();

    if (owner?.id_owner) {
      ownerId = owner.id_owner;
    } else {
      const { data: role } = await supabaseAdmin!
        .from('usuarios_roles')
        .select('owner_id')
        .eq('user_id', user.id)
        .eq('estado', 'activo')
        .limit(1)
        .maybeSingle();

      ownerId = role?.owner_id ?? null;
    }

    if (!ownerId) {
      res.status(403).json({ error: 'PLAN_FEATURE_LOCKED', feature: featureKey, message: 'Esta función requiere un plan superior.' });
      return;
    }

    const { data: sub } = await supabaseAdmin!
      .from('suscripciones_owner')
      .select('id_plan, planes_suscripcion(feature_flags)')
      .eq('owner_id', ownerId)
      .eq('tipo_modulo', tipoModulo)
      .maybeSingle();

    const flags: string[] = (sub?.planes_suscripcion as any)?.feature_flags ?? [];

    if (!flags.includes(featureKey)) {
      res.status(403).json({
        error: 'PLAN_FEATURE_LOCKED',
        feature: featureKey,
        message: 'Esta función requiere un plan superior.',
      });
      return;
    }

    next();
  };
}
