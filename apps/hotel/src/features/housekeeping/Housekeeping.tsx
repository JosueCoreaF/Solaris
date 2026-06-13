import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles, BedDouble, Wrench, Lock, CheckCircle2, Clock,
  RefreshCw, AlertCircle, Loader2, ChevronDown, Filter,
} from 'lucide-react';
import apiClient from '../../services/api';

type EstadoHab = 'disponible' | 'ocupada' | 'mantenimiento' | 'bloqueada' | 'limpieza';

interface Habitacion {
  id_habitacion: string;
  nombre_habitacion: string;
  nombre_alias?: string;
  codigo_habitacion: string;
  piso?: number;
  estado: EstadoHab;
  tipo?: string;
  capacidad?: number;
}

const ESTADO_META: Record<EstadoHab, { label: string; icon: React.FC<any>; color: string; bg: string; border: string }> = {
  disponible:   { label: 'Disponible',    icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,.08)',  border: 'rgba(16,185,129,.25)' },
  limpieza:     { label: 'En Limpieza',   icon: Sparkles,     color: '#f59e0b', bg: 'rgba(245,158,11,.08)',  border: 'rgba(245,158,11,.3)' },
  mantenimiento:{ label: 'Mantenimiento', icon: Wrench,       color: '#3b82f6', bg: 'rgba(59,130,246,.08)',  border: 'rgba(59,130,246,.25)' },
  ocupada:      { label: 'Ocupada',       icon: BedDouble,    color: '#8b5cf6', bg: 'rgba(139,92,246,.08)',  border: 'rgba(139,92,246,.25)' },
  bloqueada:    { label: 'Bloqueada',     icon: Lock,         color: '#ef4444', bg: 'rgba(239,68,68,.08)',   border: 'rgba(239,68,68,.25)' },
};

const TRANSICIONES: Partial<Record<EstadoHab, EstadoHab[]>> = {
  limpieza:     ['disponible', 'mantenimiento'],
  mantenimiento:['disponible', 'limpieza'],
  disponible:   ['limpieza', 'mantenimiento', 'bloqueada'],
};

