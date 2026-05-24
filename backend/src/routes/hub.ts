import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET - Listar módulos del usuario autenticado (negocios)
router.get(['/business', '/businesses'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    const { data, error } = await supabaseAdmin
      .from('business_modules')
      .select('*')
      .eq('owner_id', user.id)
      .eq('estado', 'activo');

    if (error) return res.status(400).json({ error: error.message });
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Crear nuevo negocio (hotel)
router.post(['/business', '/businesses'], async (req, res) => {
  try {
    const { nombre_hotel, ciudad, plan_id } = req.body;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    // Crear módulo
    const { data: mod, error: modErr } = await supabaseAdmin
      .from('business_modules')
      .insert({ owner_id: user.id, tipo_modulo: 'hotel', nombre_modulo: nombre_hotel, estado: 'activo' })
      .select('id_module').single();

    if (modErr) return res.status(400).json({ error: modErr.message });

    // Crear hotel
    const { data: hotel, error: hotelErr } = await supabaseAdmin
      .from('hoteles')
      .insert({ nombre_hotel, ciudad: ciudad ?? null, owner_id: user.id, id_module: mod.id_module, estado: 'activo' })
      .select().single();

    if (hotelErr) {
      await supabaseAdmin.from('business_modules').delete().eq('id_module', mod.id_module);
      return res.status(400).json({ error: hotelErr.message });
    }

    res.status(201).json({ success: true, businessId: hotel.id_hotel, data: hotel });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Resumen del dashboard (KPIs + módulos del owner)
router.get('/dashboard-summary', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No authorization header' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

    // Obtener módulos activos del owner
    const { data: modules, error: modErr } = await supabaseAdmin
      .from('business_modules')
      .select('id_module, tipo_modulo, nombre_modulo, estado')
      .eq('owner_id', user.id)
      .eq('estado', 'activo');

    if (modErr) return res.status(400).json({ error: modErr.message });

    // Obtener hoteles para calcular KPIs básicos
    const hotelIds = (modules || []).map((m: any) => m.id_module);
    let ingresos = 0;
    let ocupacion = 0;

    if (hotelIds.length > 0) {
      // Ingresos del mes actual
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: pagos } = await supabaseAdmin
        .from('pagos_hotel')
        .select('monto')
        .eq('owner_id', user.id)
        .gte('created_at', startOfMonth.toISOString())
        .eq('estado', 'aplicado');

      ingresos = (pagos || []).reduce((sum: number, p: any) => sum + Number(p.monto), 0);

      // Ocupación: habitaciones ocupadas / total
      const { data: habitaciones } = await supabaseAdmin
        .from('habitaciones')
        .select('estado')
        .eq('owner_id', user.id);

      const total = (habitaciones || []).length;
      const ocupadas = (habitaciones || []).filter((h: any) => h.estado === 'ocupada').length;
      ocupacion = total > 0 ? Math.round((ocupadas / total) * 100) : 0;
    }

    res.json({
      owner: {
        nombre: user.email?.split('@')[0] || 'Usuario',
        plan: 'Profesional',
      },
      modules: (modules || []).map((m: any) => ({
        id: m.id_module,
        type: m.tipo_modulo ? m.tipo_modulo.toUpperCase() : 'HOTEL',
        reference_id: m.id_module,
        is_active: m.estado === 'activo',
        name: m.nombre_modulo,
      })),
      kpis: {
        ingresos,
        negocios_activos: (modules || []).length,
        ocupacion,
        tareas: 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
