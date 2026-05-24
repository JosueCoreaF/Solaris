import { Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthenticatedRequest } from '../../middleware/auth';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const getDashboardSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ownerId = req.ownerId;
    if (!ownerId) {
      res.status(401).json({ error: 'Owner ID not found in request' });
      return;
    }

    // a) Obtener nombre y plan del owner
    const { data: ownerData, error: ownerError } = await supabaseAdmin
      .from('owners')
      .select('nombre_empresa, plan')
      .eq('id_owner', ownerId)
      .single();

    if (ownerError) {
      console.warn('Warning fetching owner:', ownerError.message);
    }

    // b) Obtener módulos y el ID de referencia del hotel
    const { data: modulesData, error: modulesError } = await supabaseAdmin
      .from('business_modules')
      .select('id_module, tipo_modulo, nombre_modulo, estado, hoteles(id_hotel)')
      .eq('owner_id', ownerId);

    if (modulesError) {
      console.warn('Warning fetching modules:', modulesError.message);
    }

    // Mapear al formato que espera el frontend
    const modulesInfo = (modulesData || []).map((m: any) => ({
      id: m.id_module,
      type: m.tipo_modulo ? m.tipo_modulo.toUpperCase() : 'HOTEL',
      name: m.nombre_modulo,
      reference_id: m.hoteles && m.hoteles.length > 0 ? m.hoteles[0].id_hotel : m.id_module,
      is_active: m.estado === 'activo'
    }));
    
    // Mock KPIs
    const negocios_activos = modulesInfo.length > 0 ? modulesInfo.filter((m: any) => m.is_active).length : 0;
    const ingresos = 45231.00;
    const ocupacion = 84;
    const tareas = 12;

    const ownerInfo = ownerData ? { nombre: ownerData.nombre_empresa, plan: ownerData.plan || 'Premium' } : { nombre: 'Propietario', plan: 'Premium' };

    res.json({
      owner: ownerInfo,
      modules: modulesInfo,
      kpis: {
        ingresos,
        negocios_activos,
        ocupacion,
        tareas
      }
    });
  } catch (error) {
    console.error('Error in getDashboardSummary:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
