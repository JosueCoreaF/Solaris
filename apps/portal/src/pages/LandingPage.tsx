import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hotel, Shield, Zap, Smartphone, Search, MapPin, Calendar, Users, ChevronRight } from 'lucide-react';
import { buscarHoteles, type HotelSuggestion } from '../services/api';

const features = [
  { 
    icon: Zap, 
    title: 'Rápido', 
    desc: 'Reserva en menos de 2 minutos desde tu teléfono.',
    colorClass: 'bg-amber-50/80 text-amber-600 border-amber-100/50 hover:shadow-amber-100/30'
  },
  { 
    icon: Shield, 
    title: 'Sin riesgos', 
    desc: 'Tu información siempre protegida y privada.',
    colorClass: 'bg-emerald-50/80 text-emerald-600 border-emerald-100/50 hover:shadow-emerald-100/30'
  },
  { 
    icon: Hotel, 
    title: 'Directo al hotel', 
    desc: 'Sin comisiones ni intermediarios directos.',
    colorClass: 'bg-blue-50/80 text-blue-600 border-blue-100/50 hover:shadow-blue-100/30'
  },
  { 
    icon: Smartphone, 
    title: 'Mobile first', 
    desc: 'Diseñado para funcionar perfecto en móvil y escritorio.',
    colorClass: 'bg-violet-50/80 text-violet-600 border-violet-100/50 hover:shadow-violet-100/30'
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<HotelSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      buscarHoteles(term)
        .then((data) => setSuggestions(data))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const goToHotel = (slug: string) => {
    if (slug) navigate(`/${slug}`);
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col font-sans overflow-hidden relative">
      
      {/* Ambient glowing blobs */}
      <motion.div 
        animate={{
          scale: [1, 1.15, 1],
          x: [0, 30, 0],
          y: [0, -30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[-10%] left-[-15%] w-[650px] h-[650px] rounded-full bg-emerald-200/10 blur-[140px] pointer-events-none z-0" 
      />
      <motion.div 
        animate={{
          scale: [1, 1.1, 1],
          x: [0, -40, 0],
          y: [0, 40, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}
        className="absolute top-[15%] right-[-15%] w-[700px] h-[700px] rounded-full bg-amber-200/15 blur-[160px] pointer-events-none z-0" 
      />
      <motion.div 
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 25, 0],
          y: [0, 25, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}
        className="absolute bottom-[-10%] left-[20%] w-[550px] h-[550px] rounded-full bg-blue-100/10 blur-[130px] pointer-events-none z-0" 
      />

      {/* Grid Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none z-0" />

      {/* Nav */}
      <nav className="bg-white/70 backdrop-blur-md border-b border-stone-200/40 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="group flex items-center gap-3 z-10">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105 border border-stone-850">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3L21 12L12 21L3 12L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="3" className="fill-amber-500 stroke-none" />
              </svg>
            </div>
            <span className="text-stone-900 font-black text-xl tracking-tight transition-colors group-hover:text-stone-800">
              solarys<span className="text-amber-600 font-bold">.uk</span>
            </span>
          </a>
          <div className="flex items-center gap-4 z-10">
            <span className="text-sm text-stone-500 font-bold hidden sm:block">Portal de Reservas</span>
            <div className="flex items-center gap-2">
              <a href="/" className="bg-white/95 border border-stone-200/80 hover:bg-stone-50 text-stone-800 text-sm font-bold px-4 py-2 rounded-full shadow-sm transition-colors hidden sm:inline-flex">Inicio</a>
              <button className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-sm transition-colors hidden md:block">Acceso Hoteleros</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-6 lg:px-8 py-10 lg:py-20 z-10 relative">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          
          {/* Lado Izquierdo: Copy & Input */}
          <div className="text-center lg:text-left z-10 relative">
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100/60 text-emerald-600 text-xs font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Plataforma Activa
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-stone-900 leading-[1.02] tracking-tight mb-6">
                Reserva en tu<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-stone-900 via-amber-800 to-amber-600">hotel favorito</span>
              </h1>

              <p className="text-stone-500 text-lg leading-relaxed mb-10 max-w-md mx-auto lg:mx-0 font-medium">
                Accede al portal oficial de tu hotel y asegura tu habitación en segundos, sin comisiones ocultas y con la mejor tarifa garantizada del mercado.
              </p>

              {/* Buscador de hoteles con autocompletado */}
              <div ref={boxRef} className="relative max-w-lg mx-auto lg:mx-0">
                <div className="bg-white border border-stone-200/80 rounded-[1.25rem] p-2.5 shadow-md flex items-center focus-within:ring-4 focus-within:ring-amber-500/10 focus-within:border-amber-600/30 transition-all duration-300">
                  <div className="pl-3 pr-2 flex items-center text-stone-400">
                    <Search size={19} />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && suggestions.length > 0) goToHotel(suggestions[0].slug);
                    }}
                    placeholder="Escribe el nombre de tu hotel…"
                    className="flex-1 bg-transparent border-none focus:outline-none text-stone-800 font-bold text-sm sm:text-base placeholder:text-stone-400 placeholder:font-normal"
                  />
                  <button
                    onClick={() => suggestions[0] && goToHotel(suggestions[0].slug)}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl p-3 flex-shrink-0 transition-all active:scale-95 shadow-md shadow-amber-600/20"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                {/* Dropdown de resultados */}
                {open && query.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-stone-200/80 rounded-2xl shadow-xl overflow-hidden z-20 text-left">
                    {loading && (
                      <div className="px-4 py-4 text-sm text-stone-400 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" />
                        Buscando…
                      </div>
                    )}
                    {!loading && suggestions.length === 0 && (
                      <div className="px-4 py-4 text-sm text-stone-400">No se encontraron hoteles con ese nombre.</div>
                    )}
                    {!loading && suggestions.map((h) => (
                      <button
                        key={h.slug}
                        onClick={() => goToHotel(h.slug)}
                        className="w-full flex items-center gap-3.5 px-5 py-3 hover:bg-stone-50 transition-colors text-left border-b border-stone-100 last:border-0"
                      >
                        <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0 text-stone-500">
                          <Hotel size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-stone-900 truncate">{h.nombre}</p>
                          <p className="text-xs text-stone-400 truncate">solarys.uk/{h.slug}{h.ciudad ? ` · ${h.ciudad}` : ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-3.5 font-bold">Escribe el nombre de tu hotel y selecciónalo para acceder a su portal de reservas.</p>
            </motion.div>
          </div>

          {/* Lado Derecho: Visual Mockup (Oculto en móviles, visible en md+) */}
          <div className="hidden lg:block relative mt-16 lg:mt-0">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-amber-200/25 via-emerald-200/15 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none" />
            
            <motion.div 
              initial={{ opacity: 0, x: 40, y: 20 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10 w-full max-w-md mx-auto">
              
              {/* Mockup Principal */}
              <div className="bg-white border border-stone-100 rounded-[2.25rem] shadow-2xl p-4 transform rotate-1 hover:rotate-0 hover:scale-[1.01] transition-all duration-500 ease-out hover:shadow-stone-200/60">
                {/* Imagen del cuarto ficticia */}
                <div className="h-52 w-full bg-stone-100 rounded-2xl overflow-hidden relative group/img">
                   <img 
                     src="https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80" 
                     alt="Suite Frente al Mar"
                     className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/img:scale-115"
                     draggable={false}
                   />
                   <div className="absolute top-3 left-3 bg-white/95 backdrop-blur text-stone-900 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-sm">
                      Recomendado
                   </div>
                </div>
                
                <div className="pt-4 pb-2 px-1">
                  <h3 className="text-xl font-black text-stone-900">Suite Frente al Mar</h3>
                  <div className="flex gap-2.5 mt-2 mb-4">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-50 border border-stone-100 px-3 py-1 rounded-full"><Users size={12}/> 2 Pers.</span>
                    <span className="flex items-center gap-1 text-[10px] font-bold text-stone-500 bg-stone-50 border border-stone-100 px-3 py-1 rounded-full"><MapPin size={12}/> Vistas al mar</span>
                  </div>
                  
                  <div className="flex items-end justify-between bg-stone-50/50 rounded-2xl p-3 border border-stone-100/60">
                    <div>
                      <p className="text-[9px] text-stone-400 font-bold uppercase tracking-widest mb-0.5">Total (2 noches)</p>
                      <p className="text-2xl font-black text-stone-900">$240</p>
                    </div>
                    <div className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-4 py-3 rounded-xl shadow-md shadow-amber-600/10 cursor-pointer transition-colors">
                      Reservar
                    </div>
                  </div>
                </div>
              </div>

              {/* Elementos flotantes */}
              <motion.div 
                animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -left-12 top-16 bg-white p-3 rounded-2xl shadow-xl border border-stone-100 flex items-center gap-3 z-20">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500"><Calendar size={18}/></div>
                <div>
                  <p className="text-[9px] font-bold text-stone-400 uppercase">Fechas</p>
                  <p className="text-sm font-black text-stone-800">12 - 14 Oct</p>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -right-8 bottom-28 bg-white px-4 py-3 rounded-2xl shadow-xl border border-stone-100 flex items-center gap-2 z-20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-black text-stone-700">Confirmación instantánea</p>
              </motion.div>

            </motion.div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-20 lg:mt-32">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: 0.08 * i, duration: 0.5 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className={`bg-white border border-stone-100 rounded-3xl p-6 text-left shadow-sm hover:shadow-lg transition-all duration-300 ${f.colorClass}`}>
                <div className="w-12 h-12 rounded-2xl border flex items-center justify-center mb-5 bg-white shadow-sm">
                  <f.icon size={20} />
                </div>
                <h3 className="text-base font-black text-stone-900 mb-2">{f.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed font-medium">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-stone-400 border-t border-stone-200/60 font-semibold z-10 relative">
        © {new Date().getFullYear()} Solarys Technologies. Todos los derechos reservados.
      </footer>
    </div>
  );
}
