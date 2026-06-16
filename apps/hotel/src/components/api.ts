import { supabase } from '../api/supabase';

const API_BASE_URL = (() => {
  // En Electron (file://) siempre usar el backend local en puerto 4000
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') return 'http://localhost:4000/api';
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && !import.meta.env.DEV) return `${window.location.origin}/api`;
  return 'http://localhost:4000/api';
})();

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = 'No se pudo completar la solicitud al backend.';

    try {
      const payload = await response.json() as { error?: string; message?: string };
      message = payload.error ?? payload.message ?? message;
    } catch {
      // Si no hay JSON válido, mantenemos el mensaje por defecto.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

type SedeRow = {
  id_sede: string;
  nombre_sede: string;
  ubicacion: string;
};

type ActividadRow = {
  id_actividad: string;
  nombre_actividad: string;
  descripcion?: string | null;
  tipo?: string | null;
};

type ProgramacionRow = {
  id_programacion: string;
  id_sede: string | null;
  id_actividad: string | null;
  id_entrenador: string | null;
  horario: string;
  cupo_maximo: number;
  costo: number;
};

type ReservaRow = {
  id_reserva: string;
  id_cliente: string | null;
  id_programacion: string | null;
  fecha_reserva?: string | null;
  precio_aplicado: number;
  estado: 'creada' | 'confirmada' | 'cancelada' | 'completada' | 'check_in' | 'no_show';
};

type PagoRow = {
  id_pago: string;
  monto: number;
  fecha_pago?: string | null;
  metodo_pago?: string | null;
  referencia?: string | null;
  id_reserva?: string | null;
};

type ConfiguracionOperativaRow = {
  id_config: string;
  ciudad_base: string;
  horas_anticipacion_reserva: number;
  umbral_ocupacion: number;
  auto_confirmar_pagos: boolean;
  permitir_edicion_personal: boolean;
  hora_cierre: string;
  hora_check_in: string;
};

type FreshHotelRow = {
  id_hotel: string;
  nombre_hotel: string;
  ciudad?: string | null;
  direccion?: string | null;
  estado?: string | null;
};

type FreshRoomTypeRow = {
  id_tipo_habitacion: string;
  nombre_tipo: string;
  descripcion?: string | null;
};

type FreshRoomRow = {
  id_habitacion: string;
  id_hotel: string;
  id_tipo_habitacion?: string | null;
  codigo_habitacion?: string | null;
  nombre_habitacion: string;
  capacidad: number;
  tarifa_noche: number;
  estado?: string | null;
  created_at?: string | null;
};

type FreshReservationHotelRow = {
  id_reserva_hotel: string;
  id_huesped: string;
  id_hotel: string;
  id_habitacion: string;
  id_empresa?: string | null;
  cortesia?: boolean | null;
  check_in: string;
  check_out: string;
  adultos: number;
  ninos: number;
  moneda: SupportedCurrency;
  sede: string;
  total_reserva: number;
  anticipo?: number | null;
  observaciones?: string | null;
  estado?: string | null;
};

type FreshPaymentHotelRow = {
  id_pago_hotel: string;
  id_reserva_hotel: string;
  monto: number;
  moneda: string;
  monto_en_moneda_reserva: number;
  metodo_pago: string;
  referencia: string | null;
  fecha_pago: string;
  estado: string;
};

export type ReservaView = {
  id: string;
  programacionId: string | null;
  huesped: string;
  huespedId: string | null;
  habitacion: string;
  hotel: string;
  responsable: string;
  cliente: string;
  clienteId: string | null;
  servicio: string;
  fecha: string;
  estado: string;
  sede: string;
  personal: string;
  precioAplicado: number;
  moneda: SupportedCurrency;
  pagoId?: string;
  capacidad: number;
  inscritos: number;
};

export type EstadiaView = ReservaView & {
  huesped: string;
  hotel: string;
  habitacion: string;
  responsable: string;
  checkIn: string;
  checkOut: string;
  adultos?: number;
  ninos?: number;
  noches: number;
  total: number;
  moneda: SupportedCurrency;
  observaciones?: string;
  anticipo?: number;
  empresaId?: string | null;
  cortesia?: boolean;
};

export type HuespedView = {
  id: string;
  nombre: string;
  correo: string;
  telefono?: string;
  ciudad: string;
  fechaRegistro: string;
  estado: 'Activo' | 'Sin reservas';
  pagos: Array<{
    id: string;
    monto: number;
    fecha: string;
    metodo: string;
    referencia: string;
  }>;
};


export type OperationalSettings = {
  ciudadBase: string;
  horasAnticipacionReserva: number;
  umbralOcupacion: number;
  autoConfirmarPagos: boolean;
  permitirEdicionPersonal: boolean;
  horaCierre: string; // Check-out
  horaCheckIn: string;
  orientacionCalendario: 'horizontal' | 'vertical';
};

export type SupportedCurrency = 'USD' | 'HNL';

export type TariffConfigView = {
  monedaBase: SupportedCurrency;
  monedaAlterna: SupportedCurrency;
  tipoCambio: number;
  actualizadoEn: string;
  descuentoTerceraEdad: number;
  edadTerceraEdad: number;
  porcentajeImpuesto: number;
};

export type CurrentRoomTariffView = {
  id: string;
  hotelId: string;
  hotel: string;
  tipoHabitacionId?: string | null;
  tipo: string;
  codigo: string;
  habitacion: string;
  montoNoche: number;
  estado: string;
};

export type CustomTariffView = {
  id: string;
  hotelId: string;
  hotel: string;
  habitacionId?: string | null;
  habitacion?: string | null;
  codigo?: string | null;
  nombre: string;
  descripcion?: string;
  moneda: SupportedCurrency;
  montoNoche: number;
  activa: boolean;
  prioridad: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TariffCatalogView = {
  config: TariffConfigView;
  actuales: CurrentRoomTariffView[];
  personalizadas: CustomTariffView[];
};

export type TariffConfigInput = {
  descuentoTerceraEdad: number;
  edadTerceraEdad: number;
};

export type ActivityLogView = {
  id: string;
  tipo: string;
  accion: string;
  descripcion: string;
  entidadId: string | null;
  usuarioId: string | null;
  usuarioNombre?: string;
  createdAt: string;
};

export type CustomTariffInput = {
  hotelId: string;
  habitacionId?: string | null;
  nombre: string;
  descripcion?: string;
  montoNoche: number;
  moneda: SupportedCurrency;
  activa?: boolean;
  prioridad?: number;
};

export type PagoView = {
  id: string;
  tipo: 'reserva';
  huesped: string;
  huespedId: string | null;
  estadia: string;
  hotel: string;
  estadiaId: string | null;
  cliente: string;
  clienteId: string | null;
  correo: string;
  concepto: string;
  sede: string;
  monto: number;
  moneda: SupportedCurrency;
  montoReserva: number;
  fecha: string;
  metodo: string;
  referencia: string;
  reservaId: string | null;
  membresiaId: null;
};

export type PersonalView = {
  id: string;
  nombre: string;
  especialidad: string;
  estadoLaboral: string;
  hotelHoy: string;
  sedeHoy: string;
  workload: number;
  assignedCount: number;
  rating: number;
  availability: string;
  schedule: Array<{
    id: string;
    actividad: string;
    horario: string;
    hotel: string;
    sede: string;
  }>;
};

export type HabitacionView = {
  id: string;
  nombre: string;
  tipo: string;
  costo: string; tarifaNumerica?: number;
  responsable: string;
  personal: string;
  hotel: string;
  sede: string;
  horario: string;
  fechaISO: string;
  capacidad: number;
  inscritos: number;
  estadoOperativo?: string;
  cargoPorPersonaExtra?: number;
};

export type RoomBlockView = {
  id: string;
  habitacionId: string;
  habitacion: string;
  codigo?: string;
  hotelId: string;
  hotel: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  createdAt?: string;
};

export type InventarioHabitacionView = HabitacionView & {
  hotel: string;
  categoria: string;
  disponible: number;
  tarifa: string;
};

export type HotelView = {
  id: string;
  nombre: string;
  ubicacion: string;
  habitaciones: number;
  personalAsignado: number;
  actividades: number;
  entrenadores: number;
  reservas: number;
};

export type DashboardData = {
  huespedes: number;
  reservasHoy: number;
  habitaciones: number;
  dataMensual: Array<{ name: string; reservas: number }>;
  week: number[];
  retentionPercent: number;
  nuevosHuespedes: number;
  pagosPendientes: number;
  habitacionesLlenas: number;
  recentActivity: BitacoraActivity[];
};

export type BitacoraActivity = {
  id: string;
  tipo: 'reserva' | 'pago' | 'mantenimiento' | 'huesped' | 'sistema';
  accion: 'creada' | 'modificada' | 'cancelada' | 'eliminada' | 'creado';
  descripcion: string;
  entidad_id: string | null;
  usuario_id: string | null;
  created_at: string;
};

export type TrainerFormInput = {
  nombre: string;
  correo: string;
  fechaNacimiento: string;
  especialidad: string;
  estadoLaboral: string;
};

export type PersonalFormInput = TrainerFormInput;

export type ServiceFormInput = {
  nombre: string;
  descripcion: string;
  tipo: 'Clase grupal' | 'Servicio';
  sedeId: string;
  entrenadorId: string;
  horario: string;
  cupoMaximo: number;
  costo: number;
};

export type RoomOperationalStatus = 'disponible' | 'ocupada' | 'mantenimiento' | 'bloqueada' | 'limpieza';

export type HabitacionFormInput = Omit<ServiceFormInput, 'sedeId' | 'entrenadorId'> & {
  hotelId: string;
  responsableId: string;
  codigo: string;
  piso: number;
  estadoOperativo: RoomOperationalStatus;
};

export type PaymentFormInput = {
  referencia: string;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia' | 'deposito' | 'canje' | 'otro';
  monto: number;
  moneda: SupportedCurrency;
  fechaPago?: string;
  reservaId?: string;
};

export type ReservationCheckoutInput = {
  referencia?: string;
  metodoPago: PaymentFormInput['metodoPago'];
  fechaPago?: string;
};

export type ReservationCreateInput = {
  clienteId: string;
  actividadId: string;
  estado?: 'creada' | 'confirmada' | 'cancelada' | 'completada' | 'check_in' | 'no_show';
  pago?: ReservationCheckoutInput;
};

export type EstadiaCreateInput = {
  huespedId: string;
  habitacionId: string;
  clienteId?: string;
  actividadId?: string;
  estado?: ReservationCreateInput['estado'];
  pago?: ReservationCreateInput['pago'];
};

export type HotelReservationCreateInput = EstadiaCreateInput & {
  moneda?: SupportedCurrency;
  checkIn?: string;
  checkOut?: string;
  noches?: number;
  adultos?: number;
  ninos?: number;
  observaciones?: string;
  precioAplicado?: number;
  empresaId?: string;
};

export type ClientProfileInput = {
  nombre: string;
  correo: string;
  fechaNacimiento: string;
};

export type OperationalUserInput = {
  nombre: string;
  correo: string;
  telefono?: string;
  ciudad?: string;
  colonia?: string;
  calle?: string;
  fechaNacimiento?: string;
  esCliente: boolean;
  esEntrenador: boolean;
  especialidad?: string;
  estadoLaboral?: 'Activo' | 'Inactivo' | 'Vacaciones';
};


export type ModulePermissionLevel = 'none' | 'read' | 'write';

export type ModulePermissions = {
  dashboard: ModulePermissionLevel;
  habitaciones: ModulePermissionLevel;
  reservas: ModulePermissionLevel;
  extractor: ModulePermissionLevel;
  pagos: ModulePermissionLevel;
  tarifas: ModulePermissionLevel;
  huespedes: ModulePermissionLevel;
  personal: ModulePermissionLevel;
  hoteles: ModulePermissionLevel;
  reportes: ModulePermissionLevel;
  calculadora: ModulePermissionLevel;
  auditoria: ModulePermissionLevel;
  configuracion: ModulePermissionLevel;
  accesos: ModulePermissionLevel;
  perfil: ModulePermissionLevel;
};

export const DEFAULT_ADMIN_PERMISSIONS: ModulePermissions = {
  dashboard: 'read',
  habitaciones: 'read',
  reservas: 'read',
  extractor: 'none',
  pagos: 'none',
  tarifas: 'none',
  huespedes: 'read',
  personal: 'none',
  hoteles: 'none',
  reportes: 'none',
  calculadora: 'read',
  auditoria: 'none',
  configuracion: 'none',
  accesos: 'none',
  perfil: 'read',
};

export const SUPER_ADMIN_PERMISSIONS: ModulePermissions = {
  dashboard: 'write',
  habitaciones: 'write',
  reservas: 'write',
  extractor: 'write',
  pagos: 'write',
  tarifas: 'write',
  huespedes: 'write',
  personal: 'write',
  hoteles: 'write',
  reportes: 'write',
  calculadora: 'write',
  auditoria: 'write',
  configuracion: 'write',
  accesos: 'write',
  perfil: 'write',
};

export type AccessProfile = {
  userId: string;
  email: string;
  fullName: string;
  role: 'admin' | 'super_admin';
  permissions: ModulePermissions;
  personaId: string | null;
  personaNombre: string | null;
  telefono: string | null;
  profileType: string;
  emailConfirmed: boolean;
  lastSignInAt: string | null;
  accessExpiresAt: string | null;
};

export type AccessInvitationRole = 'admin' | 'super_admin';

export type AccessAuditEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetEmail: string | null;
  action: string;
  previousRole: string | null;
  nextRole: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AccessInvitation = {
  id: string;
  email: string;
  fullName: string | null;
  role: 'admin' | 'super_admin';
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  inviteToken: string;
  invitedBy: string | null;
  invitedByEmail: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type InvitationValidation = {
  email: string;
  fullName: string | null;
  role: 'admin' | 'super_admin';
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
};

const formatCurrency = (value: number) => `${value.toFixed(2)} USD`;

const buildFallbackName = (prefix: string, id?: string | null, email?: string | null) => {
  if (email) {
    const local = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
    if (local) {
      return local
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
  }

  return id ? `${prefix} ${id.slice(0, 8)}` : `${prefix} sin registro`;
};

const formatDateLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
  date.toLocaleDateString('es-ES', options);

const startOfDayKey = (dateLike: string | Date) => {
  const date = new Date(dateLike);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};


const DEFAULT_STAY_NIGHTS = 1;

const getCheckOutDate = (checkIn: string, nights = DEFAULT_STAY_NIGHTS) => {
  const date = new Date(checkIn);
  date.setDate(date.getDate() + Math.max(1, nights));
  return date.toISOString();
};

const mapHotelReservationStatus = (status?: string | null) => {
  if (status === 'pendiente') return 'creada';
  if (status === 'confirmada' || status === 'check_in') return 'confirmada';
  if (status === 'check_out') return 'completada';
  return 'cancelada';
};

const formatRoomOperationalStatus = (status?: string | null) => {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return 'disponible';
  if (normalized === 'bloqueada') return 'bloqueada';
  if (normalized === 'mantenimiento') return 'mantenimiento';
  if (normalized === 'limpieza') return 'limpieza';
  return normalized;
};

const normalizeEstadiaCreateInput = (input: ReservationCreateInput | EstadiaCreateInput | HotelReservationCreateInput): HotelReservationCreateInput => {
  const huespedId = 'huespedId' in input ? input.huespedId : input.clienteId;
  const habitacionId = 'habitacionId' in input ? input.habitacionId : input.actividadId;

  if (!huespedId) {
    throw new Error('El huésped es obligatorio para crear la estadía.');
  }

  if (!habitacionId) {
    throw new Error('La habitación es obligatoria para crear la estadía.');
  }

  return {
    huespedId,
    habitacionId,
    clienteId: huespedId,
    actividadId: habitacionId,
    estado: input.estado,
    pago: input.pago,
    precioAplicado: 'precioAplicado' in input ? input.precioAplicado : undefined,
    checkIn: 'checkIn' in input ? input.checkIn : undefined,
    checkOut: 'checkOut' in input ? input.checkOut : undefined,
    noches: 'noches' in input ? input.noches : undefined,
    adultos: 'adultos' in input ? input.adultos : undefined,
    ninos: 'ninos' in input ? input.ninos : undefined,
    observaciones: 'observaciones' in input ? input.observaciones : undefined,
    moneda: ('moneda' in input ? input.moneda : undefined) || 'USD',
    empresaId: 'empresaId' in input ? input.empresaId : undefined,
  } as HotelReservationCreateInput;
};

type NormalizedRoomInput = ServiceFormInput & {
  codigo: string;
  piso: number;
  estadoOperativo: RoomOperationalStatus;
};

const normalizeHabitacionFormInput = (input: ServiceFormInput | HabitacionFormInput): NormalizedRoomInput => {
  const hotelId = 'hotelId' in input ? input.hotelId : input.sedeId;
  const responsableId = 'responsableId' in input ? input.responsableId : input.entrenadorId;
  const codigo = 'codigo' in input ? input.codigo : input.nombre;
  const piso = 'piso' in input ? input.piso : 1;
  const estadoOperativo = 'estadoOperativo' in input ? input.estadoOperativo : 'disponible';

  if (!hotelId) {
    throw new Error('El hotel es obligatorio para registrar la habitación.');
  }

  if (!input.nombre.trim()) {
    throw new Error('El nombre de la habitación es obligatorio.');
  }

  if ('descripcion' in input && !input.descripcion.trim()) {
    throw new Error('La descripción de la habitación es obligatoria.');
  }

  if (!codigo.trim()) {
    throw new Error('El código de la habitación es obligatorio.');
  }

  return {
    nombre: input.nombre,
    descripcion: input.descripcion,
    tipo: input.tipo,
    sedeId: hotelId,
    entrenadorId: responsableId || '',
    horario: input.horario,
    cupoMaximo: input.cupoMaximo,
    costo: input.costo,
    codigo: codigo.trim().toUpperCase(),
    piso,
    estadoOperativo,
  };
};

export async function fetchHotelData() {
  const payload = await apiRequest<{
    sedes: SedeRow[];
    actividades: ActividadRow[];
    programaciones: ProgramacionRow[];
    reservas: ReservaRow[];
    pagos: PagoRow[];
    configuracionOperativa: ConfiguracionOperativaRow[];
    personas: any[];
    clientes: any[];
    entrenadores: any[];
    huespedes?: any[];
    personalHotelero?: any[];
    telefonos?: any[];
    hoteles?: FreshHotelRow[];
    tiposHabitacion?: FreshRoomTypeRow[];
    habitacionesHotel?: FreshRoomRow[];
    reservasHotel?: FreshReservationHotelRow[];
    pagosHotel?: FreshPaymentHotelRow[];
    bitacora?: BitacoraActivity[];
  }>('/operational-data');

  const { sedes, actividades, personas, clientes, entrenadores } = payload;
  
  const personasMap = new Map(personas.map(p => [p.id_persona, p]));
  const huespedesFromPayload = payload.huespedes || [];
  const huespedesMap = new Map(huespedesFromPayload.map((h: any) => [h.id_huesped || h.id_persona, h]));
  const reservasHotelMap = new Map((payload.reservasHotel || []).map(r => [r.id_reserva_hotel, r]));

  const resolveName = (id?: string | null, fallbackPrefix: string = 'Huesped') => {
    if (!id) return `Sin ${fallbackPrefix.toLowerCase()}`;
    const h = huespedesMap.get(id);
    if (h) return h.nombre_completo || h.nombre || buildFallbackName(fallbackPrefix, id || '');
    const p = personasMap.get(id);
    if (p) return p.nombre || buildFallbackName(fallbackPrefix, id || '');
    return buildFallbackName(fallbackPrefix, id || '');
  };

  const programaciones = payload.programaciones.map((item) => ({
    ...item,
    cupo_maximo: toNumber(item.cupo_maximo),
    costo: toNumber(item.costo),
  }));
  
  const reservas = payload.reservas.map((item) => ({
    ...item,
    precio_aplicado: toNumber(item.precio_aplicado),
  }));
  
  const pagos = payload.pagos.map((item) => ({
    ...item,
    monto: toNumber(item.monto),
  }));
  
  const configuracionOperativa = payload.configuracionOperativa.map((item) => ({
    ...item,
    horas_anticipacion_reserva: toNumber(item.horas_anticipacion_reserva),
    umbral_ocupacion: toNumber(item.umbral_ocupacion),
  }));

  const sedesMap = new Map(sedes.map(item => [item.id_sede, item]));
  const actividadesMap = new Map(actividades.map(item => [item.id_actividad, item]));
  const programacionesMap = new Map(programaciones.map(item => [item.id_programacion, item]));
  
  const reservasByProgramacion = new Map<string, ReservaRow[]>();
  for (const reserva of reservas) {
    if (!reserva.id_programacion) continue;
    const current = reservasByProgramacion.get(reserva.id_programacion) ?? [];
    current.push(reserva);
    reservasByProgramacion.set(reserva.id_programacion, current);
  }

  const reservasView: ReservaView[] = reservas.map(reserva => {
    const programacion = reserva.id_programacion ? programacionesMap.get(reserva.id_programacion) : null;
    const actividad = programacion?.id_actividad ? actividadesMap.get(programacion.id_actividad) : null;
    const sede = programacion?.id_sede ? sedesMap.get(programacion.id_sede) : null;
    const inscritos = programacion ? (reservasByProgramacion.get(programacion.id_programacion)?.length ?? 0) : 0;
    const fechaISO = programacion?.horario ? new Date(programacion.horario).toISOString() : (reserva.fecha_reserva ? new Date(reserva.fecha_reserva).toISOString() : new Date().toISOString());

    return {
      id: reserva.id_reserva,
      programacionId: reserva.id_programacion,
      huesped: resolveName(reserva.id_cliente, 'Huesped'),
      huespedId: reserva.id_cliente,
      habitacion: actividad?.nombre_actividad ?? 'Sin habitación',
      hotel: sede?.nombre_sede ?? 'Sin hotel',
      responsable: resolveName(programacion?.id_entrenador, 'Responsable'),
      cliente: resolveName(reserva.id_cliente, 'Cliente'),
      clienteId: reserva.id_cliente,
      servicio: actividad?.nombre_actividad ?? 'Sin servicio',
      fecha: fechaISO,
      estado: reserva.estado,
      sede: sede?.nombre_sede ?? 'Sin sede',
      personal: resolveName(programacion?.id_entrenador, 'Personal'),
      precioAplicado: reserva.precio_aplicado,
      moneda: 'HNL', // Legacy se mantiene como HNL
      capacidad: programacion?.cupo_maximo ?? 0,
      inscritos,
    };
  });

  let pagosView: PagoView[] = pagos.map(pago => {
    const reserva = pago.id_reserva ? reservas.find(item => item.id_reserva === pago.id_reserva) ?? null : null;
    const freshReserva = pago.id_reserva ? reservasHotelMap.get(pago.id_reserva) ?? null : null;
    const reservaProgramacion = reserva?.id_programacion ? programacionesMap.get(reserva.id_programacion) ?? null : null;
    const actividad = reservaProgramacion?.id_actividad ? actividadesMap.get(reservaProgramacion.id_actividad) ?? null : null;
    const sede = reservaProgramacion?.id_sede ? sedesMap.get(reservaProgramacion.id_sede) : null;
    
    // Priorizamos la moneda de la reserva de hotel fresh
    const monedaPago: SupportedCurrency = (freshReserva?.moneda as any) || (reserva as any)?.moneda || 'HNL';

    return {
      id: pago.id_pago,
      tipo: 'reserva',
      huesped: resolveName(reserva?.id_cliente, 'Huesped'),
      huespedId: reserva?.id_cliente ?? null,
      estadia: actividad?.nombre_actividad ?? 'Estadía sin habitación',
      hotel: sede?.nombre_sede ?? 'Sin hotel',
      estadiaId: pago.id_reserva ?? null,
      cliente: resolveName(reserva?.id_cliente, 'Cliente'),
      clienteId: reserva?.id_cliente ?? null,
      correo: '',
      concepto: actividad?.nombre_actividad ?? 'Reserva sin actividad',
      sede: sede?.nombre_sede ?? 'Sin sede',
      monto: pago.monto,
      moneda: monedaPago,
      montoReserva: reserva?.precio_aplicado ?? pago.monto,
      fecha: pago.fecha_pago ?? '',
      metodo: pago.metodo_pago ?? 'N/D',
      referencia: pago.referencia ?? 'N/D',
      reservaId: pago.id_reserva ?? null,
      membresiaId: null,
    };
  });

  const settingsRow = configuracionOperativa[0] as any;
  const operationalSettings: OperationalSettings = settingsRow
    ? {
        ciudadBase: settingsRow.ciudad_base,
        horasAnticipacionReserva: settingsRow.horas_anticipacion_reserva,
        umbralOcupacion: settingsRow.umbral_ocupacion,
        autoConfirmarPagos: settingsRow.auto_confirmar_pagos,
        permitirEdicionPersonal: settingsRow.permitir_edicion_personal,
        horaCierre: settingsRow.hora_check_out,
        horaCheckIn: settingsRow.hora_check_in || '15:00',
        orientacionCalendario: settingsRow.orientacion_calendario || 'horizontal',
      }
    : {
        ciudadBase: 'Tegucigalpa',
        horasAnticipacionReserva: 12,
        umbralOcupacion: 85,
        autoConfirmarPagos: true,
        permitirEdicionPersonal: true,
        horaCierre: '14:00',
        horaCheckIn: '15:00',
        orientacionCalendario: 'horizontal',
      };

  const huespedesView: HuespedView[] = (payload.huespedes || clientes).map((item: any) => {
    const pId = item.id_huesped || item.id_persona;
    const p = personasMap.get(pId) || {};
    const relevantPagos = pagosView.filter(pv => pv.huespedId === pId).map(pv => ({
      id: pv.id,
      monto: pv.monto,
      fecha: pv.fecha,
      metodo: pv.metodo,
      referencia: pv.referencia,
    }));

    return {
      id: pId,
      nombre: item.nombre_completo || p.nombre || 'Sin nombre',
      correo: item.correo || p.correo || 'N/D',
      telefono: item.telefono || 'N/D',
      ciudad: item.ciudad || p.direccion_ciudad || 'Honduras',
      fechaRegistro: item.fecha_registro || item.created_at || new Date().toISOString(),
      estado: 'Activo',
      pagos: relevantPagos,
    };
  });


  const personalView: PersonalView[] = (payload.personalHotelero || entrenadores).map((item: any) => {
    const p = personasMap.get(item.id_persona) || {};
    return {
      id: item.id_personal || item.id_persona,
      nombre: item.nombre_completo || p.nombre || 'Sin nombre',
      especialidad: item.rol || item.especialidad || 'Servicio',
      estadoLaboral: item.estado === 'Vacaciones' || item.estado === 'vacaciones' ? 'En vacaciones' : 'Activo',
      hotelHoy: 'Hotel Principal',
      sedeHoy: 'Hotel Principal',
      workload: 0,
      assignedCount: 0,
      rating: 5.0,
      availability: 'Disponible',
      schedule: [],
    };
  });

  const reservasBySede = new Map<string, number>();
  for (const reserva of reservasView) {
    reservasBySede.set(reserva.sede, (reservasBySede.get(reserva.sede) ?? 0) + 1);
  }

  const actividadesBySede = new Map<string, number>();
  const entrenadoresBySede = new Map<string, Set<string>>();
  for (const programacion of programaciones) {
    const sede = programacion.id_sede ? sedesMap.get(programacion.id_sede) : null;
    if (!sede) continue;
    actividadesBySede.set(sede.nombre_sede, (actividadesBySede.get(sede.nombre_sede) ?? 0) + 1);
    const current = entrenadoresBySede.get(sede.nombre_sede) ?? new Set<string>();
    if (programacion.id_entrenador) current.add(programacion.id_entrenador);
    entrenadoresBySede.set(sede.nombre_sede, current);
  }

  const hotelesView: HotelView[] = sedes.map(sede => ({
    id: sede.id_sede,
    nombre: sede.nombre_sede,
    ubicacion: sede.ubicacion,
    habitaciones: actividadesBySede.get(sede.nombre_sede) ?? 0,
    personalAsignado: entrenadoresBySede.get(sede.nombre_sede)?.size ?? 0,
    actividades: actividadesBySede.get(sede.nombre_sede) ?? 0,
    entrenadores: entrenadoresBySede.get(sede.nombre_sede)?.size ?? 0,
    reservas: reservasBySede.get(sede.nombre_sede) ?? 0,
  }));

  let habitacionesView: HabitacionView[] = programaciones.map(programacion => {
    const actividad = programacion.id_actividad ? actividadesMap.get(programacion.id_actividad) : null;
    const sede = programacion.id_sede ? sedesMap.get(programacion.id_sede) : null;
    const inscritos = reservasByProgramacion.get(programacion.id_programacion)?.filter(item => item.estado !== 'cancelada').length ?? 0;
    const fechaISO = programacion.horario ? new Date(programacion.horario).toISOString() : new Date().toISOString();

    return {
      id: programacion.id_programacion,
      nombre: actividad?.nombre_actividad ?? 'Sin actividad',
      tipo: actividad?.tipo ?? 'Sin tipo',
      costo: formatCurrency(programacion.costo),
      responsable: resolveName(programacion.id_entrenador, 'Responsable'),
      personal: resolveName(programacion.id_entrenador, 'Personal'),
      hotel: sede?.nombre_sede ?? 'Sin hotel',
      sede: sede?.nombre_sede ?? 'Sin sede',
      horario: new Date(programacion.horario).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
      fechaISO,
      capacidad: programacion.cupo_maximo,
      inscritos,
      estadoOperativo: inscritos >= programacion.cupo_maximo && programacion.cupo_maximo > 0 ? 'ocupada' : 'disponible',
    };
  });

  let estadiasView: EstadiaView[] = reservasView.map((reserva) => ({
    ...reserva,
    checkIn: reserva.fecha,
    checkOut: getCheckOutDate(reserva.fecha),
    noches: 1,
    total: reserva.precioAplicado,
  }));

  if (payload.habitacionesHotel && payload.reservasHotel && payload.hoteles && payload.tiposHabitacion) {
    const freshHoteles = payload.hoteles;
    const freshHabitaciones = payload.habitacionesHotel.map((item) => ({
      ...item,
      capacidad: toNumber(item.capacidad),
      tarifa_noche: toNumber(item.tarifa_noche),
    }));
    const freshReservasHotel = payload.reservasHotel.map((item) => ({
      ...item,
      total_reserva: toNumber(item.total_reserva),
      anticipo: toNumber(item.anticipo),
    }));
    const roomTypesMap = new Map(payload.tiposHabitacion.map((item) => [item.id_tipo_habitacion, item]));
    const freshHotelsMap = new Map(freshHoteles.map((item) => [item.id_hotel, item]));
    const freshRoomsMap = new Map(freshHabitaciones.map((item) => [item.id_habitacion, item]));
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    const activeReservationsByRoom = new Map<string, FreshReservationHotelRow[]>();

    freshReservasHotel
      .filter((item) => item.estado !== 'cancelada' && item.estado !== 'no_show')
      .forEach((item) => {
        const current = activeReservationsByRoom.get(item.id_habitacion) ?? [];
        current.push(item);
        activeReservationsByRoom.set(item.id_habitacion, current);
      });

    habitacionesView = freshHabitaciones.map((room) => {
      const roomType = room.id_tipo_habitacion ? roomTypesMap.get(room.id_tipo_habitacion) : null;
      const hotel = freshHotelsMap.get(room.id_hotel);
      const activeTodayCount = (activeReservationsByRoom.get(room.id_habitacion) ?? []).filter((reservation) => {
        const checkIn = new Date(reservation.check_in);
        const checkOut = new Date(reservation.check_out);
        return checkOut > todayStart && checkIn < tomorrowStart;
      }).length;
      const fechaISO = room.created_at ? new Date(room.created_at).toISOString() : new Date().toISOString();

      return {
        id: room.id_habitacion,
        nombre: room.nombre_habitacion || room.codigo_habitacion || 'Habitacion sin nombre',
        nombre_alias: (room as any).nombre_alias ?? (room as any).nombreAlias ?? null,
        nombreAlias: (room as any).nombre_alias ?? (room as any).nombreAlias ?? null,
        tipo: roomType?.nombre_tipo ?? 'Habitacion',
        costo: formatCurrency(room.tarifa_noche), tarifaNumerica: room.tarifa_noche,
        responsable: 'Sin responsable',
        personal: 'Sin responsable',
        hotel: hotel?.nombre_hotel ?? 'Sin hotel',
        sede: hotel?.nombre_hotel ?? 'Sin sede',
        horario: formatRoomOperationalStatus(room.estado),
        fechaISO,
        capacidad: room.capacidad,
        inscritos: activeTodayCount,
        estadoOperativo: formatRoomOperationalStatus(room.estado),
        cargoPorPersonaExtra: toNumber((room as any).cargo_persona_extra ?? 0),
      };
    });

    const roomCountByHotel = new Map<string, number>();
    freshHabitaciones.forEach((room) => {
      roomCountByHotel.set(room.id_hotel, (roomCountByHotel.get(room.id_hotel) ?? 0) + 1);
    });

    const reservationCountByHotel = new Map<string, number>();
    freshReservasHotel.forEach((reservation) => {
      reservationCountByHotel.set(reservation.id_hotel, (reservationCountByHotel.get(reservation.id_hotel) ?? 0) + 1);
    });

    estadiasView = freshReservasHotel.map((reservation) => {
      const room = freshRoomsMap.get(reservation.id_habitacion);
      const hotel = freshHotelsMap.get(reservation.id_hotel);
      const checkIn = reservation.check_in;
      const checkOut = reservation.check_out;
      const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000));
      const roomReservations = activeReservationsByRoom.get(reservation.id_habitacion) ?? [];

      return {
        id: reservation.id_reserva_hotel,
        programacionId: reservation.id_habitacion,
        huesped: resolveName(reservation.id_huesped, 'Huesped'),
        huespedId: reservation.id_huesped,
        habitacion: room?.nombre_habitacion ?? room?.codigo_habitacion ?? 'Habitacion sin nombre',
        hotel: hotel?.nombre_hotel ?? 'Sin hotel',
        responsable: 'Sin responsable',
        cliente: resolveName(reservation.id_huesped, 'Cliente'),
        clienteId: reservation.id_huesped,
        servicio: room?.nombre_habitacion ?? room?.codigo_habitacion ?? 'Habitacion sin nombre',
        fecha: checkIn,
        estado: mapHotelReservationStatus(reservation.estado),
        sede: hotel?.nombre_hotel ?? 'Sin sede',
        personal: 'Sin responsable',
        precioAplicado: reservation.total_reserva,
        capacidad: room?.capacidad ?? 1,
        inscritos: roomReservations.length,
        checkIn,
        checkOut,
        adultos: reservation.adultos ?? 1,
        ninos: reservation.ninos ?? 0,
        noches: nights,
        total: reservation.total_reserva,
        observaciones: reservation.observaciones ?? undefined,
        anticipo: reservation.anticipo ?? 0,
        moneda: reservation.moneda,
        empresaId: reservation.id_empresa ?? null,
        cortesia: reservation.cortesia ?? false,
      };
    }).sort((left, right) => new Date(left.checkIn).getTime() - new Date(right.checkIn).getTime());

    // Incorporar pagos_hotel frescos a pagosView
    const freshPagosHotel = payload.pagosHotel ?? [];
    const freshPagoIds = new Set(freshPagosHotel.map(p => p.id_pago_hotel));
    // Quitar pagos legacy duplicados que ya existen en pagos_hotel
    pagosView = pagosView.filter(pv => !pv.reservaId || !freshPagoIds.has(pv.id));
    // Agregar pagos frescos de hotel
    for (const fp of freshPagosHotel) {
      const freshReserva = freshReservasHotel.find(r => r.id_reserva_hotel === fp.id_reserva_hotel);
      const room = freshReserva ? freshRoomsMap.get(freshReserva.id_habitacion) : null;
      const hotel = freshReserva ? freshHotelsMap.get(freshReserva.id_hotel) : null;
      pagosView.push({
        id: fp.id_pago_hotel,
        tipo: 'reserva' as const,
        huesped: freshReserva ? resolveName(freshReserva.id_huesped, 'Huesped') : 'Desconocido',
        huespedId: freshReserva?.id_huesped ?? null,
        estadia: room?.nombre_habitacion ?? 'Habitación',
        hotel: hotel?.nombre_hotel ?? 'Sin hotel',
        estadiaId: fp.id_reserva_hotel,
        cliente: freshReserva ? resolveName(freshReserva.id_huesped, 'Cliente') : 'Desconocido',
        clienteId: freshReserva?.id_huesped ?? null,
        correo: '',
        concepto: room?.nombre_habitacion ?? 'Estadía',
        sede: hotel?.nombre_hotel ?? 'Sin sede',
        monto: toNumber(fp.monto_en_moneda_reserva ?? fp.monto),
        moneda: (fp.moneda || 'HNL') as SupportedCurrency,
        montoReserva: toNumber(fp.monto_en_moneda_reserva ?? fp.monto),
        fecha: fp.fecha_pago,
        metodo: fp.metodo_pago ?? 'N/D',
        referencia: fp.referencia ?? 'N/D',
        reservaId: fp.id_reserva_hotel,
        membresiaId: null,
      });
    }
  }

  const inventarioHabitacionesView: InventarioHabitacionView[] = habitacionesView.map((habitacion) => ({
    ...habitacion,
    hotel: habitacion.sede,
    categoria: habitacion.tipo,
    disponible: Math.max(0, habitacion.capacidad - habitacion.inscritos),
    tarifa: habitacion.costo,
  }));

  return {
    personas,
    clientes,
    entrenadores,
    sedes,
    actividades,
    programaciones,
    reservas,
    pagos,
    reservasView,
    huespedesView,
    operationalSettings,
    pagosView,
    tariffCatalog: {
      config: {
        monedaBase: 'HNL' as SupportedCurrency,
        monedaAlterna: 'USD' as SupportedCurrency,
        tipoCambio: 24.6,
        descuentoTerceraEdad: 25,
        edadTerceraEdad: 60,
        porcentajeImpuesto: 0,
        actualizadoEn: '',
      }
    },
    personalView,
    habitacionesView,
    hotelesView,
    estadiasView,
    inventarioHabitacionesView,
    bitacoraView: payload.bitacora ?? [],
  };
}

export type HotelDataSnapshot = Awaited<ReturnType<typeof fetchHotelData>>;

export function buildDashboardData(data: HotelDataSnapshot): DashboardData {
  const today = startOfDayKey(new Date());
  const huespedes = data.huespedesView.length;
  const reservasHoy = data.estadiasView.filter(item => item.fecha && startOfDayKey(item.fecha) === today).length;
  const habitaciones = data.habitacionesView.length;
  const pagosByReserva = data.pagosView.reduce((totals, payment) => {
    if (!payment.reservaId) return totals;
    totals.set(payment.reservaId, (totals.get(payment.reservaId) ?? 0) + payment.monto);
    return totals;
  }, new Map<string, number>());

  const monthlyMap = new Map<string, number>();
  for (const reserva of data.estadiasView) {
    if (!reserva.fecha) continue;
    const date = new Date(reserva.fecha);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
  }

  const monthLabels = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, value]) => {
      const [year, month] = key.split('-').map(Number);
      const date = new Date(year, month, 1);
      return {
        name: formatDateLabel(date, { month: 'short' }),
        reservas: value,
      };
    });

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const dayKey = startOfDayKey(date);
    return data.estadiasView.filter(item => item.fecha && startOfDayKey(item.fecha) === dayKey).length;
  });

  const activos = data.huespedesView.filter(item => item.estado === 'Activo').length;
  const retentionPercent = Math.round((activos / Math.max(1, huespedes)) * 100);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const nuevosHuespedes = data.huespedesView.filter(item => item.fechaRegistro && new Date(item.fechaRegistro) >= thirtyDaysAgo).length;
  const pagosPendientes = data.estadiasView.filter((item) => {
    if (item.estado === 'cancelada') return false;
    const pagado = pagosByReserva.get(item.id) ?? 0;
    return item.precioAplicado - pagado > 0.009;
  }).length;
  const habitacionesLlenas = data.habitacionesView.filter(item => item.inscritos >= item.capacidad && item.capacidad > 0).length;
  const recentActivity = data.bitacoraView;

  return {
    huespedes,
    reservasHoy,
    habitaciones,
    dataMensual: monthLabels,
    week,
    retentionPercent,
    nuevosHuespedes,
    pagosPendientes,
    habitacionesLlenas,
    recentActivity,
  };
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const data = await fetchHotelData();
  return buildDashboardData(data);
}

