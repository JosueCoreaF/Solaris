import express from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';
import { getAuthUser } from '../../utils/tenantHelper.js';

const router = express.Router();
const db = () => supabaseAdmin ?? supabase;

async function verificarAcceso(req: express.Request, res: express.Response): Promise<{ userId: string; hotelId: string } | null> {
  const user = await getAuthUser(req);
  if (!user) { res.status(401).json({ error: 'No autenticado' }); return null; }

  const hotelId = req.headers['x-hotel-id'] as string;
  if (!hotelId || hotelId === 'all') { res.status(400).json({ error: 'Hotel requerido' }); return null; }

  // Check 1: ¿Es propietario directo? (id en tabla owners)
  const { data: ownerRow } = await db()
    .from('owners')
    .select('id_owner')
    .eq('id_owner', user.id)
    .maybeSingle();

  if (ownerRow) return { userId: user.id, hotelId };

  // Check 2: ¿Tiene rol PROPIETARIO o ADMIN en usuarios_roles?
  const { data: rol } = await db()
    .from('usuarios_roles')
    .select('rol')
    .eq('user_id', user.id)
    .eq('estado', 'activo')
    .in('rol', ['PROPIETARIO', 'ADMIN'])
    .limit(1)
    .maybeSingle();

  if (!rol) { res.status(403).json({ error: 'Solo PROPIETARIO o ADMIN pueden acceder a la auditoría' }); return null; }

  return { userId: user.id, hotelId };
}

// GET /api/hotel/audit/logs/stats
router.get('/logs/stats', async (req, res) => {
  const ctx = await verificarAcceso(req, res);
  if (!ctx) return;

  const dias = parseInt(req.query.dias as string) || 30;

  const { data, error } = await db().rpc('fn_estadisticas_auditoria', {
    p_hotel_id: ctx.hotelId,
    p_dias: dias,
  });

  if (error) {
    console.error('[audit/stats]', error);
    return res.status(500).json({ error: error.message });
  }
  return res.json(data ?? {});
});

// GET /api/hotel/audit/logs/search
router.get('/logs/search', async (req, res) => {
  const ctx = await verificarAcceso(req, res);
  if (!ctx) return;

  const q = req.query.q as string;
  if (!q || q.length < 3) return res.status(400).json({ error: 'Búsqueda debe tener al menos 3 caracteres' });

  const limit  = parseInt(req.query.limit  as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { data, error } = await db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('id_hotel', ctx.hotelId)
    .or(`cambios_resumidos.ilike.%${q}%,usuario_email.ilike.%${q}%,entidad.ilike.%${q}%`)
    .order('created_at_iso', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ data: data ?? [], limit, offset, query: q });
});

// GET /api/hotel/audit/logs/export
router.get('/logs/export', async (req, res) => {
  const ctx = await verificarAcceso(req, res);
  if (!ctx) return;

  let query = db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('id_hotel', ctx.hotelId)
    .order('created_at_iso', { ascending: false });

  if (req.query.fecha_desde) query = query.gte('created_at_iso', `${req.query.fecha_desde}T00:00:00`);
  if (req.query.fecha_hasta) query = query.lte('created_at_iso', `${req.query.fecha_hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const logs = data ?? [];
  const headers = ['ID','Acción','Entidad','Usuario','Rol','Cambios','Fecha/Hora','IP'];
  const csv = [
    headers.join(','),
    ...logs.map((log: any) => [
      log.id,
      log.accion,
      log.entidad,
      log.usuario_email || '-',
      log.usuario_rol   || '-',
      `"${(log.cambios_resumidos || '').replace(/"/g, '""')}"`,
      log.fecha_hora,
      log.ip_cliente || '-',
    ].join(',')),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="auditoria_${new Date().toISOString().split('T')[0]}.csv"`);
  return res.send('﻿' + csv); // BOM para Excel en español
});

// GET /api/hotel/audit/logs  (lista principal)
router.get('/logs', async (req, res) => {
  const ctx = await verificarAcceso(req, res);
  if (!ctx) return;

  const limit  = parseInt(req.query.limit  as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  let query = db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('id_hotel', ctx.hotelId)
    .order('created_at_iso', { ascending: false })
    .range(offset, offset + limit - 1);

  if (req.query.entidad) query = query.eq('entidad', req.query.entidad as string);
  if (req.query.accion)  query = query.eq('accion',  req.query.accion  as string);
  if (req.query.usuario) query = query.ilike('usuario_email', `%${req.query.usuario}%`);
  if (req.query.fecha_desde) query = query.gte('created_at_iso', `${req.query.fecha_desde}T00:00:00`);
  if (req.query.fecha_hasta) query = query.lte('created_at_iso', `${req.query.fecha_hasta}T23:59:59`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ data: data ?? [], limit, offset });
});

// GET /api/hotel/audit/logs/:id  (detalle de un log)
router.get('/logs/:id', async (req, res) => {
  const ctx = await verificarAcceso(req, res);
  if (!ctx) return;

  const { data, error } = await db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('id', req.params.id)
    .eq('id_hotel', ctx.hotelId)
    .single();

  if (error) return res.status(404).json({ error: 'Log no encontrado' });
  return res.json(data);
});

export default router;
