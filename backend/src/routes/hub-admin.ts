import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();
const db = () => supabaseAdmin!;

// ─── Guard: solo is_solarys_admin = true ─────────────────────────────────────

async function requireSolarysAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' });

  const { data: { user }, error } = await db().auth.getUser(auth.slice(7));
  if (error || !user) return res.status(401).json({ error: 'Token inválido' });

  const { data: owner } = await db()
    .from('owners')
    .select('is_solarys_admin')
    .eq('id_owner', user.id)
    .maybeSingle();

  if (!owner?.is_solarys_admin) return res.status(403).json({ error: 'Acceso denegado' });

  (req as any).adminUserId = user.id;
  next();
}

router.use(requireSolarysAdmin);

// ─── GET /hub/admin/stats ─────────────────────────────────────────────────────

router.get('/stats', async (_req, res) => {
  try {
    const [
      { count: totalOwners },
      { count: activeOwners },
      { count: suspendedOwners },
      { data: subs },
      { count: totalModules },
      { data: aiRows },
    ] = await Promise.all([
      db().from('owners').select('*', { count: 'exact', head: true }),
      db().from('owners').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      db().from('owners').select('*', { count: 'exact', head: true }).eq('estado', 'suspendido'),
      db().from('suscripciones_owner').select('id_plan, estado').eq('estado', 'activa'),
      db().from('business_modules').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
      db().from('ai_usage_log').select('input_tokens, output_tokens'),
    ]);

    // MRR desde precios reales en planes_suscripcion
    const planIds = [...new Set((subs || []).map((s: any) => s.id_plan))];
    let planPrices: Record<string, number> = {};
    if (planIds.length > 0) {
      const { data: planes } = await db()
        .from('planes_suscripcion')
        .select('id_plan, precio_mensual')
        .in('id_plan', planIds);
      planPrices = Object.fromEntries((planes || []).map((p: any) => [p.id_plan, Number(p.precio_mensual)]));
    }
    const mrr = (subs || []).reduce((acc: number, s: any) => acc + (planPrices[s.id_plan] ?? 0), 0);

    const totalTokens = (aiRows || []).reduce(
      (acc: number, r: any) => acc + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0
    );
    const totalAiCalls = aiRows?.length ?? 0;

    return res.json({
      totalOwners:     totalOwners ?? 0,
      activeOwners:    activeOwners ?? 0,
      suspendedOwners: suspendedOwners ?? 0,
      totalModules:    totalModules ?? 0,
      mrr,
      arr:             mrr * 12,
      totalTokens,
      totalAiCalls,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/admin/owners ────────────────────────────────────────────────────

router.get('/owners', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const q      = (req.query.q as string) || '';
    const estado = (req.query.estado as string) || '';

    let query = db()
      .from('owners')
      .select(`
        id_owner, nombre_empresa, email_contacto, telefono_contacto,
        estado, is_solarys_admin, created_at,
        suscripciones_owner ( id_plan, estado, trial_end ),
        business_modules ( id_module, tipo_modulo, is_active )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (q) query = query.ilike('nombre_empresa', `%${q}%`);
    if (estado) query = query.eq('estado', estado);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({ data: data ?? [], total: count ?? 0, limit, offset });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/admin/owners/:id ────────────────────────────────────────────────

router.get('/owners/:id', async (req, res) => {
  try {
    const { data, error } = await db()
      .from('owners')
      .select(`
        id_owner, nombre_empresa, email_contacto, telefono_contacto,
        estado, is_solarys_admin, created_at, updated_at,
        suscripciones_owner ( id_plan, estado, trial_end, created_at ),
        business_modules (
          id_module, tipo_modulo, is_active, created_at,
          hoteles ( id_hotel, nombre_hotel, ciudad, estado )
        )
      `)
      .eq('id_owner', req.params.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Owner no encontrado' });
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /hub/admin/owners/:id ─────────────────────────────────────────────

router.patch('/owners/:id', async (req, res) => {
  try {
    const { estado } = req.body;
    const allowed = ['activo', 'suspendido', 'inactivo'];
    if (!allowed.includes(estado)) {
      return res.status(400).json({ error: `estado debe ser: ${allowed.join(', ')}` });
    }

    const { data, error } = await db()
      .from('owners')
      .update({ estado })
      .eq('id_owner', req.params.id)
      .select('id_owner, nombre_empresa, estado')
      .maybeSingle();

    if (error) {
      console.error('[PATCH owners] DB error:', error.message, error.details);
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Owner no encontrado' });
    return res.json(data);
  } catch (err: any) {
    console.error('[PATCH owners] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/admin/billing/summary ──────────────────────────────────────────

router.get('/billing/summary', async (req, res) => {
  try {
    const mes   = (req.query.mes as string) || new Date().toISOString().slice(0, 7);
    const [yr, mo] = mes.split('-').map(Number);
    const start = new Date(yr, mo - 1, 1).toISOString();
    const end   = new Date(yr, mo,     1).toISOString();

    const { data: owners, error: owErr } = await db()
      .from('owners')
      .select(`
        id_owner, nombre_empresa, email_contacto, estado,
        suscripciones_owner (
          id_suscripcion, id_plan, estado, trial_end,
          planes_suscripcion ( nombre, precio_mensual )
        ),
        business_modules ( id_module, is_active )
      `)
      .order('nombre_empresa');
    if (owErr) throw owErr;

    const ownerIds = (owners ?? []).map((o: any) => o.id_owner);
    const { data: pagos } = ownerIds.length
      ? await db()
          .from('historial_pagos')
          .select('owner_id, monto, estado')
          .in('owner_id', ownerIds)
          .gte('created_at', start)
          .lt('created_at', end)
      : { data: [] as any[] };

    const pagosPorOwner: Record<string, number> = {};
    for (const p of pagos ?? []) {
      if ((p as any).estado !== 'fallido') {
        pagosPorOwner[(p as any).owner_id] = (pagosPorOwner[(p as any).owner_id] || 0) + Number((p as any).monto);
      }
    }

    const summary = (owners ?? []).map((o: any) => {
      const sub    = o.suscripciones_owner?.[0];
      const plan   = Array.isArray(sub?.planes_suscripcion) ? sub.planes_suscripcion[0] : sub?.planes_suscripcion;
      const precio = plan ? Number(plan.precio_mensual) : 0;
      const modActivos = (o.business_modules ?? []).filter((m: any) => m.is_active).length;
      const pagado = pagosPorOwner[o.id_owner] ?? 0;
      const saldo  = Math.max(0, precio - pagado);

      let estado_pago: string;
      if (!sub || precio === 0)       estado_pago = 'sin_plan';
      else if (pagado >= precio)      estado_pago = 'cobrado';
      else if (pagado > 0)            estado_pago = 'parcial';
      else                            estado_pago = 'pendiente';

      return {
        owner_id:        o.id_owner,
        nombre_empresa:  o.nombre_empresa,
        email_contacto:  o.email_contacto,
        owner_estado:    o.estado,
        plan_id:         sub?.id_plan ?? null,
        plan_nombre:     plan?.nombre ?? null,
        plan_estado:     sub?.estado  ?? null,
        precio_mensual:  precio,
        modulos_activos: modActivos,
        estado_pago,
        monto_pagado:    pagado,
        saldo_pendiente: saldo,
      };
    });

    const totals = summary.reduce(
      (acc, e) => ({
        total_cobrar: acc.total_cobrar + e.precio_mensual,
        cobrado:      acc.cobrado      + e.monto_pagado,
        pendiente:    acc.pendiente    + e.saldo_pendiente,
      }),
      { total_cobrar: 0, cobrado: 0, pendiente: 0 }
    );

    return res.json({ mes, summary, totals });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /hub/admin/billing/register-payment ─────────────────────────────────

router.post('/billing/register-payment', async (req, res) => {
  try {
    const { owner_id, monto, metodo_pago, concepto } = req.body;
    if (!owner_id || !monto || !metodo_pago) {
      return res.status(400).json({ error: 'owner_id, monto y metodo_pago son requeridos' });
    }

    const { data: sub } = await db()
      .from('suscripciones_owner')
      .select('id_suscripcion')
      .eq('owner_id', owner_id)
      .maybeSingle();

    const { data, error } = await db()
      .from('historial_pagos')
      .insert({
        owner_id,
        id_suscripcion: sub?.id_suscripcion ?? null,
        concepto:    concepto || 'Suscripción mensual',
        metodo_pago,
        monto:       Number(monto),
        estado:      'completado',
      })
      .select()
      .single();

    if (error) {
      console.error('[register-payment] DB error:', JSON.stringify(error));
      throw error;
    }
    return res.json(data);
  } catch (err: any) {
    console.error('[register-payment] catch:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/admin/plans ─────────────────────────────────────────────────────

router.get('/plans', async (_req, res) => {
  try {
    const { data, error } = await db()
      .from('planes_suscripcion')
      .select('id_plan, nombre, tipo_modulo, precio_mensual, precio_anual, activo')
      .order('precio_mensual');
    if (error) throw error;
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /hub/admin/owners/:id/subscription ────────────────────────────────

router.patch('/owners/:id/subscription', async (req, res) => {
  try {
    const { id_plan, estado, trial_end } = req.body;

    const { data: existing } = await db()
      .from('suscripciones_owner')
      .select('id_suscripcion')
      .eq('owner_id', req.params.id)
      .maybeSingle();

    if (existing) {
      const update: Record<string, any> = { updated_at: new Date().toISOString() };
      if (id_plan !== undefined) update.id_plan   = id_plan;
      if (estado  !== undefined) update.estado    = estado;
      if (trial_end !== undefined) update.trial_end = trial_end || null;

      const { data, error } = await db()
        .from('suscripciones_owner')
        .update(update)
        .eq('id_suscripcion', existing.id_suscripcion)
        .select('id_suscripcion, id_plan, estado, trial_end')
        .maybeSingle();
      if (error) {
        console.error('[PATCH subscription] DB error:', error.message, error.details);
        throw error;
      }
      return res.json(data ?? existing);
    }

    // No existe suscripción: crear
    const { data: plan } = await db()
      .from('planes_suscripcion')
      .select('tipo_modulo')
      .eq('id_plan', id_plan)
      .maybeSingle();

    const { data, error } = await db()
      .from('suscripciones_owner')
      .insert({
        owner_id:    req.params.id,
        id_plan,
        tipo_modulo: plan?.tipo_modulo ?? 'hotel',
        estado:      estado ?? 'activa',
        trial_end:   trial_end || null,
      })
      .select('id_suscripcion, id_plan, estado, trial_end')
      .maybeSingle();
    if (error) {
      console.error('[PATCH subscription INSERT] DB error:', error.message, error.details);
      throw error;
    }
    return res.json(data);
  } catch (err: any) {
    console.error('[PATCH subscription] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /hub/admin/modules/:moduleId ──────────────────────────────────────

router.patch('/modules/:moduleId', async (req, res) => {
  try {
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active debe ser boolean' });
    }
    const { data, error } = await db()
      .from('business_modules')
      .update({ is_active })
      .eq('id_module', req.params.moduleId)
      .select('id_module, tipo_modulo, is_active')
      .maybeSingle();
    if (error) {
      console.error('[PATCH modules] DB error:', error.message, error.details);
      throw error;
    }
    if (!data) return res.status(404).json({ error: 'Módulo no encontrado' });
    return res.json(data);
  } catch (err: any) {
    console.error('[PATCH modules] fatal:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /hub/admin/owners/:id/bulk-modules ─────────────────────────────────
// Suspende o activa todos los módulos de un owner en una sola operación.
// body: { action: 'suspend' | 'activate' }

router.post('/owners/:id/bulk-modules', async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== 'suspend' && action !== 'activate') {
      return res.status(400).json({ error: 'action debe ser "suspend" o "activate"' });
    }

    const is_active = action === 'activate';

    const { data, error } = await db()
      .from('business_modules')
      .update({ is_active })
      .eq('owner_id', req.params.id)
      .select('id_module, tipo_modulo, is_active');

    if (error) throw error;

    await db().from('audit_log').insert({
      actor_id:    (req as any).adminUserId,
      target_type: 'owner',
      target_id:   req.params.id,
      action:      action === 'suspend' ? 'bulk_suspend_modules' : 'bulk_activate_modules',
      meta:        { modules_affected: data?.length ?? 0 },
    });

    return res.json({ updated: data?.length ?? 0, modules: data ?? [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /hub/admin/owners/:id/deactivate ────────────────────────────────────
// Desactivación completa:
//   1. Suspende todos los módulos (is_active = false)
//   2. Cancela todas las suscripciones activas
//   3. Marca el owner como 'inactivo'

router.post('/owners/:id/deactivate', async (req, res) => {
  try {
    const ownerId = req.params.id;

    const { data: owner, error: owErr } = await db()
      .from('owners')
      .select('id_owner, nombre_empresa, email_contacto')
      .eq('id_owner', ownerId)
      .maybeSingle();

    if (owErr || !owner) return res.status(404).json({ error: 'Owner no encontrado' });

    // 1. Suspender módulos
    await db()
      .from('business_modules')
      .update({ is_active: false })
      .eq('owner_id', ownerId);

    // 2. Cancelar suscripciones
    await db()
      .from('suscripciones_owner')
      .update({ estado: 'cancelada', updated_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .in('estado', ['activa', 'trial', 'inactiva', 'impaga']);

    // 3. Desactivar owner
    const { data: updated, error: upErr } = await db()
      .from('owners')
      .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
      .eq('id_owner', ownerId)
      .select('id_owner, nombre_empresa, estado')
      .single();

    if (upErr) throw upErr;

    await db().from('audit_log').insert({
      actor_id:    (req as any).adminUserId,
      target_type: 'owner',
      target_id:   ownerId,
      action:      'deactivate_account',
      meta:        { nombre_empresa: owner.nombre_empresa },
    });

    return res.json({ success: true, owner: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /hub/admin/owners/:id ─────────────────────────────────────────────
// Eliminación permanente:
//   1. Borra el usuario de Supabase Auth (revoca acceso inmediatamente)
//   2. Desactiva todos los módulos y suscripciones
//   3. Marca owner como 'inactivo' (los datos de negocio se conservan por auditoría)

router.delete('/owners/:id', async (req, res) => {
  try {
    const ownerId = req.params.id;

    const { data: owner, error: owErr } = await db()
      .from('owners')
      .select('id_owner, nombre_empresa, email_contacto')
      .eq('id_owner', ownerId)
      .maybeSingle();

    if (owErr || !owner) return res.status(404).json({ error: 'Owner no encontrado' });

    // Suspender módulos
    const { error: modErr } = await db()
      .from('business_modules')
      .update({ is_active: false })
      .eq('owner_id', ownerId);
    if (modErr) console.error('[DELETE owner] modules error:', modErr.message);

    // Cancelar suscripciones (sin updated_at que puede no existir)
    const { error: subErr } = await db()
      .from('suscripciones_owner')
      .update({ estado: 'cancelada' })
      .eq('owner_id', ownerId);
    if (subErr) console.error('[DELETE owner] suscripciones error:', subErr.message);

    // Marcar owner inactivo
    const { error: ownerErr } = await db()
      .from('owners')
      .update({ estado: 'inactivo' })
      .eq('id_owner', ownerId);
    if (ownerErr) throw ownerErr;

    // Eliminar usuario de Auth (revoca tokens)
    const { error: authErr } = await db().auth.admin.deleteUser(ownerId);
    if (authErr) {
      const msg = authErr.message?.toLowerCase() ?? '';
      // Supabase puede devolver "user not found" o "User not found" — ignorar ambos
      if (!msg.includes('not found') && !msg.includes('does not exist')) {
        console.error('[DELETE owner] auth.deleteUser error:', authErr.message);
        // No lanzar — los datos ya están desactivados, esto es best-effort
      }
    }

    // Audit log: fire-and-forget para que no bloquee si la tabla no existe aún
    db().from('audit_log').insert({
      actor_id:    (req as any).adminUserId,
      target_type: 'owner',
      target_id:   ownerId,
      action:      'delete_account',
      meta:        { nombre_empresa: owner.nombre_empresa, email: owner.email_contacto },
    }).then(({ error: auditErr }) => {
      if (auditErr) console.warn('[DELETE owner] audit_log error:', auditErr.message);
    });

    return res.json({ success: true, deleted: ownerId });
  } catch (err: any) {
    console.error('[DELETE owner] fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /hub/admin/impersonate/:ownerId ────────────────────────────────────

router.post('/impersonate/:ownerId', async (req, res) => {
  try {
    const adminUserId = (req as any).adminUserId;

    const { data: owner, error: ownerErr } = await db()
      .from('owners')
      .select('email_contacto, nombre_empresa')
      .eq('id_owner', req.params.ownerId)
      .maybeSingle();

    if (ownerErr || !owner) return res.status(404).json({ error: 'Owner no encontrado' });

    const hotelAppUrl = process.env.HOTEL_APP_URL || 'https://hotel.solarys.uk';

    const { data: linkData, error: linkErr } = await db().auth.admin.generateLink({
      type: 'magiclink',
      email: owner.email_contacto,
      options: { redirectTo: hotelAppUrl },
    });

    if (linkErr) throw linkErr;

    const actionLink = (linkData as any)?.properties?.action_link ?? null;
    if (!actionLink) throw new Error('No se pudo generar el enlace de acceso');

    void db().from('audit_log').insert({
      owner_id: req.params.ownerId,
      accion: 'soporte',
      entidad: 'impersonation',
      usuario_email: `admin:${adminUserId}`,
      cambios_resumidos: `Acceso de soporte generado por ${adminUserId}`,
    });

    return res.json({
      url: actionLink,
      email: owner.email_contacto,
      empresa: owner.nombre_empresa,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/admin/ai-usage ─────────────────────────────────────────────────

router.get('/ai-usage', async (req, res) => {
  try {
    const ownerId = req.query.ownerId as string | undefined;

    let base = db()
      .from('ai_usage_log')
      .select('owner_id, provider, input_tokens, output_tokens, created_at')
      .order('created_at', { ascending: false })
      .limit(ownerId ? 1000 : 500);

    const { data, error } = ownerId
      ? await base.eq('owner_id', ownerId)
      : await base;
    if (error) throw error;

    const rows: any[] = data ?? [];

    if (ownerId) {
      const totals = rows.reduce(
        (acc, r) => ({
          input:  acc.input  + (r.input_tokens  ?? 0),
          output: acc.output + (r.output_tokens ?? 0),
          total:  acc.total  + (r.input_tokens  ?? 0) + (r.output_tokens ?? 0),
          calls:  acc.calls  + 1,
        }),
        { input: 0, output: 0, total: 0, calls: 0 }
      );
      return res.json({ owner_id: ownerId, ...totals, recent: rows.slice(0, 20) });
    }

    const agg: Record<string, any> = {};
    for (const r of rows) {
      if (!agg[r.owner_id]) agg[r.owner_id] = { owner_id: r.owner_id, input: 0, output: 0, total: 0, calls: 0 };
      agg[r.owner_id].input  += r.input_tokens  ?? 0;
      agg[r.owner_id].output += r.output_tokens ?? 0;
      agg[r.owner_id].total  += (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
      agg[r.owner_id].calls  += 1;
    }
    return res.json(Object.values(agg));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /hub/admin/audit ─────────────────────────────────────────────────────

router.get('/audit', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const { data, error, count } = await db()
      .from('audit_log')
      .select('id, owner_id, id_hotel, accion, entidad, usuario_email, usuario_rol, cambios_resumidos, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return res.json({ data: data ?? [], total: count ?? 0, limit, offset });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
