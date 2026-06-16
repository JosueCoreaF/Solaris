import React from 'react';
import { motion } from 'framer-motion';
<<<<<<< HEAD

const GymLanding: React.FC = () => {
  const portalBase = `${window.location.protocol}//${window.location.hostname}:5177`;
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-gray-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-indigo-600">Solaris</div>
        <nav className="space-x-4 text-sm text-gray-700 flex items-center">
          <a href="#features" className="hover:underline">Características</a>
          <a href="#plans" className="hover:underline">Planes</a>
          <a href="#contact" className="hover:underline">Contacto</a>
          <a href={portalBase} className="ml-4 inline-block bg-white border border-gray-200 px-3 py-1 rounded-full text-sm text-gray-800 hover:bg-gray-50">Volver al Portal</a>
=======
import SolarisLogo from '../../components/SolarisLogo';

const GymLanding: React.FC = () => {
  const portalBase = import.meta.env.VITE_PORTAL_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5177`;
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white text-gray-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SolarisLogo variant="gym" size={88} />
          <div className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-indigo-600">Solaris</div>
        </div>
        <nav className="flex items-center gap-3 sm:gap-4 text-sm text-gray-700">
          <a href="#features" className="hover:underline hidden sm:inline">Características</a>
          <a href="#plans" className="hover:underline hidden sm:inline">Planes</a>
          <a href="#contact" className="hover:underline hidden sm:inline">Contacto</a>
          <a href={portalBase} className="inline-block bg-white border border-gray-200 px-3 py-1 rounded-full text-sm text-gray-800 hover:bg-gray-50 whitespace-nowrap">Volver al Portal</a>
>>>>>>> origin/main
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <section className="relative overflow-hidden py-16">
          <div className="absolute -left-24 -top-24 w-72 h-72 rounded-full bg-emerald-100 opacity-40 blur-3xl" />
          <div className="absolute right-0 top-10 w-96 h-96 rounded-full bg-indigo-100 opacity-40 blur-3xl" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto px-4">
            <div>
              <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-4xl md:text-5xl font-extrabold leading-tight">Solaris para gimnasios — gestión inteligente para cadenas y locales</motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-4 text-gray-700 text-lg">Centraliza reservas, control de acceso, pagos y métricas por sucursal. Reduce no-shows, automatiza recordatorios y aumenta el ticket medio.</motion.p>

              <div className="mt-6 flex flex-wrap gap-3">
                <motion.a whileHover={{ scale: 1.03 }} href="#plans" className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-700 to-indigo-600 text-white px-6 py-3 rounded-full shadow-lg">Ver planes <span className="text-sm opacity-80">→</span></motion.a>
                <motion.a whileHover={{ scale: 1.03 }} href="#contact" className="inline-flex items-center gap-2 border border-gray-200 px-5 py-3 rounded-full text-gray-700 bg-white">Solicitar demo</motion.a>
              </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div whileHover={{ y: -6 }} className="p-5 bg-white rounded-2xl shadow">
                  <h4 className="font-semibold">Aumenta reservas</h4>
                  <p className="text-sm text-gray-500 mt-1">Campañas automáticas y reservas optimizadas.</p>
                </motion.div>
                <motion.div whileHover={{ y: -6 }} className="p-5 bg-white rounded-2xl shadow">
                  <h4 className="font-semibold">Gestiona entrenadores</h4>
                  <p className="text-sm text-gray-500 mt-1">Programación, comisiones y perfiles de trainers.</p>
                </motion.div>
              </div>
            </div>

            <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }} className="flex items-center justify-center">
              <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white">
                <div className="relative">
                  <img src="https://www.thegymff.cz/wp-content/uploads/2025/08/BRN_6201-HDR-Edit-1920x1280.jpg" alt="Gimnasio Argentinska" className="w-full h-64 object-cover" />
                  <div className="absolute left-4 bottom-4 bg-white/80 backdrop-blur rounded-full px-4 py-2 text-sm font-semibold">GYM • Abierto</div>
                </div>
                <div className="p-5">
                  <h3 className="font-black text-lg">Club gym</h3>
                  <p className="text-sm text-gray-600 mt-2">Espacio moderno con zona funcional, cardio y pesas. Ideal para programas y clases grupales.</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Desde</p>
                      <p className="text-xl font-extrabold">$9/mes</p>
                    </div>
                    <a href="#contact" className="bg-emerald-600 text-white px-4 py-2 rounded-full">Contactar</a>
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
              <p className="text-sm text-gray-500">Métricas y reportes en tiempo real.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Reservas</h4>
              <p className="text-sm text-gray-500">Gestión de turnos y clases.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Pagos</h4>
              <p className="text-sm text-gray-500">Integraciones seguras y facturación.</p>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Marketing</h4>
              <p className="text-sm text-gray-500">Promociones y email automáticos.</p>
            </motion.div>
          </div>
        </section>

        <section id="details" className="py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-white rounded-xl shadow-md">
              <h4 className="font-bold text-lg">Horario</h4>
              <p className="mt-2 text-sm text-gray-600">Lun – Vie: 6:30 – 22:00<br/>Sáb – Dom: 8:00 – 21:00</p>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-white rounded-xl shadow-md">
              <h4 className="font-bold text-lg">Dirección</h4>
              <p className="mt-2 text-sm text-gray-600">Argentinská 1610/4, 170 00 Prague 7</p>
              <a className="mt-3 inline-block text-sm text-emerald-600 font-semibold" href="https://maps.app.goo.gl/1BQ24FHG81cmvHZs8" target="_blank" rel="noopener">Ver en el mapa</a>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="p-6 bg-white rounded-xl shadow-md">
              <h4 className="font-bold text-lg">Contacto</h4>
              <p className="mt-2 text-sm text-gray-600">argentinska@thegymff.cz<br/>+420 778 743 922</p>
              <div className="mt-4 flex gap-3">
                <a href="https://www.facebook.com/thegymff/" target="_blank" rel="noopener" className="text-sm text-stone-600 hover:text-stone-900">Facebook</a>
                <a href="https://www.instagram.com/thegymff/" target="_blank" rel="noopener" className="text-sm text-stone-600 hover:text-stone-900">Instagram</a>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="trainers" className="py-12">
          <h2 className="text-2xl font-bold">Entrenadores destacados</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Daniel Müller</h4>
              <p className="text-sm text-gray-500">Entrenador personal — fuerza y movilidad.</p>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Gabriela Pařízková</h4>
              <p className="text-sm text-gray-500">Entrenadora — clases funcionales.</p>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Miroslav Vaněk</h4>
              <p className="text-sm text-gray-500">Entrenador — rendimiento y técnica.</p>
            </motion.div>
          </div>
        </section>

        <section id="plans" className="py-12">
          <h2 className="text-2xl font-bold">Planes</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Básico</h3>
              <p className="mt-2 text-3xl font-extrabold text-emerald-600">$9<span className="text-base font-medium">/mes</span></p>
              <p className="mt-2 text-sm text-gray-500">Perfecto para comenzar.</p>
              <button className="mt-4 w-full bg-emerald-600 text-white py-2 rounded">Elegir</button>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border shadow-md">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-2 text-3xl font-extrabold text-indigo-600">$29<span className="text-base font-medium">/mes</span></p>
              <p className="mt-2 text-sm text-gray-500">Más funcionalidades y soporte.</p>
              <button className="mt-4 w-full bg-indigo-600 text-white py-2 rounded">Elegir</button>
            </motion.div>
            <motion.div whileHover={{ translateY: -6 }} className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <p className="mt-2 text-3xl font-extrabold text-gray-900">Contact</p>
              <p className="mt-2 text-sm text-gray-500">Soluciones a medida.</p>
              <button className="mt-4 w-full bg-gray-900 text-white py-2 rounded">Contactar</button>
            </motion.div>
          </div>
        </section>

        <section id="contact" className="py-12">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-bold">¿Listo para empezar?</h3>
            <p className="text-sm text-gray-500 mt-2">Escríbenos y te ayudamos a lanzar tu landing.</p>
            <div className="mt-4">
              <a href="mailto:contact@solaris.example" className="inline-block bg-emerald-600 text-white px-5 py-2 rounded">Contactar</a>
            </div>
          </div>
        </section>

        <section id="benefits" className="py-12">
          <h2 className="text-2xl font-bold">Por qué Solaris para gimnasios</h2>
          <p className="mt-3 text-gray-600">Solaris centraliza la gestión del local para que puedas dedicarte a entrenar clientes, no a papeleo.</p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Dashboard de operaciones</h4>
              <p className="text-sm text-gray-500 mt-2">Métricas de asistencia, ventas y retención en un solo panel.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Reservas y clases</h4>
              <p className="text-sm text-gray-500 mt-2">Gestión de turnos y plazas con confirmaciones y waitlist automatizados.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Pagos y facturación</h4>
              <p className="text-sm text-gray-500 mt-2">Integración con pasarelas y facturación automática por suscripción.</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-r from-emerald-700 to-indigo-600 text-white rounded-xl shadow-lg">
              <h4 className="font-bold">Marketing automático</h4>
              <p className="mt-2 text-sm">Campañas por inactividad, recordatorios y upsells directamente desde la plataforma.</p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h4 className="font-semibold">Soporte y onboarding</h4>
              <p className="text-sm text-gray-500 mt-2">Implementación guiada y soporte para entrenadores y administradores.</p>
            </div>
          </div>

          <div className="mt-10">
            <h3 className="text-xl font-bold">Testimonios</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <blockquote className="p-4 bg-white rounded-lg shadow">“Solaris nos permitió crecer 30% en reservas y automatizar cobros mensuales.” — Club Argentinska</blockquote>
              <blockquote className="p-4 bg-white rounded-lg shadow">“La gestión de clases y trainers ahora es muchísimo más simple.” — Gym Central</blockquote>
            </div>
          </div>

          <div className="mt-8">
            <a href="#contact" className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md shadow-md">Comenzar con Solaris</a>
          </div>
        </section>
      </main>
    </div>
  );
};

export default GymLanding;
