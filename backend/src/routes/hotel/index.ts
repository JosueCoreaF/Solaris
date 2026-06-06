import express from 'express';
import configRouter from './config.js';
import bookingsRouter from './bookings.js';
import tarifasRouter from './tarifas.js';
import reportesRouter from './reportes.js';
import finanzasRouter from './finanzas.js';
import chatRouter from './chat.js';
import auditRouter from './audit.js';
import publicHotelRouter from './public.js';
import habitacionesRouter from './habitaciones.js';
import exportsRouter from './exports.js';
import mantenimientoRouter from './mantenimiento.js';
import { syncContext } from '../../controllers/hotel/contexto.controller.js';
import { checkAccountStatus, getAuthUser } from '../../utils/tenantHelper.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = express.Router();

// ── Estado de la cuenta (sin checkAccountStatus para poder leer la razón de bloqueo) ──
router.get('/account-status', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) return res.status(401).json({ error: 'INVALID_SESSION', message: 'Sesión inválida.' });

    let estado: string | null = null;
    let nombre_empresa: string | null = null;

    const { data: owner } = await supabaseAdmin!
      .from('owners')
      .select('estado, nombre_empresa')
      .eq('id_owner', user.id)
      .maybeSingle();

    if (owner) {
      estado = owner.estado;
      nombre_empresa = owner.nombre_empresa;
    } else {
      const { data: role } = await supabaseAdmin!
        .from('usuarios_roles')
        .select('owner_id')
        .eq('user_id', user.id)
        .eq('estado', 'activo')
        .limit(1)
        .maybeSingle();

      if (role?.owner_id) {
        const { data: ownerData } = await supabaseAdmin!
          .from('owners')
          .select('estado, nombre_empresa')
          .eq('id_owner', role.owner_id)
          .maybeSingle();
        estado = ownerData?.estado ?? null;
        nombre_empresa = ownerData?.nombre_empresa ?? null;
      }
    }

    if (estado === 'suspendido') {
      return res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Tu cuenta ha sido suspendida. Contacta con soporte.',
        nombre_empresa,
      });
    }
    if (estado === 'inactivo') {
      return res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: 'Tu cuenta está inactiva.',
        nombre_empresa,
      });
    }

    return res.json({ status: 'active', nombre_empresa });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Todos los demás endpoints del hotel requieren cuenta activa
router.use(checkAccountStatus);

router.get('/sync-context', syncContext);
router.use('/config', configRouter);
router.use('/bookings', bookingsRouter);
router.use('/tarifas', tarifasRouter);
router.use('/reportes', reportesRouter);
router.use('/finanzas', finanzasRouter);
router.use('/chat', chatRouter);
router.use('/audit', auditRouter);
router.use('/public', publicHotelRouter);
router.use('/habitaciones', habitacionesRouter);
router.use('/exports', exportsRouter);
router.use('/mantenimiento', mantenimientoRouter);

export { chatRouter };
export default router;