export async function fetchReservasView() {
  const data = await fetchHotelData();
  return data.reservasView;
}

export async function fetchHuespedesView() {
  const data = await fetchHotelData();
  return data.huespedesView;
}


export async function fetchOperationalSettings() {
  const data = await fetchHotelData();
  return data.operationalSettings;
}

export async function fetchPersonalView() {
  const data = await fetchHotelData();
  return data.personalView;
}

export async function fetchHabitacionesView() {
  const data = await fetchHotelData();
  return data.habitacionesView;
}

export async function fetchHotelesView() {
  const data = await fetchHotelData();
  return data.hotelesView;
}

export async function fetchPagosView() {
  const data = await fetchHotelData();
  return data.pagosView;
}

const normalizeTariffConfig = (config: TariffConfigView): TariffConfigView => {
  const rawRate = Math.max(toNumber(config.tipoCambio), 0);
  const normalizedRate = rawRate > 0 && rawRate < 1 ? 1 / rawRate : rawRate;

  return {
    ...config,
    tipoCambio: normalizedRate,
    descuentoTerceraEdad: toNumber(config.descuentoTerceraEdad),
    edadTerceraEdad: toNumber(config.edadTerceraEdad),
    porcentajeImpuesto: toNumber(config.porcentajeImpuesto),
  };
};

