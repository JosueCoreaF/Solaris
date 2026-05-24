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

    // Obtener la suscripción actual y el plan
    const { data: suscripcion } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_plan, estado')
      .eq('owner_id', owner_id)
      .single();

    let plan_id = 'basico'; // Default a básico si no hay registro
    if (suscripcion && suscripcion.estado === 'activa') {
      plan_id = suscripcion.id_plan;
    }

    const { data: plan } = await supabaseAdmin
      .from('planes_suscripcion')
      .select('limite_negocios')
      .eq('id_plan', plan_id)
      .single();

    const limiteNegocios = plan?.limite_negocios || 1;

    // Contar cuántos negocios activos tiene el owner
    const { count, error: countErr } = await supabaseAdmin
      .from('business_modules')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', owner_id)
      .eq('estado', 'activo');

    if (countErr) {
       res.status(500).json({ error: 'Error verificando límites' });
       return;
    }

    if (count !== null && count >= limiteNegocios) {
       res.status(403).json({ error: `Has alcanzado el límite de ${limiteNegocios} negocio(s) de tu plan actual. Mejora tu plan para añadir más.` });
       return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
