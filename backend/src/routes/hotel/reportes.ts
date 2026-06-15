import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../../config/supabase';

const router = Router();
const db = () => supabaseAdmin;

/** Devuelve {desde, hasta} en formato YYYY-MM-DD segÃºn el perÃ­odo */
function rangoPeriodo(periodo: string): { desde: string; hasta: string } {
  const ahora = new Date();
  const hasta = ahora.toLocaleDateString('en-CA');
  const desde = new Date(ahora);

  if (periodo === 'semana') desde.setDate(ahora.getDate() - 7);
  else if (periodo === 'trimestre') desde.setDate(ahora.getDate() - 90);
  else if (periodo === 'aÃ±o') desde.setFullYear(ahora.getFullYear() - 1);
  else desde.setDate(ahora.getDate() - 30); // mes por defecto

  return { desde: desde.toLocaleDateString('en-CA'), hasta };
}

// GET /api/reportes/dashboard-ocupacion
// Avance 2 (ABD2, Grupo 3) - Consulta avanzada 1: dashboard de ocupación e
// ingresos por hotel (JOIN múltiple + agregación condicional con FILTER).
router.get('/dashboard-ocupacion', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'];

    const { data, error } = await db().rpc('fn_dashboard_ocupacion_ingresos', {
      p_hotel_id: hotelId && hotelId !== 'all' ? hotelId : null,
    });

    if (error) throw error;

    return res.json({ data });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/reportes/estadisticas
router.get('/estadisticas', async (req: Request, res: Response) => {
  try {
    const { periodo = 'mes' } = req.query;
    const { desde, hasta } = rangoPeriodo(periodo as string);
    const hotelId = req.headers['x-hotel-id'];

    // 1. Total reservas en el período (excluyendo canceladas)
    let queryRes = db()
      .from('reservas_hotel')
      .select('id_reserva_hotel, estado, check_in, check_out, total_reserva')
      .neq('estado', 'cancelada')
      .gte('check_in', desde)
      .lte('check_in', hasta);

    if (hotelId && hotelId !== 'all') {
      queryRes = queryRes.eq('id_hotel', hotelId);
    }

    const { data: reservas, error: resErr } = await queryRes;

    if (resErr) throw resErr;

    const totalReservas = reservas?.length ?? 0;

    // 2. Ingresos: suma de pagos cobrados en el período
    let queryPagos = db()
      .from('pagos_hotel')
      .select('monto, fecha_pago, reservas_hotel!inner(id_hotel)')
      .neq('estado', 'anulado')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta);

    if (hotelId && hotelId !== 'all') {
      queryPagos = queryPagos.eq('reservas_hotel.id_hotel', hotelId);
    }

    const { data: pagos, error: pagErr } = await queryPagos;

    if (pagErr) throw pagErr;

    const totalIngresos = (pagos ?? []).reduce((s, p: any) => s + (p.monto ?? 0), 0);

    // 3. Total habitaciones para calcular ocupación
    let queryHab = db()
      .from('habitaciones')
      .select('*', { count: 'exact', head: true })
      .neq('estado', 'inactiva');

    if (hotelId && hotelId !== 'all') {
      queryHab = queryHab.eq('id_hotel', hotelId);
    }

    const { count: totalHabitaciones } = await queryHab;

    const habs = totalHabitaciones ?? 1;

    // 4. OcupaciÃ³n promedio: dÃ­as con al menos 1 reserva activa / total dÃ­as del perÃ­odo
    const diasPeriodo = Math.max(
      1,
      Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000)
    );
    // AproximaciÃ³n: reservas activas promedio / total habitaciones
    const reservasActivas = (reservas ?? []).filter(
      (r: any) => !['cancelada', 'no_show'].includes(r.estado)
    );
    const ocupacionPromedio = Math.min(
      100,
      Math.round((reservasActivas.length / Math.max(1, diasPeriodo * habs)) * 100)
    );

    // 5. Tasa de ocupaciÃ³n por los Ãºltimos 7 dÃ­as
    const tasaOcupacion: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const diaStr = dia.toLocaleDateString('en-CA');
      const activas = (reservas ?? []).filter(
        (r: any) => r.check_in <= diaStr && r.check_out > diaStr && r.estado !== 'cancelada'
      ).length;
      tasaOcupacion.push(Math.min(100, Math.round((activas / habs) * 100)));
    }

    // 6. Ingresos por dÃ­a de la semana (Ãºltimos 7 dÃ­as)
    const diasSemana = ['Dom', 'Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b'];
    const ingresoPorDia: { dia: string; ingreso: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const diaStr = dia.toLocaleDateString('en-CA');
      const ingreso = (pagos ?? [])
        .filter((p: any) => p.fecha_pago === diaStr)
        .reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
      ingresoPorDia.push({ dia: diasSemana[dia.getDay()], ingreso });
    }

    // 7. Reservas por estado
    const estadoCount: Record<string, number> = {};
    for (const r of reservas ?? []) {
      const label =
        r.estado === 'check_out' ? 'Finalizada'
        : r.estado === 'check_in' ? 'En curso'
        : r.estado === 'confirmada' ? 'Confirmada'
        : r.estado ?? 'Otro';
      estadoCount[label] = (estadoCount[label] ?? 0) + 1;
    }

    // Incluir canceladas en el conteo de estado
    let queryCanceladas = db()
      .from('reservas_hotel')
      .select('id_reserva_hotel', { count: 'exact', head: false })
      .eq('estado', 'cancelada')
      .gte('check_in', desde)
      .lte('check_in', hasta);

    if (hotelId && hotelId !== 'all') {
      queryCanceladas = queryCanceladas.eq('id_hotel', hotelId);
    }

    const { data: canceladas } = await queryCanceladas;
    if ((canceladas?.length ?? 0) > 0) {
      estadoCount['Cancelada'] = canceladas!.length;
    }

    const reservasPorEstado = Object.entries(estadoCount).map(([estado, cantidad]) => ({
      estado,
      cantidad,
    }));

    return res.json({
      ocupacionPromedio,
      totalReservas,
      totalIngresos: Math.round(totalIngresos),
      tasaOcupacion,
      ingresoPorDia,
      reservasPorEstado,
    });
  } catch (error: any) {
    console.error('Error en reportes/estadisticas:', error);
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/reportes/ocupacion
router.get('/ocupacion', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const desde = (startDate as string) || new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA');
    const hasta = (endDate as string) || new Date().toLocaleDateString('en-CA');
    const hotelId = req.headers['x-hotel-id'];

    let queryRes = db()
      .from('reservas_hotel')
      .select('check_in, check_out, estado')
      .neq('estado', 'cancelada')
      .lt('check_in', hasta)
      .gt('check_out', desde);

    if (hotelId && hotelId !== 'all') {
      queryRes = queryRes.eq('id_hotel', hotelId);
    }

    const { data: reservas, error } = await queryRes;

    if (error) throw error;

    let queryHab = db()
      .from('habitaciones')
      .select('*', { count: 'exact', head: true })
      .neq('estado', 'inactiva');

    if (hotelId && hotelId !== 'all') {
      queryHab = queryHab.eq('id_hotel', hotelId);
    }

    const { count: totalHabitaciones } = await queryHab;

    const habs = totalHabitaciones ?? 1;

    // Calcular ocupaciÃ³n por dÃ­a
    const dias: any[] = [];
    const d = new Date(desde);
    while (d.toLocaleDateString('en-CA') <= hasta) {
      const diaStr = d.toLocaleDateString('en-CA');
      const ocupadas = (reservas ?? []).filter(
        (r: any) => r.check_in <= diaStr && r.check_out > diaStr
      ).length;
      const pct = Math.min(100, Math.round((ocupadas / habs) * 100));
      dias.push({ fecha: diaStr, ocupacion: pct, habitacionesOcupadas: ocupadas, habitacionesTotales: habs });
      d.setDate(d.getDate() + 1);
    }

    const promedio = dias.length > 0
      ? Math.round(dias.reduce((s, d) => s + d.ocupacion, 0) / dias.length)
      : 0;

    return res.json({ promedio, dias });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/reportes/ingresos
router.get('/ingresos', async (req: Request, res: Response) => {
  try {
    const { periodo = 'mes' } = req.query;
    const { desde, hasta } = rangoPeriodo(periodo as string);
    const hotelId = req.headers['x-hotel-id'];

    let queryPagos = db()
      .from('pagos_hotel')
      .select('monto, fecha_pago, metodo_pago, reservas_hotel!inner(id_hotel)')
      .neq('estado', 'anulado')
      .gte('fecha_pago', desde)
      .lte('fecha_pago', hasta)
      .order('fecha_pago');

    if (hotelId && hotelId !== 'all') {
      queryPagos = queryPagos.eq('reservas_hotel.id_hotel', hotelId);
    }

    const { data: pagos, error } = await queryPagos;

    if (error) throw error;

    // Agrupar por dÃ­a
    const porDia: Record<string, { cantidad: number; reservas: number }> = {};
    for (const p of pagos ?? []) {
      const dia = (p as any).fecha_pago?.substring(0, 10) ?? '';
      if (!porDia[dia]) porDia[dia] = { cantidad: 0, reservas: 0 };
      porDia[dia].cantidad += (p as any).monto ?? 0;
      porDia[dia].reservas += 1;
    }

    const diasSemana = ['Dom', 'Lun', 'Mar', 'MiÃ©', 'Jue', 'Vie', 'SÃ¡b'];
    const detalles = Object.entries(porDia)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([fecha, { cantidad, reservas }]) => ({
        periodo: diasSemana[new Date(fecha + 'T12:00:00').getDay()],
        cantidad: Math.round(cantidad),
        reservas,
        promedioPorReserva: reservas > 0 ? Math.round(cantidad / reservas) : 0,
      }));

    const total = (pagos ?? []).reduce((s, p: any) => s + (p.monto ?? 0), 0);

    return res.json({ total: Math.round(total), totalUSD: Math.round(total / 24.5), detalles });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/reportes/reservas
router.get('/reservas', async (req: Request, res: Response) => {
  try {
    const { periodo = 'mes' } = req.query;
    const { desde, hasta } = rangoPeriodo(periodo as string);
    const hotelId = req.headers['x-hotel-id'];

    let queryRes = db()
      .from('reservas_hotel')
      .select('estado')
      .gte('check_in', desde)
      .lte('check_in', hasta);

    if (hotelId && hotelId !== 'all') {
      queryRes = queryRes.eq('id_hotel', hotelId);
    }

    const { data: todasReservas, error } = await queryRes;

    if (error) throw error;

    const conteo: Record<string, number> = {};
    for (const r of todasReservas ?? []) {
      const e = (r as any).estado ?? 'otro';
      conteo[e] = (conteo[e] ?? 0) + 1;
    }

    const total = todasReservas?.length ?? 0;
    const activas = conteo['confirmada'] ?? 0 + (conteo['check_in'] ?? 0);
    const pendientes = conteo['pendiente'] ?? 0;
    const canceladas = conteo['cancelada'] ?? 0;

    const detalles = Object.entries(conteo).map(([estado, cantidad]) => ({
      estado,
      cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    }));

    return res.json({ total, activas, pendientes, canceladas, detalles });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

// GET /api/reportes/clientes
router.get('/clientes', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'];

    const { data: huespedes, error } = await db()
      .from('huespedes')
      .select('id_huesped, nombre_completo')
      .order('nombre_completo');

    if (error) throw error;

    const total = huespedes?.length ?? 0;

    // Top clientes por número de reservas
    let queryRes = db()
      .from('reservas_hotel')
      .select('id_huesped, total_reserva')
      .neq('estado', 'cancelada');

    if (hotelId && hotelId !== 'all') {
      queryRes = queryRes.eq('id_hotel', hotelId);
    }

    const { data: reservasPorHuesped } = await queryRes;

    const mapaHuespedes: Record<string, { reservas: number; gastado: number }> = {};
    for (const r of reservasPorHuesped ?? []) {
      const id = (r as any).id_huesped;
      if (!mapaHuespedes[id]) mapaHuespedes[id] = { reservas: 0, gastado: 0 };
      mapaHuespedes[id].reservas += 1;
      mapaHuespedes[id].gastado += (r as any).total_reserva ?? 0;
    }

    const topClientes = (huespedes ?? [])
      .map((h: any) => ({
        nombre: h.nombre_completo,
        reservas: mapaHuespedes[h.id_huesped]?.reservas ?? 0,
        gastado: Math.round(mapaHuespedes[h.id_huesped]?.gastado ?? 0),
      }))
      .filter(h => h.reservas > 0)
      .sort((a, b) => b.reservas - a.reservas)
      .slice(0, 5);

    const recurrentes = Object.values(mapaHuespedes).filter(m => m.reservas > 1).length;

    return res.json({ total, activos: topClientes.length, recurrentes, nuevos: total - recurrentes, topClientes });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Error interno' });
  }
});

export default router;