const normalizeCurrentRoomTariff = (rate: CurrentRoomTariffView): CurrentRoomTariffView => ({
  ...rate,
  montoNoche: toNumber(rate.montoNoche),
});

const normalizeCustomTariff = (rate: CustomTariffView): CustomTariffView => ({
  ...rate,
  habitacionId: rate.habitacionId ?? null,
  habitacion: rate.habitacion ?? null,
  codigo: rate.codigo ?? null,
  montoNoche: toNumber(rate.montoNoche),
  prioridad: toNumber(rate.prioridad),
});

export async function fetchTariffCatalog(filters?: { hotelId?: string; refresh?: boolean }) {
  const searchParams = new URLSearchParams();
  if (filters?.hotelId) searchParams.set('hotelId', filters.hotelId);
  if (filters?.refresh) searchParams.set('refresh', 'true');
  const query = searchParams.toString();
  const catalog = await apiRequest<TariffCatalogView>(`/tarifas${query ? `?${query}` : ''}`);
  return {
    config: normalizeTariffConfig(catalog.config),
    actuales: catalog.actuales.map(normalizeCurrentRoomTariff),
    personalizadas: catalog.personalizadas.map(normalizeCustomTariff),
  };
}

export async function saveTariffConfig(input: TariffConfigInput) {
  const config = await apiRequest<TariffConfigView>('/tarifas/configuracion', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return normalizeTariffConfig(config);
}

export async function createCustomTariff(input: CustomTariffInput) {
  const tariff = await apiRequest<CustomTariffView>('/tarifas-personalizadas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normalizeCustomTariff(tariff);
}

export async function updateCustomTariff(idTarifa: string, input: CustomTariffInput) {
  const tariff = await apiRequest<CustomTariffView>(`/tarifas-personalizadas/${idTarifa}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return normalizeCustomTariff(tariff);
}

export async function deleteCustomTariff(idTarifa: string) {
  await apiRequest(`/tarifas-personalizadas/${idTarifa}`, {
    method: 'DELETE',
  });
}

export async function updateCurrentRoomTariff(roomId: string, montoNoche: number) {
  const room = await apiRequest<CurrentRoomTariffView>(`/habitaciones/${roomId}/tarifa`, {
    method: 'PATCH',
    body: JSON.stringify({ montoNoche }),
  });
  return normalizeCurrentRoomTariff(room);
}

export async function createPersonal(input: PersonalFormInput) {
  await apiRequest('/personal', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updatePersonal(id: string, input: PersonalFormInput) {
  await apiRequest(`/personal/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deletePersonal(id: string) {
  await apiRequest(`/personal/${id}`, {
    method: 'DELETE',
  });
}

export async function saveOperationalSettings(settings: OperationalSettings) {
  await apiRequest('/configuracion-operativa', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export type EmpresaListItem = {
  id: string;
  nombre: string;
  rtn: string | null;
  contactoNombre: string | null;
  estado: string;
  saldo: number;
  limiteCredito: number;
  diasCredito: number;
};

export async function fetchEmpresas(search = ''): Promise<EmpresaListItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}&limit=50` : '?limit=50';
  const result = await apiRequest<{ data: any[] }>(`/empresas${qs}`);
  return (result.data ?? []).map((e: any) => ({
    id: e.id ?? e.id_empresa,
    nombre: e.nombre,
    rtn: e.rtn ?? null,
    contactoNombre: e.contacto_nombre ?? e.contactoNombre ?? null,
    estado: e.estado ?? 'activo',
    saldo: Number(e.saldo ?? e.saldo_actual ?? 0),
    limiteCredito: Number(e.limite_credito ?? e.limiteCredito ?? 0),
    diasCredito: Number(e.dias_credito ?? e.diasCredito ?? 30),
  }));
}

export async function createEstadia(input: ReservationCreateInput | EstadiaCreateInput | HotelReservationCreateInput) {
  const normalized = normalizeEstadiaCreateInput(input);

  await apiRequest('/estadias', {
    method: 'POST',
    body: JSON.stringify({
      huespedId: normalized.clienteId,
      habitacionId: normalized.actividadId,
      estado: normalized.estado ?? 'confirmada',
      precioAplicado: normalized.precioAplicado,
      checkIn: normalized.checkIn,
      checkOut: normalized.checkOut,
      noches: normalized.noches,
      adultos: normalized.adultos,
      ninos: normalized.ninos,
      observaciones: normalized.observaciones,
      pago: normalized.pago,
      moneda: normalized.moneda,
      empresaId: ('empresaId' in normalized) ? (normalized as any).empresaId : undefined,
    }),
  });
}

export async function updateEstadia(idReserva: string, input: ReservationCreateInput | EstadiaCreateInput | HotelReservationCreateInput) {
  const normalized = normalizeEstadiaCreateInput(input);

  await apiRequest(`/estadias/${idReserva}`, {
    method: 'PUT',
    body: JSON.stringify({
      huespedId: normalized.clienteId,
      habitacionId: normalized.actividadId,
      estado: normalized.estado ?? 'confirmada',
      precioAplicado: normalized.precioAplicado,
      checkIn: normalized.checkIn,
      checkOut: normalized.checkOut,
      noches: normalized.noches,
      adultos: normalized.adultos,
      ninos: normalized.ninos,
      observaciones: normalized.observaciones,
      pago: normalized.pago,
      moneda: normalized.moneda,
    }),
  });
}

export async function reprogramEstadia(idReserva: string, nextHabitacionId: string) {
  await apiRequest(`/estadias/${idReserva}/reprogramar`, {
    method: 'PATCH',
    body: JSON.stringify({ habitacionId: nextHabitacionId }),
  });
}

export async function cancelEstadia(idReserva: string) {
  await apiRequest(`/estadias/${idReserva}/cancelar`, {
    method: 'PATCH',
  });
}

export async function createHabitacion(input: ServiceFormInput | HabitacionFormInput) {
  const normalized = normalizeHabitacionFormInput(input);

  await apiRequest('/habitaciones', {
    method: 'POST',
    body: JSON.stringify({
      nombreHabitacion: normalized.nombre,
      descripcion: normalized.descripcion,
      tipo: normalized.tipo,
      hotelId: normalized.sedeId,
      responsableId: normalized.entrenadorId || null,
      horario: normalized.horario,
      cupoMaximo: normalized.cupoMaximo,
      costo: normalized.costo,
      codigoHabitacion: normalized.codigo,
      piso: normalized.piso,
      estadoOperativo: normalized.estadoOperativo,
    }),
  });
}

export async function deleteHabitacion(idProgramacion: string) {
  await apiRequest(`/habitaciones/${idProgramacion}`, {
    method: 'DELETE',
  });
}

export async function fetchRoomBlocks(filters?: { hotelId?: string; fechaInicio?: string; fechaFin?: string }) {
  const searchParams = new URLSearchParams();

  if (filters?.hotelId) searchParams.set('hotelId', filters.hotelId);
  if (filters?.fechaInicio) searchParams.set('fechaInicio', filters.fechaInicio);
  if (filters?.fechaFin) searchParams.set('fechaFin', filters.fechaFin);

  const query = searchParams.toString();
  return apiRequest<RoomBlockView[]>(`/bloqueos-habitacion${query ? `?${query}` : ''}`);
}

export async function createRoomBlock(input: {
  habitacionId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  permitirConReservas?: boolean;
}) {
  return apiRequest<RoomBlockView>('/bloqueos-habitacion', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteRoomBlock(idBloqueo: string) {
  await apiRequest(`/bloqueos-habitacion/${idBloqueo}`, {
    method: 'DELETE',
  });
}

export async function createQuickGuest(input: {
  nombre: string;
  correo: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}) {
  const payload = await apiRequest<Partial<HuespedView> & { id?: string; id_huesped?: string; id_persona?: string; nombre?: string; correo?: string; telefono?: string; ciudad?: string; fechaRegistro?: string }>('/huespedes', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      correo: input.correo || '',
    }),
  });

  return {
    id: payload.id ?? payload.id_huesped ?? payload.id_persona ?? '',
    nombre: payload.nombre ?? input.nombre,
    correo: payload.correo ?? input.correo,
    telefono: payload.telefono,
    ciudad: payload.ciudad ?? '',
    fechaRegistro: payload.fechaRegistro ?? new Date().toISOString(),
    estado: 'Sin reservas' as const,
    pagos: [],
  } satisfies HuespedView;
}

export async function createPayment(input: PaymentFormInput) {
  const normalizedReference = input.referencia.trim();

  if (!normalizedReference) {
    throw new Error('La referencia del pago es obligatoria.');
  }

  if (input.monto <= 0) {
    throw new Error('El monto debe ser mayor que cero.');
  }

  if (!input.reservaId) {
    throw new Error('Selecciona una reserva para registrar el pago.');
  }

  await apiRequest('/pagos', {
    method: 'POST',
    body: JSON.stringify({
      monto: input.monto,
      fechaPago: input.fechaPago ?? new Date().toISOString(),
      metodoPago: input.metodoPago,
      referencia: normalizedReference,
      reservaId: input.reservaId,
    }),
  });
}


export async function ensureClientProfile(input: ClientProfileInput) {
  const normalizedEmail = input.correo.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('El correo del cliente es obligatorio.');
  }

  if (!input.fechaNacimiento?.trim()) {
    throw new Error('La fecha de nacimiento es obligatoria para crear el perfil del cliente.');
  }

  const { data: existingPersona, error: lookupError } = await supabase
    .from('personas')
    .select('id_persona')
    .ilike('correo', normalizedEmail)
    .maybeSingle();

  if (lookupError) throw lookupError;

  let personaId = existingPersona?.id_persona ?? null;

  if (!personaId) {
    const { data: createdPersona, error: createPersonaError } = await supabase
      .from('personas')
      .insert({
        nombre: input.nombre,
        correo: normalizedEmail,
        fecha_nacimiento: input.fechaNacimiento,
      })
      .select('id_persona')
      .single();

    if (createPersonaError) throw createPersonaError;
    personaId = createdPersona.id_persona;
  } else {
    const { error: updatePersonaError } = await supabase
      .from('personas')
      .update({
        nombre: input.nombre,
        correo: normalizedEmail,
        fecha_nacimiento: input.fechaNacimiento,
      })
      .eq('id_persona', personaId);

    if (updatePersonaError) throw updatePersonaError;
  }

  const { data: existingClient, error: clientLookupError } = await supabase
    .from('clientes')
    .select('id_persona')
    .eq('id_persona', personaId)
    .maybeSingle();

  if (clientLookupError) throw clientLookupError;

  if (!existingClient?.id_persona) {
    const { error: clientCreateError } = await supabase
      .from('clientes')
      .insert({ id_persona: personaId });

    if (clientCreateError) throw clientCreateError;
  }
}

export async function syncProfilePersona(
  currentEmail: string,
  input: {
    nombre: string;
    correo: string;
    telefono: string;
    ciudad?: string;
    colonia?: string;
    calle?: string;
  },
) {
  const normalizedCurrentEmail = currentEmail.trim().toLowerCase();
  const normalizedNextEmail = input.correo.trim().toLowerCase();

  if (!normalizedCurrentEmail && !normalizedNextEmail) return;

  const matches = await apiRequest<Array<{
    id: string;
    nombre: string;
    correo: string;
    ciudad?: string | null;
    colonia?: string | null;
    calle?: string | null;
    fechaNacimiento?: string | null;
    telefonos: string[];
    esCliente: boolean;
    esEntrenador: boolean;
    especialidad?: string | null;
    estadoLaboral?: string | null;
  }>>(`/personas?search=${encodeURIComponent(normalizedCurrentEmail || normalizedNextEmail)}`);

  const person = matches.find((item) => item.correo?.toLowerCase() === normalizedCurrentEmail)
    ?? matches.find((item) => item.correo?.toLowerCase() === normalizedNextEmail)
    ?? null;

  if (!person?.id) return;

  await apiRequest(`/personas/${person.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      nombre: input.nombre,
      correo: normalizedNextEmail || person.correo,
      telefonos: input.telefono.trim() ? [input.telefono.trim()] : [],
      direccion: {
        ciudad: input.ciudad?.trim() || undefined,
        colonia: input.colonia?.trim() || undefined,
        calle: input.calle?.trim() || undefined,
      },
      fechaNacimiento: person.fechaNacimiento ?? undefined,
      roles: {
        cliente: Boolean(person.esCliente),
        personal: Boolean(person.esEntrenador),
      },
      especialidad: person.esEntrenador ? person.especialidad ?? undefined : undefined,
      estadoLaboral: person.esEntrenador ? (person.estadoLaboral as OperationalUserInput['estadoLaboral'] | undefined) : undefined,
    }),
  });
}

export async function fetchAccessProfiles(): Promise<AccessProfile[]> {
  const { data, error } = await supabase.rpc('list_access_profiles');

  if (error) throw error;

  return ((data ?? []) as Array<{
    user_id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'super_admin';
    permissions: ModulePermissions;
    persona_id: string | null;
    persona_nombre: string | null;
    telefono: string | null;
    profile_type: string;
    email_confirmed: boolean;
    last_sign_in_at: string | null;
    access_expires_at: string | null;
  }>).map((item) => ({
    userId: item.user_id,
    email: item.email,
    fullName: item.full_name,
    role: item.role,
    permissions: item.permissions
      ? { ...DEFAULT_ADMIN_PERMISSIONS, ...(item.permissions as Partial<ModulePermissions>) }
      : (item.role === 'super_admin' ? SUPER_ADMIN_PERMISSIONS : DEFAULT_ADMIN_PERMISSIONS),
    personaId: item.persona_id,
    personaNombre: item.persona_nombre,
    telefono: item.telefono,
    profileType: item.profile_type,
    emailConfirmed: item.email_confirmed,
    lastSignInAt: item.last_sign_in_at,
    accessExpiresAt: item.access_expires_at,
  }));
}

export async function assignAccessRole(userId: string, role: AccessProfile['role'], permissions?: ModulePermissions) {
  const { error } = await supabase.rpc('assign_access_role', {
    target_user_id: userId,
    next_role: role,
    next_permissions: permissions ?? (role === 'super_admin' ? SUPER_ADMIN_PERMISSIONS : DEFAULT_ADMIN_PERMISSIONS),
  });

  if (error) throw error;
}

export async function fetchAccessAudit(limit = 40): Promise<AccessAuditEntry[]> {
  const { data, error } = await supabase.rpc('list_access_audit', {
    limit_count: limit,
  });

  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    actor_user_id: string | null;
    actor_email: string | null;
    target_user_id: string | null;
    target_email: string | null;
    action: string;
    previous_role: string | null;
    next_role: string | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>).map((item) => ({
    id: item.id,
    actorUserId: item.actor_user_id,
    actorEmail: item.actor_email,
    targetUserId: item.target_user_id,
    targetEmail: item.target_email,
    action: item.action,
    previousRole: item.previous_role,
    nextRole: item.next_role,
    reason: item.reason,
    metadata: item.metadata ?? {},
    createdAt: item.created_at,
  }));
}

