import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Users, Pencil, Trash2, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { useRestaurant } from '../context/RestaurantContext';
import { getClientes, createCliente, updateCliente, deleteCliente } from '../api/clientes';
import type { ClienteRestaurante } from '../types';

const emptyForm = { nombre: '', apellido: '', telefono: '', correo: '' };

export const Clientes: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [clientes, setClientes] = useState<ClienteRestaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
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
    setModalOpen(true);
  };

  const openEdit = (c: ClienteRestaurante) => {
    setEditing(c);
    setForm({ nombre: c.nombre, apellido: c.apellido, telefono: c.telefono ?? '', correo: c.correo ?? '' });
    setError(null);
    setModalOpen(true);
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
      setModalOpen(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Clientes</h1>
            <p className="text-slate-400 text-xs">{clientes.length} clientes registrados</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={c => c.id_cliente}
          loading={loading}
          emptyMessage="Sin clientes registrados."
          columns={[
            { key: 'nombre', header: 'Nombre', render: c => <span className="font-medium text-white">{c.nombre} {c.apellido}</span> },
            { key: 'telefono', header: 'Teléfono', render: c => c.telefono ?? <span className="text-slate-600">—</span> },
            { key: 'correo', header: 'Correo', render: c => c.correo ?? <span className="text-slate-600">—</span> },
            {
              key: 'acciones', header: 'Acciones',
              render: c => (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id_cliente)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Apellido *</label>
              <input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono</label>
            <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Correo</label>
            <input type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
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
    </div>
  );
};
