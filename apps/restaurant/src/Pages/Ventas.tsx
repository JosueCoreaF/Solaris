import { useState } from "react";
import Topbar from "../components/Topvar";

interface Venta {
  id: number;
  total: number;
  metodo_pago: string;
  estado: string;
  comprobante: string;
  observaciones: string;
  fecha_venta: string;
}

export default function Ventas() {
  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  const [ventas, setVentas] = useState<Venta[]>([
    {
      id: 1,
      total: 250,
      metodo_pago: "Efectivo",
      estado: "Pagado",
      comprobante: "Factura #001",
      observaciones: "Sin observaciones",
      fecha_venta: "2026-06-12",
    },
  ]);

  const [nuevaVenta, setNuevaVenta] = useState<Venta>({
    id: 0,
    total: 0,
    metodo_pago: "",
    estado: "",
    comprobante: "",
    observaciones: "",
    fecha_venta: "",
  });

  const ventasFiltradas = ventas.filter((v) =>
    v.metodo_pago.toLowerCase().includes(busqueda.toLowerCase())
  );

  const guardarVenta = () => {
    if (!nuevaVenta.metodo_pago.trim()) return;

    const nueva = {
      ...nuevaVenta,
      id: Date.now(),
    };

    setVentas([...ventas, nueva]);

    setNuevaVenta({
      id: 0,
      total: 0,
      metodo_pago: "",
      estado: "",
      comprobante: "",
      observaciones: "",
      fecha_venta: "",
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
            <h2 className="text-3xl font-bold">Gestión de Ventas</h2>
            <p className="text-gray-500">Registro de ventas del restaurante</p>
          </div>

          <button
            onClick={() => setMostrarModal(true)}
            className="bg-amber-500 text-white px-5 py-3 rounded-lg"
          >
           
          </button>
        </div>

        {/* BUSCADOR */}
        <input
          placeholder="Buscar por método de pago..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full md:w-96 border p-3 rounded-lg mb-6"
        />

        {/* CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {ventasFiltradas.map((v) => (
            <div key={v.id} className="bg-white rounded-xl shadow p-5">

              <h3 className="text-xl font-bold">
                L. {v.total}
              </h3>

              <p className="text-gray-500">
                💳 {v.metodo_pago}
              </p>

              <p className="text-gray-500">
                📌 {v.estado}
              </p>

              <p className="text-gray-500">
                🧾 {v.comprobante}
              </p>

              <p className="text-sm text-gray-600 mt-2">
                {v.observaciones}
              </p>

              <p className="text-sm text-gray-400 mt-2">
                📅 {v.fecha_venta}
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

            <div className="bg-white w-full max-w-lg p-6 rounded-xl">

              <h2 className="text-2xl font-bold mb-4">
                Nueva Venta
              </h2>

              <input
                type="number"
                placeholder="Total"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevaVenta({
                    ...nuevaVenta,
                    total: Number(e.target.value),
                  })
                }
              />

              <input
                placeholder="Método de pago"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevaVenta({
                    ...nuevaVenta,
                    metodo_pago: e.target.value,
                  })
                }
              />

              <input
                placeholder="Estado"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevaVenta({
                    ...nuevaVenta,
                    estado: e.target.value,
                  })
                }
              />

              <input
                placeholder="Comprobante"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevaVenta({
                    ...nuevaVenta,
                    comprobante: e.target.value,
                  })
                }
              />

              <input
                placeholder="Observaciones"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevaVenta({
                    ...nuevaVenta,
                    observaciones: e.target.value,
                  })
                }
              />

              <input
                type="date"
                className="w-full border p-3 mb-3 rounded"
                onChange={(e) =>
                  setNuevaVenta({
                    ...nuevaVenta,
                    fecha_venta: e.target.value,
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
                  onClick={guardarVenta}
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