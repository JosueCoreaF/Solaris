import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../services/api';
import { DateRangePicker } from '../../components/DatePicker';
import { useToast } from '../../components/Toast';

interface RoomTypeOption {
  id: string;
  nombre: string;
  precio_base: number;
}

interface AvailabilityInfo {
  totalHabitaciones: number;
  fechasNoDisponibles: string[];
  disponiblesPorNoche: Record<string, number>;
  tarifaNoche: number;
  capacidadBase?: number;
}

interface FormRoomItem {
  id_tipo_habitacion?: string;
  check_in?: string;
  check_out?: string;
}

interface RoomAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sel: {
    id_tipo_habitacion: string;
    descripcion: string;
    check_in: string;
    check_out: string;
    precio_unitario: number;
    adultos: number;
    ninos: number;
  }) => void;
  roomTypes: RoomTypeOption[];
  activeHotelId: string;
  todayStr: string;
  cargoPersonaExtraRate?: number;
  /** Ítems de habitación ya agregados en el formulario (para descontar disponibilidad) */
  currentItems?: FormRoomItem[];
  /** Índice del ítem que se está editando (para excluirlo del descuento) */
  editingIdx?: number | null;
  initial?: {
    id_tipo_habitacion?: string;
    check_in?: string;
    check_out?: string;
    adultos?: number;
    ninos?: number;
  };
}

// Ventana de consulta de disponibilidad: hoy + 6 meses. Suficiente para que
// el cliente elija fechas razonablemente cercanas sin sobrecargar la consulta.
const VENTANA_DIAS = 180;

