import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Phone, Mail, Star, Users,
  BedDouble, ChevronLeft, ChevronRight, CheckCircle2,
  Loader2, X, Hotel, ArrowLeft, Search, Wifi, Coffee,
  Wind, Tv, ShowerHead, Car, Dumbbell, Eye, Info,
  RotateCcw, MessageSquare, Send,
} from 'lucide-react';
import { DateRangePicker, DatePicker } from '@tremor/react';
import { es } from 'date-fns/locale';
import {
  fetchHotelBySlug, fetchDisponibilidad, crearSolicitudReserva,
  buscarHuesped, registrarHuesped,
  initGuestChat, sendGuestMessage, fetchGuestMessages,
  fetchTarifaHabitacion,
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: 'rgba(10,10,10,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="bg-white w-full md:max-w-4xl md:rounded-3xl rounded-t-3xl max-h-[92dvh] flex flex-col md:flex-row shadow-2xl overflow-hidden"
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
        <div className="flex border-b border-stone-100 md:hidden">
          {(['fotos', ...(has360 ? ['360'] : []), 'detalles'] as const).map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors ${tab === t ? 'text-stone-900 border-b-2 border-stone-900' : 'text-stone-400'}`}>
              {t === '360' ? 'Vista 360°' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Content Mobile -> tab based, Content Desktop -> split view */}
        <div className="overflow-y-auto flex-1 flex flex-col md:flex-row w-full">
          
          {/* Columna Izquierda (Escritorio: Fotos, Móvil: Tab fotos/360) */}
          <div className={`w-full md:w-[55%] md:border-r border-stone-100 ${tab === 'detalles' ? 'hidden md:block' : 'block'}`}>
            <div className="p-0 md:p-6 h-full flex flex-col">
              {/* En móvil mostramos o fotos o 360. En desktop mostramos un visor principal */}
              {(tab === 'fotos' || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
                <div className="flex-1 min-h-[300px]">
                  <ImageGallery imagenes={hab.imagenes} nombre={hab.nombreAlias || hab.nombre} height="h-64 md:h-full md:rounded-2xl" />
                </div>
              )}
              {tab === '360' && hab.imagen_360 && (
                <div className="flex-1 min-h-[300px] md:mt-4">
                  <Viewer360 url={hab.imagen_360} />
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha (Detalles) */}
          <div className={`w-full md:w-[45%] flex flex-col ${tab !== 'detalles' ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
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
                  (cap. base {hab.capacidad} pers. · máx. 1 persona extra permitida)
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-700 flex items-start gap-2">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                Las tarifas incluyen todos los impuestos (ISV + Turismo).
              </div>
            </div>
          )}
          </div> {/* End Derecha Content */}

          {/* CTA */}
          <div className="px-5 md:px-6 pb-6 pt-4 border-t border-stone-100 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-2xl font-black text-stone-900">{formatMoneda(hab.tarifaNoche, hotel.moneda)}</span>
                <span className="text-xs text-stone-400 ml-1">/ noche · impuestos incluidos</span>
                {hab.esTarifaPeriodo && (
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 align-middle">
                    {hab.nombrePeriodo || 'Precio especial'}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => { onClose(); onReservar(); }}
              className="w-full py-4 bg-[var(--color-brand)] brightness-100 hover:brightness-110 active:brightness-90 text-white font-black rounded-2xl text-base transition-all">
              Reservar esta habitación
            </button>
          </div>
          </div> {/* End Derecha */}
        </div> {/* End Content Flex */}
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
        <ImageGallery imagenes={hab.imagenes} nombre={nombre} height="h-52 lg:h-60" />
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
            <span className="font-black text-amber-900">{formatMoneda(hab.totalTarifas !== undefined ? hab.totalTarifas : hab.tarifaNoche * noches, moneda)} total</span>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          <button onClick={onDetalle}
            className="flex-1 py-3 border border-stone-200 text-stone-600 font-bold rounded-2xl text-sm flex items-center justify-center gap-1.5 active:bg-stone-50 transition-colors">
            <Info size={14} /> Detalles
          </button>
          <button onClick={onReservar}
            className="flex-2 flex-grow py-3 bg-[var(--color-brand)] brightness-100 hover:brightness-110 active:brightness-90 text-white font-black rounded-2xl text-sm transition-all">
            Reservar
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Booking Modal (3 pasos) ───────────────────────────────────────────────────
type ModalStep = 'identificacion' | 'registro' | 'reserva' | 'done';
type ChatStep = 'idle' | 'loading' | 'open';
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

  // Tarifa activa para la habitación según las fechas seleccionadas
  const [tarifaActiva, setTarifaActiva] = useState<{
    tarifa_noche: number; total_tarifas?: number; es_periodo: boolean; nombre_periodo: string | null;
  }>({ tarifa_noche: hab.tarifaNoche, total_tarifas: undefined, es_periodo: hab.esTarifaPeriodo ?? false, nombre_periodo: hab.nombrePeriodo ?? null });

  // Re-resolver tarifa cada vez que cambian las fechas en el form
  useEffect(() => {
    if (!form.checkIn || !form.checkOut || !hab.id) return;
    const fecha = form.checkIn.substring(0, 10);
    fetchTarifaHabitacion(hab.id, fecha, form.checkIn, form.checkOut)
      .then(r => setTarifaActiva(r))
      .catch(() => {}); // silencioso — mantiene la tarifa anterior
  }, [form.checkIn, form.checkOut, hab.id]);

  // Chat con recepción
  const [chatStep,      setChatStep]      = useState<ChatStep>('idle');
  const [channelId,     setChannelId]     = useState<string | null>(null);
  const [guestIdentifier, setGuestIdentifier] = useState<string | null>(null);
  const [chatMessages,  setChatMessages]  = useState<any[]>([]);
  const [chatInput,     setChatInput]     = useState('');
  const [sendingChat,   setSendingChat]   = useState(false);
  const [chatError,     setChatError]     = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (chatStep === 'open' && channelId) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      pollRef.current = setInterval(async () => {
        try {
          const msgs = await fetchGuestMessages(channelId);
          setChatMessages(msgs);
        } catch { /* silencioso */ }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chatStep, channelId]);

  const handleOpenChat = async () => {
    setChatStep('loading'); setChatError('');
    try {
      const res = await initGuestChat(form.nombre || correoInput, form.correo || correoInput, form.telefono, hotel.id);
      setChannelId(res.channelId);
      setGuestIdentifier(res.guestId);
      setChatMessages(res.messages || []);
      setChatStep('open');
    } catch (e: any) {
      setChatError(e.message);
      setChatStep('idle');
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !channelId || !guestIdentifier) return;
    const text = chatInput.trim(); setChatInput(''); setSendingChat(true);
    try {
      await sendGuestMessage(channelId, guestIdentifier, form.nombre || 'Huésped', text);
      const msgs = await fetchGuestMessages(channelId);
      setChatMessages(msgs);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { /* silencioso */ }
    finally { setSendingChat(false); }
  };

  const noches   = calcularNoches(form.checkIn, form.checkOut);
  const personasExtra = (form.adultos + form.ninos) > hab.capacidad ? 1 : 0;
  const subtotal = (tarifaActiva.total_tarifas !== undefined ? tarifaActiva.total_tarifas : tarifaActiva.tarifa_noche * noches)
                   + personasExtra * hotel.cargoPersonaExtra * noches;

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
        className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">

        {/* ── Vista de éxito ── */}
        {chatStep !== 'open' && (
          <div className="p-8 text-center">
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
            {chatError && (
              <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-3">{chatError}</p>
            )}
            <button onClick={handleOpenChat} disabled={chatStep === 'loading'}
              className="w-full py-3.5 border-2 border-[var(--color-brand)] text-[var(--color-brand)] rounded-2xl font-black text-sm transition-all hover:bg-[var(--color-brand)] hover:text-white mb-3 flex items-center justify-center gap-2 disabled:opacity-60">
              {chatStep === 'loading'
                ? <><Loader2 size={15} className="animate-spin" /> Conectando...</>
                : <><MessageSquare size={15} /> Contactar a Recepción</>}
            </button>
            <button onClick={onClose} className="w-full py-3 text-stone-400 text-sm font-medium transition-all hover:text-stone-600">
              Cerrar
            </button>
          </div>
        )}

        {/* ── Widget de chat ── */}
        {chatStep === 'open' && channelId && (
          <div className="flex flex-col h-[480px]">
            {/* Header del chat */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
              <div className="w-8 h-8 rounded-full bg-[var(--color-brand)] flex items-center justify-center flex-shrink-0">
                <MessageSquare size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-900 leading-none">Recepción</p>
                <p className="text-[10px] text-emerald-500 font-medium mt-0.5">En línea</p>
              </div>
              <button onClick={onClose}
                className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 flex-shrink-0">
                <X size={13} />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {chatMessages.length === 0 && (
                <p className="text-xs text-stone-400 text-center py-6">
                  Escríbenos, la recepción te responderá en breve.
                </p>
              )}
              {chatMessages.map((msg: any) => {
                const isGuest = msg.sender_id === guestIdentifier;
                return (
                  <div key={msg.id} className={`flex ${isGuest ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                      isGuest
                        ? 'bg-[var(--color-brand)] text-white rounded-br-sm'
                        : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                    }`}>
                      {!isGuest && (
                        <p className="text-[10px] font-bold mb-0.5 opacity-60">{msg.sender_name}</p>
                      )}
                      <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-stone-100 flex gap-2">
              <input
                className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                placeholder="Escribe tu mensaje..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                disabled={sendingChat}
              />
              <button onClick={handleSendChat} disabled={sendingChat || !chatInput.trim()}
                className="w-10 h-10 rounded-2xl bg-[var(--color-brand)] flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 transition-opacity">
                {sendingChat ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(10,10,10,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        className="bg-white w-full sm:max-w-lg md:max-w-4xl sm:rounded-3xl rounded-t-3xl max-h-[92dvh] flex flex-col md:flex-row shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Columna Izquierda (Resumen de Habitación - Solo Desktop) */}
        <div className="hidden md:flex w-[45%] bg-stone-50 border-r border-stone-100 flex-col relative overflow-y-auto">
          {hab.imagenes[0] ? (
            <img src={hab.imagenes[0]} alt={hab.nombreAlias || hab.nombre} className="h-48 w-full object-cover" />
          ) : (
            <div className="h-48 w-full bg-stone-200 flex items-center justify-center"><BedDouble size={32} className="text-stone-400"/></div>
          )}
          <div className="p-6 flex-1 flex flex-col">
            <h3 className="text-2xl font-black text-stone-900 leading-tight mb-1">{hab.nombreAlias || hab.nombre}</h3>
            <p className="text-sm text-stone-500 mb-6">{hab.tipo} · {hab.numeroCamas} cama{hab.numeroCamas !== 1 ? 's' : ''} · {hab.capacidad} pers.</p>
            
            <div className="mt-auto space-y-4">
              <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm">
                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Resumen</p>
                <div className="flex justify-between items-end mb-1">
                  <div>
                    <span className="text-stone-500 text-sm">
                      {tarifaActiva.es_periodo ? (tarifaActiva.nombre_periodo || 'Tarifa especial') : 'Tarifa por noche'}
                    </span>
                    {tarifaActiva.es_periodo && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Precio especial
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-stone-900">{formatMoneda(tarifaActiva.tarifa_noche, hotel.moneda)} <span className="text-[10px] text-stone-400 font-normal">/ noche</span></span>
                </div>
                {noches > 0 && form.checkIn && form.checkOut && (
                  <>
                    <div className="flex justify-between items-end text-sm mb-1 mt-2 pt-2 border-t border-stone-100">
                      <span className="text-stone-500">{noches} noche{noches !== 1 ? 's' : ''}</span>
                      <span className="font-bold text-stone-900">{formatMoneda(tarifaActiva.total_tarifas !== undefined ? tarifaActiva.total_tarifas : tarifaActiva.tarifa_noche * noches, hotel.moneda)}</span>
                    </div>
                    {personasExtra > 0 && hotel.cargoPersonaExtra > 0 && (
                      <div className="flex justify-between items-end text-sm mb-1 text-amber-700">
                        <span>+{personasExtra} pers. extra</span>
                        <span className="font-bold">{formatMoneda(hotel.cargoPersonaExtra * personasExtra * noches, hotel.moneda)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-end mt-3 pt-3 border-t border-stone-200">
                      <span className="text-sm font-bold text-stone-900">Total</span>
                      <span className="text-2xl font-black text-stone-900 leading-none">{formatMoneda(subtotal, hotel.moneda)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Columna Derecha (Formulario) */}
        <div className="flex-1 flex flex-col w-full md:w-[55%]">
          <div className="flex justify-center pt-3 pb-1 md:hidden">
            <div className="w-10 h-1 rounded-full bg-stone-200" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 md:px-8 pt-2 md:pt-6 pb-3 border-b border-stone-100">
            <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {[1,2,3].map(n => (
                <div key={n} className={`h-1 rounded-full transition-all ${n === stepNum ? 'w-5 bg-[var(--color-brand)]' : n < stepNum ? 'w-3 bg-emerald-400' : 'w-3 bg-stone-200'}`} />
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

        {/* Room chip (Solo Móvil) */}
        <div className="mx-5 mt-3 bg-stone-50 border border-stone-100 rounded-2xl px-3 py-2 flex items-center gap-2 md:hidden">
          <BedDouble size={13} className="text-stone-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-stone-600 truncate flex-1">{hab.nombreAlias || hab.nombre}</span>
          <span className="text-xs font-black text-stone-900 flex-shrink-0">{formatMoneda(tarifaActiva.tarifa_noche, hotel.moneda)}<span className="font-normal text-stone-400">/noche</span></span>
        </div>

        <div className="overflow-y-auto flex-1 px-5 md:px-8 py-4 md:py-6">
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
                  {[{ key: 'adultos', label: 'Adultos', min: 1 }, { key: 'ninos', label: 'Niños', min: 0 }].map(p => {
                    const maxTotal = hab.capacidad + 1;
                    const currentOther = p.key === 'adultos' ? form.ninos : form.adultos;
                    const atLimit = (form as any)[p.key] + currentOther >= maxTotal;
                    return (
                    <div key={p.key}>
                      <label className={lbl}>{p.label}</label>
                      <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2.5">
                        <button type="button" onClick={() => setForm(f => ({ ...f, [p.key]: Math.max(p.min, (f as any)[p.key] - 1) }))}
                          className="w-7 h-7 rounded-full bg-stone-200 flex items-center justify-center font-bold text-stone-700">−</button>
                        <span className="font-bold text-stone-900">{(form as any)[p.key]}</span>
                        <button type="button"
                          disabled={atLimit}
                          onClick={() => setForm(f => {
                            const next = (f as any)[p.key] + 1;
                            const other = p.key === 'adultos' ? f.ninos : f.adultos;
                            return next + other <= maxTotal ? { ...f, [p.key]: next } : f;
                          })}
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold ${atLimit ? 'bg-stone-100 text-stone-300 cursor-not-allowed' : 'bg-stone-200 text-stone-700'}`}>+</button>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {/* Alerta persona extra */}
                {personasExtra > 0 && hotel.cargoPersonaExtra > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl px-3 py-2 text-xs text-amber-700">
                    1 persona adicional: +{formatMoneda(hotel.cargoPersonaExtra * noches, hotel.moneda)} ({formatMoneda(hotel.cargoPersonaExtra, hotel.moneda)}/noche)
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
                      <span>{formatMoneda(tarifaActiva.tarifa_noche, hotel.moneda)} × {noches} noche{noches !== 1 ? 's' : ''}</span>
                      <span>{formatMoneda(tarifaActiva.tarifa_noche * noches, hotel.moneda)}</span>
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
        <div className="px-5 md:px-8 pb-6 pt-4 border-t border-stone-100 bg-white">
          {step === 'identificacion' && (
            <button onClick={handleBuscar} disabled={buscando}
              className="w-full py-4 bg-[var(--color-brand)] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {buscando ? <><Loader2 size={15} className="animate-spin" /> Verificando...</> : 'Continuar'}
            </button>
          )}
          {step === 'registro' && (
            <button onClick={handleRegistrar} disabled={registrando}
              className="w-full py-4 bg-[var(--color-brand)] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {registrando ? <><Loader2 size={15} className="animate-spin" /> Registrando...</> : 'Crear perfil y continuar'}
            </button>
          )}
          {step === 'reserva' && (
            <button onClick={handleEnviar} disabled={sending || checkingDisp || dispOk === false}
              className="w-full py-4 bg-[var(--color-brand)] text-white font-black rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-60">
              {sending ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> :
               checkingDisp ? <><Loader2 size={15} className="animate-spin" /> Verificando...</> :
               'Confirmar solicitud'}
            </button>
          )}
          <p className="text-[11px] text-stone-400 text-center mt-3">El hotel confirmará tu reserva por correo o teléfono.</p>
        </div>

        </div> {/* End Columna Derecha */}
      </motion.div>
    </div>
  );
};

// ── Floating Chat Widget ──────────────────────────────────────────────────────
type FCPhase = 'form' | 'chat';

const FloatingChat = ({ hotel }: { hotel: HotelType }) => {
  const [open,      setOpen]      = useState(false);
  const [phase,     setPhase]     = useState<FCPhase>('form');
  const [nombre,    setNombre]    = useState('');
  const [correo,    setCorreo]    = useState('');
  const [telefono,  setTelefono]  = useState('');
  const [starting,  setStarting]  = useState(false);
  const [formError, setFormError] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [guestId,   setGuestId]   = useState<string | null>(null);
  const [messages,  setMessages]  = useState<any[]>([]);
  const [input,     setInput]     = useState('');
  const [sending,   setSending]   = useState(false);
  const endRef  = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === 'chat' && channelId) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      pollRef.current = setInterval(async () => {
        try { setMessages(await fetchGuestMessages(channelId)); } catch { /* silent */ }
      }, 3000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, channelId]);

  const handleStart = async () => {
    if (!nombre.trim()) { setFormError('Tu nombre es obligatorio.'); return; }
    setStarting(true); setFormError('');
    try {
      const res = await initGuestChat(nombre.trim(), correo.trim() || undefined, telefono.trim() || undefined, hotel.id);
      setChannelId(res.channelId); setGuestId(res.guestId);
      setMessages(res.messages || []); setPhase('chat');
    } catch (e: any) { setFormError(e.message); }
    finally { setStarting(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || !channelId || !guestId) return;
    const text = input.trim(); setInput(''); setSending(true);
    try {
      await sendGuestMessage(channelId, guestId, nombre || 'Huésped', text);
      setMessages(await fetchGuestMessages(channelId));
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  const inp = 'w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-stone-50 transition-all';

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="fc-widget"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-80 bg-white rounded-3xl shadow-2xl border border-stone-100 flex flex-col overflow-hidden"
            style={{ maxHeight: '480px' }}>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100"
              style={{ background: hotel.colorPrimario || '#1c1917' }}>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-none">{hotel.nombre}</p>
                <p className="text-[10px] text-white/60 mt-0.5">Recepción · En línea</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white flex-shrink-0">
                <X size={13} />
              </button>
            </div>

            {/* Fase: formulario de identificación */}
            {phase === 'form' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-stone-500 leading-relaxed">
                  Hola, ¿en qué podemos ayudarte? Cuéntanos tu nombre para conectarte con recepción.
                </p>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Nombre *</label>
                  <input className={inp} placeholder="Tu nombre completo"
                    value={nombre} onChange={e => { setNombre(e.target.value); setFormError(''); }}
                    onKeyDown={e => e.key === 'Enter' && handleStart()} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Correo (opcional)</label>
                  <input type="email" className={inp} placeholder="tu@correo.com"
                    value={correo} onChange={e => setCorreo(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Teléfono (opcional)</label>
                  <input type="tel" className={inp} placeholder="+504 9999-9999"
                    value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>
                {formError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{formError}</p>}
                <button onClick={handleStart} disabled={starting}
                  className="w-full py-3 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                  style={{ background: hotel.colorPrimario || '#1c1917' }}>
                  {starting ? <><Loader2 size={14} className="animate-spin" /> Conectando...</> : 'Iniciar conversación'}
                </button>
              </div>
            )}

            {/* Fase: chat */}
            {phase === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ minHeight: '200px', maxHeight: '300px' }}>
                  {messages.length === 0 && (
                    <p className="text-xs text-stone-400 text-center py-6">Escríbenos, la recepción te responderá en breve.</p>
                  )}
                  {messages.map((msg: any) => {
                    const isMe = msg.sender_id === guestId;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                          isMe ? 'text-white rounded-br-sm' : 'bg-stone-100 text-stone-800 rounded-bl-sm'
                        }`} style={isMe ? { background: hotel.colorPrimario || '#1c1917' } : {}}>
                          {!isMe && <p className="text-[10px] font-bold mb-0.5 opacity-50">{msg.sender_name}</p>}
                          <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                <div className="px-3 py-3 border-t border-stone-100 flex gap-2">
                  <input className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="Escribe tu mensaje..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={sending} />
                  <button onClick={handleSend} disabled={sending || !input.trim()}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 transition-opacity"
                    style={{ background: hotel.colorPrimario || '#1c1917' }}>
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white relative"
        style={{ background: hotel.colorPrimario || '#1c1917' }}>
        <AnimatePresence mode="wait">
          {open
            ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}><X size={22} /></motion.span>
            : <motion.span key="msg" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><MessageSquare size={22} /></motion.span>
          }
        </AnimatePresence>
      </motion.button>
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
          className="px-5 bg-[var(--color-brand)] brightness-100 hover:brightness-110 active:brightness-90 text-white rounded-2xl font-bold text-sm flex items-center gap-2 disabled:opacity-60 transition-all">
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
      let co = checkOut;
      if (!co || co <= ci) {
        const d = new Date(ci + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() + 1);
        co = d.toISOString().split('T')[0];
      }
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
    <div className="min-h-screen bg-stone-50 pb-20" style={{ '--color-brand': hotel.colorPrimario || '#1c1917' } as any}>
      {/* Nav */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 font-bold transition-colors">
            <ArrowLeft size={16} /> solarys.uk
          </Link>
          {hotel.logoUrl ? (
            <img src={hotel.logoUrl} alt={hotel.nombre} className="h-8 object-contain" />
          ) : (
            <span className="text-sm font-black text-stone-900 truncate max-w-[200px]">{hotel.nombre}</span>
          )}
          <div className="w-20" />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="lg:flex lg:items-start lg:gap-8 xl:gap-10">
          
          {/* Main Content */}
          <div className="flex-1 min-w-0">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {[1,2,3,4].map(i => <Sk key={i} className="h-80 w-full" />)}
          </div>
        ) : habitaciones.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-4 bg-white rounded-3xl border border-stone-100 mt-2">
            <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center">
              <BedDouble size={36} className="text-stone-300" />
            </div>
            <p className="font-black text-stone-800 text-lg">Sin disponibilidad</p>
            <p className="text-sm text-stone-500 text-center px-6 max-w-sm">No encontramos habitaciones para estas fechas o capacidad. Prueba ajustando tu búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            {habitaciones.map((hab, i) => (
              <RoomCard key={hab.id} hab={hab} noches={noches} moneda={hotel.moneda} hotel={hotel}
                index={i}
                onReservar={() => setSelectedHab(hab)}
                onDetalle={() => setDetalleHab(hab)} />
            ))}
          </div>
        )}
          </div> {/* End Main Content */}

          {/* Sidebar */}
          <div className="w-full lg:w-80 xl:w-[400px] flex-shrink-0 mt-8 lg:mt-0 lg:sticky lg:top-24 space-y-6">
            
            {/* Search Widget in Sidebar */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <SearchWidget checkIn={checkIn} checkOut={checkOut} personas={personas}
                onCheckIn={setCheckIn} onCheckOut={setCheckOut} onPersonas={setPersonas}
                onBuscar={buscarDisponibilidad} loading={loadingRooms} />
            </motion.div>

            {/* Políticas */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl border border-stone-100 divide-y divide-stone-50 shadow-sm">
              {[
                { label: 'Check-in', value: `Desde las ${hotel.horaCheckin}` },
                { label: 'Check-out', value: `Hasta las ${hotel.horaCheckout}` },
                { label: 'Impuestos', value: 'Incluidos en tarifas' },
                ...(hotel.cargoPersonaExtra > 0 ? [{ label: 'Persona extra', value: `${formatMoneda(hotel.cargoPersonaExtra, hotel.moneda)}/noche` }] : []),
              ].map(p => (
                <div key={p.label} className="flex items-center justify-between px-5 py-4 text-sm">
                  <span className="text-stone-500 font-medium">{p.label}</span>
                  <span className="font-bold text-stone-900 text-right">{p.value}</span>
                </div>
              ))}
            </motion.div>
          </div> {/* End Sidebar */}

        </div> {/* End 2-Column Grid */}
      </div>

      <div className="text-center mt-6 pb-10 text-[11px] text-stone-300">
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

      {/* Widget de contacto flotante */}
      <FloatingChat hotel={hotel} />
    </div>
  );
}
