import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@tremor/react';
import {
  BedDouble, Plus, Pencil, X, Calendar, Loader2, Trash2,
  CheckCircle2, Wrench, Lock, Sparkles, Search,
  Building2, Users, ChevronDown, Tag, ConciergeBell, Edit3,
  Upload, ImagePlus,
} from 'lucide-react';
import { supabase } from '../../api/supabase';
import apiClient from '../../services/api';
import { DatePicker, DateRangePicker } from '../../components/DatePicker';
import {
  obtenerTiposHabitacion, crearTipoHabitacion, actualizarTipoHabitacion, eliminarTipoHabitacion,
  obtenerServicios, crearServicio, actualizarServicio, eliminarServicio,
  type TipoHabitacion, type Servicio,
} from '../../api/configService';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hotel { id_hotel: string; nombre_hotel: string; }

interface Habitacion {
  id_habitacion: string;
  nombre_habitacion: string;
  nombre_alias?: string;
  codigo_habitacion?: string;
  id_hotel: string;
  hotel?: string;
  tipo?: string;
  capacidad?: number;
  tarifa_noche?: number;
  id_tarifa_default?: string | null;
  estado?: 'disponible' | 'ocupada' | 'mantenimiento' | 'bloqueada' | 'limpieza';
  piso?: number;
  numero_camas?: number;
  imagen_360?: string | null;
  imagenes?: string[];
  comodidades?: string[];
}

interface TarifaOpcion {
  id_tarifa: string;
  tarifa_noche: number;
  tarifa_hora?: number;
  tarifa_pasadia?: number;
  categorias_tarifa?: { nombre: string };
  tipos_habitacion?: { nombre_tipo: string };
}

type HabForm = Omit<Habitacion, 'id_habitacion' | 'hotel'> & {
  imagen_360: string;
  comodidades: string[];
  id_tarifa_default: string;
};

const ESTADOS: Habitacion['estado'][] = ['disponible', 'ocupada', 'mantenimiento', 'bloqueada', 'limpieza'];

const ESTADO_META: Record<NonNullable<Habitacion['estado']>, {
  label: string;
  color: 'emerald' | 'blue' | 'amber' | 'violet' | 'cyan';
  bg: string;
  bar: string;
  icon: React.ReactNode;
}> = {
  disponible:    { label: 'Disponible',    color: 'emerald', bg: '#f0fdf4', bar: '#22c55e', icon: <CheckCircle2 size={12} /> },
  ocupada:       { label: 'Ocupada',       color: 'blue',    bg: '#eff6ff', bar: '#3b82f6', icon: <Users size={12} /> },
  mantenimiento: { label: 'Mantenimiento', color: 'amber',   bg: '#fffbeb', bar: '#f59e0b', icon: <Wrench size={12} /> },
  bloqueada:     { label: 'Bloqueada',     color: 'violet',  bg: '#f5f3ff', bar: '#8b5cf6', icon: <Lock size={12} /> },
  limpieza:      { label: 'Limpieza',      color: 'cyan',    bg: '#ecfeff', bar: '#06b6d4', icon: <Sparkles size={12} /> },
};

function emptyForm(hotelId: string, primerTipo = ''): HabForm {
  return {
    nombre_habitacion: '', nombre_alias: '', codigo_habitacion: '',
    tipo: primerTipo, capacidad: 2, tarifa_noche: 0,
    estado: 'disponible', piso: 1, id_hotel: hotelId,
    numero_camas: 1, imagenes: [], imagen_360: '', comodidades: [],
    id_tarifa_default: '',
  };
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
    <div className="h-1.5 w-full" style={{
      background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.6s linear infinite',
    }} />
    <div className="p-5 space-y-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <div className="h-4 rounded-lg w-3/5" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
          <div className="h-3 rounded-lg w-2/5" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
        </div>
        <div className="h-5 w-20 rounded-full ml-3" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-3 rounded-lg" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
        ))}
      </div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-6 w-24 rounded-lg" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
        <div className="flex gap-2">
          {[1,2,3].map(i => <div key={i} className="h-8 w-8 rounded-xl" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />)}
        </div>
      </div>
    </div>
  </div>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps { label: string; value: number; icon: React.ReactNode; from: string; to: string; }
const KpiCard = ({ label, value, icon, from, to }: KpiProps) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl p-4 flex items-center gap-4 overflow-hidden relative"
    style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
  >
    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white flex-shrink-0">
      {icon}
    </div>
    <div>
      <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <motion.p
        key={value}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-white text-2xl font-bold leading-tight"
      >
        {value}
      </motion.p>
    </div>
    <div className="absolute right-3 bottom-2 text-white/10 text-6xl font-black leading-none select-none">
      {value}
    </div>
  </motion.div>
);

// ─── Room Card ────────────────────────────────────────────────────────────────

// ─── Status Pill ─────────────────────────────────────────────────────────────

