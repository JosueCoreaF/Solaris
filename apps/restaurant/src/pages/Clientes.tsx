import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Users, Pencil, Trash2, Search, Phone, Mail, X } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../api/clientes';
import type { ClienteRestaurante } from '../types';

const emptyForm = { nombre: '', apellido: '', telefono: '', correo: '' };

function initials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

const AVATAR_COLORS = [
  'from-orange-500 to-red-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-purple-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-sky-500 to-blue-500',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Drawer de edición ──────────────────────────────────────────────────────────

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={onClose}
        />
        <motion.div
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-full max-w-sm bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-slate-900 dark:text-white font-bold text-base">{title}</h2>
            <button onClick={onClose} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── Página ─────────────────────────────────────────────────────────────────────

export const Clientes: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [clientes, setClientes] = useState<ClienteRestaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteRestaurante | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    setClientes(await getClientes(restaurant.id_restaurant));
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setDrawerOpen(true);
  };

  const openEdit = (c: ClienteRestaurante) => {
    setEditing(c);
    setForm({ nombre: c.nombre, apellido: c.apellido, telefono: c.telefono ?? '', correo: c.correo ?? '' });
    setError(null);
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.apellido.trim()) { setError('Nombre y apellido son requeridos.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = { ...form, id_restaurant: restaurant.id_restaurant };
      if (editing) {
        await updateCliente(editing.id_cliente, payload);
      } else {
        await createCliente(payload);
      }
      await load();
      setDrawerOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este cliente?')) return;
    await deleteCliente(id);
    await load();
  };

  const filtered = clientes.filter(c =>
    `${c.nombre} ${c.apellido} ${c.correo ?? ''} ${c.telefono ?? ''}`
      .toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Clientes</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{clientes.length} clientes registrados</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      {/* Búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      {/* Grid de tarjetas */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <Users className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">{search ? 'Sin resultados para esa búsqueda' : 'Aún no hay clientes registrados'}</p>
          {!search && (
            <button onClick={openCreate} className="mt-4 text-orange-400 text-sm hover:text-orange-300 transition-colors">
              + Registrar el primero
            </button>
          )}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((c, i) => {
              const grad = avatarColor(`${c.nombre}${c.apellido}`);
              return (
                <motion.div
                  key={c.id_cliente}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all hover:shadow-lg flex flex-col gap-3"
                >
                  {/* Avatar + nombre */}
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                      {initials(c.nombre, c.apellido)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-900 dark:text-white font-semibold text-sm truncate">{c.nombre} {c.apellido}</p>
                      <p className="text-slate-500 text-xs">Cliente</p>
                    </div>
                  </div>

                  {/* Contacto */}
                  <div className="space-y-1.5">
                    {c.telefono && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Phone className="w-3 h-3 text-slate-400 dark:text-slate-600 flex-shrink-0" />
                        <span className="truncate">{c.telefono}</span>
                      </div>
                    )}
                    {c.correo && (
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <Mail className="w-3 h-3 text-slate-400 dark:text-slate-600 flex-shrink-0" />
                        <span className="truncate">{c.correo}</span>
                      </div>
                    )}
                    {!c.telefono && !c.correo && (
                      <p className="text-xs text-slate-400 italic">Sin datos de contacto</p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(c)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 py-1.5 rounded-lg transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c.id_cliente)}
                      className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 py-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Drawer crear/editar */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `Editar — ${editing.nombre} ${editing.apellido}` : 'Nuevo cliente'}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Apellido *</label>
              <input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Teléfono</label>
            <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Correo</label>
            <input type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDrawerOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
