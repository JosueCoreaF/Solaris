import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthenticatedRequest } from '../../middleware/auth';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const createBusiness = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.ownerId) {
      res.status(401).json({ error: 'Owner ID no encontrado en la petición' });
      return;
    }

    const { plan_id, nombre_hotel, ciudad, direccion, telefono, correo_contacto } = req.body;

    if (!plan_id || !nombre_hotel) {
      res.status(400).json({ error: 'Faltan parámetros requeridos: plan_id, nombre_hotel' });
      return;
    }

    // a) Inserta el módulo en public.business_modules
    const { data: moduleData, error: moduleErr } = await supabaseAdmin
      .from('business_modules')
      .insert({
         owner_id: req.ownerId,
         tipo_modulo: 'hotel',
         nombre_modulo: nombre_hotel,
         estado: 'activo'
      })
      .select('id_module')
      .single();

    if (moduleErr) {
      throw new Error(`Error al insertar module: ${moduleErr.message}`);
    }

    // b) Inserta el hotel en public.hoteles
    const { data: hotel, error: hotelErr } = await supabaseAdmin
      .from('hoteles')
      .insert({
         nombre_hotel: nombre_hotel,
         ciudad: ciudad,
         direccion: direccion,
         telefono: telefono,
         correo_contacto: correo_contacto,
         owner_id: req.ownerId, 
         id_module: moduleData.id_module,
         estado: 'activo'
      })
      .select('id_hotel')
      .single();

    if (hotelErr) {
      // Eliminar el modulo si el hotel falla
      await supabaseAdmin.from('business_modules').delete().eq('id_module', moduleData.id_module);
      
      if (hotelErr.code === '23505') { // Postgres Unique Violation
        res.status(400).json({ error: 'Ya existe un hotel con ese nombre.' });
        return;
      }
      throw new Error(`Error al insertar hotel: ${hotelErr.message}`);
    }

    // c) Retorna estado
    res.status(201).json({ success: true, businessId: hotel.id_hotel });
  } catch (error: any) {
    console.error('Error in createBusiness:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor al crear negocio' });
  }
};
