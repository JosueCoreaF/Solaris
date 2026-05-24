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

// POST /api/billing/webhook
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
