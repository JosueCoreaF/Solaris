import { Router } from 'express';
import {
  listarHabitaciones,
  crearHabitacion,
  actualizarHabitacion,
  eliminarHabitacion,
  listarTiposHabitacion,
} from '../../controllers/hotel/habitaciones.controller.js';

const router = Router();

// GET  /api/hotel/habitaciones/tipos
router.get('/tipos', listarTiposHabitacion);

// GET  /api/hotel/habitaciones
router.get('/', listarHabitaciones);

// POST /api/hotel/habitaciones
router.post('/', crearHabitacion);

// PUT  /api/hotel/habitaciones/:id
router.put('/:id', actualizarHabitacion);

// DELETE /api/hotel/habitaciones/:id
router.delete('/:id', eliminarHabitacion);

export default router;
