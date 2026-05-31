import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import './PortalCliente.css';
import { Room360Viewer } from './Room360Viewer';

/* ══════════════════════════════════════════════
   PORTAL B2C — Concierge Digital Interactivo
   ══════════════════════════════════════════════ */

/* ── Types ── */
type PortalSection = 'home' | 'habitaciones' | 'reservar' | 'novedades' | 'info';
type WizardStep = 1 | 2 | 3;
type TravelProfile = 'ejecutivo' | 'vacacional' | null;

type RoomPublic = {
  id: string;
  nombre: string;
  codigo: string;
  descripcion: string | null;
  tipo: string | null;
  nombreAlias?: string | null;
  capacidad: number;
  tarifaNoche: number;
  cargoPersonaExtra: number; // USD, 0 si no aplica
  hotel: string;
  hotelId: string;
  disponible: boolean;
  imagenes?: string[];
  imagen_360?: string | null;
  comodidades?: string[];
};

type HotelPublic = {
  id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  descripcion: string | null;
};

const API = import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') || '';
// Tipo de cambio y porcentaje de ISV se cargan desde la config del hotel (ver fetchHotelConfig)
const TASA_CAMBIO_FALLBACK = 26.5768; // USD → HNL (tipo de cambio compra BAC)
// const MEDIA_BUCKET = import.meta.env.VITE_MEDIA_BUCKET ?? 'hotel-verona-media';

/* ── Room image loader ── */

const useRoomImage = (roomId: string | null) => {
  const [src, setSrc] = useState<string | null>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    // Deshabilitamos la búsqueda directa en Supabase Storage para evitar los errores 400 en consola.
    // Ahora las imágenes se cargan de forma 100% limpia mediante las URLs guardadas en la base de datos,
    // y si una habitación no tiene imágenes configuradas, se muestra un placeholder sin generar peticiones fallidas.
    setSrc(null);
    setGallery([]);
    setLoading(false);
  }, [roomId]);
  return { src, gallery, loading };
};

const fmtUSD = (n: number) => `$ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtHNL = (n: number) => `L ${n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ── Room amenity icons ── */
const AMENITIES: Record<string, { icono: string; label: string }[]> = {
  suite: [
    { icono: '', label: 'Smart TV 55"' }, { icono: '', label: 'Jacuzzi' },
    { icono: '', label: 'Wi-Fi' }, { icono: '', label: 'A/C' },
    { icono: '', label: 'Cafetera' }, { icono: '', label: 'Caja fuerte' },
  ],
  doble: [
    { icono: '', label: 'Smart TV' }, { icono: '', label: 'Wi-Fi' },
    { icono: '', label: 'A/C' }, { icono: '', label: 'Cafetera' },
  ],
  individual: [
    { icono: '', label: 'TV' }, { icono: '', label: 'Wi-Fi' },
    { icono: '', label: 'A/C' },
  ],
  default: [
    { icono: '', label: 'TV' }, { icono: '', label: 'Wi-Fi' },
    { icono: '', label: 'A/C' }, { icono: '', label: 'Cafetera' },
  ],
};

const COMODIDADES_MAP: Record<string, { icono: string; label: string }> = {
  smart_tv: { icono: '', label: 'Smart TV' },
  wifi: { icono: '', label: 'Wi-Fi' },
  ac: { icono: '', label: 'A/C' },
  desayuno: { icono: '', label: 'Desayuno de Cortesia' },
  cama_extra: { icono: '', label: 'Se puede añadir cama extra (unipersonal)' },
  neverita: { icono: '', label: 'Neverita / Minibar' },
  plancha: { icono: '', label: 'Plancha' },
  lavanderia: { icono: '', label: 'Lavandería' },
  limpieza: { icono: '', label: 'Limpieza' },
};

const getRoomAmenities = (tipo: string | null, customComodidades?: string[]) => {
  if (customComodidades && customComodidades.length > 0) {
    return customComodidades.map(id => COMODIDADES_MAP[id] || { icono: '', label: id });
  }
  const key = (tipo || '').toLowerCase();
  return AMENITIES[key] || AMENITIES.default;
};

/* ── Motion variants ── */
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const cardHover = {
  rest: { y: 0, boxShadow: '0 4px 20px rgba(0,0,0,.15)' },
  hover: { y: -6, boxShadow: '0 16px 40px rgba(34,197,94,.15)' },
};

/* ── Fake reviews for social proof ── */
const REVIEWS = [
  { name: 'María G.', rating: 5, text: 'Excelente atención y habitaciones impecables. ¡Volveremos!', date: 'Hace 2 semanas' },
  { name: 'Carlos R.', rating: 5, text: 'El servicio de transporte al aeropuerto fue puntual y cómodo.', date: 'Hace 1 mes' },
  { name: 'Ana L.', rating: 4, text: 'Muy buena ubicación y el desayuno buffet es increíble.', date: 'Hace 3 semanas' },
  { name: 'Roberto M.', rating: 5, text: 'Perfecto para viajes de negocios. Wi-Fi rápido y escritorio cómodo.', date: 'Hace 1 semana' },
];

/* ══════════════════════════════════════════════
   CHATBOT WIDGET — FAQ + Live Omnichannel
   ══════════════════════════════════════════════ */
const ChatbotWidget: React.FC<{
  portalUser?: { name: string; email: string } | null;
  guestProfile?: { name: string; email: string; phone: string } | null;
}> = ({ portalUser, guestProfile }) => {
  const [open, setOpen] = useState(false);
  const firstName = portalUser?.name?.split(' ')[0] || guestProfile?.name?.split(' ')[0];
  const [msgs, setMsgs] = useState<{ from: 'bot' | 'user' | 'admin'; text: string; id?: string; senderName?: string }[]>([
    {
      from: 'bot', text: firstName
        ? `¡Hola, ${firstName}! Soy el asistente de Hotel Verona. ¿En qué puedo ayudarte? Escribe "agente" para hablar con recepción directamente.`
        : '¡Hola! Soy el asistente de Hotel Verona. ¿En qué puedo ayudarte? Escribe "agente" para hablar con recepción.'
    },
  ]);
  const [input, setInput] = useState('');
  const [liveMode, setLiveMode] = useState(false);
  const [guestName, setGuestName] = useState(portalUser?.name ?? guestProfile?.name ?? '');
  const [guestEmail, setGuestEmail] = useState(portalUser?.email ?? guestProfile?.email ?? '');
  const [channelId, setChannelId] = useState('');
  const [guestId, setGuestId] = useState(''); const [showNameForm, setShowNameForm] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMsgTime = useRef('');
  const seenMsgIds = useRef(new Set<string>());

  // Sync cuando guestProfile o portalUser cambian/llegan en tiempo real
  useEffect(() => {
    if (guestProfile) {
      if (guestProfile.name) setGuestName(guestProfile.name);
      if (guestProfile.email) setGuestEmail(guestProfile.email);
      if (guestProfile.phone) setGuestPhone(guestProfile.phone);
    }
  }, [guestProfile]);

  useEffect(() => {
    if (portalUser) {
      if (portalUser.name) setGuestName(portalUser.name);
      if (portalUser.email) setGuestEmail(portalUser.email);
    }
  }, [portalUser]);

  // Sync cuando portalUser llega después del redirect OAuth
  useEffect(() => {
    if (portalUser?.name && !guestName) setGuestName(portalUser.name);
    if (portalUser?.email && !guestEmail) setGuestEmail(portalUser.email);
  }, [portalUser?.name, portalUser?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar datos guardados localmente para persistir sesión completa (Opción B)
  useEffect(() => {
    try {
      // 1. Cargar el canal si existe
      const savedChannel = window.localStorage.getItem('hotel-verona:channelId');
      const savedGuestId = window.localStorage.getItem('hotel-verona:guestId');
      if (savedChannel && savedGuestId) {
        setChannelId(savedChannel);
        setGuestId(savedGuestId);
        setLiveMode(true);
      }

      // 2. Cargar datos de contacto
      const saved = window.sessionStorage.getItem('hv_guest');
      if (saved) {
        const g = JSON.parse(saved) as { name: string; email: string; phone: string };
        if (!portalUser?.name && g.name) setGuestName(g.name);
        if (!portalUser?.email && g.email) setGuestEmail(g.email);
        if (g.phone) setGuestPhone(g.phone);
      } else {
        const storedName = window.sessionStorage.getItem('hotel-verona:guestName') || '';
        const storedEmail = window.sessionStorage.getItem('hotel-verona:guestEmail') || '';
        const storedPhone = window.sessionStorage.getItem('hotel-verona:guestPhone') || '';
        if (!portalUser?.name && storedName) setGuestName(storedName);
        if (!portalUser?.email && storedEmail) setGuestEmail(storedEmail);
        if (storedPhone) setGuestPhone(storedPhone);
      }
    } catch {
      // si storage no está disponible, fallamos silenciosamente
    }
  }, [portalUser, guestProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs]);

  // Inicializar canal silenciosamente cuando se abre el chat
  const initChatChannel = async (overrides?: { name?: string; email?: string; phone?: string }) => {
    if (channelId && !overrides) return;
    const nameVal = overrides?.name || guestName.trim() || portalUser?.name?.trim() || guestProfile?.name?.trim() || 'Huésped Anónimo';
    const emailVal = overrides?.email || guestEmail.trim() || portalUser?.email?.trim() || guestProfile?.email?.trim() || '';
    const phoneVal = overrides?.phone || guestPhone.trim() || guestProfile?.phone?.trim() || '';

    try {
      const res = await fetch(`${API}/api/public/chat/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nombre: nameVal, 
          correo: emailVal || undefined, 
          telefono: phoneVal || undefined 
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChannelId(data.channelId);
      setGuestId(data.guestId);
      setLiveMode(true); // Siempre interactuando con la DB

      // Guardar en localStorage para persistencia
      try {
        window.localStorage.setItem('hotel-verona:channelId', data.channelId);
        window.localStorage.setItem('hotel-verona:guestId', data.guestId);
      } catch { /* silent */ }

      if (data.messages?.length) {
        lastMsgTime.current = data.messages[data.messages.length - 1].created_at || data.messages[data.messages.length - 1].createdAt;
        data.messages.forEach((m: any) => seenMsgIds.current.add(m.id));
        const history = data.messages.map((m: any) => {
          const isOwn = m.sender_id === data.guestId;
          const isBot = m.sender_id === 'bot:concierge';
          return {
            from: isOwn ? ('user' as const) : isBot ? ('bot' as const) : ('admin' as const),
            text: m.content,
            id: m.id,
            senderName: m.sender_name || (isOwn ? nameVal : 'Concierge Bot')
          };
        });
        setMsgs(history);
      }
      return data;
    } catch (err) {
      console.error('Error al inicializar canal de chat:', err);
      return null;
    }
  };

  useEffect(() => {
    if (open && !channelId) {
      void initChatChannel();
    }
  }, [open, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!liveMode || !channelId) return;
    pollRef.current = setInterval(async () => {
      try {
        const after = lastMsgTime.current ? `?after=${encodeURIComponent(lastMsgTime.current)}` : '';
        const res = await fetch(`${API}/api/public/chat/messages/${channelId}${after}`);
        if (!res.ok) return;
        const newMsgs: any[] = await res.json();
        if (newMsgs.length > 0) {
          lastMsgTime.current = newMsgs[newMsgs.length - 1].created_at || newMsgs[newMsgs.length - 1].createdAt || newMsgs[newMsgs.length - 1].created_at;
          const incoming = newMsgs
            .filter((m: any) => (m.sender_id || m.senderId) !== guestId && !seenMsgIds.current.has(m.id))
            .map((m: any) => {
              seenMsgIds.current.add(m.id);
              const isBot = m.sender_id === 'bot:concierge';
              return {
                from: isBot ? ('bot' as const) : ('admin' as const),
                text: m.content,
                id: m.id,
                senderName: m.sender_name || m.senderName
              };
            });
          if (incoming.length) setMsgs(p => [...p, ...incoming]);
        }
      } catch { /* silent */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [liveMode, channelId, guestId]);

  const [guestPhone, setGuestPhone] = useState('');

  const startLiveChat = async (overrides?: { name?: string; email?: string; phone?: string }): Promise<any | null> => {
    const nameVal = (overrides?.name ?? guestName) || '';
    const emailVal = (overrides?.email ?? guestEmail) || '';
    const phoneVal = (overrides?.phone ?? guestPhone) || '';
    const hasContact = emailVal.trim() || phoneVal.trim();
    if (!nameVal.trim() || !hasContact) {
      setShowNameForm(true);
      setMsgs(p => [...p, { from: 'bot', text: 'Ingresa tu nombre y al menos un correo o teléfono para conectar con recepción.' }]);
      return null;
    }
    const data = await initChatChannel({ name: nameVal, email: emailVal, phone: phoneVal });
    if (data) {
      setShowNameForm(false);
      setGuestName(nameVal);
      setGuestEmail(emailVal);
      setGuestPhone(phoneVal);
      try {
        if (nameVal) window.sessionStorage.setItem('hotel-verona:guestName', nameVal);
        if (emailVal) window.sessionStorage.setItem('hotel-verona:guestEmail', emailVal);
        if (phoneVal) window.sessionStorage.setItem('hotel-verona:guestPhone', phoneVal);
      } catch { /* silent */ }
      setMsgs(p => [...p, { from: 'bot', text: `Conectado con recepción como ${nameVal}. Un miembro del equipo responderá pronto.` }]);
    }
    return data;
  };

  // Escucha eventos externos para abrir el chat desde otros lugares (p.ej. modal de éxito)
  useEffect(() => {
    const handler = async (ev: Event) => {
      const ce = ev as CustomEvent<any>;
      const d = ce.detail ?? {};
      const name = d.name ?? '';
      const email = d.email ?? '';
      const phone = d.phone ?? '';
      if (name) setGuestName(name);
      if (email) setGuestEmail(email);
      if (phone) setGuestPhone(phone);
      try {
        if (name) window.sessionStorage.setItem('hotel-verona:guestName', name);
        if (email) window.sessionStorage.setItem('hotel-verona:guestEmail', email);
        if (phone) window.sessionStorage.setItem('hotel-verona:guestPhone', phone);
      } catch { /* silent */ }
      setOpen(true);
      if (d.autoStart) {
        const initData = await startLiveChat({ name, email, phone });
        if (initData && d.message) {
          try {
            await fetch(`${API}/api/public/chat/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ channelId: initData.channelId, guestId: initData.guestId, nombre: name || guestName, content: d.message }),
            });
            setMsgs(p => [...p, { from: 'user', text: d.message }]);
          } catch { /* silent */ }
        }
      }
    };
    window.addEventListener('portal-chat-open', handler as EventListener);
    return () => window.removeEventListener('portal-chat-open', handler as EventListener);
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setMsgs(p => [...p, { from: 'user', text: q }]);
    setInput('');

    // Si el usuario escribe palabras claves solicitando agente y no tenemos sus datos reales de contacto, pedirselos.
    const lower = q.toLowerCase();
    const isAgentRequested = lower.includes('agente') || lower.includes('recepcion') || lower.includes('recepción') || lower.includes('humano') || lower.includes('persona');
    if (isAgentRequested) {
      const hasContact = guestEmail.trim() || guestPhone.trim();
      const hasName = guestName.trim() && guestName !== 'Huésped Anónimo';
      if (!hasName || !hasContact) {
        setShowNameForm(true);
        setMsgs(p => [...p, { from: 'bot', text: 'Para conectarte con recepción, ingresa tu nombre y al menos un correo o teléfono:' }]);
        return;
      }
    }

    let activeChannelId = channelId;
    let activeGuestId = guestId;

    if (!activeChannelId) {
      const initData = await initChatChannel();
      if (initData) {
        activeChannelId = initData.channelId;
        activeGuestId = initData.guestId;
      }
    }

    if (activeChannelId) {
      try {
        await fetch(`${API}/api/public/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            channelId: activeChannelId, 
            guestId: activeGuestId, 
            nombre: guestName || 'Huésped Anónimo', 
            content: q 
          }),
        });
        
        // Si el usuario escribe para reiniciar, limpiar localmente después de enviar
        if (q.trim().toLowerCase() === 'reiniciar chat') {
          setTimeout(() => resetChat(), 1500);
        }
      } catch {
        setMsgs(p => [...p, { from: 'bot', text: 'Error al enviar. Verifica tu conexión.' }]);
      }
    }
  };

  const resetChat = () => {
    try {
      window.localStorage.removeItem('hotel-verona:channelId');
      window.localStorage.removeItem('hotel-verona:guestId');
    } catch {}
    setChannelId('');
    setGuestId('');
    setLiveMode(false);
    seenMsgIds.current.clear();
    setMsgs([{
      from: 'bot', text: guestName
        ? `¡Hola de nuevo, ${guestName.split(' ')[0]}! He reiniciado la conversación. ¿En qué puedo ayudarte?`
        : '¡Hola! He reiniciado la conversación. ¿En qué puedo ayudarte hoy?'
    }]);
  };

  if (!open) {
    return (
      <motion.button
        className="portal-chatbot-fab"
        onClick={() => setOpen(true)}
        title="Asistente virtual"
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.95 }}
      >
        Chat
      </motion.button>
    );
  }

  return (
    <motion.div
      className="portal-chatbot-panel"
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40 }}
    >
      <div className="portal-chatbot-head">
        <strong>{liveMode ? 'Chat en vivo' : 'Asistente Hotel Verona'}</strong>
        <div style={{ display: 'flex', gap: '8px' }}>
          {liveMode && (
            <button onClick={resetChat} title="Reiniciar chat" style={{ fontSize: '14px', opacity: 0.8 }}>↻</button>
          )}
          <button onClick={() => setOpen(false)}>×</button>
        </div>
      </div>
      <div className="portal-chatbot-messages" ref={listRef}>
        {msgs.map((m, i) => (
          <motion.div
            key={m.id ?? i}
            className={`portal-chatbot-msg portal-chatbot-msg-${m.from === 'admin' ? 'bot' : m.from}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {m.from === 'admin' && <small style={{ display: 'block', fontSize: 10, opacity: .6, marginBottom: 2 }}>{m.senderName || 'Recepción'}</small>}
            {m.text}
          </motion.div>
        ))}
      </div>
      {showNameForm && !liveMode ? (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <input
            className="input"
            placeholder="Nombre completo *"
            value={guestName}
            onChange={e => { setGuestName(e.target.value); try { window.sessionStorage.setItem('hotel-verona:guestName', e.target.value); } catch { } }}
            style={{ fontSize: 13, height: 32 }}
          />
          <input
            className="input"
            placeholder={`Correo${!guestPhone.trim() ? ' *' : ''}`}
            type="email"
            value={guestEmail}
            onChange={e => { setGuestEmail(e.target.value); try { window.sessionStorage.setItem('hotel-verona:guestEmail', e.target.value); } catch { } }}
            style={{ fontSize: 13, height: 32 }}
          />
          <input
            className="input"
            placeholder={`Teléfono${!guestEmail.trim() ? ' *' : ''}`}
            value={guestPhone}
            onChange={e => { setGuestPhone(e.target.value); try { window.sessionStorage.setItem('hotel-verona:guestPhone', e.target.value); } catch { } }}
            style={{ fontSize: 13, height: 32 }}
          />
          <button
            className="btn portal-btn-primary"
            style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => void startLiveChat()}
            disabled={!guestName.trim() || (!guestEmail.trim() && !guestPhone.trim())}
          >
            Conectar con recepción
          </button>
        </div>
      ) : (
        <form className="portal-chatbot-input" onSubmit={e => { e.preventDefault(); void send(); }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder={liveMode ? 'Escribe tu mensaje…' : 'Escribe tu pregunta…'} />
          <button type="submit">Enviar</button>
        </form>
      )}
    </motion.div>
  );
};

