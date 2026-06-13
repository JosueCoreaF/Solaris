import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Menu {
  id_menu: number;
  nombre_menu: string;
  descripcion: string;
  horario_inicio: string;
  horario_fin: string;
  activo: boolean;
}

export default function Menu() {
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);

  const [menus, setMenus] = useState<Menu[]>([
    {
      id_menu: 1,
      nombre_menu: "Desayunos",
      descripcion: "Menú de mañana",
      horario_inicio: "06:00",
      horario_fin: "10:00",
      activo: true,
    },
  ]);

  const [nuevoMenu, setNuevoMenu] = useState<Menu>({
    id_menu: 0,
    nombre_menu: "",
    descripcion: "",
    horario_inicio: "",
    horario_fin: "",
    activo: true,
  });

  const filtrados = menus.filter((m) =>
    m.nombre_menu.toLowerCase().includes(busqueda.toLowerCase())
  );

  const guardarMenu = () => {
    if (!nuevoMenu.nombre_menu) return;

    const nuevo = {
      ...nuevoMenu,
      id_menu: Date.now(),
    };

    setMenus([...menus, nuevo]);

    setNuevoMenu({
      id_menu: 0,
      nombre_menu: "",
      descripcion: "",
      horario_inicio: "",
      horario_fin: "",
      activo: true,
    });

    setMostrarModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">Menús</h1>

        <div className="flex gap-2">

          {/* 🔵 BOTÓN DASHBOARD */}
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Dashboard
          </button>

          {/* 🟡 NUEVO MENÚ */}
          <button
            onClick={() => setMostrarModal(true)}
            className="bg-amber-500 text-white px-4 py-2 rounded"
          >
            Nuevo Menú
          </button>

        </div>

      </div>

      {/* BUSCADOR */}
      <input
        placeholder="Buscar menú..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="border p-2 w-full md:w-80 mb-5"
      />

      {/* LISTA */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

        {filtrados.map((m) => (
          <div key={m.id_menu} className="bg-white p-4 rounded shadow">

            <h2 className="text-xl font-bold">{m.nombre_menu}</h2>
            <p className="text-gray-600">{m.descripcion}</p>

            <p className="text-sm text-gray-500">
              🕒 {m.horario_inicio} - {m.horario_fin}
            </p>

            <p className={m.activo ? "text-green-600" : "text-red-600"}>
              {m.activo ? "Activo" : "Inactivo"}
            </p>

          </div>
        ))}

      </div>

      {/* MODAL */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">

          <div className="bg-white p-6 rounded w-full max-w-md">

            <h2 className="text-xl font-bold mb-4">Nuevo Menú</h2>

            <input
              placeholder="Nombre menú"
              className="border p-2 w-full mb-2"
              value={nuevoMenu.nombre_menu}
              onChange={(e) =>
                setNuevoMenu({ ...nuevoMenu, nombre_menu: e.target.value })
              }
            />

            <input
              placeholder="Descripción"
              className="border p-2 w-full mb-2"
              onChange={(e) =>
                setNuevoMenu({ ...nuevoMenu, descripcion: e.target.value })
              }
            />

            <input
              type="time"
              className="border p-2 w-full mb-2"
              onChange={(e) =>
                setNuevoMenu({ ...nuevoMenu, horario_inicio: e.target.value })
              }
            />

            <input
              type="time"
              className="border p-2 w-full mb-2"
              onChange={(e) =>
                setNuevoMenu({ ...nuevoMenu, horario_fin: e.target.value })
              }
            />

            <div className="flex justify-end gap-2 mt-4">

              <button
                onClick={() => setMostrarModal(false)}
                className="bg-gray-300 px-3 py-1 rounded"
              >
                Cancelar
              </button>

              <button
                onClick={guardarMenu}
                className="bg-amber-500 text-white px-3 py-1 rounded"
              >
                Guardar
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}