    import { useState } from "react";
    import Topbar from "../components/Topbar";

    interface InventarioItem {
    id: number;
    nombre: string;
    categoria: string;
    stock: number;
    stockMinimo: number;
    unidad: string;
    }

    export default function Inventario() {
    const [busqueda, setBusqueda] = useState("");
    const [mostrarModal, setMostrarModal] = useState(false);

    const [inventario, setInventario] = useState<InventarioItem[]>([
        { id: 1, nombre: "Harina", categoria: "Secos", stock: 10, stockMinimo: 2, unidad: "kg" },
        { id: 2, nombre: "Queso", categoria: "Lácteos", stock: 3, stockMinimo: 5, unidad: "kg" },
        { id: 3, nombre: "Tomate", categoria: "Verduras", stock: 1, stockMinimo: 4, unidad: "kg" },
    ]);

    const inventarioFiltrado = inventario.filter((i) =>
        i.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    const obtenerEstado = (item: InventarioItem) => {
        if (item.stock <= 0) return "critico";
        if (item.stock <= item.stockMinimo) return "bajo";
        return "ok";
    };

    return (
        <div className="min-h-screen bg-gray-100">
        <Topbar />

        <div className="p-6">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-3xl font-bold">Inventario</h2>
                <p className="text-gray-500">Control de ingredientes del restaurante</p>
            </div>

            <button
                onClick={() => setMostrarModal(true)}
                className="bg-amber-500 text-white px-5 py-3 rounded-lg"
            >
                ➕ Nuevo Item
            </button>
            </div>

            {/* BUSCADOR */}
            <input
            placeholder="Buscar ingrediente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full md:w-96 border p-3 rounded-lg mb-6"
            />

            {/* CARDS INVENTARIO */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            {inventarioFiltrado.map((item) => {
                const estado = obtenerEstado(item);

                return (
                <div key={item.id} className="bg-white rounded-xl shadow p-5">

                    <h3 className="text-xl font-bold">{item.nombre}</h3>
                    <p className="text-gray-500">{item.categoria}</p>

                    <div className="mt-3">
                    <p>Stock: {item.stock} {item.unidad}</p>
                    <p>Min: {item.stockMinimo} {item.unidad}</p>
                    </div>

                    <div className="mt-3">
                    {estado === "ok" && (
                        <span className="text-green-600 font-semibold">✔ OK</span>
                    )}

                    {estado === "bajo" && (
                        <span className="text-yellow-600 font-semibold">⚠ Bajo stock</span>
                    )}

                    {estado === "critico" && (
                        <span className="text-red-600 font-semibold">🚨 Crítico</span>
                    )}
                    </div>

                    <div className="flex gap-2 mt-4">
                    <button className="flex-1 bg-blue-500 text-white py-2 rounded-lg">
                        Editar
                    </button>

                    <button className="flex-1 bg-green-500 text-white py-2 rounded-lg">
                        + Stock
                    </button>
                    </div>

                </div>
                );
            })}

            </div>

            {/* MODAL */}
            {mostrarModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-white w-full max-w-md p-6 rounded-xl">

                <h2 className="text-2xl font-bold mb-4">Nuevo Ingrediente</h2>

                <input
                    placeholder="Nombre"
                    className="w-full border p-3 mb-3 rounded"
                />

                <input
                    placeholder="Categoría"
                    className="w-full border p-3 mb-3 rounded"
                />

                <input
                    placeholder="Stock inicial"
                    type="number"
                    className="w-full border p-3 mb-3 rounded"
                />

                <input
                    placeholder="Stock mínimo"
                    type="number"
                    className="w-full border p-3 mb-3 rounded"
                />

                <input
                    placeholder="Unidad (kg, litros...)"
                    className="w-full border p-3 mb-3 rounded"
                />

                <div className="flex justify-end gap-3 mt-5">
                    <button
                    onClick={() => setMostrarModal(false)}
                    className="px-4 py-2 bg-gray-300 rounded-lg"
                    >
                    Cancelar
                    </button>

                    <button className="px-4 py-2 bg-amber-500 text-white rounded-lg">
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