const StatusPill = ({ estado }: { estado: NonNullable<Habitacion['estado']> }) => {
  const meta = ESTADO_META[estado];
  const pulse = estado === 'disponible';

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl flex-shrink-0"
      style={{
        background: `${meta.bar}18`,
        border: `1px solid ${meta.bar}35`,
      }}
    >
      {/* Dot with optional pulse ring */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        {pulse && (
          <motion.span
            className="absolute inline-flex h-full w-full rounded-full"
            style={{ background: meta.bar }}
            animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className="relative inline-flex rounded-full h-2 w-2"
          style={{ background: meta.bar }}
        />
      </span>
      <span
        className="text-[11px] font-bold uppercase tracking-wide leading-none"
        style={{ color: meta.bar }}
      >
        {meta.label}
      </span>
    </div>
  );
};

// ─── Room Card ────────────────────────────────────────────────────────────────

interface RoomCardProps {
  h: Habitacion;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onCalendar: () => void;
}

const RoomCard = ({ h, index, onEdit, onDelete, onCalendar }: RoomCardProps) => {
  const meta = ESTADO_META[h.estado || 'disponible'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className="rounded-2xl border border-slate-100 overflow-hidden bg-white"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.09)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)')}
    >
      {/* Top color bar */}
      <div className="h-1.5 w-full" style={{ background: meta.bar }} />

      <div className="p-5">
        {/* Header: name + status pill */}
        <div className="flex justify-between items-start gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-slate-800 truncate leading-snug">
              {h.nombre_habitacion}
            </h3>
            {h.nombre_alias && (
              <p className="text-xs text-indigo-400 italic mt-0.5 truncate">"{h.nombre_alias}"</p>
            )}
            {h.hotel && (
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                <Building2 size={10} />{h.hotel}
              </p>
            )}
          </div>
          <StatusPill estado={h.estado || 'disponible'} />
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-500 mb-4">
          <span><span className="font-semibold text-slate-700">Tipo:</span> {h.tipo || '—'}</span>
          <span><span className="font-semibold text-slate-700">Piso:</span> {h.piso ?? '—'}</span>
          <span className="flex items-center gap-1">
            <Users size={10} className="text-slate-400" />
            <span className="font-semibold text-slate-700">Cap.:</span> {h.capacidad ?? '—'} pers.
          </span>
          <span className="flex items-center gap-1">
            <BedDouble size={10} className="text-slate-400" />
            <span className="font-semibold text-slate-700">Camas:</span> {h.numero_camas ?? '—'}
          </span>
        </div>

        {/* Footer: price + actions */}
        <div className="flex justify-between items-center pt-3 border-t border-slate-50">
          <div>
            <span className="text-[17px] font-bold text-slate-800">
              L {Number(h.tarifa_noche || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-slate-400 ml-1">/noche</span>
          </div>
          <div className="flex gap-1">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onCalendar}
              title="Bloqueos"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
            >
              <Calendar size={14} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onEdit}
              title="Editar"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              <Pencil size={14} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onDelete}
              title="Eliminar"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 size={14} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const HabitacionesPanel: React.FC = () => {
  // ── Vista activa ──
  const [vista, setVista] = useState<'habitaciones' | 'tipos' | 'servicios'>('habitaciones');

  // ── Datos compartidos ──
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [hoteles, setHoteles]           = useState<Hotel[]>([]);
  const [tiposHabitacion, setTiposHabitacion] = useState<TipoHabitacion[]>([]);
  const [amenidades, setAmenidades]     = useState<Servicio[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // ── CRUD Tipos ──
  const [tipoModal, setTipoModal]           = useState(false);
  const [editingTipo, setEditingTipo]       = useState<TipoHabitacion | null>(null);
  const [tipoNombre, setTipoNombre]         = useState('');
  const [tipoDesc, setTipoDesc]             = useState('');
  const [tipoCapacidad, setTipoCapacidad]   = useState(2);
  const [tipoEstado, setTipoEstado]         = useState<'activo' | 'inactivo'>('activo');
  const [tipoSaving, setTipoSaving]         = useState(false);

  // ── CRUD Servicios ──
  const [svcModal, setSvcModal]             = useState(false);
  const [editingSvc, setEditingSvc]         = useState<Servicio | null>(null);
  const [svcNombre, setSvcNombre]           = useState('');
  const [svcIcono, setSvcIcono]             = useState('');
  const [svcAcumulable, setSvcAcumulable]   = useState(false);
  const [svcCantidad, setSvcCantidad]       = useState(0);
  const [svcSaving, setSvcSaving]           = useState(false);

  const [filtroHotel, setFiltroHotel]   = useState(() => {
    const a = localStorage.getItem('active_hotel_id');
    return a && a !== 'all' ? a : 'todos';
  });
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda]         = useState('');

  const [modalOpen, setModalOpen]       = useState(false);
  const [editando, setEditando]         = useState<Habitacion | null>(null);
  const [form, setForm]                 = useState<HabForm>(emptyForm(''));
  const [saving, setSaving]             = useState(false);
  const [deleting, setDeleting]         = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Habitacion | null>(null);
  const [uploading360,    setUploading360]    = useState(false);
  const [uploadingImagen, setUploadingImagen] = useState(false);

  const [bloqueos, setBloqueos]         = useState<any[]>([]);
  const [selectedRoomForCalendar, setSelectedRoomForCalendar] = useState<Habitacion | null>(null);
  // Tarifas del tipo (para el selector de referencia)
  const [tarifasDisponibles, setTarifasDisponibles] = useState<TarifaOpcion[]>([]);
  const [loadingTarifas,    setLoadingTarifas]     = useState(false);
  // Períodos de esta habitación individual
  const [periodosHab,       setPeriodosHab]        = useState<any[]>([]);
  const [loadingPeriodos,   setLoadingPeriodos]    = useState(false);
  // Form para agregar/editar un período
  const [formPeriodo,       setFormPeriodo]        = useState<null | {
    id?: string;
    es_base: boolean;
    nombre_periodo: string;
    id_tarifa: string;
    tarifa_noche: string;
    fecha_desde: string;
    fecha_hasta: string;
  }>(null);
  const [guardandoPeriodo,  setGuardandoPeriodo]   = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [toast, setToast]               = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Función reutilizable de upload vía backend (bypasea RLS de storage) ──
  async function uploadImagen(file: File, folder: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const res = await apiClient.post('/media/upload', formData);
    const url = (res as any)?.url || (res as any)?.data?.url;
    if (!url) throw new Error('No se recibió URL del servidor.');
    return url;
  }

  // ── Upload imagen 360 ──
  async function handleUpload360(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading360(true);
    try {
      const url = await uploadImagen(file, 'habitaciones/360');
      setForm(f => ({ ...f, imagen_360: url }));
      showToast('Imagen 360° subida.');
    } catch (err: any) {
      showToast(err.message, 'err');
    } finally { setUploading360(false); }
  }

  // ── Upload imágenes normales (múltiples) ──
  async function handleUploadImagenes(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setUploadingImagen(true);
    try {
      const urls = await Promise.all(files.map(f => uploadImagen(f, 'habitaciones/fotos')));
      setForm(f => ({ ...f, imagenes: [...(f.imagenes || []), ...urls] }));
      showToast(`${urls.length} imagen${urls.length !== 1 ? 'es' : ''} subida${urls.length !== 1 ? 's' : ''}.`);
    } catch (err: any) {
      showToast(err.message, 'err');
    } finally { setUploadingImagen(false); }
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [habsRes, hotsRes, bloqRes, tiposRes, amenRes] = await Promise.all([
        apiClient.get('/bookings/habitaciones'),
        apiClient.get('/bookings/hoteles'),
        apiClient.get('/bookings/bloqueos?desde=2025-01-01&hasta=2027-12-31'),
        apiClient.get('/config/tipos-habitacion'),
        apiClient.get('/config/servicios'),
      ]);
      const toArr = (r: any) => Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : r?.data?.data ?? [];
      setHabitaciones(toArr(habsRes));
      setHoteles(toArr(hotsRes));
      setBloqueos(toArr(bloqRes));
      setTiposHabitacion(toArr(tiposRes));
      setAmenidades(toArr(amenRes));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar habitaciones');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Cargar tarifas de referencia (del tipo) cuando cambia el tipo en el modal
  useEffect(() => {
    if (!modalOpen || !form.tipo) { setTarifasDisponibles([]); return; }
    const tipoObj = tiposHabitacion.find(t => t.nombre.toLowerCase() === form.tipo!.toLowerCase());
    if (!tipoObj?.id) { setTarifasDisponibles([]); return; }
    setLoadingTarifas(true);
    (apiClient.get(`/tarifas?id_tipo_habitacion=${tipoObj.id}&vigentes_solo=false`) as Promise<any>)
      .then(d => setTarifasDisponibles(Array.isArray(d) ? d : []))
      .catch(() => setTarifasDisponibles([]))
      .finally(() => setLoadingTarifas(false));
  }, [modalOpen, form.tipo, tiposHabitacion]);

  // Cargar períodos de la habitación específica al abrir el modal de edición
  function cargarPeriodos(idHab: string) {
    if (!idHab) { setPeriodosHab([]); return; }
    setLoadingPeriodos(true);
    (apiClient.get(`/bookings/habitaciones/${idHab}/tarifas-periodo`) as Promise<any>)
      .then(d => setPeriodosHab(Array.isArray(d) ? d : []))
      .catch(() => setPeriodosHab([]))
      .finally(() => setLoadingPeriodos(false));
  }

  async function guardarPeriodo() {
    if (!formPeriodo || !editando) return;
    if (!formPeriodo.tarifa_noche || Number(formPeriodo.tarifa_noche) <= 0) {
      showToast('Ingresa un monto mayor a 0.', 'err'); return;
    }
    if (!formPeriodo.es_base && !formPeriodo.fecha_desde) {
      showToast('La fecha de inicio es requerida.', 'err'); return;
    }
    setGuardandoPeriodo(true);
    try {
      const body = {
        nombre_periodo: formPeriodo.nombre_periodo || null,
        id_tarifa:      formPeriodo.id_tarifa || null,
        tarifa_noche:   Number(formPeriodo.tarifa_noche),
        fecha_desde:    formPeriodo.es_base ? null : formPeriodo.fecha_desde,
        fecha_hasta:    formPeriodo.fecha_hasta || null,
        es_base:        formPeriodo.es_base,
      };
      if (formPeriodo.id) {
        await apiClient.put(`/bookings/habitaciones/${editando.id_habitacion}/tarifas-periodo/${formPeriodo.id}`, body);
        showToast('Período actualizado.');
      } else {
        await apiClient.post(`/bookings/habitaciones/${editando.id_habitacion}/tarifas-periodo`, body);
        showToast('Período creado.');
      }
      setFormPeriodo(null);
      cargarPeriodos(editando.id_habitacion);
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar.', 'err');
    } finally {
      setGuardandoPeriodo(false);
    }
  }

  async function eliminarPeriodo(pid: string) {
    if (!editando || !window.confirm('¿Eliminar este período?')) return;
    try {
      await apiClient.delete(`/bookings/habitaciones/${editando.id_habitacion}/tarifas-periodo/${pid}`);
      showToast('Período eliminado.');
      cargarPeriodos(editando.id_habitacion);
    } catch (e: any) {
      showToast(e?.message ?? 'Error al eliminar.', 'err');
    }
  }

  const lista = habitaciones.filter(h => {
    if (filtroHotel !== 'todos' && h.id_hotel !== filtroHotel) return false;
    if (filtroEstado !== 'todos' && h.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return h.nombre_habitacion.toLowerCase().includes(q) || (h.nombre_alias ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  // KPI counts
  const counts = {
    total:        habitaciones.length,
    disponible:   habitaciones.filter(h => h.estado === 'disponible').length,
    ocupada:      habitaciones.filter(h => h.estado === 'ocupada').length,
    mantenimiento:habitaciones.filter(h => h.estado === 'mantenimiento' || h.estado === 'bloqueada' || h.estado === 'limpieza').length,
  };

  function abrirNueva() {
    setEditando(null);
    setPeriodosHab([]);
    setFormPeriodo(null);
    const active = localStorage.getItem('active_hotel_id');
    const defaultHotelId = active && active !== 'all' ? active : (hoteles[0]?.id_hotel ?? '');
    setForm(emptyForm(defaultHotelId, tiposHabitacion[0]?.nombre ?? ''));
    setModalOpen(true);
  }

  function abrirEditar(h: Habitacion) {
    setEditando(h);
    setFormPeriodo(null);
    cargarPeriodos(h.id_habitacion);
    setForm({
      nombre_habitacion: h.nombre_habitacion,
      nombre_alias:      h.nombre_alias ?? '',
      codigo_habitacion: h.codigo_habitacion ?? '',
      tipo:   tiposHabitacion.find(t => t.nombre.toLowerCase() === (h.tipo ?? '').toLowerCase())?.nombre ?? h.tipo ?? '',
      capacidad:        h.capacidad ?? 2,
      tarifa_noche:     h.tarifa_noche ?? 0,
      id_tarifa_default:h.id_tarifa_default ?? '',
      estado:           h.estado ?? 'disponible',
      piso:             h.piso ?? 1,
      id_hotel:         h.id_hotel,
      numero_camas:     h.numero_camas ?? 1,
      imagenes:         h.imagenes ?? [],
      imagen_360:       h.imagen_360 ?? '',
      comodidades:      h.comodidades ?? [],
    });
    setModalOpen(true);
  }

  // ── Handlers Tipos ──
  function abrirTipoModal(t?: TipoHabitacion) {
    setEditingTipo(t ?? null);
    setTipoNombre(t?.nombre ?? '');
    setTipoDesc(t?.descripcion ?? '');
    setTipoCapacidad(t?.capacidad_base ?? 2);
    setTipoEstado(t?.estado ?? 'activo');
    setTipoModal(true);
  }

  async function handleGuardarTipo(e: React.FormEvent) {
    e.preventDefault();
    if (!tipoNombre.trim()) return;
    setTipoSaving(true);
    try {
      const payload = { nombre: tipoNombre.trim(), descripcion: tipoDesc.trim(), capacidad_base: tipoCapacidad, estado: tipoEstado };
      if (editingTipo) {
        const updated = await actualizarTipoHabitacion(editingTipo.id, payload);
        setTiposHabitacion(prev => prev.map(t => t.id === editingTipo.id ? { ...t, ...updated } : t));
        showToast('Tipo actualizado.');
      } else {
        const created = await crearTipoHabitacion(payload);
        setTiposHabitacion(prev => [...prev, created]);
        showToast('Tipo creado.');
      }
      setTipoModal(false);
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar.', 'err');
    } finally { setTipoSaving(false); }
  }

  async function handleEliminarTipo(id: string) {
    if (!window.confirm('¿Eliminar este tipo? Las habitaciones con este tipo quedarán sin tipo asignado.')) return;
    try {
      await eliminarTipoHabitacion(id);
      setTiposHabitacion(prev => prev.filter(t => t.id !== id));
      showToast('Tipo eliminado.');
    } catch (e: any) { showToast(e?.message ?? 'Error.', 'err'); }
  }

  // ── Handlers Servicios ──
  function abrirSvcModal(s?: Servicio) {
    setEditingSvc(s ?? null);
    setSvcNombre(s?.nombre ?? '');
    setSvcIcono(s?.icono ?? '');
    setSvcAcumulable(s?.es_acumulable ?? false);
    setSvcCantidad(s?.cantidad_total ?? 0);
    setSvcModal(true);
  }

  async function handleGuardarSvc(e: React.FormEvent) {
    e.preventDefault();
    if (!svcNombre.trim()) return;
    setSvcSaving(true);
    try {
      const payload = { nombre: svcNombre.trim(), icono: svcIcono.trim(), es_acumulable: svcAcumulable, cantidad_total: svcAcumulable ? svcCantidad : 0 };
      if (editingSvc) {
        const updated = await actualizarServicio(editingSvc.id, payload);
        setAmenidades(prev => prev.map(s => s.id === editingSvc.id ? { ...s, ...updated } : s));
        showToast('Servicio actualizado.');
      } else {
        const created = await crearServicio(payload);
        setAmenidades(prev => [...prev, created]);
        showToast('Servicio creado.');
      }
      setSvcModal(false);
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar.', 'err');
    } finally { setSvcSaving(false); }
  }

  async function handleEliminarSvc(id: string) {
    if (!window.confirm('¿Eliminar este servicio?')) return;
    try {
      await eliminarServicio(id);
      setAmenidades(prev => prev.filter(s => s.id !== id));
      showToast('Servicio eliminado.');
    } catch (e: any) { showToast(e?.message ?? 'Error.', 'err'); }
  }

  async function handleSave() {
    if (!form.nombre_habitacion.trim()) { showToast('El nombre es obligatorio.', 'err'); return; }
    if (!form.id_hotel) { showToast('Selecciona un hotel.', 'err'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tarifa_noche:      Number(form.tarifa_noche),
        capacidad:         Number(form.capacidad),
        piso:              Number(form.piso),
        id_tarifa_default: form.id_tarifa_default || null,
        numero_camas:  Number(form.numero_camas),
        imagen_360:    form.imagen_360?.trim() || null,
      };
      if (editando) {
        await apiClient.put(`/bookings/habitaciones/${editando.id_habitacion}`, payload);
        showToast('Habitación actualizada.');
      } else {
        await apiClient.post('/bookings/habitaciones', payload);
        showToast('Habitación creada.');
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar.', 'err');
    } finally { setSaving(false); }
  }

  async function handleDelete(h: Habitacion) {
    setDeleting(h.id_habitacion);
    try {
      await apiClient.delete(`/bookings/habitaciones/${h.id_habitacion}`);
      showToast('Habitación eliminada.');
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al eliminar.', 'err');
    } finally { setDeleting(null); }
  }

  async function toggleBloqueoHabitacion(idHabitacion: string, fechaStr: string) {
    const esBloqueada = bloqueos.some(b =>
      b.id_habitacion === idHabitacion &&
      fechaStr >= (b.fecha_inicio ?? '').split('T')[0] &&
      fechaStr <= (b.fecha_fin   ?? '').split('T')[0]
    );

    // Optimistic update — el calendario refleja el cambio de inmediato
    if (esBloqueada) {
      setBloqueos(prev => prev.filter(b =>
        !(b.id_habitacion === idHabitacion &&
          fechaStr >= (b.fecha_inicio ?? '').split('T')[0] &&
          fechaStr <= (b.fecha_fin   ?? '').split('T')[0])
      ));
    } else {
      setBloqueos(prev => [...prev, {
        id_habitacion: idHabitacion,
        fecha_inicio: `${fechaStr}T00:00:00.000Z`,
        fecha_fin:    `${fechaStr}T23:59:59.999Z`,
      }]);
    }

    try {
      const res = await apiClient.post('/bookings/bloqueos/toggle', { id_habitacion: idHabitacion, fecha: fechaStr });
      if (res?.success) {
        showToast(res.action === 'added' ? 'Bloqueada.' : 'Habilitada.');
      }
      // Sincronizar IDs reales del servidor en segundo plano
      const fresh = await apiClient.get('/bookings/bloqueos?desde=2025-01-01&hasta=2027-12-31');
      setBloqueos(Array.isArray(fresh) ? fresh : (fresh?.data ?? []));
    } catch (err: any) {
      // Revertir el optimistic update si falló
      if (esBloqueada) {
        setBloqueos(prev => [...prev, {
          id_habitacion: idHabitacion,
          fecha_inicio: `${fechaStr}T00:00:00.000Z`,
          fecha_fin:    `${fechaStr}T23:59:59.999Z`,
        }]);
      } else {
        setBloqueos(prev => prev.filter(b =>
          !(b.id_habitacion === idHabitacion &&
            fechaStr >= (b.fecha_inicio ?? '').split('T')[0] &&
            fechaStr <= (b.fecha_fin   ?? '').split('T')[0])
        ));
      }
      showToast(err?.message ?? 'Error al cambiar disponibilidad', 'err');
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/60">

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,   scale: 1 }}
            exit={{   opacity: 0, y: -16, scale: 0.95 }}
            className="fixed top-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-medium"
            style={{ background: toast.type === 'ok' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)' }}
          >
            {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <X size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-100 px-8 pt-7 pb-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Operativos</p>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <BedDouble size={16} className="text-white" />
            </div>
            Habitaciones
          </h1>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              if (vista === 'habitaciones') abrirNueva();
              else if (vista === 'tipos') abrirTipoModal();
              else abrirSvcModal();
            }}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={15} />
            {vista === 'habitaciones' ? 'Nueva habitación' : vista === 'tipos' ? 'Nuevo tipo' : 'Nuevo servicio'}
          </motion.button>
        </div>

        {/* Sub-navegación */}
        <div className="flex gap-1">
          {([
            { key: 'habitaciones', label: 'Habitaciones', icon: <BedDouble size={14} /> },
            { key: 'tipos',        label: 'Tipos',        icon: <Tag size={14} /> },
            { key: 'servicios',    label: 'Servicios',    icon: <ConciergeBell size={14} /> },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setVista(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2"
              style={{
                borderColor: vista === tab.key ? '#0f172a' : 'transparent',
                color: vista === tab.key ? '#0f172a' : '#94a3b8',
              }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI bar — solo en vista habitaciones */}
      {vista === 'habitaciones' && (
        <div className="bg-white border-b border-slate-100 px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-[72px] rounded-2xl" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
              ))
            ) : (
              <>
                <KpiCard label="Total" value={counts.total} icon={<BedDouble size={18}/>} from="#1e293b" to="#334155" />
                <KpiCard label="Disponibles" value={counts.disponible} icon={<CheckCircle2 size={18}/>} from="#059669" to="#10b981" />
                <KpiCard label="Ocupadas" value={counts.ocupada} icon={<Users size={18}/>} from="#2563eb" to="#3b82f6" />
                <KpiCard label="Sin servicio" value={counts.mantenimiento} icon={<Wrench size={18}/>} from="#d97706" to="#f59e0b" />
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ── (solo en vista habitaciones) */}
      {vista !== 'habitaciones' ? null : <div className="bg-white border-b border-slate-100 px-8 py-3 flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar habitación..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
          />
        </div>
        <div className="relative">
          <select
            value={filtroHotel}
            onChange={e => setFiltroHotel(e.target.value)}
            disabled={localStorage.getItem('active_hotel_id') !== 'all'}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <option value="todos">Todos los hoteles</option>
            {hoteles.map(h => <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-all cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_META[e].label}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-xs text-slate-400 ml-auto font-medium">
          {lista.length} habitación{lista.length !== 1 ? 'es' : ''}
        </span>
      </div>}

      {/* ── Vista: Tipos ── */}
      {vista === 'tipos' && (
        <div className="px-8 py-6">
          {loading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))' }}>
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />)}
            </div>
          ) : tiposHabitacion.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><Tag size={24} className="text-slate-300" /></div>
              <p className="text-slate-500 font-medium">Sin tipos de habitación</p>
              <p className="text-slate-400 text-sm">Crea el primer tipo para poder asignarlo a las habitaciones.</p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))' }}>
              {tiposHabitacion.map((t, i) => (
                <motion.div key={t.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    {t.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{t.nombre}</p>
                    {t.descripcion && <p className="text-xs text-slate-400 truncate mt-0.5">{t.descripcion}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: t.estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: t.estado === 'activo' ? '#16a34a' : '#64748b' } as any}>
                        {t.estado === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className="text-[10px] text-slate-400">Cap. base: {t.capacidad_base} pers.</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirTipoModal(t)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"><Edit3 size={13} /></button>
                    <button onClick={() => handleEliminarTipo(t.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Vista: Servicios ── */}
      {vista === 'servicios' && (
        <div className="px-8 py-6">
          {loading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))' }}>
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl" style={{ background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />)}
            </div>
          ) : amenidades.length === 0 ? (
            <div className="flex flex-col items-center py-24 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><ConciergeBell size={24} className="text-slate-300" /></div>
              <p className="text-slate-500 font-medium">Sin servicios configurados</p>
              <p className="text-slate-400 text-sm">Agrega los servicios que ofrecen las habitaciones del hotel.</p>
            </div>
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))' }}>
              {amenidades.map((s, i) => (
                <motion.div key={s.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">
                    {s.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{s.nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {s.es_acumulable ? `Acumulable · ${s.cantidad_total} disponibles` : 'Incluido en habitación'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirSvcModal(s)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"><Edit3 size={13} /></button>
                    <button onClick={() => handleEliminarSvc(s.id)} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Content habitaciones ── */}
      {vista === 'habitaciones' && <div className="px-8 py-6">
        {loading ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <X size={22} className="text-red-400" />
            </div>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        ) : lista.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BedDouble size={28} className="text-slate-300" />
            </div>
            <div className="text-center">
              <p className="text-slate-600 font-medium">
                {habitaciones.length === 0 ? 'Sin habitaciones aún' : 'No hay resultados'}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                {habitaciones.length === 0 ? 'Crea la primera habitación del hotel.' : 'Prueba con otro filtro o búsqueda.'}
              </p>
            </div>
            {habitaciones.length === 0 && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={abrirNueva}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium mt-2"
              >
                <Plus size={15} /> Crear primera habitación
              </motion.button>
            )}
          </motion.div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {lista.map((h, i) => (
              <RoomCard
                key={h.id_habitacion}
                h={h}
                index={i}
                onEdit={() => abrirEditar(h)}
                onDelete={() => setConfirmDelete(h)}
                onCalendar={() => setSelectedRoomForCalendar(h)}
              />
            ))}
          </div>
        )}
      </div>}

      {/* ── Modal Tipo ── */}
      <AnimatePresence>
        {tipoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setTipoModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">{editingTipo ? 'Editar tipo' : 'Nuevo tipo de habitación'}</h3>
                <button onClick={() => setTipoModal(false)} className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14} /></button>
              </div>
              <form onSubmit={handleGuardarTipo} className="px-6 py-5 flex flex-col gap-4">
                <label>
                  <span style={lbl}>Nombre *</span>
                  <input className={inp} required value={tipoNombre} onChange={e => setTipoNombre(e.target.value)} placeholder="Ej. Suite, Doble, Simple" />
                </label>
                <label>
                  <span style={lbl}>Descripción</span>
                  <input className={inp} value={tipoDesc} onChange={e => setTipoDesc(e.target.value)} placeholder="Descripción opcional" />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label>
                    <span style={lbl}>Capacidad base</span>
                    <div className="flex items-center gap-3 mt-1">
                      <button type="button" onClick={() => setTipoCapacidad(c => Math.max(1, c-1))} style={cnt}>−</button>
                      <span className="font-semibold text-slate-700 w-6 text-center">{tipoCapacidad}</span>
                      <button type="button" onClick={() => setTipoCapacidad(c => c+1)} style={cnt}>+</button>
                    </div>
                  </label>
                  <label>
                    <span style={lbl}>Estado</span>
                    <select className={inp} value={tipoEstado} onChange={e => setTipoEstado(e.target.value as 'activo'|'inactivo')}>
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                    </select>
                  </label>
                </div>
                <div className="flex justify-end gap-2.5 pt-2">
                  <button type="button" onClick={() => setTipoModal(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={tipoSaving} className="px-5 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors" style={{ background: tipoSaving ? '#94a3b8' : '#1e293b' }}>
                    {tipoSaving && <Loader2 size={13} className="animate-spin" />}
                    {editingTipo ? 'Guardar cambios' : 'Crear tipo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal Servicio ── */}
      <AnimatePresence>
        {svcModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSvcModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900">{editingSvc ? 'Editar servicio' : 'Nuevo servicio'}</h3>
                <button onClick={() => setSvcModal(false)} className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={14} /></button>
              </div>
              <form onSubmit={handleGuardarSvc} className="px-6 py-5 flex flex-col gap-4">
                <label>
                  <span style={lbl}>Nombre *</span>
                  <input className={inp} required value={svcNombre} onChange={e => setSvcNombre(e.target.value)} placeholder="Ej. Wi-Fi, Desayuno, A/C" />
                </label>
                <label>
                  <span style={lbl}>Icono <span className="text-slate-400 font-normal normal-case">(texto, emoji o código)</span></span>
                  <input className={inp} value={svcIcono} onChange={e => setSvcIcono(e.target.value)} placeholder="Ej. wifi, bed, coffee" />
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={svcAcumulable} onChange={e => setSvcAcumulable(e.target.checked)} className="w-4 h-4 accent-emerald-500 cursor-pointer" />
                  <span className="text-sm text-slate-700">Es acumulable (inventario limitado)</span>
                </label>
                {svcAcumulable && (
                  <label>
                    <span style={lbl}>Cantidad total disponible</span>
                    <input type="number" min={0} className={inp} value={svcCantidad} onChange={e => setSvcCantidad(parseInt(e.target.value)||0)} />
                  </label>
                )}
                <div className="flex justify-end gap-2.5 pt-2">
                  <button type="button" onClick={() => setSvcModal(false)} className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={svcSaving} className="px-5 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2" style={{ background: svcSaving ? '#94a3b8' : '#10b981' }}>
                    {svcSaving && <Loader2 size={13} className="animate-spin" />}
                    {editingSvc ? 'Guardar cambios' : 'Crear servicio'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal crear / editar ── */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 24 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{   opacity: 0, scale: 0.95, y: 24 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
                    <BedDouble size={15} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 leading-tight">
                      {editando ? 'Editar habitación' : 'Nueva habitación'}
                    </h3>
                    {editando && <p className="text-xs text-slate-400 mt-0.5">{editando.nombre_habitacion}</p>}
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setModalOpen(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                  <X size={15} />
                </motion.button>
              </div>

              {/* Form */}
              <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5">

                {/* ─── Identificación ─── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identificación</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label>
                      <span style={lbl}>Nombre interno *</span>
                      <input className={inp} placeholder="Ej. Suite 101" value={form.nombre_habitacion}
                        onChange={e => setForm(f => ({ ...f, nombre_habitacion: e.target.value }))} />
                    </label>
                    <label>
                      <span style={lbl}>Código de habitación</span>
                      <input className={inp} placeholder="Ej. HAB-101" value={form.codigo_habitacion ?? ''}
                        onChange={e => setForm(f => ({ ...f, codigo_habitacion: e.target.value }))} />
                    </label>
                    <label>
                      <span style={lbl}>Alias público <span className="text-slate-400 font-normal normal-case">(visible al cliente)</span></span>
                      <input className={inp} placeholder="Ej. La Cabaña del Río" value={form.nombre_alias ?? ''}
                        onChange={e => setForm(f => ({ ...f, nombre_alias: e.target.value }))} />
                    </label>
                    <label>
                      <span style={lbl}>Hotel *</span>
                      {hoteles.length === 0 ? (
                        <div className="text-xs text-amber-600 p-3 bg-amber-50 rounded-xl border border-amber-200 mt-1">
                          No hay hoteles. Crea uno en Configuración.
                        </div>
                      ) : (
                        <select className={inp} value={form.id_hotel}
                          onChange={e => setForm(f => ({ ...f, id_hotel: e.target.value }))}
                          disabled={localStorage.getItem('active_hotel_id') !== 'all'}>
                          <option value="">Selecciona hotel</option>
                          {hoteles.map(h => <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>)}
                        </select>
                      )}
                    </label>
                  </div>
                </div>

                {/* ─── Configuración ─── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configuración</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <label>
                      <span style={lbl}>Tipo</span>
                      {tiposHabitacion.length === 0 ? (
                        <div className="text-xs text-amber-600 p-3 bg-amber-50 rounded-xl border border-amber-200 mt-1">Sin tipos. Crea en la pestaña Tipos.</div>
                      ) : (
                        <select className={inp} value={form.tipo}
                          onChange={e => setForm(f => ({ ...f, tipo: e.target.value, id_tarifa_default: '', tarifa_noche: 0 }))}>
                          {tiposHabitacion.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                        </select>
                      )}
                    </label>
                    <label>
                      <span style={lbl}>Estado</span>
                      <select className={inp} value={form.estado}
                        onChange={e => setForm(f => ({ ...f, estado: e.target.value as Habitacion['estado'] }))}>
                        {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_META[e].label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <label>
                      <span style={lbl}>Piso</span>
                      <input type="number" min={0} className={inp} value={form.piso}
                        onChange={e => setForm(f => ({ ...f, piso: Math.max(0, parseInt(e.target.value) || 0) }))} />
                    </label>
                    <label>
                      <span style={lbl}>Capacidad (pers.)</span>
                      <div className="flex items-center gap-2 mt-1">
                        <button type="button" onClick={() => setForm(f => ({ ...f, capacidad: Math.max(1, f.capacidad! - 1) }))} style={cnt}>−</button>
                        <span className="font-semibold text-slate-700 w-6 text-center text-sm">{form.capacidad}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, capacidad: f.capacidad! + 1 }))} style={cnt}>+</button>
                      </div>
                    </label>
                    <label>
                      <span style={lbl}>Núm. de camas</span>
                      <div className="flex items-center gap-2 mt-1">
                        <button type="button" onClick={() => setForm(f => ({ ...f, numero_camas: Math.max(1, f.numero_camas! - 1) }))} style={cnt}>−</button>
                        <span className="font-semibold text-slate-700 w-6 text-center text-sm">{form.numero_camas}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, numero_camas: f.numero_camas! + 1 }))} style={cnt}>+</button>
                      </div>
                    </label>
                  </div>
                </div>

                {/* ─── Tarifas ─── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarifas</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>

                  {/* Selector de tarifa del sistema — radio buttons siempre visibles */}
                  <div className="mb-4">
                    <span style={lbl}>Tarifa del sistema</span>
                    {loadingTarifas ? (
                      <p className="text-xs text-slate-400 py-1">Cargando tarifas...</p>
                    ) : tarifasDisponibles.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">
                        {form.tipo ? 'Sin tarifas configuradas para este tipo.' : 'Selecciona un tipo de habitación.'}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {/* Opción "Ninguna" */}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, id_tarifa_default: '', tarifa_noche: 0 }))}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left w-full transition-all"
                          style={{
                            background: !form.id_tarifa_default ? 'rgba(100,116,139,.07)' : '#f8fafc',
                            border: `1.5px solid ${!form.id_tarifa_default ? '#94a3b8' : '#e2e8f0'}`,
                          }}
                        >
                          <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{ borderColor: !form.id_tarifa_default ? '#64748b' : '#cbd5e1' }}>
                            {!form.id_tarifa_default && <span className="w-2 h-2 rounded-full bg-slate-500" />}
                          </span>
                          <span className="text-sm text-slate-500 italic">Ninguna (manual)</span>
                        </button>

                        {(tarifasDisponibles as any[]).map((t: any) => {
                          const activa = form.id_tarifa_default === t.id_tarifa;
                          return (
                            <button
                              key={t.id_tarifa}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, id_tarifa_default: t.id_tarifa, tarifa_noche: t.tarifa_noche }))}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left w-full transition-all"
                              style={{
                                background: activa ? 'rgba(124,58,237,.07)' : '#f8fafc',
                                border: `1.5px solid ${activa ? '#7c3aed' : '#e2e8f0'}`,
                              }}
                            >
                              <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                                style={{ borderColor: activa ? '#7c3aed' : '#cbd5e1', background: 'white' }}>
                                {activa && <span className="w-2 h-2 rounded-full bg-violet-600" />}
                              </span>
                              <span className="text-sm font-semibold text-slate-700 flex-1">{t.categoria || 'Sin categoría'}</span>
                              <span className="text-sm font-bold" style={{ color: activa ? '#7c3aed' : '#334155' }}>
                                L {Number(t.tarifa_noche).toLocaleString('es-HN', { minimumFractionDigits: 2 })}/noche
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Tarifas por período (solo edición) */}
                  {editando && (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span style={{ ...lbl, marginBottom: 0 }}>Tarifas por período</span>
                        {!formPeriodo && (
                          <div className="flex gap-1.5">
                            {!periodosHab.some((p: any) => p.es_base) && (
                              <button type="button"
                                onClick={() => setFormPeriodo({ es_base: true, nombre_periodo: 'Base', id_tarifa: '', tarifa_noche: '', fecha_desde: '', fecha_hasta: '' })}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                                style={{ color: '#059669', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.25)' }}>
                                + Tarifa base
                              </button>
                            )}
                            <button type="button"
                              onClick={() => setFormPeriodo({ es_base: false, nombre_periodo: '', id_tarifa: '', tarifa_noche: '', fecha_desde: '', fecha_hasta: '' })}
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                              style={{ color: '#2563eb', background: 'rgba(37,99,235,.07)', border: '1px solid rgba(37,99,235,.2)' }}>
                              + Período
                            </button>
                          </div>
                        )}
                      </div>

                      {formPeriodo && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 mb-3 flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span style={lbl}>{formPeriodo.es_base ? 'Nombre' : 'Nombre del período'}</span>
                              <input className={inp} value={formPeriodo.nombre_periodo}
                                placeholder={formPeriodo.es_base ? 'Tarifa normal' : 'ej. Navidad 2024'}
                                onChange={e => setFormPeriodo(f => f ? { ...f, nombre_periodo: e.target.value } : f)} />
                            </div>
                            <div>
                              <span style={lbl}>L / noche *</span>
                              <input type="number" min={0} step={0.01} className={inp} value={formPeriodo.tarifa_noche}
                                placeholder="0.00"
                                onChange={e => setFormPeriodo(f => f ? { ...f, tarifa_noche: e.target.value } : f)} />
                            </div>
                          </div>
                          {tarifasDisponibles.length > 0 && (
                            <div>
                              <span style={lbl}>Referencia (opcional)</span>
                              <select className={inp}
                                value={formPeriodo.id_tarifa}
                                onChange={e => {
                                  const t = tarifasDisponibles.find((x: any) => x.id_tarifa === e.target.value);
                                  setFormPeriodo(f => f ? { ...f, id_tarifa: e.target.value, tarifa_noche: t ? String(t.tarifa_noche) : f.tarifa_noche } : f);
                                }}>
                                <option value="">— Sin referencia (monto manual) —</option>
                                {tarifasDisponibles.map((t: any) => (
                                  <option key={t.id_tarifa} value={t.id_tarifa}>
                                    {t.categoria || 'Sin categoría'} — L {Number(t.tarifa_noche).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {!formPeriodo.es_base && (
                            <div>
                              <span style={lbl}>Rango de fechas *</span>
                              <DateRangePicker
                                from={formPeriodo.fecha_desde} to={formPeriodo.fecha_hasta}
                                onFromChange={v => setFormPeriodo(f => f ? { ...f, fecha_desde: v } : f)}
                                onToChange={v => setFormPeriodo(f => f ? { ...f, fecha_hasta: v } : f)}
                                placeholderFrom="Fecha inicio *" placeholderTo="Fecha fin (opcional)"
                                gap={8}
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Sin fecha fin → aplica indefinidamente.</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setFormPeriodo(null)}
                              className="flex-1 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors">
                              Cancelar
                            </button>
                            <button type="button" onClick={guardarPeriodo} disabled={guardandoPeriodo}
                              className="flex-[2] py-2 rounded-xl text-sm font-bold text-white cursor-pointer transition-opacity"
                              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', opacity: guardandoPeriodo ? .6 : 1 }}>
                              {guardandoPeriodo ? 'Guardando...' : formPeriodo.id ? 'Actualizar' : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {loadingPeriodos ? (
                        <p className="text-xs text-slate-400 py-2">Cargando períodos...</p>
                      ) : periodosHab.length === 0 && !formPeriodo ? (
                        <p className="text-xs text-slate-400 text-center py-3">
                          Sin tarifas asignadas. Usa "Tarifa base" para el precio permanente y "Período" para fechas especiales.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {periodosHab.map((p: any) => {
                            const hoy     = new Date().toLocaleDateString('en-CA');
                            const desde   = p.fecha_desde ?? '';
                            const hasta   = p.fecha_hasta ?? '';
                            const activa  = p.es_base || ((!desde || desde <= hoy) && (!hasta || hasta >= hoy));
                            const proxima = !p.es_base && desde > hoy;
                            const vencida = !p.es_base && hasta && hasta < hoy;
                            const badge   = p.es_base ? { label: 'Base',    bg: 'rgba(37,99,235,.08)',  color: '#2563eb' }
                                          : activa    ? { label: 'Activa',  bg: 'rgba(16,185,129,.1)',  color: '#059669' }
                                          : proxima   ? { label: 'Próxima', bg: 'rgba(245,158,11,.1)',  color: '#d97706' }
                                          :             { label: 'Vencida', bg: 'rgba(100,116,139,.1)', color: '#64748b' };
                            const editandoPeriodo = formPeriodo?.id === p.id;
                            return (
                              <div key={p.id} className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-xl"
                                style={{
                                  background: editandoPeriodo ? 'rgba(37,99,235,.05)' : vencida ? 'rgba(100,116,139,.04)' : '#f8fafc',
                                  border: `1.5px solid ${editandoPeriodo ? '#2563eb' : vencida ? '#e2e8f0' : '#e2e8f0'}`,
                                  opacity: vencida ? .7 : 1,
                                }}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[13px] font-bold text-slate-800">
                                      L {Number(p.tarifa_noche).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                      style={{ background: badge.bg, color: badge.color }}>
                                      {badge.label}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {p.nombre_periodo && <span className="font-semibold text-slate-600">{p.nombre_periodo}</span>}
                                    {!p.es_base && desde && <span> · {desde}{hasta ? ` → ${hasta}` : ' → sin vencimiento'}</span>}
                                    {p.es_base && <span> · Tarifa permanente</span>}
                                  </div>
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button type="button" title="Editar"
                                    onClick={() => setFormPeriodo({ id: p.id, es_base: p.es_base, nombre_periodo: p.nombre_periodo ?? '', id_tarifa: p.id_tarifa ?? '', tarifa_noche: String(p.tarifa_noche), fecha_desde: p.fecha_desde ?? '', fecha_hasta: p.fecha_hasta ?? '' })}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all">
                                    <Pencil size={11} />
                                  </button>
                                  <button type="button" title="Eliminar"
                                    onClick={() => eliminarPeriodo(p.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 border border-red-100 transition-all">
                                    <X size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ─── Multimedia ─── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multimedia</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* Imagen 360 */}
                    <div>
                      <span style={lbl}>Imagen Panorámica 360°</span>
                      <div className="flex gap-2 mt-1">
                        <input type="text" className={`${inp} flex-1 mt-0`}
                          placeholder="Pega una URL o sube un archivo"
                          value={form.imagen_360 || ''}
                          onChange={e => setForm(f => ({ ...f, imagen_360: e.target.value }))} />
                        <div className="relative flex-shrink-0">
                          <input type="file" accept="image/*" onChange={handleUpload360} disabled={uploading360}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                          <button type="button" disabled={uploading360}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                            style={{ background: uploading360 ? '#94a3b8' : '#10b981' }}>
                            {uploading360 ? <><Loader2 size={13} className="animate-spin" />Subiendo</> : <><Upload size={13} />Subir</>}
                          </button>
                        </div>
                      </div>
                      {form.imagen_360 && (
                        <a href={form.imagen_360} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-blue-500 hover:underline mt-1 block truncate">
                          {form.imagen_360}
                        </a>
                      )}
                    </div>
                    {/* Imágenes normales */}
                    <div>
                      <span style={lbl}>Fotos de la habitación</span>
                      <div className="relative mt-1 mb-2">
                        <input type="file" accept="image/*" multiple onChange={handleUploadImagenes}
                          disabled={uploadingImagen}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                        <button type="button" disabled={uploadingImagen}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors"
                          style={{ borderColor: uploadingImagen ? '#cbd5e1' : '#94a3b8', color: uploadingImagen ? '#94a3b8' : '#64748b' }}>
                          {uploadingImagen
                            ? <><Loader2 size={14} className="animate-spin" /> Subiendo imágenes...</>
                            : <><ImagePlus size={14} /> Subir fotos desde el dispositivo</>}
                        </button>
                      </div>
                      {(form.imagenes || []).length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                          {(form.imagenes || []).map((url, i) => (
                            <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5">
                              <img src={url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-slate-200" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                              <span className="text-xs text-slate-500 truncate flex-1">{url.split('/').pop()}</span>
                              <button type="button" onClick={() => setForm(f => ({ ...f, imagenes: (f.imagenes||[]).filter((_,j)=>j!==i) }))}
                                className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <textarea className={`${inp} resize-none text-xs`} rows={2}
                        placeholder="O pega URLs manualmente, una por línea"
                        value={(form.imagenes || []).join('\n')}
                        onChange={e => setForm(f => ({ ...f, imagenes: e.target.value.split('\n').map(u => u.trim()).filter(Boolean) }))} />
                    </div>
                  </div>
                </div>

                {/* ─── Servicios ─── */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Servicios</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  {amenidades.length === 0 ? (
                    <div className="text-xs text-amber-600 p-3 bg-amber-50 rounded-xl border border-amber-200">
                      Sin servicios configurados. Agrégalos en la pestaña Servicios.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {amenidades.map(a => {
                        const checked = (form.comodidades || []).includes(a.nombre);
                        return (
                          <motion.label key={a.id} whileTap={{ scale: 0.97 }}
                            className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border transition-all text-sm select-none"
                            style={{
                              background: checked ? '#ecfdf5' : '#f8fafc',
                              borderColor: checked ? '#10b981' : '#e2e8f0',
                              color: checked ? '#065f46' : '#334155',
                              fontWeight: checked ? 600 : 500,
                            }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => {
                                if (e.target.checked) setForm(f => ({ ...f, comodidades: [...(f.comodidades || []), a.nombre] }));
                                else setForm(f => ({ ...f, comodidades: (f.comodidades || []).filter(x => x !== a.nombre) }));
                              }}
                              className="accent-emerald-500 w-3.5 h-3.5 cursor-pointer flex-shrink-0" />
                            <span className="truncate">{a.nombre}</span>
                          </motion.label>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2.5 bg-slate-50/60 rounded-b-2xl flex-shrink-0">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors">
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors"
                  style={{ background: saving ? '#94a3b8' : '#1e293b' }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editando ? 'Guardar cambios' : 'Crear habitación'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal eliminar ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 320 }}
              className="bg-white rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">¿Eliminar habitación?</h3>
              <p className="text-sm text-slate-500 mb-6">
                Se eliminará <strong className="text-slate-700">{confirmDelete.nombre_habitacion}</strong>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2.5 justify-center">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setConfirmDelete(null)}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => void handleDelete(confirmDelete)}
                  disabled={deleting === confirmDelete.id_habitacion}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-colors"
                  style={{ background: deleting === confirmDelete.id_habitacion ? '#94a3b8' : '#ef4444' }}>
                  {deleting === confirmDelete.id_habitacion && <Loader2 size={13} className="animate-spin" />}
                  {deleting === confirmDelete.id_habitacion ? 'Eliminando…' : 'Eliminar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal calendario bloqueos ── */}
      <AnimatePresence>
        {selectedRoomForCalendar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setSelectedRoomForCalendar(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-2xl w-full max-w-[460px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Gestión de Disponibilidad</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedRoomForCalendar.nombre_habitacion}</p>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedRoomForCalendar(null)}
                  className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                  <X size={14} />
                </motion.button>
              </div>

              <div className="p-5">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-4">
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                    ◀
                  </motion.button>
                  <span className="text-sm font-semibold text-slate-800 capitalize">
                    {calendarMonth.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })}
                  </span>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                    className="w-8 h-8 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
                    ▶
                  </motion.button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => (
                    <span key={d} className="text-[10px] font-bold text-slate-400">{d}</span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                    const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
                    const first = new Date(year, month, 1), last = new Date(year, month+1, 0);
                    const days: { date: Date; current: boolean }[] = [];
                    for (let i = first.getDay(); i > 0; i--) days.push({ date: new Date(year, month, 1-i), current: false });
                    for (let i = 1; i <= last.getDate(); i++) days.push({ date: new Date(year, month, i), current: true });
                    return days.map((item, idx) => {
                      const key = toKey(item.date);
                      const blocked = bloqueos.some(b =>
                        b.id_habitacion === selectedRoomForCalendar.id_habitacion &&
                        key >= b.fecha_inicio?.split('T')[0] &&
                        key <= b.fecha_fin?.split('T')[0]
                      );
                      return (
                        <motion.div key={idx} whileTap={{ scale: 0.9 }}
                          onClick={() => item.current && void toggleBloqueoHabitacion(selectedRoomForCalendar.id_habitacion, key)}
                          className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all"
                          style={{
                            cursor: item.current ? 'pointer' : 'default',
                            opacity: item.current ? 1 : 0.3,
                            background: blocked ? '#fee2e2' : '#f8fafc',
                            border: blocked ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                            color: blocked ? '#dc2626' : '#334155',
                          }}>
                          <span>{item.date.getDate()}</span>
                          <span className="text-[9px] mt-0.5">{blocked ? '🔒' : ''}</span>
                        </motion.div>
                      );
                    });
                  })()}
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  Toca una fecha para alternar su disponibilidad. Las fechas en rojo están bloqueadas.
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setSelectedRoomForCalendar(null)}
                  className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl">
                  Cerrar
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Mini style tokens ────────────────────────────────────────────────────────

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 };
const inp = 'mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all';
const cnt: React.CSSProperties = { border: '1px solid #e2e8f0', borderRadius: 10, width: 30, height: 30, cursor: 'pointer', background: '#f8fafc', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' };
