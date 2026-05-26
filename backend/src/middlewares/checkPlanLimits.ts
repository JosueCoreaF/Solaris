import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export const checkPlanLimits = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) {
        res.status(401).json({ error: 'No autorizado' });
        return;
    }

    // Obtener el owner
    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo')
      .not('owner_id', 'is', null);

    if (!roles || roles.length === 0) {
      res.status(400).json({ error: 'Perfil de propietario no encontrado.' });
      return;
    }
    const owner_id = roles[0].owner_id;

    // El tipo_modulo viene en el body o default a 'hotel'
    const tipo_modulo = (req.body.tipo_modulo || req.query.tipo_modulo || 'hotel').toLowerCase();

    // Obtener la suscripción actual y el plan para ese módulo
    const { data: suscripcion } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_plan, estado, trial_end, negocios_extra')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    if (!suscripcion) {
      res.status(403).json({ error: 'SUBSCRIPTION_REQUIRED', message: `Debes suscribirte primero al módulo de ${tipo_modulo.toUpperCase()} para poder crear negocios.` });
      return;
    }

    let plan_id = suscripcion.id_plan;
    let negociosExtra = suscripcion.negocios_extra || 0;
    
    const isTrialActive = suscripcion.estado === 'trial' && suscripcion.trial_end && new Date(suscripcion.trial_end) > new Date();
    if (suscripcion.estado !== 'activa' && !isTrialActive) {
      res.status(403).json({ error: 'Tu periodo de prueba ha expirado o tu suscripción está inactiva. Por favor, actualiza tu plan para continuar.' });
      return;
    }

    const { data: plan } = await supabaseAdmin
      .from('planes_suscripcion')
      .select('limite_negocios')
      .eq('id_plan', plan_id)
      .single();

    const limiteNegocios = (plan?.limite_negocios || 1) + negociosExtra;

    // Contar cuántos negocios activos tiene el owner de este módulo
    const { count, error: countErr } = await supabaseAdmin
      .from('business_modules')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .eq('estado', 'activo');

    if (countErr) {
       res.status(500).json({ error: 'Error verificando límites' });
       return;
    }

    if (count !== null && count >= limiteNegocios) {
       res.status(403).json({ error: `Has alcanzado el límite de ${limiteNegocios} negocio(s) para el módulo ${tipo_modulo.toUpperCase()}. Adquiere un cupo extra o mejora tu plan para añadir más.` });
       return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
