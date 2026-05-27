import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, FileSpreadsheet, Plus, X } from 'lucide-react';
import { ImportadorReservas } from './ImportadorReservas';
import { useNavigate } from 'react-router-dom';
import {
  addDays,
  cancelReserva,
  checkOutFromNights,
  createEmpresa,
  createHuesped,
  createReserva,
  fetchEmpresas,
  fetchHabitaciones,
  fetchHoteles,
  fetchHuespedes,
  fetchReservas,
  fetchBloques,
  toggleBloqueo,
  updateReserva,
  splitReserva,
  getStatusColor,
  getStatusLabel,
  nightsBetween,
  startOfDay,
  toDateKey,
  getOnlyDate,
  type DisplayStatus,
  type Empresa,
  type EstadoReserva,
  type Habitacion,
  type Hotel,
  type Huesped,
  type Reserva,
  type BloqueHabitacion,
} from '../../api/bookingsService';
import { obtenerConfigHotelera } from '../../api/configService';

// ─── Constants ───────────────────────────────────────────────────────────────

type WizardStep = 'datos' | 'tarifas' | 'resumen';

const WIZARD_STEPS: { id: WizardStep; title: string; caption: string }[] = [
  { id: 'datos', title: 'Datos', caption: 'Huésped, habitación y fechas' },
  { id: 'tarifas', title: 'Tarifas', caption: 'Esquema y cálculo' },
  { id: 'resumen', title: 'Resumen', caption: 'Revisión final y cierre' },
];

interface EditorForm {
  tipoReserva: 'noche' | 'hora' | 'pasadia';
  fechaHoraDate: string;
  horaCheckIn: string;
  horaCheckOut: string;
  huespedId: string;
  habitacionId: string;
  checkIn: string;
  checkOut: string;
  modoFechas: 'noches' | 'rango';
  noches: number;
  adultos: number;
  ninos: number;
  estado: EstadoReserva;
  tarifaManual: number;
  aplicarDescuento: boolean;
  esCredito: boolean;
  empresaId: string;
  esCortesia: boolean;
  camaExtra: boolean;
  limpiezaDiaria: boolean;
  neverita: boolean;
  plancha: boolean;
  observaciones: string;
  nuevoNombre: string;
  nuevoCorreo: string;
  nuevoTelefono: string;
  nuevaCiudad: string;
  nuevaDireccion: string;
  registrarNuevo: boolean;
}

