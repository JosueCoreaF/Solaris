import { motion } from 'framer-motion';
import { Hotel, Dumbbell, UtensilsCrossed, ChevronRight, Search, Sparkles, Cpu, Bot } from 'lucide-react';
import SolarisLogo from '../components/SolarisLogo';

const verticals = [
  {
    icon: Hotel,
    title: 'Hoteles',
    desc: 'Busca disponibilidad y reserva tu habitación directamente, sin comisiones.',
    clientHref: '/buscar',
    clientLabel: 'Buscar hotel',
    businessHref: '/landing/hotel',
    color: 'from-sky-700 to-blue-600',
  },
  {
    icon: Dumbbell,
    title: 'Gimnasios',
    desc: 'Explora planes, horarios de clases y solicita tu membresía en línea.',
    clientHref: '/landing/gym',
    clientLabel: 'Ver gimnasios',
    businessHref: '/landing/gym',
    color: 'from-emerald-700 to-indigo-600',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurantes',
    desc: 'Reserva tu mesa, revisa el menú y elige el horario que más te convenga.',
    clientHref: '/landing/restaurant',
    clientLabel: 'Ver restaurantes',
    businessHref: '/landing/restaurant',
    color: 'from-amber-600 to-rose-500',
  },
];

export default function HomePage() {
  const getHubUrl = () => {
    const envHubUrl = import.meta.env.VITE_HUB_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal) {
      return envHubUrl || `${window.location.protocol}//${window.location.hostname}:5174`;
    }

    if (!envHubUrl || envHubUrl.includes('localhost') || envHubUrl.includes('127.0.0.1')) {
      const hostname = window.location.hostname;
      if (hostname.endsWith('solarys.uk')) {
        return 'https://panel.solarys.uk';
      }
      if (hostname.includes('-portal')) {
        return `${window.location.protocol}//${hostname.replace('-portal', '-hub')}`;
      }
      const parts = hostname.split('.');
      if (parts.length > 2) {
        return `${window.location.protocol}//panel.${parts.slice(1).join('.')}`;
      }
      return 'https://panel.solarys.uk';
    }
    return envHubUrl;
  };

  const hubBase = getHubUrl();

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
            <motion.div
              key={v.title}
              initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.1 * i, duration: 0.5 }}
              whileHover={{ y: -6 }}
              className="bg-white border border-stone-100 rounded-3xl p-8 text-left shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${v.color} flex items-center justify-center mb-6 shadow-md`}>
                <v.icon size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-black text-stone-900 mb-2">{v.title}</h3>
              <p className="text-sm text-stone-500 leading-relaxed mb-6 flex-1">{v.desc}</p>
              <a href={v.clientHref} className="inline-flex items-center gap-1 text-sm font-bold text-stone-900 hover:gap-2 transition-all mb-2">
                {v.clientLabel} <ChevronRight size={16} />
              </a>
              <a href={`${hubBase}${v.businessHref}`} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
                Para tu negocio →
              </a>
            </motion.div>
          ))}
        </div>

        {/* Sección: Lo Nuevo en Solaris */}
        <div className="mt-24 max-w-5xl mx-auto text-left">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-mono font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full w-fit mb-4">
            <Sparkles size={12} className="animate-spin" style={{ animationDuration: '3s' }} />
            Lo nuevo en Solaris
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-stone-900 tracking-tight mb-4">
            Ecosistema Inteligente & Conectividad MCP
          </h2>
          <p className="text-stone-500 text-sm sm:text-base leading-relaxed mb-10 max-w-2xl font-medium">
            Llevamos la automatización comercial al siguiente nivel. Portales de reserva directa para clientes, copilotos de IA nativos para cada módulo y un servidor MCP que expone tus datos a cualquier agente externo autorizado.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Tarjeta 1: Chatbots e Inteligencia de Negocio */}
            <div className="bg-white border border-stone-100 rounded-3xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center mb-6">
                  <Bot size={22} />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-3">Copilotos Conversacionales de IA</h3>
                <p className="text-sm text-stone-500 leading-relaxed mb-6 font-medium">
                  Tres copilotos especializados, uno por módulo, integrados nativamente con tu base de datos en tiempo real. Ejecutan operaciones completas desde el chat, sin abrir formularios:
                </p>
                <ul className="space-y-3.5 mb-8">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-[10px]">M</span>
                    <div>
                      <strong className="text-stone-800 text-sm block">Mars (Módulo Hotel)</strong>
                      <span className="text-stone-500 text-xs leading-relaxed block">Gestiona múltiples hoteles desde un solo chat: crea huéspedes, genera o cancela reservas, administra bloqueos y disponibilidad de habitaciones, y calcula tarifas con desglose de ISV y Tasa Turística.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-[10px]">A</span>
                    <div>
                      <strong className="text-stone-800 text-sm block">Apolo (Módulo Gym)</strong>
                      <span className="text-stone-500 text-xs leading-relaxed block">Registra miembros, inscribe a planes calculando vencimiento y costo total, procesa pagos de cuotas y activa solicitudes de membresía recibidas desde el portal público.</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center font-black text-[10px]">R</span>
                    <div>
                      <strong className="text-stone-800 text-sm block">ChefAI (Módulo Restaurante)</strong>
                      <span className="text-stone-500 text-xs leading-relaxed block">Opera el restaurante completo desde el chat: crea y gestiona comandas, reserva mesas por disponibilidad horaria, controla inventario con alertas de reposición, registra gastos y genera reportes de ventas.</span>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-stone-50 border border-stone-100/50 rounded-2xl p-4 text-xs font-mono text-stone-500 leading-relaxed">
                <span className="font-bold text-stone-700 block mb-1">💡 Ventaja Clave:</span>
                Tres módulos completos — hotel, gimnasio y restaurante — operables desde una sola interfaz de chat. Sin formularios, sin menús, sin capacitación extensa.
              </div>
            </div>

            {/* Tarjeta 2: Conectividad y Servidor MCP */}
            <div className="bg-white border border-stone-100 rounded-3xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center mb-6">
                  <Cpu size={22} />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-3">Servidor Solaris MCP</h3>
                <p className="text-sm text-stone-500 leading-relaxed mb-6 font-medium">
                  Implementamos el estándar <strong className="text-stone-700">Model Context Protocol (MCP)</strong> de la industria. Nuestro servidor MCP unifica los datos de Solaris y los expone de forma segura a cualquier entorno AI compatible:
                </p>
                <div className="space-y-4 mb-8">
                  <div className="border-l-2 border-indigo-500/35 pl-4">
                    <strong className="text-stone-800 text-sm block mb-1">Soporte Multi-Módulo Nativo</strong>
                    <p className="text-stone-500 text-xs leading-relaxed">
                      Un solo servidor expone herramientas específicas para hotel, gimnasio y restaurante. Cada copiloto accede únicamente a los datos del módulo que opera, con aislamiento por propietario.
                    </p>
                  </div>
                  <div className="border-l-2 border-indigo-500/35 pl-4">
                    <strong className="text-stone-800 text-sm block mb-1">Control de Tokens por Negocio</strong>
                    <p className="text-stone-500 text-xs leading-relaxed">
                      Registra y audita el consumo exacto de tokens de IA por propietario y por módulo. Permite asignar cuotas de uso y generar cobros transparentes según el consumo real.
                    </p>
                  </div>
                  <div className="border-l-2 border-indigo-500/35 pl-4">
                    <strong className="text-stone-800 text-sm block mb-1">Compatible con Cualquier Agente AI</strong>
                    <p className="text-stone-500 text-xs leading-relaxed">
                      Conecta Solaris con Claude, GPT u otros modelos externos autorizados. Ideal para agentes autónomos de auditoría, reportes automáticos o flujos de automatización empresarial.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-stone-50 border border-stone-100/50 rounded-2xl p-4 text-xs font-mono text-stone-500 leading-relaxed">
                <span className="font-bold text-stone-700 block mb-1">⚙️ Ventaja Tecnológica:</span>
                Tus datos operativos se convierten en una API semántica segura. Solaris es el primer sistema de gestión hostelera con servidor MCP nativo multi-módulo en la región.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-stone-400 border-t border-stone-200/60 font-medium z-10 relative">
        © {new Date().getFullYear()} Solarys Technologies. Todos los derechos reservados.
      </footer>
    </div>
  );
}
