import { cache, withCache } from '../utils/cache';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hotel-ID': activeHotelId,
    ...options.headers,
  } as Record<string, string>;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Hotel {
  id_hotel: string;
  nombre_hotel: string;
  ciudad?: string;
  direccion?: string;
  telefono?: string;
  enlace_google_maps?: string;
  estado?: string;
}

export interface Habitacion {
  id_habitacion: string;
  nombre_habitacion: string;
  nombre_alias?: string;
  id_hotel: string;
  hotel?: string;
  tipo?: string;
  capacidad?: number;
  tarifa_noche?: number;
  estado?: string;
  piso?: number;
}

export interface Huesped {
  id_huesped: string;
  nombre_completo: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}

export interface Empresa {
  id_empresa: string;
  nombre: string;
  rtn?: string;
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_correo?: string;
  limite_credito?: number;
  dias_credito?: number;
  estado?: string;
}

export interface Reserva {
  id_reserva_hotel: string;
  id_huesped: string;
  id_habitacion: string;
  check_in: string;
  check_out: string;
  adultos: number;
  ninos: number;
  estado: 'pendiente' | 'confirmada' | 'check_in' | 'check_out' | 'cancelada' | 'no_show';
  total_reserva: number;
  moneda: string;
  observaciones?: string;
  created_at?: string;
  es_cortesia?: boolean;
  id_empresa?: string;
  estado_pago?: 'pagado' | 'cortesia' | 'credito' | 'deuda' | 'capital_pendiente' | 'reservada' | 'abonada' | 'n/a';
  id_cotizacion?: string | null;
  estado_habitacion?: string;
  estado_display?: string; // Guardado en BD, calculado por trigger SQL
  cama_extra?: boolean;
  limpieza_diaria?: boolean;
  neverita?: boolean;
  plancha?: boolean;
  origen_reserva?: 'web' | 'recepcion' | 'telefono' | 'agencia' | 'ia';
  tipo_reserva?: 'noche' | 'hora' | 'pasadia';
  // Computed
  noches?: number;
  // Joins
  huesped?: string;
  habitacion?: string;
  hotel?: string;
  pagos?: Pago[];
}

export interface Pago {
  id_pago_hotel: string;
  id_reserva_hotel: string;
  monto: number;
  moneda: string;
  metodo_pago?: string;
  fecha_pago?: string;
  estado?: string;
  notas?: string;
}

export interface BloqueHabitacion {
  id_bloque?: string;
  id_habitacion: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo?: string;
}

export type EstadoReserva = Reserva['estado'];

export type DisplayStatus = 'reservada' | 'pagada' | 'abonada' | 'pendiente' | 'credito' | 'cortesia' | 'check_out' | 'cancelada' | 'confirmada' | 'check_in' | 'en_el_hotel' | 'check_in_pendiente' | 'completada' | 'por_confirmar' | 'cambio' | 'cotizacion';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getDisplayStatus(reserva: Reserva): DisplayStatus {
  if (reserva.estado === 'cancelada') return 'cancelada';
  if (reserva.es_cortesia) return 'cortesia';
  if (reserva.id_empresa) return 'credito';
  if (reserva.estado === 'check_in') return 'check_in';
  if (reserva.estado === 'check_out') return 'check_out';
  if (reserva.estado === 'confirmada') return 'confirmada';
  if (reserva.estado === 'pendiente') return 'pendiente';

  const pagado = (reserva.pagos ?? []).reduce((s, p) => s + p.monto, 0);
  if (pagado >= reserva.total_reserva) return 'pagada';
  if (pagado > 0) return 'abonada';
  return 'reservada';
}

export function getStatusLabel(status: DisplayStatus): string {
  const labels: Record<DisplayStatus, string> = {
    reservada: 'Reservada',
    pagada: 'Pagada',
    abonada: 'Abonada',
    pendiente: 'Pendiente',
    credito: 'Crédito Empresa',
    cortesia: 'Cortesía',
    check_out: 'Check-out',
    cancelada: 'Cancelada',
    confirmada: 'Confirmada',
    check_in: 'Check-in',
    en_el_hotel: 'En el Hotel',
    check_in_pendiente: 'Check-in Pendiente',
    completada: 'Completada',
    por_confirmar: 'Por Confirmar',
    cambio: 'Cambio Habitación',
    cotizacion: 'Cotización (sin confirmar)',
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: DisplayStatus): string {
  const colors: Record<DisplayStatus, string> = {
    reservada: '#3b82f6',
    pagada: '#22c55e',
    abonada: '#a855f7', // Using purple for abonada to differentiate it from check_in_pendiente
    pendiente: '#ef4444', // Red for past unpaid
    credito: '#6366f1', // Indigo for company credit
    cortesia: '#ec4899',
    check_out: '#14b8a6',
    cancelada: '#64748b', // Slate gray for canceled
    confirmada: '#8b5cf6',
    check_in: '#06b6d4',
    en_el_hotel: '#0d9488', // Teal for inside paid
    check_in_pendiente: '#f97316', // Orange for check-in unpaid
    completada: '#15803d', // Dark green for completed past stay
    por_confirmar: '#eab308', // Yellow for por confirmar
    cambio: '#db2777', // Magenta for room change
    cotizacion: '#f59e0b', // Amber: bloqueo temporal en espera de confirmación de cotización
  };
  return colors[status] ?? '#94a3b8';
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getOnlyDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  return dateStr.split(/[T ]/)[0];
}

export function startOfDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = startOfDay(checkIn);
  const b = startOfDay(checkOut);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function checkOutFromNights(checkIn: string, noches: number): string {
  const d = startOfDay(checkIn);
  d.setDate(d.getDate() + noches);
  return toDateKey(d) + 'T12:00';
}

// ─── API ─────────────────────────────────────────────────────────────────────

const TTL_LARGA  = 5 * 60 * 1000; // 5 min — catálogos que cambian poco
const TTL_MEDIA  = 2 * 60 * 1000; // 2 min — listas de uso frecuente
const TTL_CORTA  = 1 * 60 * 1000; // 1 min — reservas (mutan más seguido)

export async function fetchHoteles(): Promise<Hotel[]> {
  return withCache('hoteles', TTL_LARGA, () => apiFetch<Hotel[]>('/bookings/hoteles'));
}

export async function fetchHabitaciones(): Promise<Habitacion[]> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  return withCache(`habitaciones:${activeHotelId}`, TTL_LARGA, () => apiFetch<Habitacion[]>('/bookings/habitaciones'));
}

