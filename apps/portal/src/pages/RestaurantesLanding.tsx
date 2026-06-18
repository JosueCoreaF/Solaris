import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, MapPin, Phone, ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { fetchRestaurantes } from '../services/api';
import SolarisLogo from '../components/SolarisLogo';

interface RestItem { id: string; nombre: string; ciudad: string | null; direccion: string | null; telefono: string | null; }

const Sk = () => (
  <div className="animate-pulse bg-white rounded-3xl border border-stone-100 p-6 space-y-3">
    <div className="h-5 bg-stone-200 rounded-lg w-2/3" />
    <div className="h-3 bg-stone-100 rounded-lg w-1/2" />
    <div className="h-3 bg-stone-100 rounded-lg w-1/3" />
  </div>
);

export default function RestaurantesLanding() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchRestaurantes().then(setItems).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(r =>
    !query.trim() ||
    r.nombre.toLowerCase().includes(query.toLowerCase()) ||
    (r.ciudad ?? '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafaf8] font-sans">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-stone-200/50 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <SolarisLogo variant="main" size={28} />
            <span className="text-stone-900 font-black text-base tracking-tight">
              solarys<span className="text-amber-600">.uk</span>
            </span>
          </a>
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors">
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-10">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed size={24} className="text-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Restaurantes</h1>
          <p className="text-sm text-stone-500 mt-2">Reserva tu mesa directamente, sin comisiones.</p>
        </motion.div>

        {/* Buscador */}
        <div className="relative mb-6">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre o ciudad…"
            className="w-full pl-9 pr-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
          />
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {loading && [1, 2, 3].map(i => <Sk key={i} />)}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-16 text-stone-400">
              <UtensilsCrossed size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{query ? 'Sin resultados para esa búsqueda.' : 'No hay restaurantes disponibles.'}</p>
            </div>
          )}
          {filtered.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/restaurante/${r.id}`)}
              className="w-full bg-white border border-stone-100 rounded-3xl p-5 text-left hover:border-amber-200 hover:shadow-md transition-all group flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                <UtensilsCrossed size={20} className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 group-hover:text-amber-700 transition-colors truncate">{r.nombre}</p>
                {(r.ciudad || r.direccion) && (
                  <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1 truncate">
                    <MapPin size={10} className="shrink-0" />
                    {[r.ciudad, r.direccion].filter(Boolean).join(' · ')}
                  </p>
                )}
                {r.telefono && (
                  <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                    <Phone size={10} /> {r.telefono}
                  </p>
                )}
              </div>
              <ChevronRight size={16} className="text-stone-300 group-hover:text-amber-500 transition-colors shrink-0" />
            </motion.button>
          ))}
        </div>
      </main>
    </div>
  );
}
