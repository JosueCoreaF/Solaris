/**
 * exports.ts — Router de Exportación de Datos
 * Permite descargar datos de la BD en formato CSV o JSON.
 * Rutas:
 *   GET /api/exports/huespedes
 *   GET /api/exports/reservas
 *   GET /api/exports/empresas
 *   GET /api/exports/saldos
 *   GET /api/exports/pagos
 *   GET /api/exports/chats
 *   GET /api/exports/tarifas
 *   GET /api/exports/counts   ← preview de cuántos registros hay
 *
 * Query params:
 *   format=csv|json  (default: csv)
 *   desde=YYYY-MM-DD
 *   hasta=YYYY-MM-DD
 */

import express from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';
import { getAuthUser, getOwnerHotelIdsForUser } from '../../utils/tenantHelper.js';

const router = express.Router();
const db = () => supabaseAdmin ?? supabase;

// ─── Helper: obtener hotel_ids permitidos para el usuario y filtro activo ─────
async function resolveAllowedHotelIds(req: express.Request): Promise<string[]> {
  const user = await getAuthUser(req);
  if (!user) return [];
  const { hotelIds } = await getOwnerHotelIdsForUser(user);
  
  const activeHotelId = req.headers['x-hotel-id'] as string;
  if (activeHotelId && activeHotelId !== 'all') {
    // Si especificó un hotel activo, verificar que tenga acceso a él
    if (hotelIds.includes(activeHotelId)) {
      return [activeHotelId];
    }
    return []; // No tiene acceso al hotel especificado
  }
  return hotelIds || []; // De lo contrario, retornar todos sus hoteles accesibles
}

// ─── Helper: convertir JSON a CSV ──────────────────────────────────────────────
function jsonToCSV(rows: Record<string, any>[]): string {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/\r?\n/g, ' ');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escape(row[h])).join(','))
  ];
  return lines.join('\r\n');
}

// ─── Helper: enviar respuesta como descarga ────────────────────────────────────
function sendDownload(
  res: express.Response,
  data: any[],
  filename: string,
  format: string
) {
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    return res.send(JSON.stringify(data, null, 2));
  }
  // Default: CSV
  const csv = jsonToCSV(data);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  // BOM para que Excel lo abra bien en Windows
  return res.send('\uFEFF' + csv);
}

