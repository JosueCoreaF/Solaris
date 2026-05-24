import express from 'express';
import { supabaseAdmin, supabase } from '../../config/supabase.js';

const router = express.Router();
const db = () => supabaseAdmin ?? supabase;

// Extrae el JWT del header y verifica el usuario
async function getAuthUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Verifica si el usuario es PROPIETARIO
async function isPropietario(userId: string): Promise<boolean> {
  const { data } = await db()
    .from('usuarios_roles')
    .select('rol')
    .eq('usuario_id', userId)
    .eq('estado', 'activo')
    .single();
  return data?.rol === 'PROPIETARIO';
}

// ─── Auditoría: Obtener todos los logs (Solo PROPIETARIO) ───────────────────

// GET /api/audit-logs
// Query params:
//   - limit: número de registros (default 100)
//   - offset: para paginación
//   - entidad: filtrar por entidad (reservas_hotel, pagos_hotel, etc)
//   - accion: filtrar por acción (INSERT, UPDATE, DELETE, etc)
//   - usuario_id: filtrar por usuario
//   - fecha_desde: YYYY-MM-DD
//   - fecha_hasta: YYYY-MM-DD
router.get('/audit-logs', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  let query = db().from('vw_audit_log_legible').select('*');

  // Filtros
  if (req.query.entidad) {
    query = query.eq('entidad', req.query.entidad);
  }
  if (req.query.accion) {
    query = query.eq('accion', req.query.accion);
  }
  if (req.query.usuario_id) {
    query = query.eq('usuario_email', req.query.usuario_id);
  }
  if (req.query.fecha_desde) {
    query = query.gte('created_at_iso', `${req.query.fecha_desde}T00:00:00`);
  }
  if (req.query.fecha_hasta) {
    query = query.lte('created_at_iso', `${req.query.fecha_hasta}T23:59:59`);
  }

  // Paginación
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  query = query.range(offset, offset + limit - 1);

  // Orden
  query = query.order('created_at_iso', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Error en GET /api/audit-logs:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    data: data ?? [],
    limit,
    offset,
    total: (data ?? []).length,
  });
});

// ─── Auditoría: Estadísticas ────────────────────────────────────────────────

// GET /api/audit-logs/stats?dias=30
router.get('/audit-logs/stats', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  const dias = parseInt(req.query.dias as string) || 30;

  // Llamar a la función que retorna estadísticas
  const { data, error } = await db().rpc('fn_estadisticas_auditoria', { p_dias: dias });

  if (error) {
    console.error('Error en GET /api/audit-logs/stats:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.json(data?.[0] ?? {});
});

// ─── Auditoría: Detalles de una acción específica ────────────────────────────

// GET /api/audit-logs/:id
router.get('/audit-logs/:id', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  const { data, error } = await db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    return res.status(404).json({ error: 'Log no encontrado' });
  }

  return res.json(data);
});

// ─── Auditoría: Historial completo de una entidad ──────────────────────────

// GET /api/audit-logs/entity/:tipo/:id
// Ejemplo: /api/audit-logs/entity/reservas_hotel/550e8400-e29b-41d4-a716-446655440000
router.get('/audit-logs/entity/:tipo/:id', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  const { data, error } = await db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('entidad', req.params.tipo)
    .eq('entidad_id', req.params.id)
    .order('created_at_iso', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json(data ?? []);
});

// ─── Auditoría: Auditoría de un usuario específico ──────────────────────────

// GET /api/audit-logs/user/:email
router.get('/audit-logs/user/:email', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  const { data, error } = await db()
    .from('vw_audit_log_legible')
    .select('*')
    .eq('usuario_email', decodeURIComponent(req.params.email))
    .range(offset, offset + limit - 1)
    .order('created_at_iso', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    data: data ?? [],
    limit,
    offset,
    total: (data ?? []).length,
  });
});

// GET /api/audit-logs/search?q=texto
router.get('/audit-logs/search', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  const q = req.query.q as string;
  if (!q || q.length < 3) {
    return res.status(400).json({ error: 'Búsqueda debe tener al menos 3 caracteres' });
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  // Buscar en cambios_resumidos, notas, usuario_email
  const { data, error } = await db()
    .from('vw_audit_log_legible')
    .select('*')
    .or(
      `cambios_resumidos.ilike.%${q}%,notas.ilike.%${q}%,usuario_email.ilike.%${q}%`
    )
    .range(offset, offset + limit - 1)
    .order('created_at_iso', { ascending: false });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    data: data ?? [],
    limit,
    offset,
    query: q,
  });
});

// ─── Exportar auditoría a CSV (Solo PROPIETARIO) ────────────────────────────

// GET /api/audit-logs/export/csv?fecha_desde=2026-01-01&fecha_hasta=2026-12-31
router.get('/audit-logs/export/csv', async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  if (!await isPropietario(user.id)) return res.status(403).json({ error: 'Solo PROPIETARIO puede acceder a auditoría' });

  let query = db().from('vw_audit_log_legible').select('*');

  if (req.query.fecha_desde) {
    query = query.gte('created_at_iso', `${req.query.fecha_desde}T00:00:00`);
  }
  if (req.query.fecha_hasta) {
    query = query.lte('created_at_iso', `${req.query.fecha_hasta}T23:59:59`);
  }

  query = query.order('created_at_iso', { ascending: false });

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Convertir a CSV
  const logs = data ?? [];
  const headers = [
    'ID',
    'Acción',
    'Entidad',
    'Usuario',
    'Rol',
    'Cambios',
    'Notas',
    'Fecha/Hora',
    'IP Cliente',
    'User Agent',
  ];

  const csv = [
    headers.join(','),
    ...logs.map((log: any) =>
      [
        log.id,
        log.accion,
        log.entidad,
        log.usuario_email || '-',
        log.usuario_rol || '-',
        `"${(log.cambios_resumidos || '').replace(/"/g, '""')}"`,
        `"${(log.notas || '').replace(/"/g, '""')}"`,
        log.fecha_hora,
        log.ip_cliente || '-',
        `"${(log.user_agent || '').replace(/"/g, '""')}"`,
      ].join(',')
    ),
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="auditoria_${new Date().toISOString().split('T')[0]}.csv"`
  );
  return res.send(csv);
});

export default router;