export async function fetchHuespedes(): Promise<Huesped[]> {
  return withCache('huespedes', TTL_MEDIA, () => apiFetch<Huesped[]>('/bookings/huespedes'));
}

export async function fetchEmpresas(): Promise<Empresa[]> {
  return withCache('empresas', TTL_MEDIA, () => apiFetch<Empresa[]>('/bookings/empresas'));
}

export async function createEmpresa(params: {
  nombre: string;
  rtn?: string;
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_correo?: string;
  limite_credito?: number;
  dias_credito?: number;
}): Promise<Empresa> {
  const result = await apiFetch<Empresa>('/bookings/empresas', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  cache.invalidate('empresas');
  return result;
}

export interface ColaboradorRow {
  id_huesped: string;
  cargo: string | null;
  huespedes: {
    id_huesped: string;
    nombre_completo: string;
    correo: string | null;
    telefono: string | null;
  } | null;
}

export async function fetchColaboradoresEmpresa(idEmpresa: string): Promise<ColaboradorRow[]> {
  return apiFetch<ColaboradorRow[]>(`/bookings/empresas/${idEmpresa}/colaboradores`);
}

export async function addColaboradorEmpresa(idEmpresa: string, idHuesped: string, cargo?: string): Promise<void> {
  await apiFetch(`/bookings/empresas/${idEmpresa}/colaboradores`, {
    method: 'POST',
    body: JSON.stringify({ id_huesped: idHuesped, cargo: cargo ?? null }),
  });
}

export async function fetchReservas(desde: string, hasta: string): Promise<Reserva[]> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const key = `reservas:${activeHotelId}:${desde}:${hasta}`;
  return withCache(key, TTL_CORTA, () =>
    apiFetch<Reserva[]>(`/bookings/reservas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`),
  );
}

