/**
 * Hotel Router Index
 * Centraliza todas las sub-rutas del módulo de hotel bajo /api/hotel
 */
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
import { syncContext } from '../../controllers/hotel/contexto.controller.js';

const router = express.Router();

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

export { chatRouter };
export default router;
