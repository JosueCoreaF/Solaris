import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Wrench, Plus, X, Clock, AlertTriangle, CheckCircle2, Loader2,
  Trash2, RefreshCw, Calendar, User, AlertCircle, ChevronRight,
  BedDouble, StickyNote, Flame,
} from 'lucide-react';
import { DatePicker } from '../../components/DatePicker';
import apiClient from '../../services/api';
import { useRole } from '../../hooks/useRole';

type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
type Estado = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';

interface Habitacion {
  nombre_habitacion: string;
  codigo_habitacion: string;
  piso?: number;
}

interface Tarea {
  id_tarea: string;
  titulo: string;
  descripcion?: string;
  prioridad: Prioridad;
  estado: Estado;
  asignado_nombre?: string;
  creado_nombre?: string;
  fecha_limite?: string;
  completada_at?: string;
  notas?: string;
  created_at: string;
  habitaciones?: Habitacion;
}

interface RoomItem {
  id_habitacion: string;
  nombre_habitacion: string;
  codigo_habitacion: string;
  piso?: number;
  tipo?: string;
}

interface StaffUser {
  user_id: string;
  email: string;
  rol: string;
  estado: string;
  id_hotel?: string;
}

interface NuevaTareaForm {
  titulo: string;
  descripcion: string;
  prioridad: Prioridad;
  fecha_limite: string;
  asignado_nombre: string;
  asignado_a: string;
  id_habitacion: string;
}

const formVacio: NuevaTareaForm = {
  titulo: '',
  descripcion: '',
  prioridad: 'media',
  fecha_limite: '',
  asignado_nombre: '',
  asignado_a: '',
  id_habitacion: '',
};

const COLUMNAS: Estado[] = ['pendiente', 'en_progreso', 'completada'];

const P: Record<Prioridad, { label: string; color: string; light: string }> = {
  baja:    { label: 'Baja',    color: '#64748b', light: 'rgba(100,116,139,.1)' },
  media:   { label: 'Media',   color: '#2563eb', light: 'rgba(37,99,235,.1)'   },
  alta:    { label: 'Alta',    color: '#d97706', light: 'rgba(217,119,6,.1)'   },
  urgente: { label: 'Urgente', color: '#dc2626', light: 'rgba(220,38,38,.1)'   },
};

const COL: Record<Estado, { label: string; icon: React.FC<any>; accent: string; soft: string }> = {
  pendiente:   { label: 'Pendiente',   icon: Clock,        accent: '#94a3b8', soft: 'rgba(148,163,184,.07)' },
  en_progreso: { label: 'En Progreso', icon: Wrench,       accent: '#3b82f6', soft: 'rgba(59,130,246,.06)'  },
  completada:  { label: 'Completada',  icon: CheckCircle2, accent: '#10b981', soft: 'rgba(16,185,129,.06)'  },
  cancelada:   { label: 'Cancelada',   icon: X,            accent: '#ef4444', soft: 'rgba(239,68,68,.06)'   },
};

const SIGUIENTE: Record<Estado, Estado | null> = {
  pendiente: 'en_progreso', en_progreso: 'completada', completada: null, cancelada: null,
};

const SIGUIENTE_LABEL: Record<Estado, string> = {
  pendiente: 'Iniciar trabajo', en_progreso: 'Marcar completada', completada: '', cancelada: '',
};

// ── Sub-componentes pequeños ─────────────────────────────────────────────────

const FieldBlock: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label style={{
      fontSize: 10, fontWeight: 700, color: 'var(--muted)',
      textTransform: 'uppercase', letterSpacing: '.07em',
      display: 'block', marginBottom: 6, fontFamily: 'Outfit, sans-serif',
    }}>
      {label}
    </label>
    {children}
  </div>
);

// ── Componente principal ─────────────────────────────────────────────────────

