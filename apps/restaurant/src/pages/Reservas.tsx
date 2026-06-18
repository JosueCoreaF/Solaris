import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, CalendarDays, Pencil, Trash2, Search, Clock, Users, MapPin } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useRestaurant } from '../context/RestaurantContext';
import { getReservas, createReserva, updateReserva, deleteReserva } from '../api/reservas';
import { getMesas } from '../api/mesas';
import { getClientes } from '../api/clientes';
import type { ReservaMesa, Mesa, ClienteRestaurante } from '../types';

const emptyForm = {
  fecha_reserva: '', hora_reserva: '', cantidad_personas: 2,
  estado: 'pendiente', observaciones: '', id_mesa: '', id_cliente: '',
};

type DateFilter = 'hoy' | 'manana' | 'semana' | 'todos';

const ESTADOS_RESERVA = ['pendiente', 'preparando', 'servido', 'cancelado'];
const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente', preparando: 'Confirmada', servido: 'Completada', cancelado: 'Cancelada',
};
const estadoStyles: Record<string, { border: string; text: string; dot: string }> = {
  pendiente:  { border: 'border-amber-500/40',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  preparando: { border: 'border-blue-500/40',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  servido:    { border: 'border-emerald-500/40', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  cancelado:  { border: 'border-slate-300 dark:border-slate-700', text: 'text-slate-500', dot: 'bg-slate-400' },
};

const dateLabels: Record<DateFilter, string> = { hoy: 'Hoy', manana: 'Mañana', semana: 'Esta semana', todos: 'Todas' };

function isInRange(fechaStr: string, filter: DateFilter): boolean {
  if (filter === 'todos') return true;
  const fecha = new Date(fechaStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (filter === 'hoy') return fecha.getTime() === today.getTime();
  if (filter === 'manana') return fecha.getTime() === tomorrow.getTime();
  if (filter === 'semana') {
    const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 7);
    return fecha >= today && fecha <= endOfWeek;
  }
  return true;
}

function fmtFecha(fechaStr: string): string {
  const d = new Date(fechaStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return 'Hoy';
  if (d.getTime() === tomorrow.getTime()) return 'Mañana';
  return d.toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'short' });
}

export const Reservas: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [reservas, setReservas] = useState<ReservaMesa[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [clientes, setClientes] = useState<ClienteRestaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('semana');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReservaMesa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const id = restaurant.id_restaurant;
    const [r, m, c] = await Promise.all([getReservas(id), getMesas(id), getClientes(id)]);
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
    setForm({ fecha_reserva: r.fecha_reserva, hora_reserva: r.hora_reserva, cantidad_personas: r.cantidad_personas, estado: r.estado, observaciones: r.observaciones ?? '', id_mesa: r.id_mesa ?? '', id_cliente: r.id_cliente ?? '' });
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
      const payload = { ...form, id_restaurant: restaurant.id_restaurant, id_mesa: form.id_mesa || undefined, id_cliente: form.id_cliente || undefined };
      if (editing) { await updateReserva(editing.id_reserva, payload); }
      else { await createReserva(payload as any); }
      await load();
      setModalOpen(false);
    } catch (e: any) { setError(e.message ?? 'Error al guardar.'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta reserva?')) return;
    await deleteReserva(id);
    await load();
  };

  const filtered = useMemo(() =>
    reservas
      .filter(r => isInRange(r.fecha_reserva, dateFilter))
      .filter(r => {
        const texto = `${r.cliente_restaurante?.nombre ?? ''} ${r.cliente_restaurante?.apellido ?? ''} ${r.observaciones ?? ''}`.toLowerCase();
        return texto.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const da = new Date(`${a.fecha_reserva}T${a.hora_reserva}`);
        const db = new Date(`${b.fecha_reserva}T${b.hora_reserva}`);
        return da.getTime() - db.getTime();
      }),
    [reservas, dateFilter, search],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ReservaMesa[]>();
    filtered.forEach(r => {
      const k = r.fecha_reserva;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = { pendiente: reservas.filter(r => r.estado === 'pendiente').length, total: reservas.length };

  const inputCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500";
  const labelCls = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Reservas</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{counts.total} reservas · {counts.pendiente} pendientes</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
          <Plus className="w-4 h-4" /> Nueva reserva
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {(['hoy', 'manana', 'semana', 'todos'] as DateFilter[]).map(f => (
            <button key={f} onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateFilter === f ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
              {dateLabels[f]}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors" />
        </div>
      </div>

      {/* Timeline agrupada por fecha */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <CalendarDays className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Sin reservas para {dateLabels[dateFilter].toLowerCase()}</p>
          <button onClick={openCreate} className="mt-4 text-orange-400 text-sm hover:text-orange-300">+ Crear una reserva</button>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence>
            {grouped.map(([fecha, items]) => (
              <motion.div key={fecha} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {/* Cabecera de fecha */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                    <span className="text-slate-900 dark:text-white font-bold text-sm capitalize">{fmtFecha(fecha)}</span>
                    <span className="text-slate-500 text-xs">{new Date(fecha + 'T00:00:00').toLocaleDateString('es-HN', { day: '2-digit', month: 'long' })}</span>
                  </div>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                  <span className="text-slate-400 text-xs">{items.length} reserva{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Tarjetas del día */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(r => {
                    const sty = estadoStyles[r.estado] ?? estadoStyles.pendiente;
                    return (
                      <div key={r.id_reserva}
                        className={`group bg-white dark:bg-slate-900 border ${sty.border} rounded-xl p-4 hover:shadow-lg transition-all`}>
                        {/* Hora + estado */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-orange-400" />
                            <span className="text-slate-900 dark:text-white font-bold text-lg">{r.hora_reserva.slice(0, 5)}</span>
                          </div>
                          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${sty.text} bg-current/10`}
                            style={{ background: `color-mix(in srgb, currentColor 10%, transparent)` }}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sty.dot}`} />
                            {estadoLabel[r.estado] ?? r.estado}
                          </div>
                        </div>

                        {/* Cliente */}
                        <div className="space-y-1.5">
                          {r.cliente_restaurante ? (
                            <p className="text-slate-900 dark:text-white font-medium text-sm">
                              {r.cliente_restaurante.nombre} {r.cliente_restaurante.apellido}
                            </p>
                          ) : (
                            <p className="text-slate-400 text-sm italic">Sin cliente asignado</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {r.cantidad_personas} pers.
                            </div>
                            {r.mesa_restaurante && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                Mesa {r.mesa_restaurante.numero_mesa}
                              </div>
                            )}
                          </div>
                          {r.observaciones && (
                            <p className="text-slate-400 text-xs line-clamp-2 italic">{r.observaciones}</p>
                          )}
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2 mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(r)}
                            className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 py-1 rounded-lg transition-colors">
                            <Pencil className="w-3 h-3" /> Editar
                          </button>
                          <button onClick={() => handleDelete(r.id_reserva)}
                            className="flex-1 flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 py-1 rounded-lg transition-colors">
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar reserva' : 'Nueva reserva'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={form.fecha_reserva} onChange={e => setForm(f => ({ ...f, fecha_reserva: e.target.value }))}
                className={`${inputCls} dark:[color-scheme:dark]`} />
            </div>
            <div>
              <label className={labelCls}>Hora *</label>
              <input type="time" value={form.hora_reserva} onChange={e => setForm(f => ({ ...f, hora_reserva: e.target.value }))}
                className={`${inputCls} dark:[color-scheme:dark]`} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cliente</label>
              <select value={form.id_cliente} onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value }))}
                className={inputCls}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} {c.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Mesa</label>
              <select value={form.id_mesa} onChange={e => setForm(f => ({ ...f, id_mesa: e.target.value }))}
                className={inputCls}>
                <option value="">Sin mesa</option>
                {mesas.map(m => <option key={m.id_mesa} value={m.id_mesa}>Mesa {m.numero_mesa} ({m.capacidad} pers.)</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>N° de personas *</label>
              <input type="number" min={1} value={form.cantidad_personas} onChange={e => setForm(f => ({ ...f, cantidad_personas: parseInt(e.target.value) || 1 }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                className={inputCls}>
                {ESTADOS_RESERVA.map(s => <option key={s} value={s}>{estadoLabel[s] ?? s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              rows={2} placeholder="Alergias, solicitudes especiales..."
              className={`${inputCls} resize-none`} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">
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