/* ══════════════════════════════════════════════
   WIZARD STEP INDICATOR
   ══════════════════════════════════════════════ */
const WizardSteps: React.FC<{ current: WizardStep; onStep: (s: WizardStep) => void; maxReached: WizardStep }> = ({ current, onStep, maxReached }) => {
  const steps = [
    { num: 1 as const, label: 'Fechas', icon: '1' },
    { num: 2 as const, label: 'Habitación', icon: '2' },
    { num: 3 as const, label: 'Checkout', icon: '3' },
  ];

  return (
    <div className="wizard-steps">
      {steps.map((s, i) => (
        <React.Fragment key={s.num}>
          {i > 0 && <div className={`wizard-connector ${current >= s.num ? 'active' : ''}`} />}
          <button
            className={`wizard-step ${current === s.num ? 'current' : ''} ${current > s.num ? 'done' : ''}`}
            onClick={() => s.num <= maxReached && onStep(s.num)}
            disabled={s.num > maxReached}
            type="button"
          >
            <span className="wizard-step-icon">{current > s.num ? '✓' : s.icon}</span>
            <span className="wizard-step-label">{s.label}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════
   PARTICLE BACKGROUND
   ══════════════════════════════════════════════ */
const ParticleBackground: React.FC = () => {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      key: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 8}s`,
      duration: `${6 + Math.random() * 8}s`,
      size: `${2 + Math.random() * 4}px`,
    })), []);

  return (
    <div className="portal-particles" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.key}
          className="portal-particle"
          style={{
            left: p.left, top: p.top,
            animationDelay: p.delay, animationDuration: p.duration,
            width: p.size, height: p.size,
          }}
        />
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════
   ROOM CARD IMAGE — thumbnail for catalog cards
   ══════════════════════════════════════════════ */
const RoomCardImage: React.FC<{ roomId: string; nombre: string; imagenes?: string[] }> = ({ roomId, nombre, imagenes }) => {
  // Si hay imagenes en la DB, usamos la primera, sino usamos el fallback (que ya no hace force HEAD)
  const hasDbImage = imagenes && imagenes.length > 0;
  const { src, loading } = useRoomImage(hasDbImage ? null : roomId);

  if (hasDbImage) {
    return <div className="portal-room-card-img"><img src={imagenes[0]} alt={nombre} /></div>;
  }

  if (loading) return <div className="portal-room-card-img portal-room-card-img-loading"><div className="portal-spinner-sm" /></div>;
  if (src) return <div className="portal-room-card-img"><img src={src} alt={nombre} /></div>;
  return <div className="portal-room-card-img portal-room-card-img-empty"><span>—</span></div>;
};

/* ══════════════════════════════════════════════
   ROOM DETAIL MODAL
   ══════════════════════════════════════════════ */
const RoomDetailModal: React.FC<{
  room: RoomPublic;
  nights: number;
  tipoCambio: number;
  onClose: () => void;
  onSelect: () => void;
  onOpen360?: (url: string, name: string) => void;
}> = ({ room, nights, tipoCambio, onClose, onSelect, onOpen360 }) => {
  const hasDbImages = room.imagenes && room.imagenes.length > 0;
  // Solo usar useRoomImage si NO hay imagenes en BD
  const { src: imgSrc, gallery, loading: imgLoading } = useRoomImage(hasDbImages ? null : room.id);
  const amenities = getRoomAmenities(room.tipo, room.comodidades);
  const priceIncHNL = Number(room.tarifaNoche) || 0;
  const priceIncUSD = priceIncHNL / (tipoCambio || 24);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const allImages = hasDbImages ? (room.imagenes as string[]) : ([imgSrc, ...gallery].filter(Boolean) as string[]);

  return (
    <motion.div
      className="portal-welcome-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="portal-room-detail-modal"
        initial={{ opacity: 0, y: 48, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image */}
        <div className="portal-rdm-image-wrap" onClick={() => (allImages[0] || imgSrc) && setLightboxIdx(0)} style={{ cursor: (allImages[0] || imgSrc) ? 'zoom-in' : undefined }}>
          {imgLoading ? (
            <div className="portal-rdm-img-placeholder portal-rdm-loading">
              <div className="portal-spinner" />
            </div>
          ) : allImages[0] ? (
            <img src={allImages[0]} alt={(room as any).nombreAlias ?? (room as any).nombre_alias ?? room.nombre} className="portal-rdm-image" />
          ) : imgSrc ? (
            <img src={imgSrc} alt={(room as any).nombreAlias ?? (room as any).nombre_alias ?? room.nombre} className="portal-rdm-image" />
          ) : (
            <div className="portal-rdm-img-placeholder">
              <svg viewBox="0 0 80 56" fill="none" width="80" opacity=".3">
                <rect x="4" y="4" width="72" height="48" rx="6" stroke="currentColor" strokeWidth="2" />
                <circle cx="26" cy="22" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M4 40 l18-14 12 10 12-8 30 18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
              </svg>
              <span>Sin imagen</span>
            </div>
          )}
          <button className="portal-rdm-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Cerrar">×</button>
          {room.tipo && <span className="portal-rdm-badge">{room.tipo}</span>}
          {allImages.length > 1 && (
            <span className="portal-rdm-photo-count">{allImages.length} fotos</span>
          )}
        </div>

        {/* Gallery thumbnails */}
        {allImages.length > 1 && (
          <div className="portal-rdm-thumbs">
            {allImages.map((url, i) => (
              <img key={i} src={url} alt={`${(room as any).nombreAlias ?? (room as any).nombre_alias ?? room.nombre} ${i + 1}`} className={`portal-rdm-thumb${lightboxIdx === i ? ' active' : ''}`}
                onClick={() => setLightboxIdx(i)} />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="portal-rdm-body">
          <div className="portal-rdm-header">
            <div>
              <h2>{(room as any).nombreAlias ?? (room as any).nombre_alias ?? ''}</h2>
              <p className="portal-muted" style={{ marginTop: 4 }}>{room.hotel}</p>
            </div>
            <div className="portal-rdm-price">
              <small className="portal-rdm-price-label">Precio por noche</small>
              <strong>{fmtHNL(priceIncHNL)}</strong>
              <small style={{ opacity: .6 }}>{fmtUSD(priceIncUSD)}</small>
              <span>ISV incl.</span>
            </div>
          </div>

          {room.descripcion && (
            <p className="portal-rdm-desc">{room.descripcion}</p>
          )}

          <div className="portal-rdm-meta-row">
            <div className="portal-rdm-meta-item">
              <span className="portal-rdm-meta-icon">Capacidad</span>
              <div>
                <strong>{room.capacidad} huésped{room.capacidad > 1 ? 'es' : ''}</strong>
                <small>Capacidad máxima</small>
              </div>
            </div>
            <div className="portal-rdm-meta-item">
              <span className="portal-rdm-meta-icon">Tipo</span>
              <div>
                <strong>{room.tipo ?? 'Estándar'}</strong>
                <small>Tipo de habitación</small>
              </div>
            </div>
            <div className="portal-rdm-meta-item">
              <span className="portal-rdm-meta-icon">Código</span>
              <div>
                <strong>{room.codigo}</strong>
                <small>Código</small>
              </div>
            </div>
          </div>

          <div className="portal-rdm-amenities">
            <h4>Comodidades incluidas</h4>
            <div className="portal-rdm-amenities-grid">
              {amenities.map(a => (
                <div key={a.label} className="portal-rdm-amenity">
                  <span>{a.icono}</span>
                  <span>{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="portal-rdm-meta-item">
            <span className="portal-rdm-meta-icon">Extra</span>
            <div>
              <span>Cargo por persona extra (sobre capacidad): <strong>{fmtHNL(10 * (tipoCambio || 24))}</strong> ({fmtUSD(10)}) / persona / noche</span>
            </div>
          </div>

          {nights > 0 && (
            <div className="portal-rdm-total-bar">
              <span>{nights} noche{nights !== 1 ? 's' : ''}</span>
              <strong>Total: {fmtHNL(priceIncHNL * nights)}</strong>
              <small style={{ opacity: .7, marginLeft: 4 }}>{fmtUSD(priceIncUSD * nights)}</small>
            </div>
          )}

          <div className="portal-rdm-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
            <button className="btn portal-btn-secondary" onClick={onClose} style={{ flex: 1, minWidth: '80px' }}>Cerrar</button>
            {room.imagen_360 && onOpen360 && (
              <motion.button
                className="btn btn-tour-360-trigger"
                onClick={() => onOpen360(room.imagen_360!, room.nombreAlias ?? room.nombre)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ flex: 1, minWidth: '130px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Tour 360°
              </motion.button>
            )}
            {room.disponible ? (
              <motion.button
                className="btn portal-btn-primary portal-btn-lg"
                onClick={onSelect}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{ flex: 2, minWidth: '180px' }}
              >
                Reservar esta habitación
              </motion.button>
            ) : (
              <span className="portal-pill-unavailable" style={{ padding: '10px 20px', flex: 2, textAlign: 'center' }}>No disponible</span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && allImages[lightboxIdx] && (
          <motion.div
            className="portal-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxIdx(null)}
          >
            <img src={allImages[lightboxIdx]} alt={room.nombre} onClick={e => e.stopPropagation()} />
            <button className="portal-lightbox-close" onClick={() => setLightboxIdx(null)}>×</button>
            {allImages.length > 1 && (
              <>
                <button className="portal-lightbox-arrow portal-lightbox-prev" onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + allImages.length) % allImages.length); }}>‹</button>
                <button className="portal-lightbox-arrow portal-lightbox-next" onClick={e => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % allImages.length); }}>›</button>
              </>
            )}
            <div className="portal-lightbox-counter">{lightboxIdx + 1} / {allImages.length}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ══════════════════════════════════════════════
   MAIN PORTAL COMPONENT
   ══════════════════════════════════════════════ */
type LocalGuidePost = {
  id: string;
  title: string;
  content: string;
  category: string;
  icon: string;
  image_url: string | null;
  event_date: string | null;
  sort_order: number;
};

const COUNTRY_CODES = [
  { code: '+504', name: 'Honduras (HN)', flag: '🇭🇳' },
  { code: '+502', name: 'Guatemala (GT)', flag: '🇬🇹' },
  { code: '+503', name: 'El Salvador (SV)', flag: '🇸🇻' },
  { code: '+505', name: 'Nicaragua (NI)', flag: '🇳🇮' },
  { code: '+506', name: 'Costa Rica (CR)', flag: '🇨🇷' },
  { code: '+507', name: 'Panamá (PA)', flag: '🇵🇦' },
  { code: '+52', name: 'México (MX)', flag: '🇲🇽' },
  { code: '+1', name: 'USA / Canadá (US/CA)', flag: '🇺🇸' },
  { code: '+57', name: 'Colombia (CO)', flag: '🇨🇴' },
  { code: '+34', name: 'España (ES)', flag: '🇪🇸' },
];

const PortalCliente: React.FC = () => {
  const navigate = useNavigate();
  const [section, setSection] = useState<PortalSection>('home');
  const [rooms, setRooms] = useState<RoomPublic[]>([]);
  const [hotels, setHotels] = useState<HotelPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [active360Url, setActive360Url] = useState<string | null>(null);
  const [active360Name, setActive360Name] = useState<string>('');

  /* ── Configuración hotelera (tipo de cambio real + ISV) ── */
  const [tipoCambio, setTipoCambio] = useState(TASA_CAMBIO_FALLBACK);
  const [isvPercent, setIsvPercent] = useState(0);
  const [nombreRedHoteles, setNombreRedHoteles] = useState('Hotel Verona');

  useEffect(() => {
    document.title = `${nombreRedHoteles} | Portal de Clientes`;
  }, [nombreRedHoteles]);

  useEffect(() => {
    let mounted = true;
    const POLL_MS = Number(import.meta.env.VITE_EXCHANGE_POLL_MS ?? 600000);

    const fetchConfig = () => {
      fetch(`${API}/api/public/config`)
        .then((r) => r.ok ? r.json() : null)
        .then((cfg: any) => {
          if (!cfg) return;
          let rate = Number(cfg.tipoCambio ?? cfg.exchangeRate ?? TASA_CAMBIO_FALLBACK);
          // Si baseCurrency es HNL pero la tarifa en DB se asume USD (para portal),
          // y el rate devuelto es < 1 (e.g. 0.037), lo invertimos para calcular HNL correctamente
          if (cfg.monedaBase === 'HNL' && rate > 0 && rate < 1) {
            rate = 1 / rate;
          }
          const isv = Number(cfg.porcentajeImpuesto ?? cfg.taxPercent ?? 0);
          if (rate > 0 && mounted) setTipoCambio(rate);
          if (mounted) setIsvPercent(isv);
          if (cfg.nombreRedHoteles && mounted) setNombreRedHoteles(cfg.nombreRedHoteles);
        })
        .catch(() => { /* usa fallback */ });
    };

    fetchConfig();
    const id = setInterval(fetchConfig, POLL_MS);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Helper de formateo local eliminado a favor del global

  /* ── Portal social login (guest) ── */
  const [portalUser, setPortalUser] = useState<{ name: string; email: string; avatar?: string } | null>(null);
  const [guestProfile, setGuestProfile] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  /* ── Room detail modal ── */
  const [roomDetail, setRoomDetail] = useState<RoomPublic | null>(null);

  /* ── Success modal ── */
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{ nombre: string; habitacion: string; checkIn: string; checkOut: string; correo?: string; telefono?: string } | null>(null);

  /* ── Welcome modal ── */
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeTab, setWelcomeTab] = useState<'existing' | 'new'>('existing');
  const [wDni, setWDni] = useState('');
  const [wName, setWName] = useState('');
  const [wEmail, setWEmail] = useState('');
  const [wCountryCode, setWCountryCode] = useState('+504');
  const [wLocalPhone, setWLocalPhone] = useState('');
  const [wError, setWError] = useState('');

  const parsePhone = (fullPhone: string | null): { countryCode: string; localPhone: string } => {
    if (!fullPhone) return { countryCode: '+504', localPhone: '' };
    const cleaned = fullPhone.trim();
    const matched = COUNTRY_CODES.find(c => cleaned.startsWith(c.code));
    if (matched) {
      const local = cleaned.slice(matched.code.length).trim().replace(/\D/g, '');
      return { countryCode: matched.code, localPhone: local };
    }
    if (cleaned.startsWith('+')) {
      const parts = cleaned.split(/\s+/);
      if (parts.length > 1) {
        return { countryCode: parts[0], localPhone: parts.slice(1).join('').replace(/\D/g, '') };
      }
    }
    return { countryCode: '+504', localPhone: cleaned.replace(/\D/g, '') };
  };

  const dismissWelcome = (name: string, email: string, phone: string, dni: string) => {
    const profile = { name, email, phone, dni };
    sessionStorage.setItem('hv_guest', JSON.stringify(profile));
    setGuestProfile(profile);
    setFormNombre(name);
    setFormDni(dni);
    if (email) setFormCorreo(email);
    if (phone) {
      const parsed = parsePhone(phone);
      setFormCountryCode(parsed.countryCode);
      setFormLocalPhone(parsed.localPhone);
    }
    setShowWelcomeModal(false);
  };

  const validateWelcomeFields = (): string | null => {
    if (!wDni.trim()) return 'El DNI o documento es obligatorio.';
    if (wDni.trim().length < 5) return 'El DNI o documento debe tener al menos 5 caracteres.';
    
    if (!wName.trim()) return 'El nombre completo es obligatorio.';
    if (wName.trim().length < 3) return 'El nombre completo debe tener al menos 3 caracteres.';
    // Solo letras y espacios
    const nameRegex = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{3,}$/;
    if (!nameRegex.test(wName.trim())) return 'El nombre completo solo debe contener letras y espacios.';

    if (welcomeTab === 'new') {
      if (!wEmail.trim()) return 'El correo electrónico es obligatorio.';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(wEmail.trim())) return 'El correo electrónico no tiene un formato válido.';

      if (!wLocalPhone.trim()) return 'El teléfono es obligatorio.';
      if (wLocalPhone.trim().length < 6 || wLocalPhone.trim().length > 12) {
        return 'El número de teléfono debe tener entre 6 y 12 dígitos.';
      }
    }
    return null;
  };

  const handleWelcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateWelcomeFields();
    if (validationError) {
      setWError(validationError);
      return;
    }

    setWError('');
    try {
      if (welcomeTab === 'existing') {
        const res = await fetch(`${API}/api/public/verificar-huesped-dni`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dni: wDni.trim(), nombre: wName.trim() }),
        });
        const data = await res.json();
        
        if (res.ok) {
          if (data.existe && data.valido) {
            dismissWelcome(data.huesped.nombre_completo, data.huesped.correo || '', data.huesped.telefono || '', data.huesped.documento_identidad || wDni.trim());
          } else {
            setWError(data.error || 'Error al validar los datos del cliente.');
          }
        } else {
          setWError(data.error || 'El DNI ingresado no coincide con tu nombre registrado o no existe.');
        }
      } else {
        const fullPhone = `${wCountryCode} ${wLocalPhone.trim()}`;
        // Soy cliente nuevo: validar unicidad de correo y DNI en la BD
        const res = await fetch(`${API}/api/public/validar-nuevo-huesped`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dni: wDni.trim(),
            nombre: wName.trim(),
            correo: wEmail.trim(),
            telefono: fullPhone
          }),
        });
        const data = await res.json();
        
        if (res.ok) {
          dismissWelcome(wName.trim().toUpperCase(), wEmail.trim().toLowerCase(), fullPhone, wDni.trim().toUpperCase());
        } else {
          setWError(data.error || 'Error de validación del nuevo huésped.');
        }
      }
    } catch {
      setWError('No se pudo conectar con el servidor para validar los datos.');
    }
  };

  useEffect(() => {
    const isEmployeeUser = (userObj: any) => {
      if (!userObj) return false;
      const provider = userObj.app_metadata?.provider;
      const email = userObj.email || '';
      return provider === 'email' ||
        email.includes('admin') ||
        email.includes('recep') ||
        email.includes('propietario') ||
        email.includes('owner') ||
        email.includes('counter') ||
        email.includes('contador') ||
        email.includes('maintenance') ||
        email.includes('mantenimiento') ||
        email.includes('josuejosuelpaz');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !isEmployeeUser(session.user)) {
        const u = session.user;
        const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || '';
        const email = u.email || '';
        const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture || undefined;
        setPortalUser({ name, email, avatar });
        setGuestProfile({ name, email, phone: '' });
        setFormNombre(prev => prev || name);
        setFormCorreo(prev => prev || email);
        setShowWelcomeModal(false); // OAuth login satisfies welcome
      }
    });
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !isEmployeeUser(session.user)) {
        const u = session.user;
        const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || '';
        const email = u.email || '';
        const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture || undefined;
        setPortalUser({ name, email, avatar });
        setGuestProfile({ name, email, phone: '' });
        setFormNombre(name);
        setFormCorreo(email);
        // Don't show modal if already logged in via OAuth
        return;
      }
      // Show welcome modal if no session or if it belongs to an employee
      const saved = sessionStorage.getItem('hv_guest');
      if (saved) {
        try {
          const g = JSON.parse(saved) as { name: string; email: string; phone: string; dni?: string };
          setGuestProfile(g);
          setFormNombre(g.name);
          if (g.email) setFormCorreo(g.email);
          if (g.phone) {
            const parsed = parsePhone(g.phone);
            setFormCountryCode(parsed.countryCode);
            setFormLocalPhone(parsed.localPhone);
          }
          if (g.dni) setFormDni(g.dni);
        } catch { /* ignore */ }
      } else {
        setShowWelcomeModal(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setAuthLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/#/portal` },
      });
    } catch { /* silent */ }
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPortalUser(null);
    setFormNombre('');
    setFormCorreo('');
  };

  /* ── Local guide posts ── */
  const [guidePosts, setGuidePosts] = useState<LocalGuidePost[]>([]);
  const [guideCategory, setGuideCategory] = useState<string>('Todos');

  /* ── Travel profile ── */
  const [travelProfile, setTravelProfile] = useState<TravelProfile>(null);

  /* ── Wizard state ── */
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [maxWizardStep, setMaxWizardStep] = useState<WizardStep>(1);

  /* ── Search / dates ── */
  const [filterCheckIn, setFilterCheckIn] = useState('');
  const [filterCheckOut, setFilterCheckOut] = useState('');
  const [filterHoraIn, setFilterHoraIn] = useState('14:00');
  const [filterHoraOut, setFilterHoraOut] = useState('12:00');
  const [filterAdultos, setFilterAdultos] = useState(2);
  const [filterNinos, setFilterNinos] = useState(0);
  const [filterHotelId, setFilterHotelId] = useState<string>('all');

  /* ── Selected room ── */
  const [reservaRoom, setReservaRoom] = useState<RoomPublic | null>(null);

  /* ── Extras ── */
  const [formDni, setFormDni] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formCountryCode, setFormCountryCode] = useState('+504');
  const [formLocalPhone, setFormLocalPhone] = useState('');
  const [formObs, setFormObs] = useState('');
  const [formCamaExtra, setFormCamaExtra] = useState(false);
  const [formLimpiezaDiaria, setFormLimpiezaDiaria] = useState(false);
  const [formNeverita, setFormNeverita] = useState(false);
  const [formPlancha, setFormPlancha] = useState(false);
  const [comodidadesDispo, setComodidadesDispo] = useState({ cama_extra: true, neverita: true, plancha: true });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [wizardValidation, setWizardValidation] = useState('');

  /* ── Data loading ── */
  const fetchRooms = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      // Añadir T12:00:00 para evitar desfase UTC: "2026-04-25" sin hora se
      // interpreta como medianoche UTC → en Honduras (UTC-6) sería el día anterior.
      if (filterCheckIn) params.set('checkIn', new Date(`${filterCheckIn}T12:00:00`).toISOString());
      if (filterCheckOut) params.set('checkOut', new Date(`${filterCheckOut}T12:00:00`).toISOString());
      const res = await fetch(`${API}/api/public/disponibilidad?${params}`);
      if (res.ok) { const data: RoomPublic[] = await res.json(); const m = new Map<string, RoomPublic>(); data.forEach(r => { if (!m.has(r.id)) m.set(r.id, r); }); setRooms([...m.values()]); }

      const resDispo = await fetch(`${API}/api/public/comodidades-disponibilidad?${params}`);
      if (resDispo.ok) {
        const dispoData = await resDispo.json();
        setComodidadesDispo({
          cama_extra: !!dispoData.cama_extra,
          neverita: !!dispoData.neverita,
          plancha: !!dispoData.plancha
        });
      }
    } catch { /* silent */ }
  }, [filterCheckIn, filterCheckOut]);

  useEffect(() => {
    if (!comodidadesDispo.cama_extra) setFormCamaExtra(false);
    if (!comodidadesDispo.neverita) setFormNeverita(false);
    if (!comodidadesDispo.plancha) setFormPlancha(false);
  }, [comodidadesDispo]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/public/disponibilidad`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/public/hoteles`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/public/local-guide`).then(r => r.ok ? r.json() : []),
    ]).then(([r, h, g]) => { const m = new Map<string, RoomPublic>(); (r as RoomPublic[]).forEach(x => { if (!m.has(x.id)) m.set(x.id, x); }); setRooms([...m.values()]); setHotels(h); setGuidePosts(g); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (filterCheckIn && filterCheckOut) fetchRooms(); }, [filterCheckIn, filterCheckOut, fetchRooms]);

  /* ── Computed ── */
  const nights = useMemo(() => {
    if (!filterCheckIn || !filterCheckOut) return 0;
    return Math.max(1, Math.ceil((new Date(filterCheckOut).getTime() - new Date(filterCheckIn).getTime()) / 86_400_000));
  }, [filterCheckIn, filterCheckOut]);

  // La tarifa en HNL ya incluye impuestos (ISV 15% + Turismo 4%).
  // Desglose: totalHNL / 1.19 = subtotal sin imp → ISV 15% → Turismo 4%
  const extrasCount = reservaRoom ? Math.max(0, filterAdultos - Number(reservaRoom.capacidad)) : 0;
  const cargoExtraHNL = reservaRoom ? 10 * (tipoCambio || 24) : 0;
  const subtotalExtrasHNL = cargoExtraHNL * extrasCount * nights;
  const subtotalRoomHNL = reservaRoom ? Number(reservaRoom.tarifaNoche || 0) * nights : 0;
  const subtotalCamaExtraHNL = formCamaExtra ? 0 * nights : 0; // Se puede configurar un cargo o mantener como cortesía/incluido

  const totalHNL = subtotalRoomHNL + subtotalExtrasHNL + subtotalCamaExtraHNL;
  const totalUSD = totalHNL / (tipoCambio || 24);
  const subtotalSinImpHNL = totalHNL / 1.19;
  const isvHNL = subtotalSinImpHNL * 0.15;
  const turismoHNL = subtotalSinImpHNL * 0.04;

  const mappedRooms = useMemo(() => {
    return rooms.map(r => ({
      ...r,
      hotel: hotels.find(h => h.id === (r as any).id_hotel || h.id === (r as any).hotelId)?.nombre || nombreRedHoteles
    }));
  }, [rooms, hotels, nombreRedHoteles]);

  const availableRooms = useMemo(() => {
    return mappedRooms.filter(r => r.disponible && (filterHotelId === 'all' || (r as any).id_hotel === filterHotelId));
  }, [mappedRooms, filterHotelId]);

  const sortedRooms = useMemo(() => {
    const seen = new Set<string>();
    const filtered = mappedRooms.filter(r => filterHotelId === 'all' || (r as any).id_hotel === filterHotelId);
    const av = filtered.filter(r => r.disponible);
    const unav = filtered.filter(r => !r.disponible);
    return [
      ...av,
      ...unav,
    ].filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  }, [mappedRooms, filterHotelId]);
  // Usar fecha local para evitar desfase UTC (Honduras UTC-6)
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

  /* ── Date helpers ── */
  const addDays = (base: string, n: number) => {
    const d = new Date(base + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const fmtDate = (s: string) => {
    if (!s) return '';
    const [, m, d] = s.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${Number(d)} ${months[Number(m) - 1]}`;
  };

  /* ── Time options (12h AM/PM) ── */
  const buildTimeOptions = (minHour24: number, maxHour24: number) => {
    const opts: { label: string; value: string }[] = [];
    for (let h = minHour24; h <= maxHour24; h++) {
      const ampm = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const val = `${String(h).padStart(2, '0')}:00`;
      opts.push({ label: `${h12}:00 ${ampm}`, value: val });
    }
    return opts;
  };
  // Check-in: desde 2 PM (14:00) hasta 11 PM — Check-out: hasta 12 PM (mediodía)
  const checkInTimeOpts = buildTimeOptions(14, 23);
  const checkOutTimeOpts = buildTimeOptions(6, 12);

  const handleCheckIn = (val: string) => {
    setFilterCheckIn(val);
    if (!filterCheckOut || filterCheckOut <= val) setFilterCheckOut(addDays(val, 1));
  };
  const nextFriday = () => {
    const day = _now.getDay();
    const diff = (5 - day + 7) % 7 || 7;
    return addDays(today, diff);
  };
  const quickPresets = [
    { label: 'Hoy', ci: today, co: addDays(today, 1) },
    { label: 'Mañana', ci: addDays(today, 1), co: addDays(today, 2) },
    { label: 'Fin de semana', ci: nextFriday(), co: addDays(nextFriday(), 2) },
  ];

  /* ── Handlers ── */
  const goToStep = (step: WizardStep) => {
    setWizardStep(step);
    if (step > maxWizardStep) setMaxWizardStep(step);
  };

  const selectRoom = (room: RoomPublic) => {
    setReservaRoom(room);
    if (!filterCheckIn || !filterCheckOut || filterAdultos < 1) {
      goToStep(1);
    } else {
      goToStep(3);
    }
  };

  const validateCheckoutFields = (): string | null => {
    if (!formDni.trim()) return 'El DNI o documento es obligatorio.';
    if (formDni.trim().length < 5) return 'El DNI o documento debe tener al menos 5 caracteres.';
    
    if (!formNombre.trim()) return 'El nombre completo es obligatorio.';
    if (formNombre.trim().length < 3) return 'El nombre completo debe tener al menos 3 caracteres.';
    const nameRegex = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]{3,}$/;
    if (!nameRegex.test(formNombre.trim())) return 'El nombre completo solo debe contener letras y espacios.';

    if (!formCorreo.trim()) return 'El correo electrónico es obligatorio.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formCorreo.trim())) return 'El correo electrónico no tiene un formato válido.';

    if (!formLocalPhone.trim()) return 'El teléfono es obligatorio.';
    if (formLocalPhone.trim().length < 6 || formLocalPhone.trim().length > 12) {
      return 'El número de teléfono debe tener entre 6 y 12 dígitos.';
    }

    return null;
  };

  const handleSubmitReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservaRoom) return;
    
    const validationError = validateCheckoutFields();
    if (validationError) {
      setFeedback({ type: 'err', msg: validationError });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const fullPhone = `${formCountryCode} ${formLocalPhone.trim()}`;
      const res = await fetch(`${API}/api/public/solicitud-reserva`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          correo: formCorreo.trim(),
          telefono: fullPhone,
          dni: formDni.trim(),
          habitacionId: reservaRoom.id,
          checkIn: `${filterCheckIn}T${filterHoraIn}:00`,
          checkOut: `${filterCheckOut}T${filterHoraOut}:00`,
          adultos: filterAdultos,
          ninos: filterNinos,
          cama_extra: formCamaExtra,
          limpieza_diaria: formLimpiezaDiaria,
          neverita: formNeverita,
          plancha: formPlancha,
          observaciones: [
            formObs.trim(),
            travelProfile ? `Perfil: ${travelProfile}` : '',
          ].filter(Boolean).join(' | ') || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessData({
          nombre: formNombre.trim(),
          habitacion: (reservaRoom as any).nombreAlias ?? (reservaRoom as any).nombre_alias ?? reservaRoom.nombre,
          checkIn: filterCheckIn,
          checkOut: filterCheckOut,
          correo: formCorreo.trim() || undefined,
          telefono: fullPhone || undefined,
        });
        setShowSuccessModal(true);
        // Refrescar lista de habitaciones disponibles inmediatamente
        void fetchRooms();
        setFormNombre(''); setFormCorreo(''); setFormLocalPhone(''); setFormObs(''); setFormDni('');
        setFormCamaExtra(false); setFormLimpiezaDiaria(false); setFormNeverita(false); setFormPlancha(false);
        setReservaRoom(null);
        setWizardStep(1);
        setMaxWizardStep(1);
      } else {
        setFeedback({ type: 'err', msg: data.message ?? data.error ?? 'Error al enviar la solicitud.' });
      }
    } catch {
      setFeedback({ type: 'err', msg: 'No se pudo conectar con el servidor.' });
    } finally {
      setSubmitting(false);
    }
  };

  const navTo = (s: PortalSection) => {
    setSection(s);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */
  return (
    <div className="portal-root" data-theme={darkMode ? 'dark' : 'light'}>

      {/* ══ WELCOME MODAL ══ */}
      <AnimatePresence>
        {showWelcomeModal && (
          <motion.div
            className="portal-welcome-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="portal-welcome-modal glass"
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            >
              <div className="portal-welcome-brand">
                <span className="portal-logo-icon" style={{ fontSize: 28 }}>◆</span>
                <strong>{nombreRedHoteles}</strong>
              </div>
              <h2>Bienvenido</h2>
              <p className="portal-muted">Para personalizar tu experiencia y facilitar tu reserva, déjanos saber quién eres.</p>

              {/* OAuth quick entry */}
              <div className="portal-welcome-oauth">
                <button type="button" className="btn portal-welcome-oauth-btn" onClick={() => void handleSocialLogin('google')} disabled={authLoading}>
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                  Continuar con Google
                </button>
              </div>

              <div className="portal-welcome-divider"><span>o ingresa tus datos</span></div>

              <div className="portal-welcome-tabs">
                <button
                  type="button"
                  className={`portal-welcome-tab ${welcomeTab === 'existing' ? 'active' : ''}`}
                  onClick={() => { setWelcomeTab('existing'); setWError(''); }}
                >
                  Ya soy Cliente
                </button>
                <button
                  type="button"
                  className={`portal-welcome-tab ${welcomeTab === 'new' ? 'active' : ''}`}
                  onClick={() => { setWelcomeTab('new'); setWError(''); }}
                >
                  Soy cliente nuevo
                </button>
              </div>

              <form onSubmit={handleWelcomeSubmit} className="portal-welcome-form">
                <label>
                  <span>DNI o Documento de Identidad *</span>
                  <input className="input" value={wDni} onChange={e => { setWDni(e.target.value); setWError(''); }} placeholder="Ej: 0801199012345" autoFocus required />
                </label>
                <label>
                  <span>Nombre completo *</span>
                  <input className="input" value={wName} onChange={e => { setWName(e.target.value); setWError(''); }} placeholder="Ej: María García" required />
                </label>
                
                {welcomeTab === 'new' && (
                  <>
                    <label>
                      <span>Correo electrónico *</span>
                      <input className="input" type="email" value={wEmail} onChange={e => { setWEmail(e.target.value); setWError(''); }} placeholder="correo@ejemplo.com" required />
                    </label>
                    <label>
                      <span>Teléfono *</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select
                          className="input"
                          style={{ width: '120px', padding: '8px', cursor: 'pointer' }}
                          value={wCountryCode}
                          onChange={e => { setWCountryCode(e.target.value); setWError(''); }}
                        >
                          {COUNTRY_CODES.map(c => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          style={{ flex: 1 }}
                          value={wLocalPhone}
                          onChange={e => { setWLocalPhone(e.target.value.replace(/\D/g, '')); setWError(''); }}
                          placeholder="Ej: 99998888"
                          required
                        />
                      </div>
                    </label>
                  </>
                )}

                {wError && <p className="portal-welcome-error">{wError}</p>}
                <motion.button
                  type="submit"
                  className="btn portal-btn-primary portal-btn-lg"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {welcomeTab === 'existing' ? 'Entrar al portal' : 'Registrar y Entrar'}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ROOM DETAIL MODAL ══ */}
      <AnimatePresence>
        {roomDetail && (
          <RoomDetailModal
            room={roomDetail}
            nights={nights}
            tipoCambio={tipoCambio}
            onClose={() => setRoomDetail(null)}
            onSelect={() => { selectRoom(roomDetail); navTo('reservar'); setRoomDetail(null); }}
            onOpen360={(url, name) => { setActive360Url(url); setActive360Name(name); }}
          />
        )}
      </AnimatePresence>

      {/* ══ ROOM 360 DEGREE TOUR MODAL ══ */}
      {active360Url && (
        <Room360Viewer
          imageUrl={active360Url}
          roomName={active360Name}
          onClose={() => setActive360Url(null)}
        />
      )}

      {/* ══ SUCCESS MODAL ══ */}
      <AnimatePresence>
        {showSuccessModal && successData && (
          <motion.div
            className="portal-welcome-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowSuccessModal(false); fetchRooms(); navTo('home'); }}
          >
            <motion.div
              className="portal-success-modal glass"
              initial={{ opacity: 0, y: 40, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="portal-success-icon-wrap">
                <motion.div
                  className="portal-success-icon"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.15 }}
                >
                  ✓
                </motion.div>
              </div>
              <h2>¡Reserva confirmada!</h2>
              <p className="portal-muted">Tu solicitud fue recibida con éxito.</p>

              <div className="portal-success-summary">
                <div className="portal-success-row">
                  <span>Huésped</span>
                  <strong>{successData.nombre}</strong>
                </div>
                <div className="portal-success-row">
                  <span>Habitación</span>
                  <strong>{successData.habitacion}</strong>
                </div>
                <div className="portal-success-row">
                  <span>Check-in</span>
                  <strong>{new Date(successData.checkIn).toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                </div>
                <div className="portal-success-row">
                  <span>Check-out</span>
                  <strong>{new Date(successData.checkOut).toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
                </div>
              </div>

              <div className="portal-success-notice">
                <span className="portal-success-notice-icon">📞</span>
                <p>Nuestros asesores te contactarán pronto para <strong>confirmar tu reserva</strong> y resolver cualquier duda.</p>
              </div>

              <motion.button
                className="btn portal-btn-primary portal-btn-lg"
                onClick={() => { setShowSuccessModal(false); fetchRooms(); navTo('home'); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Volver al inicio
              </motion.button>
              <button
                type="button"
                className="btn portal-btn-secondary portal-btn-lg"
                style={{ marginLeft: 12 }}
                onClick={() => {
                  // Abrir chat y preconectar con recepción usando los datos de la reserva
                  try {
                    const message = successData
                      ? `Hola, acabo de realizar una reserva: ${successData.habitacion} (Check-in: ${new Date(successData.checkIn).toLocaleDateString('es-HN')}, Check-out: ${new Date(successData.checkOut).toLocaleDateString('es-HN')}). ¿Pueden confirmarla, por favor?`
                      : 'Hola, necesito asistencia con mi reserva.';
                    const detail = {
                      name: successData?.nombre ?? '',
                      email: successData?.correo ?? '',
                      phone: successData?.telefono ?? '',
                      autoStart: true,
                      message,
                    };
                    window.dispatchEvent(new CustomEvent('portal-chat-open', { detail }));
                  } catch (e) { /* silent */ }
                  setShowSuccessModal(false);
                  void fetchRooms();
                }}
              >
                Escribir a recepción
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="portal-nav">
        <div className="portal-nav-brand" onClick={() => navTo('home')} style={{ cursor: 'pointer' }}>
          <span className="portal-logo-icon">◆</span>
          <strong>{nombreRedHoteles}</strong>
        </div>
        <button className="portal-mobile-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menú">
          {mobileMenuOpen ? '×' : '☰'}
        </button>
        <div className={`portal-nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          {(['home', 'habitaciones', 'reservar', 'novedades', 'info'] as PortalSection[]).map(s => (
            <button key={s} className={`portal-nav-link ${section === s ? 'active' : ''}`} onClick={() => navTo(s)}>
              {s === 'home' ? 'Inicio' : s === 'habitaciones' ? 'Habitaciones' : s === 'reservar' ? 'Reservar' : s === 'novedades' ? 'Guía Local' : 'Info'}
            </button>
          ))}
          <button className="portal-nav-link portal-nav-admin" onClick={() => navigate('/auth')}>
            Panel Admin
          </button>
          <button
            className="portal-dark-toggle"
            onClick={() => setDarkMode(d => !d)}
            aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          {portalUser ? (
            <div className="portal-user-pill">
              {portalUser.avatar && <img src={portalUser.avatar} alt="" className="portal-user-avatar" referrerPolicy="no-referrer" />}
              <span className="portal-user-name">{portalUser.name.split(' ')[0]}</span>
              <button className="portal-user-logout" onClick={handleLogout} title="Cerrar sesión">×</button>
            </div>
          ) : (
            <div className="portal-social-login-nav">
              <button className="portal-social-btn portal-social-google" onClick={() => void handleSocialLogin('google')} disabled={authLoading} title="Iniciar con Google">
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              </button>
              <button className="portal-social-btn portal-social-fb" onClick={() => void handleSocialLogin('facebook')} disabled={authLoading} title="Iniciar con Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <main className="portal-main-b2c">
        {loading ? (
          <div className="portal-loading">
            <div className="portal-spinner" />
            <p>Cargando experiencia…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* ════════════════════════════
               HOME — Immersive Landing
               ════════════════════════════ */}
            {section === 'home' && (
              <motion.div key="home" className="portal-section" {...fadeUp}>
                {/* Hero */}
                <div className="portal-hero-immersive">
                  <ParticleBackground />
                  <div className="portal-hero-content">
                    <motion.h1
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                    >
                      Tu próxima experiencia <span className="portal-hero-accent">extraordinaria</span>
                    </motion.h1>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                    >
                      Reserva con confianza. Vive con elegancia.
                    </motion.p>

                    {/* Hero CTA */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.5 }}
                      style={{ marginTop: 8 }}
                    >
                      <motion.button
                        className="btn portal-btn-primary portal-btn-lg portal-hero-cta-btn"
                        onClick={() => navTo('reservar')}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        🔍 Consultar disponibilidad
                      </motion.button>
                    </motion.div>
                  </div>
                </div>

                {/* Travel Profile Selection */}
                <motion.div className="portal-profile-picker" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                  <h2>¿Qué tipo de viaje planeas?</h2>
                  <div className="portal-profile-cards">
                    <motion.button
                      className={`portal-profile-card glass ${travelProfile === 'ejecutivo' ? 'selected' : ''}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTravelProfile(travelProfile === 'ejecutivo' ? null : 'ejecutivo')}
                    >
                      <svg className="portal-profile-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="20" y="55" width="80" height="25" rx="4" fill="rgba(37,99,235,.12)" stroke="rgba(37,99,235,.3)" strokeWidth="1.5" />
                        <rect x="40" y="45" width="40" height="12" rx="3" fill="rgba(37,99,235,.18)" stroke="rgba(37,99,235,.3)" strokeWidth="1.5" />
                        <rect x="28" y="60" width="16" height="14" rx="2" fill="rgba(37,99,235,.25)" />
                        <rect x="52" y="60" width="16" height="14" rx="2" fill="rgba(37,99,235,.25)" />
                        <rect x="76" y="60" width="16" height="14" rx="2" fill="rgba(37,99,235,.25)" />
                        <path d="M30 42 Q60 20 90 42" stroke="rgba(37,99,235,.25)" strokeWidth="2" fill="none" strokeDasharray="4 3" />
                        <circle cx="60" cy="30" r="10" fill="rgba(37,99,235,.15)" stroke="rgba(37,99,235,.35)" strokeWidth="1.5" />
                        <path d="M56 30 l3 3 6-6" stroke="rgba(37,99,235,.7)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <h3>Negocios</h3>
                      <p>Wi-Fi premium, escritorio, lavandería express y cercanía a centros financieros</p>
                    </motion.button>
                    <motion.button
                      className={`portal-profile-card glass ${travelProfile === 'vacacional' ? 'selected' : ''}`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setTravelProfile(travelProfile === 'vacacional' ? null : 'vacacional')}
                    >
                      <svg className="portal-profile-svg" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <ellipse cx="60" cy="72" rx="40" ry="8" fill="rgba(34,197,94,.1)" />
                        <path d="M60 70 Q60 30 80 20 Q60 40 40 20 Q60 30 60 70Z" fill="rgba(34,197,94,.3)" stroke="rgba(34,197,94,.5)" strokeWidth="1" />
                        <circle cx="28" cy="35" r="14" fill="rgba(251,191,36,.2)" stroke="rgba(251,191,36,.4)" strokeWidth="1.5" />
                        <path d="M28 28 L28 42 M21 35 L35 35 M23 30 L33 40 M23 40 L33 30" stroke="rgba(251,191,36,.6)" strokeWidth="1.5" />
                        <path d="M55 68 Q58 50 60 70" stroke="rgba(34,197,94,.6)" strokeWidth="2" fill="none" />
                        <ellipse cx="88" cy="62" rx="12" ry="6" fill="rgba(37,99,235,.15)" stroke="rgba(37,99,235,.3)" strokeWidth="1" />
                      </svg>
                      <h3>Descanso</h3>
                      <p>Vistas panorámicas, spa, desayunos premium y actividades recreativas</p>
                    </motion.button>
                  </div>
                </motion.div>

                {/* Stats */}
                <motion.div className="portal-stats-row" variants={stagger} initial="initial" animate="animate">
                  {[
                    { value: rooms.length, label: 'Habitaciones', icon: '' },
                    { value: hotels.length, label: hotels.length === 1 ? 'Sede' : 'Sedes', icon: '' },
                    { value: availableRooms.length, label: 'Disponibles hoy', icon: '' },
                    { value: '4.8', label: 'Calificación', icon: '' },
                  ].map((s, i) => (
                    <motion.div key={i} className="portal-stat-card glass" variants={fadeUp}>
                      <strong>{s.value}</strong>
                      <span>{s.label}</span>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Featured rooms */}
                {availableRooms.length > 0 && (
                  <div className="portal-featured">
                    <h2>Habitaciones destacadas</h2>
                    <div className="portal-featured-grid">
                      {availableRooms.slice(0, 3).map((room) => (
                        <motion.div
                          key={room.id}
                          className="portal-featured-card glass"
                          variants={cardHover}
                          initial="rest"
                          whileHover="hover"
                        >
                          <div className="portal-room-gradient" />
                          <div className="portal-featured-content">
                            <div className="portal-featured-header">
                              <h3>{(room as any).nombreAlias ?? (room as any).nombre_alias ?? room.nombre}</h3>
                              {room.tipo && <span className="portal-pill-type">{room.tipo}</span>}
                            </div>
                            <div className="portal-featured-amenities">
                              {getRoomAmenities(room.tipo, room.comodidades).slice(0, 4).map(a => (
                                <span key={a.label} className="portal-amenity-tag">{a.icono} {a.label}</span>
                              ))}
                            </div>
                            <div className="portal-featured-footer">
                              <div className="portal-featured-price">
                                <strong>{fmtHNL(Number(room.tarifaNoche))}</strong>
                                <small style={{ opacity: .6 }}>{fmtUSD(Number(room.tarifaNoche) / (tipoCambio || 24))}</small>
                                <span>/ noche · ISV incl.</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <motion.button
                                  className="btn portal-btn-ghost portal-btn-sm"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setRoomDetail(room)}
                                >
                                  Ver detalles
                                </motion.button>
                                <motion.button
                                  className="btn portal-btn-primary portal-btn-sm"
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => { setReservaRoom(room); navTo('reservar'); goToStep(1); }}
                                >
                                  Reservar
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Proof */}
                <div className="portal-social-proof">
                  <h2>Lo que dicen nuestros huéspedes</h2>
                  <div className="portal-reviews-grid">
                    {REVIEWS.map((r, i) => (
                      <motion.div
                        key={i}
                        className="portal-review-card glass"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <div className="portal-review-stars">{'★'.repeat(r.rating)}</div>
                        <p>&ldquo;{r.text}&rdquo;</p>
                        <div className="portal-review-author">
                          <div className="portal-review-avatar">{r.name[0]}</div>
                          <div>
                            <strong>{r.name}</strong>
                            <small>{r.date}</small>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Hotels */}
                {hotels.length > 0 && (
                  <div className="portal-hotels-preview">
                    <h2>Nuestras sedes</h2>
                    <div className="portal-hotels-grid">
                      {hotels.map(h => (
                        <motion.div key={h.id} className="portal-hotel-card glass" whileHover={{ y: -4, borderColor: 'rgba(34,197,94,.3)' }}>
                          <h3>{h.nombre}</h3>
                          {h.descripcion && <p>{h.descripcion}</p>}
                          {h.direccion && <small>📍 {h.direccion}</small>}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ════════════════════════════
               HABITACIONES
               ════════════════════════════ */}
            {section === 'habitaciones' && (
              <motion.div key="hab" className="portal-section" {...fadeUp}>
                <div className="portal-section-header">
                  <h2>Nuestras habitaciones</h2>
                  <p className="portal-muted">Filtra por fechas para ver disponibilidad en tiempo real.</p>
                </div>

                <div className="portal-date-filter glass">
                  <div className="portal-date-presets">
                    {quickPresets.map(p => (
                      <button key={p.label} className={`portal-preset-btn${filterCheckIn === p.ci && filterCheckOut === p.co ? ' active' : ''}`}
                        onClick={() => { setFilterCheckIn(p.ci); setFilterCheckOut(p.co); }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="portal-date-inputs">
                    <label>
                      <span>Llegada</span>
                      <input type="date" className="input" value={filterCheckIn} min={today} onChange={e => handleCheckIn(e.target.value)} />
                    </label>
                    <label>
                      <span>Hora llegada</span>
                      <select className="input" value={filterHoraIn} onChange={e => setFilterHoraIn(e.target.value)}>
                        {checkInTimeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Salida</span>
                      <input type="date" className="input" value={filterCheckOut} min={filterCheckIn ? addDays(filterCheckIn, 1) : today} onChange={e => setFilterCheckOut(e.target.value)} />
                    </label>
                    <label>
                      <span>Hora salida</span>
                      <select className="input" value={filterHoraOut} onChange={e => setFilterHoraOut(e.target.value)}>
                        {checkOutTimeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Hotel / Sede</span>
                      <select className="input" value={filterHotelId} onChange={e => setFilterHotelId(e.target.value)}>
                        <option value="all">Consolidado (Todos)</option>
                        {hotels.map(h => (
                          <option key={h.id} value={h.id}>{h.nombre}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {filterCheckIn && filterCheckOut && (
                    <div className="portal-date-summary">
                      {fmtDate(filterCheckIn)} → {fmtDate(filterCheckOut)}
                      {nights > 0 && <span className="portal-nights-badge">{nights} noche{nights !== 1 ? 's' : ''}</span>}
                    </div>
                  )}
                </div>

                <div className="portal-rooms-grouped">
                  {hotels
                    .filter(h => filterHotelId === 'all' || h.id === filterHotelId)
                    .map(hotel => {
                      const hotelRooms = sortedRooms.filter(r => (r as any).id_hotel === hotel.id || (r as any).hotelId === hotel.id);
                      if (hotelRooms.length === 0) return null;

                      return (
                        <div key={hotel.id} className="portal-hotel-group" style={{ marginBottom: 48 }}>
                          <div className="portal-hotel-group-header" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 20,
                            borderBottom: '2px solid rgba(34,197,94,.15)',
                            paddingBottom: 8
                          }}>
                            <span style={{ fontSize: 26 }}>🏢</span>
                            <div>
                              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-h)' }}>{hotel.nombre}</h3>
                              {hotel.direccion && <small style={{ color: 'var(--text-muted)', fontSize: 13 }}>📍 {hotel.direccion}</small>}
                            </div>
                          </div>
                          <motion.div className="portal-rooms-grid" variants={stagger} initial="initial" animate="animate">
                            {hotelRooms.map(room => (
                              <motion.div
                                key={room.id}
                                className={`portal-room-card glass ${!room.disponible ? 'portal-room-unavailable' : ''}`}
                                variants={cardHover}
                                initial="rest"
                                whileHover={room.disponible ? 'hover' : undefined}
                                layout
                              >
                                <RoomCardImage roomId={room.id} nombre={(room as any).nombreAlias ?? (room as any).nombre_alias ?? room.nombre} imagenes={room.imagenes} />
                                <div className="portal-room-card-content">
                                  <div className="portal-room-header">
                                    <h3>{(room as any).nombreAlias ?? (room as any).nombre_alias ?? ''}</h3>
                                    <span className="portal-pill-type">{room.tipo}</span>
                                  </div>
                                  <div className="portal-room-body">
                                    {room.descripcion && <p>{room.descripcion}</p>}
                                    <div className="portal-room-amenities">
                                      {getRoomAmenities(room.tipo, room.comodidades).map(a => (
                                        <span key={a.label} className="portal-amenity-tag">{a.icono} {a.label}</span>
                                      ))}
                                    </div>
                                    <div className="portal-room-meta">
                                      <span>{room.capacidad} huésped{room.capacidad > 1 ? 'es' : ''}</span>
                                      <span>{room.hotel}</span>
                                    </div>
                                    <div className="portal-room-price">
                                      <strong>{fmtHNL(Number(room.tarifaNoche))}</strong>
                                      <small style={{ opacity: .6 }}>{fmtUSD(Number(room.tarifaNoche) / (tipoCambio || 24))}</small>
                                      <span>/ noche · ISV incl.</span>
                                    </div>
                                    <div className="portal-room-extra-charge">
                                      <span>+{fmtHNL(10 * (tipoCambio || 24))} ({fmtUSD(10)}) / persona extra · noche</span>
                                    </div>
                                    {nights > 0 && room.disponible && (
                                      <div className="portal-room-total-preview">
                                        Total: {fmtHNL(Number(room.tarifaNoche) * nights)} ({fmtUSD((Number(room.tarifaNoche) * nights) / (tipoCambio || 24))}) · {nights} noche{nights !== 1 ? 's' : ''}
                                      </div>
                                    )}
                                  </div>
                                  <div className="portal-room-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {room.imagen_360 && (
                                      <motion.button
                                        className="btn btn-tour-360-trigger"
                                        style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => {
                                          setActive360Url(room.imagen_360!);
                                          setActive360Name(room.nombreAlias ?? room.nombre);
                                        }}
                                      >
                                        Recorrido 360°
                                      </motion.button>
                                    )}
                                    {room.disponible ? (
                                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                                        <motion.button
                                          className="btn portal-btn-ghost"
                                          style={{ flex: 1 }}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.97 }}
                                          onClick={() => setRoomDetail(room)}
                                        >
                                          Ver detalles
                                        </motion.button>
                                        <motion.button
                                          className="btn portal-btn-primary"
                                          style={{ flex: 1 }}
                                          whileHover={{ scale: 1.03 }}
                                          whileTap={{ scale: 0.97 }}
                                          onClick={() => { selectRoom(room); navTo('reservar'); }}
                                        >
                                          Seleccionar
                                        </motion.button>
                                      </div>
                                    ) : (
                                      <span className="portal-pill-unavailable">No disponible</span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </motion.div>
                        </div>
                      );
                    })}
                  {sortedRooms.length === 0 && <p className="portal-muted">No se encontraron habitaciones.</p>}
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════
               RESERVAR — Wizard 4 pasos
               ════════════════════════════ */}
            {section === 'reservar' && (
              <motion.div key="reservar" className="portal-section portal-wizard-container" {...fadeUp}>
                <div className="portal-section-header">
                  <h2>Reserva tu estadía</h2>
                  <p className="portal-muted">Completa los pasos para asegurar tu habitación.</p>
                </div>

                <WizardSteps current={wizardStep} onStep={goToStep} maxReached={maxWizardStep} />

                <div className="portal-wizard-body">
                  <AnimatePresence mode="wait">
                    {/* ── STEP 1: Dates ── */}
                    {wizardStep === 1 && (
                      <motion.div key="s1" className="wizard-pane" {...fadeUp}>
                        <div className="wizard-pane-inner glass">
                          <h3>Selecciona tus fechas</h3>
                          <div className="portal-date-presets" style={{ marginBottom: 14 }}>
                            {quickPresets.map(p => (
                              <button key={p.label} className={`portal-preset-btn${filterCheckIn === p.ci && filterCheckOut === p.co ? ' active' : ''}`}
                                onClick={() => { setFilterCheckIn(p.ci); setFilterCheckOut(p.co); }}>
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <div className="wizard-dates-grid">
                            <label style={{ gridColumn: '1 / -1' }}>
                              <span>Selecciona el Hotel / Sede</span>
                              <select className="input input-lg" value={filterHotelId} onChange={e => setFilterHotelId(e.target.value)}>
                                <option value="all">Consolidado (Todos los hoteles)</option>
                                {hotels.map(h => (
                                  <option key={h.id} value={h.id}>{h.nombre}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Fecha de llegada</span>
                              <input type="date" className="input input-lg" value={filterCheckIn} min={today} onChange={e => handleCheckIn(e.target.value)} />
                            </label>
                            <label>
                              <span>Hora de llegada</span>
                              <select className="input input-lg" value={filterHoraIn} onChange={e => setFilterHoraIn(e.target.value)}>
                                {checkInTimeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Fecha de salida</span>
                              <input type="date" className="input input-lg" value={filterCheckOut} min={filterCheckIn ? addDays(filterCheckIn, 1) : today} onChange={e => setFilterCheckOut(e.target.value)} />
                            </label>
                            <label>
                              <span>Hora de salida</span>
                              <select className="input input-lg" value={filterHoraOut} onChange={e => setFilterHoraOut(e.target.value)}>
                                {checkOutTimeOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Adultos</span>
                              <select className="input input-lg" value={filterAdultos} onChange={e => setFilterAdultos(Number(e.target.value))}>
                                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Niños</span>
                              <select className="input input-lg" value={filterNinos} onChange={e => setFilterNinos(Number(e.target.value))}>
                                {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </label>
                          </div>

                          {nights > 0 && (
                            <div className="wizard-nights-info">
                              <span className="portal-nights-badge">{nights} noche{nights !== 1 ? 's' : ''}</span>
                              <span className="portal-muted">{filterAdultos} adulto{filterAdultos > 1 ? 's' : ''}{filterNinos > 0 ? `, ${filterNinos} niño${filterNinos > 1 ? 's' : ''}` : ''}</span>
                            </div>
                          )}

                          <div className="wizard-actions">
                            {wizardValidation && (
                              <p className="portal-validation-msg">{wizardValidation}</p>
                            )}
                            <motion.button
                              className="btn portal-btn-primary portal-btn-lg"
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              disabled={!filterCheckIn || !filterCheckOut || filterAdultos < 1}
                              onClick={() => {
                                if (!filterCheckIn || !filterCheckOut) {
                                  setWizardValidation('Por favor, selecciona las fechas de tu viaje.');
                                  return;
                                }
                                if (filterAdultos < 1) {
                                  setWizardValidation('Debe haber al menos 1 adulto.');
                                  return;
                                }
                                setWizardValidation('');
                                goToStep(2);
                              }}
                            >
                              Siguiente: Elegir habitación →
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ── STEP 2: Room ── */}
                    {wizardStep === 2 && (
                      <motion.div key="s2" className="wizard-pane" {...fadeUp}>
                        <h3>Elige tu habitación</h3>
                        <p className="portal-muted" style={{ marginBottom: 20 }}>
                          {availableRooms.length} habitación{availableRooms.length !== 1 ? 'es' : ''} disponible{availableRooms.length !== 1 ? 's' : ''} para tus fechas
                        </p>

                        <div className="wizard-rooms-grouped">
                          {hotels
                            .filter(h => filterHotelId === 'all' || h.id === filterHotelId)
                            .map(hotel => {
                              const hotelRooms = availableRooms.filter(r => (r as any).id_hotel === hotel.id || (r as any).hotelId === hotel.id);
                              if (hotelRooms.length === 0) return null;

                              return (
                                <div key={hotel.id} className="wizard-hotel-group" style={{ marginBottom: 32 }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    marginBottom: 14,
                                    borderBottom: '1px solid var(--card-border, rgba(255,255,255,.08))',
                                    paddingBottom: 6
                                  }}>
                                    <span style={{ fontSize: 18 }}>🏢</span>
                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-h)' }}>{hotel.nombre}</h4>
                                  </div>
                                  <div className="wizard-rooms-grid">
                                    {hotelRooms.map(room => (
                                      <motion.div
                                        key={room.id}
                                        className={`wizard-room-card glass ${reservaRoom?.id === room.id ? 'selected' : ''}`}
                                        variants={cardHover}
                                        initial="rest"
                                        whileHover="hover"
                                        onClick={() => setReservaRoom(room)}
                                      >
                                        <div className="portal-room-gradient" />
                                        <div className="wizard-room-info">
                                          <div className="wizard-room-top">
                                            <h4>{(room as any).nombreAlias ?? (room as any).nombre_alias ?? room.nombre}</h4>
                                            {room.tipo && <span className="portal-pill-type">{room.tipo}</span>}
                                          </div>
                                          {room.descripcion && <p className="portal-muted">{room.descripcion}</p>}
                                          <div className="portal-room-amenities">
                                            {getRoomAmenities(room.tipo, room.comodidades).map(a => (
                                              <span key={a.label} className="portal-amenity-tag">{a.icono} {a.label}</span>
                                            ))}
                                          </div>
                                          <div className="wizard-room-bottom">
                                            <span className="portal-room-meta-inline">{room.capacidad} pers. · {room.hotel}</span>
                                            <div className="wizard-room-pricing">
                                              <strong>{fmtHNL(Number(room.tarifaNoche))}</strong>
                                              <small style={{ opacity: .6 }}>{fmtUSD(Number(room.tarifaNoche) / (tipoCambio || 24))}</small>
                                              <span>/ noche · ISV incl.</span>
                                              {nights > 0 && <small>Total: {fmtHNL(Number(room.tarifaNoche) * nights)} ({fmtUSD((Number(room.tarifaNoche) * nights) / (tipoCambio || 24))})</small>}
                                            </div>
                                          </div>
                                          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                            <motion.button
                                              className="btn portal-btn-ghost"
                                              style={{ flex: 1, padding: '8px 0', fontSize: 13 }}
                                              whileHover={{ scale: 1.02 }}
                                              whileTap={{ scale: 0.97 }}
                                              onClick={(e) => { e.stopPropagation(); setRoomDetail(room); }}
                                            >
                                              Ver detalles
                                            </motion.button>
                                            <motion.button
                                              className={`btn ${reservaRoom?.id === room.id ? 'portal-btn-primary' : 'portal-btn-secondary'}`}
                                              style={{ flex: 1, padding: '8px 0', fontSize: 13 }}
                                              whileHover={{ scale: 1.02 }}
                                              whileTap={{ scale: 0.97 }}
                                              onClick={(e) => { e.stopPropagation(); setReservaRoom(room); }}
                                            >
                                              {reservaRoom?.id === room.id ? 'Seleccionada ✓' : 'Seleccionar'}
                                            </motion.button>
                                          </div>
                                        </div>
                                        {reservaRoom?.id === room.id && (
                                          <div className="wizard-room-selected-badge">✓ Seleccionada</div>
                                        )}
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          {availableRooms.length === 0 && (
                            <div className="wizard-no-rooms glass">
                              <p>No hay habitaciones disponibles para las fechas seleccionadas.</p>
                              <button className="btn portal-btn-secondary" onClick={() => goToStep(1)}>Cambiar fechas</button>
                            </div>
                          )}
                        </div>

                        <div className="wizard-actions">
                          <button className="btn portal-btn-secondary" onClick={() => goToStep(1)}>← Fechas</button>
                          <motion.button
                            className="btn portal-btn-primary portal-btn-lg"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            disabled={!reservaRoom}
                            onClick={() => goToStep(3)}
                          >
                            Siguiente: Checkout →
                          </motion.button>
                        </div>
                      </motion.div>
                    )}

                    {/* ── STEP 3: Checkout ── */}
                    {wizardStep === 3 && (
                      <motion.div key="s3" className="wizard-pane" {...fadeUp}>
                        <h3>Confirma tu reserva</h3>

                        <div className="wizard-checkout-layout">
                          {/* Left: form */}
                          <form className="wizard-checkout-form" onSubmit={handleSubmitReservation}>
                            {/* Social login quick-fill */}
                            {!portalUser && (
                              <motion.div className="portal-social-checkout glass" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                                <p>Inicia sesión para llenar tus datos automáticamente</p>
                                <div className="portal-social-checkout-btns">
                                  <button type="button" className="btn portal-social-btn-lg" onClick={() => void handleSocialLogin('google')} disabled={authLoading}>
                                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                    Google
                                  </button>
                                  <button type="button" className="btn portal-social-btn-lg portal-social-btn-fb" onClick={() => void handleSocialLogin('facebook')} disabled={authLoading}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                    Facebook
                                  </button>
                                </div>
                                <span className="portal-social-divider">o llena manualmente</span>
                              </motion.div>
                            )}
                            {portalUser && (
                              <motion.div className="portal-social-welcome glass" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                                {portalUser.avatar && <img src={portalUser.avatar} alt="" className="portal-welcome-avatar" referrerPolicy="no-referrer" />}
                                <div>
                                  <strong>¡Hola, {portalUser.name.split(' ')[0]}!</strong>
                                  <small>{portalUser.email}</small>
                                </div>
                              </motion.div>
                            )}

                            <div className="wizard-checkout-section glass">
                              <h4>Datos del huésped</h4>
                              <div className="wizard-checkout-fields">
                                <label style={{ gridColumn: '1 / 2' }}>
                                  <span>DNI o Documento de Identidad *</span>
                                  <input className="input input-lg" value={formDni} onChange={e => setFormDni(e.target.value)} required placeholder="Ej: 0801199012345" />
                                </label>
                                <label style={{ gridColumn: '2 / -1' }}>
                                  <span>Nombre completo *</span>
                                  <input className="input input-lg" value={formNombre} onChange={e => setFormNombre(e.target.value)} required placeholder="Ej: María García" />
                                </label>
                                <label>
                                  <span>Correo electrónico *</span>
                                  <input className="input input-lg" type="email" value={formCorreo} onChange={e => setFormCorreo(e.target.value)} placeholder="correo@ejemplo.com" required />
                                </label>
                                <label>
                                  <span>Teléfono *</span>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                      className="input input-lg"
                                      style={{ width: '120px', padding: '10px 8px', cursor: 'pointer' }}
                                      value={formCountryCode}
                                      onChange={e => setFormCountryCode(e.target.value)}
                                    >
                                      {COUNTRY_CODES.map(c => (
                                        <option key={c.code} value={c.code}>
                                          {c.flag} {c.code}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      className="input input-lg"
                                      style={{ flex: 1 }}
                                      value={formLocalPhone}
                                      onChange={e => setFormLocalPhone(e.target.value.replace(/\D/g, ''))}
                                      placeholder="Ej: 99998888"
                                      required
                                    />
                                  </div>
                                </label>
                                {reservaRoom && getRoomAmenities(reservaRoom.tipo, reservaRoom.comodidades).some(a => a.label.toLowerCase().includes('cama extra')) && (
                                  <div
                                    className="users-checkbox-row"
                                    style={{
                                      gridColumn: '1 / -1',
                                      cursor: comodidadesDispo.cama_extra ? 'pointer' : 'not-allowed',
                                      display: 'flex',
                                      gap: '12px',
                                      alignItems: 'flex-start',
                                      margin: '8px 0',
                                      opacity: comodidadesDispo.cama_extra ? 1 : 0.55
                                    }}
                                    onClick={() => {
                                      if (comodidadesDispo.cama_extra) setFormCamaExtra(!formCamaExtra);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formCamaExtra}
                                      disabled={!comodidadesDispo.cama_extra}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (comodidadesDispo.cama_extra) setFormCamaExtra(e.target.checked);
                                      }}
                                      style={{ marginTop: '4px', transform: 'scale(1.2)', cursor: comodidadesDispo.cama_extra ? 'pointer' : 'not-allowed' }}
                                    />
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--text-h)', fontSize: '0.95rem' }}>
                                        Solicitar Cama Extra Unipersonal
                                        {!comodidadesDispo.cama_extra && (
                                          <span style={{ marginLeft: '8px', color: '#ff4d4f', fontWeight: '500', fontSize: '0.85rem' }}>
                                            (Sin existencias)
                                          </span>
                                        )}
                                      </strong>
                                      <span style={{ fontSize: '0.8rem', opacity: 0.8, color: 'var(--text)' }}>
                                        Adicionar 1 cama unipersonal en la habitación (Sujeto a disponibilidad. Máximo 1 por habitación).
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {reservaRoom && getRoomAmenities(reservaRoom.tipo, reservaRoom.comodidades).some(a => a.label.toLowerCase().includes('limpieza')) && (
                                  <div className="users-checkbox-row" style={{ gridColumn: '1 / -1', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start', margin: '8px 0' }} onClick={() => setFormLimpiezaDiaria(!formLimpiezaDiaria)}>
                                    <input
                                      type="checkbox"
                                      checked={formLimpiezaDiaria}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setFormLimpiezaDiaria(e.target.checked);
                                      }}
                                      style={{ marginTop: '4px', transform: 'scale(1.2)', cursor: 'pointer' }}
                                    />
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--text-h)', fontSize: '0.95rem' }}>🧹 Solicitar Servicio de Limpieza Diaria</strong>
                                      <span style={{ fontSize: '0.8rem', opacity: 0.8, color: 'var(--text)' }}>
                                        Disfruta del servicio de limpieza de habitación todos los días de tu estancia de forma gratuita.
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {reservaRoom && getRoomAmenities(reservaRoom.tipo, reservaRoom.comodidades).some(a => a.label.toLowerCase().includes('neverita')) && (
                                  <div
                                    className="users-checkbox-row"
                                    style={{
                                      gridColumn: '1 / -1',
                                      cursor: comodidadesDispo.neverita ? 'pointer' : 'not-allowed',
                                      display: 'flex',
                                      gap: '12px',
                                      alignItems: 'flex-start',
                                      margin: '8px 0',
                                      opacity: comodidadesDispo.neverita ? 1 : 0.55
                                    }}
                                    onClick={() => {
                                      if (comodidadesDispo.neverita) setFormNeverita(!formNeverita);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formNeverita}
                                      disabled={!comodidadesDispo.neverita}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (comodidadesDispo.neverita) setFormNeverita(e.target.checked);
                                      }}
                                      style={{ marginTop: '4px', transform: 'scale(1.2)', cursor: comodidadesDispo.neverita ? 'pointer' : 'not-allowed' }}
                                    />
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--text-h)', fontSize: '0.95rem' }}>
                                        🧊 Solicitar Neverita / Minibar
                                        {!comodidadesDispo.neverita && (
                                          <span style={{ marginLeft: '8px', color: '#ff4d4f', fontWeight: '500', fontSize: '0.85rem' }}>
                                            (Sin existencias)
                                          </span>
                                        )}
                                      </strong>
                                      <span style={{ fontSize: '0.8rem', opacity: 0.8, color: 'var(--text)' }}>
                                        Equipar tu habitación con una nevera portátil (Sujeto a disponibilidad del hotel. Máximo 1 por habitación).
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {reservaRoom && getRoomAmenities(reservaRoom.tipo, reservaRoom.comodidades).some(a => a.label.toLowerCase().includes('plancha')) && (
                                  <div
                                    className="users-checkbox-row"
                                    style={{
                                      gridColumn: '1 / -1',
                                      cursor: comodidadesDispo.plancha ? 'pointer' : 'not-allowed',
                                      display: 'flex',
                                      gap: '12px',
                                      alignItems: 'flex-start',
                                      margin: '8px 0',
                                      opacity: comodidadesDispo.plancha ? 1 : 0.55
                                    }}
                                    onClick={() => {
                                      if (comodidadesDispo.plancha) setFormPlancha(!formPlancha);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={formPlancha}
                                      disabled={!comodidadesDispo.plancha}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        if (comodidadesDispo.plancha) setFormPlancha(e.target.checked);
                                      }}
                                      style={{ marginTop: '4px', transform: 'scale(1.2)', cursor: comodidadesDispo.plancha ? 'pointer' : 'not-allowed' }}
                                    />
                                    <div>
                                      <strong style={{ display: 'block', color: 'var(--text-h)', fontSize: '0.95rem' }}>
                                        💨 Solicitar Plancha de Ropa
                                        {!comodidadesDispo.plancha && (
                                          <span style={{ marginLeft: '8px', color: '#ff4d4f', fontWeight: '500', fontSize: '0.85rem' }}>
                                            (Sin existencias)
                                          </span>
                                        )}
                                      </strong>
                                      <span style={{ fontSize: '0.8rem', opacity: 0.8, color: 'var(--text)' }}>
                                        Proveer una plancha de ropa en la habitación durante tu estancia (Sujeto a disponibilidad. Máximo 1 por habitación).
                                      </span>
                                    </div>
                                  </div>
                                )}
                                <label style={{ gridColumn: '1 / -1' }}>
                                  <span>Solicitudes especiales</span>
                                  <textarea className="input" rows={3} value={formObs} onChange={e => setFormObs(e.target.value)} placeholder="Hora estimada de llegada, preferencias de habitación, etc." />
                                </label>
                              </div>
                            </div>

                            {feedback && (
                              <motion.div
                                className={`portal-feedback portal-feedback-${feedback.type}`}
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                              >
                                {feedback.type === 'ok' ? '✅ ' : '⚠️ '}{feedback.msg}
                              </motion.div>
                            )}

                            <div className="wizard-actions">
                              <button type="button" className="btn portal-btn-secondary" onClick={() => goToStep(2)}>← Habitación</button>
                              <motion.button
                                className="btn portal-btn-primary portal-btn-lg portal-btn-submit"
                                type="submit"
                                disabled={submitting}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                              >
                                {submitting ? 'Procesando…' : `Confirmar reserva · ${fmtHNL(totalHNL)}`}
                              </motion.button>
                            </div>
                          </form>

                          {/* Right: Summary */}
                          <div className="wizard-checkout-summary glass">
                            <h4>Resumen de reserva</h4>

                            {reservaRoom && (
                              <div className="wizard-summary-room">
                                <strong>{(reservaRoom as any).nombreAlias ?? (reservaRoom as any).nombre_alias ?? reservaRoom.nombre}</strong>
                                <span>{reservaRoom.hotel} · {reservaRoom.tipo ?? 'Estándar'}</span>
                              </div>
                            )}

                            <div className="wizard-summary-dates">
                              <div>
                                <small>Check-in</small>
                                <strong>{filterCheckIn ? new Date(filterCheckIn + 'T12:00:00').toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</strong>
                              </div>
                              <div className="wizard-summary-arrow">→</div>
                              <div>
                                <small>Check-out</small>
                                <strong>{filterCheckOut ? new Date(filterCheckOut + 'T12:00:00').toLocaleDateString('es-HN', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}</strong>
                              </div>
                            </div>

                            <div className="wizard-summary-line">
                              <span>Tarifa / noche</span>
                              <span>{reservaRoom ? `${fmtHNL(Number(reservaRoom.tarifaNoche))}` : '—'}</span>
                            </div>
                            <div className="wizard-summary-line" style={{ opacity: .6, fontSize: '0.85rem' }}>
                              <span style={{ paddingLeft: 12 }}>({fmtHNL(reservaRoom ? Number(reservaRoom.tarifaNoche || 0) : 0)})</span>
                              <span></span>
                            </div>
                            <div className="wizard-summary-line">
                              <span>Noches</span>
                              <span>× {nights}</span>
                            </div>
                            {extrasCount > 0 && cargoExtraHNL > 0 && (
                              <>
                                <div className="wizard-summary-line wizard-summary-extras">
                                  <span>Persona{extrasCount > 1 ? 's' : ''} extra ({extrasCount}) × {nights} noche{nights !== 1 ? 's' : ''}</span>
                                  <span>{fmtHNL(subtotalExtrasHNL)}</span>
                                </div>
                                <div className="wizard-summary-line" style={{ opacity: .6, fontSize: '0.85rem' }}>
                                  <span style={{ paddingLeft: 24 }}>Cargo: {fmtHNL(cargoExtraHNL)} / persona / noche</span>
                                  <span></span>
                                </div>
                              </>
                            )}
                            {formCamaExtra && (
                              <div className="wizard-summary-line wizard-summary-extras" style={{ marginTop: '4px' }}>
                                <span>Cama extra unipersonal</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Solicitada</span>
                              </div>
                            )}
                            {formLimpiezaDiaria && (
                              <div className="wizard-summary-line wizard-summary-extras" style={{ marginTop: '4px' }}>
                                <span>🧹 Limpieza diaria</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Solicitada</span>
                              </div>
                            )}
                            {formNeverita && (
                              <div className="wizard-summary-line wizard-summary-extras" style={{ marginTop: '4px' }}>
                                <span>🧊 Neverita / Minibar</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Solicitada</span>
                              </div>
                            )}
                            {formPlancha && (
                              <div className="wizard-summary-line wizard-summary-extras" style={{ marginTop: '4px' }}>
                                <span>💨 Plancha de ropa</span>
                                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Solicitada</span>
                              </div>
                            )}
                            <div className="wizard-summary-divider" />
                            <div className="wizard-summary-line" style={{ opacity: .8 }}>
                              <span>Subtotal (sin imp.)</span>
                              <span>L {subtotalSinImpHNL.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="wizard-summary-line" style={{ opacity: .8 }}>
                              <span>ISV (15%)</span>
                              <span>L {isvHNL.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="wizard-summary-line" style={{ opacity: .8 }}>
                              <span>Turismo (4%)</span>
                              <span>L {turismoHNL.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="wizard-summary-divider" />
                            <div className="wizard-summary-line wizard-summary-total">
                              <strong>Valor Factura</strong>
                              <strong>L {totalHNL.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                            </div>
                            <div className="wizard-summary-line" style={{ opacity: .7 }}>
                              <span>Total USD</span>
                              <span>{fmtUSD(totalUSD)}</span>
                            </div>

                            <div className="wizard-summary-note">
                              <small>El pago se realiza en recepción al momento del check-in. Aceptamos efectivo y tarjetas.</small>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════
               NOVEDADES — Concierge Digital
               ════════════════════════════ */}
            {section === 'novedades' && (
              <motion.div key="nov" className="portal-section" {...fadeUp}>
                <div className="portal-section-header">
                  <h2>🗺️ Guía Local — San Pedro Sula</h2>
                  <p className="portal-muted">Tu concierge digital para descubrir lo mejor de la ciudad.</p>
                </div>

                {/* Category filter */}
                <div className="portal-guide-categories">
                  {['Todos', ...Array.from(new Set(guidePosts.map(p => p.category)))].map(cat => (
                    <button
                      key={cat}
                      className={`portal-guide-cat-btn ${guideCategory === cat ? 'active' : ''}`}
                      onClick={() => setGuideCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="portal-blog-grid">
                  {(guideCategory === 'Todos' ? guidePosts : guidePosts.filter(p => p.category === guideCategory))
                    .map((post, i) => (
                      <motion.article
                        key={post.id}
                        className="portal-blog-card glass"
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08 }}
                        whileHover={{ y: -4, borderColor: 'rgba(34,197,94,.3)' }}
                      >
                        <div className="portal-blog-icon">{post.icon}</div>
                        {post.event_date && (
                          <div className="portal-blog-date">{new Date(post.event_date + 'T00:00:00').toLocaleDateString('es-HN', { dateStyle: 'medium' })}</div>
                        )}
                        <h3>{post.title}</h3>
                        <p>{post.content}</p>
                        <span className="portal-pill-type">{post.category}</span>
                      </motion.article>
                    ))}
                  {guidePosts.length === 0 && (
                    <p className="portal-muted" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>Cargando guía local…</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* ════════════════════════════
               INFO
               ════════════════════════════ */}
            {section === 'info' && (
              <motion.div key="info" className="portal-section" {...fadeUp}>
                <div className="portal-section-header">
                  <h2>Información del hotel</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  {/* Tarjetas de hoteles */}
                  <div>
                    {hotels.map(h => (
                      <motion.div key={h.id} className="portal-info-card glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16 }}>
                        <h3>{h.nombre}</h3>
                        {h.descripcion && <p>{h.descripcion}</p>}
                        <div className="portal-info-details">
                          {h.direccion && <div><span className="portal-info-icon">📍</span> {h.direccion}</div>}
                          {h.telefono && <div><span className="portal-info-icon">📞</span> {h.telefono}</div>}
                          {h.correo && <div><span className="portal-info-icon">✉️</span> {h.correo}</div>}
                        </div>
                      </motion.div>
                    ))}
                    {hotels.length === 0 && <p className="portal-muted">Información no disponible.</p>}
                  </div>

                  {/* Políticas */}
                  <motion.div className="portal-info-policies glass" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                    <h3>Políticas generales</h3>
                    <div className="portal-policies-grid">
                      {[
                        { label: 'Check-in', value: '3:00 PM' },
                        { label: 'Check-out', value: '12:00 PM' },
                        { label: 'Moneda base', value: 'Dólares (USD)' },
                        { label: 'Tipo de cambio', value: `L ${tipoCambio.toFixed(2)} / USD` },
                        { label: 'Pagos', value: 'Efectivo y tarjetas' },
                        { label: 'ISV', value: isvPercent > 0 ? `${isvPercent}% incluido` : 'No aplica' },
                      ].map(p => (
                        <div key={p.label} className="portal-policy-item">
                          <div>
                            <strong>{p.label}</strong>
                            <span>{p.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="portal-muted" style={{ marginTop: 16, fontSize: 13 }}>
                      Las reservas están sujetas a confirmación por parte del hotel.
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="portal-footer">
        <div className="portal-footer-content">
          <div className="portal-footer-brand">
            <span className="portal-logo-icon">◆</span>
            <strong>{nombreRedHoteles}</strong>
          </div>
          <div className="portal-footer-links">
            <button onClick={() => navTo('habitaciones')}>Habitaciones</button>
            <button onClick={() => navTo('reservar')}>Reservar</button>
            <button onClick={() => navTo('novedades')}>Guía Local</button>
            <button onClick={() => navTo('info')}>Contacto</button>
          </div>
          <span className="portal-footer-copy">© {new Date().getFullYear()} {nombreRedHoteles} — Todos los derechos reservados</span>
        </div>
      </footer>

      <ChatbotWidget portalUser={portalUser} guestProfile={guestProfile} />
    </div>
  );
};

export default PortalCliente;
