import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, UtensilsCrossed, ImageOff } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getPlatillos, createPlatillo, updatePlatillo, deletePlatillo, getCategoriasPlatillo } from '../api/platillos';
import type { Platillo, CategoriaPlatillo } from '../types';

const emptyForm = {
  nombre_platillo: '', descripcion: '', precio: 0, activo: true,
  id_categoria_platillo: '', imagen_url: '',
};

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

export const Platillos: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [categorias, setCategorias] = useState<CategoriaPlatillo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterActivo, setFilterActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');
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
      imagen_url: p.imagen_url ?? '',
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
        imagen_url: form.imagen_url.trim() || undefined,
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

  const filtered = platillos
    .filter(p => p.nombre_platillo.toLowerCase().includes(search.toLowerCase()))
    .filter(p => !filterCat || p.id_categoria_platillo === filterCat)
    .filter(p => filterActivo === 'todos' ? true : filterActivo === 'activos' ? p.activo : !p.activo);

  const inputCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500 transition-colors";
  const labelCls = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Platillos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {platillos.filter(p => p.activo).length} activos · {platillos.length} total
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo platillo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar platillo..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id_categoria_platillo} value={c.id_categoria_platillo}>{c.nombre_categoria}</option>)}
        </select>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {(['todos', 'activos', 'inactivos'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterActivo(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                filterActivo === f ? 'bg-orange-500 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de platillos */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <UtensilsCrossed className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Sin platillos para mostrar</p>
          <button onClick={openCreate} className="mt-4 text-orange-400 text-sm hover:text-orange-300 transition-colors">
            + Crear el primero
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id_platillo}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.025, duration: 0.2 }}
                className={`group relative bg-white dark:bg-slate-900 border rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-lg ${
                  p.activo ? 'border-slate-200 dark:border-slate-800 hover:border-orange-500/40' : 'border-slate-200/50 dark:border-slate-800/50 opacity-60'
                }`}
              >
                {/* Imagen */}
                <div className="relative h-28 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  {p.imagen_url ? (
                    <img
                      src={p.imagen_url}
                      alt={p.nombre_platillo}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                    />
                  ) : null}
                  <div className={`${p.imagen_url ? 'hidden' : ''} flex flex-col items-center gap-1 text-slate-400 dark:text-slate-700`}>
                    <ImageOff className="w-6 h-6" />
                    <span className="text-xs">Sin imagen</span>
                  </div>
                  {/* Acciones */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-xl transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id_platillo)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-sm text-red-300 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Badge estado */}
                  <div className="absolute top-2 right-2">
                    <Badge variant={p.activo ? 'success' : 'neutral'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2.5 flex-1 flex flex-col gap-1">
                  <p className="text-slate-900 dark:text-white text-xs font-semibold leading-tight line-clamp-2">{p.nombre_platillo}</p>
                  {p.categoria_platillo && (
                    <p className="text-slate-500 text-xs">{p.categoria_platillo.nombre_categoria}</p>
                  )}
                  <p className="text-orange-400 text-sm font-bold mt-auto pt-1">{fmtPrice(p.precio)}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar platillo' : 'Nuevo platillo'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Nombre *</label>
              <input
                value={form.nombre_platillo}
                onChange={e => setForm(f => ({ ...f, nombre_platillo: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Precio (HNL) *</label>
              <input
                type="number" min={0} step={0.01} value={form.precio}
                onChange={e => setForm(f => ({ ...f, precio: parseFloat(e.target.value) || 0 }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Categoría *</label>
              <select
                value={form.id_categoria_platillo}
                onChange={e => setForm(f => ({ ...f, id_categoria_platillo: e.target.value }))}
                className={inputCls}
              >
                <option value="">Sin categoría</option>
                {categorias.map(c => (
                  <option key={c.id_categoria_platillo} value={c.id_categoria_platillo}>{c.nombre_categoria}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>URL de imagen</label>
              <input
                value={form.imagen_url}
                onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))}
                placeholder="https://example.com/imagen.jpg"
                className={`${inputCls} font-mono text-xs`}
              />
              {form.imagen_url && (
                <div className="mt-2 rounded-xl overflow-hidden h-24 bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                  <img
                    src={form.imagen_url}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox" id="activo" checked={form.activo}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="w-4 h-4 accent-orange-500"
            />
            <label htmlFor="activo" className="text-sm text-slate-600 dark:text-slate-300">Platillo activo (visible en menú)</label>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">
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
