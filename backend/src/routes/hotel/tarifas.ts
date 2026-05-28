import { Router, Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../../utils/tenantHelper.js';

const router = Router();

// ─── CATEGORÍAS DE TARIFA ───────────────────────────────────────────────────────

// GET /api/tarifas/categorias
router.get('/categorias', async (_req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categorias_tarifa')
      .select('*')
      .eq('activa', true)
      .order('nombre');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── TARIFAS ─────────────────────────────────────────────────────────────────────

// GET /api/tarifas
// Query params: ?id_tipo_habitacion=xxx&id_categoria=xxx&vigentes_solo=true
router.get('/', async (req, res) => {
  try {
    const { id_tipo_habitacion, id_categoria, vigentes_solo } = req.query;
    const hotelId = req.headers['x-hotel-id'] || 'all';
    
    let query = supabaseAdmin
      .from('tarifas')
      .select(`
        id_tarifa,
        id_tipo_habitacion,
        id_categoria,
        tarifa_noche,
        tarifa_hora,
        tarifa_pasadia,
        vigente_desde,
        vigente_hasta,
        activa,
        tipos_habitacion ( id_tipo_habitacion, nombre_tipo ),
        categorias_tarifa ( id_categoria, nombre )
      `);

    if (id_tipo_habitacion) query = query.eq('id_tipo_habitacion', id_tipo_habitacion);
    if (id_categoria) query = query.eq('id_categoria', id_categoria);
    if (vigentes_solo === 'true') {
      const hoy = new Date().toLocaleDateString('en-CA');
      query = query
        .lte('vigente_desde', hoy)
        .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`);
    }

    if (hotelId && hotelId !== 'all') {
      // Obtener los ids de tipos de habitación presentes en las habitaciones de este hotel
      const { data: habs, error: hErr } = await supabaseAdmin
        .from('habitaciones')
        .select('id_tipo_habitacion')
        .eq('id_hotel', hotelId);

      if (hErr) return res.status(400).json({ error: hErr.message });

      const idsTipos = [...new Set((habs ?? []).map(h => h.id_tipo_habitacion).filter(Boolean))];

      if (idsTipos.length === 0) {
        return res.json([]);
      }

      query = query.in('id_tipo_habitacion', idsTipos);
    }

    const { data, error } = await query.order('tipos_habitacion(nombre_tipo)').order('categorias_tarifa(nombre)');
    if (error) return res.status(500).json({ error: error.message });
    
    return res.json(
      (data ?? []).map((t: any) => ({
        ...t,
        tipo_habitacion: t.tipos_habitacion?.nombre_tipo ?? '',
        categoria: t.categorias_tarifa?.nombre ?? '',
        tipos_habitacion: undefined,
        categorias_tarifa: undefined,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/tarifas/vigentes (solo tarifas vigentes hoy)
router.get('/vigentes', async (req, res) => {
  try {
    const hoy = new Date().toLocaleDateString('en-CA');
    const hotelId = req.headers['x-hotel-id'] || 'all';
    
    let query = supabaseAdmin
      .from('tarifas')
      .select(`
        id_tarifa,
        id_tipo_habitacion,
        id_categoria,
        tarifa_noche,
        tarifa_hora,
        tarifa_pasadia,
        tipos_habitacion ( nombre_tipo ),
        categorias_tarifa ( nombre )
      `)
      .lte('vigente_desde', hoy)
      .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
      .eq('activa', true);

    if (hotelId && hotelId !== 'all') {
      // Obtener los ids de tipos de habitación presentes en las habitaciones de este hotel
      const { data: habs, error: hErr } = await supabaseAdmin
        .from('habitaciones')
        .select('id_tipo_habitacion')
        .eq('id_hotel', hotelId);

      if (hErr) return res.status(400).json({ error: hErr.message });

      const idsTipos = [...new Set((habs ?? []).map(h => h.id_tipo_habitacion).filter(Boolean))];

      if (idsTipos.length === 0) {
        return res.json([]);
      }

      query = query.in('id_tipo_habitacion', idsTipos);
    }

    const { data, error } = await query
      .order('tipos_habitacion(nombre_tipo)')
      .order('categorias_tarifa(nombre)');

    if (error) return res.status(500).json({ error: error.message });
    
    return res.json(
      (data ?? []).map((t: any) => ({
        ...t,
        tipo_habitacion: t.tipos_habitacion?.nombre_tipo ?? '',
        categoria: t.categorias_tarifa?.nombre ?? '',
        tipos_habitacion: undefined,
        categorias_tarifa: undefined,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/tarifas (crear tarifa)
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    const { ownerIds } = await getOwnerHotelIdsForUser(user);
    const owner_id = ownerIds[0];
    if (!owner_id) return res.status(401).json({ error: 'No hay propietario asociado' });

    const { id_tipo_habitacion, id_categoria, tarifa_noche, tarifa_hora, tarifa_pasadia, vigente_desde, vigente_hasta } = req.body;

    if (!id_tipo_habitacion || !id_categoria || tarifa_noche === undefined) {
      return res.status(400).json({ error: 'id_tipo_habitacion, id_categoria, tarifa_noche son requeridos' });
    }

    const { data, error } = await supabaseAdmin
      .from('tarifas')
      .insert({
        owner_id,
        id_tipo_habitacion,
        id_categoria,
        tarifa_noche: parseFloat(tarifa_noche),
        tarifa_hora: parseFloat(tarifa_hora) || 0,
        tarifa_pasadia: parseFloat(tarifa_pasadia) || 0,
        vigente_desde: vigente_desde || new Date().toLocaleDateString('en-CA'),
        vigente_hasta: vigente_hasta || null,
        activa: true,
      })
      .select(`
        id_tarifa,
        id_tipo_habitacion,
        id_categoria,
        tarifa_noche,
        tarifa_hora,
        tarifa_pasadia,
        tipos_habitacion ( nombre_tipo ),
        categorias_tarifa ( nombre )
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({
      ...data,
      tipo_habitacion: (data as any)?.tipos_habitacion?.nombre_tipo ?? '',
      categoria: (data as any)?.categorias_tarifa?.nombre ?? '',
      tipos_habitacion: undefined,
      categorias_tarifa: undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tarifas/:id (editar tarifa)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tarifa_noche, tarifa_hora, tarifa_pasadia, vigente_desde, vigente_hasta, activa } = req.body;

    const updates: any = {};
    if (tarifa_noche !== undefined) updates.tarifa_noche = parseFloat(tarifa_noche);
    if (tarifa_hora !== undefined) updates.tarifa_hora = parseFloat(tarifa_hora);
    if (tarifa_pasadia !== undefined) updates.tarifa_pasadia = parseFloat(tarifa_pasadia);
    if (vigente_desde !== undefined) updates.vigente_desde = vigente_desde;
    if (vigente_hasta !== undefined) updates.vigente_hasta = vigente_hasta;
    if (activa !== undefined) updates.activa = activa;

    const { data, error } = await supabaseAdmin
      .from('tarifas')
      .update(updates)
      .eq('id_tarifa', id)
      .select(`
        id_tarifa,
        id_tipo_habitacion,
        id_categoria,
        tarifa_noche,
        tarifa_hora,
        tarifa_pasadia,
        tipos_habitacion ( nombre_tipo ),
        categorias_tarifa ( nombre )
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({
      ...data,
      tipo_habitacion: (data as any)?.tipos_habitacion?.nombre_tipo ?? '',
      categoria: (data as any)?.categorias_tarifa?.nombre ?? '',
      tipos_habitacion: undefined,
      categorias_tarifa: undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tarifas/:id (borrar tarifa)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from('tarifas')
      .delete()
      .eq('id_tarifa', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
