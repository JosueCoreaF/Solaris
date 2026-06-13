import React from 'react';
import { motion } from 'framer-motion';

const RestaurantLanding: React.FC = () => {
  const portalBase = `${window.location.protocol}//${window.location.hostname}:5177`;
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white text-gray-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-rose-500">Solaris</div>
        <nav className="space-x-4 text-sm text-gray-700 flex items-center">
          <a href="#features" className="hover:underline">Características</a>
          <a href="#menu" className="hover:underline">Menú</a>
          <a href="#contact" className="hover:underline">Contacto</a>
          <a href={portalBase} className="ml-4 inline-block bg-white border border-gray-200 px-3 py-1 rounded-full text-sm text-gray-800 hover:bg-gray-50">Volver al Portal</a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <section className="relative overflow-hidden py-16">
          <div className="absolute -left-24 top-10 w-72 h-72 rounded-full bg-amber-100 opacity-40 blur-3xl" />
          <div className="absolute right-0 -top-8 w-96 h-96 rounded-full bg-rose-100 opacity-40 blur-3xl" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto px-4">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-4xl md:text-5xl font-extrabold leading-tight">Solaris para restaurantes — llena mesas y aumenta el ticket medio</motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-4 text-gray-700 text-lg">Gestiona reservas, controla mesas y lanza promociones segmentadas que convierten clientes en habituales.</motion.p>

              <div className="mt-6 flex flex-wrap gap-3">
                <motion.a whileHover={{ scale: 1.03 }} href="#menu" className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-full shadow-lg">Ver menú <span className="text-sm opacity-80">→</span></motion.a>
                <motion.a whileHover={{ scale: 1.03 }} href="#contact" className="inline-flex items-center gap-2 border border-gray-200 px-5 py-3 rounded-full text-gray-700 bg-white">Solicitar demo</motion.a>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div whileHover={{ y: -6 }} className="p-5 bg-white rounded-2xl shadow">
                  <h4 className="font-semibold">Optimiza mesas</h4>
                  <p className="text-sm text-gray-500 mt-1">Menos esperas y mayor rotación con gestión inteligente.</p>
                </motion.div>
                <motion.div whileHover={{ y: -6 }} className="p-5 bg-white rounded-2xl shadow">
                  <h4 className="font-semibold">Promociones que funcionan</h4>
                  <p className="text-sm text-gray-500 mt-1">Campañas segmentadas para horarios de baja ocupación.</p>
                </motion.div>
              </div>
            </div>

            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="flex items-center justify-center">
              <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white">
                <div className="relative">
                  <img src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder" alt="Restaurante moderno" className="w-full h-64 object-cover" />
                  <div className="absolute left-4 bottom-4 bg-white/90 backdrop-blur rounded-full px-4 py-2 text-sm font-semibold">Menú destacado</div>
                </div>
                <div className="p-5">
                  <h3 className="font-black text-lg">Bistró Central</h3>
                  <p className="text-sm text-gray-600 mt-2">Aumenta la conversión con reservas directas y menús optimizados para margen.</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Promoción</p>
                      <p className="text-xl font-extrabold">Happy Hour • 20% off</p>
                    </div>
                    <a href="#contact" className="bg-rose-500 text-white px-4 py-2 rounded-full">Solicitar demo</a>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="menu" className="py-12">
          <h2 className="text-2xl font-bold">Platos destacados</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Entrada: Ensalada fresca</h4>
              <p className="text-sm text-gray-500">Ingredientes de temporada.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Plato: Filete a la plancha</h4>
              <p className="text-sm text-gray-500">Acompañado de verduras asadas.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Postre: Tarta del día</h4>
              <p className="text-sm text-gray-500">Dulce casero para terminar.</p>
            </motion.div>
          </div>
        </section>

        <section id="plans" className="py-12">
          <h2 className="text-2xl font-bold">Tarifas & Reservas</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Mesa Standard</h3>
              <p className="mt-2 text-3xl font-extrabold text-amber-600">$0<span className="text-base font-medium"> reserva</span></p>
              <p className="mt-2 text-sm text-gray-500">Reserva sin coste, cancelación flexible.</p>
              <button className="mt-4 w-full bg-amber-600 text-white py-2 rounded">Reservar</button>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border shadow-md">
              <h3 className="text-lg font-semibold">Mesa Premium</h3>
              <p className="mt-2 text-3xl font-extrabold text-rose-500">$15<span className="text-base font-medium"> cena</span></p>
              <p className="mt-2 text-sm text-gray-500">Mesa preferente y bienvenida.</p>
              <button className="mt-4 w-full bg-rose-500 text-white py-2 rounded">Reservar</button>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Privado</h3>
              <p className="mt-2 text-3xl font-extrabold text-gray-900">Contact</p>
              <p className="mt-2 text-sm text-gray-500">Eventos y grupos grandes.</p>
              <button className="mt-4 w-full bg-gray-900 text-white py-2 rounded">Contactar</button>
            </motion.div>
          </div>
        </section>

        <section id="contact" className="py-12">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-bold">Reserva tu mesa</h3>
            <p className="text-sm text-gray-500 mt-2">Llama o reserva en línea para asegurar tu sitio.</p>
            <div className="mt-4">
              <a href="mailto:contact@solaris.example" className="inline-block bg-amber-600 text-white px-5 py-2 rounded">Contactar</a>
            </div>
          </div>
        </section>

        <section id="benefits" className="py-12">
          <h2 className="text-2xl font-bold">Por qué Solaris para restaurantes</h2>
          <p className="mt-3 text-gray-600">Solaris ayuda a los restaurantes a aumentar ocupación, gestionar mesas y monetizar mejor cada servicio.</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Reservas y mesas</h4>
              <p className="text-sm text-gray-500 mt-2">Asignación inteligente de mesas, listas de espera y horarios optimizados.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Menús dinámicos</h4>
              <p className="text-sm text-gray-500 mt-2">Control de cartas, menús por temporada y upsell por plato.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Pagos y delivery</h4>
              <p className="text-sm text-gray-500 mt-2">Integraciones con POS y opciones de pago en mesa o para delivery.</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-r from-amber-600 to-rose-500 text-white rounded-xl shadow-lg">
              <h4 className="font-bold">Analítica de mesas</h4>
              <p className="mt-2 text-sm">Optimiza ocupación y descubre tus franjas más rentables con métricas claras.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Marketing local</h4>
              <p className="text-sm text-gray-500 mt-2">Promociones automáticas y re-engagement para clientes frecuentes.</p>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-xl font-bold">Historias de éxito</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <blockquote className="p-4 bg-white rounded-lg shadow">“Duplicamos reservas de fin de semana tras automatizar promociones.” — Restaurante La Ola</blockquote>
              <blockquote className="p-4 bg-white rounded-lg shadow">“El control de mesas redujo esperas y mejoró reseñas.” — Bistró Central</blockquote>
            </div>
          </div>

          <div className="mt-8">
            <a href="#contact" className="inline-block bg-rose-500 text-white px-6 py-3 rounded-md shadow-md">Solicitar demo</a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default RestaurantLanding;
