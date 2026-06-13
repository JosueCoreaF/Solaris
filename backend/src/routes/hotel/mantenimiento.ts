import express, { Request, Response } from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';
import { getAuthUser, getOwnerIdsFromHotelId } from '../../utils/tenantHelper.js';

const router = express.Router();
const db = () => supabaseAdmin ?? supabase;

// GET /api/hotel/mantenimiento/tareas
router.get('/tareas', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId || hotelId === 'all') return res.status(400).json({ error: 'Hotel requerido' });

    const { estado, prioridad, id_habitacion } = req.query;

    let query = db()
      .from('tareas_mantenimiento')
      .select(`
        *,
        habitaciones(nombre_habitacion, codigo_habitacion, piso)
      `)
      .eq('id_hotel', hotelId)
      .order('created_at', { ascending: false });

    if (estado) query = query.eq('estado', estado as string);
    if (prioridad) query = query.eq('prioridad', prioridad as string);
    if (id_habitacion) query = query.eq('id_habitacion', id_habitacion as string);

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data || []);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// POST /api/hotel/mantenimiento/tareas
router.post('/tareas', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string;
    if (!hotelId) return res.status(400).json({ error: 'Hotel requerido' });

    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const ownerIds = await getOwnerIdsFromHotelId(hotelId);
    if (!ownerIds?.length) return res.status(403).json({ error: 'Sin acceso' });

    const { titulo, descripcion, prioridad, id_habitacion, fecha_limite, asignado_a, asignado_nombre } = req.body;
    if (!titulo?.trim()) return res.status(400).json({ error: 'Título requerido' });

    const { data, error } = await db()
      .from('tareas_mantenimiento')
      .insert({
        id_hotel: hotelId,
        owner_id: ownerIds[0],
        titulo: titulo.trim(),
        descripcion: descripcion || null,
        prioridad: prioridad || 'media',
        id_habitacion: id_habitacion || null,
        fecha_limite: fecha_limite || null,
        asignado_a: asignado_a || null,
        asignado_nombre: asignado_nombre || null,
        creado_por: user.id,
        creado_nombre: user.email,
      })
      .select(`*, habitaciones(nombre_habitacion, codigo_habitacion, piso)`)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /api/hotel/mantenimiento/tareas/:id
router.patch('/tareas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;

    const allowed = ['estado', 'prioridad', 'descripcion', 'titulo', 'notas', 'asignado_a', 'asignado_nombre', 'fecha_limite'];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.estado === 'completada' && !updates.completada_at) {
      updates.completada_at = new Date().toISOString();
    }

    const { data, error } = await db()
      .from('tareas_mantenimiento')
      .update(updates)
      .eq('id_tarea', id)
      .eq('id_hotel', hotelId)
      .select(`*, habitaciones(nombre_habitacion, codigo_habitacion, piso)`)
      .single();

    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// DELETE /api/hotel/mantenimiento/tareas/:id
router.delete('/tareas/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.headers['x-hotel-id'] as string;

    const { error } = await db()
      .from('tareas_mantenimiento')
      .delete()
      .eq('id_tarea', id)
      .eq('id_hotel', hotelId);

    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

export default router;
