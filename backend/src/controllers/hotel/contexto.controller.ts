import { Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';

export const syncContext = async (req: Request, res: Response) => {
  try {
    const businessId = req.headers['business-id'] || req.query.business_id;

    if (!businessId) {
      return res.status(400).json({ error: 'business_id es requerido en headers o query' });
    }

    // 1. Intentar buscar por id_module (que es el ID del módulo proveniente del Hub)
    const { data: hotelByModule, error: moduleError } = await supabaseAdmin!
      .from('hoteles')
      .select('*')
      .eq('id_module', businessId)
      .single();

    let hotel = hotelByModule;

    // 2. Si no se encuentra, intentar buscar por id_hotel directamente como fallback
    if (moduleError || !hotel) {
      const { data: hotelById, error: idError } = await supabaseAdmin!
        .from('hoteles')
        .select('*')
        .eq('id_hotel', businessId)
        .single();
      
      if (!idError && hotelById) {
        hotel = hotelById;
      }
    }

    if (!hotel) {
      return res.status(404).json({ error: 'Hotel no encontrado para el módulo o ID especificado' });
    }

    return res.status(200).json({ data: hotel });
  } catch (err: any) {
    console.error('Error en syncContext:', err);
    return res.status(500).json({ error: err.message });
  }
};