function defaultForm(checkIn?: string, habitacionId?: string): EditorForm {
  const today = toDateKey(new Date());
  const ci = checkIn ?? today + 'T14:00';
  return {
    tipoReserva: 'noche',
    fechaHoraDate: checkIn ? getOnlyDate(checkIn) : today,
    horaCheckIn: '12:00',
    horaCheckOut: '15:00',
    huespedId: '',
    habitacionId: habitacionId ?? '',
    checkIn: ci,
    checkOut: checkOutFromNights(ci, 1),
    modoFechas: 'noches',
    noches: 1,
    adultos: 1,
    ninos: 0,
    estado: 'confirmada',
    tarifaManual: 0,
    aplicarDescuento: false,
    esCredito: false,
    empresaId: '',
    esCortesia: false,
    camaExtra: false,
    limpiezaDiaria: false,
    neverita: false,
    plancha: false,
    observaciones: '',
    nuevoNombre: '',
    nuevoCorreo: '',
    nuevoTelefono: '',
    nuevaCiudad: '',
    nuevaDireccion: '',
    registrarNuevo: false,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const Bookings: React.FC = () => {
  const navigate = useNavigate();
  // ── Data ──
  const [hoteles, setHoteles] = useState<Hotel[]>([]);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [huespedes, setHuespedes] = useState<Huesped[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [bloqueos, setBloqueos] = useState<BloqueHabitacion[]>([]);
  const [modoBloqueo, setModoBloqueo] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hotelConfig, setHotelConfig] = useState<any>(null);

  // ── Filters ──
  const [hotelFiltro, setHotelFiltro] = useState<string>(() => {
    const active = localStorage.getItem('active_hotel_id');
    return (active && active !== 'all') ? active : 'todos';
  });

  // ── Matrix navigation ──
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // ── Editor / wizard ──
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReserva, setEditingReserva] = useState<Reserva | null>(null);
  const [carouselTick, setCarouselTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselTick(t => t + 1);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const [wizardStep, setWizardStep] = useState<WizardStep>('datos');
  const [form, setForm] = useState<EditorForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelModalData, setCancelModalData] = useState<{ reserva: Reserva; totalPagado: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matrixRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [detailReserva, setDetailReserva] = useState<Reserva | null>(null);
  const [importadorOpen, setImportadorOpen] = useState(false);
  // ── Nueva empresa inline ──
  const [showNuevaEmpresa, setShowNuevaEmpresa] = useState(false);
  const [nuevaEmpresaNombre, setNuevaEmpresaNombre] = useState('');
  const [nuevaEmpresaRtn, setNuevaEmpresaRtn] = useState('');
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  // ── Context Menu ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; reserva: Reserva } | null>(null);

  // ── Move / Drag reserva ──
  const [movingReserva, setMovingReserva] = useState<Reserva | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ habId: string; dayKey: string } | null>(null);
  const [moveConfirmPending, setMoveConfirmPending] = useState<{
    reserva: Reserva; targetHab: Habitacion; missingAmenities: string[]; typeMismatch?: boolean; originalType?: string; targetType?: string;
  } | null>(null);

  // ── Ampliar/Reducir (drag handle estilo Excel) ──
  const [resizingState, setResizingState] = useState<{
    reserva: Reserva;
    direction: 'top' | 'bottom' | null;
    hoveredDate: string;
    tentativeCi: string;
    tentativeCo: string;
    isPendingConfirm?: boolean;
  } | null>(null);

  // ── Dividir Estancia (Split Stay) ──
  const [splitStayState, setSplitStayState] = useState<{ reserva: Reserva } | null>(null);
  const [selectedSplitDate, setSelectedSplitDate] = useState<string>('');
  const [savingSplit, setSavingSplit] = useState(false);

  // ── Toast ──
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rangeStart = toDateKey(addDays(viewMonth, -365));
      const rangeEnd = toDateKey(addDays(viewMonth, 365));
      const activeHotelId = localStorage.getItem('active_hotel_id') || '2816eaed-e555-44b1-a7dc-f5772e4784de';
      const [h, hab, hues, res, emps, bloq, configData] = await Promise.all([
        fetchHoteles(),
        fetchHabitaciones(),
        fetchHuespedes(),
        fetchReservas(rangeStart, rangeEnd),
        fetchEmpresas(),
        fetchBloques(rangeStart, rangeEnd),
        obtenerConfigHotelera(activeHotelId).catch(() => null),
      ]);
      setHoteles(h);
      setHabitaciones(hab);
      setHuespedes(hues);
      setReservas(res);
      setEmpresas(emps);
      setBloqueos(bloq || []);

      let singleConfig = null;
      if (configData) {
        if (Array.isArray(configData)) {
          singleConfig = configData[0] || null;
        } else {
          singleConfig = configData;
        }
      }
      setHotelConfig(singleConfig);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [viewMonth]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handleReload = () => {
      void load();
    };
    window.addEventListener('reloadBookings', handleReload);
    return () => window.removeEventListener('reloadBookings', handleReload);
  }, [load]);

  // ── Global ESC Handler ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMovingReserva(null);
        setMoveTarget(null);
        setResizingState(null);
        setMoveConfirmPending(null);
        setCtxMenu(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Global MouseUp Handler for Resize ──
  useEffect(() => {
    function handleMouseUp() {
      setResizingState(s => {
        if (!s || s.isPendingConfirm || s.direction === null) return s;
        const ciStr = s.tentativeCi;
        const coStr = s.tentativeCo;
        const hovered = s.hoveredDate;
        let newCi = ciStr, newCo = coStr;

        if (s.direction === 'bottom') {
          const lastNightDate = new Date(hovered + 'T12:00:00Z');
          lastNightDate.setUTCDate(lastNightDate.getUTCDate() + 1);
          const nextDayStr = lastNightDate.toISOString().split('T')[0];
          const minCoDate = new Date(ciStr + 'T12:00:00Z');
          minCoDate.setUTCDate(minCoDate.getUTCDate() + 1);
          const minCoStr = minCoDate.toISOString().split('T')[0];
          newCo = nextDayStr > minCoStr ? nextDayStr : minCoStr;
        } else if (s.direction === 'top') {
          const maxCiDate = new Date(coStr + 'T12:00:00Z');
          maxCiDate.setUTCDate(maxCiDate.getUTCDate() - 1);
          const maxCiStr = maxCiDate.toISOString().split('T')[0];
          newCi = hovered < maxCiStr ? hovered : maxCiStr;
        }

        return {
          ...s,
          tentativeCi: newCi,
          tentativeCo: newCo,
          direction: null,
          isPendingConfirm: true,
        };
      });
    }
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);
  // ── Derived ──
  const splitOptions = useMemo(() => {
    if (!splitStayState) return [];
    const ci = getOnlyDate(splitStayState.reserva.check_in);
    const co = getOnlyDate(splitStayState.reserva.check_out);

    const options: { dateKey: string; label: string }[] = [];
    const checkInDateObj = new Date(ci + 'T12:00:00Z');
    const checkOutDateObj = new Date(co + 'T12:00:00Z');

    let current = new Date(checkInDateObj.getTime() + 24 * 60 * 60 * 1000);
    while (current < checkOutDateObj) {
      const dateKey = toDateKey(current);
      const label = current.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
      options.push({ dateKey, label });
      current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    }
    return options;
  }, [splitStayState]);

  const habitacionesFiltradas = useMemo(() => {
    const filtered = hotelFiltro === 'todos' ? habitaciones : habitaciones.filter(h => h.id_hotel === hotelFiltro);

    // Ordenar por número extraído del nombre
    return filtered.sort((a, b) => {
      const numA = parseInt(a.nombre_habitacion.match(/\d+/)?.[0] ?? '0', 10);
      const numB = parseInt(b.nombre_habitacion.match(/\d+/)?.[0] ?? '0', 10);
      return numA - numB;
    });
  }, [habitaciones, hotelFiltro]);

  const monthDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));
  }, [viewMonth]);

  const matrixStats = useMemo(() => {
    const today = startOfDay(new Date());
    const ocupadasHoy = habitacionesFiltradas.filter(hab =>
      reservas.some(r => {
        if (r.id_habitacion !== hab.id_habitacion) return false;
        const ci = startOfDay(r.check_in);
        const co = startOfDay(r.check_out);
        return today >= ci && today < co;
      })
    ).length;
    let celdasOcupadas = 0;
    const total = habitacionesFiltradas.length * monthDays.length;
    for (const hab of habitacionesFiltradas) {
      for (const day of monthDays) {
        const occupied = reservas.some(r => {
          if (r.id_habitacion !== hab.id_habitacion) return false;
          const ci = startOfDay(r.check_in);
          const co = startOfDay(r.check_out);
          return day >= ci && day < co;
        });
        if (occupied) celdasOcupadas++;
      }
    }
    const pct = total > 0 ? Math.round((celdasOcupadas / total) * 100) : 0;
    return { pct, ocupadasHoy };
  }, [habitacionesFiltradas, reservas, monthDays]);

  const selectedHabitacion = useMemo(
    () => habitaciones.find(h => h.id_habitacion === form.habitacionId) ?? null,
    [habitaciones, form.habitacionId],
  );

  const precioBase = selectedHabitacion?.tarifa_noche ?? 0;

  const rates = useMemo(() => {
    const isvRate = hotelConfig?.tasa_isv !== undefined ? hotelConfig.tasa_isv : 0.15;
    const turisticaRate = hotelConfig?.tasa_turistica !== undefined ? hotelConfig.tasa_turistica : 0.04;
    const taxFactor = 1 + isvRate + turisticaRate;

    if (form.esCortesia) {
      return {
        subtotalBruto: 0,
        discount: 0,
        subtotal: 0,
        isv: 0,
        tasaTuristica: 0,
        total: 0,
        isvRate,
        turisticaRate,
      };
    }

    if (form.tipoReserva === 'hora') {
      const total = form.tarifaManual;
      const subtotal = +(total / taxFactor).toFixed(2);
      const isv = +(subtotal * isvRate).toFixed(2);
      const tasaTuristica = +(total - subtotal - isv).toFixed(2);
      return {
        subtotalBruto: subtotal,
        discount: 0,
        subtotal,
        isv,
        tasaTuristica,
        total,
        isvRate,
        turisticaRate,
      };
    }

    const pricePerNoche = form.tarifaManual > 0 ? form.tarifaManual : precioBase;
    const totalBruto = pricePerNoche * form.noches;
    const discountBruto = form.aplicarDescuento ? totalBruto * 0.15 : 0;
    const total = +(totalBruto - discountBruto).toFixed(2);

    const subtotalBruto = +(totalBruto / taxFactor).toFixed(2);
    const discount = +(discountBruto / taxFactor).toFixed(2);
    const subtotal = +(total / taxFactor).toFixed(2);
    const isv = +(subtotal * isvRate).toFixed(2);
    const tasaTuristica = +(total - subtotal - isv).toFixed(2);

    return {
      subtotalBruto,
      discount,
      subtotal,
      isv,
      tasaTuristica,
      total,
      isvRate,
      turisticaRate,
    };
  }, [form.tarifaManual, form.aplicarDescuento, form.noches, form.esCortesia, form.tipoReserva, precioBase, hotelConfig]);

  const totalEstimado = useMemo(() => {
    return rates.total;
  }, [rates]);

  const selectedGuest = useMemo(
    () => huespedes.find(h => h.id_huesped === form.huespedId) ?? null,
    [huespedes, form.huespedId],
  );

  const guestName = (g: typeof selectedGuest) => g?.nombre_completo ?? '—';

  const wizardMeta = WIZARD_STEPS.find(s => s.id === wizardStep)!;

  // ── Calcular montos pagados por reserva (para fallback local) ──
  const paidAmountsByReservation = useMemo(() => {
    const map = new Map<string, number>();
    reservas.forEach(r => {
      const pagado = (r.pagos ?? [])
        .filter(p => p.estado !== 'anulado')
        .reduce((sum, p) => sum + p.monto, 0);
      map.set(r.id_reserva_hotel, pagado);
    });
    return map;
  }, [reservas]);

  // ── Estado efectivo: BD primero, cálculo local como fallback ──
  const getEffectiveStatus = useCallback((reserva: Reserva): DisplayStatus => {
    const validStatuses: DisplayStatus[] = ['reservada', 'pagada', 'abonada', 'pendiente', 'credito', 'cortesia', 'check_out', 'cancelada', 'confirmada', 'check_in'];

    // 1. Leer estado_display de la BD si existe y es válido
    const fromBD = reserva.estado_display as string;
    if (fromBD && validStatuses.includes(fromBD as DisplayStatus)) {
      return fromBD as DisplayStatus;
    }

    // 2. Fallback: calcular localmente (mismo flujo que el trigger SQL)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalPaid = paidAmountsByReservation.get(reserva.id_reserva_hotel) ?? 0;
    const totalDue = Math.max(0, reserva.total_reserva ?? 0);

    const checkOutDate = new Date(reserva.check_out);
    checkOutDate.setHours(0, 0, 0, 0);
    const isConsumed = checkOutDate.getTime() <= todayStart.getTime();
    const isFullyPaid = totalDue > 0 && totalPaid + 0.009 >= totalDue;
    const hasPartialPayment = totalPaid > 0 && !isFullyPaid;

    if (reserva.estado === 'cancelada') return 'cancelada';
    if (reserva.es_cortesia) return 'cortesia';
    if (reserva.id_empresa) return 'credito';
    if (reserva.estado === 'check_in') return 'check_in';
    if (reserva.estado === 'check_out') return 'check_out';
    if (totalDue === 0) return 'cortesia';
    if (isFullyPaid && isConsumed) return 'check_out';
    if (isFullyPaid) return 'pagada';
    if (hasPartialPayment && !isConsumed) return 'abonada';
    if (isConsumed) return 'pendiente';
    return 'reservada';
  }, [paidAmountsByReservation]);

  // ── Calcular estado y banderas de una noche específica de una reserva ──
  const getNightStatusInfo = useCallback((reserva: Reserva, dateStr: string) => {
    const todayStr = toDateKey(new Date());
    const checkInStr = getOnlyDate(reserva.check_in);
    const checkOutStr = getOnlyDate(reserva.check_out);

    if (reserva.tipo_reserva === 'hora') {
      if (dateStr !== checkInStr) return null;
    } else {
      if (dateStr < checkInStr || dateStr >= checkOutStr) {
        return null;
      }
    }

    if (reserva.estado === 'cancelada') {
      return { status: 'cancelada' as DisplayStatus, isCheckIn: false, isCheckOut: false };
    }

    // Generar todas las noches de la reserva
    const allNights: string[] = [];
    if (reserva.tipo_reserva === 'hora') {
      allNights.push(checkInStr);
    } else {
      const cur = new Date(checkInStr + 'T12:00:00');
      const end = new Date(checkOutStr + 'T12:00:00');
      while (cur < end) {
        allNights.push(toDateKey(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const totalPaid = paidAmountsByReservation.get(reserva.id_reserva_hotel) ?? 0;
    const k = allNights.length || 1;
    const ratePerNight = (reserva.total_reserva ?? 0) / k;

    let nightPaid = 0;
    const nightIndex = allNights.indexOf(dateStr);
    if (nightIndex !== -1) {
      // Distribución del pago cronológicamente
      const accumulatedPaid = Math.max(0, totalPaid - nightIndex * ratePerNight);
      nightPaid = Math.min(ratePerNight, accumulatedPaid);
    }

    const isFullyPaid = ratePerNight > 0 ? (nightPaid + 0.009 >= ratePerNight) : true;
    const hasPartialPayment = nightPaid > 0 && !isFullyPaid;

    const isFirstNight = dateStr === checkInStr;
    const isLastNight = nightIndex === allNights.length - 1;

    const isCredito = !!reserva.id_empresa;
    const isCortesia = !!reserva.es_cortesia || reserva.estado_pago === 'cortesia';

    let status: DisplayStatus = 'reservada';

    if (reserva.estado === 'check_out') {
      // Si la reserva ya completó check-out, las noches consumidas (anteriores al check-out)
      // se muestran como completada. Las noches a partir del check-out son por_confirmar.
      if (reserva.tipo_reserva === 'hora') {
        status = 'completada';
      } else {
        status = dateStr < checkOutStr ? 'completada' : 'por_confirmar';
      }
    } else if (isCortesia) {
      status = 'cortesia';
    } else {
      if (dateStr > todayStr) {
        // Noche futura
        status = (isFullyPaid || isCredito) ? 'pagada' : 'reservada';
      } else if (dateStr === todayStr) {
        // Noche actual (de hoy)
        if (reserva.estado === 'check_in') {
          status = (isFullyPaid || isCredito) ? 'en_el_hotel' : 'check_in_pendiente';
        } else {
          status = (isFullyPaid || isCredito) ? 'pagada' : 'reservada';
        }
      } else {
        // Noche pasada
        if (isCredito) {
          status = isFullyPaid ? 'completada' : 'credito';
        } else if (isFullyPaid) {
          status = 'completada';
        } else if (hasPartialPayment) {
          status = 'abonada';
        } else {
          status = 'pendiente';
        }
      }
    }

    return {
      status,
      isCheckIn: isFirstNight && (reserva.estado === 'check_in' || reserva.estado === 'check_out'),
      isCheckOut: isLastNight && reserva.estado === 'check_out',
    };
  }, [paidAmountsByReservation]);

  // ── Matrix grid (columnas = habitaciones, filas = días) ──
  const colGrid = useMemo(() => {
    type CellInfo =
      | { type: 'start'; rowSpan: number; reservas: Reserva[] }
      | { type: 'skip' }
      | { type: 'empty'; day: Date };
    return habitacionesFiltradas.map(hab => {
      const map = new Map<string, CellInfo>();
      const roomReservas = reservas.filter(r => r.id_habitacion === hab.id_habitacion);
      let i = 0;
      while (i < monthDays.length) {
        const day = monthDays[i];
        const dayKey = toDateKey(day);

        const dayReservas = roomReservas.filter(rv => {
          const ci = getOnlyDate(rv.check_in);
          const co = getOnlyDate(rv.check_out);
          if (rv.tipo_reserva === 'hora') {
            return dayKey === ci;
          } else {
            return dayKey >= ci && dayKey < co;
          }
        });

        if (dayReservas.length > 0) {
          dayReservas.sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
          map.set(dayKey, { type: 'start', rowSpan: 1, reservas: dayReservas });
          i++;
        } else {
          map.set(dayKey, { type: 'empty', day });
          i++;
        }
      }
      return map;
    });
  }, [habitacionesFiltradas, reservas, monthDays]);

  // ── Available rooms for move (solo habitaciones sin conflicto en el rango exacto) ──
  const availableMoveRooms = useMemo(() => {
    if (!movingReserva) return new Set<string>();
    const ciStr = getOnlyDate(movingReserva.check_in);
    const coStr = getOnlyDate(movingReserva.check_out);
    const result = new Set<string>();

    // Obtener hotel de la habitación original para evitar traslados entre distintas propiedades
    const originalHab = habitaciones.find(h => h.id_habitacion === movingReserva.id_habitacion);
    const originalHotelId = originalHab?.id_hotel;

    for (const hab of habitacionesFiltradas) {
      if (hab.id_habitacion === movingReserva.id_habitacion) continue;

      // Impedir traslados entre hoteles diferentes (inconsistencia contable/tarifaria)
      if (originalHotelId && hab.id_hotel !== originalHotelId) continue;

      const conflict = reservas.some(r =>
        r.id_reserva_hotel !== movingReserva.id_reserva_hotel &&
        r.id_habitacion === hab.id_habitacion &&
        getOnlyDate(r.check_in) < coStr &&
        getOnlyDate(r.check_out) > ciStr
      );
      if (!conflict) result.add(hab.id_habitacion);
    }
    return result;
  }, [movingReserva, reservas, habitacionesFiltradas, habitaciones]);

  async function handleToggleBlock(idHabitacion: string, fechaStr: string) {
    const todayStr = toDateKey(new Date());
    if (fechaStr < todayStr) {
      showToast('No puedes bloquear fechas en el pasado.', 'err');
      return;
    }
    try {
      setLoading(true);
      const res = await toggleBloqueo(idHabitacion, fechaStr);
      if (res.success) {
        showToast(res.action === 'added' ? 'Habitación bloqueada con éxito.' : 'Habitación habilitada con éxito.');
        void load();
      }
    } catch (err: any) {
      showToast(err.message ?? 'Error al cambiar la disponibilidad', 'err');
    } finally {
      setLoading(false);
    }
  }

  async function updateEstado(idReserva: string, nuevoEstado: EstadoReserva) {
    const res = reservas.find(r => r.id_reserva_hotel === idReserva);
    if (!res) return;

    const todayStr = toDateKey(new Date());

    if (nuevoEstado === 'check_in') {
      if (getOnlyDate(res.check_in) !== todayStr) {
        showToast(`El check-in solo se puede registrar en la fecha de entrada programada (${getOnlyDate(res.check_in)}).`, 'err');
        return;
      }
    }

    let finalCheckOut = res.check_out;
    let finalTotal = res.total_reserva;

    if (nuevoEstado === 'check_out') {
      const checkInStr = getOnlyDate(res.check_in);
      const checkOutStr = getOnlyDate(res.check_out);

      if (todayStr >= checkInStr && todayStr < checkOutStr) {
        const releaseRoom = window.confirm(
          'El huésped está realizando Check-out antes de la fecha programada.\n\n' +
          '¿Desea liberar la habitación para las noches restantes?\n' +
          'Esto acortará la estancia hasta hoy y recalculará el total.'
        );
        if (releaseRoom) {
          if (checkInStr === todayStr) {
            const ciDate = new Date(res.check_in);
            const coDate = new Date(ciDate.getTime() + 5 * 60 * 1000);
            finalCheckOut = coDate.toISOString();
          } else {
            finalCheckOut = todayStr + 'T12:00:00';
          }
          const originalNoches = nightsBetween(res.check_in, res.check_out) || 1;
          const actualNoches = Math.max(1, nightsBetween(res.check_in, finalCheckOut));
          const ratePerNight = res.total_reserva / originalNoches;
          finalTotal = Number((ratePerNight * actualNoches).toFixed(2));
        }
      }
    }

    try {
      setLoading(true);
      await updateReserva(idReserva, {
        estado: nuevoEstado,
        check_out: finalCheckOut,
        total_reserva: finalTotal,
      } as any);
      showToast('Estado actualizado con éxito.');
      void load();
    } catch (err: any) {
      showToast(err.message ?? 'Error al actualizar el estado', 'err');
    } finally {
      setLoading(false);
    }
  }

  function openNewReserva(habitacionId?: string, checkIn?: string, contextHoraReserva?: Reserva) {
    if (checkIn && !contextHoraReserva) {
      const todayStr = toDateKey(new Date());
      if (checkIn < todayStr) {
        showToast('No puedes crear reservas en el pasado.', 'err');
        return;
      }
    }
    setEditingReserva(null);

    if (contextHoraReserva) {
      const newForm = defaultForm(checkIn, habitacionId);
      const endD = new Date(contextHoraReserva.check_out);
      const h = endD.getHours().toString().padStart(2, '0');
      const m = endD.getMinutes().toString().padStart(2, '0');
      const startH = `${h}:${m}`;

      endD.setHours(endD.getHours() + 3);
      const endH2 = endD.getHours().toString().padStart(2, '0');
      const endM2 = endD.getMinutes().toString().padStart(2, '0');
      const endH = `${endH2}:${endM2}`;

      setForm({
        ...newForm,
        tipoReserva: 'hora',
        fechaHoraDate: getOnlyDate(contextHoraReserva.check_out),
        horaCheckIn: startH,
        horaCheckOut: endH
      });
    } else {
      setForm(defaultForm(checkIn, habitacionId));
    }

    setWizardStep('datos');
    setEditorOpen(true);
  }

  function openEditReserva(r: Reserva) {
    setEditingReserva(r);
    const noches = r.noches ?? nightsBetween(r.check_in, r.check_out);
    const tReserva = r.tipo_reserva ?? 'noche';
    const timeIn = r.check_in.includes('T') ? r.check_in.split('T')[1].slice(0, 5) : '12:00';
    const timeOut = r.check_out.includes('T') ? r.check_out.split('T')[1].slice(0, 5) : '15:00';

    setForm({
      tipoReserva: tReserva,
      fechaHoraDate: getOnlyDate(r.check_in),
      horaCheckIn: timeIn,
      horaCheckOut: timeOut,
      huespedId: r.id_huesped,
      habitacionId: r.id_habitacion,
      checkIn: r.check_in,
      checkOut: r.check_out,
      modoFechas: 'rango',
      noches,
      adultos: r.adultos,
      ninos: r.ninos,
      estado: r.estado,
      tarifaManual: tReserva === 'hora' ? r.total_reserva : r.total_reserva / (noches || 1),
      aplicarDescuento: false,
      esCredito: !!r.id_empresa,
      empresaId: r.id_empresa ?? '',
      esCortesia: r.es_cortesia ?? false,
      camaExtra: r.cama_extra ?? false,
      limpiezaDiaria: r.limpieza_diaria ?? false,
      neverita: r.neverita ?? false,
      plancha: r.plancha ?? false,
      observaciones: r.observaciones ?? '',
      nuevoNombre: '',
      nuevoCorreo: '',
      nuevoTelefono: '',
      nuevaCiudad: '',
      nuevaDireccion: '',
      registrarNuevo: false,
    });
    setWizardStep('datos');
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingReserva(null);
  }

  // ── Context Menu ──
  function openCtxMenu(e: React.MouseEvent, reserva: Reserva) {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, reserva });
  }

  function closeCtxMenu() { setCtxMenu(null); }

  // ── Dividir Estancia (Split Stay) ──
  function handleOpenSplitStay(reserva: Reserva) {
    const ci = getOnlyDate(reserva.check_in);
    const checkInDateObj = new Date(ci + 'T12:00:00Z');
    const firstSplitDate = new Date(checkInDateObj.getTime() + 24 * 60 * 60 * 1000);
    const firstSplitStr = toDateKey(firstSplitDate);

    setSelectedSplitDate(firstSplitStr);
    setSplitStayState({ reserva });
  }

  async function confirmSplitStay() {
    if (!splitStayState || !selectedSplitDate) return;
    setSavingSplit(true);
    try {
      const res = await splitReserva(splitStayState.reserva.id_reserva_hotel, selectedSplitDate);
      if (res.error) {
        showToast(`Error al dividir la reserva: ${res.error}`, 'err');
        setSavingSplit(false);
      } else {
        showToast('La reserva se ha dividido con éxito.', 'ok');
        setTimeout(() => {
          setSplitStayState(null);
          void load();
          setSavingSplit(false);
        }, 2500);
      }
    } catch (e) {
      console.error(e);
      showToast('Error al dividir la reserva.', 'err');
      setSavingSplit(false);
    }
  }

  // ── Move reserva ──
  function startMoving(reserva: Reserva) {
    closeCtxMenu();
    const todayStr = toDateKey(new Date());
    const isPast = reserva.estado === 'check_in' ||
      reserva.estado === 'check_out' ||
      reserva.estado === 'cancelada' ||
      getOnlyDate(reserva.check_in) < todayStr ||
      getOnlyDate(reserva.check_out) < todayStr;
    if (isPast) {
      showToast('No se pueden modificar reservas del pasado.', 'err');
      return;
    }
    setMovingReserva(reserva);
    setMoveTarget(null);
  }

  async function confirmMove() {
    if (!movingReserva || !moveTarget) return;
    const targetHab = habitaciones.find(h => h.id_habitacion === moveTarget.habId);
    if (!targetHab) return;

    // Check if destination is already occupied
    const ciStr = getOnlyDate(movingReserva.check_in);
    const coStr = getOnlyDate(movingReserva.check_out);
    const conflict = reservas.some(r =>
      r.id_reserva_hotel !== movingReserva.id_reserva_hotel &&
      r.id_habitacion === moveTarget.habId &&
      getOnlyDate(r.check_in) < coStr &&
      getOnlyDate(r.check_out) > ciStr
    );
    if (conflict) {
      showToast('La habitación destino ya está ocupada en ese rango de fechas.', 'err');
      setMovingReserva(null);
      setMoveTarget(null);
      return;
    }

    // Check amenity compatibility
    const missing: string[] = [];
    const habComodidades = (targetHab as any).comodidades ?? [];
    const hasAmenity = (key: string) =>
      Array.isArray(habComodidades)
        ? habComodidades.some((c: any) => (typeof c === 'string' ? c : c?.nombre ?? c?.label ?? '').toLowerCase().includes(key))
        : false;

    if (movingReserva.cama_extra && !hasAmenity('cama')) missing.push('🛏️ Cama Extra');
    if (movingReserva.neverita && !hasAmenity('neverita')) missing.push('🧊 Neverita/Minibar');
    if (movingReserva.plancha && !hasAmenity('plancha')) missing.push('💨 Plancha');
    if (movingReserva.limpieza_diaria && !hasAmenity('limpieza')) missing.push('🧹 Limpieza Diaria');

    // Check room type mismatch
    const targetHabType = targetHab.tipo || (targetHab as any).tipo_habitacion || '';
    const originalHab = habitaciones.find(h => h.id_habitacion === movingReserva.id_habitacion);
    const originalHabType = originalHab?.tipo || (originalHab as any)?.tipo_habitacion || '';
    const typeMismatch = originalHabType && targetHabType && originalHabType !== targetHabType;

    setMoveConfirmPending({
      reserva: movingReserva, targetHab, missingAmenities: missing,
      typeMismatch: !!typeMismatch, originalType: originalHabType, targetType: targetHabType
    });
  }

  async function doMove(reserva: Reserva, newHabId: string) {
    try {
      await updateReserva(reserva.id_reserva_hotel, { id_habitacion: newHabId } as any);
      showToast('Reserva movida correctamente.');
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al mover la reserva.', 'err');
    } finally {
      setMovingReserva(null);
      setMoveTarget(null);
      setMoveConfirmPending(null);
    }
  }

  // \u2500\u2500 Ampliar/Reducir estilo Excel (drag handles) \u2500\u2500
  function startResize(reserva: Reserva, direction: 'top' | 'bottom') {
    const todayStr = toDateKey(new Date());
    const isPast = reserva.estado === 'check_in' ||
      reserva.estado === 'check_out' ||
      reserva.estado === 'cancelada' ||
      getOnlyDate(reserva.check_in) < todayStr ||
      getOnlyDate(reserva.check_out) < todayStr;
    if (isPast) {
      showToast('No se pueden modificar reservas del pasado.', 'err');
      return;
    }
    setResizingState(s => {
      const isSame = s?.reserva.id_reserva_hotel === reserva.id_reserva_hotel;
      const tentativeCi = isSame ? s.tentativeCi : getOnlyDate(reserva.check_in);
      const tentativeCo = isSame ? s.tentativeCo : getOnlyDate(reserva.check_out);
      const date = direction === 'top' ? tentativeCi : tentativeCo;
      return { reserva, direction, tentativeCi, tentativeCo, hoveredDate: date, isPendingConfirm: false };
    });
  }

  function getResizePreview(state: typeof resizingState): { newCi: string; newCo: string } {
    if (!state) return { newCi: '', newCo: '' };
    const ciStr = state.tentativeCi;
    const coStr = state.tentativeCo;
    const hovered = state.hoveredDate;

    if (state.direction === null) {
      return { newCi: ciStr, newCo: coStr };
    }

    if (state.direction === 'bottom') {
      const lastNightDate = new Date(hovered + 'T12:00:00Z');
      lastNightDate.setUTCDate(lastNightDate.getUTCDate() + 1);
      const nextDayStr = lastNightDate.toISOString().split('T')[0];

      const minCoDate = new Date(ciStr + 'T12:00:00Z');
      minCoDate.setUTCDate(minCoDate.getUTCDate() + 1);
      const minCoStr = minCoDate.toISOString().split('T')[0];

      const newCo = nextDayStr > minCoStr ? nextDayStr : minCoStr;
      return { newCi: ciStr, newCo };
    } else {
      const maxCiDate = new Date(coStr + 'T12:00:00Z');
      maxCiDate.setUTCDate(maxCiDate.getUTCDate() - 1);
      const maxCiStr = maxCiDate.toISOString().split('T')[0];

      const newCi = hovered < maxCiStr ? hovered : maxCiStr;
      return { newCi, newCo: coStr };
    }
  }

  // Checks if a given date for a room is free (excluding current reserva)
  function isDateFreeForRoom(habId: string, dateStr: string, excludeId: string): boolean {
    const today = toDateKey(new Date());
    if (dateStr < today) return false;
    return !reservas.some(r =>
      r.id_reserva_hotel !== excludeId &&
      r.id_habitacion === habId &&
      getOnlyDate(r.check_in) <= dateStr &&
      getOnlyDate(r.check_out) > dateStr
    );
  }

  async function applyResize() {
    if (!resizingState) return;
    const newCi = resizingState.tentativeCi;
    const newCo = resizingState.tentativeCo;
    if (newCi === getOnlyDate(resizingState.reserva.check_in) &&
      newCo === getOnlyDate(resizingState.reserva.check_out)) {
      setResizingState(null);
      return;
    }
    if (newCi >= newCo) { setResizingState(null); return; }
    try {
      await updateReserva(resizingState.reserva.id_reserva_hotel, {
        check_in: newCi + 'T14:00:00',
        check_out: newCo + 'T12:00:00',
      } as any);
      showToast('Fechas actualizadas.');
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al actualizar fechas.', 'err');
    } finally {
      setResizingState(null);
    }
  }


  function handleMatrixMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const el = matrixRef.current;
    if (!el) return;
    dragState.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    setIsDragging(true);
    e.preventDefault();
  }

  function handleMatrixMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragState.current || !matrixRef.current) return;
    matrixRef.current.scrollLeft = dragState.current.sl - (e.clientX - dragState.current.x);
    matrixRef.current.scrollTop = dragState.current.st - (e.clientY - dragState.current.y);
  }

  function handleMatrixMouseUp() {
    dragState.current = null;
    setIsDragging(false);
  }

  function goNext() {
    if (wizardStep === 'datos') setWizardStep('tarifas');
    else if (wizardStep === 'tarifas') setWizardStep('resumen');
  }

  function goBack() {
    if (wizardStep === 'resumen') setWizardStep('tarifas');
    else if (wizardStep === 'tarifas') setWizardStep('datos');
  }

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    try {
      let huespedId = form.huespedId;
      let finalCheckIn = form.checkIn;
      let finalCheckOut = form.checkOut;
      if (form.tipoReserva === 'hora') {
        finalCheckIn = `${form.fechaHoraDate}T${form.horaCheckIn}:00`;
        finalCheckOut = `${form.fechaHoraDate}T${form.horaCheckOut}:00`;
      }

      if (form.registrarNuevo) {
        if (!form.nuevoNombre.trim()) {
          showToast('Ingresa el nombre del huésped.', 'err');
          setSaving(false);
          return;
        }
        const nuevo = await createHuesped({
          nombre_completo: form.nuevoNombre.trim(),
          correo: form.nuevoCorreo.trim() || undefined,
          telefono: form.nuevoTelefono.trim() || undefined,
          ciudad: form.nuevaCiudad.trim() || undefined,
          direccion: form.nuevaDireccion.trim() || undefined,
        });
        huespedId = nuevo.id_huesped;
      }

      if (!huespedId) { showToast('Selecciona o registra un huésped.', 'err'); setSaving(false); return; }
      if (!form.habitacionId) { showToast('Selecciona una habitación.', 'err'); setSaving(false); return; }
      if (form.esCredito && !form.empresaId) { showToast('Selecciona una empresa para el crédito.', 'err'); setSaving(false); return; }

      if (!editingReserva) {
        const todayStr = toDateKey(new Date());
        if (getOnlyDate(finalCheckIn) < todayStr) {
          showToast('No puedes crear reservas en el pasado.', 'err');
          setSaving(false);
          return;
        }
      }

      if (form.estado === 'check_in' && (!editingReserva || editingReserva.estado !== 'check_in')) {
        const todayStr = toDateKey(new Date());
        if (getOnlyDate(finalCheckIn) !== todayStr) {
          showToast(`El check-in solo se puede registrar si la fecha de entrada es el día de hoy (${todayStr}).`, 'err');
          setSaving(false);
          return;
        }
      }

      // Calcular estado_pago real según pagos existentes (para edición)
      const calcEstadoPago = (pagosExistentes: { monto: number; estado?: string }[], total: number) => {
        if (form.esCredito) return 'credito';
        if (form.esCortesia) return 'cortesia';
        const totalPagado = pagosExistentes.filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
        if (total > 0 && totalPagado + 0.009 >= total) return 'pagado';
        if (totalPagado > 0) return 'abonada';
        return 'reservada'; // Sin pago aún
      };

      if (editingReserva) {
        const { updateReserva } = await import('../../api/bookingsService');
        await updateReserva(editingReserva.id_reserva_hotel, {
          id_huesped: huespedId,
          id_habitacion: form.habitacionId,
          check_in: finalCheckIn,
          check_out: finalCheckOut,
          adultos: form.adultos,
          ninos: form.ninos,
          estado: form.estado,
          total_reserva: totalEstimado,
          observaciones: form.observaciones,
          estado_pago: calcEstadoPago(editingReserva.pagos ?? [], totalEstimado),
          es_cortesia: form.esCortesia,
          id_empresa: form.empresaId || null,
          cama_extra: form.camaExtra,
          limpieza_diaria: form.limpiezaDiaria,
          neverita: form.neverita,
          plancha: form.plancha,
          tipo_reserva: form.tipoReserva,
        } as any);
        showToast('Reserva actualizada.');
      } else {
        await createReserva({
          id_huesped: huespedId,
          id_habitacion: form.habitacionId,
          check_in: finalCheckIn,
          check_out: finalCheckOut,
          adultos: form.adultos,
          ninos: form.ninos,
          estado: form.estado,
          total_reserva: totalEstimado,
          moneda: 'HNL',
          observaciones: form.observaciones,
          estado_pago: form.esCredito ? 'credito' : form.esCortesia ? 'cortesia' : 'reservada',
          anticipo: 0,
          es_cortesia: form.esCortesia,
          id_empresa: form.empresaId || undefined,
          cama_extra: form.camaExtra,
          limpieza_diaria: form.limpiezaDiaria,
          neverita: form.neverita,
          plancha: form.plancha,
          tipo_reserva: form.tipoReserva,
        });
        showToast('Reserva creada exitosamente.');
      }

      closeEditor();
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar la reserva.', 'err');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelClick(id: string) {
    const reserva = reservas.find(r => r.id_reserva_hotel === id);
    if (!reserva) return;
    const totalPagado = (reserva.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
    setCancelModalData({ reserva, totalPagado });
    setCancelModalOpen(true);
  }

  async function handleConfirmCancel(anularPagos: boolean) {
    if (!cancelModalData) return;
    setCancelling(cancelModalData.reserva.id_reserva_hotel);
    try {
      await cancelReserva(cancelModalData.reserva.id_reserva_hotel, anularPagos);
      showToast('Reserva cancelada.' + (anularPagos && cancelModalData.totalPagado > 0 ? ` Pagos anulados: HNL ${cancelModalData.totalPagado.toFixed(2)}` : ''));
      setCancelModalOpen(false);
      setCancelModalData(null);
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al cancelar.', 'err');
    } finally {
      setCancelling(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading && habitaciones.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando reservaciones…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#fff' }}>
      {/* ── Subtle Background Update Indicator ── */}
      {loading && (
        <>
          <style>{`
            @keyframes loading-bar {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, height: 3,
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #3b82f6)', zIndex: 99999,
              backgroundSize: '200% 100%',
              animation: 'loading-bar 1.5s infinite linear',
            }}
          />
        </>
      )}
      {/* ── Toast ── */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            background: toast.type === 'ok' ? '#22c55e' : '#ef4444',
            color: '#fff', borderRadius: 8, padding: '10px 18px',
            fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px #0003',
            transition: 'opacity 0.2s',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Top bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 20px', borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} style={{ color: '#94a3b8' }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>Reservaciones</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={14} />
          </button>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center', minWidth: 160, justifyContent: 'center' }}>
            <select
              value={viewMonth.getMonth()}
              onChange={e => setViewMonth(new Date(viewMonth.getFullYear(), Number(e.target.value), 1))}
              style={{
                fontSize: 13, fontWeight: 700, color: '#1e293b',
                border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px',
                background: '#fff', cursor: 'pointer', outline: 'none',
                textTransform: 'capitalize'
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const dummy = new Date(2000, i, 1);
                const monthName = dummy.toLocaleDateString('es-HN', { month: 'long' });
                return <option key={i} value={i}>{monthName}</option>;
              })}
            </select>
            <select
              value={viewMonth.getFullYear()}
              onChange={e => setViewMonth(new Date(Number(e.target.value), viewMonth.getMonth(), 1))}
              style={{
                fontSize: 13, fontWeight: 700, color: '#1e293b',
                border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px',
                background: '#fff', cursor: 'pointer', outline: 'none'
              }}
            >
              {Array.from({ length: 15 }).map((_, i) => {
                const y = new Date().getFullYear() + i - 1; // From last year to 13 years in the future
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>

          <button onClick={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center' }}>
            <ChevronRight size={14} />
          </button>
          <button onClick={() => { const d = new Date(); setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: 4 }}>Hoy</button>
        </div>
        <div style={{ display: 'flex', gap: 20, marginLeft: 8 }}>
          {[{ v: `${matrixStats.pct}%`, l: 'OCUPACIÓN' }, { v: String(matrixStats.ocupadasHoy), l: 'OCUPADAS HOY' }].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 300, color: '#1e293b', lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', letterSpacing: 0.7, textTransform: 'uppercase' }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => setModoBloqueo(!modoBloqueo)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: modoBloqueo ? '#ef4444' : '#f1f5f9',
              color: modoBloqueo ? '#fff' : '#475569',
              border: modoBloqueo ? 'none' : '1px solid #cbd5e1',
              cursor: 'pointer',
            }}
            title={modoBloqueo ? 'Desactivar Modo Bloqueo (Habitaciones)' : 'Activar Modo Bloqueo (Habitaciones)'}
          >
            <span>{modoBloqueo ? '🔒 Modo Bloqueo: Activo' : '🔓 Modo Bloqueo: Inactivo'}</span>
          </button>
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
            value={hotelFiltro}
            onChange={e => setHotelFiltro(e.target.value)}
            disabled={localStorage.getItem('active_hotel_id') !== 'all'}
          >
            <option value="todos">Todos los hoteles</option>
            {hoteles.map(h => <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>)}
          </select>
          <button
            onClick={() => setImportadorOpen(true)}
            title="Importar reservas desde Excel"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}
          >
            <FileSpreadsheet size={14} /> Importar Excel
          </button>
          <button onClick={() => openNewReserva()} className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            <Plus size={14} /> Nueva reserva
          </button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, padding: '6px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, alignItems: 'center' }}>
        {(['reservada', 'confirmada', 'check_in', 'pagada', 'abonada', 'cortesia', 'completada', 'cancelada'] as DisplayStatus[]).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: getStatusColor(s) + '55', border: `1.5px solid ${getStatusColor(s)}` }} />
            {getStatusLabel(s)}
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#cbd5e1' }}>⬆⬇⬅➡ arrastrar · clic derecho → reserva</span>
      </div>

      {/* ── Matrix ── */}
      <div
        ref={matrixRef}
        onMouseDown={handleMatrixMouseDown}
        onMouseMove={handleMatrixMouseMove}
        onMouseUp={handleMatrixMouseUp}
        onMouseLeave={handleMatrixMouseUp}
        onContextMenu={e => e.preventDefault()}
        style={{ flex: 1, overflow: 'auto', cursor: isDragging ? 'grabbing' : 'grab', userSelect: 'none', minHeight: 0 }}
      >
        {habitacionesFiltradas.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 13 }}>
            No hay habitaciones disponibles para el hotel seleccionado.
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: 100 + habitacionesFiltradas.length * 150 }}>
            <colgroup>
              <col style={{ width: 80, minWidth: 70 }} />
              {habitacionesFiltradas.map(h => <col key={h.id_habitacion} style={{ width: 150, minWidth: 120 }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '8px 10px', fontSize: 10, fontWeight: 600, color: '#94a3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>Día</th>
                {habitacionesFiltradas.map(hab => (
                  <th key={hab.id_habitacion} style={{ position: 'sticky', top: 0, zIndex: 2, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#1e293b', textAlign: 'center', verticalAlign: 'middle' }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {hab.nombre_habitacion}
                    </div>
                    {hab.nombre_alias && (
                      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400, fontStyle: 'italic' }}>{hab.nombre_alias}</div>
                    )}
                    {hab.hotel && <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>{hab.hotel}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthDays.map(day => {
                const dayKey = toDateKey(day);
                const isToday = dayKey === toDateKey(new Date());
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dateBg = isToday ? '#eff6ff' : isWeekend ? '#f8fafc' : '#fff';
                return (
                  <tr
                    key={dayKey}
                    onMouseEnter={() => {
                      if (resizingState && !resizingState.isPendingConfirm && resizingState.reserva.id_habitacion) {
                        setResizingState(s => s ? { ...s, hoveredDate: dayKey } : null);
                      }
                    }}
                  >
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: dateBg, border: '1px solid #e2e8f0', padding: '4px 6px', textAlign: 'center', height: 48, verticalAlign: 'middle' }}>
                      <div style={{ fontSize: 15, fontWeight: isToday ? 700 : 500, color: isToday ? '#2563eb' : isWeekend ? '#6b7280' : '#374151', lineHeight: 1 }}>{day.getDate()}</div>
                      <div style={{ fontSize: 9, color: isToday ? '#93c5fd' : '#94a3b8', textTransform: 'uppercase' }}>{day.toLocaleDateString('es-HN', { weekday: 'short' }).slice(0, 3)}</div>
                    </td>
                    {habitacionesFiltradas.map((hab, habIdx) => {
                      const cell = colGrid[habIdx]?.get(dayKey);
                      if (!cell || cell.type === 'skip') return null;
                      if (cell.type === 'start') {
                        const activeIndex = carouselTick % cell.reservas.length;
                        const r = cell.reservas[activeIndex];
                        const nightInfo = getNightStatusInfo(r, dayKey);
                        const status = nightInfo?.status ?? 'reservada';
                        const color = getStatusColor(status);

                        const isFirstNight = dayKey === getOnlyDate(r.check_in);
                        const prevDay = addDays(new Date(dayKey + 'T12:00:00'), -1);
                        const prevDayKey = toDateKey(prevDay);
                        const prevNightInfo = getNightStatusInfo(r, prevDayKey);
                        const showLabel = !prevNightInfo || prevNightInfo.status !== status;
                        const isLastNight = r.tipo_reserva === 'hora' || dayKey === toDateKey(addDays(new Date(r.check_out), -1));

                        const isWeb = r.origen_reserva === 'web' || r.observaciones?.includes('[WEB]');
                        const isIa = r.origen_reserva === 'ia' || r.observaciones?.includes('[IA]');
                        const formatTime = (isoString: string) => {
                          try {
                            // Parse hours/minutes directly from the stored string to avoid timezone shifts
                            const tMatch = isoString.match(/T(\d{2}):(\d{2})/);
                            if (tMatch) {
                              let h = parseInt(tMatch[1], 10);
                              const m = tMatch[2];
                              const ampm = h >= 12 ? 'p.\u202fm.' : 'a.\u202fm.';
                              h = h % 12;
                              h = h === 0 ? 12 : h;
                              return `${h}:${m} ${ampm}`;
                            }
                            return '';
                          } catch {
                            return '';
                          }
                        };

                        return (
                          <td
                            key={hab.id_habitacion}
                            rowSpan={cell.rowSpan}
                            className={`reserva-cell ${resizingState?.reserva.id_reserva_hotel === r.id_reserva_hotel ? 'is-resizing' : ''}`}
                            onContextMenu={e => openCtxMenu(e, r)}
                            onMouseEnter={() => { if (movingReserva && r.tipo_reserva !== 'hora') setMoveTarget({ habId: hab.id_habitacion, dayKey }); }}
                            onMouseMove={e => {
                              if (resizingState && !resizingState.isPendingConfirm && r.tipo_reserva !== 'hora') {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const offsetY = e.clientY - rect.top;
                                const rowIndex = Math.floor(offsetY / 48);
                                const baseDate = new Date(dayKey + 'T12:00:00Z');
                                baseDate.setUTCDate(baseDate.getUTCDate() + rowIndex);
                                const newDate = baseDate.toISOString().split('T')[0];
                                if (resizingState.hoveredDate !== newDate) {
                                  setResizingState(s => s ? { ...s, hoveredDate: newDate } : null);
                                }
                              }
                            }}
                            title={`${r.huesped} · ${getStatusLabel(status)} · ${r.tipo_reserva === 'hora' ? 'Horas' : 'Noche'} del ${dayKey} — clic derecho`}
                            style={{
                              position: 'relative',
                              background: (movingReserva && moveTarget?.habId === hab.id_habitacion) ? '#dbeafe' : color + '20',
                              borderLeft: r.tipo_reserva === 'hora' ? '3px solid #a855f7' : (movingReserva && moveTarget?.habId === hab.id_habitacion) ? '2px solid #2563eb' : 'none',
                              borderRight: (movingReserva && moveTarget?.habId === hab.id_habitacion) ? '2px solid #2563eb' : 'none',
                              borderBottom: (movingReserva && moveTarget?.habId === hab.id_habitacion) ? '2px solid #2563eb' : 'none',
                              borderTop: isFirstNight ? `3px solid ${color}` : (movingReserva && moveTarget?.habId === hab.id_habitacion) ? '2px solid #2563eb' : 'none',
                              padding: '5px 8px',
                              cursor: (resizingState && !resizingState.isPendingConfirm && r.tipo_reserva !== 'hora') ? 'ns-resize' : movingReserva ? 'crosshair' : 'context-menu',
                              verticalAlign: 'top',
                              overflow: 'hidden',
                              maxWidth: 0,
                              userSelect: 'none',
                              transition: 'background 0.15s, border 0.15s',
                            }}
                          >
                            {/* Handle superior — arrastra para cambiar check-in */}
                            {resizingState?.reserva.id_reserva_hotel === r.id_reserva_hotel && r.tipo_reserva !== 'hora' && isFirstNight && (
                              <div
                                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startResize(r, 'top'); }}
                                className="resize-handle"
                                style={{
                                  position: 'absolute', top: 0, left: 0, right: 0, height: 10,
                                  cursor: 'n-resize', zIndex: 5,
                                  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                                }}
                              >
                                <div style={{ width: 24, height: 4, background: color, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
                              </div>
                            )}

                            {/* Resize preview mask */}
                            {resizingState?.reserva.id_reserva_hotel === r.id_reserva_hotel && r.tipo_reserva !== 'hora' && (() => {
                              const { newCi, newCo } = getResizePreview(resizingState);
                              const origCi = getOnlyDate(r.check_in);
                              const origCo = getOnlyDate(r.check_out);
                              const totalNights = nightsBetween(origCi, origCo) || 1;
                              const masks = [];

                              if (newCo < origCo && isLastNight) {
                                const keptDays = nightsBetween(origCi, newCo);
                                const removePct = Math.max(0, 100 - (keptDays / totalNights) * 100);
                                masks.push(
                                  <div key="bottom-mask" style={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    height: `${removePct}%`,
                                    background: 'repeating-linear-gradient(45deg,#94a3b8 0,#94a3b8 3px,transparent 3px,transparent 8px)',
                                    opacity: 0.55, pointerEvents: 'none',
                                    borderTop: '2px dashed #64748b',
                                  }} />
                                );
                              }
                              if (newCi > origCi && isFirstNight) {
                                const removedDays = nightsBetween(origCi, newCi);
                                const removePct = (removedDays / totalNights) * 100;
                                masks.push(
                                  <div key="top-mask" style={{
                                    position: 'absolute', top: 0, left: 0, right: 0,
                                    height: `${removePct}%`,
                                    background: 'repeating-linear-gradient(45deg,#94a3b8 0,#94a3b8 3px,transparent 3px,transparent 8px)',
                                    opacity: 0.55, pointerEvents: 'none',
                                    borderBottom: '2px dashed #64748b',
                                  }} />
                                );
                              }
                              return masks;
                            })()}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                              {showLabel && (
                                <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {getStatusLabel(status)}
                                </div>
                              )}
                              {r.tipo_reserva === 'hora' && (
                                <span style={{ fontSize: '8px', padding: '1px 4px', background: '#a855f7', color: '#fff', borderRadius: 3, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.2 }}>HORAS</span>
                              )}
                              {nightInfo?.isCheckIn && r.tipo_reserva !== 'hora' && (
                                <span title="Check-in realizado" style={{ fontSize: '8px', padding: '1px 3px', background: '#0d9488', color: '#fff', borderRadius: 3, fontWeight: 800, whiteSpace: 'nowrap' }}>🔑 IN</span>
                              )}
                              {nightInfo?.isCheckOut && r.tipo_reserva !== 'hora' && (
                                <span title="Check-out realizado" style={{ fontSize: '8px', padding: '1px 3px', background: '#14b8a6', color: '#fff', borderRadius: 3, fontWeight: 800, whiteSpace: 'nowrap' }}>🚪 OUT</span>
                              )}
                              {cell.reservas.length > 1 && (
                                <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center', marginLeft: 4 }}>
                                  {cell.reservas.map((_, idx) => (
                                    <span
                                      key={idx}
                                      style={{
                                        width: 5,
                                        height: 5,
                                        borderRadius: '50%',
                                        background: idx === activeIndex ? color : '#cbd5e1',
                                        transition: 'background 0.2s',
                                      }}
                                    />
                                  ))}
                                </span>
                              )}
                            </div>

                            {isFirstNight && (
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px', marginTop: 2 }}>
                                {isIa && <span title="Creada por Asistente IA" style={{ fontSize: '11px', cursor: 'help' }}>🤖</span>}
                                {isWeb && <span title="Solicitud Web B2C" style={{ fontSize: '11px', cursor: 'help' }}>🌐</span>}
                                <span>{r.huesped}</span>
                              </div>
                            )}

                            {r.tipo_reserva === 'hora' && (
                              <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, whiteSpace: 'nowrap' }}>
                                🕐 {formatTime(r.check_in)} - {formatTime(r.check_out)}
                              </div>
                            )}

                            {/* Handle inferior — arrastra para cambiar check-out */}
                            {resizingState?.reserva.id_reserva_hotel === r.id_reserva_hotel && r.tipo_reserva !== 'hora' && isLastNight && (
                              <div
                                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); startResize(r, 'bottom'); }}
                                className="resize-handle"
                                style={{
                                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 10,
                                  cursor: 's-resize', zIndex: 5,
                                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                                }}
                              >
                                <div style={{ width: 24, height: 4, background: color, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                              </div>
                            )}
                          </td>
                        );
                      }
                      // Celda vacía
                      const moveCI = getOnlyDate(movingReserva?.check_in) ?? '';
                      const moveCO = getOnlyDate(movingReserva?.check_out) ?? '';
                      const inMoveRange = movingReserva && dayKey >= moveCI && dayKey < moveCO;
                      const isMoveAvailable = inMoveRange && availableMoveRooms.has(hab.id_habitacion);
                      const isMoveSelected = isMoveAvailable && moveTarget?.habId === hab.id_habitacion;

                      const isBlocked = bloqueos.some(b =>
                        b.id_habitacion === hab.id_habitacion &&
                        dayKey >= getOnlyDate(b.fecha_inicio) &&
                        dayKey <= getOnlyDate(b.fecha_fin)
                      );

                      if (isBlocked && !movingReserva && !resizingState) {
                        return (
                          <td
                            key={hab.id_habitacion}
                            onClick={() => void handleToggleBlock(hab.id_habitacion, dayKey)}
                            title="Habitación NO DISPONIBLE (Bloqueada) - Clic para Habilitar"
                            style={{
                              background: 'repeating-linear-gradient(45deg, #fee2e2 0, #fee2e2 6px, #fecaca 6px, #fecaca 12px)',
                              border: '1px solid #ef4444',
                              cursor: 'pointer',
                              textAlign: 'center',
                              height: 48,
                              verticalAlign: 'middle',
                              transition: 'all 0.2s',
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>🔒</span>
                          </td>
                        );
                      }

                      // Extension preview for resize
                      const resizeHab = resizingState?.reserva.id_habitacion;
                      let isResizeExtension = false;
                      let resizeExtColor = '#3b82f6';
                      if (resizingState && resizeHab === hab.id_habitacion) {
                        const { newCi, newCo } = getResizePreview(resizingState);
                        const origCi = getOnlyDate(resizingState.reserva.check_in);
                        const origCo = getOnlyDate(resizingState.reserva.check_out);
                        if (dayKey >= newCi && dayKey < origCi) {
                          isResizeExtension = isDateFreeForRoom(hab.id_habitacion, dayKey, resizingState.reserva.id_reserva_hotel);
                          resizeExtColor = getStatusColor(getEffectiveStatus(resizingState.reserva));
                        } else if (dayKey >= origCo && dayKey < newCo) {
                          isResizeExtension = isDateFreeForRoom(hab.id_habitacion, dayKey, resizingState.reserva.id_reserva_hotel);
                          resizeExtColor = getStatusColor(getEffectiveStatus(resizingState.reserva));
                        }
                      }

                      const defaultBg = modoBloqueo ? '#fee2e244' : dateBg;
                      const defaultBorder = modoBloqueo ? '1px dashed #fca5a5' : '1px solid #e2e8f0';
                      const defaultCursor = modoBloqueo ? 'pointer' : 'context-menu';

                      return (
                        <td
                          key={hab.id_habitacion}
                          onContextMenu={e => { e.stopPropagation(); e.preventDefault(); if (!movingReserva && !resizingState) openNewReserva(hab.id_habitacion, dayKey + 'T14:00'); }}
                          onMouseEnter={() => { if (movingReserva) setMoveTarget({ habId: hab.id_habitacion, dayKey }); }}
                          onClick={() => {
                            if (movingReserva && isMoveAvailable) {
                              void confirmMove();
                            } else if (modoBloqueo && !movingReserva && !resizingState) {
                              void handleToggleBlock(hab.id_habitacion, dayKey);
                            }
                          }}
                          style={{
                            background: isResizeExtension ? resizeExtColor + '22' : isMoveSelected ? '#dbeafe' : isMoveAvailable ? '#f0fdf4' : defaultBg,
                            border: isResizeExtension ? `2px dashed ${resizeExtColor}` : isMoveSelected ? '2px solid #2563eb' : isMoveAvailable ? '1px solid #86efac' : defaultBorder,
                            cursor: movingReserva ? (isMoveAvailable ? 'copy' : 'not-allowed') : resizingState ? 'ns-resize' : defaultCursor,
                            textAlign: 'center',
                            height: 48,
                            transition: 'background 0.1s, border 0.1s',
                          }}
                        >
                          {isMoveAvailable && !isMoveSelected && <span style={{ color: '#86efac', fontSize: 12 }}>✓</span>}
                          {isMoveSelected && <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 700 }}>→</span>}
                          {isResizeExtension && <span style={{ color: resizeExtColor, fontSize: 10, opacity: 0.7 }}>+</span>}
                          {!isMoveAvailable && !isResizeExtension && !modoBloqueo && <span style={{ color: '#e2e8f0', fontSize: 10 }}>·</span>}
                          {!isMoveAvailable && !isResizeExtension && modoBloqueo && <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700 }}>🔓</span>}
                        </td>
                      );

                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Context Menu ── */}
      {ctxMenu && (() => {
        const todayStr = toDateKey(new Date());
        const isPast = ctxMenu.reserva.estado === 'check_in' ||
          ctxMenu.reserva.estado === 'check_out' ||
          ctxMenu.reserva.estado === 'cancelada' ||
          getOnlyDate(ctxMenu.reserva.check_in) < todayStr ||
          getOnlyDate(ctxMenu.reserva.check_out) < todayStr;
        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 2000 }}
            onClick={closeCtxMenu}
            onContextMenu={e => { e.preventDefault(); closeCtxMenu(); }}
          >
            <div
              style={{
                position: 'fixed',
                top: Math.min(ctxMenu.y, window.innerHeight - 230),
                left: Math.min(ctxMenu.x, window.innerWidth - 200),
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                boxShadow: '0 8px 32px #0002, 0 2px 8px #0001',
                padding: '6px 0',
                minWidth: 190,
                zIndex: 2001,
                overflow: 'hidden',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ctxMenu.reserva.huesped ?? 'Reserva'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                  {ctxMenu.reserva.habitacion} · {getOnlyDate(ctxMenu.reserva.check_in)}
                </div>
              </div>
              {/* Options */}
              {[
                ctxMenu.reserva.tipo_reserva === 'hora' && { icon: '➕', label: 'Añadir reserva extra', action: () => { closeCtxMenu(); openNewReserva(ctxMenu!.reserva.id_habitacion, undefined, ctxMenu!.reserva); } },
                ctxMenu.reserva.estado !== 'check_in' && ctxMenu.reserva.estado !== 'check_out' && ctxMenu.reserva.estado !== 'cancelada' &&
                { icon: '🔑', label: 'Marcar como Check-in', action: () => { closeCtxMenu(); void updateEstado(ctxMenu!.reserva.id_reserva_hotel, 'check_in'); } },
                ctxMenu.reserva.estado === 'check_in' &&
                { icon: '✅', label: 'Marcar como Check-out', action: () => { closeCtxMenu(); void updateEstado(ctxMenu!.reserva.id_reserva_hotel, 'check_out'); } },
                { icon: '✏️', label: 'Editar', action: () => { closeCtxMenu(); openEditReserva(ctxMenu!.reserva); } },
                !isPast && { icon: '↕️', label: 'Ampliar / Reducir noches', action: () => { closeCtxMenu(); startResize(ctxMenu!.reserva, 'bottom'); } },
                !isPast && { icon: '🚚', label: 'Mover a otra habitación', action: () => startMoving(ctxMenu!.reserva) },
                nightsBetween(ctxMenu.reserva.check_in, ctxMenu.reserva.check_out) > 1 &&
                ctxMenu.reserva.estado !== 'cancelada' &&
                ctxMenu.reserva.estado !== 'check_out' && {
                  icon: '✂️',
                  label: 'Dividir estancia (Split)',
                  action: () => { closeCtxMenu(); handleOpenSplitStay(ctxMenu!.reserva); }
                },
                { icon: '🔍', label: 'Ver detalles', action: () => { closeCtxMenu(); setDetailReserva(ctxMenu!.reserva); } },
                null,
                !isPast && { icon: '❌', label: 'Cancelar reserva', danger: true, action: () => { closeCtxMenu(); handleCancelClick(ctxMenu!.reserva.id_reserva_hotel); } },
              ].filter((item): item is { icon: string; label: string; danger?: boolean; action: () => void } | null => item !== false).map((item, i) =>
                item === null ? (
                  <div key={i} style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                ) : (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 16px', border: 'none', background: 'none',
                      cursor: 'pointer', fontSize: 13, color: item.danger ? '#ef4444' : '#334155',
                      textAlign: 'left', transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = item.danger ? '#fef2f2' : '#f8fafc'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                  >
                    <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
                    {item.label}
                  </button>
                )
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Move Mode Banner ── */}
      {movingReserva && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1500,
          background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
          color: '#fff', padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: 14, fontSize: 13,
          boxShadow: '0 4px 20px #2563eb44',
        }}>
          <span style={{ fontSize: 18 }}>🚚</span>
          <span>Moviendo <strong>{movingReserva.huesped}</strong> ({movingReserva.habitacion}) — <em>Pasa el mouse sobre la habitación destino y haz clic</em></span>
          {moveTarget && (
            <span style={{ background: '#ffffff22', borderRadius: 6, padding: '2px 10px', fontWeight: 600 }}>
              → {habitaciones.find(h => h.id_habitacion === moveTarget.habId)?.nombre_habitacion ?? moveTarget.habId}
            </span>
          )}
          <button
            onClick={() => { setMovingReserva(null); setMoveTarget(null); }}
            style={{ marginLeft: 'auto', background: '#ffffff22', border: '1px solid #ffffff44', borderRadius: 8, color: '#fff', padding: '4px 14px', cursor: 'pointer', fontSize: 12 }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* ── Resize tooltip (estilo Excel — aparece mientras arrastras o al confirmar) ── */}
      {resizingState && (() => {
        const { newCi, newCo } = getResizePreview(resizingState);
        const noches = nightsBetween(newCi, newCo);
        const fmt = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });

        if (resizingState.isPendingConfirm) {
          return (
            <div style={{
              position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
              background: '#fff', color: '#1e293b', borderRadius: 12, padding: '12px 20px',
              fontSize: 14, fontWeight: 600, zIndex: 3000,
              boxShadow: '0 10px 40px #0004', border: '1px solid #e2e8f0',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <span style={{ fontSize: 18 }}>↕️</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{fmt(newCi)} → {fmt(newCo)}</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{noches} noche{noches !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                <button onClick={() => setResizingState(null)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                <button onClick={() => void applyResize()} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Confirmar</button>
              </div>
            </div>
          );
        }

        return (
          <div style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: '#1e293b', color: '#fff', borderRadius: 10, padding: '8px 18px',
            fontSize: 13, fontWeight: 600, zIndex: 3000,
            boxShadow: '0 4px 20px #0005',
            display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none',
          }}>
            <span style={{ fontSize: 16 }}>{resizingState.direction === 'top' ? '⬆' : '⬇'}</span>
            <span>{fmt(newCi)} → {fmt(newCo)}</span>
            <span style={{ background: '#334155', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>{noches} noche{noches !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Suelta para continuar · ESC para cancelar</span>
          </div>
        );
      })()}



      {/* ── Amenity Warning on Move ── */}
      {moveConfirmPending && (
        <div style={{ position: 'fixed', inset: 0, background: '#0005', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => { setMoveConfirmPending(null); setMovingReserva(null); setMoveTarget(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px', width: 380, boxShadow: '0 20px 60px #0004' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>{moveConfirmPending.missingAmenities.length > 0 || moveConfirmPending.typeMismatch ? '⚠️' : '✅'}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
              {moveConfirmPending.missingAmenities.length > 0 || moveConfirmPending.typeMismatch ? 'Conflicto al Mover' : 'Confirmar traslado'}
            </div>
            {moveConfirmPending.missingAmenities.length > 0 || moveConfirmPending.typeMismatch ? (
              <>
                {moveConfirmPending.typeMismatch && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
                    <p style={{ fontSize: 13, color: '#991b1b', margin: 0, fontWeight: 500 }}>
                      <strong>Diferente tipo de habitación:</strong> La reserva original es para <em>{moveConfirmPending.originalType}</em>, pero la estás moviendo a <em>{moveConfirmPending.targetType}</em>.
                    </p>
                  </div>
                )}
                {moveConfirmPending.missingAmenities.length > 0 && (
                  <>
                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
                      La habitación <strong>{moveConfirmPending.targetHab.nombre_habitacion}</strong> no incluye las siguientes comodidades solicitadas:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                      {moveConfirmPending.missingAmenities.map(a => (
                        <span key={a} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, color: '#c2410c' }}>{a}</span>
                      ))}
                    </div>
                  </>
                )}
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>¿Deseas mantener los cambios y mover la reserva de todas formas?</p>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
                ¿Estás seguro que deseas mover la reserva de <strong>{moveConfirmPending.reserva.huesped}</strong> a la habitación <strong>{moveConfirmPending.targetHab.nombre_habitacion}</strong>?
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setMoveConfirmPending(null); setMovingReserva(null); setMoveTarget(null); }}
                style={{ flex: 1, padding: '9px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#64748b' }}
              >Cancelar</button>
              <button
                onClick={() => void doMove(moveConfirmPending!.reserva, moveConfirmPending!.targetHab.id_habitacion)}
                style={{ flex: 2, padding: '9px', background: '#f97316', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#fff' }}
              >Mover de todas formas</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailReserva && (() => {
        const r = detailReserva;
        const status = getEffectiveStatus(r);
        const color = getStatusColor(status);
        const noches = r.noches ?? nightsBetween(r.check_in, r.check_out);
        const isCanceled = status === 'cancelada';
        const isCortesia = status === 'cortesia' || !!r.es_cortesia || r.estado_pago === 'cortesia';
        const isCredito = status === 'credito';
        const isCheckIn = status === 'check_in';
        const isCheckOut = status === 'check_out';
        const pagado = (r.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
        const saldo = isCortesia ? 0 : Math.max(0, r.total_reserva - pagado);
        const pctPagado = isCortesia ? 100 : (r.total_reserva > 0 ? Math.min(100, (pagado / r.total_reserva) * 100) : 0);
        const fmt = (d: string) => new Date(d.includes('T') ? d : d + 'T00:00:00').toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
        const empresa = empresas.find(e => e.id_empresa === r.id_empresa);
        const isWeb = r.origen_reserva === 'web' || r.observaciones?.includes('[WEB]');
        const isIa = r.origen_reserva === 'ia' || r.observaciones?.includes('[IA]');
        const isPagada = saldo <= 0;
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setDetailReserva(null)}
          >
            <div
              style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px #0005', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div style={{ background: color + '12', borderBottom: `3px solid ${color}`, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color, background: color + '20', padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: 0.6 }}>{getStatusLabel(status)}</span>

                    {isIa && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', background: '#8b5cf615', border: '1px solid #8b5cf644', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🤖 Asistente IA
                      </span>
                    )}
                    {isWeb && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', background: '#3b82f615', border: '1px solid #3b82f644', padding: '2px 8px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                        🌐 Portal B2C
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: isCanceled ? '#94a3b8' : '#1e293b', textDecoration: isCanceled ? 'line-through' : 'none' }}>{r.huesped ?? '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {r.habitacion}{r.hotel ? ` · ${r.hotel}` : ''}{r.id_reserva_hotel ? <span style={{ color: '#94a3b8', marginLeft: 8, fontFamily: 'monospace', fontSize: 11 }} title={r.id_reserva_hotel}>ID: …{r.id_reserva_hotel.slice(-8)}</span> : ''}
                  </div>
                </div>
                <button onClick={() => setDetailReserva(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, flexShrink: 0 }}>
                  <X size={20} />
                </button>
              </div>

              {/* ── Body scrollable ── */}
              <div style={{ overflowY: 'auto', flex: 1 }}>

                {/* Fechas + noches — común */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#f1f5f9' }}>
                  {[
                    { label: 'Check-in', value: fmt(r.check_in) },
                    { label: 'Check-out', value: fmt(r.check_out) },
                    { label: 'Noches', value: `${noches} noche${noches !== 1 ? 's' : ''}` },
                  ].map(item => (
                    <div key={item.label} style={{ background: '#fff', padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isCanceled ? '#94a3b8' : '#1e293b' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '6px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{r.adultos} adulto{r.adultos !== 1 ? 's' : ''}{r.ninos ? `, ${r.ninos} niño${r.ninos !== 1 ? 's' : ''}` : ''}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {r.cama_extra && (
                      <span style={{ fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>🛏️ Cama extra</span>
                    )}
                    {r.limpieza_diaria && (
                      <span style={{ fontSize: 10, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>🧹 Limpieza</span>
                    )}
                    {r.neverita && (
                      <span style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>🧊 Neverita</span>
                    )}
                    {r.plancha && (
                      <span style={{ fontSize: 10, background: '#fdf2f8', color: '#be185d', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>💨 Plancha</span>
                    )}
                  </div>
                </div>

                {/* CORTESÍA */}
                {isCortesia && (
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 30, marginBottom: 6 }}>🎁</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0d9488', marginBottom: 4 }}>Reserva de Cortesía</div>
                      <div style={{ fontSize: 12, color: '#0f766e' }}>Esta estancia no genera ningún cargo económico.</div>
                    </div>
                    {r.observaciones && (
                      <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                        <strong>Nota:</strong> {r.observaciones}
                      </div>
                    )}
                  </div>
                )}

                {/* CRÉDITO EMPRESA */}
                {isCredito && (
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>🏢 Facturado a empresa</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#1e3a8a', marginBottom: 4 }}>{empresa?.nombre ?? 'Empresa'}</div>
                      {empresa?.rtn && <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 4 }}>RTN: {empresa.rtn}</div>}
                      {empresa?.contacto_nombre && <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Contacto: {empresa.contacto_nombre}</div>}
                      <div style={{ paddingTop: 10, borderTop: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Total a facturar</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>HNL {r.total_reserva.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    {r.observaciones && (
                      <div style={{ marginTop: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                        <strong>Nota:</strong> {r.observaciones}
                      </div>
                    )}
                  </div>
                )}

                {/* CANCELADA */}
                {isCanceled && (
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                      <div style={{ fontSize: 30, marginBottom: 6 }}>❌</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Reserva Cancelada</div>
                      <div style={{ fontSize: 12, color: '#b91c1c' }}>Esta reserva fue cancelada y ya no está activa.</div>
                    </div>
                    <div style={{ marginTop: 12, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Total original</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textDecoration: 'line-through' }}>HNL {r.total_reserva.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* CHECK-IN ACTIVO */}
                {isCheckIn && (
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>🏨 En estancia activa</div>
                      <div style={{ fontSize: 13, color: '#164e63' }}>
                        Check-in el <strong>{fmt(r.check_in)}</strong> · salida el <strong>{fmt(r.check_out)}</strong>
                      </div>
                      {(() => {
                        const daysLeft = Math.max(0, Math.ceil((new Date(r.check_out).getTime() - Date.now()) / 86400000));
                        return daysLeft > 0 ? (
                          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#0891b2' }}>
                            {daysLeft} día{daysLeft !== 1 ? 's' : ''} restante{daysLeft !== 1 ? 's' : ''}
                          </div>
                        ) : null;
                      })()}
                    </div>
                    <div style={{ background: saldo > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${saldo > 0 ? '#fed7aa' : '#bbf7d0'}`, borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Total reserva</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>HNL {r.total_reserva.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Saldo pendiente</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: saldo > 0 ? '#f97316' : '#22c55e' }}>
                          {saldo > 0 ? `HNL ${saldo.toLocaleString('es-HN', { minimumFractionDigits: 2 })}` : '✓ Pagado'}
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pctPagado}%`, height: '100%', background: pctPagado >= 100 ? '#22c55e' : '#3b82f6', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* CHECK-OUT */}
                {isCheckOut && (
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {saldo > 0 ? (
                      <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ fontSize: 30, marginBottom: 4 }}>⚠️</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>Salida con Pendiente</div>
                        <div style={{ fontSize: 12, color: '#b91c1c' }}>Check-out registrado el {fmt(r.check_out)} pero con saldo sin liquidar.</div>
                      </div>
                    ) : (
                      <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ fontSize: 30, marginBottom: 4 }}>✅</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 4 }}>Estancia Completada</div>
                        <div style={{ fontSize: 12, color: '#0f766e' }}>Check-out completado el {fmt(r.check_out)}</div>
                      </div>
                    )}
                    <div style={{ background: saldo > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${saldo > 0 ? '#fed7aa' : '#bbf7d0'}`, borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Total reserva</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>HNL {r.total_reserva.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Total pagado</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>HNL {pagado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>Saldo pendiente</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: saldo > 0 ? '#ef4444' : '#22c55e' }}>
                          {saldo > 0 ? `HNL ${saldo.toLocaleString('es-HN', { minimumFractionDigits: 2 })}` : '✓ Pagado'}
                        </span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pctPagado}%`, height: '100%', background: pctPagado >= 100 ? '#22c55e' : '#f97316', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* RESERVADA / ABONADA / PAGADA / PENDIENTE */}
                {!isCortesia && !isCredito && !isCanceled && !isCheckIn && !isCheckOut && (
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ background: isPagada ? '#f0fdf4' : saldo > 0 ? '#fff7ed' : '#f0fdf4', border: `1px solid ${isPagada ? '#bbf7d0' : saldo > 0 ? '#fed7aa' : '#bbf7d0'}`, borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 2 }}>Total reserva</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>HNL {r.total_reserva.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</div>
                        </div>
                        {isPagada ? (
                          <span style={{ fontSize: 12, fontWeight: 700, background: '#dcfce7', color: '#16a34a', padding: '5px 12px', borderRadius: 20 }}>✓ Pagado</span>
                        ) : (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase' }}>Saldo</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>HNL {saldo.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</div>
                          </div>
                        )}
                      </div>
                      {!isPagada && pagado > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: '#64748b' }}>Pagado</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>HNL {pagado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pctPagado}%`, height: '100%', background: pctPagado >= 100 ? '#22c55e' : pctPagado > 0 ? '#eab308' : '#e2e8f0', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista de pagos */}
                {!isCanceled && !isCortesia && !isCredito && (r.pagos ?? []).length > 0 && (
                  <div style={{ padding: '0 20px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Historial de pagos</div>
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
                      {(r.pagos ?? []).map((p, i) => (
                        <div key={p.id_pago_hotel} style={{ display: 'flex', flexDirection: 'column', padding: '10px 14px', background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: i < (r.pagos ?? []).length - 1 ? '1px solid #f1f5f9' : 'none', opacity: p.estado === 'anulado' ? 0.65 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: '#374151', textTransform: 'capitalize' }}>{p.metodo_pago ?? 'Pago'}</span>
                              {p.fecha_pago && <span style={{ fontSize: 11, color: '#94a3b8' }}>({new Date(p.fecha_pago).toLocaleDateString('es-HN', { day: '2-digit', month: 'short' })})</span>}
                              {p.estado === 'anulado' ? (
                                <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>anulado</span>
                              ) : (
                                p.fecha_pago && r.check_in && getOnlyDate(p.fecha_pago) < getOnlyDate(r.check_in) && (
                                  <span style={{ fontSize: 9, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>Anticipado</span>
                                )
                              )}
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: p.estado === 'anulado' ? '#94a3b8' : '#16a34a' }}>
                              {p.estado === 'anulado' ? '—' : `${p.moneda} ${p.monto.toLocaleString()}`}
                            </span>
                          </div>
                          {p.estado === 'anulado' && p.notas && (
                            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4, background: '#fef2f2', padding: '4px 8px', borderRadius: 4, borderLeft: '3px solid #ef4444', fontStyle: 'italic', wordBreak: 'break-word' }}>
                              {p.notas}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observaciones */}
                {r.observaciones && !isCanceled && !isCortesia && !isCredito && (
                  <div style={{ padding: '0 20px 16px' }}>
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                      <strong>Nota:</strong> {r.observaciones}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer ── */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#fafafa', flexShrink: 0 }}>
                <button onClick={() => setDetailReserva(null)} style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>
                  Cerrar
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!isCanceled && !isCortesia && !isCredito && saldo > 0 && (
                    <button
                      onClick={() => { setDetailReserva(null); navigate(`/pagos?reserva=${r.id_reserva_hotel}`); }}
                      style={{ padding: '7px 14px', fontSize: 13, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                    >Registrar pago</button>
                  )}
                  {!isCanceled && (
                    <button
                      onClick={() => { setDetailReserva(null); openEditReserva(r); }}
                      style={{ padding: '7px 16px', fontSize: 13, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                    >Editar reserva</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Edit Modal (formulario plano para editar reservas existentes) ── */}
      {editorOpen && editingReserva && (() => {
        const todayStr = toDateKey(new Date());
        const isPastReserva = editingReserva.estado === 'check_in' ||
          editingReserva.estado === 'check_out' ||
          editingReserva.estado === 'cancelada' ||
          getOnlyDate(editingReserva.check_in) < todayStr ||
          getOnlyDate(editingReserva.check_out) < todayStr;
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={closeEditor}
          >
            <div
              style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px #0005' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b' }}>Editar reserva</h3>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '3px 0 0' }}>{editingReserva.huesped} · {editingReserva.habitacion}</p>
                </div>
                <button onClick={closeEditor} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                  <X size={20} />
                </button>
              </div>

              {/* Barra de resumen */}
              <div style={{ padding: '10px 22px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 20, fontSize: 12, color: '#64748b', flexShrink: 0, flexWrap: 'wrap' }}>
                <span>Total: <strong style={{ color: form.esCortesia ? '#0d9488' : '#1e293b', fontSize: 13 }}>{form.esCortesia ? 'Cortesía' : `L ${totalEstimado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}</strong></span>
                <span><strong>{form.noches}</strong> noche{form.noches !== 1 ? 's' : ''}</span>
                <span>{form.adultos} adulto{form.adultos !== 1 ? 's' : ''} · {form.ninos} niño{form.ninos !== 1 ? 's' : ''}</span>
                {selectedHabitacion && <span style={{ color: '#3b82f6' }}>{selectedHabitacion.nombre_alias ?? selectedHabitacion.nombre_habitacion}</span>}
              </div>

              {/* Campos */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Huésped */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Huésped</label>
                  <select
                    disabled={isPastReserva}
                    value={form.huespedId}
                    onChange={e => setForm(f => ({ ...f, huespedId: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: isPastReserva ? '#f1f5f9' : '#fff', color: isPastReserva ? '#94a3b8' : '#000', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                  >
                    <option value="">Seleccionar huésped</option>
                    {huespedes.map(h => <option key={h.id_huesped} value={h.id_huesped}>{h.nombre_completo}</option>)}
                  </select>
                </div>

                {/* Habitación */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Habitación</label>
                  <select
                    disabled={isPastReserva}
                    value={form.habitacionId}
                    onChange={e => setForm(f => ({ ...f, habitacionId: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: isPastReserva ? '#f1f5f9' : '#fff', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                  >
                    <option value="">Seleccionar habitación</option>
                    {habitaciones.map(h => (
                      <option key={h.id_habitacion} value={h.id_habitacion}>
                        {h.nombre_alias ? `${h.nombre_alias} (${h.nombre_habitacion})` : h.nombre_habitacion}{h.hotel ? ` · ${h.hotel}` : ''}{h.tarifa_noche ? ` · L ${h.tarifa_noche}/noche` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fechas */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Check-in</label>
                    <input
                      disabled={isPastReserva}
                      type="date"
                      value={getOnlyDate(form.checkIn)}
                      onChange={e => {
                        const d = e.target.value + 'T14:00';
                        setForm(f => ({ ...f, checkIn: d, checkOut: checkOutFromNights(d, f.noches) }));
                      }}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: isPastReserva ? '#f1f5f9' : '#fff', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Check-out</label>
                    <input
                      disabled={isPastReserva}
                      type="date"
                      value={getOnlyDate(form.checkOut)}
                      min={getOnlyDate(form.checkIn)}
                      onChange={e => {
                        const d = e.target.value + 'T12:00';
                        setForm(f => ({ ...f, checkOut: d, noches: nightsBetween(f.checkIn, d) }));
                      }}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: isPastReserva ? '#f1f5f9' : '#fff', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Noches</label>
                    <input
                      disabled={isPastReserva}
                      type="number"
                      min={1}
                      value={form.noches}
                      onChange={e => {
                        const n = Math.max(1, Number(e.target.value));
                        setForm(f => ({ ...f, noches: n, checkOut: checkOutFromNights(f.checkIn, n) }));
                      }}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: isPastReserva ? '#f1f5f9' : '#fff', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                    />
                  </div>
                </div>

                {/* Personas + Estado */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {(['adultos', 'ninos'] as const).map(field => (
                    <div key={field}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                        {field === 'adultos' ? 'Adultos' : 'Niños'}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          disabled={isPastReserva}
                          onClick={() => setForm(f => ({ ...f, [field]: Math.max(field === 'adultos' ? 1 : 0, f[field] - 1) }))}
                          style={{ border: '1px solid #e2e8f0', borderRadius: 6, width: 30, height: 30, cursor: isPastReserva ? 'not-allowed' : 'pointer', background: isPastReserva ? '#f1f5f9' : '#fff', color: isPastReserva ? '#94a3b8' : '#000', fontSize: 16, flexShrink: 0 }}
                        >−</button>
                        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 22, textAlign: 'center', color: isPastReserva ? '#94a3b8' : '#000' }}>{form[field]}</span>
                        <button
                          type="button"
                          disabled={isPastReserva}
                          onClick={() => setForm(f => ({ ...f, [field]: f[field] + 1 }))}
                          style={{ border: '1px solid #e2e8f0', borderRadius: 6, width: 30, height: 30, cursor: isPastReserva ? 'not-allowed' : 'pointer', background: isPastReserva ? '#f1f5f9' : '#fff', color: isPastReserva ? '#94a3b8' : '#000', fontSize: 16, flexShrink: 0 }}
                        >+</button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Estado</label>
                    <select
                      disabled={isPastReserva}
                      value={form.estado}
                      onChange={e => {
                        const nextVal = e.target.value as EstadoReserva;
                        if (nextVal === 'check_out' && editingReserva) {
                          const todayStr = toDateKey(new Date());
                          const checkInStr = getOnlyDate(form.checkIn);
                          const checkOutStr = getOnlyDate(form.checkOut);
                          if (todayStr >= checkInStr && todayStr < checkOutStr) {
                            const releaseRoom = window.confirm(
                              'El huésped está realizando Check-out antes de la fecha programada.\n\n' +
                              '¿Desea liberar la habitación para las noches restantes?\n' +
                              'Esto acortará la estancia hasta hoy y recalculará el total.'
                            );
                            if (releaseRoom) {
                              let newCo = todayStr + 'T12:00';
                              if (checkInStr === todayStr) {
                                const ciDate = new Date(form.checkIn);
                                const coDate = new Date(ciDate.getTime() + 5 * 60 * 1000);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                newCo = `${coDate.getFullYear()}-${pad(coDate.getMonth() + 1)}-${pad(coDate.getDate())}T${pad(coDate.getHours())}:${pad(coDate.getMinutes())}`;
                              }
                              const originalNoches = (editingReserva.noches ?? nightsBetween(editingReserva.check_in, editingReserva.check_out)) || 1;
                              const actualNoches = Math.max(1, nightsBetween(form.checkIn, newCo));
                              setForm(f => ({
                                ...f,
                                estado: 'check_out',
                                checkOut: newCo,
                                noches: actualNoches,
                                tarifaManual: f.tarifaManual || (editingReserva.total_reserva / originalNoches),
                              }));
                              return;
                            }
                          }
                        }
                        setForm(f => ({ ...f, estado: nextVal }));
                      }}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: isPastReserva ? '#f1f5f9' : '#fff', color: isPastReserva ? '#94a3b8' : '#000', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                    >
                      <option value="confirmada">Confirmada</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="check_in">Check-in</option>
                      <option value="check_out">Check-out</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>

                {/* Tarifa + Descuento + Cortesía */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                      Tarifa / noche (HNL)
                      {precioBase > 0 && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>base: L {precioBase}</span>}
                    </label>
                    <input
                      disabled={isPastReserva}
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder={`${precioBase}`}
                      value={form.tarifaManual || ''}
                      onChange={e => setForm(f => ({ ...f, tarifaManual: Math.max(0, Number(e.target.value) || 0) }))}
                      style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: isPastReserva ? '#f1f5f9' : '#fff', color: isPastReserva ? '#94a3b8' : '#000', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8, paddingBottom: 2 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isPastReserva ? 'not-allowed' : 'pointer', fontSize: 12, color: '#64748b' }}>
                      <input
                        disabled={isPastReserva}
                        type="checkbox"
                        checked={form.aplicarDescuento}
                        onChange={e => setForm(f => ({ ...f, aplicarDescuento: e.target.checked }))}
                      />
                      Descuento 3ra edad (15%)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isPastReserva ? 'not-allowed' : 'pointer', fontSize: 12, color: form.esCortesia ? '#0d9488' : '#64748b', fontWeight: form.esCortesia ? 600 : 400 }}>
                      <input
                        disabled={isPastReserva}
                        type="checkbox"
                        checked={form.esCortesia}
                        onChange={e => setForm(f => ({ ...f, esCortesia: e.target.checked, esCredito: e.target.checked ? false : f.esCredito }))}
                      />
                      Cortesía (sin cobro)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isPastReserva ? 'not-allowed' : 'pointer', fontSize: 12, color: form.camaExtra ? '#2563eb' : '#64748b', fontWeight: form.camaExtra ? 600 : 400, marginTop: 4 }}>
                      <input
                        disabled={isPastReserva}
                        type="checkbox"
                        checked={form.camaExtra}
                        onChange={e => setForm(f => ({ ...f, camaExtra: e.target.checked }))}
                      />
                      🛏️ Cama extra unipersonal
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isPastReserva ? 'not-allowed' : 'pointer', fontSize: 12, color: form.limpiezaDiaria ? '#0284c7' : '#64748b', fontWeight: form.limpiezaDiaria ? 600 : 400, marginTop: 4 }}>
                      <input
                        disabled={isPastReserva}
                        type="checkbox"
                        checked={form.limpiezaDiaria}
                        onChange={e => setForm(f => ({ ...f, limpiezaDiaria: e.target.checked }))}
                      />
                      🧹 Limpieza diaria
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isPastReserva ? 'not-allowed' : 'pointer', fontSize: 12, color: form.neverita ? '#16a34a' : '#64748b', fontWeight: form.neverita ? 600 : 400, marginTop: 4 }}>
                      <input
                        disabled={isPastReserva}
                        type="checkbox"
                        checked={form.neverita}
                        onChange={e => setForm(f => ({ ...f, neverita: e.target.checked }))}
                      />
                      🧊 Neverita / Minibar
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: isPastReserva ? 'not-allowed' : 'pointer', fontSize: 12, color: form.plancha ? '#db2777' : '#64748b', fontWeight: form.plancha ? 600 : 400, marginTop: 4 }}>
                      <input
                        disabled={isPastReserva}
                        type="checkbox"
                        checked={form.plancha}
                        onChange={e => setForm(f => ({ ...f, plancha: e.target.checked }))}
                      />
                      💨 Plancha de ropa
                    </label>
                  </div>
                </div>

                {/* Empresa a facturar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Empresa a facturar (Opcional)</label>
                    <button type="button" onClick={() => setShowNuevaEmpresa(true)} style={{ fontSize: 11, color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>+ Crear nueva</button>
                  </div>
                  {!showNuevaEmpresa && (
                    <select
                      disabled={isPastReserva}
                      value={form.empresaId}
                      onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                      style={{ width: '100%', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: isPastReserva ? '#f1f5f9' : '#f0f9ff', color: isPastReserva ? '#94a3b8' : '#000', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                    >
                      <option value="">— Seleccionar empresa —</option>
                      {empresas.map(emp => <option key={emp.id_empresa} value={emp.id_empresa}>{emp.nombre}</option>)}
                    </select>
                  )}
                </div>

                {/* Observaciones */}
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Observaciones</label>
                  <input
                    disabled={isPastReserva}
                    value={form.observaciones}
                    maxLength={200}
                    onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                    placeholder="Nota breve (opcional)"
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: isPastReserva ? '#f1f5f9' : '#fff', color: isPastReserva ? '#94a3b8' : '#000', cursor: isPastReserva ? 'not-allowed' : 'default' }}
                  />
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#fafafa', flexShrink: 0 }}>
                <button
                  onClick={() => handleCancelClick(editingReserva.id_reserva_hotel)}
                  disabled={cancelling === editingReserva.id_reserva_hotel || isPastReserva}
                  style={{ padding: '7px 12px', fontSize: 12, border: isPastReserva ? '1px solid #e2e8f0' : '1px solid #fca5a5', color: isPastReserva ? '#94a3b8' : '#ef4444', borderRadius: 8, cursor: isPastReserva ? 'not-allowed' : 'pointer', background: '#fff' }}
                >
                  {cancelling === editingReserva.id_reserva_hotel ? 'Cancelando…' : 'Cancelar reserva'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={closeEditor}
                    style={{ padding: '7px 14px', fontSize: 13, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving || isPastReserva}
                    style={{
                      padding: '7px 16px',
                      fontSize: 13,
                      background: (saving || isPastReserva) ? '#94a3b8' : '#1e293b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: (saving || isPastReserva) ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Wizard Modal (solo para nuevas reservas) ── */}
      {editorOpen && !editingReserva && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px #0005' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
                  {editingReserva ? 'Editar reserva' : 'Nueva reserva'}
                </h3>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  {editingReserva ? 'Modifica los datos y confirma el resumen.' : 'Completa los pasos y finaliza la reserva.'}
                </p>
              </div>
              <button onClick={closeEditor} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Progress steps */}
            <div style={{ display: 'flex', gap: 0, padding: '16px 24px 0', borderBottom: '1px solid #f1f5f9' }}>
              {WIZARD_STEPS.map((step, idx) => {
                const currentIdx = WIZARD_STEPS.findIndex(s => s.id === wizardStep);
                const done = idx < currentIdx;
                const current = idx === currentIdx;
                return (
                  <button
                    key={step.id}
                    onClick={() => { if (done) setWizardStep(step.id); }}
                    disabled={idx > currentIdx}
                    style={{
                      flex: 1, border: 'none', background: 'none', cursor: done ? 'pointer' : 'default',
                      paddingBottom: 12, textAlign: 'center',
                      borderBottom: current ? '2px solid #1e293b' : done ? '2px solid #22c55e' : '2px solid transparent',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: 18, fontWeight: 700, color: done ? '#22c55e' : current ? '#1e293b' : '#cbd5e1' }}>
                      {done ? '✓' : `0${idx + 1}`}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: current ? '#1e293b' : done ? '#22c55e' : '#94a3b8' }}>{step.title}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{step.caption}</div>
                  </button>
                );
              })}
            </div>

            {/* Overview bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: '#f8fafc', padding: '12px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total estimado</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
                  {form.esCortesia ? <span style={{ color: '#0d9488' }}>Cortesía</span> : `L ${totalEstimado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Habitación</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{selectedHabitacion ? (selectedHabitacion.nombre_alias ?? selectedHabitacion.nombre_habitacion) : '—'}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {selectedHabitacion?.nombre_alias ? selectedHabitacion.nombre_habitacion : (selectedHabitacion?.hotel ?? '')}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Estadía</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{form.noches} noche{form.noches !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  {form.adultos}A · {form.ninos}N
                </div>
              </div>
            </div>

            {/* Step body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* ─── PASO 1: DATOS ─── */}
              {wizardStep === 'datos' && (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', fontWeight: 600 }}>Paso 1</span>
                    <h4 style={{ fontSize: 15, fontWeight: 600, margin: '2px 0 12px' }}>Datos base</h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {/* Huésped */}
                    {!form.registrarNuevo && (
                      <label style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Huésped</div>
                        <select
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          value={form.huespedId}
                          onChange={e => setForm(f => ({ ...f, huespedId: e.target.value }))}
                        >
                          <option value="">Selecciona huésped</option>
                          {huespedes.map(h => <option key={h.id_huesped} value={h.id_huesped}>{h.nombre_completo}</option>)}
                        </select>
                      </label>
                    )}

                    {/* Nuevo huésped toggle */}
                    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.registrarNuevo}
                        onChange={e => setForm(f => ({ ...f, registrarNuevo: e.target.checked, huespedId: e.target.checked ? '' : f.huespedId }))}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>Registrar huésped nuevo</span>
                    </label>

                    {form.registrarNuevo && (
                      <>
                        <label>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Nombre *</div>
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nuevoNombre} onChange={e => setForm(f => ({ ...f, nuevoNombre: e.target.value }))} />
                        </label>
                        <label>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Correo</div>
                          <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nuevoCorreo} onChange={e => setForm(f => ({ ...f, nuevoCorreo: e.target.value }))} />
                        </label>
                        <label>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Teléfono</div>
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nuevoTelefono} onChange={e => setForm(f => ({ ...f, nuevoTelefono: e.target.value }))} />
                        </label>
                        <label>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Ciudad</div>
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nuevaCiudad} onChange={e => setForm(f => ({ ...f, nuevaCiudad: e.target.value }))} />
                        </label>
                        <label style={{ gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Dirección</div>
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.nuevaDireccion} onChange={e => setForm(f => ({ ...f, nuevaDireccion: e.target.value }))} />
                        </label>
                      </>
                    )}

                    {/* Habitación */}
                    {/* Tipo de Reserva */}
                    <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 6 }}>Tipo de reserva</div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                          <input
                            type="radio"
                            name="tipoReserva"
                            value="noche"
                            checked={form.tipoReserva === 'noche'}
                            onChange={() => setForm(f => ({ ...f, tipoReserva: 'noche' }))}
                          />
                          Por Noche
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                          <input
                            type="radio"
                            name="tipoReserva"
                            value="hora"
                            checked={form.tipoReserva === 'hora'}
                            onChange={() => setForm(f => ({ ...f, tipoReserva: 'hora' }))}
                          />
                          Por Horas
                        </label>
                      </div>
                    </div>

                    {form.tipoReserva === 'hora' ? (() => {
                      const timeOptions = Array.from({ length: 48 }, (_, i) => {
                        const h = Math.floor(i / 2);
                        const m = i % 2 === 0 ? '00' : '30';
                        const val = `${h.toString().padStart(2, '0')}:${m}`;
                        const ampm = h >= 12 ? 'pm' : 'am';
                        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        const label = `${h12}:${m} ${ampm}`;
                        return { value: val, label };
                      });

                      const occupiedSlots = form.habitacionId && form.fechaHoraDate ? reservas
                        .filter(r => r.id_habitacion === form.habitacionId && r.estado !== 'cancelada' && r.tipo_reserva === 'hora' && getOnlyDate(r.check_in) === form.fechaHoraDate && r.id_reserva_hotel !== editingReserva?.id_reserva_hotel)
                        .map(r => {
                          const st = new Date(r.check_in);
                          const en = new Date(r.check_out);
                          return { sMin: st.getHours() * 60 + st.getMinutes(), eMin: en.getHours() * 60 + en.getMinutes() };
                        }) : [];

                      const isCheckInDisabled = (timeVal: string) => {
                        const [h, m] = timeVal.split(':').map(Number);
                        const mins = h * 60 + m;
                        return occupiedSlots.some(slot => mins >= slot.sMin && mins < slot.eMin);
                      };

                      const isCheckOutDisabled = (timeVal: string) => {
                        const [h, m] = timeVal.split(':').map(Number);
                        const outMins = h * 60 + m;
                        const [ih, im] = form.horaCheckIn.split(':').map(Number);
                        const inMins = ih * 60 + im;
                        if (outMins <= inMins) return true;
                        return occupiedSlots.some(slot => slot.sMin < outMins && slot.eMin > inMins);
                      };

                      return (
                        <>
                          <label style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Fecha</div>
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                              value={form.fechaHoraDate}
                              onChange={e => setForm(f => ({ ...f, fechaHoraDate: e.target.value }))}
                            />
                          </label>
                          <label>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Hora entrada</div>
                            <select
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                              value={form.horaCheckIn}
                              onChange={e => setForm(f => ({ ...f, horaCheckIn: e.target.value }))}
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value} disabled={isCheckInDisabled(opt.value)}>
                                  {opt.label} {isCheckInDisabled(opt.value) ? '(Ocupado)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Hora salida</div>
                            <select
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                              value={form.horaCheckOut}
                              onChange={e => setForm(f => ({ ...f, horaCheckOut: e.target.value }))}
                            >
                              {timeOptions.map(opt => (
                                <option key={opt.value} value={opt.value} disabled={isCheckOutDisabled(opt.value)}>
                                  {opt.label} {isCheckOutDisabled(opt.value) ? '(Ocupado)' : ''}
                                </option>
                              ))}
                            </select>
                          </label>
                        </>
                      );
                    })() : (
                      <>
                        {/* Fecha entrada */}
                        <label>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Fecha entrada</div>
                          <input
                            type="date"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            value={getOnlyDate(form.checkIn)}
                            onChange={e => {
                              const d = e.target.value;
                              setForm(f => ({
                                ...f,
                                checkIn: d + 'T14:00',
                                checkOut: f.modoFechas === 'noches' ? checkOutFromNights(d + 'T14:00', f.noches) : f.checkOut,
                              }));
                            }}
                          />
                        </label>

                        {/* Modo estadía */}
                        <label>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Modo estadía</div>
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            value={form.modoFechas}
                            onChange={e => {
                              const mode = e.target.value as EditorForm['modoFechas'];
                              setForm(f => ({
                                ...f,
                                modoFechas: mode,
                                checkOut: mode === 'noches' ? checkOutFromNights(f.checkIn, f.noches) : f.checkOut,
                              }));
                            }}
                          >
                            <option value="noches">Por noches</option>
                            <option value="rango">Por fecha salida</option>
                          </select>
                        </label>

                        {/* Noches o fecha salida */}
                        {form.modoFechas === 'noches' ? (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Noches</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <button
                                type="button"
                                onClick={() => setForm(f => {
                                  const n = Math.max(1, f.noches - 1);
                                  return { ...f, noches: n, checkOut: checkOutFromNights(f.checkIn, n) };
                                })}
                                style={{ border: '1px solid #e2e8f0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', background: '#fff', fontSize: 16 }}
                              >−</button>
                              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{form.noches}</span>
                              <button
                                type="button"
                                onClick={() => setForm(f => {
                                  const n = f.noches + 1;
                                  return { ...f, noches: n, checkOut: checkOutFromNights(f.checkIn, n) };
                                })}
                                style={{ border: '1px solid #e2e8f0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', background: '#fff', fontSize: 16 }}
                              >+</button>
                              <span style={{ fontSize: 12, color: '#94a3b8' }}>Salida: {new Date(form.checkOut).toLocaleDateString('es-HN')}</span>
                            </div>
                          </div>
                        ) : (
                          <label>
                            <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Fecha salida</div>
                            <input
                              type="date"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                              value={getOnlyDate(form.checkOut)}
                              min={getOnlyDate(form.checkIn)}
                              onChange={e => {
                                const d = e.target.value + 'T12:00';
                                setForm(f => ({ ...f, checkOut: d, noches: nightsBetween(f.checkIn, d) }));
                              }}
                            />
                          </label>
                        )}
                      </>
                    )}

                    {/* Adultos / Niños */}
                    {(['adultos', 'ninos'] as const).map(field => (
                      <div key={field}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>
                          {field === 'adultos' ? 'Adultos' : 'Niños'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, [field]: Math.max(field === 'adultos' ? 1 : 0, f[field] - 1) }))}
                            style={{ border: '1px solid #e2e8f0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', background: '#fff', fontSize: 16 }}
                          >−</button>
                          <span style={{ fontSize: 15, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{form[field]}</span>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, [field]: f[field] + 1 }))}
                            style={{ border: '1px solid #e2e8f0', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', background: '#fff', fontSize: 16 }}
                          >+</button>
                        </div>
                      </div>
                    ))}

                    {/* Estado */}
                    <label>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Estado</div>
                      <select
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        value={form.estado}
                        onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoReserva }))}
                      >
                        <option value="confirmada">Confirmada</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </label>

                    {/* Observaciones */}
                    <label style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Observaciones</div>
                      <input
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        maxLength={200}
                        placeholder="Nota breve (opcional)"
                        value={form.observaciones}
                        onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                      />
                    </label>

                    {/* Crédito */}
                    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.esCredito}
                        onChange={e => setForm(f => ({ ...f, esCredito: e.target.checked, empresaId: '', esCortesia: e.target.checked ? false : f.esCortesia }))}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>Reserva a crédito empresarial</span>
                    </label>

                    {/* Selector de empresa (solo si es crédito) */}
                    {form.esCredito && (
                      <div style={{ gridColumn: '1 / -1', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0369a1', marginBottom: 10 }}>🏢 Empresa a facturar</div>

                        {!showNuevaEmpresa ? (
                          <>
                            <select
                              value={form.empresaId}
                              onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #bae6fd', background: '#fff', fontSize: 13, marginBottom: 8 }}
                            >
                              <option value="">— Seleccionar empresa —</option>
                              {empresas.map(emp => (
                                <option key={emp.id_empresa} value={emp.id_empresa}>{emp.nombre}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setShowNuevaEmpresa(true)}
                              style={{ fontSize: 12, color: '#0369a1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              + Crear nueva empresa
                            </button>
                          </>
                        ) : (
                          <div style={{ display: 'grid', gap: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                              <div>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>Nombre *</div>
                                <input
                                  type="text"
                                  value={nuevaEmpresaNombre}
                                  onChange={e => setNuevaEmpresaNombre(e.target.value)}
                                  placeholder="Ej: Tecún S.A."
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                                />
                              </div>
                              <div>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>RTN (opcional)</div>
                                <input
                                  type="text"
                                  value={nuevaEmpresaRtn}
                                  onChange={e => setNuevaEmpresaRtn(e.target.value)}
                                  placeholder="Ej: 0801-1990-12345"
                                  style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 13, boxSizing: 'border-box' }}
                                />
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                disabled={savingEmpresa || !nuevaEmpresaNombre.trim()}
                                onClick={async () => {
                                  if (!nuevaEmpresaNombre.trim()) return;
                                  setSavingEmpresa(true);
                                  try {
                                    const emp = await createEmpresa({ nombre: nuevaEmpresaNombre.trim(), rtn: nuevaEmpresaRtn.trim() || undefined });
                                    setEmpresas(prev => [...prev, emp]);
                                    setForm(f => ({ ...f, empresaId: emp.id_empresa }));
                                    setShowNuevaEmpresa(false);
                                    setNuevaEmpresaNombre('');
                                    setNuevaEmpresaRtn('');
                                  } catch (e: any) {
                                    showToast(e?.message ?? 'Error al crear empresa', 'err');
                                  } finally {
                                    setSavingEmpresa(false);
                                  }
                                }}
                                style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none', background: '#0369a1', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                              >
                                {savingEmpresa ? 'Guardando...' : 'Guardar empresa'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowNuevaEmpresa(false); setNuevaEmpresaNombre(''); setNuevaEmpresaRtn(''); }}
                                style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, cursor: 'pointer' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cortesía */}
                    {!form.esCredito && (
                      <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={form.esCortesia}
                          onChange={e => setForm(f => ({ ...f, esCortesia: e.target.checked }))}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>Cortesía (sin cobro)</span>
                      </label>
                    )}

                    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.camaExtra}
                        onChange={e => setForm(f => ({ ...f, camaExtra: e.target.checked }))}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>🛏️ Solicitar cama extra unipersonal</span>
                    </label>

                    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.limpiezaDiaria}
                        onChange={e => setForm(f => ({ ...f, limpiezaDiaria: e.target.checked }))}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>🧹 Servicio de limpieza diaria</span>
                    </label>

                    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.neverita}
                        onChange={e => setForm(f => ({ ...f, neverita: e.target.checked }))}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>🧊 Neverita / Minibar</span>
                    </label>

                    <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={form.plancha}
                        onChange={e => setForm(f => ({ ...f, plancha: e.target.checked }))}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>💨 Plancha de ropa</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ─── PASO 2: TARIFAS ─── */}
              {wizardStep === 'tarifas' && (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', fontWeight: 600 }}>Paso 2</span>
                    <h4 style={{ fontSize: 15, fontWeight: 600, margin: '2px 0 12px' }}>Tarifa y cobro</h4>
                  </div>

                  {form.esCortesia ? (
                    <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '16px 20px', textAlign: 'center', color: '#0d9488' }}>
                      <strong>Cortesía</strong> — Esta reserva no genera cobro.
                    </div>
                  ) : form.tipoReserva === 'hora' ? (
                    <>
                      {/* Tarifa por horas */}
                      <label style={{ display: 'block', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Precio total por horas (HNL) *</div>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                          placeholder="Ingrese precio total"
                          value={form.tarifaManual || ''}
                          onChange={e => setForm(f => ({ ...f, tarifaManual: Math.max(0, Number(e.target.value) || 0) }))}
                        />
                      </label>

                      {/* Breakdown */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        {[
                          { label: 'Subtotal por horas', value: `L ${rates.subtotalBruto.toFixed(2)}` },
                          { label: `ISV (${(rates.isvRate * 100).toFixed(0)}%)`, value: `L ${rates.isv.toFixed(2)}` },
                          { label: `Tasa Turística (${(rates.turisticaRate * 100).toFixed(0)}%)`, value: `L ${rates.tasaTuristica.toFixed(2)}` },
                        ].map((row, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#64748b' }}>
                            <span>{row.label}</span>
                            <span style={{ fontWeight: 500 }}>{row.value}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#1e293b', background: '#f8fafc' }}>
                          <span>Total (HNL)</span>
                          <span>L {rates.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Base price from room */}
                      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Precio base de habitación</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                          L {precioBase.toLocaleString('es-HN', { minimumFractionDigits: 2 })} <span style={{ fontSize: 12, fontWeight: 400, color: '#94a3b8' }}>/noche</span>
                        </div>
                      </div>

                      {/* Tarifa manual */}
                      <label style={{ display: 'block', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Tarifa personalizada (HNL / noche)</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                            style={{ width: 160 }}
                            placeholder={`${precioBase}`}
                            value={form.tarifaManual || ''}
                            onChange={e => setForm(f => ({ ...f, tarifaManual: Math.max(0, Number(e.target.value) || 0) }))}
                          />
                          {form.tarifaManual > 0 && (
                            <button
                              type="button"
                              style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => setForm(f => ({ ...f, tarifaManual: 0 }))}
                            >
                              Usar base
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                          Deja en 0 para usar el precio base de la habitación.
                        </div>
                      </label>

                      {/* Descuento */}
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 20 }}>
                        <input
                          type="checkbox"
                          checked={form.aplicarDescuento}
                          onChange={e => setForm(f => ({ ...f, aplicarDescuento: e.target.checked }))}
                        />
                        <span style={{ fontSize: 12, color: '#64748b' }}>Aplicar descuento tercera edad (15%)</span>
                      </label>

                      {/* Breakdown */}
                      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                        {[
                          { label: 'Subtotal estadía', value: `L ${rates.subtotalBruto.toFixed(2)}` },
                          form.aplicarDescuento ? { label: 'Descuento (15%)', value: `− L ${rates.discount.toFixed(2)}` } : null,
                          { label: `ISV (${(rates.isvRate * 100).toFixed(0)}%)`, value: `L ${rates.isv.toFixed(2)}` },
                          { label: `Tasa Turística (${(rates.turisticaRate * 100).toFixed(0)}%)`, value: `L ${rates.tasaTuristica.toFixed(2)}` },
                        ].filter(Boolean).map((row, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#64748b' }}>
                            <span>{row!.label}</span>
                            <span style={{ fontWeight: 500 }}>{row!.value}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#1e293b', background: '#f8fafc' }}>
                          <span>Total (HNL)</span>
                          <span>L {rates.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─── PASO 3: RESUMEN ─── */}
              {wizardStep === 'resumen' && (
                <div>
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', fontWeight: 600 }}>Paso 3</span>
                    <h4 style={{ fontSize: 15, fontWeight: 600, margin: '2px 0 12px' }}>Resumen final</h4>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>Última revisión antes de guardar.</p>
                  </div>

                  <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                    {(() => {
                      const isHora = form.tipoReserva === 'hora';
                      let checkInStr = '';
                      let checkOutStr = '';
                      let estadiaStr = '';

                      if (isHora) {
                        const dateFormatted = new Date(form.fechaHoraDate + 'T00:00:00').toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        checkInStr = `${dateFormatted} a las ${form.horaCheckIn}`;
                        checkOutStr = `${dateFormatted} a las ${form.horaCheckOut}`;
                        estadiaStr = `Por horas · ${form.adultos} adulto${form.adultos !== 1 ? 's' : ''} · ${form.ninos} niño${form.ninos !== 1 ? 's' : ''}`;
                      } else {
                        checkInStr = new Date(form.checkIn).toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        checkOutStr = new Date(form.checkOut).toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                        estadiaStr = `${form.noches} noche${form.noches !== 1 ? 's' : ''} · ${form.adultos} adulto${form.adultos !== 1 ? 's' : ''} · ${form.ninos} niño${form.ninos !== 1 ? 's' : ''}`;
                      }

                      return [
                        { label: 'Huésped', value: form.registrarNuevo ? (form.nuevoNombre || 'Cliente nuevo') : guestName(selectedGuest) },
                        { label: 'Habitación', value: selectedHabitacion ? `${selectedHabitacion.nombre_alias ?? selectedHabitacion.nombre_habitacion}${selectedHabitacion.nombre_alias ? ` (${selectedHabitacion.nombre_habitacion})` : ''}${selectedHabitacion.hotel ? ` · ${selectedHabitacion.hotel}` : ''}` : '—' },
                        { label: 'Check-in', value: checkInStr },
                        { label: 'Check-out', value: checkOutStr },
                        { label: 'Estadía', value: estadiaStr },
                        { label: 'Estado', value: form.estado === 'pendiente' ? 'Pendiente' : 'Confirmada' },
                        { label: 'Total a cobrar', value: form.esCortesia ? 'Cortesía (sin cargo)' : `L ${totalEstimado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`, accent: true },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13 }}>
                          <span style={{ color: '#64748b' }}>{row.label}</span>
                          <span style={{ fontWeight: row.accent ? 700 : 500, color: row.accent ? '#0d9488' : '#1e293b' }}>{row.value}</span>
                        </div>
                      ));
                    })()}
                  </div>

                  {form.observaciones && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
                      <strong>Nota:</strong> {form.observaciones}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderRadius: '0 0 14px 14px' }}>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                <strong style={{ color: '#1e293b' }}>{wizardMeta.title}</strong> — {wizardMeta.caption}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={closeEditor}
                  style={{ padding: '8px 14px', fontSize: 12, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}
                >
                  Cerrar
                </button>
                {wizardStep !== 'datos' && (
                  <button
                    onClick={goBack}
                    style={{ padding: '8px 14px', fontSize: 12, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}
                  >
                    Atrás
                  </button>
                )}
                {wizardStep !== 'resumen' ? (
                  <button
                    onClick={goNext}
                    style={{ padding: '8px 16px', fontSize: 12, background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                  >
                    {wizardStep === 'datos' ? 'Siguiente: tarifas →' : 'Siguiente: resumen →'}
                  </button>
                ) : (
                  <button
                    onClick={() => void handleSave()}
                    disabled={saving}
                    style={{ padding: '8px 16px', fontSize: 12, background: saving ? '#94a3b8' : '#1e293b', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontWeight: 600 }}
                  >
                    {saving ? 'Guardando…' : editingReserva ? 'Finalizar cambios' : 'Finalizar reserva'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmación Cancelación ── */}
      {cancelModalOpen && cancelModalData && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setCancelModalOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px #0005' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b' }}>Cancelar reserva</h3>
              <button onClick={() => setCancelModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}>
                ✕
              </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{cancelModalData.reserva.huesped}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {cancelModalData.reserva.habitacion} · {getOnlyDate(cancelModalData.reserva.check_in)} → {getOnlyDate(cancelModalData.reserva.check_out)}
                </div>
              </div>

              {cancelModalData.totalPagado > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠ Pagos registrados</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>
                    HNL {cancelModalData.totalPagado.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: 11, color: '#7f1d1d' }}>
                    Al cancelar esta reserva, estos pagos se pueden anular y transferir a un estado de cuenta del cliente.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => void handleConfirmCancel(cancelModalData.totalPagado > 0)}
                  disabled={cancelling !== null}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: cancelling !== null ? '#94a3b8' : '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: cancelling !== null ? 'not-allowed' : 'pointer',
                  }}>
                  {cancelling !== null ? 'Cancelando…' : 'Sí, cancelar' + (cancelModalData.totalPagado > 0 ? ' y anular pagos' : '')}
                </button>
                <button
                  onClick={() => setCancelModalOpen(false)}
                  disabled={cancelling !== null}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#64748b',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}>
                  Mantener reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Dividir Estancia (Split Stay) ── */}
      {splitStayState && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSplitStayState(null)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px #0005' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>✂️</span> Dividir Estancia (Split Stay)
              </h3>
              <button onClick={() => setSplitStayState(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, fontSize: 16 }}>
                ✕
              </button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                  {splitStayState.reserva.huesped}
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Habitación: {splitStayState.reserva.habitacion} <br />
                  Estancia original: {getOnlyDate(splitStayState.reserva.check_in)} a {getOnlyDate(splitStayState.reserva.check_out)}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>
                  Selecciona la fecha desde la cual se moverá la estancia:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {splitOptions.map(opt => (
                    <label
                      key={opt.dateKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        border: selectedSplitDate === opt.dateKey ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: selectedSplitDate === opt.dateKey ? '#f0f6ff' : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        name="splitDate"
                        value={opt.dateKey}
                        checked={selectedSplitDate === opt.dateKey}
                        onChange={() => setSelectedSplitDate(opt.dateKey)}
                        style={{ accentColor: '#2563eb' }}
                      />
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b' }}>
                        Noche del {opt.label} en adelante
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  ¿Qué pasará al confirmar?
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>La estancia original se recortará hasta la fecha seleccionada.</li>
                  <li>Se creará una nueva reserva por las noches restantes.</li>
                  <li>Ambas reservas se podrán gestionar, mover, editar o cancelar de forma independiente.</li>
                </ul>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => void confirmSplitStay()}
                  disabled={savingSplit || !selectedSplitDate}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    background: savingSplit ? '#94a3b8' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: savingSplit || !selectedSplitDate ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingSplit ? 'Dividiendo estancia...' : 'Confirmar División'}
                </button>
                <button
                  onClick={() => setSplitStayState(null)}
                  disabled={savingSplit}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#64748b',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Importador de Reservas Excel ── */}
      {importadorOpen && (
        <ImportadorReservas
          onClose={() => setImportadorOpen(false)}
          hotelId={hotelFiltro !== 'todos' ? hotelFiltro : (hoteles[0]?.id_hotel ?? '')}
          hoteles={hoteles}
          habitaciones={habitaciones}
          onImportComplete={() => { void load(); }}
        />
      )}
    </div>
  );
};
