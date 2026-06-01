import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Phone, Mail, Star, Users,
  BedDouble, ChevronLeft, ChevronRight, CheckCircle2,
  Loader2, X, Hotel, ArrowLeft, Search, Wifi, Coffee,
  Wind, Tv, ShowerHead, Car, Dumbbell, Eye, Info,
  RotateCcw,
} from 'lucide-react';
import { DateRangePicker, DatePicker } from '@tremor/react';
import { es } from 'date-fns/locale';
import {
  fetchHotelBySlug, fetchDisponibilidad, crearSolicitudReserva,
  buscarHuesped, registrarHuesped,
} from '../services/api';
import { Hotel as HotelType, Habitacion, ReservaForm } from '../types';
import { formatearFecha, calcularNoches, formatMoneda } from '../utils/slug';

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Sk = ({ className = '' }: { className?: string }) => (
  <div className={`shimmer rounded-2xl ${className}`} />
);

// ── Stars ─────────────────────────────────────────────────────────────────────
const Stars = ({ n }: { n: number }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(i => (
      <Star key={i} size={11} className={i <= n ? 'text-amber-400 fill-amber-400' : 'text-stone-300 fill-stone-200'} />
    ))}
  </div>
);

// ── Servicio icon ─────────────────────────────────────────────────────────────
const SVC_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi size={11} />, 'wi-fi': <Wifi size={11} />, ac: <Wind size={11} />,
  aire: <Wind size={11} />, tv: <Tv size={11} />, desayuno: <Coffee size={11} />,
  ducha: <ShowerHead size={11} />, parking: <Car size={11} />, gym: <Dumbbell size={11} />,
};
const svcIcon = (n: string) => SVC_ICONS[n.toLowerCase().split(' ')[0]] ?? null;