export const Housekeeping: React.FC = () => {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<EstadoHab | 'todos'>('todos');
  const [actualizando, setActualizando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hotelId = localStorage.getItem('active_hotel_id') || '';
      const { data } = await apiClient.get('/hotel/habitaciones', {
        headers: { 'X-Hotel-ID': hotelId },
      });
      setHabitaciones(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Error cargando habitaciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarEstado = async (hab: Habitacion, nuevoEstado: EstadoHab) => {
    setActualizando(hab.id_habitacion);
    const hotelId = localStorage.getItem('active_hotel_id') || '';
    try {
      await apiClient.put(
        `/hotel/habitaciones/${hab.id_habitacion}`,
        { estado: nuevoEstado },
        { headers: { 'X-Hotel-ID': hotelId } },
      );
      setHabitaciones(prev =>
        prev.map(h => h.id_habitacion === hab.id_habitacion ? { ...h, estado: nuevoEstado } : h)
      );

      // Al marcar la habitación en mantenimiento, crear automáticamente una
      // orden de trabajo para que aparezca en el panel de Mantenimiento,
      // salvo que ya tenga una pendiente/en progreso (evita duplicados al
      // alternar el estado de la habitación varias veces).
      if (nuevoEstado === 'mantenimiento') {
        try {
          const tareasExistentes = await apiClient.get(
            `/hotel/mantenimiento/tareas?id_habitacion=${hab.id_habitacion}`,
            { headers: { 'X-Hotel-ID': hotelId } },
          );
          const tieneOrdenAbierta = Array.isArray(tareasExistentes) &&
            tareasExistentes.some((t: any) => t.estado === 'pendiente' || t.estado === 'en_progreso');

          if (!tieneOrdenAbierta) {
            await apiClient.post(
              '/hotel/mantenimiento/tareas',
              {
                titulo: `Mantenimiento - Habitación ${hab.nombre_habitacion}`,
                id_habitacion: hab.id_habitacion,
                prioridad: 'media',
              },
              { headers: { 'X-Hotel-ID': hotelId } },
            );
          }
        } catch (e) {
          console.error('Error creando orden de mantenimiento automática:', e);
        }
      }

      // Al marcar la habitación como disponible, se asume que cualquier
      // trabajo de mantenimiento pendiente para esa habitación ya se resolvió.
      if (nuevoEstado === 'disponible') {
        try {
          const tareasExistentes = await apiClient.get(
            `/hotel/mantenimiento/tareas?id_habitacion=${hab.id_habitacion}`,
            { headers: { 'X-Hotel-ID': hotelId } },
          );
          const abiertas = Array.isArray(tareasExistentes)
            ? tareasExistentes.filter((t: any) => t.estado === 'pendiente' || t.estado === 'en_progreso')
            : [];

          for (const tarea of abiertas) {
            await apiClient.patch(
              `/hotel/mantenimiento/tareas/${tarea.id_tarea}`,
              { estado: 'completada' },
              { headers: { 'X-Hotel-ID': hotelId } },
            );
          }
        } catch (e) {
          console.error('Error completando órdenes de mantenimiento:', e);
        }
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error actualizando estado');
    } finally {
      setActualizando(null);
    }
  };

  const habsFiltradas = filtroEstado === 'todos'
    ? habitaciones
    : habitaciones.filter(h => h.estado === filtroEstado);

  const pisos = Array.from(new Set(habitaciones.map(h => h.piso ?? 0))).sort((a, b) => a - b);

  const conteo = (estado: EstadoHab) => habitaciones.filter(h => h.estado === estado).length;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="var(--accent)" />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-h)' }}>
              Housekeeping
            </h1>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Estado de limpieza y disponibilidad por habitación
          </p>
        </div>
        <button
          onClick={cargar}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--shell-border-strong)', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Resumen de estados */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {(Object.keys(ESTADO_META) as EstadoHab[]).map(est => {
          const meta = ESTADO_META[est];
          const Icon = meta.icon;
          const n = conteo(est);
          return (
            <button
              key={est}
              onClick={() => setFiltroEstado(filtroEstado === est ? 'todos' : est)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 20,
                border: `1px solid ${filtroEstado === est ? meta.border : 'var(--shell-border-subtle)'}`,
                background: filtroEstado === est ? meta.bg : 'transparent',
                cursor: 'pointer', fontSize: 12, fontWeight: 600, color: filtroEstado === est ? meta.color : 'var(--muted)',
                transition: 'all .15s ease',
              }}
            >
              <Icon size={13} />
              {meta.label}
              <span style={{ fontWeight: 700 }}>{n}</span>
            </button>
          );
        })}
        {filtroEstado !== 'todos' && (
          <button
            onClick={() => setFiltroEstado('todos')}
            style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid var(--shell-border-subtle)', background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}
          >
            Ver todas
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center', color: '#ef4444', fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 13 }}>Cargando habitaciones...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {pisos.map(piso => {
            const habsPiso = habsFiltradas.filter(h => (h.piso ?? 0) === piso);
            if (habsPiso.length === 0) return null;
            return (
              <div key={piso}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 10, paddingLeft: 2 }}>
                  {piso === 0 ? 'Sin Piso' : `Piso ${piso}`}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {habsPiso.map(hab => {
                    const meta = ESTADO_META[hab.estado];
                    const Icon = meta.icon;
                    const transiciones = TRANSICIONES[hab.estado] || [];
                    const cargando = actualizando === hab.id_habitacion;
                    return (
                      <div
                        key={hab.id_habitacion}
                        style={{
                          padding: '14px 16px',
                          borderRadius: 12,
                          border: `1px solid ${meta.border}`,
                          background: meta.bg,
                          position: 'relative',
                          transition: 'all .15s ease',
                        }}
                      >
                        {cargando && (
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: meta.color }} />
                          </div>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Icon size={16} color={meta.color} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            {meta.label}
                          </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-h)', marginBottom: 2 }}>
                          {hab.nombre_habitacion}
                        </div>
                        {hab.nombre_alias && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{hab.nombre_alias}</div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: hab.tipo ? 4 : 0 }}>
                          #{hab.codigo_habitacion}
                        </div>
                        {hab.tipo && (
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{hab.tipo}</div>
                        )}

                        {/* Botones de transición */}
                        {transiciones.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
                            {transiciones.map(sig => {
                              const sigMeta = ESTADO_META[sig];
                              const SigIcon = sigMeta.icon;
                              return (
                                <button
                                  key={sig}
                                  onClick={() => cambiarEstado(hab, sig)}
                                  disabled={!!actualizando}
                                  style={{
                                    padding: '5px 10px', borderRadius: 7, border: `1px solid ${sigMeta.border}`,
                                    background: sigMeta.bg, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                    color: sigMeta.color, display: 'flex', alignItems: 'center', gap: 5,
                                    opacity: actualizando ? .6 : 1, transition: 'all .12s',
                                  }}
                                >
                                  <SigIcon size={11} /> Marcar {sigMeta.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {habsFiltradas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
              No hay habitaciones con este estado.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Housekeeping;
