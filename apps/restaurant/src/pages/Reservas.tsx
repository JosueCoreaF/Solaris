import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, CalendarDays, Pencil, Trash2, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge, estadoReservaBadge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getReservas, createReserva, updateReserva, deleteReserva } from '../api/reservas';
import { getMesas } from '../api/mesas';
import { getClientes } from '../api/clientes';
import type { ReservaMesa, Mesa, ClienteRestaurante } from '../types';

const emptyForm = {
  fecha_reserva: '',
  hora_reserva: '',
  cantidad_personas: 2,
  estado: 'pendiente',
  observaciones: '',
  id_mesa: '',
  id_cliente: '',
};

const ESTADOS_RESERVA = ['pendiente', 'preparando', 'servido', 'cancelado'];

export const Reservas: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [reservas, setReservas] = useState<ReservaMesa[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [clientes, setClientes] = useState<ClienteRestaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReservaMesa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const id = restaurant.id_restaurant;
    const [r, m, c] = await Promise.all([
      getReservas(id),
      getMesas(id),
      getClientes(id),
    ]);
    setReservas(r);
    setMesas(m);
    setClientes(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, fecha_reserva: new Date().toISOString().split('T')[0] });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (r: ReservaMesa) => {
    setEditing(r);
    setForm({
      fecha_reserva: r.fecha_reserva,
      hora_reserva: r.hora_reserva,
      cantidad_personas: r.cantidad_personas,
      estado: r.estado,
      observaciones: r.observaciones ?? '',
      id_mesa: r.id_mesa ?? '',
      id_cliente: r.id_cliente ?? '',
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.fecha_reserva) { setError('La fecha es requerida.'); return; }
    if (!form.hora_reserva) { setError('La hora es requerida.'); return; }
    if (form.cantidad_personas < 1) { setError('El número de personas debe ser al menos 1.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        id_restaurant: restaurant.id_restaurant,
        id_mesa: form.id_mesa || undefined,
        id_cliente: form.id_cliente || undefined,
      };
      if (editing) {
        await updateReserva(editing.id_reserva, payload);
      } else {
        await createReserva(payload as any);
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
    if (!confirm('¿Eliminar esta reserva?')) return;
    await deleteReserva(id);
    await load();
  };

  const filtered = reservas.filter(r => {
    const cliente = r.cliente_restaurante;
    const texto = `${cliente?.nombre ?? ''} ${cliente?.apellido ?? ''} ${r.observaciones ?? ''}`.toLowerCase();
    return texto.includes(search.toLowerCase());
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Reservas</h1>
            <p className="text-slate-400 text-xs">{reservas.length} reservas registradas</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nueva reserva
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar reserva..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={r => r.id_reserva}
          loading={loading}
          emptyMessage="Sin reservas registradas."
          columns={[
            {
              key: 'cliente', header: 'Cliente',
              render: r => r.cliente_restaurante
                ? <span className="font-medium text-white">{r.cliente_restaurante.nombre} {r.cliente_restaurante.apellido}</span>
                : <span className="text-slate-600">Sin cliente</span>,
            },
            {
              key: 'fecha', header: 'Fecha y hora',
              render: r => (
                <div>
                  <p className="text-white font-medium">{new Date(r.fecha_reserva + 'T00:00:00').toLocaleDateString('es-HN')}</p>
                  <p className="text-slate-400 text-xs">{r.hora_reserva}</p>
                </div>
              ),
            },
            { key: 'mesa', header: 'Mesa', render: r => r.mesa_restaurante ? `Mesa ${r.mesa_restaurante.numero_mesa}` : <span className="text-slate-600">—</span> },
            { key: 'cantidad_personas', header: 'Personas', render: r => <span className="text-orange-400 font-semibold">{r.cantidad_personas}</span> },
            { key: 'estado', header: 'Estado', render: r => <Badge variant={estadoReservaBadge(r.estado)}>{r.estado.charAt(0).toUpperCase() + r.estado.slice(1)}</Badge> },
            {
              key: 'acciones', header: 'Acciones',
              render: r => (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(r.id_reserva)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar reserva' : 'Nueva reserva'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fecha *</label>
              <input type="date" value={form.fecha_reserva}
                onChange={e => setForm(f => ({ ...f, fecha_reserva: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Hora *</label>
              <input type="time" value={form.hora_reserva}
                onChange={e => setForm(f => ({ ...f, hora_reserva: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Cliente</label>
              <select value={form.id_cliente} onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} {c.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Mesa</label>
              <select value={form.id_mesa} onChange={e => setForm(f => ({ ...f, id_mesa: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                <option value="">Sin mesa asignada</option>
                {mesas.map(m => <option key={m.id_mesa} value={m.id_mesa}>Mesa {m.numero_mesa} ({m.capacidad} pers.)</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">N° de personas *</label>
              <input type="number" min={1} value={form.cantidad_personas}
                onChange={e => setForm(f => ({ ...f, cantidad_personas: parseInt(e.target.value) || 1 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                {ESTADOS_RESERVA.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              rows={2} placeholder="Alergias, solicitudes especiales..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none" />
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
