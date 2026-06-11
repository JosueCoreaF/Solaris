    import { useState } from "react";
    import Topbar from "../components/Topbar";

    interface CategoriaIngrediente {
    id_categoria: number;
    categoria: string;
    }

    interface InventarioItem {
    id_ingrediente: number;
    nombre_ingrediente: string;
    id_categoria: number;
    unidad_medida: string;
    stock_actual: number;
    stock_minimo: number;
    costo_unitario: number;
    fecha_vencimiento: string;
    activo: boolean;
    }

    export default function Inventario() {
    const [busqueda, setBusqueda] = useState("");
    const [mostrarModal, setMostrarModal] = useState(false);

    const [categorias] = useState<CategoriaIngrediente[]>([
    { id_categoria: 1, categoria: "Lácteos" },
    { id_categoria: 2, categoria: "Verduras" },
    { id_categoria: 3, categoria: "Carnes" },
    { id_categoria: 4, categoria: "Secos" },
    { id_categoria: 5, categoria: "Bebidas" },
    ]);

    const [inventario, setInventario] = useState<InventarioItem[]>([
    {
    id_ingrediente: 1,
    nombre_ingrediente: "Harina",
    id_categoria: 4,
    unidad_medida: "kg",
    stock_actual: 15,
    stock_minimo: 5,
    costo_unitario: 20,
    fecha_vencimiento: "2026-12-31",
    activo: true,
    },
    {
    id_ingrediente: 2,
    nombre_ingrediente: "Queso",
    id_categoria: 1,
    unidad_medida: "kg",
    stock_actual: 3,
    stock_minimo: 5,
    costo_unitario: 180,
    fecha_vencimiento: "2026-08-15",
    activo: true,
    },
    {
    id_ingrediente: 3,
    nombre_ingrediente: "Tomate",
    id_categoria: 2,
    unidad_medida: "kg",
    stock_actual: 1,
    stock_minimo: 4,
    costo_unitario: 35,
    fecha_vencimiento: "2026-07-20",
    activo: true,
    },
    ]);

    const [nuevoIngrediente, setNuevoIngrediente] =
    useState<InventarioItem>({
    id_ingrediente: 0,
    nombre_ingrediente: "",
    id_categoria: 1,
    unidad_medida: "",
    stock_actual: 0,
    stock_minimo: 0,
    costo_unitario: 0,
    fecha_vencimiento: "",
    activo: true,
    });

    const obtenerCategoria = (id: number) => {
    return (
    categorias.find((c) => c.id_categoria === id)?.categoria ||
    "Sin categoría"
    );
    };

    const inventarioFiltrado = inventario.filter((item) =>
    item.nombre_ingrediente
    .toLowerCase()
    .includes(busqueda.toLowerCase())
    );

    const obtenerEstado = (item: InventarioItem) => {
    if (item.stock_actual <= 0) return "critico";
    if (item.stock_actual <= item.stock_minimo) return "bajo";
    return "ok";
    };

    const guardarIngrediente = () => {
    if (!nuevoIngrediente.nombre_ingrediente.trim()) return;

    
    const nuevo = {
    ...nuevoIngrediente,
    id_ingrediente: Date.now(),
    };

    setInventario([...inventario, nuevo]);

    setNuevoIngrediente({
    id_ingrediente: 0,
    nombre_ingrediente: "",
    id_categoria: 1,
    unidad_medida: "",
    stock_actual: 0,
    stock_minimo: 0,
    costo_unitario: 0,
    fecha_vencimiento: "",
    activo: true,
    });

    setMostrarModal(false);
    

    };

    const agregarStock = (id: number) => {
    setInventario(
    inventario.map((item) =>
    item.id_ingrediente === id
    ? {
    ...item,
    stock_actual: item.stock_actual + 1,
    }
    : item
    )
    );
    };

return (
  <div className="min-h-screen bg-gray-100">
    <Topbar />

    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold">Inventario</h2>
          <p className="text-gray-500">
            Gestión de ingredientes
          </p>
        </div>

        <button
          onClick={() => setMostrarModal(true)}
          className="bg-amber-500 text-white px-5 py-3 rounded-lg"
        >
          ➕ Nuevo Ingrediente
        </button>
      </div>

      <input
        placeholder="Buscar ingrediente..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="w-full md:w-96 border p-3 rounded-lg mb-6"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventarioFiltrado.map((item) => {
          const estado = obtenerEstado(item);

          return (
            <div
              key={item.id_ingrediente}
              className="bg-white rounded-xl shadow p-5"
            >
              <h3 className="text-xl font-bold">
                {item.nombre_ingrediente}
              </h3>

              <p className="text-gray-500">
                {obtenerCategoria(item.id_categoria)}
              </p>

              <div className="mt-3 space-y-1">
                <p>
                  Stock: {item.stock_actual}{" "}
                  {item.unidad_medida}
                </p>

                <p>
                  Mínimo: {item.stock_minimo}{" "}
                  {item.unidad_medida}
                </p>

                <p>
                  Costo: L. {item.costo_unitario}
                </p>
              </div>

              <div className="mt-3">
                {estado === "ok" && (
                  <span className="text-green-600 font-semibold">
                    ✔ OK
                  </span>
                )}

                {estado === "bajo" && (
                  <span className="text-yellow-600 font-semibold">
                    ⚠ Bajo Stock
                  </span>
                )}

                {estado === "critico" && (
                  <span className="text-red-600 font-semibold">
                    🚨 Crítico
                  </span>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 bg-blue-500 text-white py-2 rounded-lg">
                  Editar
                </button>

                <button
                  onClick={() =>
                    agregarStock(item.id_ingrediente)
                  }
                  className="flex-1 bg-green-500 text-white py-2 rounded-lg"
                >
                  + Stock
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md p-6 rounded-xl">
            <h2 className="text-2xl font-bold mb-4">
              Nuevo Ingrediente
            </h2>

            <input
              placeholder="Nombre"
              className="w-full border p-3 mb-3 rounded"
              value={nuevoIngrediente.nombre_ingrediente}
              onChange={(e) =>
                setNuevoIngrediente({
                  ...nuevoIngrediente,
                  nombre_ingrediente: e.target.value,
                })
              }
            />

            <select
              className="w-full border p-3 mb-3 rounded"
              value={nuevoIngrediente.id_categoria}
              onChange={(e) =>
                setNuevoIngrediente({
                  ...nuevoIngrediente,
                  id_categoria: Number(e.target.value),
                })
              }
            >
              {categorias.map((cat) => (
                <option
                  key={cat.id_categoria}
                  value={cat.id_categoria}
                >
                  {cat.categoria}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="Stock Inicial"
              className="w-full border p-3 mb-3 rounded"
              onChange={(e) =>
                setNuevoIngrediente({
                  ...nuevoIngrediente,
                  stock_actual: Number(e.target.value),
                })
              }
            />

            <input
              type="number"
              placeholder="Stock Mínimo"
              className="w-full border p-3 mb-3 rounded"
              onChange={(e) =>
                setNuevoIngrediente({
                  ...nuevoIngrediente,
                  stock_minimo: Number(e.target.value),
                })
              }
            />

            <input
              placeholder="Unidad (kg, lt, unidad)"
              className="w-full border p-3 mb-3 rounded"
              onChange={(e) =>
                setNuevoIngrediente({
                  ...nuevoIngrediente,
                  unidad_medida: e.target.value,
                })
              }
            />

            <input
              type="number"
              placeholder="Costo Unitario"
              className="w-full border p-3 mb-3 rounded"
              onChange={(e) =>
                setNuevoIngrediente({
                  ...nuevoIngrediente,
                  costo_unitario: Number(e.target.value),
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
                onClick={guardarIngrediente}
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