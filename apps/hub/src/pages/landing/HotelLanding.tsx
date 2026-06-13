import React from 'react';
import { motion } from 'framer-motion';

const HotelLanding: React.FC = () => {
  const portalBase = import.meta.env.VITE_PORTAL_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5177`;
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-gray-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between gap-3">
        <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-700 to-blue-600">Solaris</div>
        <nav className="flex items-center gap-3 sm:gap-4 text-sm text-gray-700">
          <a href="#features" className="hover:underline hidden sm:inline">Características</a>
          <a href="#plans" className="hover:underline hidden sm:inline">Planes</a>
          <a href="#contact" className="hover:underline hidden sm:inline">Contacto</a>
          <a href={`${portalBase}/buscar`} className="inline-block bg-sky-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-sky-700 whitespace-nowrap">Reservar ahora</a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <section className="relative overflow-hidden py-16">
          <div className="absolute -left-24 -top-24 w-72 h-72 rounded-full bg-sky-100 opacity-40 blur-3xl" />
          <div className="absolute right-0 top-10 w-96 h-96 rounded-full bg-blue-100 opacity-40 blur-3xl" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto px-4">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-4xl md:text-5xl font-extrabold leading-tight">Solaris para hoteles — gestiona reservas, habitaciones y huéspedes en un solo lugar</motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-4 text-gray-700 text-lg">Centraliza el check-in/check-out, controla la disponibilidad de habitaciones y ofrece reservas directas a tus huéspedes, sin comisiones de intermediarios.</motion.p>

              <div className="mt-6 flex flex-wrap gap-3">
                <motion.a whileHover={{ scale: 1.03 }} href="#plans" className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-700 to-blue-600 text-white px-6 py-3 rounded-full shadow-lg">Ver planes <span className="text-sm opacity-80">→</span></motion.a>
                <motion.a whileHover={{ scale: 1.03 }} href="#contact" className="inline-flex items-center gap-2 border border-gray-200 px-5 py-3 rounded-full text-gray-700 bg-white">Solicitar demo</motion.a>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div whileHover={{ y: -6 }} className="p-5 bg-white rounded-2xl shadow">
                  <h4 className="font-semibold">Reservas directas</h4>
                  <p className="text-sm text-gray-500 mt-1">Tus huéspedes reservan sin pagar comisiones a terceros.</p>
                </motion.div>
                <motion.div whileHover={{ y: -6 }} className="p-5 bg-white rounded-2xl shadow">
                  <h4 className="font-semibold">Gestión de habitaciones</h4>
                  <p className="text-sm text-gray-500 mt-1">Disponibilidad, precios y estados en tiempo real.</p>
                </motion.div>
              </div>
            </div>

            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="flex items-center justify-center">
              <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white">
                <div className="relative">
                  <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder" alt="Hotel moderno" className="w-full h-64 object-cover" />
                  <div className="absolute left-4 bottom-4 bg-white/90 backdrop-blur rounded-full px-4 py-2 text-sm font-semibold">Habitación disponible</div>
                </div>
                <div className="p-5">
                  <h3 className="font-black text-lg">Hotel Playa Dorada</h3>
                  <p className="text-sm text-gray-600 mt-2">Reservas directas, check-in digital y experiencia personalizada para tus huéspedes.</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Desde</p>
                      <p className="text-xl font-extrabold">$49/noche</p>
                    </div>
                    <a href={`${portalBase}/buscar`} className="bg-sky-600 text-white px-4 py-2 rounded-full">Reservar</a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="py-12">
          <h2 className="text-2xl font-bold">Características clave</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Dashboard</h4>
              <p className="text-sm text-gray-500">Ocupación, ingresos y métricas en tiempo real.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Reservas</h4>
              <p className="text-sm text-gray-500">Calendario de habitaciones y disponibilidad.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Huéspedes</h4>
              <p className="text-sm text-gray-500">Perfiles, historial y comunicación automatizada.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Pagos</h4>
              <p className="text-sm text-gray-500">Cobros, anticipos y facturación integrados.</p>
            </motion.div>
          </div>
        </section>

        <section id="plans" className="py-12">
          <h2 className="text-2xl font-bold">Planes</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Básico</h3>
              <p className="mt-2 text-3xl font-extrabold text-sky-600">$19<span className="text-base font-medium">/mes</span></p>
              <p className="mt-2 text-sm text-gray-500">Ideal para hoteles boutique.</p>
              <button className="mt-4 w-full bg-sky-600 text-white py-2 rounded">Elegir</button>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border shadow-md">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-2 text-3xl font-extrabold text-blue-600">$49<span className="text-base font-medium">/mes</span></p>
              <p className="mt-2 text-sm text-gray-500">Más habitaciones y automatizaciones.</p>
              <button className="mt-4 w-full bg-blue-600 text-white py-2 rounded">Elegir</button>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <p className="mt-2 text-3xl font-extrabold text-gray-900">Contact</p>
              <p className="mt-2 text-sm text-gray-500">Cadenas y soluciones a medida.</p>
              <button className="mt-4 w-full bg-gray-900 text-white py-2 rounded">Contactar</button>
            </motion.div>
          </div>
        </section>

        <section id="contact" className="py-12">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-bold">¿Listo para empezar?</h3>
            <p className="text-sm text-gray-500 mt-2">Escríbenos y te ayudamos a lanzar tu hotel en Solaris.</p>
            <div className="mt-4">
              <a href="mailto:contact@solaris.example" className="inline-block bg-sky-600 text-white px-5 py-2 rounded">Contactar</a>
            </div>
          </div>
        </section>

        <section id="benefits" className="py-12">
          <h2 className="text-2xl font-bold">Por qué Solaris para hoteles</h2>
          <p className="mt-3 text-gray-600">Solaris centraliza la operación de tu hotel para que te enfoques en la experiencia del huésped, no en hojas de cálculo.</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Dashboard de operaciones</h4>
              <p className="text-sm text-gray-500 mt-2">Ocupación, ingresos y reportes en un solo panel.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Reservas directas</h4>
              <p className="text-sm text-gray-500 mt-2">Tus huéspedes reservan desde tu propio portal, sin comisiones.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Pagos y facturación</h4>
              <p className="text-sm text-gray-500 mt-2">Anticipos, cobros y reportes financieros automatizados.</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-r from-sky-700 to-blue-600 text-white rounded-xl shadow-lg">
              <h4 className="font-bold">Marketing automático</h4>
              <p className="mt-2 text-sm">Cotizaciones por correo, recordatorios y promociones segmentadas.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Soporte y onboarding</h4>
              <p className="text-sm text-gray-500 mt-2">Implementación guiada para tu equipo de recepción.</p>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-xl font-bold">Testimonios</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <blockquote className="p-4 bg-white rounded-lg shadow">"Duplicamos las reservas directas y bajamos las comisiones a cero." — Hotel Playa Dorada</blockquote>
              <blockquote className="p-4 bg-white rounded-lg shadow">"La gestión de habitaciones y huéspedes ahora es muchísimo más simple." — Hotel Verona</blockquote>
            </div>
          </div>

          <div className="mt-8">
            <a href="#contact" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md shadow-md">Comenzar con Solaris</a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HotelLanding;
