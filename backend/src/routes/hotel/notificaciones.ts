import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
const db = () => supabaseAdmin!;

// GET /api/hotel/notificaciones - últimas notificaciones del hotel activo
router.get('/', async (req: Request, res: Response) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

  const { data, error } = await db()
    .from('notificaciones')
    .select('*')
    .eq('id_hotel', hotelId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// GET /api/hotel/notificaciones/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

  const { count, error } = await db()
    .from('notificaciones')
    .select('*', { count: 'exact', head: true })
    .eq('id_hotel', hotelId)
    .eq('leida', false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count ?? 0 });
});

// PATCH /api/hotel/notificaciones/:id/leer - marcar una como leída
router.patch('/:id/leer', async (req: Request, res: Response) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });
  const { id } = req.params;

  const { error } = await db()
    .from('notificaciones')
    .update({ leida: true })
    .eq('id_notificacion', id)
    .eq('id_hotel', hotelId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// POST /api/hotel/notificaciones/leer-todas - marcar todas como leídas
router.post('/leer-todas', async (req: Request, res: Response) => {
  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'x-hotel-id requerido' });

  const { error } = await db()
    .from('notificaciones')
    .update({ leida: true })
    .eq('id_hotel', hotelId)
    .eq('leida', false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

export default router;