export async function updateHabitacion(id: string, updates: { estado?: string;  
  nombre_habitacion?: string; 
  capacidad?: number;
  cargo_persona_extra?: number;
  nombre_alias?: string | null;
  tipo?: string;
}) {
  await apiRequest(`/habitaciones/${id}/info`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function fetchAccessInvitations(): Promise<AccessInvitation[]> {
  const { data, error } = await supabase.rpc('list_access_invitations');

  if (error) throw error;

  return ((data ?? []) as Array<{
    id: string;
    email: string;
    full_name: string | null;
    role: 'admin' | 'super_admin';
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    invite_token: string;
    invited_by: string | null;
    invited_by_email: string | null;
    expires_at: string;
    accepted_at: string | null;
    created_at: string;
  }>).map((item) => ({
    id: item.id,
    email: item.email,
    fullName: item.full_name,
    role: item.role,
    status: item.status,
    inviteToken: item.invite_token,
    invitedBy: item.invited_by,
    invitedByEmail: item.invited_by_email,
    expiresAt: item.expires_at,
    acceptedAt: item.accepted_at,
    createdAt: item.created_at,
  }));
}

export async function createAccessInvitation(input: { email: string; fullName: string; role: AccessInvitationRole }) {
  const { data, error } = await supabase.rpc('create_access_invitation', {
    target_email: input.email,
    target_full_name: input.fullName,
    target_role: input.role,
  });

  if (error) throw error;

  const row = (data?.[0] ?? null) as {
    invitation_id: string;
    invite_token: string;
    email: string;
    role: AccessProfile['role'];
    expires_at: string;
  } | null;

  if (!row) {
    throw new Error('No se recibió la invitación creada.');
  }

  return {
    invitationId: row.invitation_id,
    inviteToken: row.invite_token,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at,
  };
}

export async function validateAccessInvitation(inviteToken: string): Promise<InvitationValidation | null> {
  const { data, error } = await supabase.rpc('validate_access_invitation', {
    invite_token_input: inviteToken,
  });

  if (error) throw error;

  const row = (data?.[0] ?? null) as {
    email: string;
    full_name: string | null;
    role: 'admin' | 'super_admin';
    expires_at: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
  } | null;

  if (!row) return null;

  return {
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    expiresAt: row.expires_at,
    status: row.status,
  };
}

export async function consumeAccessInvitation(inviteToken: string, email: string, fullName: string) {
  const { data, error } = await supabase.rpc('consume_access_invitation', {
    invite_token_input: inviteToken,
    invited_email: email,
    invited_full_name: fullName,
  });

  if (error) throw error;

  return (data?.[0] ?? null) as { role: string; email: string } | null;
}

export async function setAccessExpiry(userId: string, expiresAt: string | null) {
  const { error } = await supabase.rpc('set_access_expiry', {
    target_user_id: userId,
    expires_at: expiresAt,
  });
  if (error) throw error;
}

export async function sendInvitationEmail(email: string, fullName: string, inviteUrl: string): Promise<void> {
  await apiRequest('/send-invitation-email', {
    method: 'POST',
    body: JSON.stringify({ email, fullName, inviteUrl }),
  });
}

export async function checkAccessExpiry(): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_access_expiry');
  if (error) return true; // fallback: allow access if check fails
  return data as boolean;
}

export async function updateConfiguracionOperativa(payload: OperationalSettings): Promise<void> {
  return apiRequest('/configuracion-operativa', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function vaciarDatosOperativos(secciones: string[]): Promise<{ ok: boolean; message: string }> {
  return apiRequest('/vaciar-datos', { method: 'POST', body: JSON.stringify({ secciones }) });
}

export async function exportBackupConfig(includeAccess: boolean = false): Promise<void> {
  const data = await apiRequest(`/backup-config?includeAccess=${includeAccess}`);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hotel-verona-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Cierres Diarios ────────────────────────────────────────────────────────

export type CierreDiarioRecord = {
  id: string;
  fecha: string;
  hotel: string;
  encargadoId: string | null;
  encargadoNombre: string | null;
  snapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export async function saveCierreDiario(cierre: {
  fecha: string;
  hotel: string;
  encargadoNombre: string;
  snapshot: Record<string, unknown>;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase.from('cierres_diarios').upsert({
    fecha: cierre.fecha,
    id_hotel: cierre.hotel,
    encargado_id: session?.user?.id ?? null,
    encargado_nombre: cierre.encargadoNombre,
    snapshot: cierre.snapshot,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'fecha,id_hotel' });
  if (error) throw error;
}

export async function loadCierreDiario(fecha: string, hotel: string): Promise<CierreDiarioRecord | null> {
  const { data, error } = await supabase
    .from('cierres_diarios')
    .select('*')
    .eq('fecha', fecha)
    .eq('id_hotel', hotel)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    fecha: data.fecha,
    hotel: data.id_hotel,
    encargadoId: data.encargado_id,
    encargadoNombre: data.encargado_nombre,
    snapshot: data.snapshot,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listCierresDiarios(limit = 30): Promise<CierreDiarioRecord[]> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  let query = supabase
    .from('cierres_diarios')
    .select('*');
  
  if (activeHotelId && activeHotelId !== 'all') {
    query = query.eq('id_hotel', activeHotelId);
  }

  const { data, error } = await query
    .order('fecha', { ascending: false })
    .limit(limit);
    
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id,
    fecha: d.fecha,
    hotel: d.id_hotel,
    encargadoId: d.encargado_id,
    encargadoNombre: d.encargado_nombre,
    snapshot: d.snapshot,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export const fetchActivityLogs = async (limitNum = 100): Promise<ActivityLogView[]> => {
    const { data, error } = await supabase
        .from('bitacora_actividad')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limitNum);

    if (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }

    return (data || []).map(row => ({
        id: row.id_actividad,
        createdAt: row.created_at,
        usuarioId: row.usuario_id,
        entidadId: row.entidad_id,
        tipo: row.tipo,
        accion: row.accion,
        descripcion: row.descripcion
    }));
};

// ─── Chat Operativo ──────────────────────────────────────────────────────────

export type ChatChannel = {
  id: string;
  name: string;
  channelType: 'general' | 'hotel' | 'cierre' | 'privado' | 'cliente';
  createdBy: string | null;
  createdAt: string;
  unreadCount: number;
};

export type ChatMessageRef = {
  id?: string;
  entityType: 'reserva' | 'pago' | 'huesped' | 'habitacion' | 'cierre';
  entityId: string;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'data_card' | 'cierre_share' | 'system';
  metadata: Record<string, unknown>;
  references: ChatMessageRef[];
  createdAt: string;
};

export type EntityCardData = {
  type: string;
  id: string;
  label: string;
  data: Record<string, unknown>;
};

export async function fetchChatChannels(): Promise<ChatChannel[]> {
  return apiRequest<ChatChannel[]>('/chat/channels');
}

export async function fetchChatMessages(channelId: string, before?: string): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ limit: '50' });
  if (before) params.set('before', before);
  return apiRequest<ChatMessage[]>(`/chat/channels/${channelId}/messages?${params}`);
}

export async function sendChatMessage(
  channelId: string,
  content: string,
  messageType: 'text' | 'data_card' | 'cierre_share' | 'system' = 'text',
  metadata?: Record<string, unknown>,
  references?: ChatMessageRef[],
): Promise<ChatMessage> {
  return apiRequest<ChatMessage>(`/chat/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ channelId, content, messageType, metadata, references }),
  });
}

export async function fetchEntityCard(entityType: string, entityId: string): Promise<EntityCardData> {
  return apiRequest<EntityCardData>(`/chat/entity/${entityType}/${entityId}`);
}