export const RoomAvailabilityModal: React.FC<RoomAvailabilityModalProps> = ({
  isOpen, onClose, onConfirm, roomTypes, activeHotelId, todayStr, cargoPersonaExtraRate = 0, currentItems = [], editingIdx = null, initial
}) => {
  const { addToast } = useToast();
  const [tipoId, setTipoId] = useState('');
  const [ci, setCi] = useState('');
  const [co, setCo] = useState('');
  const [adultos, setAdultos] = useState(1);
  const [ninos, setNinos] = useState(0);
  const [availability, setAvailability] = useState<AvailabilityInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTipoId(initial?.id_tipo_habitacion || '');
      setCi(initial?.check_in || '');
      setCo(initial?.check_out || '');
      setAdultos(initial?.adultos ?? 1);
      setNinos(initial?.ninos ?? 0);
      setAvailability(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !tipoId || !activeHotelId) { setAvailability(null); return; }

    let cancelled = false;
    const loadAvailability = async () => {
      setLoading(true);
      try {
        const hastaDate = new Date();
        hastaDate.setDate(hastaDate.getDate() + VENTANA_DIAS);
        const data = await apiClient.get<AvailabilityInfo>('/hotel/quotes/disponibilidad', {
          headers: { 'x-hotel-id': activeHotelId },
          params: { id_tipo_habitacion: tipoId, desde: todayStr, hasta: hastaDate.toISOString().split('T')[0] }
        });
        if (!cancelled) setAvailability(data || null);
      } catch (err) {
        console.error('Error loading room availability:', err);
        if (!cancelled) {
          addToast('No se pudo consultar la disponibilidad de este tipo de habitación', 'error');
          setAvailability(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAvailability();
    return () => { cancelled = true; };
  }, [isOpen, tipoId, activeHotelId, todayStr]);

  // Restar las habitaciones del mismo tipo ya agregadas en el formulario
  // (excluyendo el ítem que se está editando actualmente)
  const ajustedDisponibles = React.useMemo((): Record<string, number> => {
    if (!availability?.disponiblesPorNoche || !tipoId) return availability?.disponiblesPorNoche || {};
    const base = { ...availability.disponiblesPorNoche };
    currentItems.forEach((item, idx) => {
      if (idx === editingIdx) return; // no restar el ítem que se está editando
      if (item.id_tipo_habitacion !== tipoId) return;
      if (!item.check_in || !item.check_out) return;
      let cursor = new Date(item.check_in + 'T12:00:00Z');
      const fin = new Date(item.check_out + 'T12:00:00Z');
      while (cursor < fin) {
        const key = cursor.toISOString().split('T')[0];
        if (key in base) base[key] = Math.max(0, base[key] - 1);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    });
    return base;
  }, [availability, tipoId, currentItems, editingIdx]);

  const disabledDates = new Set<string>(
    Object.entries(ajustedDisponibles).filter(([, n]) => n <= 0).map(([d]) => d)
  );

  // Fechas con solo 1 habitación disponible — alerta visual (no bloqueadas)
  const lowAvailDates = new Set<string>(
    Object.entries(ajustedDisponibles)
      .filter(([, n]) => n === 1)
      .map(([d]) => d)
  );

  const rangeHasConflict = (() => {
    if (!ci || !co || !availability) return false;
    let cursor = new Date(ci + 'T12:00:00Z');
    const fin = new Date(co + 'T12:00:00Z');
    while (cursor < fin) {
      if (disabledDates.has(cursor.toISOString().split('T')[0])) return true;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return false;
  })();

  // Mínimo de habitaciones disponibles en el rango seleccionado (con ajuste de ítems del form)
  const minDisponiblesEnRango = (() => {
    if (!ci || !co || !availability) return null;
    let min = Infinity;
    let cursor = new Date(ci + 'T12:00:00Z');
    const fin = new Date(co + 'T12:00:00Z');
    while (cursor < fin) {
      const key = cursor.toISOString().split('T')[0];
      const val = ajustedDisponibles[key] ?? availability.totalHabitaciones;
      if (val < min) min = val;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return min === Infinity ? null : min;
  })();

  const selectedType = roomTypes.find(rt => rt.id === tipoId);
  const tarifa = availability?.tarifaNoche || selectedType?.precio_base || 0;
  const capacidadBase = availability?.capacidadBase ?? 2;
  const noches = ci && co ? Math.max(1, Math.ceil((new Date(co).getTime() - new Date(ci).getTime()) / 86400000)) : 0;
  const personasExtra = (adultos + ninos) > capacidadBase ? 1 : 0;
  const cargoExtraTotal = personasExtra * cargoPersonaExtraRate * noches;
  const canConfirm = !!tipoId && !!ci && !!co && ci < co && !rangeHasConflict && !loading && adultos >= 1;

  const handleConfirm = () => {
    if (!canConfirm || !selectedType) return;
    onConfirm({
      id_tipo_habitacion: tipoId,
      descripcion: `Habitación ${selectedType.nombre}`,
      check_in: ci,
      check_out: co,
      precio_unitario: tarifa,
      adultos,
      ninos
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Seleccionar habitación y fechas</h3>
                <p className="text-slate-400 text-xs mt-0.5">Elige el tipo de habitación, confirma fechas con disponibilidad real y revisa la tarifa aplicable.</p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo de habitación</label>
                <select
                  value={tipoId}
                  onChange={(e) => { setTipoId(e.target.value); setCi(''); setCo(''); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-medium"
                >
                  <option value="">-- Elige Tipo de Habitación --</option>
                  {roomTypes.map(rt => (
                    <option key={rt.id} value={rt.id}>{rt.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fechas disponibles</label>
                <DateRangePicker
                  from={ci}
                  to={co}
                  onFromChange={setCi}
                  onToChange={setCo}
                  minFrom={todayStr}
                  disabledDates={disabledDates}
                  disabledFrom={!tipoId || loading}
                  disabledTo={!tipoId || loading}
                  className="text-xs"
                />
                {!tipoId && (
                  <p className="text-[11px] text-slate-400 mt-1.5">Selecciona primero un tipo de habitación para ver sus fechas disponibles.</p>
                )}
                {loading && (
                  <p className="text-[11px] text-slate-400 mt-1.5">Consultando disponibilidad…</p>
                )}
                {rangeHasConflict && (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-semibold">El rango seleccionado incluye noches sin disponibilidad para este tipo de habitación. Ajusta las fechas.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Adultos</label>
                  <input
                    type="number"
                    min="1"
                    max={capacidadBase + 1}
                    value={adultos}
                    onChange={(e) => {
                      const next = Math.max(1, Number(e.target.value));
                      if (next + ninos <= capacidadBase + 1) setAdultos(next);
                    }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-medium text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Niños</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.max(0, capacidadBase + 1 - adultos)}
                    value={ninos}
                    onChange={(e) => {
                      const next = Math.max(0, Number(e.target.value));
                      if (adultos + next <= capacidadBase + 1) setNinos(next);
                    }}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs font-medium text-center"
                  />
                </div>
              </div>

              {tipoId && availability && !loading && (
                <div className="space-y-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarifa por noche</p>
                      <p className="text-sm font-bold text-slate-800">{tarifa.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total habitaciones tipo</p>
                      <p className="text-sm font-bold text-slate-800">{availability.totalHabitaciones}</p>
                    </div>
                  </div>

                  {cargoPersonaExtraRate > 0 && personasExtra > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Cargo por persona extra</p>
                      <p className="text-xs text-amber-700">
                        1 persona extra × L {cargoPersonaExtraRate.toLocaleString('es-HN', { minimumFractionDigits: 2 })} × {noches} noche{noches !== 1 ? 's' : ''}
                        {' '}= <span className="font-bold">L {cargoExtraTotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                      </p>
                      <p className="text-[10px] text-amber-500 mt-0.5">Cap. base: {capacidadBase} persona{capacidadBase !== 1 ? 's' : ''}. Máx. 1 persona extra permitida.</p>
                    </div>
                  )}
                  {cargoPersonaExtraRate > 0 && personasExtra === 0 && (adultos + ninos) > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Sin cargo por persona extra</p>
                      <p className="text-xs text-emerald-700">Dentro de la capacidad base ({capacidadBase})</p>
                    </div>
                  )}

                  {/* Disponibilidad para el rango seleccionado */}
                  {ci && co && minDisponiblesEnRango !== null && (
                    <div className={`rounded-xl p-3 border flex items-center gap-3 ${
                      minDisponiblesEnRango === 0
                        ? 'bg-rose-50 border-rose-200'
                        : minDisponiblesEnRango === 1
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${
                        minDisponiblesEnRango === 0
                          ? 'bg-rose-100 text-rose-700'
                          : minDisponiblesEnRango === 1
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {minDisponiblesEnRango === 0 ? '✕' : minDisponiblesEnRango}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${
                          minDisponiblesEnRango === 0 ? 'text-rose-700' : minDisponiblesEnRango === 1 ? 'text-amber-700' : 'text-emerald-700'
                        }`}>
                          {minDisponiblesEnRango === 0
                            ? 'Sin disponibilidad para estas fechas'
                            : minDisponiblesEnRango === 1
                            ? '¡Solo queda 1 habitación disponible!'
                            : `${minDisponiblesEnRango} habitaciones disponibles`}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Mínimo disponible en el rango seleccionado
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Leyenda */}
                  <div className="flex items-center gap-4 px-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-slate-300 opacity-40" />
                      <span className="text-[10px] text-slate-400">Sin disponibilidad</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-[10px] text-slate-400">Disponible</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button type="button" onClick={onClose}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} disabled={!canConfirm}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                Confirmar selección
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
