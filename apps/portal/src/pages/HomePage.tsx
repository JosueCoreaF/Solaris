import { motion } from 'framer-motion';
import { Hotel, Dumbbell, UtensilsCrossed, ChevronRight, Search } from 'lucide-react';
import SolarisLogo from '../components/SolarisLogo';

const verticals = [
  {
    icon: Hotel,
    title: 'Hoteles',
    desc: 'Gestiona reservas, habitaciones y huéspedes. Reservas directas sin comisiones.',
    href: '/landing/hotel',
    color: 'from-sky-700 to-blue-600',
  },
  {
    icon: Dumbbell,
    title: 'Gimnasios',
    desc: 'Membresías, clases y control de acceso centralizados para tu gimnasio.',
    href: '/landing/gym',
    color: 'from-emerald-700 to-indigo-600',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurantes',
    desc: 'Reservas de mesas, menús dinámicos y promociones que aumentan el ticket medio.',
    href: '/landing/restaurant',
    color: 'from-amber-600 to-rose-500',
  },
];

export default function HomePage() {
  const hubBase = import.meta.env.VITE_HUB_URL || `${window.location.protocol}//${window.location.hostname}:5174`;

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
      <nav className="bg-white/80 backdrop-blur-lg border-b border-stone-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="group flex items-center gap-2 z-50">
            <SolarisLogo variant="main" size={36} className="transition-transform duration-300 group-hover:scale-105" />
            <span className="text-stone-900 font-black text-xl tracking-tight transition-colors group-hover:text-stone-800">
              solarys<span className="text-amber-600 font-bold">.uk</span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/buscar" className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors inline-flex items-center gap-2">
              <Search size={16} /> Buscar mi reserva
            </a>
            <button className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold px-4 py-2 rounded-full transition-colors hidden md:block">Acceso Hoteleros</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-6 lg:px-8 py-16 lg:py-24 text-center z-10 relative">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold px-4 py-2 rounded-full mb-8 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Plataforma Activa
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-stone-900 leading-[1.05] tracking-tight mb-6">
            La plataforma para<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-stone-500 to-stone-400">hoteles, gimnasios y restaurantes</span>
          </h1>

          <p className="text-stone-500 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Solaris centraliza reservas, pagos y operaciones para tu negocio — y ofrece a tus clientes un portal de reservas directo, sin comisiones.
          </p>
        </motion.div>

        {/* Cards de verticales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {verticals.map((v, i) => (
            <motion.a
              key={v.title}
              href={`${hubBase}${v.href}`}
              initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              whileHover={{ y: -6 }}
              className="bg-white border border-stone-100 rounded-3xl p-8 text-left shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${v.color} flex items-center justify-center mb-6 shadow-md`}>
                <v.icon size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-black text-stone-900 mb-2">{v.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed mb-4">{v.desc}</p>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-stone-900 group-hover:gap-2 transition-all">
                Conoce más <ChevronRight size={16} />
              </span>
            </motion.a>
          ))}
        </div>

        {/* CTA buscar reserva */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-12 max-w-2xl mx-auto bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="text-left">
            <h3 className="font-black text-stone-900">¿Ya tienes una reserva?</h3>
            <p className="text-sm text-stone-500">Accede al portal de tu hotel directamente.</p>
          </div>
          <a href="/buscar" className="bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold px-5 py-3 rounded-full transition-colors inline-flex items-center gap-2 whitespace-nowrap">
            Ir al Portal de Reservas <ChevronRight size={16} />
          </a>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-stone-400 border-t border-stone-200/60 font-medium z-10 relative">
        © {new Date().getFullYear()} Solarys Technologies. Todos los derechos reservados.
      </footer>
    </div>
  );
}