export const MantenimientoPanel: React.FC = () => {
  const { role } = useRole();
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [habitacionesList, setHabitacionesList] = useState<RoomItem[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]     = useState<NuevaTareaForm>(formVacio);
  const [guardando, setGuardando] = useState(false);
  const [notasModal, setNotasModal] = useState<Tarea | null>(null);
  const [notasTexto, setNotasTexto] = useState('');
  const [moviendo, setMoviendo] = useState<string | null>(null);

  const puedeCrear   = ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA'].includes(role);
  const puedeEliminar = ['PROPIETARIO', 'ADMIN'].includes(role);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const hotelId = localStorage.getItem('active_hotel_id') || '';
      const [resTareas, resHabs, resStaff] = await Promise.allSettled([
        apiClient.get('/hotel/mantenimiento/tareas', { headers: { 'X-Hotel-ID': hotelId } }),
        apiClient.get('/hotel/habitaciones', { headers: { 'X-Hotel-ID': hotelId } }),
        apiClient.get('/roles/usuarios')
      ]);

      if (resTareas.status === 'fulfilled') {
        setTareas(Array.isArray(resTareas.value) ? resTareas.value : []);
      } else {
        throw new Error(resTareas.reason?.response?.data?.error || 'Error cargando tareas');
      }

      if (resHabs.status === 'fulfilled') {
        setHabitacionesList(Array.isArray(resHabs.value) ? resHabs.value : []);
      }

      if (resStaff.status === 'fulfilled') {
        setStaffList(Array.isArray(resStaff.value) ? resStaff.value : []);
      }
    } catch (e: any) {
      setError(e.message || 'Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (tarea: Tarea, nuevoEstado: Estado) => {
    setMoviendo(tarea.id_tarea);
    const hotelId = localStorage.getItem('active_hotel_id') || '';
    try {
      const updated = await apiClient.patch(
        `/hotel/mantenimiento/tareas/${tarea.id_tarea}`,
        { estado: nuevoEstado },
        { headers: { 'X-Hotel-ID': hotelId } },
      );
      setTareas(prev => prev.map(t => t.id_tarea === tarea.id_tarea ? updated : t));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error actualizando tarea');
    } finally {
      setMoviendo(null);
    }
  };

  const guardarNotas = async () => {
    if (!notasModal) return;
    const hotelId = localStorage.getItem('active_hotel_id') || '';
    try {
      const updated = await apiClient.patch(
        `/hotel/mantenimiento/tareas/${notasModal.id_tarea}`,
        { notas: notasTexto },
        { headers: { 'X-Hotel-ID': hotelId } },
      );
      setTareas(prev => prev.map(t => t.id_tarea === notasModal.id_tarea ? updated : t));
      setNotasModal(null);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error guardando notas');
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const hotelId = localStorage.getItem('active_hotel_id') || '';
    try {
      await apiClient.delete(`/hotel/mantenimiento/tareas/${id}`, {
        headers: { 'X-Hotel-ID': hotelId },
      });
      setTareas(prev => prev.filter(t => t.id_tarea !== id));
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error eliminando tarea');
    }
  };

  const crearTarea = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    const hotelId = localStorage.getItem('active_hotel_id') || '';
    try {
      const created = await apiClient.post(
        '/hotel/mantenimiento/tareas',
        {
          titulo: form.titulo,
          descripcion: form.descripcion || null,
          prioridad: form.prioridad,
          id_habitacion: form.id_habitacion || null,
          fecha_limite: form.fecha_limite || null,
          asignado_nombre: form.asignado_nombre || null,
          asignado_a: (form.asignado_a && form.asignado_a !== 'custom') ? form.asignado_a : null,
        },
        { headers: { 'X-Hotel-ID': hotelId } },
      );
      setTareas(prev => [created, ...prev]);
      setForm(formVacio);
      setModalOpen(false);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error creando tarea');
    } finally {
      setGuardando(false);
    }
  };

  const estaVencida = (t: Tarea) =>
    t.fecha_limite && t.estado !== 'completada' && t.estado !== 'cancelada'
      ? new Date(t.fecha_limite) < new Date()
      : false;

  const tareasPorColumna = (estado: Estado) => tareas.filter(t => t.estado === estado);

  const urgentes = tareas.filter(t => t.prioridad === 'urgente' && t.estado !== 'completada').length;
  const vencidas  = tareas.filter(t => estaVencida(t)).length;

  return (
    <>
      <style>{`
        @keyframes mnt-up {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes mnt-fade { from{opacity:0} to{opacity:1} }
        @keyframes mnt-card {
          from { opacity:0; transform:translateY(8px) scale(.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .mnt-card {
          animation: mnt-card .32s cubic-bezier(.22,1,.36,1) both;
          transition: transform .18s, box-shadow .18s;
        }
        .mnt-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px -6px rgba(15,23,42,.12) !important;
        }
        .mnt-advance {
          transition: background .15s, opacity .15s;
        }
        .mnt-advance:hover { background: rgba(37,99,235,.06) !important; opacity:1 !important; }
        .mnt-icon-btn { transition: background .14s; }
        .mnt-icon-btn:hover { background: var(--shell-border-subtle) !important; }
        .mnt-stat { transition: transform .2s, box-shadow .2s; }
        .mnt-stat:hover { transform:translateY(-2px); box-shadow:0 8px 22px -4px rgba(15,23,42,.09); }
        
        .mnt-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--shell-border-strong);
          background: var(--shell-panel-subtle);
          color: var(--text-h);
          font-size: 13.5px;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color .2s, box-shadow .2s, background-color .2s;
        }
        .mnt-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
          background: var(--shell-panel-strong);
        }
        .mnt-select {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 14px;
          padding-right: 36px;
        }
      `}</style>

      <div style={{ padding: '28px 40px', maxWidth: '100%', margin: '0 auto' }}>

        {/* ── Cabecera ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 28,
          animation: 'mnt-up .4s cubic-bezier(.22,1,.36,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37,99,235,.32)',
              flexShrink: 0,
            }}>
              <Wrench size={19} color="#fff" />
            </div>
            <div>
              <h1 style={{
                margin: 0, fontSize: 21, fontWeight: 800,
                fontFamily: 'Outfit, sans-serif', letterSpacing: '-.02em',
                color: 'var(--text-h)', lineHeight: 1,
              }}>
                Mantenimiento
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                Órdenes de trabajo e incidencias del hotel
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(urgentes > 0 || vencidas > 0) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20,
                background: 'rgba(220,38,38,.07)',
                border: '1px solid rgba(220,38,38,.2)',
                fontSize: 12, fontWeight: 600, color: '#dc2626',
              }}>
                <Flame size={12} />
                {urgentes > 0 && `${urgentes} urgente${urgentes !== 1 ? 's' : ''}`}
                {urgentes > 0 && vencidas > 0 && ' · '}
                {vencidas > 0 && `${vencidas} vencida${vencidas !== 1 ? 's' : ''}`}
              </div>
            )}
            <button
              onClick={cargar}
              className="mnt-icon-btn"
              style={{
                width: 36, height: 36, borderRadius: 9,
                border: '1px solid var(--shell-border-strong)',
                background: 'transparent', cursor: 'pointer', color: 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RefreshCw size={14} />
            </button>
            {puedeCrear && (
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  height: 36, padding: '0 16px', borderRadius: 9, border: 'none',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 10px rgba(37,99,235,.3)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                <Plus size={15} /> Nueva Tarea
              </button>
            )}
          </div>
        </div>

        {/* ── KPI strip ────────────────────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12, marginBottom: 28,
          animation: 'mnt-up .4s .05s cubic-bezier(.22,1,.36,1) both',
        }}>
          {COLUMNAS.map(col => {
            const meta = COL[col];
            const Icon = meta.icon;
            const count = tareasPorColumna(col).length;
            return (
              <div
                key={col}
                className="mnt-stat"
                style={{
                  padding: '16px 20px', borderRadius: 14,
                  background: 'var(--shell-panel-strong)',
                  border: '1px solid var(--shell-border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex', alignItems: 'center', gap: 14,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: meta.accent, borderRadius: '14px 14px 0 0',
                }} />
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: meta.soft,
                  border: `1px solid ${meta.accent}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={meta.accent} />
                </div>
                <div>
                  <div style={{
                    fontSize: 28, fontWeight: 800, lineHeight: 1,
                    color: 'var(--text-h)', fontFamily: 'Outfit, sans-serif',
                  }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                    {meta.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.15)',
            borderRadius: 12, padding: '12px 16px', marginBottom: 24,
            display: 'flex', gap: 10, alignItems: 'center',
            color: '#ef4444', fontSize: 13,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, padding: '80px 0', color: 'var(--muted)',
          }}>
            <Loader2 size={26} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 13 }}>Cargando órdenes de trabajo...</span>
          </div>
        ) : (
          /* ── Kanban ─────────────────────────────────────────────── */
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 18, alignItems: 'start',
            animation: 'mnt-up .4s .1s cubic-bezier(.22,1,.36,1) both',
          }}>
            {COLUMNAS.map(col => {
              const meta = COL[col];
              const Icon = meta.icon;
              const lista = tareasPorColumna(col);

              return (
                <div key={col}>
                  {/* Cabecera de columna */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10, padding: '0 2px',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 7,
                      background: meta.soft,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={13} color={meta.accent} />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: '.08em',
                      color: 'var(--muted)', fontFamily: 'Outfit, sans-serif',
                    }}>
                      {meta.label}
                    </span>
                    <div style={{
                      marginLeft: 'auto',
                      height: 20, minWidth: 20, padding: '0 6px', borderRadius: 6,
                      background: lista.length > 0 ? meta.soft : 'var(--shell-border-subtle)',
                      border: `1px solid ${lista.length > 0 ? meta.accent + '28' : 'transparent'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      color: lista.length > 0 ? meta.accent : 'var(--muted)',
                    }}>
                      {lista.length}
                    </div>
                  </div>

                  {/* Cuerpo de columna */}
                  <div style={{
                    borderRadius: 16, padding: 10, minHeight: 100,
                    background: meta.soft,
                    border: `1px solid ${meta.accent}18`,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {lista.length === 0 && (
                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 8, padding: '30px 16px', color: 'var(--muted)',
                      }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 10,
                          border: '1.5px dashed var(--shell-border-strong)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={14} color="var(--muted)" />
                        </div>
                        <span style={{ fontSize: 12 }}>Sin tareas</span>
                      </div>
                    )}

                    {lista.map((tarea, idx) => {
                      const pm      = P[tarea.prioridad];
                      const vencida = estaVencida(tarea);
                      const sig     = SIGUIENTE[tarea.estado];
                      const busy    = moviendo === tarea.id_tarea;

                      return (
                        <div
                          key={tarea.id_tarea}
                          className="mnt-card"
                          style={{
                            animationDelay: `${idx * 0.045}s`,
                            borderRadius: 12, overflow: 'hidden',
                            background: vencida ? 'rgba(255,241,241,.98)' : 'var(--shell-panel-strong)',
                            border: `1px solid ${vencida ? 'rgba(239,68,68,.2)' : 'var(--shell-border-subtle)'}`,
                            boxShadow: '0 2px 8px -2px rgba(15,23,42,.06)',
                            opacity: busy ? 0.55 : 1,
                            position: 'relative',
                          }}
                        >
                          {/* Acento lateral de prioridad */}
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                            background: pm.color,
                          }} />

                          {/* Contenido */}
                          <div style={{ padding: '12px 12px 12px 17px' }}>
                            {/* Fila superior: badge + acciones */}
                            <div style={{
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', marginBottom: 8,
                            }}>
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                padding: '3px 8px', borderRadius: 20,
                                background: pm.light, color: pm.color,
                                letterSpacing: '.04em', fontFamily: 'Outfit, sans-serif',
                              }}>
                                {pm.label}
                              </span>
                              <div style={{ display: 'flex', gap: 2 }}>
                                <button
                                  title="Notas"
                                  onClick={() => { setNotasModal(tarea); setNotasTexto(tarea.notas || ''); }}
                                  className="mnt-icon-btn"
                                  style={{
                                    width: 26, height: 26, borderRadius: 6,
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: 'var(--muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  <StickyNote size={12} />
                                </button>
                                {puedeEliminar && (
                                  <button
                                    onClick={() => eliminar(tarea.id_tarea)}
                                    className="mnt-icon-btn"
                                    style={{
                                      width: 26, height: 26, borderRadius: 6,
                                      background: 'transparent', border: 'none', cursor: 'pointer',
                                      color: 'var(--muted)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Título */}
                            <div style={{
                              fontWeight: 700, fontSize: 13.5, lineHeight: 1.35,
                              color: 'var(--text-h)', marginBottom: 6,
                              fontFamily: 'Outfit, sans-serif',
                            }}>
                              {tarea.titulo}
                            </div>

                            {/* Descripción */}
                            {tarea.descripcion && (
                              <div style={{
                                fontSize: 12, color: 'var(--muted)',
                                lineHeight: 1.5, marginBottom: 8,
                              }}>
                                {tarea.descripcion}
                              </div>
                            )}

                            {/* Metadata */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {tarea.habitaciones && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                                  <BedDouble size={10} />
                                  {tarea.habitaciones.nombre_habitacion}
                                  {tarea.habitaciones.piso ? ` · Piso ${tarea.habitaciones.piso}` : ''}
                                </span>
                              )}
                              {tarea.asignado_nombre && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                                  <User size={10} /> {tarea.asignado_nombre}
                                </span>
                              )}
                              {tarea.fecha_limite && (
                                <span style={{
                                  display: 'flex', alignItems: 'center', gap: 5,
                                  fontSize: 11,
                                  color: vencida ? '#dc2626' : 'var(--muted)',
                                  fontWeight: vencida ? 600 : 400,
                                }}>
                                  {vencida ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                                  {new Date(tarea.fecha_limite + 'T12:00:00').toLocaleDateString('es-HN', { day: 'numeric', month: 'short' })}
                                  {vencida && <span style={{ fontSize: 10 }}>· Vencida</span>}
                                </span>
                              )}
                            </div>

                            {/* Notas preview */}
                            {tarea.notas && (
                              <div style={{
                                marginTop: 10, fontSize: 11, color: 'var(--muted)',
                                background: 'rgba(15,23,42,.03)',
                                borderLeft: '2px solid var(--shell-border-strong)',
                                padding: '5px 9px', borderRadius: '0 7px 7px 0',
                                fontStyle: 'italic', lineHeight: 1.5,
                              }}>
                                {tarea.notas}
                              </div>
                            )}
                          </div>

                          {/* Botón avanzar */}
                          {sig && (
                            <button
                              onClick={() => cambiarEstado(tarea, sig)}
                              disabled={busy}
                              className="mnt-advance"
                              style={{
                                width: '100%', padding: '8px 14px',
                                borderTop: '1px solid var(--shell-border-subtle)',
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                opacity: 0.65, fontSize: 11, fontWeight: 700,
                                color: 'var(--accent)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                borderRadius: '0 0 12px 12px',
                                fontFamily: 'Outfit, sans-serif', letterSpacing: '.02em',
                              }}
                            >
                              {busy
                                ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Actualizando...</>
                                : <>{SIGUIENTE_LABEL[tarea.estado]} <ChevronRight size={11} /></>
                              }
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Modal Nueva Tarea ─────────────────────────────────────── */}
        {modalOpen && createPortal(
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(6px)',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
              padding: '40px 16px', overflowY: 'auto',
              animation: 'mnt-fade .2s ease',
            }}
            onClick={e => e.target === e.currentTarget && setModalOpen(false)}
          >
            <div style={{
              background: 'var(--shell-panel-strong)',
              border: '1px solid var(--shell-border-strong)',
              borderRadius: 20, width: '90%', maxWidth: 480,
              boxShadow: '0 24px 52px -10px rgba(15,23,42,.22)',
              animation: 'mnt-up .3s cubic-bezier(.22,1,.36,1)',
              margin: 'auto 0',
            }}>
              {/* Header modal */}
              <div style={{
                padding: '20px 24px 18px',
                borderBottom: '1px solid var(--shell-border-subtle)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: 'rgba(37,99,235,.08)',
                    border: '1px solid rgba(37,99,235,.14)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wrench size={15} color="var(--accent)" />
                  </div>
                  <div>
                    <div style={{
                      fontSize: 15, fontWeight: 800, color: 'var(--text-h)',
                      fontFamily: 'Outfit, sans-serif',
                    }}>
                      Nueva Orden de Trabajo
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                      Asigna y describe la tarea de mantenimiento
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="mnt-icon-btn"
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: '20px 24px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <FieldBlock label="Título *">
                    <input
                      value={form.titulo}
                      onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                      placeholder="ej. Reparar grifo del cuarto 101"
                      className="mnt-input"
                    />
                  </FieldBlock>
                  <FieldBlock label="Descripción">
                    <textarea
                      value={form.descripcion}
                      onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                      rows={3}
                      placeholder="Detalles adicionales sobre la tarea..."
                      className="mnt-input"
                      style={{ resize: 'vertical' }}
                    />
                  </FieldBlock>
                  <FieldBlock label="Habitación / Área (Opcional)">
                    <select
                      value={form.id_habitacion}
                      onChange={e => setForm(p => ({ ...p, id_habitacion: e.target.value }))}
                      className="mnt-input mnt-select"
                    >
                      <option value="" style={{ background: 'var(--shell-panel-strong)' }}>-- No aplica / Áreas comunes --</option>
                      {habitacionesList.map(h => (
                        <option key={h.id_habitacion} value={h.id_habitacion} style={{ background: 'var(--shell-panel-strong)' }}>
                          Habitación {h.nombre_habitacion} {h.piso ? `(Piso ${h.piso})` : ''} - {h.tipo || ''}
                        </option>
                      ))}
                    </select>
                  </FieldBlock>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FieldBlock label="Prioridad">
                      <select
                        value={form.prioridad}
                        onChange={e => setForm(p => ({ ...p, prioridad: e.target.value as Prioridad }))}
                        className="mnt-input mnt-select"
                      >
                        <option value="baja" style={{ background: 'var(--shell-panel-strong)' }}>Baja</option>
                        <option value="media" style={{ background: 'var(--shell-panel-strong)' }}>Media</option>
                        <option value="alta" style={{ background: 'var(--shell-panel-strong)' }}>Alta</option>
                        <option value="urgente" style={{ background: 'var(--shell-panel-strong)' }}>Urgente</option>
                      </select>
                    </FieldBlock>
                    <FieldBlock label="Fecha Límite">
                      <DatePicker
                        value={form.fecha_limite}
                        onChange={v => setForm(p => ({ ...p, fecha_limite: v }))}
                        placeholder="Sin fecha límite"
                        className="mnt-input"
                        style={{ minHeight: 38 }}
                      />
                    </FieldBlock>
                  </div>
                  <FieldBlock label="Asignar a">
                    {staffList.length > 0 ? (
                      <>
                        <select
                          value={form.asignado_a === 'custom' ? 'custom' : form.asignado_a}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setForm(p => ({ ...p, asignado_a: 'custom', asignado_nombre: '' }));
                            } else if (val === '') {
                              setForm(p => ({ ...p, asignado_a: '', asignado_nombre: '' }));
                            } else {
                              const user = staffList.find(u => u.user_id === val);
                              setForm(p => ({ ...p, asignado_a: val, asignado_nombre: user ? user.email : '' }));
                            }
                          }}
                          className="mnt-input mnt-select"
                          style={{ marginBottom: form.asignado_a === 'custom' ? 8 : 0 }}
                        >
                          <option value="" style={{ background: 'var(--shell-panel-strong)' }}>-- Sin asignar --</option>
                          {staffList.map(u => (
                            <option key={u.user_id} value={u.user_id} style={{ background: 'var(--shell-panel-strong)' }}>
                              {u.email} ({u.rol})
                            </option>
                          ))}
                          <option value="custom" style={{ background: 'var(--shell-panel-strong)' }}>Otro (escribir nombre)...</option>
                        </select>
                        {form.asignado_a === 'custom' && (
                          <input
                            value={form.asignado_nombre}
                            onChange={e => setForm(p => ({ ...p, asignado_nombre: e.target.value }))}
                            placeholder="Nombre del encargado"
                            className="mnt-input"
                          />
                        )}
                      </>
                    ) : (
                      <input
                        value={form.asignado_nombre}
                        onChange={e => setForm(p => ({ ...p, asignado_nombre: e.target.value, asignado_a: '' }))}
                        placeholder="Nombre del encargado"
                        className="mnt-input"
                      />
                    )}
                  </FieldBlock>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                  <button
                    onClick={() => setModalOpen(false)}
                    style={{
                      flex: 1, padding: 10, borderRadius: 10,
                      border: '1px solid var(--shell-border-strong)',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--muted)', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={crearTarea}
                    disabled={!form.titulo.trim() || guardando}
                    style={{
                      flex: 2, padding: 10, borderRadius: 10, border: 'none',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      opacity: (!form.titulo.trim() || guardando) ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 2px 10px rgba(37,99,235,.25)',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    {guardando
                      ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Creando...</>
                      : <><Plus size={14} /> Crear Orden</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Modal Notas ───────────────────────────────────────────── */}
        {notasModal && createPortal(
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(6px)',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
              padding: '40px 16px', overflowY: 'auto',
              animation: 'mnt-fade .2s ease',
            }}
            onClick={e => e.target === e.currentTarget && setNotasModal(null)}
          >
            <div style={{
              background: 'var(--shell-panel-strong)',
              border: '1px solid var(--shell-border-strong)',
              borderRadius: 20, width: '90%', maxWidth: 420, overflow: 'hidden',
              boxShadow: '0 24px 52px -10px rgba(15,23,42,.22)',
              animation: 'mnt-up .3s cubic-bezier(.22,1,.36,1)',
              margin: 'auto 0',
            }}>
              <div style={{
                padding: '18px 22px 16px',
                borderBottom: '1px solid var(--shell-border-subtle)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <StickyNote size={14} color="var(--muted)" />
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: 'var(--text-h)',
                      fontFamily: 'Outfit, sans-serif',
                    }}>
                      Notas
                    </div>
                    <div style={{
                      fontSize: 11, color: 'var(--muted)', marginTop: 1,
                      maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {notasModal.titulo}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setNotasModal(null)}
                  className="mnt-icon-btn"
                  style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
              <div style={{ padding: '18px 22px 22px' }}>
                <textarea
                  value={notasTexto}
                  onChange={e => setNotasTexto(e.target.value)}
                  rows={5}
                  autoFocus
                  placeholder="Observaciones, materiales usados, próximos pasos..."
                  className="mnt-input"
                  style={{ resize: 'vertical' }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    onClick={() => setNotasModal(null)}
                    style={{
                      flex: 1, padding: 9, borderRadius: 9,
                      border: '1px solid var(--shell-border-strong)',
                      background: 'transparent', cursor: 'pointer',
                      color: 'var(--muted)', fontSize: 13,
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarNotas}
                    style={{
                      flex: 2, padding: 9, borderRadius: 9, border: 'none',
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      fontFamily: 'Outfit, sans-serif',
                    }}
                  >
                    Guardar Notas
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </>
  );
};

export default MantenimientoPanel;