export async function fetchBloques(desde: string, hasta: string): Promise<BloqueHabitacion[]> {
  return apiFetch<BloqueHabitacion[]>(`/bookings/bloqueos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);
}

export async function toggleBloqueo(idHabitacion: string, fecha: string, motivo?: string): Promise<{ success: boolean; action: 'added' | 'removed'; data?: any }> {
  return apiFetch<{ success: boolean; action: 'added' | 'removed'; data?: any }>('/bookings/bloqueos/toggle', {
    method: 'POST',
    body: JSON.stringify({ id_habitacion: idHabitacion, fecha, motivo }),
  });
}


export async function createHuesped(params: {
  nombre_completo: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}): Promise<Huesped> {
  const result = await apiFetch<Huesped>('/bookings/huespedes', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  cache.invalidate('huespedes');
  return result;
}

export async function createReserva(params: {
  id_huesped: string;
  id_habitacion: string;
  check_in: string;
  check_out: string;
  adultos: number;
  ninos: number;
  estado: EstadoReserva;
  total_reserva: number;
  moneda: string;
  observaciones: string;
  estado_pago?: 'pagado' | 'credito' | 'parcial' | 'cortesia' | 'deuda' | 'capital_pendiente' | 'reservada' | 'abonada' | 'n/a';
  anticipo?: number;
  es_cortesia?: boolean;
  id_empresa?: string;
  cama_extra?: boolean;
  limpieza_diaria?: boolean;
  neverita?: boolean;
  plancha?: boolean;
  origen_reserva?: 'web' | 'recepcion' | 'telefono' | 'agencia' | 'ia';
  tipo_reserva?: 'noche' | 'hora' | 'pasadia';
}): Promise<Reserva> {
  const result = await apiFetch<Reserva>('/bookings/reservas', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  cache.invalidatePrefix('reservas:');
  return result;
}

export async function updateReserva(id: string, updates: Partial<Reserva>): Promise<void> {
  await apiFetch<void>(`/bookings/reservas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  cache.invalidatePrefix('reservas:');
}

export async function cancelReserva(id: string, anularPagos: boolean = false): Promise<void> {
  await apiFetch<void>(`/bookings/reservas/${id}?anularPagos=${anularPagos ? 'true' : 'false'}`, { method: 'DELETE' });
  cache.invalidatePrefix('reservas:');
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export interface PagoDetalle {
  id_pago_hotel: string;
  id_reserva_hotel: string;
  monto: number;
  moneda: string;
  metodo_pago: string;
  referencia?: string;
  fecha_pago: string;
  estado: 'registrado' | 'aplicado' | 'anulado';
  notas?: string;
  created_at?: string;
  // Joins
  huesped?: string;
  habitacion?: string;
  hotel?: string;
  check_in?: string;
  check_out?: string;
  total_reserva?: number;
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'deposito' | 'canje' | 'otro';

export async function fetchPagos(params: { desde?: string; hasta?: string; id_reserva?: string } = {}): Promise<PagoDetalle[]> {
  const q = new URLSearchParams();
  if (params.desde) q.set('desde', params.desde);
  if (params.hasta) q.set('hasta', params.hasta);
  if (params.id_reserva) q.set('id_reserva', params.id_reserva);
  return apiFetch<PagoDetalle[]>(`/bookings/pagos?${q.toString()}`);
}

export async function createPago(params: {
  id_reserva_hotel: string;
  monto: number;
  moneda: string;
  metodo_pago: string;
  referencia?: string;
  fecha_pago?: string;
  estado?: string;
  notas?: string;
}): Promise<PagoDetalle> {
  return apiFetch<PagoDetalle>('/bookings/pagos', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function updatePago(id: string, updates: Partial<PagoDetalle>): Promise<void> {
  await apiFetch<void>(`/bookings/pagos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function anularPago(id: string, motivo?: string): Promise<void> {
  const url = motivo
    ? `/bookings/pagos/${id}?motivo=${encodeURIComponent(motivo)}`
    : `/bookings/pagos/${id}`;
  await apiFetch<void>(url, { method: 'DELETE' });
}

export async function splitReserva(idReservaHotel: string, fechaSplit: string): Promise<any> {
  return apiFetch<any>('/bookings/split', {
    method: 'POST',
    body: JSON.stringify({ id_reserva_hotel: idReservaHotel, fecha_split: fechaSplit }),
  });
}

export async function simulateImportReservas(file: File): Promise<any[]> {
  const formData = new FormData();
  formData.append('file', file);
  
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const headers: Record<string, string> = {
    'X-Hotel-ID': activeHotelId,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/bookings/simulate-import`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }

  return res.json();
}

export async function confirmImportReservas(reservas: Reserva[], hotelId: string): Promise<{ insertadas: number; errores: number }> {
  return apiFetch<{ insertadas: number; errores: number }>('/bookings/bulk-import', {
    method: 'POST',
    headers: {
      'X-Hotel-ID': hotelId,
    },
    body: JSON.stringify({ reservas }),
  });
}

export interface EmailPreviewResponse {
  subject: string;
  html: string;
  guestEmail: string;
  guestName: string;
}

export async function fetchEmailPreview(idReserva: string, type: 'confirmation' | 'update' | 'cancellation', changes?: string[]): Promise<EmailPreviewResponse> {
  return apiFetch<EmailPreviewResponse>(`/bookings/reservas/${idReserva}/email-preview`, {
    method: 'POST',
    body: JSON.stringify({ type, changes }),
  });
}

export async function sendCustomEmailApi(idReserva: string, to: string, subject: string, html: string): Promise<{ success: boolean; data?: any }> {
  return apiFetch<{ success: boolean; data?: any }>(`/bookings/reservas/${idReserva}/send-custom-email`, {
    method: 'POST',
    body: JSON.stringify({ to, subject, html }),
  });
}

export interface CustomTemplate {
  id_plantilla?: string;
  id_hotel?: string;
  tipo_plantilla: 'confirmacion' | 'actualizacion' | 'cancelacion' | 'cotizacion';
  asunto: string;
  cuerpo_personalizado?: string;
  estilos: {
    color_cabecera?: string;
    fuente?: string;
    tamano_letra?: string;
    logo_url?: string;
    firma?: string;
    bloques?: any[];
  };
  created_at?: string;
  updated_at?: string;
}

export async function fetchCustomTemplates(): Promise<CustomTemplate[]> {
  return apiFetch<CustomTemplate[]>('/bookings/plantillas');
}

export async function fetchCustomTemplateByType(tipo: string): Promise<CustomTemplate | null> {
  return apiFetch<CustomTemplate | null>(`/bookings/plantillas/${tipo}`);
}

export async function saveCustomTemplate(template: Partial<CustomTemplate>): Promise<CustomTemplate> {
  return apiFetch<CustomTemplate>('/bookings/plantillas', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

export async function previewCustomTemplate(template: Partial<CustomTemplate>): Promise<{ subject: string; html: string }> {
  return apiFetch<{ subject: string; html: string }>('/bookings/plantillas/preview', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}
