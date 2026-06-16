import React, { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Power, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../api/supabase';
import { useRestaurant } from '../context/RestaurantContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const ROLES = ['GERENTE', 'MESERO', 'COCINERO', 'CAJERO', 'REPARTIDOR'] as const;
type Rol = typeof ROLES[number];

interface Usuario {
  user_id: string;
  owner_id: string;
  id_module: string;
  rol: Rol;
  estado: 'activo' | 'inactivo';
  email: string | null;
  nombre?: string | null;
  created_at?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export const Usuarios: React.FC = () => {
  const { activeModule } = useRestaurant();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    rol: 'MESERO' as Rol,
  });

  const fetchUsuarios = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/restaurant/usuarios`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar usuarios');
      setUsuarios(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule?.id_module) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/restaurant/usuarios`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...form, id_module: activeModule.id_module }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      setShowModal(false);
      setForm({ email: '', password: '', nombre: '', rol: 'MESERO' });
      await fetchUsuarios();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEstado = async (u: Usuario) => {
    const nuevoEstado = u.estado === 'activo' ? 'inactivo' : 'activo';
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/restaurant/usuarios/${u.user_id}/estado`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ estado: nuevoEstado, id_module: u.id_module }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsuarios(prev => prev.map(x => x.user_id === u.user_id ? { ...x, estado: nuevoEstado } : x));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (u: Usuario) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/restaurant/usuarios/${u.user_id}?id_module=${u.id_module}`, {
        method: 'DELETE',
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsuarios(prev => prev.filter(x => x.user_id !== u.user_id));
      setConfirmDelete(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const rolColor: Record<string, string> = {
    GERENTE:    'bg-orange-500/20 text-orange-400 border-orange-500/30',
    MESERO:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
    COCINERO:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    CAJERO:     'bg-purple-500/20 text-purple-400 border-purple-500/30',
    REPARTIDOR: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Usuarios</h1>
            <p className="text-slate-400 text-sm">Gestión de staff del restaurante</p>
          </div>
        </div>
        <button
          onClick={() => { setShowModal(true); setModalError(null); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-red-400 text-sm">{error}</div>
        ) : usuarios.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No hay usuarios registrados</p>
            <p className="text-slate-600 text-xs mt-1">Crea el primer usuario de staff</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-5 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider">Usuario</th>
                <th className="text-left px-5 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider">Rol</th>
                <th className="text-left px-5 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3 text-slate-400 font-semibold text-xs uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {usuarios.map(u => (
                <tr key={u.user_id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-white">{u.nombre || '—'}</div>
                    <div className="text-slate-500 text-xs">{u.email || u.user_id}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-lg border text-xs font-semibold ${rolColor[u.rol] || 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                      {u.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-lg border text-xs font-semibold ${
                      u.estado === 'activo'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-slate-700 text-slate-400 border-slate-600'
                    }`}>
                      {u.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleEstado(u)}
                        title={u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          u.estado === 'activo'
                            ? 'text-green-400 hover:bg-green-500/10'
                            : 'text-slate-500 hover:bg-slate-700'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(u.user_id)}
                        title="Eliminar"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Nuevo Usuario */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800">
              <h2 className="text-white font-bold text-lg">Nuevo Usuario</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Nombre</label>
                <input
                  required
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="juan@restaurante.com"
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Contraseña</label>
                <div className="relative">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full px-3 py-2.5 pr-10 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Rol</label>
                <select
                  value={form.rol}
                  onChange={e => setForm(f => ({ ...f, rol: e.target.value as Rol }))}
                  className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-colors"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">¿Eliminar usuario?</h3>
            <p className="text-slate-400 text-sm mb-6">Esta acción eliminará el acceso del usuario al restaurante. No se puede deshacer.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const u = usuarios.find(x => x.user_id === confirmDelete);
                  if (u) handleDelete(u);
                }}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
