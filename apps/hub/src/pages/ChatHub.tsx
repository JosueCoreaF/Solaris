import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Database, Zap, BarChart3, Building2,
  Search, Copy, Check, Trash2,
  CreditCard, BedDouble, Users, TrendingUp, Mic, MicOff, SlidersHorizontal, ArrowLeft,
  Settings, X, Volume2, VolumeX, CalendarDays, UserPlus, ChevronRight, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import NeuralOrb from '../components/NeuralOrb';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'ai';
  content: string;
  toolsUsed?: string[];
  loading?: boolean;
}

// ── Markdown simple ───────────────────────────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    // Bloques de código
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="my-3 bg-[#0e0e0f] border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-emerald-300 font-mono"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Encabezados
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-100 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-100 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-100 mt-5 mb-3">$1</h1>')
    // Negrita e itálica
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-slate-300 italic">$1</em>')
    // Tablas
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim() !== '');
      if (cells.every(c => /^[:\- ]+$/.test(c))) return '<tr data-sep="true"></tr>';
      return '<tr>' + cells.map(c => `<td class="p-4 text-sm text-slate-300 border-b border-white/5 whitespace-nowrap">${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/(?:<tr[^>]*>.*?<\/tr>\s*)+/g, (match) => {
      let rows = match.split('</tr>').filter(r => r.trim() !== '');
      let html = '<div class="overflow-hidden my-6 bg-black/40 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl">';
      html += '<div class="overflow-x-auto custom-scrollbar">';
      html += '<table class="w-full text-left border-collapse">';
      
      let hasHeader = false;
      rows.forEach((row) => {
        if (row.includes('data-sep="true"')) return;
        if (!hasHeader) {
          let headerRow = row.replace(/<td/g, '<th').replace(/td>/g, 'th>');
          headerRow = headerRow.replace(/class="[^"]*"/g, 'class="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider bg-white/5 border-b border-white/10 whitespace-nowrap"');
          html += `<thead>${headerRow}</tr></thead><tbody class="divide-y divide-white/5">`;
          hasHeader = true;
        } else {
          let bodyRow = row.replace('<tr', '<tr class="hover:bg-white/5 transition-colors duration-200"');
          html += `${bodyRow}</tr>`;
        }
      });
      html += '</tbody></table></div></div>';
      return html;
    })
    // Listas
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-slate-300 text-sm leading-relaxed marker:text-indigo-500">$1</li>')
    .replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-slate-300 text-sm leading-relaxed marker:text-indigo-500">$2</li>')
    .replace(/(?:<li[^>]*>.*?<\/li>\s*)+/g, '<ul class="my-3 space-y-1.5 p-3 bg-white/[0.02] border border-white/5 rounded-xl">$&</ul>')
    // Líneas horizontales
    .replace(/^---+$/gm, '<hr class="border-white/10 my-4" />')
    // Párrafos y saltos de línea
    .replace(/\n\n/g, '</p><p class="text-slate-300 text-sm leading-relaxed mt-3">')
    .replace(/\n/g, '<br/>');
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{
        __html: `<p class="text-slate-300 text-sm leading-relaxed">${renderMarkdown(content)}</p>`
      }}
    />
  );
}

// ── CTA button parser ─────────────────────────────────────────────────────────
function extractCTAs(text: string): { label: string; prompt: string }[] {
  const matches = [...text.matchAll(/\[([^\]]{3,60})\]/g)];
  return matches
    .map(m => ({ label: m[1], prompt: m[1] }))
    .filter(m => !/^\d+$/.test(m.label)); // excluir [1], [2] de listas
}

// ── Booking form widget ───────────────────────────────────────────────────────
interface BookingFormData {
  hotel_id: string; hotel_name: string;
  check_in: string; check_out: string;
  adultos: number; ninos: number;
  guest_email: string; guest_name: string;
  total: string; moneda: 'HNL' | 'USD';
  observaciones: string;
}

function BookingFormWidget({ hotels, onSubmit, onCancel }: {
  hotels: { id: string; nombre: string }[];
  onSubmit: (msg: string) => void;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [form, setForm] = useState<BookingFormData>({
    hotel_id: hotels[0]?.id || '', hotel_name: hotels[0]?.nombre || '',
    check_in: today, check_out: tomorrow,
    adultos: 2, ninos: 0,
    guest_email: '', guest_name: '',
    total: '', moneda: 'HNL',
    observaciones: '',
  });
  const [guestSuggestions, setGuestSuggestions] = useState<{ id: string; nombre: string; correo: string }[]>([]);
  const [searchingGuest, setSearchingGuest] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof BookingFormData, v: any) => setForm(f => ({ ...f, [k]: v }));

  const searchGuest = (q: string) => {
    set('guest_email', q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setGuestSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearchingGuest(true);
      try {
        const res = await apiClient.get(`/bookings/huespedes?search=${encodeURIComponent(q)}&limit=5`);
        const list = Array.isArray(res) ? res : (res as any)?.data || [];
        setGuestSuggestions(list.map((g: any) => ({ id: g.id_huesped, nombre: g.nombre_completo, correo: g.correo })));
      } catch { setGuestSuggestions([]); }
      finally { setSearchingGuest(false); }
    }, 350);
  };

  const nights = form.check_in && form.check_out
    ? Math.max(0, (new Date(form.check_out).getTime() - new Date(form.check_in).getTime()) / 86400000)
    : 0;

  const errors = {
    dates: form.check_out <= form.check_in,
    email: form.guest_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guest_email),
    total: form.total && isNaN(Number(form.total)),
  };
  const valid = !errors.dates && !errors.email && !errors.total && form.hotel_id && form.check_in && form.check_out;

  const handleSubmit = () => {
    const h = hotels.find(h => h.id === form.hotel_id);
    const msg = [
      `Crear reserva:`,
      `• Hotel: ${h?.nombre || form.hotel_name} (ID: ${form.hotel_id})`,
      `• Check-in: ${form.check_in}T14:00:00`,
      `• Check-out: ${form.check_out}T12:00:00`,
      `• Adultos: ${form.adultos}, Niños: ${form.ninos}`,
      form.guest_name ? `• Huésped: ${form.guest_name} — ${form.guest_email}` : form.guest_email ? `• Huésped: ${form.guest_email}` : '• Busca o crea el huésped que corresponda',
      form.total ? `• Total: ${form.total} ${form.moneda}` : '• Calcula el total según la tarifa de la habitación',
      form.observaciones ? `• Observaciones: ${form.observaciones}` : '',
    ].filter(Boolean).join('\n');
    onSubmit(msg);
  };

  const inp = 'w-full bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors';
  const lbl = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1';

  return (
    <div className="bg-[#0a0a14] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-500/10 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-indigo-300">Formulario de Reserva</span>
        </div>
        <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 space-y-3">
        {/* Hotel */}
        <div>
          <label className={lbl}>Hotel</label>
          <select className={inp} value={form.hotel_id}
            onChange={e => { const h = hotels.find(h => h.id === e.target.value); set('hotel_id', e.target.value); set('hotel_name', h?.nombre || ''); }}>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>Check-in</label>
            <input type="date" className={`${inp} ${errors.dates ? 'border-red-500/50' : ''}`}
              min={today} value={form.check_in} onChange={e => set('check_in', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Check-out {nights > 0 && <span className="text-indigo-400 normal-case">({nights} noche{nights !== 1 ? 's' : ''})</span>}</label>
            <input type="date" className={`${inp} ${errors.dates ? 'border-red-500/50' : ''}`}
              min={form.check_in || today} value={form.check_out} onChange={e => set('check_out', e.target.value)} />
            {errors.dates && <p className="text-[10px] text-red-400 mt-0.5">Salida debe ser posterior a entrada</p>}
          </div>
        </div>

        {/* Guests count */}
        <div className="grid grid-cols-2 gap-2">
          {[{ k: 'adultos', label: 'Adultos', min: 1 }, { k: 'ninos', label: 'Niños', min: 0 }].map(({ k, label, min }) => (
            <div key={k}>
              <label className={lbl}>{label}</label>
              <div className="flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-1.5">
                <button type="button" onClick={() => set(k as any, Math.max(min, (form as any)[k] - 1))}
                  className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 flex items-center justify-center text-sm">−</button>
                <span className="flex-1 text-center text-sm font-bold text-slate-200">{(form as any)[k]}</span>
                <button type="button" onClick={() => set(k as any, (form as any)[k] + 1)}
                  className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 flex items-center justify-center text-sm">+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Guest search */}
        <div className="relative">
          <label className={lbl}>Huésped (correo o nombre)</label>
          <div className="relative">
            <input className={`${inp} pr-8 ${errors.email ? 'border-red-500/50' : ''}`}
              placeholder="correo@ejemplo.com" value={form.guest_email}
              onChange={e => searchGuest(e.target.value)} />
            {searchingGuest && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 animate-spin" />}
          </div>
          {errors.email && <p className="text-[10px] text-red-400 mt-0.5">Formato de correo inválido</p>}
          {guestSuggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              {guestSuggestions.map(g => (
                <button key={g.id} type="button"
                  onClick={() => { set('guest_email', g.correo); set('guest_name', g.nombre); setGuestSuggestions([]); }}
                  className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                  <p className="text-xs font-semibold text-slate-200">{g.nombre}</p>
                  <p className="text-[10px] text-slate-500">{g.correo}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className={lbl}>Total estimado (opcional)</label>
            <input type="number" min="0" className={`${inp} ${errors.total ? 'border-red-500/50' : ''}`}
              placeholder="La IA lo calcula" value={form.total} onChange={e => set('total', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Moneda</label>
            <select className={inp} value={form.moneda} onChange={e => set('moneda', e.target.value as any)}>
              <option value="HNL">HNL</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={lbl}>Observaciones (opcional)</label>
          <textarea className={`${inp} resize-none`} rows={2} placeholder="Llegada tardía, petición especial..."
            value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-white/10 text-slate-400 text-xs font-semibold hover:bg-white/5 transition-colors">
            Cancelar
          </button>
          <button type="button" disabled={!valid} onClick={handleSubmit}
            className="flex-2 flex-grow py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            <Send className="w-3 h-3" /> Enviar a Solaris AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tool badge ────────────────────────────────────────────────────────────────
type ToolCategory = 'Consultas' | 'Operaciones' | 'Reservas' | 'Huéspedes' | 'Sistema';

const TOOL_LABELS: Record<string, { label: string; color: string; description: string; category: ToolCategory }> = {
  get_businesses:       { label: 'Ver Negocios',      color: 'text-blue-400 bg-blue-400/10', description: 'Permite a la IA consultar la lista de todos los hoteles y negocios del propietario.', category: 'Consultas' },
  get_hotel_info:       { label: 'Info. del Hotel',   color: 'text-indigo-400 bg-indigo-400/10', description: 'Obtiene detalles específicos, configuración y listado de habitaciones de un hotel.', category: 'Consultas' },
  get_reservations:     { label: 'Ver Reservas',      color: 'text-amber-400 bg-amber-400/10', description: 'Consulta el historial o reservas activas con filtros de estado y fechas.', category: 'Reservas' },
  get_rooms:            { label: 'Ver Habitaciones',  color: 'text-emerald-400 bg-emerald-400/10', description: 'Muestra todas las habitaciones, sus tarifas, comodidades y estado actual.', category: 'Consultas' },
  get_guests:           { label: 'Ver Huéspedes',     color: 'text-cyan-400 bg-cyan-400/10', description: 'Busca en el directorio de huéspedes registrados del hotel.', category: 'Huéspedes' },
  get_payments:         { label: 'Ver Pagos',         color: 'text-green-400 bg-green-400/10', description: 'Consulta el historial de pagos recientes vinculados a reservas.', category: 'Consultas' },
  get_metrics:          { label: 'Métricas',          color: 'text-purple-400 bg-purple-400/10', description: 'Calcula ingresos, ocupación y resumen de reservas del mes.', category: 'Consultas' },
  update_reservation:   { label: 'Editar Reserva',    color: 'text-orange-400 bg-orange-400/10', description: 'Permite modificar notas, cantidad de personas o montos de una reserva.', category: 'Reservas' },
  check_in:             { label: 'Hacer Check-in',    color: 'text-teal-400 bg-teal-400/10', description: 'Registra la entrada física del huésped y ocupa la habitación.', category: 'Operaciones' },
  check_out:            { label: 'Hacer Check-out',   color: 'text-sky-400 bg-sky-400/10', description: 'Registra la salida del huésped y libera la habitación.', category: 'Operaciones' },
  cancel_reservation:   { label: 'Cancelar Reserva',  color: 'text-red-400 bg-red-400/10', description: 'Anula una reserva y guarda un motivo de cancelación.', category: 'Reservas' },
  register_payment:     { label: 'Registrar Pago',    color: 'text-lime-400 bg-lime-400/10', description: 'Crea un abono o pago total a una reserva activa.', category: 'Operaciones' },
  update_room:          { label: 'Editar Habitación', color: 'text-violet-400 bg-violet-400/10', description: 'Cambia el estado (ej. mantenimiento) o tarifa de una habitación.', category: 'Operaciones' },
  get_available_rooms:  { label: 'Disponibilidad',    color: 'text-yellow-400 bg-yellow-400/10', description: 'Cruza fechas para encontrar qué habitaciones están libres.', category: 'Reservas' },
  create_guest:         { label: 'Crear Huésped',     color: 'text-cyan-400 bg-cyan-400/10', description: 'Registra los datos de un cliente nuevo en el directorio.', category: 'Huéspedes' },
  create_reservation:   { label: 'Crear Reserva',     color: 'text-emerald-400 bg-emerald-400/10', description: 'Efectúa una nueva reserva desde cero bloqueando disponibilidad.', category: 'Reservas' },
  search_database:      { label: 'Acceso a BD',       color: 'text-slate-400 bg-slate-400/10', description: 'Realiza consultas SQL de solo lectura directas a la base de datos.', category: 'Sistema' },
};

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Sugerencias ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: <BarChart3 className="w-4 h-4 text-amber-400" />, title: 'Métricas del mes', prompt: 'Dame las métricas y resumen financiero de este mes para todos mis hoteles.' },
  { icon: <BedDouble className="w-4 h-4 text-emerald-400" />, title: 'Nueva reserva', prompt: 'Quiero crear una reserva nueva. ¿Qué información necesitas?' },
  { icon: <Users className="w-4 h-4 text-blue-400" />, title: 'Reservas de hoy', prompt: '¿Qué reservas tienen check-in o check-out hoy?' },
  { icon: <CreditCard className="w-4 h-4 text-purple-400" />, title: 'Pagos pendientes', prompt: '¿Cuáles reservas tienen estado de pago "deuda" o "abonada"?' },
  { icon: <TrendingUp className="w-4 h-4 text-rose-400" />, title: 'Habitaciones libres', prompt: '¿Qué habitaciones están disponibles este fin de semana?' },
  { icon: <Building2 className="w-4 h-4 text-cyan-400" />, title: 'Mis negocios', prompt: 'Muéstrame un resumen de todos mis negocios y su estado.' },
  { icon: <Search className="w-4 h-4 text-indigo-400" />, title: 'Buscar huésped', prompt: 'Busca el huésped más reciente registrado en el hotel.' },
  { icon: <Zap className="w-4 h-4 text-yellow-400" />, title: '¿Qué puedes hacer?', prompt: '¿Qué acciones y consultas puedes realizar sobre mi base de datos?' },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChatHub() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>(() => {
    const s = localStorage.getItem('ai_enabled_tools');
    if (s) return JSON.parse(s);
    const initial: Record<string, boolean> = {};
    Object.keys(TOOL_LABELS).forEach(k => initial[k] = true);
    return initial;
  });

  const toggleTool = (tool: string) => {
    setEnabledTools(prev => {
      const next = { ...prev, [tool]: !prev[tool] };
      localStorage.setItem('ai_enabled_tools', JSON.stringify(next));
      return next;
    });
  };
  // ── TTS ──────────────────────────────────────────────────────────────────────
  const [ttsActive, setTtsActive] = useState(false);
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#`_~\[\]]/g, '').slice(0, 600);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = 'es-ES'; utt.rate = 1.05;
    utt.onend = () => setTtsActive(false);
    utt.onerror = () => setTtsActive(false);
    setTtsActive(true);
    window.speechSynthesis.speak(utt);
  };
  const stopSpeaking = () => { window.speechSynthesis.cancel(); setTtsActive(false); };

  // ── Hoteles pre-cargados para el formulario ───────────────────────────────
  const [knownHotels, setKnownHotels] = useState<{ id: string; nombre: string }[]>([]);
  useEffect(() => {
    apiClient.get('/bookings/hoteles').then((data: any) => {
      const list = Array.isArray(data) ? data : [];
      setKnownHotels(list.map((h: any) => ({ id: h.id_hotel, nombre: h.nombre_hotel })));
    }).catch(() => {});
  }, []);

  // ── Formulario de reserva ─────────────────────────────────────────────────
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [currentContext, setCurrentContext] = useState<string | null>(null);

  // ── Cmd+K → enfocar textarea ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const [voiceError, setVoiceError]     = useState('');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceLevel, setVoiceLevel]     = useState(0);
  const [mode, setMode] = useState<'idle'|'listening'|'transcribing'|'enrolling'|'wake'>('idle');
  const [silenceThreshold, setSilenceThreshold] = useState(() => Number(localStorage.getItem('voice_threshold') || 8));
  const [voicePrint, setVoicePrint] = useState<number[] | null>(() => {
    const s = localStorage.getItem('voice_print');
    return s ? JSON.parse(s) : null;
  });
  const [voiceMatchThreshold, setVoiceMatchThreshold] = useState(() => Number(localStorage.getItem('voice_match') || 0.78));

  // ── Wake word & close words ───────────────────────────────────────────────
  const [wakeWord,   setWakeWord]   = useState(() => localStorage.getItem('voice_wake_word')   || 'solaris');
  const [closeWords, setCloseWords] = useState(() => (localStorage.getItem('voice_close_words') || 'cancelar,parar,detener,stop').split(',').map(w => w.trim()).filter(Boolean));
  const [autoSend,   setAutoSend]   = useState(() => localStorage.getItem('voice_auto_send') !== 'false');
  const wakeWordRef   = useRef(wakeWord);
  const closeWordsRef = useRef(closeWords);
  const autoSendRef   = useRef(autoSend);
  const wakeRecogRef  = useRef<any>(null);
  const sendRef       = useRef<((t: string) => Promise<void>) | null>(null);

  useEffect(() => { wakeWordRef.current   = wakeWord;   localStorage.setItem('voice_wake_word', wakeWord); }, [wakeWord]);
  useEffect(() => { closeWordsRef.current = closeWords; localStorage.setItem('voice_close_words', closeWords.join(',')); }, [closeWords]);
  useEffect(() => { autoSendRef.current   = autoSend;   localStorage.setItem('voice_auto_send', String(autoSend)); }, [autoSend]);

  const listening = mode === 'listening' || mode === 'transcribing';

  const chatEndRef      = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const freqDataRef     = useRef<Uint8Array | null>(null);
  const volTickRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef         = useRef<'idle'|'listening'|'transcribing'|'enrolling'|'wake'>('idle');
  const silenceThresholdRef    = useRef(Number(localStorage.getItem('voice_threshold') || 8));
  const voicePrintRef          = useRef<number[] | null>(null);
  const voiceMatchThresholdRef = useRef(Number(localStorage.getItem('voice_match') || 0.78));

  // Sincronizar voicePrint al ref
  useEffect(() => { voicePrintRef.current = voicePrint; }, [voicePrint]);

  const setModeBoth = (m: typeof mode) => { modeRef.current = m; setMode(m); };

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const orbState = !isOnline
    ? 'offline'
    : isTyping
      ? 'thinking'
      : (mode === 'listening' || mode === 'transcribing' || mode === 'enrolling' || mode === 'wake')
        ? 'listening'
        : 'idle';

  // ── Similitud coseno entre FFT actual y firma guardada ────────────────────
  const cosineSimilarity = (a: Uint8Array, b: number[]): number => {
    let dot = 0, magA = 0, magB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom > 0 ? dot / denom : 0;
  };

  // ── Registro de voz: graba 4s y guarda firma espectral ────────────────────
  const enrollVoice = async () => {
    if (modeRef.current !== 'idle') return;
    setVoiceError('');
    setModeBoth('enrolling');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const samples: Uint8Array[] = [];

      await new Promise<void>(resolve => {
        let ticks = 0;
        const collect = () => {
          if (ticks >= 40) { resolve(); return; } // 4 segundos
          analyser.getByteFrequencyData(data);
          const vol = data.reduce((a, b) => a + b, 0) / data.length;
          if (vol > silenceThresholdRef.current) samples.push(new Uint8Array(data));
          ticks++;
          setTimeout(collect, 100);
        };
        collect();
      });

      stream.getTracks().forEach(t => t.stop());
      ctx.close();

      if (samples.length < 8) {
        setVoiceError('Habla más durante el registro — se captaron pocas muestras');
        return;
      }

      // Promediar todas las muestras → firma espectral
      const avg = new Array(samples[0].length).fill(0);
      for (const s of samples) s.forEach((v, i) => { avg[i] += v; });
      avg.forEach((_, i) => { avg[i] /= samples.length; });

      localStorage.setItem('voice_print', JSON.stringify(avg));
      setVoicePrint(avg);
      voicePrintRef.current = avg;
    } catch {
      setVoiceError('No se pudo acceder al micrófono para el registro');
    } finally {
      setModeBoth('idle');
    }
  };

  // ── Blob → base64 ─────────────────────────────────────────────────────────
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });

  // ── Apagar todo ───────────────────────────────────────────────────────────
  const stopAll = () => {
    setModeBoth('idle');
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (volTickRef.current) clearTimeout(volTickRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    freqDataRef.current = null;
    setVoiceLevel(0);
  };

  // ── Ciclo: graba hasta silencio → transcribe con Gemini → repite ──────────
  const startCycle = () => {
    if (!streamRef.current || modeRef.current === 'idle') return;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    let hasSpeech = false;
    let speechDuration = 0;  // ms consecutivos de voz detectada
    let silenceDuration = 0;
    const startTime = Date.now();

    // Calcular bins del rango de voz humana (300Hz – 3400Hz)
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const binHz = sampleRate / (analyserRef.current?.fftSize ?? 1024);
    const voiceLow  = Math.floor(300  / binHz);
    const voiceHigh = Math.floor(3400 / binHz);

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      if (volTickRef.current) clearTimeout(volTickRef.current);
      setVoiceLevel(0);
      if (modeRef.current === 'idle') return;

      if (hasSpeech && chunks.length > 0) {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setModeBoth('transcribing');
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const base64 = await blobToBase64(blob);
          const res = await apiClient.post('/hub/ai/transcribe', { audio: base64, mimeType });
          const text = res?.text?.trim();
          if (text) {
            const lower = text.toLowerCase();
            // ── Detectar palabra de cierre ────────────────────────────────
            const isClose = closeWordsRef.current.some(w => w && lower.includes(w.toLowerCase()));
            if (isClose) {
              stopAll();
              return;
            }
            // ── Auto-enviar o poner en textarea ───────────────────────────
            if (autoSendRef.current && sendRef.current) {
              await sendRef.current(text);
            } else {
              setInput(text);
            }
          }
        } catch { /* ignorar */ }

        // Reabrir stream y continuar escuchando
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          streamRef.current = newStream;
          audioCtxRef.current!.createMediaStreamSource(newStream).connect(analyserRef.current!);
          setModeBoth('listening');
          startCycle();
        } catch {
          stopAll();
        }
      } else {
        // Sin voz real → reiniciar ciclo directamente
        setModeBoth('listening');
        startCycle();
      }
    };

    recorder.start();

    const tick = () => {
      if (recorder.state !== 'recording' || modeRef.current === 'idle') return;
      if (analyserRef.current && freqDataRef.current) {
        analyserRef.current.getByteFrequencyData(freqDataRef.current as any);
        const data = freqDataRef.current;

        // Volumen general
        const total = data.reduce((a, b) => a + b, 0);
        const vol   = total / data.length;
        setVoiceLevel(Math.round(vol));

        // Energía en banda de voz vs energía total
        let voiceEnergy = 0;
        for (let i = voiceLow; i <= Math.min(voiceHigh, data.length - 1); i++) {
          voiceEnergy += data[i];
        }
        const voiceRatio = total > 0 ? voiceEnergy / total : 0;

        // Banda de voz + similitud con firma del usuario (si está registrado)
        const inVoiceBand = vol > silenceThresholdRef.current && voiceRatio > 0.25;
        let isVoice = inVoiceBand;
        if (inVoiceBand && voicePrintRef.current) {
          const sim = cosineSimilarity(data, voicePrintRef.current);
          isVoice = sim >= voiceMatchThresholdRef.current;
        }

        if (isVoice) {
          speechDuration += 100;
          silenceDuration = 0;
          if (speechDuration >= 400) hasSpeech = true;
        } else {
          speechDuration = 0;
          if (hasSpeech) {
            silenceDuration += 100;
            if (silenceDuration >= 1500) { recorder.stop(); return; }
          }
        }
      }
      if (Date.now() - startTime >= 15000) { recorder.stop(); return; }
      volTickRef.current = setTimeout(tick, 100);
    };
    volTickRef.current = setTimeout(tick, 100);
  };

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggleListening = async () => {
    if (listening) { stopAll(); return; }
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // más resolución de frecuencias
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setModeBoth('listening');
      startCycle();
    } catch {
      setVoiceError('Permiso de micrófono denegado');
    }
  };

  // ── Wake word detection con SpeechRecognition ────────────────────────────
  const startWakeWord = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceError('Wake word no soportado en este navegador (usa Chrome)'); return; }
    if (wakeRecogRef.current) return;
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'es-ES';
    r.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase();
        if (t.includes(wakeWordRef.current.toLowerCase())) {
          r.stop(); wakeRecogRef.current = null;
          setModeBoth('idle');
          toggleListening();
          break;
        }
      }
    };
    r.onerror = () => { wakeRecogRef.current = null; setModeBoth('idle'); };
    r.onend = () => {
      // Reinicia solo si todavía estamos en modo wake
      if (modeRef.current === 'wake') { try { r.start(); } catch { /* ignorar */ } }
      else { wakeRecogRef.current = null; }
    };
    wakeRecogRef.current = r;
    setModeBoth('wake');
    try { r.start(); } catch { setVoiceError('No se pudo iniciar reconocimiento de voz'); wakeRecogRef.current = null; setModeBoth('idle'); }
  };

  const stopWakeWord = () => {
    if (wakeRecogRef.current) { try { wakeRecogRef.current.stop(); } catch { /* ignorar */ } wakeRecogRef.current = null; }
    if (modeRef.current === 'wake') setModeBoth('idle');
  };

  useEffect(() => () => { stopAll(); stopWakeWord(); }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const send = useCallback(async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || isTyping) return;
    setInput('');
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    setMessages(prev => [...prev, { role: 'ai', content: '', loading: true }]);
    const enabledToolsList = Object.keys(enabledTools).filter(k => enabledTools[k]);
    try {
      const res = await apiClient.post('/hub/ai/chat', { prompt: userMsg, history, enabledTools: enabledToolsList });
      const toolsUsed: string[] = res?.toolsUsed || [];
      // Actualizar contexto según herramientas usadas
      if (toolsUsed.includes('create_reservation')) setCurrentContext('Reserva creada');
      else if (toolsUsed.includes('get_available_rooms')) setCurrentContext('Verificando disponibilidad');
      else if (toolsUsed.includes('get_reservations')) setCurrentContext('Consultando reservas');
      else if (toolsUsed.includes('check_in')) setCurrentContext('Check-in realizado');
      else if (toolsUsed.includes('check_out')) setCurrentContext('Check-out realizado');
      else if (toolsUsed.includes('cancel_reservation')) setCurrentContext('Reserva cancelada');
      else if (toolsUsed.includes('register_payment')) setCurrentContext('Pago registrado');
      else if (toolsUsed.length > 0) setCurrentContext('BD consultada');
      else setCurrentContext(null);

      const reply: string = res?.reply || 'No se recibió respuesta.';
      // Abrir formulario automáticamente si la IA lo sugiere
      if (/abrir formulario de reserva/i.test(reply)) {
        setShowBookingForm(true);
      }
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'ai',
          content: reply,
          toolsUsed,
        };
        return copy;
      });
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'ai',
          content: `Error: ${err.response?.data?.error || err.message || 'Sin conexión con Solaris AI.'}`,
        };
        return copy;
      });
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping, enabledTools]);

  // Sincronizar sendRef para que startCycle pueda llamarlo sin closure stale
  useEffect(() => { sendRef.current = send; }, [send]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    send(input);
  };

  const clearChat = () => setMessages([]);

  const toolCount = Object.keys(TOOL_LABELS).length;

  return (
    <div className="flex h-screen w-screen bg-[#030305] text-slate-300 font-sans overflow-hidden relative selection:bg-indigo-500/30">
      
      {/* ── Background Effects ── */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-cyan-600/5 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 via-transparent to-purple-600/5 animate-gradient mix-blend-overlay" />
      </div>

      {/* ── Floating Header & Navigation ── */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-4">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md text-sm font-medium text-slate-300 hover:text-white transition-all group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-1 transition-transform" />
          Volver al Dashboard
        </button>
      </div>

      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-100">Solaris AI</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Gemini 2.5 Flash
          </span>
        </div>
      </div>

      {/* ── Main Layout Wrapper ── */}
      <div className="relative z-10 flex w-full h-full pt-20 pb-4 px-6 gap-6">

        {/* ── Left Floating Panel ── */}
        <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4 relative z-10">
          <div className="p-5 bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl shadow-2xl flex-1 flex flex-col">
            
            {/* Jarvis Neural Orb Widget */}
            <div className="flex justify-center mb-4 border-b border-white/5 pb-4">
              <NeuralOrb 
                state={orbState} 
                voiceLevel={voiceLevel} 
                onClick={toggleListening}
                size={110}
              />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Establecimiento Activo</p>
                <p className="text-sm text-white font-bold">Solaris Global</p>
              </div>
            </div>

            <hr className="border-white/5 mb-6" />

            <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                Actividad Reciente
              </p>
              <div className="space-y-4">
                {/* Accesos rápidos por hotel */}
                {knownHotels.length > 0 && (
                  <div className="mb-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Acciones Rápidas</p>
                    <div className="space-y-1.5">
                      {knownHotels.slice(0, 3).map(h => (
                        <button key={h.id} onClick={() => { setShowBookingForm(true); }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/20 transition-all group text-left">
                          <span className="text-[11px] font-semibold text-slate-400 group-hover:text-indigo-300 truncate">{h.nombre}</span>
                          <span className="text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0 ml-1">
                            <UserPlus className="w-3 h-3" /> Reservar
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.filter(m => m.role === 'user').slice(-5).reverse().map((m, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5 border border-white/5">
                      <Search className="w-3 h-3 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {m.content}
                    </p>
                  </div>
                ))}
                {messages.filter(m => m.role === 'user').length === 0 && (
                  <p className="text-xs text-slate-500 italic">No hay actividad en esta sesión.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
              <button onClick={() => navigate('/hotel/dashboard')} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <Database className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
                <span className="text-xs font-semibold text-slate-400 group-hover:text-white transition-colors">Gestión Operativa</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Center Chat Area ── */}
        <div className="flex-1 flex flex-col relative w-full h-full bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-sm overflow-hidden shadow-2xl">
          
          {/* Header Action inside Chat */}
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
            {currentContext && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-300">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {currentContext}
              </span>
            )}
            {messages.length > 0 && (
              <button onClick={() => { clearChat(); setCurrentContext(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 text-xs text-slate-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar relative z-10">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="max-w-3xl mx-auto h-full flex flex-col justify-center">
                  <div className="text-center mb-12 relative">
                    {/* Glowing Jarvis Neural Orb for Empty State */}
                    <div className="flex justify-center mb-6">
                      <NeuralOrb 
                        state={orbState} 
                        voiceLevel={voiceLevel} 
                        onClick={toggleListening}
                        size={140}
                      />
                    </div>
                    <h2 className="text-4xl font-light text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-300 mb-3 tracking-wide">Solaris AI</h2>
                    <p className="text-slate-400 text-sm font-medium tracking-wide">Centro de mando interactivo. ¿En qué te asisto hoy?</p>
                  </div>
                  <div className="flex justify-center mb-4">
                    <button onClick={() => setShowBookingForm(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 border border-indigo-500/30">
                      <CalendarDays className="w-4 h-4" /> Nueva Reserva
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => send(s.prompt)}
                        className="text-left bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-indigo-500/30 p-5 rounded-3xl transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10">
                        <div className="mb-3 p-2 rounded-xl bg-white/5 inline-block group-hover:scale-110 group-hover:bg-white/10 transition-all">{s.icon}</div>
                        <p className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{s.title}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="w-full px-4 md:px-12 lg:px-16 mx-auto space-y-6 pb-4">
                  {messages.map((msg, idx) => (
                    <motion.div key={idx}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 group ${msg.role === 'user' ? 'justify-end' : 'items-start'}`}>

                      {msg.role === 'ai' && (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-indigo-500/20">
                          <Sparkles className={`w-3.5 h-3.5 text-white ${msg.loading ? 'animate-pulse' : ''}`} />
                        </div>
                      )}

                      <div className={`max-w-[95%] ${msg.role === 'user' ? 'items-end flex flex-col' : 'w-full min-w-0'}`}>
                        {/* Tool badges */}
                        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {[...new Set(msg.toolsUsed)].map(t => {
                              const info = TOOL_LABELS[t] || { label: t, color: 'text-slate-400 bg-slate-400/10' };
                              return (
                                <span key={t} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${info.color}`}>
                                  <Database className="w-2.5 h-2.5" />
                                  {info.label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`relative ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-slate-100 px-5 py-3.5 rounded-3xl rounded-tr-sm text-sm shadow-xl shadow-indigo-900/20 inline-block'
                            : 'text-slate-300 bg-white/[0.03] border border-white/[0.05] px-5 py-4 rounded-3xl rounded-tl-sm text-sm backdrop-blur-md shadow-lg shadow-black/20 w-fit max-w-full'
                        }`}>
                          {msg.loading ? (
                            <div className="flex items-center gap-2 py-1 h-6">
                              {[0,150,300].map(d => (
                                <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                  style={{ animationDelay: `${d}ms` }} />
                              ))}
                            </div>
                          ) : msg.role === 'ai' ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <MarkdownMessage content={msg.content} />
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => ttsActive ? stopSpeaking() : speak(msg.content)}
                                    title={ttsActive ? 'Detener' : 'Escuchar respuesta'}
                                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-indigo-400 transition-colors">
                                    {ttsActive ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                  </button>
                                  <CopyButton text={msg.content} />
                                </div>
                              </div>
                              {/* CTA buttons parsed from response */}
                              {!msg.loading && idx === messages.length - 1 && (() => {
                                const ctas = extractCTAs(msg.content);
                                if (!ctas.length) return null;
                                return (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {ctas.slice(0, 4).map((cta, ci) => (
                                      <button key={ci} onClick={() => send(cta.prompt)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 hover:border-indigo-500/40 text-xs font-semibold text-indigo-300 transition-all">
                                        <ChevronRight className="w-3 h-3" />{cta.label}
                                      </button>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {/* Formulario de reserva integrado */}
                  {showBookingForm && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 items-start">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarDays className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex-1 max-w-sm">
                        <BookingFormWidget
                          hotels={knownHotels}
                          onSubmit={msg => { setShowBookingForm(false); send(msg); }}
                          onCancel={() => setShowBookingForm(false)}
                        />
                      </div>
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Floating Input Area */}
          <div className="relative px-6 pb-6 shrink-0 z-20">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSubmit}>
                {/* Panel de configuración de voz */}
                <AnimatePresence>
                  {showVoiceSettings && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-full mb-4 left-0 w-80 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 shadow-2xl z-50">
                      <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-4">Configuración de voz</p>
                      <div className="space-y-4">
                        
                        {/* Sensibilidad */}
                        <div>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs text-slate-300">Sensibilidad del micrófono</span>
                            <span className="text-xs font-mono text-indigo-400">{silenceThreshold}</span>
                          </div>
                          <input type="range" min="1" max="30" value={silenceThreshold}
                            onChange={e => { const v = Number(e.target.value); silenceThresholdRef.current = v; setSilenceThreshold(v); localStorage.setItem('voice_threshold', String(v)); }}
                            className="w-full accent-indigo-500" />
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                            <span>Más sensible</span><span>Menos sensible</span>
                          </div>
                        </div>

                        {/* Palabra de activación (wake word) */}
                        <div className="border-t border-white/10 pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="text-xs text-slate-200">Palabra de activación</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">Di esta palabra para iniciar la escucha</p>
                            </div>
                            <button type="button"
                              onClick={() => mode === 'wake' ? stopWakeWord() : startWakeWord()}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                                ${mode === 'wake' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                              {mode === 'wake' ? '🎙 Activo' : '▶ Activar'}
                            </button>
                          </div>
                          <input
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                            value={wakeWord} placeholder="ej: solaris"
                            onChange={e => setWakeWord(e.target.value.trim().toLowerCase())} />
                        </div>

                        {/* Palabras de cierre */}
                        <div>
                          <p className="text-xs text-slate-200 mb-1">Palabras de cierre</p>
                          <p className="text-[10px] text-slate-500 mb-2">Separadas por coma. Al detectarlas, detiene la escucha.</p>
                          <input
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50"
                            value={closeWords.join(', ')} placeholder="cancelar, parar, stop"
                            onChange={e => setCloseWords(e.target.value.split(',').map(w => w.trim()).filter(Boolean))} />
                        </div>

                        {/* Auto-enviar */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-200">Envío automático</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Envía el mensaje al terminar de transcribir</p>
                          </div>
                          <button type="button" onClick={() => setAutoSend(p => !p)}
                            className={`w-10 h-5 rounded-full transition-colors ${autoSend ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-auto transition-transform ${autoSend ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
                          </button>
                        </div>

                        {/* Registro de voz */}
                        <div className="border-t border-white/10 pt-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-xs text-slate-200">Reconocimiento Vocal</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {voicePrint ? 'Firma activa · Exclusivo' : 'Abierto a cualquier voz'}
                              </p>
                            </div>
                            <button type="button" onClick={enrollVoice}
                              disabled={mode !== 'idle'}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                                ${mode === 'enrolling'
                                  ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                                  : voicePrint
                                    ? 'bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/20'}`}>
                              {mode === 'enrolling' ? '⏺ 4s...' : voicePrint ? 'Cambiar voz' : 'Registrar'}
                            </button>
                          </div>
                          {voicePrint && (
                            <>
                              <div className="flex justify-between mb-1.5">
                                <span className="text-xs text-slate-400">Similitud requerida</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-indigo-400">{Math.round(voiceMatchThreshold * 100)}%</span>
                                  <button type="button" onClick={() => { localStorage.removeItem('voice_print'); setVoicePrint(null); voicePrintRef.current = null; }}
                                    className="text-[10px] text-rose-400 hover:text-rose-300">borrar</button>
                                </div>
                              </div>
                              <input type="range" min="60" max="95" value={Math.round(voiceMatchThreshold * 100)}
                                onChange={e => { const v = Number(e.target.value) / 100; voiceMatchThresholdRef.current = v; setVoiceMatchThreshold(v); localStorage.setItem('voice_match', String(v)); }}
                                className="w-full accent-indigo-500" />
                            </>
                          )}
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all overflow-hidden relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                    placeholder={mode === 'transcribing' ? 'Transcribiendo...' : mode === 'wake' ? `Esperando «${wakeWord}»...` : mode === 'listening' ? 'Habla cuando quieras...' : 'Pregunta sobre tus negocios o da una orden...'}
                    rows={1}
                    className="w-full bg-transparent text-slate-100 placeholder-slate-500 px-6 pt-5 pb-3 resize-none focus:outline-none text-[15px] leading-relaxed"
                    style={{ minHeight: 60 }}
                  />
                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <span className="text-[11px] text-slate-600">
                      {voiceError
                        ? <span className="text-rose-400">{voiceError}</span>
                        : mode === 'transcribing'
                          ? <span className="text-indigo-400">Transcribiendo{autoSend ? ' · enviando automáticamente...' : ''}...</span>
                          : mode === 'wake'
                            ? <span className="text-indigo-400 animate-pulse">Esperando «{wakeWord}»...</span>
                            : mode === 'listening'
                              ? voiceLevel > silenceThreshold
                                ? <span className="text-emerald-400 font-medium">Captando voz{autoSend ? ' · enviará automáticamente' : ''}...</span>
                                : <span className="text-slate-500">Habla cuando quieras{autoSend ? ' · enviará auto' : ''}</span>
                              : <span>Enter para enviar · Shift+Enter nueva línea · <kbd className="px-1 py-0.5 rounded bg-white/5 text-[10px] font-mono">⌘K</kbd></span>}
                    </span>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setShowVoiceSettings(p => !p)}
                        className={`p-2 rounded-xl transition-all ${showVoiceSettings ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-500 hover:text-slate-300 hover:bg-white/10'}`}>
                        <SlidersHorizontal className="w-4 h-4" />
                      </button>

                      {mode === 'listening' && (
                        <div className="flex items-end gap-[2px] h-4">
                          {[0.5, 0.8, 1, 0.8, 0.5].map((factor, i) => {
                            const active = voiceLevel > silenceThreshold;
                            const h = active ? Math.max(3, Math.min(16, voiceLevel * factor * 0.55)) : 3;
                            return (
                              <div key={i}
                                className={`w-[3px] rounded-full transition-all duration-75 ${active ? 'bg-emerald-400' : 'bg-slate-700'}`}
                                style={{ height: `${h}px` }}
                              />
                            );
                          })}
                        </div>
                      )}

                      <button type="button" onClick={toggleListening}
                        title={listening ? 'Detener micrófono' : 'Activar micrófono'}
                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all shadow-lg
                          ${listening
                            ? voiceLevel > silenceThreshold
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/40 shadow-emerald-500/20'
                              : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 ring-1 ring-rose-500/40 shadow-rose-500/20'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-slate-200 hover:border-white/20'}`}>
                        {listening
                          ? <Mic className={`w-3.5 h-3.5 ${voiceLevel > silenceThreshold ? 'animate-pulse' : ''}`} />
                          : <MicOff className="w-3.5 h-3.5" />}
                        {mode === 'transcribing' ? 'Procesando…' : mode === 'listening' ? (voiceLevel > silenceThreshold ? 'Captando' : 'Escuchando') : 'Voz'}
                      </button>
                      <button type="submit" disabled={!input.trim() || isTyping}
                        className="flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-bold transition-all
                          bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30
                          disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none disabled:cursor-not-allowed">
                        <Send className="w-3.5 h-3.5" />
                        {isTyping ? 'Procesando...' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── Right Floating Panel ── */}
        <div className="w-72 shrink-0 hidden xl:flex flex-col gap-4 relative z-10">
          <div className="p-5 bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl shadow-2xl">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Motor IA</p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span className="text-[15px] font-bold text-slate-200">Gemini 2.5 Flash</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Modelo multimodal con acceso completo a tu base de datos en tiempo real.
              </p>
            </div>
          </div>

          <div className="p-5 bg-white/[0.02] border border-white/5 backdrop-blur-xl rounded-3xl shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between w-full mb-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Capacidades
                </p>
                <div className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                  <span className="text-[10px] font-bold text-indigo-400">
                    {Object.values(enabledTools).filter(Boolean).length} / {toolCount} Activas
                  </span>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Solaris AI puede realizar consultas, crear reservas y modificar datos operativos en tiempo real. 
                </p>
              </div>

              <div className="mt-6">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Consultas Rápidas
                </p>
                <div className="space-y-2">
                  {SUGGESTIONS.slice(0, 4).map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => send(s.prompt)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/20 transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-black/20 group-hover:bg-indigo-500/20 transition-colors">
                        {s.icon}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-300 group-hover:text-indigo-300 transition-colors">{s.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{s.prompt}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5">
              <button 
                onClick={() => setShowConfigModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold text-slate-300 transition-all group"
              >
                <Settings className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
                Configurar Accesos
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── Tools Config Modal ── */}
      <AnimatePresence>
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowConfigModal(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-[#0a0a0f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                    <Settings className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Panel de Control de IA</h2>
                    <p className="text-xs text-slate-400">Gestiona las capacidades y permisos de Solaris AI.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConfigModal(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto custom-scrollbar bg-gradient-to-b from-white/[0.01] to-transparent flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['Consultas', 'Reservas', 'Operaciones', 'Huéspedes', 'Sistema'].map(category => {
                    const categoryTools = Object.entries(TOOL_LABELS).filter(([_, t]) => t.category === category);
                    if (categoryTools.length === 0) return null;

                    return (
                      <div key={category} className="space-y-3">
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2 mb-3">
                          {category}
                        </h3>
                        <div className="space-y-2">
                          {categoryTools.map(([key, { label, color, description }]) => {
                            const isActive = enabledTools[key] !== false;
                            return (
                              <div 
                                key={key} 
                                className={`p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-white/5 border-white/10' : 'bg-black/20 border-white/5 opacity-60 grayscale-[50%]'}`}
                              >
                                <div className="flex items-start justify-between gap-4 mb-2">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isActive ? color : 'bg-slate-800 text-slate-400'}`}>
                                        {label}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                      {description}
                                    </p>
                                  </div>
                                  <button 
                                    onClick={() => toggleTool(key)}
                                    className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${isActive ? 'bg-indigo-500' : 'bg-slate-700'}`}
                                  >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${isActive ? 'translate-x-4' : 'translate-x-1'}`} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end">
                <button 
                  onClick={() => setShowConfigModal(false)}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
                >
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
