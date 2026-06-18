import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, Database, Zap, BarChart3, Building2,
  Search, Copy, Check, Trash2,
  CreditCard, BedDouble, Users, TrendingUp,
  Settings, X, Volume2, VolumeX, CalendarDays, UserPlus, ChevronRight, Loader2,
  Dumbbell, UtensilsCrossed
} from 'lucide-react';
import apiClient from '../services/api';
import { supabase } from '../services/supabaseClient';

// ── URLs de módulos (para navegar a la gestión operativa) ──────────────────────
const MODULE_URLS: Record<string, string> = {
  hotel:      import.meta.env.VITE_HOTEL_URL      || 'http://localhost:5173',
  gym:        import.meta.env.VITE_GYM_URL        || 'http://localhost:5175',
  restaurant: import.meta.env.VITE_RESTAURANT_URL || 'http://localhost:5176',
};

interface BusinessModule {
  id: string;
  type: string;
  reference_id: string;
  is_active: boolean;
  name?: string;
  hotel_id?: string | null;
}

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
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="my-3 bg-slate-900 border border-slate-200 rounded-xl p-4 overflow-x-auto text-sm text-emerald-500 font-mono"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200">$1</code>')
    // Encabezados
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-800 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-850 mt-5 mb-3">$1</h1>')
    // Negrita e itálica
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-slate-700 italic">$1</em>')
    // Tablas
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim() !== '');
      if (cells.every(c => /^[:\- ]+$/.test(c))) return '<tr data-sep="true"></tr>';
      return '<tr>' + cells.map(c => `<td class="p-4 text-sm text-slate-750 border-b border-slate-100 whitespace-nowrap">${c.trim()}</td>`).join('') + '</tr>';
    })
    .replace(/(?:<tr[^>]*>.*?<\/tr>\s*)+/g, (match) => {
      let rows = match.split('</tr>').filter(r => r.trim() !== '');
      let html = '<div class="overflow-hidden my-6 bg-white border border-slate-200 rounded-2xl shadow-sm">';
      html += '<div class="overflow-x-auto custom-scrollbar">';
      html += '<table class="w-full text-left border-collapse">';
      
      let hasHeader = false;
      rows.forEach((row) => {
        if (row.includes('data-sep="true"')) return;
        if (!hasHeader) {
          let headerRow = row.replace(/<td/g, '<th').replace(/td>/g, 'th>');
          headerRow = headerRow.replace(/class="[^"]*"/g, 'class="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50 border-b border-slate-200 whitespace-nowrap"');
          html += `<thead>${headerRow}</tr></thead><tbody class="divide-y divide-slate-100">`;
          hasHeader = true;
        } else {
          let bodyRow = row.replace('<tr', '<tr class="hover:bg-slate-50/50 transition-colors duration-200"');
          html += `${bodyRow}</tr>`;
        }
      });
      html += '</tbody></table></div></div>';
      return html;
    })
    // Listas
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc text-slate-700 text-sm leading-relaxed marker:text-indigo-600">$1</li>')
    .replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-slate-700 text-sm leading-relaxed marker:text-indigo-600">$2</li>')
    .replace(/(?:<li[^>]*>.*?<\/li>\s*)+/g, '<ul class="my-3 space-y-1.5 p-3 bg-slate-55 border border-slate-200/80 rounded-xl">$&</ul>')
    // Líneas horizontales
    .replace(/^---+$/gm, '<hr class="border-slate-200 my-4" />')
    // Párrafos y saltos de línea
    .replace(/\n\n/g, '</p><p class="text-slate-700 text-sm leading-relaxed mt-3">')
    .replace(/\n/g, '<br/>');
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{
        __html: `<p class="text-slate-700 text-sm leading-relaxed">${renderMarkdown(content)}</p>`
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

  const inp = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all';
  const lbl = 'block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-indigo-700">Formulario de Reserva</span>
        </div>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-650 transition-colors"><X className="w-4 h-4" /></button>
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
            <label className={lbl}>Check-out {nights > 0 && <span className="text-indigo-600 normal-case">({nights} noche{nights !== 1 ? 's' : ''})</span>}</label>
            <input type="date" className={`${inp} ${errors.dates ? 'border-red-500/50' : ''}`}
              min={form.check_in || today} value={form.check_out} onChange={e => set('check_out', e.target.value)} />
            {errors.dates && <p className="text-[10px] text-red-500 mt-0.5">Salida debe ser posterior a entrada</p>}
          </div>
        </div>

        {/* Guests count */}
        <div className="grid grid-cols-2 gap-2">
          {[{ k: 'adultos', label: 'Adultos', min: 1 }, { k: 'ninos', label: 'Niños', min: 0 }].map(({ k, label, min }) => (
            <div key={k}>
              <label className={lbl}>{label}</label>
              <div className="flex items-center gap-2 bg-slate-55 border border-slate-200 rounded-xl px-3 py-1.5">
                <button type="button" onClick={() => set(k as any, Math.max(min, (form as any)[k] - 1))}
                  className="w-6 h-6 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors">−</button>
                <span className="flex-1 text-center text-sm font-bold text-slate-700">{(form as any)[k]}</span>
                <button type="button" onClick={() => set(k as any, (form as any)[k] + 1)}
                  className="w-6 h-6 rounded-lg bg-slate-200/60 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-sm font-bold transition-colors">+</button>
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
            {searchingGuest && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-650 animate-spin" />}
          </div>
          {errors.email && <p className="text-[10px] text-red-500 mt-0.5">Formato de correo inválido</p>}
          {guestSuggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl">
              {guestSuggestions.map(g => (
                <button key={g.id} type="button"
                  onClick={() => { set('guest_email', g.correo); set('guest_name', g.nombre); setGuestSuggestions([]); }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                  <p className="text-xs font-bold text-slate-800">{g.nombre}</p>
                  <p className="text-[10px] text-slate-400">{g.correo}</p>
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
            className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-550 text-xs font-semibold hover:bg-slate-50 transition-colors bg-white">
            Cancelar
          </button>
          <button type="button" disabled={!valid} onClick={handleSubmit}
            className="flex-2 flex-grow py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-150">
            <Send className="w-3 h-3" /> Enviar a Solaris AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tool badge ────────────────────────────────────────────────────────────────
type ToolCategory = 'Consultas' | 'Operaciones' | 'Reservas' | 'Huéspedes' | 'Sistema' | 'Gimnasio' | 'Restaurante';

const TOOL_LABELS: Record<string, { label: string; color: string; description: string; category: ToolCategory }> = {
  get_businesses:       { label: 'Ver Negocios',      color: 'text-blue-700 bg-blue-50 border border-blue-100', description: 'Permite a la IA consultar la lista de todos los hoteles, gimnasios, restaurantes y negocios del propietario.', category: 'Consultas' },
  get_hotel_info:       { label: 'Info. del Hotel',   color: 'text-indigo-700 bg-indigo-50 border border-indigo-100', description: 'Obtiene detalles específicos, configuración y listado de habitaciones de un hotel.', category: 'Consultas' },
  get_reservations:     { label: 'Ver Reservas',      color: 'text-amber-700 bg-amber-50 border border-amber-100', description: 'Consulta el historial o reservas activas con filtros de estado y fechas.', category: 'Reservas' },
  get_rooms:            { label: 'Ver Habitaciones',  color: 'text-emerald-700 bg-emerald-50 border border-emerald-100', description: 'Muestra todas las habitaciones, sus tarifas, comodidades y estado actual.', category: 'Consultas' },
  get_guests:           { label: 'Ver Huéspedes',     color: 'text-cyan-700 bg-cyan-50 border border-cyan-100', description: 'Busca en el directorio de huéspedes registrados del hotel.', category: 'Huéspedes' },
  get_payments:         { label: 'Ver Pagos',         color: 'text-green-700 bg-green-50 border border-green-100', description: 'Consulta el historial de pagos recientes vinculados a reservas.', category: 'Consultas' },
  get_metrics:          { label: 'Métricas',          color: 'text-purple-700 bg-purple-50 border border-purple-100', description: 'Calcula ingresos, ocupación y resumen de reservas del mes.', category: 'Consultas' },
  update_reservation:   { label: 'Editar Reserva',    color: 'text-orange-700 bg-orange-50 border border-orange-100', description: 'Permite modificar notas, cantidad de personas o montos de una reserva.', category: 'Reservas' },
  check_in:             { label: 'Hacer Check-in',    color: 'text-teal-700 bg-teal-50 border border-teal-100', description: 'Registra la entrada física del huésped y ocupa la habitación.', category: 'Operaciones' },
  check_out:            { label: 'Hacer Check-out',   color: 'text-sky-700 bg-sky-50 border border-sky-100', description: 'Registra la salida del huésped y libera la habitación.', category: 'Operaciones' },
  cancel_reservation:   { label: 'Cancelar Reserva',  color: 'text-rose-700 bg-rose-50 border border-rose-100', description: 'Anula una reserva y guarda un motivo de cancelación.', category: 'Reservas' },
  register_payment:     { label: 'Registrar Pago',    color: 'text-lime-700 bg-lime-50 border border-lime-100', description: 'Crea un abono o pago total a una reserva activa.', category: 'Operaciones' },
  update_room:          { label: 'Editar Habitación', color: 'text-violet-700 bg-violet-50 border border-violet-100', description: 'Cambia el estado (ej. mantenimiento) o tarifa de una habitación.', category: 'Operaciones' },
  get_available_rooms:  { label: 'Disponibilidad',    color: 'text-amber-700 bg-amber-50 border border-amber-100', description: 'Cruza fechas para encontrar qué habitaciones están libres.', category: 'Reservas' },
  create_guest:         { label: 'Crear Huésped',     color: 'text-cyan-700 bg-cyan-50 border border-cyan-100', description: 'Registra los datos de un cliente nuevo en el directorio.', category: 'Huéspedes' },
  create_reservation:   { label: 'Crear Reserva',     color: 'text-emerald-700 bg-emerald-50 border border-emerald-100', description: 'Efectúa una nueva reserva desde cero bloqueando disponibilidad.', category: 'Reservas' },
  search_database:      { label: 'Acceso a BD',       color: 'text-slate-700 bg-slate-100 border border-slate-200', description: 'Realiza consultas SQL de solo lectura directas a la base de datos.', category: 'Sistema' },

  // ── Gimnasio ──────────────────────────────────────────────────────────────
  get_gym_info:          { label: 'Info. del Gimnasio',  color: 'text-emerald-700 bg-emerald-50 border border-emerald-100', description: 'Obtiene datos generales del gimnasio, sus planes de membresía y entrenadores.', category: 'Gimnasio' },
  get_gym_members:       { label: 'Ver Miembros',        color: 'text-cyan-700 bg-cyan-50 border border-cyan-100', description: 'Lista o busca miembros del gimnasio por nombre, correo o documento.', category: 'Gimnasio' },
  get_gym_memberships:   { label: 'Ver Membresías',      color: 'text-amber-700 bg-amber-50 border border-amber-100', description: 'Consulta inscripciones/membresías activas, vencidas o próximas a vencer.', category: 'Gimnasio' },
  get_gym_plans:         { label: 'Ver Planes',          color: 'text-blue-700 bg-blue-50 border border-blue-100', description: 'Muestra los planes de membresía disponibles con precio y duración.', category: 'Gimnasio' },
  get_gym_payments:      { label: 'Pagos del Gimnasio',  color: 'text-green-700 bg-green-50 border border-green-100', description: 'Consulta el historial de pagos de membresías.', category: 'Gimnasio' },
  get_gym_classes:       { label: 'Ver Clases',          color: 'text-purple-700 bg-purple-50 border border-purple-100', description: 'Lista las clases programadas con su horario y entrenador.', category: 'Gimnasio' },
  get_gym_metrics:       { label: 'Métricas del Gimnasio', color: 'text-indigo-700 bg-indigo-50 border border-indigo-100', description: 'Calcula miembros activos, membresías por vencer e ingresos del mes.', category: 'Gimnasio' },
  register_gym_payment:  { label: 'Registrar Pago (Gym)', color: 'text-lime-700 bg-lime-50 border border-lime-100', description: 'Registra un pago de membresía y actualiza su estado de pago.', category: 'Gimnasio' },
  create_gym_member:     { label: 'Crear Miembro',       color: 'text-teal-700 bg-teal-50 border border-teal-100', description: 'Registra un nuevo miembro en el gimnasio.', category: 'Gimnasio' },
  create_gym_membership: { label: 'Crear Membresía',     color: 'text-emerald-700 bg-emerald-50 border border-emerald-100', description: 'Inscribe a un miembro en un plan y calcula su vigencia.', category: 'Gimnasio' },
  update_gym_member:     { label: 'Editar Miembro',      color: 'text-orange-700 bg-orange-50 border border-orange-100', description: 'Modifica datos de un miembro, como su estado.', category: 'Gimnasio' },
  update_gym_membership: { label: 'Editar Membresía',    color: 'text-rose-700 bg-rose-50 border border-rose-100', description: 'Renueva, cancela o modifica una membresía existente.', category: 'Gimnasio' },

  // ── Restaurante ───────────────────────────────────────────────────────────
  get_restaurant_info:          { label: 'Info. del Restaurante', color: 'text-amber-700 bg-amber-50 border border-amber-100', description: 'Obtiene datos generales del restaurante, sus mesas y menús.', category: 'Restaurante' },
  get_restaurant_tables:        { label: 'Ver Mesas',             color: 'text-cyan-700 bg-cyan-50 border border-cyan-100', description: 'Lista las mesas del restaurante y su estado (libre/ocupada/reservada).', category: 'Restaurante' },
  get_restaurant_menu:          { label: 'Ver Menú',              color: 'text-emerald-700 bg-emerald-50 border border-emerald-100', description: 'Muestra los platillos activos del menú con su categoría y precio.', category: 'Restaurante' },
  get_restaurant_orders:        { label: 'Ver Pedidos',           color: 'text-purple-700 bg-purple-50 border border-purple-100', description: 'Consulta los pedidos con su mesa, cliente y detalle de platillos.', category: 'Restaurante' },
  get_restaurant_reservations:  { label: 'Reservas del Restaurante', color: 'text-blue-700 bg-blue-50 border border-blue-100', description: 'Consulta las reservas de mesas por fecha o estado.', category: 'Restaurante' },
  get_restaurant_metrics:       { label: 'Métricas del Restaurante', color: 'text-indigo-700 bg-indigo-50 border border-indigo-100', description: 'Calcula facturación, pedidos y reservas del periodo.', category: 'Restaurante' },
  update_table_status:          { label: 'Editar Mesa',           color: 'text-violet-700 bg-violet-50 border border-violet-100', description: 'Cambia el estado de una mesa (libre/ocupada/reservada).', category: 'Restaurante' },
  update_order_status:          { label: 'Editar Pedido',         color: 'text-orange-700 bg-orange-50 border border-orange-100', description: 'Cambia el estado de un pedido (en preparación, listo, pagado, etc.).', category: 'Restaurante' },
  create_restaurant_reservation: { label: 'Crear Reserva (Restaurante)', color: 'text-emerald-700 bg-emerald-50 border border-emerald-100', description: 'Crea una reserva de mesa, registrando al cliente si es necesario.', category: 'Restaurante' },
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
// ── Sugerencias por tipo de negocio (se filtran según los módulos activos del owner) ──
const HOTEL_SUGGESTIONS = [
  { icon: <BarChart3 className="w-4 h-4 text-amber-400" />, title: 'Métricas del mes', prompt: 'Dame las métricas y resumen financiero de este mes para todos mis hoteles.' },
  { icon: <BedDouble className="w-4 h-4 text-emerald-400" />, title: 'Nueva reserva', prompt: 'Quiero crear una reserva nueva. ¿Qué información necesitas?' },
  { icon: <Users className="w-4 h-4 text-blue-400" />, title: 'Reservas de hoy', prompt: '¿Qué reservas tienen check-in o check-out hoy?' },
  { icon: <CreditCard className="w-4 h-4 text-purple-400" />, title: 'Pagos pendientes', prompt: '¿Cuáles reservas tienen estado de pago "deuda" o "abonada"?' },
  { icon: <TrendingUp className="w-4 h-4 text-rose-400" />, title: 'Habitaciones libres', prompt: '¿Qué habitaciones están disponibles este fin de semana?' },
  { icon: <Search className="w-4 h-4 text-indigo-400" />, title: 'Buscar huésped', prompt: 'Busca el huésped más reciente registrado en el hotel.' },
];

const GYM_SUGGESTIONS = [
  { icon: <Dumbbell className="w-4 h-4 text-emerald-400" />, title: 'Miembros activos', prompt: '¿Cuántos miembros activos tiene mi gimnasio y cuántas membresías están por vencer?' },
  { icon: <CreditCard className="w-4 h-4 text-lime-400" />, title: 'Pagos del gimnasio', prompt: 'Muéstrame los pagos de membresías registrados este mes en el gimnasio.' },
  { icon: <CalendarDays className="w-4 h-4 text-purple-400" />, title: 'Clases de hoy', prompt: '¿Qué clases hay programadas hoy en el gimnasio y quién las imparte?' },
  { icon: <TrendingUp className="w-4 h-4 text-amber-400" />, title: 'Membresías por vencer', prompt: '¿Qué membresías del gimnasio están próximas a vencer?' },
];

const RESTAURANT_SUGGESTIONS = [
  { icon: <UtensilsCrossed className="w-4 h-4 text-amber-400" />, title: 'Mesas disponibles', prompt: '¿Qué mesas están libres en el restaurante en este momento?' },
  { icon: <BarChart3 className="w-4 h-4 text-indigo-400" />, title: 'Pedidos activos', prompt: 'Muéstrame los pedidos activos del restaurante con su mesa y estado.' },
  { icon: <CalendarDays className="w-4 h-4 text-blue-400" />, title: 'Reservas del restaurante', prompt: '¿Qué reservas de mesa hay hoy en el restaurante?' },
  { icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, title: 'Métricas del restaurante', prompt: 'Dame las métricas y facturación del restaurante este mes.' },
];

const GENERAL_SUGGESTIONS = [
  { icon: <Building2 className="w-4 h-4 text-cyan-400" />, title: 'Mis negocios', prompt: 'Muéstrame un resumen de todos mis negocios y su estado.' },
  { icon: <Zap className="w-4 h-4 text-yellow-400" />, title: '¿Qué puedes hacer?', prompt: '¿Qué acciones y consultas puedes realizar sobre mi base de datos?' },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChatHub() {
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

  // ── Navegar a la gestión operativa del negocio seleccionado ─────────────────────
  const enterModule = async (mod: BusinessModule) => {
    const base = MODULE_URLS[mod.type] || MODULE_URLS.hotel;
    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams({
      business_id: mod.reference_id,
      access_token: session?.access_token || '',
      refresh_token: session?.refresh_token || '',
    });
    if (mod.hotel_id) params.set('hotel_id', mod.hotel_id);
    window.location.href = `${base}/?${params.toString()}`;
  };

  // ── Auxiliar para obtener acciones rápidas dinámicas por módulo ──────────────
  const getQuickActionsForModule = (mod: BusinessModule) => {
    if (mod.type === 'hotel') {
      return [
        {
          label: 'Ver Habitaciones',
          action: () => send(`¿Qué habitaciones están libres hoy en ${mod.name || 'el hotel'}?`),
          icon: <BedDouble className="w-3.5 h-3.5" />
        },
        {
          label: 'Nueva Reserva',
          action: () => { setShowBookingForm(true); },
          icon: <UserPlus className="w-3.5 h-3.5" />
        }
      ];
    } else if (mod.type === 'gym') {
      return [
        {
          label: 'Ver Miembros',
          action: () => send(`Muéstrame la lista de miembros activos en el gimnasio ${mod.name || ''}`),
          icon: <Users className="w-3.5 h-3.5" />
        },
        {
          label: 'Métricas de Gym',
          action: () => send(`Dame las métricas y resumen de ingresos del mes para el gimnasio ${mod.name || ''}`),
          icon: <BarChart3 className="w-3.5 h-3.5" />
        }
      ];
    } else if (mod.type === 'restaurant') {
      return [
        {
          label: 'Estado de Mesas',
          action: () => send(`¿Cuál es el estado de las mesas del restaurante ${mod.name || ''} en este momento?`),
          icon: <UtensilsCrossed className="w-3.5 h-3.5" />
        },
        {
          label: 'Métricas de Ventas',
          action: () => send(`Dame las métricas y facturación de este mes para el restaurante ${mod.name || ''}`),
          icon: <TrendingUp className="w-3.5 h-3.5" />
        }
      ];
    }
    return [];
  };

  // ── Negocios del propietario (para detectar el/los tipo(s) de negocio activo) ──
  const [businessModules, setBusinessModules] = useState<BusinessModule[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<{ nombre?: string } | null>(null);
  useEffect(() => {
    apiClient.get('/hub/dashboard-summary').then((data: any) => {
      setBusinessModules(Array.isArray(data?.modules) ? data.modules : []);
      setOwnerInfo(data?.owner ?? null);
    }).catch(() => {});
  }, []);

  const hasHotel = businessModules.some(m => m.type === 'hotel') || knownHotels.length > 0;
  const hasGym = businessModules.some(m => m.type === 'gym');
  const hasRestaurant = businessModules.some(m => m.type === 'restaurant');

  const suggestions = useMemo(() => {
    const list = [];
    const hotelSugs = hasHotel ? HOTEL_SUGGESTIONS : [];
    const gymSugs = hasGym ? GYM_SUGGESTIONS : [];
    const restSugs = hasRestaurant ? RESTAURANT_SUGGESTIONS : [];
    const genSugs = GENERAL_SUGGESTIONS;

    const maxLen = Math.max(hotelSugs.length, gymSugs.length, restSugs.length, genSugs.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < hotelSugs.length) list.push(hotelSugs[i]);
      if (i < gymSugs.length) list.push(gymSugs[i]);
      if (i < restSugs.length) list.push(restSugs[i]);
      if (i < genSugs.length) list.push(genSugs[i]);
    }
    return list;
  }, [hasHotel, hasGym, hasRestaurant]);

  // ── Etiqueta e ícono del establecimiento activo (panel izquierdo) ─────────
  const activeBusiness = useMemo(() => {
    if (businessModules.length === 1) {
      const m = businessModules[0];
      const icon = m.type === 'gym' ? <Dumbbell className="w-5 h-5 text-emerald-400" />
        : m.type === 'restaurant' ? <UtensilsCrossed className="w-5 h-5 text-amber-400" />
        : <Building2 className="w-5 h-5 text-indigo-400" />;
      return { label: m.name || ownerInfo?.nombre || 'Solaris', icon };
    }
    return { label: ownerInfo?.nombre || 'Solaris Global', icon: <Building2 className="w-5 h-5 text-indigo-400" /> };
  }, [businessModules, ownerInfo]);

  // ── Navegar a la gestión operativa del negocio activo ─────────────────────
/*  const goToOperations = async () => {
    if (businessModules.length === 0) return;
    
    const mod = businessModules.length === 1
      ? businessModules[0]
      : (businessModules.find(m => m.is_active) || businessModules[0]);
    const base = MODULE_URLS[mod.type] || MODULE_URLS.hotel;
    const { data: { session } } = await supabase.auth.getSession();
    const params = new URLSearchParams({
      business_id: mod.reference_id,
      access_token: session?.access_token || '',
      refresh_token: session?.refresh_token || '',
    });
    if (mod.hotel_id) params.set('hotel_id', mod.hotel_id);
    window.location.href = `${base}/?${params.toString()}`;
  };*/

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

  const chatEndRef      = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

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
      : 'idle';

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    send(input);
  };

  const clearChat = () => setMessages([]);

  const toolCount = Object.keys(TOOL_LABELS).length;

  return (
    <div className="flex flex-col h-[calc(100vh-1px)] bg-slate-50 text-slate-850 font-sans overflow-hidden">
        
        {/* ── Page Header ── */}
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Sparkles className="text-indigo-650 w-6 h-6 animate-pulse" />
              Chat Operativo (Solaris AI)
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Interactúa con el asistente de inteligencia artificial para consultar métricas, crear reservas y administrar tus negocios.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* LED Status Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
              <span className={`w-2 h-2 rounded-full ${
                orbState === 'offline' ? 'bg-rose-500 animate-pulse' :
                orbState === 'thinking' ? 'bg-indigo-500 animate-pulse' :
                'bg-emerald-500'
              }`} />
              <span>
                {orbState === 'offline' ? 'Sin Conexión' :
                 orbState === 'thinking' ? 'Procesando...' :
                 'Solaris AI En línea'}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold shadow-sm">
              Solaris AI Engine
            </div>
          </div>
        </header>

        {/* ── Main Layout Wrapper ── */}
        <div className="flex-1 flex overflow-hidden p-6 gap-6 min-h-0 bg-slate-50">

          {/* ── Left Panel: Context & Quick Actions ── */}
          <div className="w-72 shrink-0 hidden lg:flex flex-col gap-4 relative z-10 h-full min-h-0">
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                  {activeBusiness.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Establecimiento Activo</p>
                  <p className="text-sm text-slate-800 font-bold truncate">{activeBusiness.label}</p>
                </div>
              </div>

              <hr className="border-slate-100 mb-4" />

              <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 flex flex-col min-h-0">
                {/* Acciones Rápidas Dinámicas por Módulo */}
                {businessModules.length > 0 && (
                  <div className="mb-6 shrink-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Acciones Rápidas</p>
                    <div className="space-y-3 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                      {businessModules.map(mod => {
                        const actions = getQuickActionsForModule(mod);
                        if (actions.length === 0) return null;
                        return (
                          <div key={mod.id} className="space-y-1">
                            <p className="text-[9px] font-bold text-slate-450 uppercase truncate px-1">
                              {mod.name || (mod.type === 'gym' ? 'Gimnasio' : mod.type === 'restaurant' ? 'Restaurante' : 'Hotel')}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {actions.map((act, ai) => (
                                <button key={ai} onClick={act.action}
                                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-150 transition-all text-center shadow-sm">
                                  <div className="text-indigo-600 mb-1">{act.icon}</div>
                                  <span className="text-[9px] font-bold text-slate-650 leading-tight line-clamp-2">{act.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}



                
                <div className="flex-1 flex flex-col min-h-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 shrink-0">
                    Actividad Reciente
                  </p>
                  <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                    {messages.filter(m => m.role === 'user').slice(-5).reverse().map((m, i) => (
                      <div key={i} className="flex gap-2.5 p-2 rounded-lg hover:bg-slate-50/50 border border-transparent hover:border-slate-100 transition-all">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5 border border-slate-200">
                          <Search className="w-3 h-3 text-slate-550" />
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {m.content}
                        </p>
                      </div>
                    ))}
                    {messages.filter(m => m.role === 'user').length === 0 && (
                      <p className="text-xs text-slate-400 italic">No hay actividad en esta sesión.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 shrink-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Módulos de Gestión
                </p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                  {businessModules.map(mod => {
                    const icon = mod.type === 'gym' ? <Dumbbell className="w-3.5 h-3.5" />
                      : mod.type === 'restaurant' ? <UtensilsCrossed className="w-3.5 h-3.5" />
                      : <Building2 className="w-3.5 h-3.5" />;
                    
                    const typeColor = mod.type === 'gym' ? 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                      : mod.type === 'restaurant' ? 'hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                      : 'hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200';

                    return (
                      <button 
                        key={mod.id} 
                        onClick={() => enterModule(mod)}
                        className={`w-full flex items-center gap-2 py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold text-xs shadow-sm transition-all text-left truncate ${typeColor}`}
                      >
                        <span className="shrink-0 text-slate-400">{icon}</span>
                        <span className="truncate">{mod.name || `Gestión ${mod.type === 'gym' ? 'Gimnasio' : mod.type === 'restaurant' ? 'Restaurante' : 'Hotel'}`}</span>
                      </button>
                    );
                  })}
                  {businessModules.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No hay módulos activos.</p>
                  )}
                </div>
              </div>






            </div>
          </div>

          {/* ── Center Chat Area ── */}
          <div className="flex-1 flex flex-col relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm h-full min-h-0">
            
            {/* Header Action inside Chat */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
              {currentContext && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-700 shadow-sm animate-fadeIn">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {currentContext}
                </span>
              )}
              {messages.length > 0 && (
                <button onClick={() => { clearChat(); setCurrentContext(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-650 hover:border-rose-200 text-xs text-slate-500 font-semibold transition-all shadow-sm">
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar Conversación
                </button>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar relative z-10 min-h-0">
              <AnimatePresence mode="popLayout">
                {messages.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto h-full flex flex-col justify-center py-6">
                    <div className="text-center mb-8 relative">
                      <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-55/80 border border-indigo-100 flex items-center justify-center relative shadow-sm">
                          <Sparkles className="w-8 h-8 text-indigo-650 animate-pulse" />
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-emerald-500" />
                        </div>
                      </div>
                      <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Asistente Solaris AI</h2>
                      <p className="text-slate-500 text-sm font-medium">Centro de mando interactivo. ¿En qué te asisto hoy?</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mb-6">
                      {hasHotel && (
                        <button onClick={() => setShowBookingForm(true)}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-100">
                          <CalendarDays className="w-4 h-4" /> Nueva Reserva
                        </button>
                      )}
                      {hasGym && (
                        <button onClick={() => send('Muéstrame los miembros activos en el gimnasio')}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-100">
                          <Dumbbell className="w-4 h-4" /> Miembros del Gimnasio
                        </button>
                      )}
                      {hasRestaurant && (
                        <button onClick={() => send('¿Qué mesas están libres en el restaurante en este momento?')}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm shadow-amber-100">
                          <UtensilsCrossed className="w-4 h-4" /> Mesas del Restaurante
                        </button>
                      )}
                    </div>







                    <div className="grid grid-cols-2 gap-3 max-w-xl mx-auto">
                      {suggestions.slice(0, 4).map((s, i) => (
                        <button key={i} onClick={() => send(s.prompt)}
                          className="text-left bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 p-4 rounded-xl transition-all duration-200 group shadow-sm">
                          <div className="mb-2 p-2 rounded-lg bg-white border border-slate-200 inline-block group-hover:scale-105 transition-transform">{s.icon}</div>
                          <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-950 transition-colors">{s.title}</p>
                          <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 group-hover:text-slate-500">{s.prompt}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <div className="w-full px-2 md:px-8 mx-auto space-y-5 pb-4">
                    {messages.map((msg, idx) => (
                      <motion.div key={idx}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 group ${msg.role === 'user' ? 'justify-end' : 'items-start'}`}>

                        {msg.role === 'ai' && (
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                            <Sparkles className={`w-4 h-4 text-indigo-650 ${msg.loading ? 'animate-pulse' : ''}`} />
                          </div>
                        )}

                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end flex flex-col' : 'w-full min-w-0'}`}>
                          {/* Tool badges */}
                          {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {[...new Set(msg.toolsUsed)].map(t => {
                                const info = TOOL_LABELS[t] || { label: t, color: 'text-slate-600 bg-slate-100 border border-slate-200' };
                                return (
                                  <span key={t} className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${info.color}`}>
                                    <Database className="w-2.5 h-2.5 shrink-0" />
                                    {info.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Message bubble */}
                          <div className={`relative ${
                            msg.role === 'user'
                              ? 'bg-slate-900 text-white px-5 py-3.5 rounded-2xl rounded-tr-none text-sm shadow-sm inline-block border border-transparent'
                              : 'text-slate-800 bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl rounded-tl-none text-sm shadow-sm w-fit max-w-full'
                          }`}>
                            {msg.loading ? (
                              <div className="flex items-center gap-2 py-1 h-6">
                                {[0,150,300].map(d => (
                                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
                                    style={{ animationDelay: `${d}ms` }} />
                                ))}
                              </div>
                            ) : msg.role === 'ai' ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <MarkdownMessage content={msg.content} />
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                    <button onClick={() => ttsActive ? stopSpeaking() : speak(msg.content)}
                                      title={ttsActive ? 'Detener' : 'Escuchar respuesta'}
                                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-450 hover:text-indigo-650 transition-colors">
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
                                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-200/50">
                                      {ctas.slice(0, 4).map((cta, ci) => (
                                        <button key={ci} onClick={() => send(cta.prompt)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-55 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 text-xs font-semibold text-indigo-700 transition-all">
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
                    {showBookingForm && hasHotel && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                          <CalendarDays className="w-4 h-4 text-indigo-650" />
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
            <div className="relative px-6 pb-6 pt-2 shrink-0 z-20 bg-white border-t border-slate-100">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSubmit}>
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all overflow-hidden relative">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                      }}
                      placeholder="Pregunta sobre tus negocios o da una orden..."
                      rows={1}
                      className="w-full bg-transparent text-slate-800 placeholder-slate-400 px-6 pt-5 pb-3 resize-none focus:outline-none text-[15px] leading-relaxed"
                      style={{ minHeight: 60 }}
                    />
                    <div className="flex items-center justify-between px-4 pb-3 pt-1 border-t border-slate-200/40">
                      <span className="text-[11px] text-slate-400">
                        Enter para enviar · Shift+Enter nueva línea · <kbd className="px-1 py-0.5 rounded bg-slate-200/60 text-[10px] font-mono text-slate-500">⌘K</kbd>
                      </span>
                      <div className="flex items-center gap-3">
                        <button type="submit" disabled={!input.trim() || isTyping}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                            bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-100
                            disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed">
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

          {/* ── Right Panel: Engine Info & Capabilities ── */}
          <div className="w-72 shrink-0 hidden xl:flex flex-col gap-4 relative z-10 h-full min-h-0">
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Motor IA</p>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                  <span className="text-[14px] font-extrabold text-slate-800">Solaris AI Engine</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Modelo multimodal con acceso completo a tu base de datos en tiempo real.
                </p>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex-1 flex flex-col justify-between overflow-hidden min-h-0">
              <div className="flex flex-col min-h-0 flex-1">
                <div className="flex items-center justify-between w-full mb-4 shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Capacidades
                  </p>
                  <div className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full">
                    <span className="text-[10px] font-bold text-indigo-750">
                      {Object.values(enabledTools).filter(Boolean).length} / {toolCount} Activas
                    </span>
                  </div>
                </div>
                
                <div className="space-y-3 mb-4 shrink-0">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Solaris AI puede realizar consultas, crear reservas y modificar datos operativos en tiempo real. 
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 min-h-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                    Consultas Rápidas
                  </p>
                  <div className="space-y-2">
                    {suggestions.slice(0, 4).map((s, i) => (
                      <button 
                        key={i}
                        onClick={() => send(s.prompt)}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-150 transition-all group shadow-sm"
                      >
                        <div className="p-1.5 rounded-lg bg-white border border-slate-200 group-hover:bg-indigo-100 group-hover:border-indigo-200 transition-colors shrink-0">
                          {s.icon}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-950 transition-colors truncate">{s.title}</p>
                          <p className="text-[10px] text-slate-400 truncate group-hover:text-slate-500">{s.prompt}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                <button 
                  onClick={() => setShowConfigModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-sm font-semibold text-slate-700 transition-all group"
                >
                  <Settings className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors" />
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
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setShowConfigModal(false)}
              />
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.98, y: 15 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.98, y: 15 }}
                className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                      <Settings className="w-5 h-5 text-indigo-650" />
                    </div>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">Panel de Control de IA</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Gestiona las capacidades y permisos de Solaris AI.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowConfigModal(false)}
                    className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['Consultas', 'Reservas', 'Operaciones', 'Huéspedes', 'Gimnasio', 'Restaurante', 'Sistema'] as ToolCategory[]).map(category => {
                      const categoryTools = Object.entries(TOOL_LABELS).filter(([_, t]) => t.category === category);
                      if (categoryTools.length === 0) return null;

                      return (
                        <div key={category} className="space-y-3">
                          <h3 className="text-xs font-bold text-slate-550 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">
                            {category}
                          </h3>
                          <div className="space-y-2">
                            {categoryTools.map(([key, { label, color, description }]) => {
                              const isActive = enabledTools[key] !== false;
                              return (
                                <div 
                                  key={key} 
                                  className={`p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-55 border-slate-200/60 opacity-60'}`}
                                >
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isActive ? color : 'bg-slate-200 text-slate-500'}`}>
                                          {label}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-500 leading-relaxed">
                                        {description}
                                      </p>
                                    </div>
                                    <button 
                                      onClick={() => toggleTool(key)}
                                      className={`relative shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${isActive ? 'bg-indigo-600' : 'bg-slate-200'}`}
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
                <div className="px-6 py-4 border-t border-slate-150 bg-slate-50 flex justify-end">
                  <button 
                    onClick={() => setShowConfigModal(false)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-indigo-100"
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
