    import { useState } from "react";
    import Topbar from "../components/Topbar";

    interface RecetaItem {
    ingredienteId: number;
    ingredienteNombre: string;
    cantidad: number;
    unidad: string;
    }

    interface Producto {
    id: number;
    nombre: string;
    precio: number;
    categoria: string;
    receta: RecetaItem[];
    }

    const ingredientesDisponibles = [
    { id: 1, nombre: "Harina", unidad: "kg" },
    { id: 2, nombre: "Queso", unidad: "kg" },
    { id: 3, nombre: "Tomate", unidad: "kg" },
    { id: 4, nombre: "Pollo", unidad: "kg" },
    ];

    export default function Productos() {
    const [busqueda, setBusqueda] = useState("");
    const [mostrarModal, setMostrarModal] = useState(false);

    const [productos, setProductos] = useState<Producto[]>([
        {
        id: 1,
        nombre: "Pizza Peperoni",
        precio: 120,
        categoria: "Pizzas",
        receta: [
            { ingredienteId: 1, ingredienteNombre: "Harina", cantidad: 0.3, unidad: "kg" },
            { ingredienteId: 2, ingredienteNombre: "Queso", cantidad: 0.2, unidad: "kg" },
        ],
        },
    ]);

    const productosFiltrados = productos.filter((p) =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gray-100">
        <Topbar />

        <div className="p-6">

            {/* HEADER */}
            <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-3xl font-bold">Gestión de Productos</h2>
                <p className="text-gray-500">Productos con receta e inventario</p>
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
                <div key={p.id} className="bg-white rounded-xl shadow p-5">

                <h3 className="text-xl font-bold">{p.nombre}</h3>
                <p className="text-gray-500">L. {p.precio}</p>

                <p className="mt-3 font-semibold">🍽️ Receta</p>

                <div className="mt-2 space-y-1">
                    {p.receta.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm text-gray-600">
                        <span>{r.ingredienteNombre}</span>
                        <span>{r.cantidad} {r.unidad}</span>
                    </div>
                    ))}
                </div>

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

                <h2 className="text-2xl font-bold mb-4">Nuevo Producto</h2>

                <input
                    placeholder="Nombre"
                    className="w-full border p-3 mb-3 rounded"
                />

                <input
                    placeholder="Precio"
                    type="number"
                    className="w-full border p-3 mb-3 rounded"
                />

                <p className="font-semibold mb-2">🍽️ Receta</p>

                <div className="space-y-2">
                    {ingredientesDisponibles.map((ing) => (
                    <div key={ing.id} className="flex gap-2 items-center">

                        <span className="w-32 text-sm">{ing.nombre}</span>

                        <input
                        type="number"
                        placeholder="Cantidad"
                        className="border p-2 w-24 rounded"
                        />

                        <span className="text-sm">{ing.unidad}</span>
                    </div>
                    ))}
                </div>

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