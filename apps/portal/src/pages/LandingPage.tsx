import { motion } from 'framer-motion';
import { Hotel, Shield, Zap, Smartphone } from 'lucide-react';

const features = [
  { icon: Zap,        title: 'Rápido',          desc: 'Reserva en menos de 2 minutos desde tu teléfono.' },
  { icon: Shield,     title: 'Sin riesgos',      desc: 'Tu información siempre protegida y privada.' },
  { icon: Hotel,      title: 'Directo al hotel', desc: 'Sin comisiones ni intermediarios.' },
  { icon: Smartphone, title: 'Mobile first',     desc: 'Diseñado para funcionar perfecto en móvil.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">

      {/* Nav */}
      <nav className="bg-white border-b border-stone-100 sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-black text-stone-900 text-lg tracking-tight">
            <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center">
              <Hotel size={15} className="text-white" />
            </div>
            solarys.uk
          </div>
          <span className="text-xs text-stone-400 font-medium hidden sm:block">Portal de Reservas</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-5 py-16 text-center max-w-xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full">

          <div className="inline-flex items-center gap-2 bg-white border border-stone-200 text-stone-500 text-xs font-semibold px-4 py-2 rounded-full mb-7 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Portal activo
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-stone-900 leading-[1.1] mb-5">
            Reserva en tu<br />
            <span className="text-stone-400">hotel favorito</span>
          </h1>

          <p className="text-stone-500 text-base leading-relaxed mb-8 max-w-sm mx-auto">
            Accede al portal de tu hotel con el enlace que te compartieron y completa tu reserva en segundos.
          </p>

          {/* URL example */}
          <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4 mb-8 shadow-sm">
            <p className="text-[11px] text-stone-400 font-medium uppercase tracking-wider mb-2">Tu enlace de reservas</p>
            <div className="flex items-center justify-center gap-1 font-mono">
              <span className="text-stone-300 text-sm">solarys.uk/</span>
              <span className="text-stone-800 text-sm font-bold bg-stone-100 px-2 py-0.5 rounded-lg">hotel-playa-dorada</span>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.35 }}
                className="bg-white border border-stone-100 rounded-2xl p-4 text-left">
                <div className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center mb-2.5">
                  <f.icon size={14} className="text-white" />
                </div>
                <p className="text-sm font-bold text-stone-800 mb-0.5">{f.title}</p>
                <p className="text-xs text-stone-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-stone-300 border-t border-stone-100">
        © {new Date().getFullYear()} Solarys
      </footer>
    </div>
  );
}
