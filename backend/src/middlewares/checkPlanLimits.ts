import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await db.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

async function resolveOwnerId(userId: string): Promise<string | null> {
  // Propietario directo (owners.id_owner = auth.uid)
  const { data: owner } = await db
    .from('owners').select('id_owner').eq('id_owner', userId).maybeSingle();
  if (owner?.id_owner) return owner.id_owner;

  // Staff (usuarios_roles.user_id)
  const { data: role } = await db
    .from('usuarios_roles').select('owner_id')
    .eq('user_id', userId).eq('estado', 'activo')
    .not('owner_id', 'is', null).limit(1).maybeSingle();
  return role?.owner_id ?? null;
}

export const checkPlanLimits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) { res.status(401).json({ error: 'No autorizado' }); return; }

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) { res.status(400).json({ error: 'Perfil de propietario no encontrado.' }); return; }

    const tipo_modulo = ((req.body.tipo_modulo || req.query.tipo_modulo || 'hotel') as string).toLowerCase();

    const { data: suscripcion } = await db
      .from('suscripciones_owner')
      .select('id_plan, estado, trial_end, negocios_extra')
      .eq('owner_id', owner_id).eq('tipo_modulo', tipo_modulo).maybeSingle();

    if (!suscripcion) {
      res.status(403).json({ error: 'SUBSCRIPTION_REQUIRED', message: `Suscríbete al módulo ${tipo_modulo.toUpperCase()} para crear negocios.` });
      return;
    }

    const isTrialActive = suscripcion.estado === 'trial' && suscripcion.trial_end && new Date(suscripcion.trial_end) > new Date();
    if (suscripcion.estado !== 'activa' && !isTrialActive) {
      res.status(403).json({ error: 'Tu suscripción está inactiva. Actualiza tu plan para continuar.' });
      return;
    }

    const { data: plan } = await db
      .from('planes_suscripcion').select('limite_negocios')
      .eq('id_plan', suscripcion.id_plan).single();

    const limite = (plan?.limite_negocios || 1) + (suscripcion.negocios_extra || 0);

    const { count } = await db
      .from('business_modules').select('*', { count: 'exact', head: true })
      .eq('owner_id', owner_id).eq('tipo_modulo', tipo_modulo).eq('estado', 'activo');

    if (count !== null && count >= limite) {
      res.status(403).json({ error: `Límite de ${limite} negocio(s) para ${tipo_modulo.toUpperCase()} alcanzado.` });
      return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
