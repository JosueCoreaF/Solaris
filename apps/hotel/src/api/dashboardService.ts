import { fetchReservas, fetchHabitaciones } from './bookingsService';
import { obtenerUsuariosRoles } from './usuariosRolesService';
import { withCache } from '../utils/cache';
import type { Reserva, Habitacion } from './bookingsService';

const API = 'http://localhost:4000/api';

async function apiFetch<T>(path: string): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const r = await fetch(`${API}${path}`, {
    headers: {
      'X-Hotel-ID': activeHotelId
    }
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export interface DashboardKPI {
  ocupacion: number;
  ingresosHoy: number;
  reservasPendientes: number;
  scoreClientes: number;
  ingresosMes: number;
  gastosMes: number;
  desglose?: Record<string, number>;
}

export interface TendenciaOcupacion {
  dia: string;
  fecha: string;
  ocupacion: number;
}

/**
 * Calcula la ocupación actual desde el backend
 */
export async function calcularOcupacion(): Promise<number> {
  try {
    const res = await apiFetch<{ ocupacion: number }>('/bookings/kpis/ocupacion-actual');
    return res.ocupacion;
  } catch (err) {
    console.error('Error calculando ocupación:', err);
    return 0;
  }
}

/**
 * Obtiene ingresos de hoy desde el backend
 */
export async function calcularIngresosHoy(): Promise<number> {
  try {
    const res = await apiFetch<{ ingresosHoy: number }>('/bookings/kpis/ingresos-hoy');
    return res.ingresosHoy;
  } catch (err) {
    console.error('Error calculando ingresos hoy:', err);
    return 0;
  }
}

/**
 * Calcula reservas pendientes por ingresar
 */
export async function calcularReservasPendientes(): Promise<number> {
  try {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];
    const proximos3Dias = new Date(hoy.getTime() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const reservas = await fetchReservas(hoyStr, proximos3Dias);
    if (!reservas) return 0;

    // Contar reservas confirmadas o pendientes (están por ingresar)
    const pendientes = reservas.filter(
      (r) => r.estado === 'confirmada' || r.estado === 'pendiente'
    ).length;
    return pendientes;
  } catch (err) {
    console.error('Error calculando reservas pendientes:', err);
    return 0;
  }
}

/**
 * Obtiene ingresos del mes desde el backend
 */
export async function calcularIngresosMes(): Promise<number> {
  try {
    const res = await apiFetch<{ ingresosMes: number }>('/bookings/kpis/ingresos-mes');
    return res.ingresosMes;
  } catch (err) {
    console.error('Error calculando ingresos mes:', err);
    return 0;
  }
}

/**
 * Calcula tendencia de ocupación últimos 7 días desde el backend
 */
export async function calcularTendenciasOcupacion(): Promise<TendenciaOcupacion[]> {
  try {
    const res = await apiFetch<TendenciaOcupacion[]>('/bookings/kpis/tendencias-ocupacion');
    return res;
  } catch (err) {
    console.error('Error calculando tendencias:', err);
    return [];
  }
}

/**
 * Obtiene todos los KPIs del dashboard
 */
export async function obtenerKPIsDashboard(): Promise<DashboardKPI> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  return withCache(`kpis:dashboard:${activeHotelId}`, 60_000, async () => {
    try {
      const [ocupacion, ingresosHoy, reservasPendientes, resMes, rooms] = await Promise.all([
        calcularOcupacion(),
        calcularIngresosHoy(),
        calcularReservasPendientes(),
        apiFetch<{ ingresosMes: number; gastosMes: number; desglose?: Record<string, number> }>('/bookings/kpis/ingresos-mes'),
        fetchHabitaciones().catch(() => []),
      ]);

      // Calcular Score Operativo: deducción por tareas de limpieza pendientes y mantenimiento
      const dirtyRoomsCount = rooms.filter((r) => r.estado === 'limpieza').length;
      const maintenanceRoomsCount = rooms.filter((r) => r.estado === 'mantenimiento').length;

      let deductions = 0;
      deductions += dirtyRoomsCount * 6;         // -6 puntos por habitación sucia sin limpiar
      deductions += maintenanceRoomsCount * 4;   // -4 puntos por habitación fuera de servicio
      deductions += reservasPendientes * 5;      // -5 puntos por check-in pendiente de procesar

      const scoreClientes = Math.max(45, 100 - deductions);

      return {
        ocupacion,
        ingresosHoy,
        reservasPendientes,
        scoreClientes,
        ingresosMes: resMes.ingresosMes,
        gastosMes: resMes.gastosMes,
        desglose: resMes.desglose,
      };
    } catch (err) {
      console.error('Error obteniendo KPIs:', err);
      return {
        ocupacion: 0,
        ingresosHoy: 0,
        reservasPendientes: 0,
        scoreClientes: 75,
        ingresosMes: 0,
        gastosMes: 0,
      };
    }
  });
}

/**
 * Obtiene usuarios pendientes de aprobación
 */
export async function obtenerSolicitudesPendientes(): Promise<number> {
  try {
    const usuarios = await obtenerUsuariosRoles('00000000-0000-0000-0000-000000000000');
    const pendientes = (usuarios || []).filter(
      (u) => u.estado === 'pendiente_aprobacion'
    ).length;
    return pendientes;
  } catch (err) {
    console.error('Error obteniendo solicitudes pendientes:', err);
    return 0;
  }
}
