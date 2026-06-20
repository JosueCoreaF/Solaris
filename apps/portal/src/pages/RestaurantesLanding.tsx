import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UtensilsCrossed, MapPin, Phone, ArrowLeft, ChevronRight, Search, BookOpen } from 'lucide-react';
import { fetchRestaurantes } from '../services/api';
import SolarisLogo from '../components/SolarisLogo';

interface RestItem {
  id: string; nombre: string; ciudad: string | null; direccion: string | null;
  telefono: string | null; platillosCount: number;
}

const Sk = () => (
  <div className="animate-pulse bg-white rounded-3xl border border-stone-100 overflow-hidden">
    <div className="h-24 bg-stone-100" />
    <div className="p-5 space-y-3">
      <div className="h-5 bg-stone-200 rounded-lg w-2/3" />
      <div className="h-3 bg-stone-100 rounded-lg w-1/2" />
    </div>
  </div>
);

export default function RestaurantesLanding() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [ciudad, setCiudad] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurantes().then(setItems).finally(() => setLoading(false));
  }, []);

  const ciudades = [...new Set(items.map(r => r.ciudad).filter(Boolean))] as string[];

  const filtered = items.filter(r =>
    (!ciudad || r.ciudad === ciudad) &&
    (!query.trim() ||
      r.nombre.toLowerCase().includes(query.toLowerCase()) ||
      (r.ciudad ?? '').toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#fafaf8] font-sans">
      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-stone-200/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 h-14 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <SolarisLogo variant="main" size={28} />
            <span className="text-stone-900 font-black text-base tracking-tight">
              solarys<span className="text-amber-600">.uk</span>
            </span>
          </a>
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors">
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
      </nav>

      {/* Hero banner */}
      <div className="relative h-44 lg:h-52 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute -bottom-8 -right-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
          <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <UtensilsCrossed size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Restaurantes</h1>
          <p className="text-sm text-white/85">Reserva tu mesa directamente, sin comisiones.</p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 lg:px-8 py-8 -mt-6 relative z-10">
        {/* Buscador */}
        <div className="relative mb-4 max-w-xl">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre o ciudad…"
            className="w-full pl-9 pr-4 py-3 bg-white border border-stone-200 rounded-2xl text-sm text-stone-800 placeholder-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
          />
        </div>

        {/* Chips de ciudad */}
        {ciudades.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6 scrollbar-hide">
            <button onClick={() => setCiudad(null)}
              className={`shrink-0 text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all ${
                ciudad === null ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
              }`}>
              Todas las ciudades
            </button>
            {ciudades.map(c => (
              <button key={c} onClick={() => setCiudad(c)}
                className={`shrink-0 text-xs font-bold px-3.5 py-1.5 rounded-full border transition-all ${
                  ciudad === c ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-white border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-600'
                }`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading && [1, 2, 3, 4, 5, 6].map(i => <Sk key={i} />)}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-stone-400">
              <UtensilsCrossed size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{query || ciudad ? 'Sin resultados para esa búsqueda.' : 'No hay restaurantes disponibles.'}</p>
            </div>
          )}
          {filtered.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/restaurante/${r.id}`)}
              className="bg-white border border-stone-100 rounded-3xl text-left hover:border-amber-200 hover:shadow-lg hover:-translate-y-0.5 transition-all group overflow-hidden flex flex-col"
            >
              <div className="relative h-24 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 overflow-hidden shrink-0">
                <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                    <UtensilsCrossed size={20} className="text-white" />
                  </div>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="font-black text-stone-900 group-hover:text-amber-700 transition-colors truncate">{r.nombre}</p>
                {(r.ciudad || r.direccion) && (
                  <p className="text-xs text-stone-400 mt-1 flex items-center gap-1 truncate">
                    <MapPin size={10} className="shrink-0" />
                    {[r.ciudad, r.direccion].filter(Boolean).join(' · ')}
                  </p>
                )}
                {r.telefono && (
                  <p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                    <Phone size={10} /> {r.telefono}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <BookOpen size={11} /> {r.platillosCount} platillo{r.platillosCount === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs font-bold text-amber-600 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                    Reservar <ChevronRight size={14} />
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </main>
    </div>
  );
}