// ─── GET /api/exports/counts — Preview de registros ───────────────────────────
router.get('/counts', async (req, res) => {
  console.log('[Exports] /counts endpoint called.');
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    console.log('[Exports] Resolved allowed hotel IDs:', allowedHotelIds);
    if (allowedHotelIds.length === 0) {
      return res.json({
        clientes: 0,
        reservas: 0,
        empresas: 0,
        saldos: 0,
        pagos: 0,
        chats: 0,
        tarifas: 0
      });
    }

    // Helper relacional para contar registros
    const countTable = async (table: string, filterField: string = 'id_hotel') => {
      let q: any;
      if (filterField.includes('.')) {
        const relation = filterField.split('.')[0];
        q = db().from(table).select(`*, ${relation}!inner(id_hotel)`, { count: 'exact', head: true });
      } else {
        q = db().from(table).select('*', { count: 'exact', head: true });
      }
      
      const { count, error } = await q.in(filterField, allowedHotelIds);
      if (error) {
        console.error(`[Exports] Error counting ${table}:`, error);
        return 0;
      }
      return count ?? 0;
    };

    const [clientes, reservas, empresas, saldos, pagos, tarifas, chats] = await Promise.all([
      countTable('huespedes'),
      countTable('reservas_hotel'),
      countTable('empresas'),
      countTable('saldos_clientes', 'huespedes.id_hotel'),
      countTable('pagos_hotel', 'reservas_hotel.id_hotel'),
      countTable('tarifas', 'tipos_habitacion.id_hotel'),
      countTable('chat_messages', 'chat_channels.id_hotel'),
    ]);

    const counts = {
      clientes,
      reservas,
      empresas,
      saldos,
      pagos,
      tarifas,
      chats
    };

    console.log('[Exports] Counts calculated successfully:', counts);
    return res.json(counts);
  } catch (err: any) {
    console.error('[Exports] Exception in /counts:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/huespedes ────────────────────────────────────────────────
router.get('/huespedes', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';

    const { data, error } = await db()
      .from('huespedes')
      .select('nombre_completo, correo, telefono, ciudad, direccion, documento_identidad, rtn, fecha_registro, created_at')
      .in('id_hotel', allowedHotelIds)
      .order('nombre_completo');

    if (error) throw error;

    const rows = (data || []).map(h => ({
      'Nombre Completo': h.nombre_completo,
      'Correo': h.correo,
      'Teléfono': h.telefono || '',
      'Ciudad': h.ciudad || '',
      'Dirección': h.direccion || '',
      'Documento Identidad': h.documento_identidad || '',
      'RTN': h.rtn || '',
      'Fecha Registro': h.fecha_registro ? new Date(h.fecha_registro).toLocaleDateString('es-HN') : '',
    }));

    sendDownload(res, rows, `clientes_${Date.now()}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/reservas ─────────────────────────────────────────────────
router.get('/reservas', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';
    const desde = req.query.desde as string;
    const hasta = req.query.hasta as string;

    let q = db()
      .from('reservas_hotel')
      .select(`
        id_reserva_hotel,
        check_in, check_out,
        adultos, ninos,
        estado, estado_pago, total_reserva, moneda,
        es_cortesia, observaciones, tipo_reserva,
        created_at,
        huespedes!inner(nombre_completo, correo, telefono),
        habitaciones!inner(nombre_habitacion),
        hoteles!inner(nombre_hotel),
        empresas(nombre)
      `)
      .in('id_hotel', allowedHotelIds)
      .order('check_in', { ascending: false });

    if (desde) q = q.gte('check_in', desde);
    if (hasta) q = q.lte('check_in', hasta + 'T23:59:59');

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map((r: any) => ({
      'ID Reserva': r.id_reserva_hotel,
      'Huésped': r.huespedes?.nombre_completo || '',
      'Correo Huésped': r.huespedes?.correo || '',
      'Teléfono Huésped': r.huespedes?.telefono || '',
      'Hotel': r.hoteles?.nombre_hotel || '',
      'Habitación': r.habitaciones?.nombre_habitacion || '',
      'Empresa': r.empresas?.nombre || '',
      'Check-In': r.check_in ? new Date(r.check_in).toLocaleDateString('es-HN') : '',
      'Check-Out': r.check_out ? new Date(r.check_out).toLocaleDateString('es-HN') : '',
      'Adultos': r.adultos,
      'Niños': r.ninos,
      'Estado': r.estado,
      'Estado Pago': r.estado_pago,
      'Total': r.total_reserva,
      'Moneda': r.moneda,
      'Cortesía': r.es_cortesia ? 'Sí' : 'No',
      'Tipo': r.tipo_reserva,
      'Observaciones': r.observaciones || '',
      'Creado': r.created_at ? new Date(r.created_at).toLocaleDateString('es-HN') : '',
    }));

    sendDownload(res, rows, `reservas_${desde || 'todo'}_${hasta || ''}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/empresas ─────────────────────────────────────────────────
router.get('/empresas', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';

    const { data, error } = await db()
      .from('empresas')
      .select('nombre, rtn, contacto_nombre, contacto_telefono, contacto_correo, limite_credito, dias_credito, estado, direccion, notas, created_at')
      .in('id_hotel', allowedHotelIds)
      .order('nombre');

    if (error) throw error;

    const rows = (data || []).map((e: any) => ({
      'Nombre': e.nombre,
      'RTN': e.rtn || '',
      'Contacto': e.contacto_nombre || '',
      'Teléfono Contacto': e.contacto_telefono || '',
      'Correo Contacto': e.contacto_correo || '',
      'Límite de Crédito': e.limite_credito,
      'Días de Crédito': e.dias_credito,
      'Estado': e.estado,
      'Dirección': e.direccion || '',
      'Notas': e.notas || '',
      'Creado': e.created_at ? new Date(e.created_at).toLocaleDateString('es-HN') : '',
    }));

    sendDownload(res, rows, `empresas_${Date.now()}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/saldos ───────────────────────────────────────────────────
router.get('/saldos', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';
    const desde = req.query.desde as string;
    const hasta = req.query.hasta as string;

    let q = db()
      .from('saldos_clientes')
      .select('monto, tipo, descripcion, aplicado, created_at, fecha_aplicacion, huespedes!inner(nombre_completo, correo, id_hotel)')
      .in('huespedes.id_hotel', allowedHotelIds)
      .order('created_at', { ascending: false });

    if (desde) q = q.gte('created_at', desde);
    if (hasta) q = q.lte('created_at', hasta + 'T23:59:59');

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map((s: any) => ({
      'Huésped': s.huespedes?.nombre_completo || '',
      'Correo': s.huespedes?.correo || '',
      'Tipo': s.tipo,
      'Monto': s.monto,
      'Descripción': s.descripcion || '',
      'Aplicado': s.aplicado ? 'Sí' : 'No',
      'Fecha Creación': s.created_at ? new Date(s.created_at).toLocaleDateString('es-HN') : '',
      'Fecha Aplicación': s.fecha_aplicacion ? new Date(s.fecha_aplicacion).toLocaleDateString('es-HN') : '',
    }));

    sendDownload(res, rows, `estados_cuenta_${Date.now()}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/pagos ────────────────────────────────────────────────────
router.get('/pagos', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';
    const desde = req.query.desde as string;
    const hasta = req.query.hasta as string;

    let q = db()
      .from('pagos_hotel')
      .select(`
        monto, metodo_pago, referencia, fecha_pago, estado, moneda, notas,
        reservas_hotel!inner(
          check_in, check_out, total_reserva, id_hotel,
          huespedes!inner(nombre_completo),
          habitaciones!inner(nombre_habitacion),
          hoteles!inner(nombre_hotel)
        )
      `)
      .in('reservas_hotel.id_hotel', allowedHotelIds)
      .order('fecha_pago', { ascending: false });

    if (desde) q = q.gte('fecha_pago', desde);
    if (hasta) q = q.lte('fecha_pago', hasta + 'T23:59:59');

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map((p: any) => {
      const r = p.reservas_hotel as any;
      return {
        'Huésped': r?.huespedes?.nombre_completo || '',
        'Hotel': r?.hoteles?.nombre_hotel || '',
        'Habitación': r?.habitaciones?.nombre_habitacion || '',
        'Check-In': r?.check_in ? new Date(r.check_in).toLocaleDateString('es-HN') : '',
        'Check-Out': r?.check_out ? new Date(r.check_out).toLocaleDateString('es-HN') : '',
        'Total Reserva': r?.total_reserva,
        'Monto Pago': p.monto,
        'Método': p.metodo_pago,
        'Referencia': p.referencia || '',
        'Fecha Pago': p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-HN') : '',
        'Estado Pago': p.estado,
        'Moneda': p.moneda,
        'Notas': p.notas || '',
      };
    });

    sendDownload(res, rows, `pagos_${desde || 'todo'}_${hasta || ''}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/chats ────────────────────────────────────────────────────
router.get('/chats', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';
    const desde = req.query.desde as string;
    const hasta = req.query.hasta as string;

    let q = db()
      .from('chat_messages')
      .select('sender_name, content, message_type, created_at, chat_channels!inner(name, channel_type, id_hotel)')
      .in('chat_channels.id_hotel', allowedHotelIds)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (desde) q = q.gte('created_at', desde);
    if (hasta) q = q.lte('created_at', hasta + 'T23:59:59');

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data || []).map((m: any) => ({
      'Canal': (m.chat_channels as any)?.name || '',
      'Tipo Canal': (m.chat_channels as any)?.channel_type || '',
      'Emisor': m.sender_name,
      'Mensaje': m.content,
      'Tipo Mensaje': m.message_type,
      'Fecha': m.created_at ? new Date(m.created_at).toLocaleString('es-HN') : '',
    }));

    sendDownload(res, rows, `chats_${Date.now()}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/exports/tarifas ──────────────────────────────────────────────────
router.get('/tarifas', async (req, res) => {
  try {
    const allowedHotelIds = await resolveAllowedHotelIds(req);
    if (allowedHotelIds.length === 0) return res.status(401).json({ error: 'No autorizado o sin propiedades asignadas' });
    const format = (req.query.format as string) || 'csv';

    const { data, error } = await db()
      .from('tarifas')
      .select('tarifa_noche, tarifa_hora, tarifa_pasadia, vigente_desde, vigente_hasta, activa, tipos_habitacion!inner(nombre_tipo, id_hotel), categorias_tarifa!inner(nombre)')
      .in('tipos_habitacion.id_hotel', allowedHotelIds)
      .order('vigente_desde', { ascending: false });

    if (error) throw error;

    const rows = (data || []).map((t: any) => ({
      'Tipo Habitación': (t.tipos_habitacion as any)?.nombre_tipo || '',
      'Categoría': (t.categorias_tarifa as any)?.nombre || '',
      'Tarifa Noche': t.tarifa_noche,
      'Tarifa Hora': t.tarifa_hora,
      'Tarifa Pasadía': t.tarifa_pasadia,
      'Vigente Desde': t.vigente_desde ? new Date(t.vigente_desde).toLocaleDateString('es-HN') : '',
      'Vigente Hasta': t.vigente_hasta ? new Date(t.vigente_hasta).toLocaleDateString('es-HN') : 'Indefinida',
      'Activa': t.activa ? 'Sí' : 'No',
    }));

    sendDownload(res, rows, `tarifas_${Date.now()}`, format);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