// ── Image Gallery con swipe ───────────────────────────────────────────────────
const ImageGallery = ({ imagenes, nombre, height = 'h-52' }: {
  imagenes: string[]; nombre: string; height?: string;
}) => {
  const [idx, setIdx] = useState(0);
  const startX = useRef(0);

  const prev = () => setIdx(i => (i - 1 + imagenes.length) % imagenes.length);
  const next = () => setIdx(i => (i + 1) % imagenes.length);

  if (!imagenes.length) return (
    <div className={`w-full ${height} bg-stone-100 flex items-center justify-center`}>
      <BedDouble size={36} className="text-stone-300" />
    </div>
  );

  return (
    <div className={`relative w-full ${height} overflow-hidden bg-stone-100 select-none`}
      onPointerDown={e => { startX.current = e.clientX; }}
      onPointerUp={e => { const dx = e.clientX - startX.current; if (Math.abs(dx) > 40) dx < 0 ? next() : prev(); }}>
      <AnimatePresence initial={false} mode="wait">
        <motion.img key={idx} src={imagenes[idx]} alt={nombre}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full h-full object-cover" draggable={false} />
      </AnimatePresence>
      {imagenes.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
            <ChevronLeft size={16} />
          </button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white">
            <ChevronRight size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {imagenes.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                className={`rounded-full transition-all ${i === idx ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
            ))}
          </div>
          <span className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full">
            {idx + 1}/{imagenes.length}
          </span>
        </>
      )}
    </div>
  );
};

// ── Viewer 360 simple ─────────────────────────────────────────────────────────
const Viewer360 = ({ url }: { url: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(50); // 0-100 %
  const dragging = useRef(false);
  const lastX = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true; lastX.current = e.clientX;
    containerRef.current?.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    setOffsetX(prev => Math.max(0, Math.min(100, prev - dx * 0.15)));
  };
  const handlePointerUp = () => { dragging.current = false; };

  return (
    <div ref={containerRef} className="relative w-full h-60 overflow-hidden rounded-2xl cursor-grab active:cursor-grabbing bg-stone-900 select-none"
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
      <img src={url} alt="Vista 360°"
        className="absolute top-0 h-full object-cover"
        style={{ width: '200%', left: `${-offsetX}%`, transition: 'none' }}
        draggable={false} />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full">
        <RotateCcw size={11} /> Arrastra para explorar
      </div>
    </div>
  );
};

// ── Room Detail Modal ─────────────────────────────────────────────────────────
const RoomDetailModal = ({ hab, hotel, onReservar, onClose }: {
  hab: Habitacion; hotel: HotelType; onReservar: () => void; onClose: () => void;
}) => {
  const [tab, setTab] = useState<'fotos' | '360' | 'detalles'>('fotos');
  const has360 = !!hab.imagen_360;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92dvh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-stone-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-stone-900 text-base truncate">
              {hab.nombreAlias || hab.nombre}
            </h3>
            <p className="text-xs text-stone-400">
              {hab.tipo} · {hab.numeroCamas} cama{hab.numeroCamas !== 1 ? 's' : ''} · máx. {hab.capacidad} pers.
            </p>
          </div>
          <button onClick={onClose} className="ml-3 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-100">
          {(['fotos', ...(has360 ? ['360'] : []), 'detalles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${tab === t ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}>
              {t === '360' ? 'Vista 360°' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {tab === 'fotos' && (
            <div className="space-y-3">
              <ImageGallery imagenes={hab.imagenes} nombre={hab.nombreAlias || hab.nombre} height="h-64" />
              {hab.imagenes.length === 0 && (
                <p className="text-center text-sm text-stone-400 py-4">Sin imágenes disponibles.</p>
              )}
            </div>
          )}

          {tab === '360' && hab.imagen_360 && (
            <div className="space-y-3">
              <Viewer360 url={hab.imagen_360} />
              <a href={hab.imagen_360} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-xs text-stone-500 hover:text-stone-700">
                <Eye size={12} /> Abrir en pantalla completa
              </a>
            </div>
          )}

          {tab === 'detalles' && (
            <div className="space-y-5">
              {/* Specs */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Tipo', value: hab.tipo },
                  { label: 'Capacidad', value: `${hab.capacidad} persona${hab.capacidad !== 1 ? 's' : ''}` },
                  { label: 'Camas', value: `${hab.numeroCamas} cama${hab.numeroCamas !== 1 ? 's' : ''}` },
                  { label: 'Tarifa', value: `${formatMoneda(hab.tarifaNoche, hotel.moneda)}/noche` },
                ].map(s => (
                  <div key={s.label} className="bg-stone-50 rounded-2xl p-3">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide mb-0.5">{s.label}</p>
                    <p className="text-sm font-bold text-stone-800">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Servicios */}
              {hab.comodidades.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-3">Servicios incluidos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {hab.comodidades.map(c => (
                      <div key={c} className="flex items-center gap-2.5 bg-stone-50 rounded-2xl px-3 py-2.5">
                        <span className="text-stone-500">{svcIcon(c)}</span>
                        <span className="text-xs font-semibold text-stone-700">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cargo persona extra */}
              {hotel.cargoPersonaExtra > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-xs text-amber-700">
                  <strong>Cargo por persona adicional:</strong> {formatMoneda(hotel.cargoPersonaExtra, hotel.moneda)} por noche
                  (sobre la capacidad de {hab.capacidad} personas)
                </div>
              )}

              {/* Nota impuestos */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-700 flex items-start gap-2">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                Las tarifas incluyen todos los impuestos (ISV + Turismo).
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="px-5 pb-6 pt-3 border-t border-stone-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-2xl font-black text-stone-900">{formatMoneda(hab.tarifaNoche, hotel.moneda)}</span>
              <span className="text-xs text-stone-400 ml-1">/ noche · impuestos incluidos</span>
            </div>
          </div>
          <button onClick={() => { onClose(); onReservar(); }}
            className="w-full py-4 bg-stone-900 active:bg-stone-700 text-white font-black rounded-2xl text-base transition-colors">
            Reservar esta habitación
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Room Card ─────────────────────────────────────────────────────────────────
const RoomCard = ({ hab, noches, moneda, hotel, onReservar, onDetalle, index }: {
  hab: Habitacion; noches: number; moneda: string; hotel: HotelType;
  onReservar: () => void; onDetalle: () => void; index: number;
}) => {
  const nombre = hab.nombreAlias || hab.nombre;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className="bg-white rounded-3xl overflow-hidden border border-stone-100"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>

      {/* Imagen */}
      <div className="relative">
        <ImageGallery imagenes={hab.imagenes} nombre={nombre} height="h-52" />
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          {hab.imagen_360 && (
            <button onClick={onDetalle}
              className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
              <RotateCcw size={9} /> 360°
            </button>
          )}
          {hab.imagenes.length > 0 && (
            <button onClick={onDetalle}
              className="flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-full">
              <Eye size={9} /> Ver todo
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Nombre y precio */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-stone-900 text-[15px] leading-snug truncate">{nombre}</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {hab.tipo} · {hab.numeroCamas} cama{hab.numeroCamas !== 1 ? 's' : ''} · {hab.capacidad} pers.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-black text-stone-900 leading-none">{formatMoneda(hab.tarifaNoche, moneda)}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">noche · imp. incl.</p>
          </div>
        </div>

        {/* Servicios */}
        {hab.comodidades.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {hab.comodidades.slice(0, 4).map(c => (
              <span key={c} className="flex items-center gap-1 text-[11px] bg-stone-50 border border-stone-100 text-stone-600 px-2 py-1 rounded-full font-medium">
                {svcIcon(c)}{c}
              </span>
            ))}
            {hab.comodidades.length > 4 && (
              <button onClick={onDetalle}
                className="text-[11px] text-stone-400 underline">
                +{hab.comodidades.length - 4} más
              </button>
            )}
          </div>
        )}

        {/* Total si hay fechas */}
        {noches > 1 && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2 mb-3 text-xs">
            <span className="text-amber-700">{noches} noches</span>
            <span className="font-black text-amber-900">{formatMoneda(hab.tarifaNoche * noches, moneda)} total</span>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          <button onClick={onDetalle}
            className="flex-1 py-3 border border-stone-200 text-stone-600 font-bold rounded-2xl text-sm flex items-center justify-center gap-1.5 active:bg-stone-50 transition-colors">
            <Info size={14} /> Detalles
          </button>
          <button onClick={onReservar}
            className="flex-2 flex-grow py-3 bg-stone-900 active:bg-stone-700 text-white font-black rounded-2xl text-sm transition-colors">
            Reservar
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Booking Modal (3 pasos) ───────────────────────────────────────────────────
type ModalStep = 'identificacion' | 'registro' | 'reserva' | 'done';
interface HuespedInfo { nombre: string; correo: string; telefono: string; }

const FORM_INIT: ReservaForm = {
  nombre: '', correo: '', telefono: '', dni: '',
  checkIn: '', checkOut: '', adultos: 2, ninos: 0,
  observaciones: '', camaExtra: false, limpiezaDiaria: false, neverita: false, plancha: false,
};

const BookingModal = ({ hab, hotel, checkIn, checkOut, onClose }: {
  hab: Habitacion; hotel: HotelType; checkIn: string; checkOut: string; onClose: () => void;
}) => {
  const [step,       setStep]       = useState<ModalStep>('identificacion');
  const [huesped,    setHuesped]    = useState<HuespedInfo | null>(null);
  const [form,       setForm]       = useState<ReservaForm>({ ...FORM_INIT, checkIn, checkOut });
  const [sending,    setSending]    = useState(false);
  const [error,      setError]      = useState('');
  const [correoInput,setCorreoInput]= useState('');
  const [buscando,   setBuscando]   = useState(false);
  const [regNombre,  setRegNombre]  = useState('');
  const [regTel,     setRegTel]     = useState('');
  const [registrando,setRegistrando]= useState(false);
  const [checkingDisp,setCheckingDisp] = useState(false);
  const [dispOk,     setDispOk]     = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const noches   = calcularNoches(form.checkIn, form.checkOut);
  const personasExtra = Math.max(0, form.adultos + form.ninos - hab.capacidad);
  const subtotal = hab.tarifaNoche * noches + personasExtra * hotel.cargoPersonaExtra * noches;

  const inp = 'w-full border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-stone-50 transition-all';
  const lbl = 'block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2';

  // Verificar disponibilidad en tiempo real
  useEffect(() => {
    if (!form.checkIn || !form.checkOut || step !== 'reserva') { setDispOk(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCheckingDisp(true); setDispOk(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const habs = await fetchDisponibilidad(hotel.id, form.checkIn, form.checkOut);
        setDispOk(habs.some((h: Habitacion) => h.id === hab.id));
      } catch { setDispOk(false); }
      finally { setCheckingDisp(false); }
    }, 600);
  }, [form.checkIn, form.checkOut, step]);

  const handleBuscar = async () => {
    if (!correoInput.trim()) { setError('Ingresa tu correo.'); return; }
    setBuscando(true); setError('');
    try {
      const res = await buscarHuesped(correoInput.trim(), hotel.id);
      if (res.encontrado) {
        setHuesped(res.huesped);
        setForm(f => ({ ...f, nombre: res.huesped.nombre, correo: res.huesped.correo, telefono: res.huesped.telefono || '' }));
        setStep('reserva');
      } else { setStep('registro'); }
    } catch (e: any) { setError(e.message); }
    finally { setBuscando(false); }
  };

  const handleRegistrar = async () => {
    if (!regNombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (!regTel.trim())    { setError('El teléfono es obligatorio.'); return; }
    setRegistrando(true); setError('');
    try {
      const res = await registrarHuesped({ nombre_completo: regNombre.trim(), correo: correoInput.trim(), telefono: regTel.trim(), id_hotel: hotel.id });
      const h = res.huesped;
      setHuesped(h); setForm(f => ({ ...f, nombre: h.nombre, correo: h.correo, telefono: h.telefono || '' }));
      setStep('reserva');
    } catch (e: any) { setError(e.message); }
    finally { setRegistrando(false); }
  };

  const handleEnviar = async () => {
    if (!form.checkIn || !form.checkOut) { setError('Selecciona las fechas.'); return; }
    if (dispOk === false) { setError('Esta habitación no está disponible para esas fechas.'); return; }
    setSending(true); setError('');
    try {
      await crearSolicitudReserva({ ...form, habitacionId: hab.id });
      setStep('done');
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  };

  const stepNum = { identificacion: 1, registro: 2, reserva: 3, done: 3 }[step] ?? 1;

  if (step === 'done') return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-8 text-center shadow-2xl">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.15, damping: 12 }}
          className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </motion.div>
        <h3 className="text-xl font-black text-stone-900 mb-2">Solicitud enviada</h3>
        <p className="text-sm text-stone-500 leading-relaxed mb-6">
          Tu solicitud para <strong className="text-stone-700">{hab.nombreAlias || hab.nombre}</strong> fue recibida.<br />
          El hotel te confirmará a <strong className="text-stone-700">{form.correo || form.telefono}</strong>.
        </p>
        <button onClick={onClose} className="w-full py-3.5 bg-stone-900 text-white rounded-2xl font-black text-sm">Listo</button>
      </motion.div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,10,10,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92dvh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-stone-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-stone-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {[1,2,3].map(n => (
                <div key={n} className={`h-1 rounded-full transition-all ${n === stepNum ? 'w-5 bg-stone-900' : n < stepNum ? 'w-3 bg-emerald-400' : 'w-3 bg-stone-200'}`} />
              ))}
              <span className="text-[10px] text-stone-400 font-medium">{stepNum}/3</span>
            </div>
            <h3 className="font-bold text-stone-900 text-sm">
              {{ identificacion: 'Identificación', registro: 'Nuevo cliente', reserva: 'Detalles de reserva' }[step]}
            </h3>
          </div>
          <button onClick={onClose} className="ml-3 w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
            <X size={15} />
          </button>
        </div>

        {/* Room chip */}
        <div className="mx-5 mt-3 bg-stone-50 border border-stone-100 rounded-2xl px-3 py-2 flex items-center gap-2">
          <BedDouble size={13} className="text-stone-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-stone-600 truncate flex-1">{hab.nombreAlias || hab.nombre}</span>
          <span className="text-xs font-black text-stone-900 flex-shrink-0">{formatMoneda(hab.tarifaNoche, hotel.moneda)}<span className="font-normal text-stone-400">/noche</span></span>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          <AnimatePresence mode="wait">

            {/* Paso 1 */}
            {step === 'identificacion' && (
              <motion.div key="id" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-14 h-14 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users size={24} className="text-stone-500" />
                  </div>
                  <h4 className="font-bold text-stone-800 mb-1">¿Ya eres cliente del hotel?</h4>
                  <p className="text-sm text-stone-400">Ingresa tu correo para verificar.</p>
                </div>
                <div>
                  <label className={lbl}>Correo electrónico *</label>
                  <input type="email" className={inp} placeholder="tu@correo.com"
                    value={correoInput} onChange={e => { setCorreoInput(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleBuscar()} />
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-3 py-2">{error}</p>}
              </motion.div>
            )}

            {/* Paso 2 — Registro */}
            {step === 'registro' && (
              <motion.div key="reg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm text-amber-700">
                  No encontramos una cuenta para <strong>{correoInput}</strong>. Completa tu perfil para continuar.
                </div>
                <div>
                  <label className={lbl}>Nombre completo *</label>
                  <input className={inp} placeholder="Juan García"
                    value={regNombre} onChange={e => { setRegNombre(e.target.value); setError(''); }} />
                </div>
                <div>
                  <label className={lbl}>Teléfono *</label>
                  <input type="tel" className={inp} placeholder="+504 9999-9999"
                    value={regTel} onChange={e => { setRegTel(e.target.value); setError(''); }} />
                </div>
                {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-3 py-2">{error}</p>}
                <button onClick={() => setStep('identificacion')}
                  className="text-xs text-stone-400 flex items-center gap-1">
                  <ArrowLeft size={11} /> Usar otro correo
                </button>
              </motion.div>
            )}

            {/* Paso 3 — Reserva */}
            {step === 'reserva' && (
              <motion.div key="res" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

                {/* Cliente verificado */}
                {huesped && (
                  <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-emerald-700">Cliente verificado</p>
                      <p className="text-xs text-emerald-600 truncate">{huesped.nombre} · {huesped.correo}</p>
                    </div>
                    <button onClick={() => { setStep('identificacion'); setCorreoInput(''); setHuesped(null); }}
                      className="text-[10px] text-emerald-500 font-semibold flex-shrink-0">Cambiar</button>
                  </div>
                )}

                {/* Fechas + disponibilidad live */}
                <div>
                  <label className={lbl}>Fechas de estadía *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide mb-1">Llegada</p>
                      <DatePicker
                        value={toDate(form.checkIn)}
                        onValueChange={d => setForm(f => ({ ...f, checkIn: toStr(d) }))}
                        minDate={new Date()}
                        locale={es}
                        placeholder="Seleccionar"
                        enableClear={false}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wide mb-1">Salida</p>
                      <DatePicker
                        value={toDate(form.checkOut)}
                        onValueChange={d => setForm(f => ({ ...f, checkOut: toStr(d) }))}
                        minDate={toDate(form.checkIn) || new Date()}
                        locale={es}
                        placeholder="Seleccionar"
                        enableClear={false}
                        className="w-full"
                      />
                    </div>
                  </div>
                  {form.checkIn && form.checkOut && (
                    <div className={`mt-2 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border ${
                      checkingDisp ? 'bg-stone-50 text-stone-400 border-stone-100' :
                      dispOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      dispOk === false ? 'bg-red-50 text-red-600 border-red-100' : 'hidden'
                    }`}>
                      {checkingDisp ? <><Loader2 size={12} className="animate-spin" /> Verificando disponibilidad...</> :
                       dispOk ? <><CheckCircle2 size={12} /> Disponible · {noches} noche{noches !== 1 ? 's' : ''}</> :
                       dispOk === false ? <><X size={12} /> No disponible para esas fechas</> : null}
                    </div>
                  )}
                </div>

                {/* Personas */}
                <div className="grid grid-cols-2 gap-3">
                  {[{ key: 'adultos', label: 'Adultos', min: 1, max: 6 }, { key: 'ninos', label: 'Niños', min: 0, max: 4 }].map(p => (
                    <div key={p.key}>
                      <label className={lbl}>{p.label}</label>
                      <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2.5">
                        <button type="button" onClick={() => setForm(f => ({ ...f, [p.key]: Math.max(p.min, (f as any)[p.key] - 1) }))}
                          className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-700">−</button>
                        <span className="font-bold text-stone-900">{(form as any)[p.key]}</span>
                        <button type="button" onClick={() => setForm(f => ({ ...f, [p.key]: Math.min(p.max, (f as any)[p.key] + 1) }))}
                          className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-700">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Alerta persona extra */}
                {personasExtra > 0 && hotel.cargoPersonaExtra > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2 text-xs text-amber-700">
                    {personasExtra} persona{personasExtra !== 1 ? 's' : ''} adicional{personasExtra !== 1 ? 'es' : ''}: +{formatMoneda(hotel.cargoPersonaExtra * personasExtra * noches, hotel.moneda)} ({formatMoneda(hotel.cargoPersonaExtra, hotel.moneda)}/pers./noche)
                  </div>
                )}

                {/* Servicios adicionales */}
                <div>
                  <p className={lbl}>Servicios adicionales</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'camaExtra', label: 'Cama extra' }, { key: 'limpiezaDiaria', label: 'Limpieza diaria' },
                      { key: 'neverita', label: 'Neverita / Minibar' }, { key: 'plancha', label: 'Plancha de ropa' },
                    ].map(s => {
                      const checked = (form as any)[s.key];
                      return (
                        <label key={s.key} className={`flex items-center gap-2.5 cursor-pointer p-3 rounded-2xl border transition-all ${checked ? 'bg-stone-900 border-stone-900 text-white' : 'bg-stone-50 border-stone-100 text-stone-600'}`}>
                          <input type="checkbox" checked={checked} className="sr-only"
                            onChange={e => setForm(f => ({ ...f, [s.key]: e.target.checked }))} />
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'border-white bg-white' : 'border-stone-300'}`}>
                            {checked && <div className="w-2 h-2 rounded-full bg-stone-900" />}
                          </div>
                          <span className="text-xs font-semibold">{s.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Observaciones */}
                <div>
                  <label className={lbl}>Observaciones</label>
                  <textarea className={`${inp} resize-none`} rows={2} placeholder="Llegada tardía, petición especial, etc."
                    value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} />
                </div>

                {/* Desglose */}
                {noches > 0 && form.checkIn && form.checkOut && (
                  <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 space-y-1.5 text-sm">
                    <div className="flex justify-between text-stone-500">
                      <span>{formatMoneda(hab.tarifaNoche, hotel.moneda)} × {noches} noche{noches !== 1 ? 's' : ''}</span>
                      <span>{formatMoneda(hab.tarifaNoche * noches, hotel.moneda)}</span>
                    </div>
                    {personasExtra > 0 && hotel.cargoPersonaExtra > 0 && (
                      <div className="flex justify-between text-stone-500">
                        <span>+{personasExtra} pers. extra × {noches} noches</span>
                        <span>{formatMoneda(hotel.cargoPersonaExtra * personasExtra * noches, hotel.moneda)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-stone-900 pt-2 border-t border-stone-200 text-base">
                      <span>Total (imp. incluidos)</span>
                      <span>{formatMoneda(subtotal, hotel.moneda)}</span>
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-2xl px-3 py-2">{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <div className="px-5 pb-6 pt-3 border-t border-stone-100">
          {step === 'identificacion' && (
            <button onClick={handleBuscar} disabled={buscando}
              className="w-full py-4 bg-stone-900 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {buscando ? <><Loader2 size={15} className="animate-spin" /> Verificando...</> : 'Continuar'}
            </button>
          )}
          {step === 'registro' && (
            <button onClick={handleRegistrar} disabled={registrando}
              className="w-full py-4 bg-stone-900 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {registrando ? <><Loader2 size={15} className="animate-spin" /> Registrando...</> : 'Crear perfil y continuar'}
            </button>
          )}
          {step === 'reserva' && (
            <button onClick={handleEnviar} disabled={sending || checkingDisp || dispOk === false}
              className="w-full py-4 bg-stone-900 text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-60">
              {sending ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> :
               checkingDisp ? <><Loader2 size={15} className="animate-spin" /> Verificando...</> :
               'Confirmar solicitud'}
            </button>
          )}
          <p className="text-[11px] text-stone-400 text-center mt-2">El hotel confirmará tu reserva por correo o teléfono.</p>
        </div>
      </motion.div>
    </div>
  );
};

// helper: Date ↔ string 'YYYY-MM-DD'
const toStr = (d?: Date) => d ? d.toISOString().split('T')[0] : '';
const toDate = (s: string) => s ? new Date(s + 'T12:00:00') : undefined;

// ── Search Widget con Tremor DateRangePicker ──────────────────────────────────
const SearchWidget = ({ checkIn, checkOut, personas, onCheckIn, onCheckOut, onPersonas, onBuscar, loading }: {
  checkIn: string; checkOut: string; personas: number;
  onCheckIn: (v: string) => void; onCheckOut: (v: string) => void;
  onPersonas: (v: number) => void; onBuscar: () => void; loading: boolean;
}) => {
  const noches = checkIn && checkOut ? calcularNoches(checkIn, checkOut) : 0;
  return (
    <div className="bg-white rounded-3xl border border-stone-100 p-4 shadow-sm space-y-3">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Fechas de estadía</p>
      <DateRangePicker
        value={{ from: toDate(checkIn), to: toDate(checkOut) }}
        onValueChange={v => { onCheckIn(toStr(v.from)); onCheckOut(toStr(v.to)); }}
        minDate={new Date()}
        locale={es}
        placeholder="Llegada"
        selectPlaceholder="Salida"
        enableSelect={false}
        color="stone"
        className="w-full"
      />
      <div className="flex gap-2">
        <div className="flex-1 bg-stone-50 rounded-2xl px-3 py-2.5 flex items-center gap-2">
          <Users size={14} className="text-stone-400 flex-shrink-0" />
          <select value={personas} onChange={e => onPersonas(+e.target.value)}
            className="flex-1 bg-transparent text-sm font-semibold text-stone-800 focus:outline-none">
            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} {n === 1 ? 'persona' : 'personas'}</option>)}
          </select>
        </div>
        <button onClick={onBuscar} disabled={loading}
          className="px-5 bg-stone-900 text-white rounded-2xl font-bold text-sm flex items-center gap-2 active:bg-stone-700 disabled:opacity-60">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>
      {noches > 0 && (
        <p className="text-[11px] text-stone-400 text-center">
          {formatearFecha(checkIn)} &rarr; {formatearFecha(checkOut)} &middot; {noches} noche{noches !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HotelPortal() {
  const { hotelSlug } = useParams<{ hotelSlug: string }>();
  const [hotel,        setHotel]        = useState<HotelType | null>(null);
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [loadingHotel, setLoadingHotel] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [notFound,     setNotFound]     = useState(false);
  const [checkIn,      setCheckIn]      = useState('');
  const [checkOut,     setCheckOut]     = useState('');
  const [personas,     setPersonas]     = useState(2);
  const [selectedHab,  setSelectedHab]  = useState<Habitacion | null>(null);
  const [detalleHab,   setDetalleHab]   = useState<Habitacion | null>(null);

  useEffect(() => {
    if (!hotelSlug) return;
    fetchHotelBySlug(hotelSlug)
      .then(h => { setHotel(h); setLoadingHotel(false); })
      .catch(() => { setNotFound(true); setLoadingHotel(false); });
  }, [hotelSlug]);

  const buscarDisponibilidad = useCallback(async () => {
    if (!hotel) return;
    setLoadingRooms(true);
    try {
      const ci = checkIn  || new Date().toISOString().split('T')[0];
      const co = checkOut || new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
      const habs = await fetchDisponibilidad(hotel.id, ci, co);
      setHabitaciones(habs.filter((h: Habitacion) => h.capacidad >= personas));
    } catch { setHabitaciones([]); }
    finally { setLoadingRooms(false); }
  }, [hotel, checkIn, checkOut, personas]);

  useEffect(() => { void buscarDisponibilidad(); }, [buscarDisponibilidad]);

  const noches = checkIn && checkOut ? calcularNoches(checkIn, checkOut) : 1;

  if (loadingHotel) return (
    <div className="min-h-screen bg-stone-50 px-4 py-6 max-w-xl mx-auto space-y-4">
      <Sk className="h-8 w-40" /><Sk className="h-5 w-56" /><Sk className="h-28 w-full" />
      {[1,2,3].map(i => <Sk key={i} className="h-80 w-full" />)}
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
        <Hotel size={28} className="text-stone-300" />
      </div>
      <h1 className="text-xl font-black text-stone-800">Hotel no encontrado</h1>
      <p className="text-stone-500 text-sm max-w-xs">El enlace no corresponde a ningún hotel activo en Solarys.</p>
      <Link to="/" className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700 mt-2">
        <ArrowLeft size={14} /> Ir al inicio
      </Link>
    </div>
  );

  if (!hotel) return null;

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Nav */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 h-12 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 font-medium">
            <ArrowLeft size={13} /> solarys.uk
          </Link>
          <span className="text-xs font-bold text-stone-600 truncate max-w-[160px]">{hotel.nombre}</span>
          <div className="w-14" />
        </div>
      </nav>

      <div className="max-w-xl mx-auto px-4">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-stone-900 leading-tight">{hotel.nombre}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <Stars n={hotel.estrellas} />
                <span className="text-xs text-stone-400">{hotel.estrellas} estrellas</span>
              </div>
            </div>
            {hotel.mapsUrl && (
              <a href={hotel.mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <MapPin size={11} /> Mapa
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="flex items-center gap-1 text-xs text-stone-500 bg-white border border-stone-100 px-2.5 py-1 rounded-full">
              <MapPin size={10} className="text-stone-400" />{hotel.ciudad}
            </span>
            {hotel.telefono && (
              <a href={`tel:${hotel.telefono}`} className="flex items-center gap-1 text-xs text-stone-500 bg-white border border-stone-100 px-2.5 py-1 rounded-full">
                <Phone size={10} className="text-stone-400" />{hotel.telefono}
              </a>
            )}
            {hotel.correo && (
              <a href={`mailto:${hotel.correo}`} className="flex items-center gap-1 text-xs text-stone-500 bg-white border border-stone-100 px-2.5 py-1 rounded-full">
                <Mail size={10} className="text-stone-400" />Contactar
              </a>
            )}
          </div>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-5">
          <SearchWidget checkIn={checkIn} checkOut={checkOut} personas={personas}
            onCheckIn={setCheckIn} onCheckOut={setCheckOut} onPersonas={setPersonas}
            onBuscar={buscarDisponibilidad} loading={loadingRooms} />
        </motion.div>

        {/* Rooms header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-bold text-stone-700">
            {loadingRooms ? 'Buscando habitaciones...' :
              `${habitaciones.length} habitación${habitaciones.length !== 1 ? 'es' : ''} disponible${habitaciones.length !== 1 ? 's' : ''}`}
          </p>
          {checkIn && checkOut && !loadingRooms && habitaciones.length > 0 && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
              {noches} noche{noches !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Rooms */}
        {loadingRooms ? (
          <div className="space-y-4">{[1,2,3].map(i => <Sk key={i} className="h-80 w-full" />)}</div>
        ) : habitaciones.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 bg-white rounded-3xl border border-stone-100">
            <BedDouble size={36} className="text-stone-200" />
            <p className="font-bold text-stone-600">Sin disponibilidad</p>
            <p className="text-sm text-stone-400 text-center px-6">Prueba otras fechas o un menor número de personas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {habitaciones.map((hab, i) => (
              <RoomCard key={hab.id} hab={hab} noches={noches} moneda={hotel.moneda} hotel={hotel}
                index={i}
                onReservar={() => setSelectedHab(hab)}
                onDetalle={() => setDetalleHab(hab)} />
            ))}
          </div>
        )}

        {/* Políticas */}
        <div className="mt-6 bg-white rounded-3xl border border-stone-100 divide-y divide-stone-50">
          {[
            { label: 'Check-in', value: `Desde las ${hotel.horaCheckin}` },
            { label: 'Check-out', value: `Hasta las ${hotel.horaCheckout}` },
            { label: 'Impuestos', value: 'Incluidos en todas las tarifas' },
            ...(hotel.cargoPersonaExtra > 0 ? [{ label: 'Persona extra', value: `${formatMoneda(hotel.cargoPersonaExtra, hotel.moneda)}/noche` }] : []),
          ].map(p => (
            <div key={p.label} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-stone-400 font-medium">{p.label}</span>
              <span className="font-semibold text-stone-700">{p.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-10 pb-4 text-[11px] text-stone-300">
        Reservas gestionadas por <strong>Solarys</strong>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {detalleHab && (
          <RoomDetailModal key="detalle" hab={detalleHab} hotel={hotel}
            onReservar={() => { setSelectedHab(detalleHab); setDetalleHab(null); }}
            onClose={() => setDetalleHab(null)} />
        )}
        {selectedHab && (
          <BookingModal key="booking" hab={selectedHab} hotel={hotel}
            checkIn={checkIn} checkOut={checkOut}
            onClose={() => setSelectedHab(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
