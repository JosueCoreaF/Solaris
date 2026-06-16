import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, UtensilsCrossed } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getPlatillos, createPlatillo, updatePlatillo, deletePlatillo, getCategoriasPlatillo } from '../api/platillos';
import type { Platillo, CategoriaPlatillo } from '../types';

const emptyForm = { nombre_platillo: '', descripcion: '', precio: 0, activo: true, id_categoria_platillo: '' };

export const Platillos: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPlatillo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Platillo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const [p, c] = await Promise.all([
      getPlatillos(restaurant.id_restaurant),
      getCategoriasPlatillo(),
    ]);
    setPlatillos(p);
    setCategorias(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (p: Platillo) => {
    setEditing(p);
    setForm({
      nombre_platillo: p.nombre_platillo,
      descripcion: p.descripcion ?? '',
      precio: p.precio,
      activo: p.activo,
      id_categoria_platillo: p.id_categoria_platillo ?? '',
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre_platillo.trim()) { setError('El nombre es requerido.'); return; }
    if (form.precio < 0) { setError('El precio no puede ser negativo.'); return; }
    if (!form.id_categoria_platillo) { setError('La categoría es requerida.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        id_restaurant: restaurant.id_restaurant,
      };
      if (editing) {
        await updatePlatillo(editing.id_platillo, payload);
      } else {
        await createPlatillo(payload as any);
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
    if (!confirm('¿Eliminar este platillo?')) return;
    await deletePlatillo(id);
    await load();
  };

  const filtered = platillos.filter(p =>
    p.nombre_platillo.toLowerCase().includes(search.toLowerCase()),
  );

  const fmtPrice = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Platillos</h1>
            <p className="text-slate-400 text-xs">{platillos.length} platillos registrados</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo platillo
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar platillo..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={p => p.id_platillo}
          loading={loading}
          emptyMessage="Sin platillos. Agrega el primero."
          columns={[
            { key: 'nombre_platillo', header: 'Nombre' },
            { key: 'categoria', header: 'Categoría', render: p => p.categoria_platillo?.nombre_categoria ?? <span className="text-slate-600">—</span> },
            { key: 'precio', header: 'Precio', render: p => <span className="font-semibold text-orange-400">{fmtPrice(p.precio)}</span> },
            { key: 'activo', header: 'Estado', render: p => <Badge variant={p.activo ? 'success' : 'neutral'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge> },
            {
              key: 'acciones', header: 'Acciones', render: p => (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id_platillo)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar platillo' : 'Nuevo platillo'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
            <input
              value={form.nombre_platillo}
              onChange={e => setForm(f => ({ ...f, nombre_platillo: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Precio (HNL) *</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.precio}
                onChange={e => setForm(f => ({ ...f, precio: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
              <select
                value={form.id_categoria_platillo}
                onChange={e => setForm(f => ({ ...f, id_categoria_platillo: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id_categoria_platillo} value={c.id_categoria_platillo}>{c.nombre_categoria}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="activo"
              checked={form.activo}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="w-4 h-4 accent-orange-500"
            />
            <label htmlFor="activo" className="text-sm text-slate-300">Platillo activo</label>
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
