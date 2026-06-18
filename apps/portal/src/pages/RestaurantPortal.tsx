import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UtensilsCrossed, MapPin, Phone, Mail, Calendar, Clock,
  Users, ChevronDown, CheckCircle2, Loader2, ArrowLeft, X,
  ChevronRight, Star,
} from 'lucide-react';
import { fetchRestaurante, crearReservaRestaurante } from '../services/api';

interface Mesa { id: string; numero: number; capacidad: number; estado: string; }
interface Platillo { id: string; nombre: string; descripcion: string; precio: number; categoria: string; }
interface Restaurante {
  id: string; nombre: string; direccion: string | null; telefono: string | null;
  correo: string | null; ciudad: string | null;
  mesas: Mesa[]; platillos: Platillo[];
}

const Sk = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-stone-200 rounded-xl ${className}`} />
);

const HORAS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 10;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
}).filter(h => h <= '22:00');

function agruparPlatillos(platillos: Platillo[]) {
  const map: Record<string, Platillo[]> = {};
  platillos.forEach(p => {
    if (!map[p.categoria]) map[p.categoria] = [];
    map[p.categoria].push(p);
  });
  return map;
}

function formatFecha(iso: string) {
  const [y, m, d] = iso.split('-');
  const fecha = new Date(Number(y), Number(m) - 1, Number(d));
  return fecha.toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function hoy() { return new Date().toISOString().split('T')[0]; }

export default function RestaurantPortal() {
  const { restauranteId } = useParams<{ restauranteId: string }>();

  const [rest, setRest] = useState<Restaurante | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(hoy());
  const [hora, setHora] = useState('12:00');
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [menuTab, setMenuTab] = useState<string | null>(null);

  useEffect(() => {
    if (!restauranteId) return;
    fetchRestaurante(restauranteId)
      .then(data => {
        setRest(data);
        const cats = Object.keys(agruparPlatillos(data.platillos));
        if (cats.length > 0) setMenuTab(cats[0]);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [restauranteId]);

  const mesasDisponibles = rest?.mesas.filter(m => m.estado === 'disponible') ?? [];
  const capacidadMax = Math.max(0, ...mesasDisponibles.map(m => m.capacidad));
  const hayMesaParaPersonas = mesasDisponibles.some(m => m.capacidad >= personas);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rest) return;
    setFormError(null);
    if (!nombre || !apellido || !telefono || !fecha || !hora) {
      setFormError('Completa todos los campos requeridos.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await crearReservaRestaurante({
        id_restaurant: rest.id,
        nombre, apellido, correo, telefono, fecha, hora,
        personas, observaciones,
      });
      setSuccess(resp.mensaje);
      setShowForm(false);
      setNombre(''); setApellido(''); setCorreo(''); setTelefono(''); setObservaciones('');
      setPersonas(2); setFecha(hoy()); setHora('12:00');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fdfaf6]">
        <div className="h-56 bg-gradient-to-br from-amber-100 to-orange-100 animate-pulse" />
        <div className="max-w-2xl mx-auto px-4 -mt-10 space-y-4">
          <Sk className="h-32 w-full rounded-3xl" />
          <Sk className="h-24 w-full rounded-3xl" />
          <Sk className="h-48 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !rest) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="text-red-400" size={28} />
          </div>
          <h2 className="text-lg font-bold text-stone-800 mb-2">Restaurante no encontrado</h2>
          <p className="text-sm text-stone-500 mb-6">{error ?? 'El enlace puede ser incorrecto.'}</p>
          <Link to="/" className="text-sm text-amber-600 font-semibold hover:underline">← Volver al inicio</Link>
        </div>
      </div>
    );
  }

  const grupos = agruparPlatillos(rest.platillos);
  const categorias = Object.keys(grupos);

  return (
    <div className="min-h-screen bg-[#fdfaf6] font-sans">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-amber-100/60 px-4 py-3 flex items-center gap-3">
        <Link to="/landing/restaurant" className="text-stone-400 hover:text-amber-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-stone-800 truncate">{rest.nombre}</h1>
          {rest.ciudad && <p className="text-xs text-stone-400">{rest.ciudad}</p>}
        </div>
        <button
          onClick={() => { setShowForm(true); setSuccess(null); }}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm shadow-amber-200"
        >
          <Calendar size={13} />
          Reservar mesa
        </button>
      </nav>

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative h-52 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <UtensilsCrossed size={44} className="text-white" />
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pb-24">

        {/* ── Info card ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-stone-100 shadow-md -mt-6 relative z-10 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-stone-900 leading-tight">{rest.nombre}</h2>
              {rest.ciudad && (
                <p className="text-sm text-amber-600 font-medium mt-1 flex items-center gap-1">
                  <MapPin size={12} /> {rest.ciudad}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg shrink-0">
              <Star size={12} className="text-amber-500 fill-amber-500" />
              <span className="text-xs font-bold text-amber-700">Reserva online</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {rest.direccion && (
              <div className="flex items-start gap-2 text-sm text-stone-500">
                <MapPin size={14} className="mt-0.5 shrink-0 text-amber-400" />
                <span>{rest.direccion}</span>
              </div>
            )}
            {rest.telefono && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Phone size={14} className="shrink-0 text-amber-400" />
                <a href={`tel:${rest.telefono}`} className="hover:text-amber-600 transition-colors">{rest.telefono}</a>
              </div>
            )}
            {rest.correo && (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Mail size={14} className="shrink-0 text-amber-400" />
                <a href={`mailto:${rest.correo}`} className="hover:text-amber-600 transition-colors">{rest.correo}</a>
              </div>
            )}
          </div>

          <button
            onClick={() => { setShowForm(true); setSuccess(null); }}
            className="mt-5 w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-sm shadow-amber-200"
          >
            <Calendar size={16} />
            Reservar una mesa
          </button>
        </motion.div>

        {/* ── Éxito ──────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3"
            >
              <CheckCircle2 size={18} className="text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-800">¡Reserva confirmada!</p>
                <p className="text-xs text-emerald-600 mt-0.5">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Disponibilidad ─────────────────────────────────────────────── */}
        {rest.mesas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="mt-4 bg-white rounded-3xl border border-stone-100 shadow-sm p-5"
          >
            <h3 className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-2">
              <Users size={15} className="text-amber-500" />
              Disponibilidad ahora
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: mesasDisponibles.length, label: 'Disponibles', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
                { val: rest.mesas.filter(m => m.estado !== 'disponible').length, label: 'Ocupadas', cls: 'bg-red-50 text-red-600 border-red-100' },
                { val: rest.mesas.length, label: 'Total', cls: 'bg-stone-50 text-stone-600 border-stone-100' },
                { val: `${capacidadMax}p`, label: 'Cap. máx.', cls: 'bg-amber-50 text-amber-700 border-amber-100' },
              ].map(item => (
                <div key={item.label} className={`rounded-2xl border p-3 text-center ${item.cls}`}>
                  <div className="text-xl font-black">{item.val}</div>
                  <div className="text-[10px] font-medium opacity-75 mt-0.5 leading-tight">{item.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Menú ───────────────────────────────────────────────────────── */}
        {categorias.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="mt-4 bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden"
          >
            <div className="px-5 pt-5 pb-1 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <UtensilsCrossed size={14} className="text-amber-500" />
                Nuestra carta
              </h3>
              <span className="text-xs text-stone-400">{rest.platillos.length} platillos</span>
            </div>

            <div className="flex gap-1.5 overflow-x-auto px-5 py-3 scrollbar-hide">
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setMenuTab(cat)}
                  className={`whitespace-nowrap text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all ${
                    menuTab === cat
                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                      : 'bg-white border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="px-5 pb-5 space-y-0.5">
              {(menuTab ? grupos[menuTab] : []).map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-start justify-between gap-3 py-3 border-b border-stone-50 last:border-0 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-800 group-hover:text-amber-700 transition-colors">{p.nombre}</p>
                    {p.descripcion && <p className="text-xs text-stone-400 mt-0.5 line-clamp-2 leading-relaxed">{p.descripcion}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-base font-black text-amber-600">
                      L {p.precio.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      {/* ── FAB flotante ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setShowForm(true); setSuccess(null); }}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm px-6 py-3.5 rounded-full shadow-lg shadow-amber-300/50"
        >
          <Calendar size={16} />
          Reservar mesa
          <ChevronRight size={14} />
        </motion.button>
      </div>

      {/* ── Modal de reserva ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 38 }}
              className="bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-md max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              <div className="sticky top-0 bg-white rounded-t-3xl z-10 px-5 pt-5 pb-4 border-b border-stone-100">
                <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4 md:hidden" />
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-black text-stone-900">Reservar mesa</h2>
                    <p className="text-xs text-stone-400 mt-0.5">{rest.nombre}</p>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4">

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <Calendar size={10} /> Fecha
                    </label>
                    <input type="date" min={hoy()} value={fecha} onChange={e => setFecha(e.target.value)}
                      className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                      <Clock size={10} /> Hora
                    </label>
                    <div className="relative">
                      <select value={hora} onChange={e => setHora(e.target.value)}
                        className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 appearance-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 bg-white">
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {fecha && <p className="text-xs text-amber-600 font-medium -mt-2 capitalize">{formatFecha(fecha)}</p>}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wide flex items-center gap-1">
                    <Users size={10} /> Personas
                  </label>
                  <div className="flex items-center gap-4 bg-stone-50 rounded-xl px-4 py-2.5 border border-stone-100">
                    <button type="button" onClick={() => setPersonas(p => Math.max(1, p - 1))}
                      className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-700 flex items-center justify-center text-lg font-light hover:border-amber-300 transition-colors shadow-sm">−</button>
                    <span className="flex-1 text-center text-lg font-black text-stone-800">{personas}</span>
                    <button type="button" onClick={() => setPersonas(p => Math.min(20, p + 1))}
                      className="w-8 h-8 rounded-full bg-white border border-stone-200 text-stone-700 flex items-center justify-center text-lg font-light hover:border-amber-300 transition-colors shadow-sm">+</button>
                  </div>
                  {!hayMesaParaPersonas && mesasDisponibles.length > 0 && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5">No hay mesa disponible para {personas} personas. Máx. disponible: {capacidadMax}.</p>
                  )}
                  {mesasDisponibles.length === 0 && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-1.5">Sin mesas disponibles ahora. Llama directamente al restaurante.</p>
                  )}
                </div>

                <hr className="border-stone-100" />

                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Tus datos</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} required
                      className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 placeholder:text-stone-300" />
                    <input placeholder="Apellido *" value={apellido} onChange={e => setApellido(e.target.value)} required
                      className="border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 placeholder:text-stone-300" />
                  </div>
                  <input type="tel" placeholder="Teléfono *" value={telefono} onChange={e => setTelefono(e.target.value)} required
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 placeholder:text-stone-300" />
                  <input type="email" placeholder="Correo electrónico (opcional)" value={correo} onChange={e => setCorreo(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 placeholder:text-stone-300" />
                  <textarea placeholder="Solicitudes especiales o alergias…" value={observaciones} onChange={e => setObservaciones(e.target.value)}
                    rows={2} className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 placeholder:text-stone-300" />
                </div>

                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 font-medium">{formError}</div>
                )}

                <button type="submit" disabled={submitting || mesasDisponibles.length === 0}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-sm">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {submitting ? 'Confirmando…' : 'Confirmar reserva'}
                </button>

                <p className="text-center text-xs text-stone-400">
                  El restaurante puede contactarte para confirmar tu mesa.
                </p>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
