import { useState } from "react";
import Topbar from "../components/Topvar";
import { createClient } from '@supabase/supabase-js';


interface Producto {
  id_producto: number;
  nombre_producto: string;
  precio: number;
  cantidad: number;
  categoria: string;
  fecha_vencimiento: string;
}

export default function Productos() {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([
    {
      id_producto: 1,
      nombre_producto: "Pizza Peperoni",
      precio: 120,
      cantidad: 10,
      categoria: "Pizzas",
      fecha_vencimiento: "2026-12-31",
    },
  ]);

  const [nuevoProducto, setNuevoProducto] = useState<Producto>({
    id_producto: 0,
    nombre_producto: "",
    precio: 0,
    cantidad: 0,
    categoria: "",
    fecha_vencimiento: "",
  });

  const productosFiltrados = productos.filter((p) =>
    p.nombre_producto.toLowerCase().includes(busqueda.toLowerCase())
  );

  const guardarProducto = () => {
    if (!nuevoProducto.nombre_producto.trim()) return;

    const nuevo = {
      ...nuevoProducto,
      id_producto: Date.now(),
    };

    setProductos([...productos, nuevo]);

    setNuevoProducto({
      id_producto: 0,
      nombre_producto: "",
      precio: 0,
      cantidad: 0,
      categoria: "",
      fecha_vencimiento: "",
    });

    setMostrarModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Topbar />

      <div className="p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold">Productos</h2>
            <p className="text-gray-500">Gestión de productos</p>
          </div>

          <button
            onClick={() => setMostrarModal(true)}
            className="bg-amber-500 text-white px-5 py-3 rounded-lg"
          >
            ➕ Nuevo Producto
          </button>
        </div>

        {/* BUSCADOR */}
        <input
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full md:w-96 border p-3 rounded-lg mb-6"
        />

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {productosFiltrados.map((p) => (
            <div
              key={p.id_producto}
              className="bg-white rounded-xl shadow p-5"
            >
              <h3 className="text-xl font-bold">
                {p.nombre_producto}
              </h3>

              <p className="text-gray-500">L. {p.precio}</p>
              <p className="text-gray-500">Cantidad: {p.cantidad}</p>
              <p className="text-gray-500">Categoría: {p.categoria}</p>

              <p className="text-gray-400 text-sm">
                Vence: {p.fecha_vencimiento}
              </p>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 bg-blue-500 text-white py-2 rounded-lg">
                  Editar
                </button>

                <button className="flex-1 bg-red-500 text-white py-2 rounded-lg">
                  Eliminar
                </button>
              </div>
            </div>
          ))}

        </div>

        {/* MODAL */}
        {mostrarModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white w-full max-w-md p-6 rounded-xl">

              <h2 className="text-2xl font-bold mb-4">
                Nuevo Producto
              </h2>

              <input
                placeholder="Nombre"
                className="w-full border p-3 mb-3 rounded"
                value={nuevoProducto.nombre_producto}
                onChange={(e) =>
                  setNuevoProducto({
                    ...nuevoProducto,
                    nombre_producto: e.target.value,
                  })
                }
              />

              <input
                type="number"
                placeholder="Precio"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevoProducto({
                    ...nuevoProducto,
                    precio: Number(e.target.value),
                  })
                }
              />

              <input
                type="number"
                placeholder="Cantidad"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevoProducto({
                    ...nuevoProducto,
                    cantidad: Number(e.target.value),
                  })
                }
              />

              <input
                placeholder="Categoría"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevoProducto({
                    ...nuevoProducto,
                    categoria: e.target.value,
                  })
                }
              />

              <input
                type="date"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevoProducto({
                    ...nuevoProducto,
                    fecha_vencimiento: e.target.value,
                  })
                }
              />

              <div className="flex justify-end gap-3 mt-5">
                <button
                  onClick={() => setMostrarModal(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  onClick={guardarProducto}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg"
                >
                  Guardar
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}