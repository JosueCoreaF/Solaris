import { Request, Response } from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';

const db = () => supabaseAdmin ?? supabase;

// ──── GET /api/hotel/habitaciones ────────────────────────────────────────────
export const listarHabitaciones = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['x-business-id'] as string;

    let query = db()
      .from('habitaciones')
      .select(`
        id_habitacion,
        nombre_habitacion,
        codigo_habitacion,
        id_hotel,
        id_tipo_habitacion,
        tarifa_noche,
        capacidad,
        estado,
        piso,
        tipos_habitacion(nombre_tipo),
        hoteles(nombre_hotel)
      `)
      .order('piso', { ascending: true })
      .order('nombre_habitacion', { ascending: true });

    if (businessId && businessId !== 'all') {
      query = query.eq('id_hotel', businessId);
    }

    const { data, error } = await query;
    if (error) return res.status(400).json({ error: error.message });

    const mapped = (data || []).map((h: any) => ({
      id_habitacion: h.id_habitacion,
      nombre_habitacion: h.nombre_habitacion,
      codigo_habitacion: h.codigo_habitacion,
      id_hotel: h.id_hotel,
      hotel: h.hoteles?.nombre_hotel,
      id_tipo_habitacion: h.id_tipo_habitacion,
      tipo: h.tipos_habitacion?.nombre_tipo,
      tarifa_noche: h.tarifa_noche,
      capacidad: h.capacidad,
      estado: h.estado,
      piso: h.piso,
    }));

    res.json({ data: mapped });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al listar habitaciones' });
  }
};

// ──── POST /api/hotel/habitaciones ───────────────────────────────────────────
export const crearHabitacion = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['x-business-id'] as string;
    const {
      nombre_habitacion, codigo_habitacion, id_tipo_habitacion,
      tarifa_noche, capacidad, estado, piso
    } = req.body;

    if (!nombre_habitacion || !businessId) {
      return res.status(400).json({ error: 'nombre_habitacion y x-business-id son requeridos' });
    }

    const { data, error } = await db()
      .from('habitaciones')
      .insert({
        nombre_habitacion,
        codigo_habitacion: codigo_habitacion || null,
        id_hotel: businessId,
        id_tipo_habitacion: id_tipo_habitacion || null,
        tarifa_noche: tarifa_noche ? parseFloat(tarifa_noche) : null,
        capacidad: capacidad ? parseInt(capacidad) : 2,
        estado: estado || 'disponible',
        piso: piso ? parseInt(piso) : null,
      })
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al crear habitación' });
  }
};

// ──── PUT /api/hotel/habitaciones/:id ────────────────────────────────────────
export const actualizarHabitacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre_habitacion, codigo_habitacion, id_tipo_habitacion,
      tarifa_noche, capacidad, estado, piso
    } = req.body;

    const updatePayload: any = {};
    if (nombre_habitacion !== undefined) updatePayload.nombre_habitacion = nombre_habitacion;
    if (codigo_habitacion !== undefined) updatePayload.codigo_habitacion = codigo_habitacion;
    if (id_tipo_habitacion !== undefined) updatePayload.id_tipo_habitacion = id_tipo_habitacion;
    if (tarifa_noche !== undefined) updatePayload.tarifa_noche = parseFloat(tarifa_noche);
    if (capacidad !== undefined) updatePayload.capacidad = parseInt(capacidad);
    if (estado !== undefined) updatePayload.estado = estado;
    if (piso !== undefined) updatePayload.piso = parseInt(piso);

    const { data, error } = await db()
      .from('habitaciones')
      .update(updatePayload)
      .eq('id_habitacion', id)
      .select()
      .single();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al actualizar habitación' });
  }
};

// ──── DELETE /api/hotel/habitaciones/:id ─────────────────────────────────────
export const eliminarHabitacion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await db()
      .from('habitaciones')
      .delete()
      .eq('id_habitacion', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, message: 'Habitación eliminada' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al eliminar habitación' });
  }
};

// ──── GET /api/hotel/habitaciones/tipos ──────────────────────────────────────
export const listarTiposHabitacion = async (req: Request, res: Response) => {
  try {
    const { data, error } = await db()
      .from('tipos_habitacion')
      .select('id_tipo_habitacion, nombre_tipo, descripcion')
      .order('nombre_tipo');
    if (error) return res.status(400).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
