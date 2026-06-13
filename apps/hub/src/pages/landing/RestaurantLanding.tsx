import React from 'react';

const RestaurantLanding: React.FC = () => {
  const portalBase = `${window.location.protocol}//${window.location.hostname}:5177`;
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="max-w-6xl mx-auto p-6 flex items-center justify-between">
        <div className="text-2xl font-extrabold">Solaris</div>
        <nav className="space-x-6 text-sm text-gray-700 flex items-center">
          <a href="#features" className="hover:underline">Características</a>
          <a href="#menu" className="hover:underline">Menú</a>
          <a href="#contact" className="hover:underline">Contacto</a>
          <a href={portalBase} className="ml-4 inline-block bg-white border border-gray-200 px-3 py-1 rounded-full text-sm text-gray-800 hover:bg-gray-50">Volver al Portal</a>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Restaurante moderno y minimalista</h1>
            <p className="mt-4 text-gray-600">Atrae comensales con un menú claro y reservas sencillas.</p>
            <div className="mt-6 flex gap-4">
              <a href="#menu" className="inline-block bg-black text-white px-6 py-3 rounded-md shadow hover:opacity-95">Ver menú</a>
              <a href="#contact" className="inline-block border border-gray-200 px-6 py-3 rounded-md text-gray-700 hover:bg-gray-100">Reservar</a>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <h3 className="font-semibold">Menú del día</h3>
                <p className="text-sm text-gray-500">Platos frescos y locales.</p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <h3 className="font-semibold">Reservas fáciles</h3>
                <p className="text-sm text-gray-500">Confirma tu mesa en segundos.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full h-72 bg-gradient-to-tr from-gray-100 to-white rounded-xl shadow-lg overflow-hidden flex items-end">
              <img
                src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?q=80&w=1200&auto=format&fit=crop&ixlib=rb-4.0.3&s=placeholder"
                alt="Restaurante moderno"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        <section id="menu" className="py-12">
          <h2 className="text-2xl font-bold">Platos destacados</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Entrada: Ensalada fresca</h4>
              <p className="text-sm text-gray-500">Ingredientes de temporada.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Plato: Filete a la plancha</h4>
              <p className="text-sm text-gray-500">Acompañado de verduras asadas.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <h4 className="font-semibold">Postre: Tarta del día</h4>
              <p className="text-sm text-gray-500">Dulce casero para terminar.</p>
            </div>
          </div>
        </section>

        <section id="contact" className="py-12">
          <div className="p-6 bg-white rounded-lg shadow-sm">
            <h3 className="font-bold">Reserva tu mesa</h3>
            <p className="text-sm text-gray-500 mt-2">Llama o reserva en línea para asegurar tu sitio.</p>
            <div className="mt-4">
              <a href="mailto:contact@solaris.example" className="inline-block bg-black text-white px-5 py-2 rounded">Contactar</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default RestaurantLanding;
