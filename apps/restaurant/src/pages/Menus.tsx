import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Pencil, Trash2, Search, Check, UtensilsCrossed } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getMenus, createMenu, updateMenu, deleteMenu, setPlatillosMenu } from '../api/menus';
import { getPlatillos } from '../api/platillos';
import type { Menu, Platillo } from '../types';

const emptyForm = { nombre_menu: '', descripcion: '', activo: true };

export const Menus: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Menu | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [platillosModal, setPlatillosModal] = useState<Menu | null>(null);
  const [selectedPlatillos, setSelectedPlatillos] = useState<Set<string>>(new Set());
  const [savingPlatillos, setSavingPlatillos] = useState(false);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const [m, p] = await Promise.all([
      getMenus(restaurant.id_restaurant),
      getPlatillos(restaurant.id_restaurant),
    ]);
    setMenus(m);
    setPlatillos(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (m: Menu) => {
    setEditing(m);
    setForm({ nombre_menu: m.nombre_menu, descripcion: m.descripcion ?? '', activo: m.activo ?? true });
    setError(null);
    setModalOpen(true);
  };

  const openPlatillos = (m: Menu) => {
    setPlatillosModal(m);
    setSelectedPlatillos(new Set((m.platillos ?? []).map(p => String(p.id_platillo))));
  };

  const handleSave = async () => {
    if (!form.nombre_menu.trim()) { setError('El nombre del menú es requerido.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = { ...form, id_restaurant: restaurant.id_restaurant };
      if (editing) {
        await updateMenu(editing.id_menu, form);
      } else {
        await createMenu(payload);
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
    if (!confirm('¿Eliminar este menú?')) return;
    await deleteMenu(id);
    await load();
  };

  const handleSavePlatillos = async () => {
    if (!platillosModal) return;
    setSavingPlatillos(true);
    try {
      await setPlatillosMenu(platillosModal.id_menu, Array.from(selectedPlatillos));
      await load();
      setPlatillosModal(null);
    } catch (e: any) {
      alert(e.message ?? 'Error al guardar platillos.');
    } finally {
      setSavingPlatillos(false);
    }
  };

  const togglePlatillo = (id: string) =>
    setSelectedPlatillos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = menus.filter(m =>
    m.nombre_menu.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Menús</h1>
            <p className="text-slate-400 text-xs">{menus.length} menús registrados</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo menú
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar menú..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={m => m.id_menu}
          loading={loading}
          emptyMessage="Sin menús creados."
          columns={[
            { key: 'nombre_menu', header: 'Nombre', render: m => <span className="font-medium text-white">{m.nombre_menu}</span> },
            { key: 'descripcion', header: 'Descripción', render: m => m.descripcion ?? <span className="text-slate-600">—</span> },
            {
              key: 'platillos', header: 'Platillos',
              render: m => (
                <button
                  onClick={() => openPlatillos(m)}
                  className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                  {(m.platillos ?? []).length} platillo{(m.platillos ?? []).length !== 1 ? 's' : ''}
                </button>
              ),
            },
            {
              key: 'activo', header: 'Estado',
              render: m => <Badge variant={m.activo ? 'success' : 'neutral'}>{m.activo ? 'Activo' : 'Inactivo'}</Badge>,
            },
            {
              key: 'acciones', header: 'Acciones',
              render: m => (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(m.id_menu)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar menú' : 'Nuevo menú'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
            <input value={form.nombre_menu} onChange={e => setForm(f => ({ ...f, nombre_menu: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="activo-menu" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))}
              className="w-4 h-4 accent-orange-500" />
            <label htmlFor="activo-menu" className="text-sm text-slate-300">Menú activo</label>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal gestionar platillos */}
      {platillosModal && (
        <Modal open={!!platillosModal} onClose={() => setPlatillosModal(null)} title={`Platillos — ${platillosModal.nombre_menu}`}>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Selecciona los platillos que forman parte de este menú.</p>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {platillos.map(p => {
                const sel = selectedPlatillos.has(String(p.id_platillo));
                return (
                  <button
                    key={p.id_platillo}
                    onClick={() => togglePlatillo(String(p.id_platillo))}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                      sel
                        ? 'bg-orange-500/15 border border-orange-500/40 text-white'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${sel ? 'bg-orange-500 border-orange-500' : 'border-slate-600'}`}>
                      {sel && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1">{p.nombre_platillo}</span>
                    <span className="text-slate-500 text-xs">
                      {new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(p.precio)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-slate-500 text-xs">{selectedPlatillos.size} platillo{selectedPlatillos.size !== 1 ? 's' : ''} seleccionado{selectedPlatillos.size !== 1 ? 's' : ''}</p>
            <div className="flex gap-3">
              <button onClick={() => setPlatillosModal(null)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleSavePlatillos} disabled={savingPlatillos}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
                {savingPlatillos ? 'Guardando...' : 'Guardar selección'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
