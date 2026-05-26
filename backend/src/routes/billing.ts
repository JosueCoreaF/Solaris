import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-01-27.acacia',
});

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

// Map the UI plan id to Stripe Price ID (you should add these to your .env or DB)
const PLAN_PRICE_MAP: Record<string, string> = {
  basico: 'price_mock_basico',
  estandar: process.env.STRIPE_PRICE_ESTANDAR || 'price_mock_estandar',
  premium: process.env.STRIPE_PRICE_PREMIUM || 'price_mock_premium'
};

// POST /api/billing/checkout
router.post('/checkout', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { plan_id, return_url } = req.body;
    
    // Obtener owner asociado al usuario
    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo')
      .not('owner_id', 'is', null);
      
    if (!roles || roles.length === 0) {
       return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });
    }
    const owner_id = roles[0].owner_id;

    // Si es plan básico, solo actualizamos DB
    if (plan_id === 'basico') {
      await supabaseAdmin.from('suscripciones_owner').upsert({
         id_suscripcion: undefined,
         owner_id,
         id_plan: 'basico',
         estado: 'activa'
      }, { onConflict: 'owner_id' });
      return res.json({ success: true, url: return_url });
    }

    const priceId = PLAN_PRICE_MAP[plan_id];
    if (!priceId) return res.status(400).json({ error: 'Plan inválido' });

    // Crear Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${return_url}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${return_url}?canceled=true`,
      client_reference_id: owner_id,
      metadata: { owner_id, plan_id }
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/billing/plans
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabaseAdmin
      .from('planes_suscripcion')
      .select('*')
      .order('precio_mensual', { ascending: true });

    if (error) throw error;
    res.json(plans || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/billing/history
router.get('/history', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo');

    const validRoles = roles?.filter(r => r.owner_id != null) || [];
    if (validRoles.length === 0) return res.status(400).json({ error: 'Owner no encontrado' });
    const owner_id = validRoles[0].owner_id;

    const { data: history, error } = await supabaseAdmin
      .from('historial_pagos')
      .select('*')
      .eq('owner_id', owner_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(history || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/billing/status
router.get('/status', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo');

    const validRoles = roles?.filter(r => r.owner_id != null) || [];
    if (validRoles.length === 0) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });
    const owner_id = validRoles[0].owner_id;

    // Obtener TODAS las suscripciones (para todos los módulos)
    const { data: suscripciones, error } = await supabaseAdmin
      .from('suscripciones_owner')
      .select(`
        id_suscripcion,
        tipo_modulo,
        id_plan,
        estado,
        trial_end,
        current_period_end,
        negocios_extra,
        planes_suscripcion (
          nombre,
          limite_negocios,
          precio_mensual,
          precio_anual
        )
      `)
      .eq('owner_id', owner_id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(suscripciones || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/hub/billing/portal
router.post('/portal', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo')
      .not('owner_id', 'is', null);

    if (rolesErr) {
      console.error('[Portal] Error fetching roles:', rolesErr);
      return res.status(500).json({ error: 'Error interno obteniendo rol.' });
    }

    if (!roles || roles.length === 0) return res.status(400).json({ error: 'Perfil de propietario no encontrado en Portal.' });
    const owner_id = roles[0].owner_id;

    const { data: suscripcion, error: subErr } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('stripe_customer_id')
      .eq('owner_id', owner_id)
      .single();

    if (subErr) {
      console.error('[Portal] Error fetching sub:', subErr);
    }

    let customerId = suscripcion?.stripe_customer_id;

    const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_mock';

    if (isMock) {
      console.log(`[Portal] SIMULACIÓN: Redirigiendo a billing sin llamar a Stripe.`);
      const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
      
      // Si estamos simulando, guardamos un ID falso si no tenía
      if (!customerId) {
        await supabaseAdmin
          .from('suscripciones_owner')
          .update({ stripe_customer_id: 'cus_mock_123' })
          .eq('owner_id', owner_id);
      }
      
      // Simulamos que el portal nos devuelve a la misma página
      return res.json({ url: `${FRONTEND_URL}/billing?mock_success=true` });
    }

    if (!customerId) {
      // Necesitamos crear el customer en Stripe
      const { data: ownerInfo } = await supabaseAdmin
        .from('owners')
        .select('email_contacto, nombre_empresa')
        .eq('id_owner', owner_id)
        .single();
      
      console.log(`[Portal] Creating Stripe Customer for ${ownerInfo?.email_contacto}`);
      const newCustomer = await stripe.customers.create({
        email: ownerInfo?.email_contacto,
        name: ownerInfo?.nombre_empresa,
        metadata: { owner_id }
      });
      customerId = newCustomer.id;

      // Guardar en la DB
      await supabaseAdmin
        .from('suscripciones_owner')
        .update({ stripe_customer_id: customerId })
        .eq('owner_id', owner_id);
    }

    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5174';
    
    console.log(`[Portal] Creating billing portal session for customer: ${customerId}`);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/billing`,
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[Portal] Fatal error:', err);
    // Cambiamos a 500 para asegurarnos que los errores de Stripe no se confundan con un 400 propio
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/upgrade
router.post('/upgrade', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { plan_id, tipo_modulo = 'hotel' } = req.body;
    if (!plan_id) return res.status(400).json({ error: 'plan_id es requerido' });

    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo');

    const validRoles = roles?.filter(r => r.owner_id != null) || [];
    if (validRoles.length === 0) return res.status(400).json({ error: 'Owner no encontrado' });
    const owner_id = validRoles[0].owner_id;

    // Obtener precio del plan para el historial
    const { data: planData } = await supabaseAdmin
      .from('planes_suscripcion')
      .select('precio_mensual')
      .eq('id_plan', plan_id)
      .single();
    const monto = planData?.precio_mensual || 0;

    const endDate = new Date();
    // Simulamos que pagan por 1 mes
    endDate.setMonth(endDate.getMonth() + 1);

    // Verificamos si ya existe una suscripción para hacer UPDATE o INSERT
    const { data: existingSub } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_suscripcion')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    // Intentar recuperar el stripe_customer_id del owner para no perder métodos de pago
    const { data: anySubWithStripe } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('stripe_customer_id')
      .eq('owner_id', owner_id)
      .not('stripe_customer_id', 'is', null)
      .limit(1);
    const stripeCustomerId = anySubWithStripe?.[0]?.stripe_customer_id || null;

    let updateErr;

    if (existingSub) {
      const { error } = await supabaseAdmin
        .from('suscripciones_owner')
        .update({
          id_plan: plan_id,
          estado: 'activa',
          current_period_end: endDate.toISOString(),
          // Actualizamos también por si aca no lo tenía
          ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {})
        })
        .eq('id_suscripcion', existingSub.id_suscripcion);
      updateErr = error;
    } else {
      const { error } = await supabaseAdmin
        .from('suscripciones_owner')
        .insert({
          owner_id: owner_id,
          tipo_modulo: tipo_modulo,
          id_plan: plan_id,
          estado: 'activa',
          current_period_end: endDate.toISOString(),
          stripe_customer_id: stripeCustomerId
        });
      updateErr = error;
    }

    if (!updateErr) {
      // Registrar pago en el historial
      await supabaseAdmin.from('historial_pagos').insert({
        owner_id,
        monto,
        concepto: `Suscripción ${plan_id.toUpperCase()}`,
        metodo_pago: 'tarjeta',
        estado: 'completado'
      });
    }

    if (updateErr) {
      console.error('[Upgrade Error] Supabase update failed:', updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Upgrade Error] Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/addon
router.post('/addon', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { tipo_modulo = 'hotel' } = req.body;

    const { data: roles } = await supabaseAdmin
      .from('usuarios_roles')
      .select('owner_id')
      .eq('usuario_id', user.id)
      .eq('estado', 'activo');

    const validRoles = roles?.filter(r => r.owner_id != null) || [];
    if (validRoles.length === 0) return res.status(400).json({ error: 'Owner no encontrado' });
    const owner_id = validRoles[0].owner_id;

    const { data: sub } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_suscripcion, negocios_extra')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    const currentExtras = sub?.negocios_extra || 0;
    const montoAddon = 20.00; // Hardcoded addon price for now

    if (sub) {
      await supabaseAdmin
        .from('suscripciones_owner')
        .update({ negocios_extra: currentExtras + 1 })
        .eq('id_suscripcion', sub.id_suscripcion);
    } else {
      await supabaseAdmin
        .from('suscripciones_owner')
        .insert({
          owner_id: owner_id,
          tipo_modulo: tipo_modulo,
          id_plan: `basico_${tipo_modulo}`,
          estado: 'activa',
          negocios_extra: 1
        });
    }

    // Registrar pago
    await supabaseAdmin.from('historial_pagos').insert({
      owner_id,
      monto: montoAddon,
      concepto: `Cupo Extra - ${tipo_modulo.toUpperCase()}`,
      metodo_pago: 'tarjeta',
      estado: 'completado'
    });

    res.json({ success: true, negocios_extra: currentExtras + 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const owner_id = session.metadata?.owner_id;
    const plan_id = session.metadata?.plan_id;

    if (owner_id && plan_id) {
       await supabaseAdmin.from('suscripciones_owner').upsert({
         owner_id,
         id_plan: plan_id,
         stripe_customer_id: session.customer as string,
         stripe_subscription_id: session.subscription as string,
         estado: 'activa'
       }, { onConflict: 'owner_id' });
    }
  }

  res.json({ received: true });
});

export default router;
