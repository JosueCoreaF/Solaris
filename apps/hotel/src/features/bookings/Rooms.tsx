import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BedDouble, Plus, Pencil, X, Calendar } from 'lucide-react';
import { supabase } from '../../api/supabase';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || 'all';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (activeHotelId && activeHotelId !== 'all') {
    headers['X-Hotel-ID'] = activeHotelId;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hotel {
  id_hotel: string;
  nombre_hotel: string;
}

interface Habitacion {
  id_habitacion: string;
  nombre_habitacion: string;
  nombre_alias?: string;
  tipo: string;
  capacidad: number;
  tarifa_noche: number;
  estado: 'disponible' | 'ocupada' | 'mantenimiento' | 'fuera_servicio';
  piso: number;
  id_hotel: string;
  numero_camas: number;
  hotel?: string;
  imagenes?: string[];
  imagen_360?: string | null;
  comodidades?: string[];
}

type HabForm = Omit<Habitacion, 'id_habitacion' | 'hotel'> & {
  imagen_360: string;
  comodidades: string[];
};

const ESTADOS: Habitacion['estado'][] = ['disponible', 'ocupada', 'mantenimiento', 'fuera_servicio'];

const ESTADO_LABELS: Record<Habitacion['estado'], string> = {
  disponible: 'Disponible',
  ocupada: 'Ocupada',
  mantenimiento: 'Mantenimiento',
  fuera_servicio: 'Fuera de servicio',
};

const ESTADO_COLORS: Record<Habitacion['estado'], string> = {
  disponible: '#22c55e',
  ocupada: '#3b82f6',
  mantenimiento: '#f97316',
  fuera_servicio: '#ef4444',
};


function emptyForm(hotelId: string, primerTipo = ''): HabForm {
  return {
    nombre_habitacion: '',
    nombre_alias: '',
    tipo: primerTipo,
    capacidad: 2,
    tarifa_noche: 0,
    estado: 'disponible',
    piso: 1,
    id_hotel: hotelId,
    numero_camas: 1,
    imagenes: [],
    imagen_360: '',
    comodidades: [],
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const Rooms: React.FC = () => {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [hoteles, setHoteles] = useState<Hotel[]>([]);
  const [tiposHabitacion, setTiposHabitacion] = useState<{ id: string; nombre: string }[]>([]);
  const [amenidades, setAmenidades] = useState<{ id: string; nombre: string; icono: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filtroHotel, setFiltroHotel] = useState(() => {
    const active = localStorage.getItem('active_hotel_id');
    return (active && active !== 'all') ? active : 'todos';
  });
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Habitacion | null>(null);
  const [form, setForm] = useState<HabForm>(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Habitacion | null>(null);
  const [uploading360, setUploading360] = useState(false);

  // Bloqueos state & calendar modal
  const [bloqueos, setBloqueos] = useState<any[]>([]);
  const [selectedRoomForCalendar, setSelectedRoomForCalendar] = useState<Habitacion | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // ── Upload 360 Image ──
  async function handleUpload360(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading360(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `habitaciones/360_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const bucketName = import.meta.env.VITE_MEDIA_BUCKET || 'hotel-verona-media';

      // Subir archivo al bucket de Supabase
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('No se pudo generar la URL pública del archivo.');
      }

      setForm(f => ({ ...f, imagen_360: urlData.publicUrl }));
      showToast('Imagen panorámica 360° subida con éxito.');
    } catch (err: any) {
      showToast(`Error al subir imagen: ${err.message}`, 'err');
    } finally {
      setUploading360(false);
    }
  }

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rangeStart = '2025-01-01';
      const rangeEnd = '2027-12-31';
      const [habs, hots, bloq, tipos, amenRes] = await Promise.all([
        apiFetch<Habitacion[]>('/bookings/habitaciones'),
        apiFetch<Hotel[]>('/bookings/hoteles'),
        apiFetch<any[]>(`/bookings/bloqueos?desde=${rangeStart}&hasta=${rangeEnd}`),
        apiFetch<{ id: string; nombre: string }[]>('/config/tipos-habitacion'),
        apiFetch<{ data: { id: string; nombre: string; icono: string }[] }>('/config/servicios'),
      ]);
      setHabitaciones(habs);
      setHoteles(hots);
      setBloqueos(bloq || []);
      setTiposHabitacion(tipos || []);
      setAmenidades((amenRes as any)?.data || (Array.isArray(amenRes) ? amenRes : []));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar habitaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleBloqueoHabitacion(idHabitacion: string, fechaStr: string) {
    try {
      const res = await apiFetch<{ success: boolean; action: 'added' | 'removed'; data?: any }>('/bookings/bloqueos/toggle', {
        method: 'POST',
        body: JSON.stringify({ id_habitacion: idHabitacion, fecha: fechaStr }),
      });
      if (res.success) {
        showToast(res.action === 'added' ? 'Habitación bloqueada con éxito.' : 'Habitación habilitada con éxito.');
        const bloq = await apiFetch<any[]>(`/bookings/bloqueos?desde=2025-01-01&hasta=2027-12-31`);
        setBloqueos(bloq || []);
      }
    } catch (err: any) {
      showToast(err.message ?? 'Error al cambiar la disponibilidad', 'err');
    }
  }

  useEffect(() => { void load(); }, [load]);

  // ── Filtered list ──
  const lista = habitaciones.filter(h => {
    if (filtroHotel !== 'todos' && h.id_hotel !== filtroHotel) return false;
    if (filtroEstado !== 'todos' && h.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const matchNombre = h.nombre_habitacion.toLowerCase().includes(q);
      const matchAlias = (h.nombre_alias ?? '').toLowerCase().includes(q);
      if (!matchNombre && !matchAlias) return false;
    }
    return true;
  });

  // ── Open modal ──
  function abrirNueva() {
    setEditando(null);
    const active = localStorage.getItem('active_hotel_id');
    const defaultHotelId = (active && active !== 'all') ? active : (hoteles[0]?.id_hotel ?? '');
    setForm(emptyForm(defaultHotelId, tiposHabitacion[0]?.nombre ?? ''));
    setModalOpen(true);
  }

  function abrirEditar(h: Habitacion) {
    setEditando(h);
    setForm({
      nombre_habitacion: h.nombre_habitacion,
      nombre_alias: h.nombre_alias ?? '',
      tipo: tiposHabitacion.find(t => t.nombre.toLowerCase() === (h.tipo ?? '').toLowerCase())?.nombre ?? h.tipo ?? '',
      capacidad: h.capacidad,
      tarifa_noche: h.tarifa_noche,
      estado: h.estado,
      piso: h.piso,
      id_hotel: h.id_hotel,
      numero_camas: h.numero_camas,
      imagenes: h.imagenes || [],
      imagen_360: h.imagen_360 || '',
      comodidades: h.comodidades || [],
    });
    setModalOpen(true);
  }

  // ── Save ──
  async function handleSave() {
    if (!form.nombre_habitacion.trim()) { showToast('El nombre es obligatorio.', 'err'); return; }
    if (!form.id_hotel) { showToast('Selecciona un hotel.', 'err'); return; }
    if (form.tarifa_noche <= 0) { showToast('La tarifa debe ser mayor a 0.', 'err'); return; }
    setSaving(true);
    try {
      const payload = {
        nombre_habitacion: form.nombre_habitacion.trim(),
        nombre_alias: (form.nombre_alias ?? '').trim() || null,
        tipo: form.tipo,
        capacidad: form.capacidad,
        tarifa_noche: form.tarifa_noche,
        estado: form.estado,
        piso: form.piso,
        id_hotel: form.id_hotel,
        numero_camas: form.numero_camas,
        imagenes: form.imagenes,
        imagen_360: form.imagen_360.trim() || null,
        comodidades: form.comodidades,
      };
      if (editando) {
        await apiFetch(`/bookings/habitaciones/${editando.id_habitacion}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        showToast('Habitación actualizada.');
      } else {
        await apiFetch('/bookings/habitaciones', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Habitación creada.');
      }
      setModalOpen(false);
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar.', 'err');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
  async function handleDelete(h: Habitacion) {
    setDeleting(h.id_habitacion);
    try {
      await apiFetch(`/bookings/habitaciones/${h.id_habitacion}`, { method: 'DELETE' });
      showToast('Habitación eliminada.');
      setConfirmDelete(null);
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al eliminar.', 'err');
    } finally {
      setDeleting(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', borderRadius: 8, padding: '10px 18px',
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px #0003',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">OPERATIVOS</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-light text-gray-900 flex items-center gap-3">
            <BedDouble size={30} className="text-gray-400" />
            Habitaciones
          </h1>
          <button
            onClick={abrirNueva}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} />
            Nueva habitación
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 flex flex-wrap gap-3 border-b border-gray-50">
        <input
          type="text"
          placeholder="Buscar habitación..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[200px]"
        />
        <select
          value={filtroHotel}
          onChange={e => setFiltroHotel(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={localStorage.getItem('active_hotel_id') !== 'all'}
        >
          <option value="todos">Todos los hoteles</option>
          {hoteles.map(h => <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>)}
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
        </select>
        <span className="text-xs text-gray-400 self-center ml-auto">
          {lista.length} habitación{lista.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="text-center text-gray-400 py-20 text-sm">Cargando habitaciones…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-20 text-sm">{error}</div>
        ) : lista.length === 0 ? (
          <div className="text-center py-20">
            <BedDouble size={40} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-sm mb-4">
              {habitaciones.length === 0 ? 'Aún no hay habitaciones registradas.' : 'No hay habitaciones con ese filtro.'}
            </p>
            {habitaciones.length === 0 && (
              <button
                onClick={abrirNueva}
                className="inline-flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                <Plus size={15} />
                Crear primera habitación
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {lista.map(h => (
              <div
                key={h.id_habitacion}
                style={{
                  border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
                  background: '#fff', boxShadow: '0 1px 4px #0001',
                }}
              >
                {/* Color stripe */}
                <div style={{ height: 4, background: ESTADO_COLORS[h.estado] }} />

                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: 0 }}>{h.nombre_habitacion}</h3>
                      {h.nombre_alias && (
                        <p style={{ fontSize: 12, color: '#6366f1', margin: '2px 0 0', fontStyle: 'italic' }}>"{h.nombre_alias}"</p>
                      )}
                      {h.hotel && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{h.hotel}</p>}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      background: ESTADO_COLORS[h.estado] + '22',
                      color: ESTADO_COLORS[h.estado],
                      border: `1px solid ${ESTADO_COLORS[h.estado]}44`,
                      whiteSpace: 'nowrap',
                    }}>
                      {ESTADO_LABELS[h.estado]}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                    <span><strong style={{ color: '#334155' }}>Tipo:</strong> {h.tipo}</span>
                    <span><strong style={{ color: '#334155' }}>Piso:</strong> {h.piso}</span>
                    <span><strong style={{ color: '#334155' }}>Capacidad:</strong> {h.capacidad} pers.</span>
                    <span><strong style={{ color: '#334155' }}>Camas:</strong> {h.numero_camas}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                      L {Number(h.tarifa_noche).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8', marginLeft: 3 }}>/noche</span>
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => setSelectedRoomForCalendar(h)}
                        style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', background: '#f1f5f9', color: '#475569', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Calendar size={12} /> Bloqueos
                      </button>
                      <button
                        onClick={() => abrirEditar(h)}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', background: '#fff', color: '#64748b', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(h)}
                        style={{ border: '1px solid #fca5a5', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', background: '#fff', color: '#ef4444', fontSize: 12 }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal crear/editar ── */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px #0005', overflow: 'hidden' }}
          >
            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: 0 }}>
                {editando ? 'Editar habitación' : 'Nueva habitación'}
              </h3>
              <button onClick={() => setModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Nombre */}
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Nombre interno *</div>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej. Suite 101"
                  value={form.nombre_habitacion}
                  onChange={e => setForm(f => ({ ...f, nombre_habitacion: e.target.value }))}
                />
              </label>

              {/* Alias público */}
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Alias público <span style={{ color: '#94a3b8', fontWeight: 400 }}>(nombre visible para el cliente)</span></div>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Ej. La Cabaña del Río"
                  value={form.nombre_alias ?? ''}
                  onChange={e => setForm(f => ({ ...f, nombre_alias: e.target.value }))}
                />
              </label>

              {/* Hotel */}
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Hotel *</div>
                {hoteles.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#f97316', padding: '8px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
                    No hay hoteles registrados. Crea uno primero en Configuración.
                  </div>
                ) : (
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    value={form.id_hotel}
                    onChange={e => setForm(f => ({ ...f, id_hotel: e.target.value }))}
                    disabled={localStorage.getItem('active_hotel_id') !== 'all'}
                  >
                    <option value="">Selecciona hotel</option>
                    {hoteles.map(h => <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>)}
                  </select>
                )}
              </label>

              {/* Tipo */}
              <label>
                <div style={labelStyle}>Tipo</div>
                {tiposHabitacion.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#f97316', padding: '8px 12px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>No hay tipos creados. Crea uno primero en Configuración.</div>
                ) : (
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  >
                    {tiposHabitacion.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                  </select>
                )}
              </label>

              {/* Estado */}
              <label>
                <div style={labelStyle}>Estado</div>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.estado}
                  onChange={e => setForm(f => ({ ...f, estado: e.target.value as Habitacion['estado'] }))}
                >
                  {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABELS[e]}</option>)}
                </select>
              </label>

              {/* Tarifa */}
              <label>
                <div style={labelStyle}>Tarifa / noche (HNL) *</div>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.tarifa_noche || ''}
                  onChange={e => setForm(f => ({ ...f, tarifa_noche: Math.max(0, Number(e.target.value) || 0) }))}
                />
              </label>

              {/* Piso */}
              <label>
                <div style={labelStyle}>Piso</div>
                <input
                  type="number"
                  min={0}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.piso}
                  onChange={e => setForm(f => ({ ...f, piso: Math.max(0, parseInt(e.target.value) || 0) }))}
                />
              </label>

              {/* Capacidad */}
              <label>
                <div style={labelStyle}>Capacidad (personas)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, capacidad: Math.max(1, f.capacidad - 1) }))} style={counterBtn}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{form.capacidad}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, capacidad: f.capacidad + 1 }))} style={counterBtn}>+</button>
                </div>
              </label>

              {/* Camas */}
              <label>
                <div style={labelStyle}>Número de camas</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, numero_camas: Math.max(1, f.numero_camas - 1) }))} style={counterBtn}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{form.numero_camas}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, numero_camas: f.numero_camas + 1 }))} style={counterBtn}>+</button>
                </div>
              </label>

              {/* Imagen 360 */}
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Imagen Panorámica 360° (Recorrido Virtual)</div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 8px 0' }}>
                  Sube una foto panorámica equirectangular (360) o introduce una URL compatible.
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="https://ejemplo.com/imagenes/mi_habitacion_360.jpg"
                    value={form.imagen_360 || ''}
                    onChange={e => setForm(f => ({ ...f, imagen_360: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <div style={{ position: 'relative' }}>
                    <input
                      type="file"
                      id="upload-360"
                      accept="image/*"
                      onChange={handleUpload360}
                      disabled={uploading360}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: uploading360 ? 'not-allowed' : 'pointer',
                        width: '100%',
                        height: '100%',
                      }}
                    />
                    <button
                      type="button"
                      style={{
                        background: uploading360 ? '#f1f5f9' : '#10b981',
                        color: uploading360 ? '#94a3b8' : '#fff',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: uploading360 ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                        boxShadow: uploading360 ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      {uploading360 ? (
                        <>⌛ Subiendo...</>
                      ) : (
                        <>📁 Subir Foto</>
                      )}
                    </button>
                  </div>
                </div>
              </label>

              {/* URLs de imágenes */}
              <label style={{ gridColumn: '1 / -1' }}>
                <div style={labelStyle}>Imágenes de la habitación (URLs)</div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 4px 0' }}>Agrega una URL por línea. Estas imágenes se mostrarán en el portal de clientes.</p>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="https://ejemplo.com/foto1.jpg&#10;https://ejemplo.com/foto2.jpg"
                  rows={3}
                  value={(form.imagenes || []).join('\n')}
                  onChange={e => setForm(f => ({ ...f, imagenes: e.target.value.split('\n').map(u => u.trim()).filter(Boolean) }))}
                />
              </label>

              {/* Amenidades */}
              <div style={{ gridColumn: '1 / -1', marginTop: 10 }}>
                <div style={labelStyle}>Servicios de la Habitación</div>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 12px 0' }}>
                  Selecciona los servicios que incluye esta habitación.
                </p>
                {amenidades.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#f97316', padding: '10px 14px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
                    Sin servicios configurados. Agrégalos en <strong>Configuración &gt; Servicios</strong>.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    {amenidades.map(a => {
                      const checked = (form.comodidades || []).includes(a.nombre);
                      return (
                        <label
                          key={a.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 12px', background: checked ? '#ecfdf5' : '#fff', border: checked ? '1px solid #10b981' : '1px solid #e2e8f0', borderRadius: 8, transition: 'all 0.2s', fontSize: 13, fontWeight: checked ? 600 : 500, color: checked ? '#065f46' : '#334155', userSelect: 'none' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) {
                                setForm(f => ({ ...f, comodidades: [...(f.comodidades || []), a.nombre] }));
                              } else {
                                setForm(f => ({ ...f, comodidades: (f.comodidades || []).filter(x => x !== a.nombre) }));
                              }
                            }}
                            style={{ accentColor: '#10b981', cursor: 'pointer', width: 16, height: 16 }}
                          />
                          <span>{a.nombre}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fafafa' }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving}
                style={{ padding: '8px 18px', fontSize: 13, background: saving ? '#94a3b8' : '#1e293b', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontWeight: 600 }}
              >
                {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear habitación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminación ── */}
      {confirmDelete && (
        <div
          style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirmDelete(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px #0005', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>¿Eliminar habitación?</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
              Se eliminará <strong>{confirmDelete.nombre_habitacion}</strong>. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', background: '#fff', color: '#64748b', fontSize: 13 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDelete(confirmDelete)}
                disabled={deleting === confirmDelete.id_habitacion}
                style={{ padding: '8px 20px', background: deleting === confirmDelete.id_habitacion ? '#94a3b8' : '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                {deleting === confirmDelete.id_habitacion ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal de Calendario de Bloqueos ── */}
      {selectedRoomForCalendar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            {/* Cabecera */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Gestión de Disponibilidad</h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>Habitación: <strong>{selectedRoomForCalendar.nombre_habitacion}</strong></span>
              </div>
              <button
                onClick={() => setSelectedRoomForCalendar(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido / Calendario */}
            <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
              {/* Selector de Mes */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button
                  onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}
                >
                  ◀
                </button>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', textTransform: 'capitalize' }}>
                  {calendarMonth.toLocaleDateString('es-HN', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', background: '#fff', cursor: 'pointer', fontSize: 13 }}
                >
                  ▶
                </button>
              </div>

              {/* Días de la semana */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 8 }}>
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                  <span key={d} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{d}</span>
                ))}
              </div>

              {/* Cuadrícula de días */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {(() => {
                  const toDateKey = (date: Date) => {
                    const y = date.getFullYear();
                    const m = String(date.getMonth() + 1).padStart(2, '0');
                    const d = String(date.getDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                  };

                  const getCalendarDays = () => {
                    const year = calendarMonth.getFullYear();
                    const month = calendarMonth.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);

                    const days = [];
                    const startOffset = firstDay.getDay();
                    for (let i = startOffset; i > 0; i--) {
                      const d = new Date(year, month, 1 - i);
                      days.push({ date: d, isCurrentMonth: false });
                    }

                    const totalDays = lastDay.getDate();
                    for (let i = 1; i <= totalDays; i++) {
                      const d = new Date(year, month, i);
                      days.push({ date: d, isCurrentMonth: true });
                    }
                    return days;
                  };

                  return getCalendarDays().map((item, idx) => {
                    const key = toDateKey(item.date);
                    const isBlocked = bloqueos.some(b =>
                      b.id_habitacion === selectedRoomForCalendar.id_habitacion &&
                      key >= b.fecha_inicio.split('T')[0] &&
                      key <= b.fecha_fin.split('T')[0]
                    );

                    return (
                      <div
                        key={idx}
                        onClick={() => void toggleBloqueoHabitacion(selectedRoomForCalendar.id_habitacion, key)}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          fontSize: 13,
                          fontWeight: item.isCurrentMonth ? 600 : 400,
                          opacity: item.isCurrentMonth ? 1 : 0.4,
                          background: isBlocked
                            ? 'repeating-linear-gradient(45deg, #fee2e2 0, #fee2e2 4px, #fecaca 4px, #fecaca 8px)'
                            : '#f8fafc',
                          border: isBlocked ? '1px solid #ef4444' : '1px solid #e2e8f0',
                          color: isBlocked ? '#dc2626' : '#334155',
                          transition: 'all 0.15s',
                        }}
                        title={isBlocked ? 'Bloqueada - Toca para Habilitar' : 'Disponible - Toca para Bloquear'}
                      >
                        <span>{item.date.getDate()}</span>
                        <span style={{ fontSize: 9, marginTop: 2 }}>{isBlocked ? '🔒' : '🔓'}</span>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Leyenda e instrucciones */}
              <div style={{ marginTop: 20, padding: 12, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                <p style={{ margin: '0 0 6px 0', fontWeight: 600, color: '#475569' }}>💡 Instrucciones:</p>
                <p style={{ margin: 0 }}>Toca cualquier fecha para alternar su disponibilidad. Las fechas marcadas con rayas rojas y 🔒 están <strong>bloqueadas</strong> y no permitirán reservas en el sistema.</p>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <button
                onClick={() => setSelectedRoomForCalendar(null)}
                style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Shared mini styles ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#64748b', marginBottom: 4,
};

const counterBtn: React.CSSProperties = {
  border: '1px solid #e2e8f0', borderRadius: 8, width: 30, height: 30,
  cursor: 'pointer', background: '#fff', fontSize: 16, display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};
