import React from 'react';

const GymLanding: React.FC = () => {
  const portalBase = `${window.location.protocol}//${window.location.hostname}:5177`;
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="text-2xl font-extrabold">Solaris</div>
        <nav className="space-x-6 text-sm text-gray-700 flex items-center">
          <a href="#features" className="hover:underline">Características</a>
          <a href="#plans" className="hover:underline">Planes</a>
          <a href="#contact" className="hover:underline">Contacto</a>
          <a href={portalBase} className="ml-4 inline-block bg-white border border-gray-200 px-3 py-1 rounded-full text-sm text-gray-800 hover:bg-gray-50">Volver al Portal</a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Tu gimnasio, moderno y minimalista</h1>
            <p className="mt-4 text-gray-600">Diseña experiencias únicas para tus clientes con un landing atractivo y conversiones reales.</p>
            <div className="mt-6 flex gap-4">
              <a href="#plans" className="inline-block bg-black text-white px-6 py-3 rounded-md shadow hover:opacity-95">Ver planes</a>
              <a href="#contact" className="inline-block border border-gray-200 px-6 py-3 rounded-md text-gray-700 hover:bg-gray-100">Contáctanos</a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <h3 className="font-semibold">Clases en vivo</h3>
                <p className="text-sm text-gray-500">Entrenadores certificados en tiempo real.</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <h3 className="font-semibold">Reservas sencillas</h3>
                <p className="text-sm text-gray-500">Agenda desde el móvil en segundos.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full h-72 bg-gradient-to-tr from-gray-100 to-white rounded-xl shadow-lg overflow-hidden flex items-end">
              <img
                src="https://images.unsplash.com/photo-1554284126-aa88f22d8d2d?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder"
                alt="Gimnasio moderno"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        <section id="features" className="py-12">
          <h2 className="text-2xl font-bold">Características clave</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Dashboard</h4>
              <p className="text-sm text-gray-500">Métricas y reportes en tiempo real.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Reservas</h4>
              <p className="text-sm text-gray-500">Gestión de turnos y clases.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Pagos</h4>
              <p className="text-sm text-gray-500">Integraciones seguras y facturación.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Marketing</h4>
              <p className="text-sm text-gray-500">Promociones y email automáticos.</p>
            </div>
          </div>
        </section>

        <section id="plans" className="py-12">
          <h2 className="text-2xl font-bold">Planes</h2>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Básico</h3>
              <p className="mt-2 text-3xl font-extrabold">$19</p>
              <p className="mt-2 text-sm text-gray-500">Perfecto para gimnasios pequeños.</p>
              <button className="mt-4 w-full bg-black text-white py-2 rounded">Elegir</button>
            </div>
            <div className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Pro</h3>
              <p className="mt-2 text-3xl font-extrabold">$49</p>
              <p className="mt-2 text-sm text-gray-500">Más funcionalidades y soporte.</p>
              <button className="mt-4 w-full bg-black text-white py-2 rounded">Elegir</button>
            </div>
            <div className="p-6 bg-white rounded-xl border">
              <h3 className="text-lg font-semibold">Enterprise</h3>
              <p className="mt-2 text-3xl font-extrabold">Contact</p>
              <p className="mt-2 text-sm text-gray-500">Soluciones a medida.</p>
              <button className="mt-4 w-full bg-black text-white py-2 rounded">Contactar</button>
            </div>
          </div>
        </section>

        <section id="contact" className="py-12">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-bold">¿Listo para empezar?</h3>
            <p className="text-sm text-gray-500 mt-2">Escríbenos y te ayudamos a lanzar tu landing.</p>
            <div className="mt-4">
              <a href="mailto:contact@solaris.example" className="inline-block bg-black text-white px-5 py-2 rounded">Contactar</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default GymLanding;
