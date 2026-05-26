import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

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

// Middleware para obtener y validar owner
const attachOwner = async (req: any, res: any, next: any) => {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'No autorizado' });

  const { data: roles } = await supabaseAdmin
    .from('usuarios_roles')
    .select('owner_id')
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .not('owner_id', 'is', null);

  if (!roles || roles.length === 0) {
    return res.status(400).json({ error: 'Perfil de propietario no encontrado.' });
  }

  req.owner_id = roles[0].owner_id;
  next();
};

router.use(attachOwner);

// Obtener tickets del owner
router.get('/tickets', async (req: any, res: any) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('soporte_tickets')
      .select('*, soporte_mensajes(*)')
      .eq('owner_id', req.owner_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Crear un ticket
router.post('/tickets', async (req: any, res: any) => {
  try {
    const { asunto, descripcion, prioridad = 'media' } = req.body;
    
    // 1. Crear el ticket
    const { data: ticket, error: ticketErr } = await supabaseAdmin
      .from('soporte_tickets')
      .insert({
        owner_id: req.owner_id,
        asunto,
        descripcion,
        prioridad
      })
      .select()
      .single();

    if (ticketErr) throw ticketErr;

    // 2. Crear el primer mensaje en el hilo
    const { error: msgErr } = await supabaseAdmin
      .from('soporte_mensajes')
      .insert({
        ticket_id: ticket.id_ticket,
        remitente: 'owner',
        mensaje: descripcion
      });

    if (msgErr) throw msgErr;

    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Responder a un ticket
router.post('/tickets/:id/mensajes', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { mensaje } = req.body;

    // Verificar propiedad del ticket
    const { data: ticket } = await supabaseAdmin
      .from('soporte_tickets')
      .select('id_ticket')
      .eq('id_ticket', id)
      .eq('owner_id', req.owner_id)
      .single();

    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    const { data, error } = await supabaseAdmin
      .from('soporte_mensajes')
      .insert({
        ticket_id: id,
        remitente: 'owner',
        mensaje
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
