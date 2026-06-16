import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, UserCheck, Pencil, Trash2, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getEmpleados, createEmpleado, updateEmpleado, deleteEmpleado, getCargos } from '../api/empleados';
import type { EmpleadoRestaurante, CargoRestaurant } from '../types';

const emptyForm = { nombre_empleado: '', apellido: '', id_cargo_restaurante: '', telefono: '', correo: '', salario: 0 };

export const Empleados: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [empleados, setEmpleados] = useState<EmpleadoRestaurante[]>([]);
  const [cargos, setCargos] = useState<CargoRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmpleadoRestaurante | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const [emp, c] = await Promise.all([getEmpleados(restaurant.id_restaurant), getCargos()]);
    setEmpleados(emp);
    setCargos(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (e: EmpleadoRestaurante) => {
    setEditing(e);
    setForm({
      nombre_empleado: e.nombre_empleado,
      apellido: e.apellido,
      id_cargo_restaurante: e.id_cargo_restaurante ?? '',
      telefono: e.telefono ?? '',
      correo: e.correo ?? '',
      salario: e.salario ?? 0,
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre_empleado.trim() || !form.apellido.trim()) { setError('Nombre y apellido son requeridos.'); return; }
    if (!form.telefono.trim() || !form.correo.trim()) { setError('Teléfono y correo son requeridos.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        id_restaurant: restaurant.id_restaurant,
        id_cargo_restaurante: form.id_cargo_restaurante || undefined,
      };
      if (editing) {
        await updateEmpleado(editing.id_empleado_restaurante, payload);
      } else {
        await createEmpleado(payload as any);
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
    if (!confirm('¿Eliminar este empleado?')) return;
    await deleteEmpleado(id);
    await load();
  };

  const filtered = empleados.filter(e =>
    `${e.nombre_empleado} ${e.apellido} ${e.cargo_restaurant?.nombre_cargo ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  );

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Empleados</h1>
            <p className="text-slate-400 text-xs">{empleados.length} empleados registrados</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nuevo empleado
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar empleado..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={e => e.id_empleado_restaurante}
          loading={loading}
          emptyMessage="Sin empleados registrados."
          columns={[
            { key: 'nombre', header: 'Nombre', render: e => <span className="font-medium text-white">{e.nombre_empleado} {e.apellido}</span> },
            { key: 'cargo', header: 'Cargo', render: e => e.cargo_restaurant ? <Badge variant="orange">{e.cargo_restaurant.nombre_cargo}</Badge> : <span className="text-slate-600">—</span> },
            { key: 'telefono', header: 'Teléfono', render: e => e.telefono ?? <span className="text-slate-600">—</span> },
            { key: 'correo', header: 'Correo', render: e => e.correo ?? <span className="text-slate-600">—</span> },
            { key: 'salario', header: 'Salario', render: e => e.salario ? <span className="text-orange-400 font-semibold">{fmtCurrency(e.salario)}</span> : <span className="text-slate-600">—</span> },
            {
              key: 'acciones', header: 'Acciones',
              render: e => (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(e.id_empleado_restaurante)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar empleado' : 'Nuevo empleado'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
              <input value={form.nombre_empleado} onChange={e => setForm(f => ({ ...f, nombre_empleado: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Apellido *</label>
              <input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Cargo</label>
            <select value={form.id_cargo_restaurante} onChange={e => setForm(f => ({ ...f, id_cargo_restaurante: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="">Selecciona un cargo...</option>
              {cargos.map(c => <option key={c.id_cargo_restaurante} value={c.id_cargo_restaurante}>{c.nombre_cargo}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono *</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Correo *</label>
              <input type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Salario (HNL)</label>
            <input type="number" min={0} step={0.01} value={form.salario}
              onChange={e => setForm(f => ({ ...f, salario: parseFloat(e.target.value) || 0 }))}
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
