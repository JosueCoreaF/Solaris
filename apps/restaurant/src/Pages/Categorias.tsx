    import { useState } from "react";
    import Topbar from "../components/Topvar";

    interface Categoria {
    id: number;
    nombre: string;
    descripcion: string;
    icono: string;
    color: string;
    productos: number;
    }

    export default function Categoria() {
    const [busqueda, setBusqueda] = useState("");
    const [mostrarModal, setMostrarModal]=useState(false);
    const [nuevaCategoria, setNuevaCategoria] = useState({
        nombre: "",
        descripcion: "",
        icono: "🍽️",
        color: "bg-amber-100",
        });

    const [categorias, setCategoria] = useState<Categoria[]>([
        {
        id: 1,
        nombre: "Pizzas",
        descripcion: "Pizzas artesanales y especiales",
        icono: "🍕",
        color: "bg-red-100",
        productos: 12,
        },
        {
        id: 2,
        nombre: "Bebidas",
        descripcion: "Refrescos y bebidas naturales",
        icono: "🥤",
        color: "bg-blue-100",
        productos: 8,
        },
        {
        id: 3,
        nombre: "Postres",
        descripcion: "Dulces y postres caseros",
        icono: "🍰",
        color: "bg-pink-100",
        productos: 5,
        },
        {
        id: 4,
        nombre: "Hamburguesas",
        descripcion: "Hamburguesas gourmet",
        icono: "🍔",
        color: "bg-yellow-100",
        productos: 10,
        },
    ]);

    const categoriasFiltradas = categorias.filter((categoria) =>
        categoria.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    const totalProductos = categorias.reduce(
        (acc, cat) => acc + cat.productos,
        0
    );
    const agregarCategoria = () => {
  if (!nuevaCategoria.nombre.trim()) {
    alert("Ingrese un nombre");
    return;
  }

  const categoriaNueva: Categoria = {
    id: Date.now(),
    nombre: nuevaCategoria.nombre,
    descripcion: nuevaCategoria.descripcion,
    icono: nuevaCategoria.icono,
    color: nuevaCategoria.color,
    productos: 0,
     };

    setCategoria([...categorias, categoriaNueva]);

    setNuevaCategoria({
        nombre: "",
        descripcion: "",
        icono: "🍽️",
        color: "bg-amber-100",
    });

    setMostrarModal(false);
    };
    return (
        <div className="min-h-screen bg-gray-100">
        <Topbar />

        <div className="p-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-3xl font-bold text-gray-800">
                Gestión de Categorías
                </h2>
                <p className="text-gray-500">
                Administra las categorías de tu restaurante
                </p>
            </div>

                <button
                    onClick={() => setMostrarModal(true)}
                    className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-lg shadow"
                >
                ➕ Nueva Categoría
                </button>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="text-gray-500 text-sm">Categorías</h3>
                <p className="text-3xl font-bold">{categorias.length}</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="text-gray-500 text-sm">Productos</h3>
                <p className="text-3xl font-bold">{totalProductos}</p>
            </div>

            <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="text-gray-500 text-sm">Más Popular</h3>
                <p className="text-3xl font-bold">🍕 Pizzas</p>
            </div>
            </div>

            {/* Buscador */}
            <div className="mb-6">
            <input
                type="text"
                placeholder="🔍 Buscar categoría..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full md:w-96 border border-gray-300 rounded-lg px-4 py-3"
            />
            </div>

            {/* Tarjetas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoriasFiltradas.map((categoria) => (
                <div
                key={categoria.id}
                className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
                >
                <div className={`${categoria.color} p-5`}>
                    <div className="text-5xl">{categoria.icono}</div>
                </div>

                <div className="p-5">
                    <h3 className="text-xl font-bold text-gray-800">
                    {categoria.nombre}
                    </h3>

                    <p className="text-gray-500 mt-2">
                    {categoria.descripcion}
                    </p>

                    <div className="mt-4 flex justify-between items-center">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm">
                        {categoria.productos} productos
                    </span>

                    <span className="text-green-600 text-sm font-semibold">
                        Activa
                    </span>
                    </div>

                    <div className="flex gap-2 mt-5">
                    <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg">
                        Ver
                    </button>

                    <button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-lg">
                        Editar
                    </button>

                    <button className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg">
                        Eliminar
                    </button>
                    </div>
                </div>
                </div>
            ))}
            </div>

            {/* Botón flotante */}
            <button className="fixed bottom-6 right-6 bg-amber-500 hover:bg-amber-600 text-white w-16 h-16 rounded-full shadow-lg text-3xl">
            +
            </button>
            {mostrarModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">

      <h2 className="text-2xl font-bold mb-4">
        Nueva Categoría
      </h2>

      <input
        type="text"
        placeholder="Nombre"
        value={nuevaCategoria.nombre}
        onChange={(e) =>
          setNuevaCategoria({
            ...nuevaCategoria,
            nombre: e.target.value,
          })
        }
        className="w-full border rounded-lg p-3 mb-3"
      />

      <textarea
        placeholder="Descripción"
        value={nuevaCategoria.descripcion}
        onChange={(e) =>
          setNuevaCategoria({
            ...nuevaCategoria,
            descripcion: e.target.value,
          })
        }
        className="w-full border rounded-lg p-3 mb-3"
      />

      <input
        type="text"
        placeholder="Icono (🍕)"
        value={nuevaCategoria.icono}
        onChange={(e) =>
          setNuevaCategoria({
            ...nuevaCategoria,
            icono: e.target.value,
          })
        }
        className="w-full border rounded-lg p-3 mb-3"
      />

      <select
        value={nuevaCategoria.color}
        onChange={(e) =>
          setNuevaCategoria({
            ...nuevaCategoria,
            color: e.target.value,
          })
        }
        className="w-full border rounded-lg p-3 mb-4"
      >
        <option value="bg-red-100">Rojo</option>
        <option value="bg-blue-100">Azul</option>
        <option value="bg-green-100">Verde</option>
        <option value="bg-yellow-100">Amarillo</option>
        <option value="bg-pink-100">Rosa</option>
      </select>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => setMostrarModal(false)}
          className="px-4 py-2 bg-gray-300 rounded-lg"
        >
          Cancelar
        </button>

        <button
          onClick={agregarCategoria}
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