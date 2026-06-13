import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  sendSubscriptionConfirmationEmail,
  sendSubscriptionCancelScheduledEmail,
  sendSubscriptionReactivatedEmail,
} from '../utils/emailService.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-01-27.acacia' as any,
});

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getUserFromToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.slice(7));
  if (error || !user) return null;
  return user;
}

async function resolveOwnerId(userId: string): Promise<string | null> {
  // Propietario directo (owners.id_owner = auth.uid)
  const { data: owner } = await supabaseAdmin
    .from('owners').select('id_owner').eq('id_owner', userId).maybeSingle();
  if (owner?.id_owner) return owner.id_owner;

  // Staff (usuarios_roles.user_id)
  const { data: role } = await supabaseAdmin
    .from('usuarios_roles').select('owner_id')
    .eq('user_id', userId).eq('estado', 'activo')
    .not('owner_id', 'is', null).limit(1).maybeSingle();
  return role?.owner_id ?? null;
}

// Cuenta los negocios activos de un owner para un módulo, usado para validar
// degradaciones de plan y la eliminación de cupos extra.
async function countActiveBusinesses(owner_id: string, tipo_modulo: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('business_modules')
    .select('id_module', { count: 'exact', head: true })
    .eq('owner_id', owner_id)
    .eq('tipo_modulo', tipo_modulo)
    .eq('estado', 'activo');
  return count || 0;
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
    
    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });

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

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    const { data: historial, error } = await supabaseAdmin
      .from('historial_pagos')
      .select('*')
      .eq('owner_id', owner_id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(historial || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/hub/billing/status
router.get('/status', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });

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
        cancel_at_period_end,
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
// GET /api/hub/billing/payment-methods
router.get('/payment-methods', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    const { data, error } = await supabaseAdmin
      .from('owner_metodos_pago')
      .select('*')
      .eq('owner_id', owner_id)
      .order('is_default', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/payment-methods
router.post('/payment-methods', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    const { brand, last4 } = req.body;
    if (!brand || !last4) return res.status(400).json({ error: 'Faltan datos de la tarjeta simulada' });

    // Desmarcar otros como default
    await supabaseAdmin
      .from('owner_metodos_pago')
      .update({ is_default: false })
      .eq('owner_id', owner_id);

    const { data, error } = await supabaseAdmin
      .from('owner_metodos_pago')
      .insert({
        owner_id,
        brand,
        last4,
        is_default: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Activar suscripciones impagas
    await supabaseAdmin
      .from('suscripciones_owner')
      .update({ estado: 'activa' })
      .eq('owner_id', owner_id)
      .eq('estado', 'impaga');

    res.json({ success: true, paymentMethod: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/hub/billing/portal
router.post('/portal', async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });

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

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    // Obtener precio y límite del plan para el historial y la validación de downgrade
    const { data: planData } = await supabaseAdmin
      .from('planes_suscripcion')
      .select('nombre, precio_mensual, limite_negocios')
      .eq('id_plan', plan_id)
      .single();
    const monto = planData?.precio_mensual || 0;

    const endDate = new Date();
    // Simulamos que pagan por 1 mes
    endDate.setMonth(endDate.getMonth() + 1);

    // Verificamos si ya existe una suscripción para hacer UPDATE o INSERT
    const { data: existingSub } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_suscripcion, negocios_extra')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    // Si ya tiene negocios activos, validar que el plan destino los soporte (downgrade)
    if (existingSub) {
      const targetCapacity = (planData?.limite_negocios || 1) + (existingSub.negocios_extra || 0);
      const activeCount = await countActiveBusinesses(owner_id, tipo_modulo);
      if (activeCount > targetCapacity) {
        return res.status(400).json({
          error: 'DOWNGRADE_BLOCKED',
          active: activeCount,
          limite: targetCapacity,
        });
      }
    }

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
          cancel_at_period_end: false,
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
          cancel_at_period_end: false,
          stripe_customer_id: stripeCustomerId
        });
      updateErr = error;
    }

    if (!updateErr) {
      // Intentar obtener el metodo principal (simulado) para el historial
      const { data: pmData } = await supabaseAdmin
        .from('owner_metodos_pago')
        .select('brand, last4')
        .eq('owner_id', owner_id)
        .eq('is_default', true)
        .maybeSingle();

      const metodoStr = pmData ? `${pmData.brand} ****${pmData.last4}` : 'Stripe Checkout';

      await supabaseAdmin.from('historial_pagos').insert({
        owner_id,
        concepto: `Suscripción Plan ${plan_id} (${tipo_modulo})`,
        metodo_pago: metodoStr,
        monto: monto,
        estado: 'completado'
      });
    }

    if (updateErr) {
      console.error('[Upgrade Error] Supabase update failed:', updateErr);
      return res.status(500).json({ error: updateErr.message });
    }

    // Notificar por correo (cubre actualizar, degradar y renovar plan)
    const { data: ownerEmailData } = await supabaseAdmin
      .from('owners')
      .select('email_contacto, nombre_empresa')
      .eq('id_owner', owner_id)
      .maybeSingle();

    if (ownerEmailData?.email_contacto) {
      void sendSubscriptionConfirmationEmail({
        ownerEmail: ownerEmailData.email_contacto,
        ownerName: ownerEmailData.nombre_empresa,
        planName: planData?.nombre,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[Upgrade Error] Exception:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/cancel
// Cancela la suscripción al final del período actual (el acceso se mantiene
// hasta current_period_end, igual que Stripe).
router.post('/cancel', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { tipo_modulo = 'hotel' } = req.body;
    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    const { data: sub } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_suscripcion, estado, current_period_end, id_plan')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    if (!sub) return res.status(404).json({ error: 'Suscripción no encontrada' });
    if (sub.estado !== 'activa' && sub.estado !== 'trial') {
      return res.status(400).json({ error: 'No se puede cancelar una suscripción en este estado' });
    }

    await supabaseAdmin
      .from('suscripciones_owner')
      .update({ cancel_at_period_end: true })
      .eq('id_suscripcion', sub.id_suscripcion);

    const [{ data: ownerEmailData }, { data: planData }] = await Promise.all([
      supabaseAdmin.from('owners').select('email_contacto, nombre_empresa').eq('id_owner', owner_id).maybeSingle(),
      supabaseAdmin.from('planes_suscripcion').select('nombre').eq('id_plan', sub.id_plan).maybeSingle(),
    ]);

    if (ownerEmailData?.email_contacto) {
      void sendSubscriptionCancelScheduledEmail({
        ownerEmail: ownerEmailData.email_contacto,
        ownerName: ownerEmailData.nombre_empresa,
        planName: planData?.nombre,
        periodEnd: sub.current_period_end || undefined,
      });
    }

    res.json({ success: true, cancel_at_period_end: true, current_period_end: sub.current_period_end });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/reactivate
// Deshace una cancelación programada (cancel_at_period_end -> false).
router.post('/reactivate', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { tipo_modulo = 'hotel' } = req.body;
    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    const { data: sub } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_suscripcion, id_plan')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    if (!sub) return res.status(404).json({ error: 'Suscripción no encontrada' });

    await supabaseAdmin
      .from('suscripciones_owner')
      .update({ cancel_at_period_end: false })
      .eq('id_suscripcion', sub.id_suscripcion);

    const [{ data: ownerEmailData }, { data: planData }] = await Promise.all([
      supabaseAdmin.from('owners').select('email_contacto, nombre_empresa').eq('id_owner', owner_id).maybeSingle(),
      supabaseAdmin.from('planes_suscripcion').select('nombre').eq('id_plan', sub.id_plan).maybeSingle(),
    ]);

    if (ownerEmailData?.email_contacto) {
      void sendSubscriptionReactivatedEmail({
        ownerEmail: ownerEmailData.email_contacto,
        ownerName: ownerEmailData.nombre_empresa,
        planName: planData?.nombre,
      });
    }

    res.json({ success: true, cancel_at_period_end: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/addon
router.post('/addon', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { tipo_modulo = 'hotel' } = req.body;

    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

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

    // Intentar obtener el metodo principal (simulado) para el historial
    const { data: pmData } = await supabaseAdmin
      .from('owner_metodos_pago')
      .select('brand, last4')
      .eq('owner_id', owner_id)
      .eq('is_default', true)
      .maybeSingle();

    const metodoStr = pmData ? `${pmData.brand} ****${pmData.last4}` : 'Stripe Checkout';

    await supabaseAdmin.from('historial_pagos').insert({
      owner_id,
      concepto: `Cupo Extra de Negocio (${tipo_modulo})`,
      metodo_pago: metodoStr,
      monto: montoAddon,
      estado: 'completado'
    });

    res.json({ success: true, negocios_extra: currentExtras + 1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/hub/billing/addon/remove
// Quita un cupo extra, validando que el plan siga cubriendo los negocios activos.
router.post('/addon/remove', express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { tipo_modulo = 'hotel' } = req.body;
    const owner_id = await resolveOwnerId(user.id);
    if (!owner_id) return res.status(400).json({ error: 'Owner no encontrado' });

    const { data: sub } = await supabaseAdmin
      .from('suscripciones_owner')
      .select('id_suscripcion, negocios_extra, id_plan')
      .eq('owner_id', owner_id)
      .eq('tipo_modulo', tipo_modulo)
      .maybeSingle();

    if (!sub || (sub.negocios_extra || 0) <= 0) {
      return res.status(400).json({ error: 'NO_EXTRA_SLOTS' });
    }

    const { data: planData } = await supabaseAdmin
      .from('planes_suscripcion')
      .select('limite_negocios')
      .eq('id_plan', sub.id_plan)
      .maybeSingle();

    const newExtra = sub.negocios_extra - 1;
    const capacity = (planData?.limite_negocios || 1) + newExtra;
    const activeCount = await countActiveBusinesses(owner_id, tipo_modulo);

    if (activeCount > capacity) {
      return res.status(400).json({ error: 'ADDON_REMOVE_BLOCKED', active: activeCount, limite: capacity });
    }

    await supabaseAdmin
      .from('suscripciones_owner')
      .update({ negocios_extra: newExtra })
      .eq('id_suscripcion', sub.id_suscripcion);

    res.json({ success: true, negocios_extra: newExtra });
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
    const session = event.data.object as any;
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
