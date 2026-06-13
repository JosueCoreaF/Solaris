import { motion } from 'framer-motion';
import { Hotel, Shield, Zap, Smartphone, Search, MapPin, Calendar, Users, ChevronRight } from 'lucide-react';

const features = [
  { icon: Zap,        title: 'Rápido',          desc: 'Reserva en menos de 2 minutos desde tu teléfono.' },
  { icon: Shield,     title: 'Sin riesgos',      desc: 'Tu información siempre protegida y privada.' },
  { icon: Hotel,      title: 'Directo al hotel', desc: 'Sin comisiones ni intermediarios.' },
  { icon: Smartphone, title: 'Mobile first',     desc: 'Diseñado para funcionar perfecto en móvil y escritorio.' },
];

export default function LandingPage() {
  const hubBase = `${window.location.protocol}//${window.location.hostname}:5174`;
  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col font-sans overflow-hidden">

      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-lg border-b border-stone-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 font-black text-stone-900 text-xl tracking-tight">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center shadow-md">
              <Hotel size={18} className="text-white" />
            </div>
            solarys.uk
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-stone-500 font-semibold hidden sm:block">Portal de Reservas</span>
            <div className="flex items-center gap-2">
              <a href={`${hubBase}/landing/gym`} target="_blank" rel="noopener" className="bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-sm font-bold px-3 py-2 rounded-full transition-colors hidden sm:inline-flex">Ir a Gym</a>
              <a href={`${hubBase}/landing/restaurant`} target="_blank" rel="noopener" className="bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-sm font-bold px-3 py-2 rounded-full transition-colors hidden sm:inline-flex">Ir a Restaurante</a>
              <a href={`${hubBase}/landing/hotel`} target="_blank" rel="noopener" className="bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-sm font-bold px-3 py-2 rounded-full transition-colors hidden sm:inline-flex">Ir a Hotel</a>
              <button className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold px-4 py-2 rounded-full transition-colors hidden md:block">Acceso Hoteleros</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
          
          {/* Lado Izquierdo: Copy & Input */}
          <div className="text-center lg:text-left z-10 relative">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Plataforma Activa
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-stone-900 leading-[1.05] tracking-tight mb-6">
                Reserva en tu<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-stone-500 to-stone-400">hotel favorito</span>
              </h1>

              <p className="text-stone-500 text-lg leading-relaxed mb-10 max-w-md mx-auto lg:mx-0">
                Accede al portal oficial de tu hotel y asegura tu habitación en segundos, sin comisiones ocultas y con la mejor tarifa garantizada.
              </p>

              {/* URL Input interactivo visual */}
              <div className="bg-white border border-stone-200 rounded-2xl p-2 shadow-sm max-w-lg mx-auto lg:mx-0 flex items-center focus-within:ring-2 focus-within:ring-stone-900/10 focus-within:border-stone-300 transition-all">
                <div className="pl-4 pr-2 flex items-center text-stone-400">
                  <Search size={18} />
                </div>
                <div className="flex-1 flex items-center font-mono text-sm sm:text-base overflow-hidden whitespace-nowrap">
                  <span className="text-stone-400 select-none">solarys.uk/</span>
                  <input type="text" 
                    readOnly
                    value="hotel-playa-dorada" 
                    className="bg-transparent border-none focus:outline-none text-stone-800 font-bold w-full truncate" />
                </div>
                <button className="bg-stone-900 hover:bg-stone-800 text-white rounded-xl p-3 flex-shrink-0 transition-transform active:scale-95">
                  <ChevronRight size={20} />
                </button>
              </div>
              <p className="text-xs text-stone-400 mt-3 font-medium">Pide el enlace de reservas directamente a tu hotel.</p>
            </motion.div>
          </div>

          {/* Lado Derecho: Visual Mockup (Oculto en móviles, visible en md+) */}
          <div className="hidden lg:block relative mt-16 lg:mt-0">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-stone-200 to-stone-100 rounded-full blur-3xl opacity-50" />
            
            <motion.div 
              initial={{ opacity: 0, x: 40, y: 20 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
              className="relative z-10 w-full max-w-md mx-auto">
              
              {/* Mockup Principal */}
              <div className="bg-white border border-stone-200 rounded-[2rem] shadow-2xl p-4 transform rotate-1 hover:rotate-0 transition-transform duration-500">
                {/* Imagen del cuarto ficticia usando un div colorido */}
                <div className="h-48 w-full bg-stone-100 rounded-2xl overflow-hidden relative">
                   <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300"></div>
                   <div className="absolute top-3 left-3 bg-white/90 backdrop-blur text-stone-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                      Recomendado
                   </div>
                </div>
                
                <div className="pt-4 pb-2 px-2">
                  <h3 className="text-xl font-black text-stone-900">Suite Frente al Mar</h3>
                  <div className="flex gap-3 mt-2 mb-4">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 bg-stone-50 px-2.5 py-1 rounded-full"><Users size={12}/> 2 Pers.</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500 bg-stone-50 px-2.5 py-1 rounded-full"><MapPin size={12}/> Vistas al mar</span>
                  </div>
                  
                  <div className="flex items-end justify-between bg-stone-50 rounded-2xl p-3 border border-stone-100">
                    <div>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-0.5">Total (2 noches)</p>
                      <p className="text-2xl font-black text-stone-900">$240</p>
                    </div>
                    <div className="bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md">
                      Reservar
                    </div>
                  </div>
                </div>
              </div>

              {/* Elementos flotantes */}
              <motion.div 
                animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -left-12 top-16 bg-white p-3 rounded-2xl shadow-xl border border-stone-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500"><Calendar size={18}/></div>
                <div>
                  <p className="text-[10px] font-bold text-stone-400 uppercase">Fechas</p>
                  <p className="text-sm font-black text-stone-800">12 - 14 Oct</p>
                </div>
              </motion.div>

              <motion.div 
                animate={{ y: [0, 10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -right-8 bottom-12 bg-white px-4 py-3 rounded-2xl shadow-xl border border-stone-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-bold text-stone-700">Confirmación instantánea</p>
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
                transition={{ delay: 0.1 * i, duration: 0.5 }}
                className="bg-white border border-stone-100 rounded-3xl p-6 text-left shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center mb-5">
                  <f.icon size={20} className="text-stone-700" />
                </div>
                <h3 className="text-base font-black text-stone-900 mb-2">{f.title}</h3>
                <p className="text-sm text-stone-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-stone-400 border-t border-stone-200/60 font-medium">
        © {new Date().getFullYear()} Solarys Technologies. Todos los derechos reservados.
      </footer>
    </div>
  );
}
