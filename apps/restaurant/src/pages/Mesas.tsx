import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Grid3X3, Pencil, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Badge, estadoMesaBadge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getMesas, createMesa, updateMesa, deleteMesa, cambiarEstadoMesa } from '../api/mesas';
import type { Mesa, EstadoMesa } from '../types';

const emptyForm = { numero_mesa: 1, capacidad: 2, estado: 'disponible' as EstadoMesa };

const estadoLabels: Record<EstadoMesa, string> = {
  disponible: 'Disponible',
  ocupada: 'Ocupada',
  reservada: 'Reservada',
};

const estadoColors: Record<EstadoMesa, string> = {
  disponible: 'border-emerald-500/40 bg-emerald-500/5',
  ocupada:    'border-red-500/40 bg-red-500/5',
  reservada:  'border-amber-500/40 bg-amber-500/5',
};

const estadoTextColors: Record<EstadoMesa, string> = {
  disponible: 'text-emerald-400',
  ocupada:    'text-red-400',
  reservada:  'text-amber-400',
};

export const Mesas: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Mesa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<EstadoMesa | 'todos'>('todos');

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    setMesas(await getMesas(restaurant.id_restaurant));
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (m: Mesa) => {
    setEditing(m);
    setForm({ numero_mesa: m.numero_mesa, capacidad: m.capacidad, estado: m.estado });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (form.numero_mesa < 1) { setError('Número de mesa inválido.'); return; }
    if (form.capacidad < 1) { setError('La capacidad debe ser al menos 1.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      if (editing) {
        await updateMesa(editing.id_mesa, form);
      } else {
        await createMesa({ ...form, id_restaurant: restaurant.id_restaurant });
      }
      await load();
      setModalOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta mesa?')) return;
    await deleteMesa(id);
    await load();
  };

  const handleCambiarEstado = async (id: string, estado: EstadoMesa) => {
    await cambiarEstadoMesa(id, estado);
    await load();
  };

  const filtered = filterEstado === 'todos' ? mesas : mesas.filter(m => m.estado === filterEstado);

  const counts = {
    disponible: mesas.filter(m => m.estado === 'disponible').length,
    ocupada:    mesas.filter(m => m.estado === 'ocupada').length,
    reservada:  mesas.filter(m => m.estado === 'reservada').length,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Grid3X3 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mesas</h1>
            <p className="text-slate-400 text-xs">{mesas.length} mesas registradas</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nueva mesa
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="flex gap-3 flex-wrap">
        {(['todos', 'disponible', 'ocupada', 'reservada'] as const).map(est => (
          <button
            key={est}
            onClick={() => setFilterEstado(est)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              filterEstado === est
                ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {est === 'todos' ? `Todas (${mesas.length})` : `${estadoLabels[est]} (${counts[est]})`}
          </button>
        ))}
      </div>

      {/* Grid de mesas */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {filtered.map((mesa, i) => (
            <motion.div
              key={mesa.id_mesa}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`relative bg-slate-900 border ${estadoColors[mesa.estado]} rounded-2xl p-4 flex flex-col items-center gap-3 group`}
            >
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{mesa.numero_mesa}</p>
                <p className="text-slate-500 text-xs">{mesa.capacidad} personas</p>
              </div>
              <Badge variant={estadoMesaBadge(mesa.estado)}>
                {estadoLabels[mesa.estado]}
              </Badge>

              {/* Cambiar estado rápido */}
              <div className="flex gap-1 flex-wrap justify-center">
                {(['disponible', 'ocupada', 'reservada'] as EstadoMesa[])
                  .filter(e => e !== mesa.estado)
                  .map(e => (
                    <button
                      key={e}
                      onClick={() => handleCambiarEstado(mesa.id_mesa, e)}
                      className={`text-xs px-2 py-0.5 rounded-md border transition-colors ${estadoTextColors[e]} border-current bg-current/5 hover:bg-current/15`}
                    >
                      {estadoLabels[e]}
                    </button>
                  ))
                }
              </div>

              {/* Acciones */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(mesa)} className="p-1 text-slate-400 hover:text-orange-400 bg-slate-800 rounded-lg">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => handleDelete(mesa.id_mesa)} className="p-1 text-slate-400 hover:text-red-400 bg-slate-800 rounded-lg">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 text-sm">
              Sin mesas para mostrar.
            </div>
          )}
        </motion.div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar mesa' : 'Nueva mesa'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Número de mesa *</label>
            <input
              type="number"
              min={1}
              value={form.numero_mesa}
              onChange={e => setForm(f => ({ ...f, numero_mesa: parseInt(e.target.value) || 1 }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Capacidad *</label>
            <input
              type="number"
              min={1}
              value={form.capacidad}
              onChange={e => setForm(f => ({ ...f, capacidad: parseInt(e.target.value) || 1 }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Estado</label>
            <select
              value={form.estado}
              onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoMesa }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="disponible">Disponible</option>
              <option value="ocupada">Ocupada</option>
              <option value="reservada">Reservada</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
