import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ShoppingBag, RefreshCw, Trash2, Clock, UtensilsCrossed } from 'lucide-react';
import { Modal } from '../components/Modal';
import { useRestaurant } from '../context/RestaurantContext';
import { getPedidos, createPedido, updateEstadoPedido, deletePedido } from '../api/pedidos';
import { getMesas } from '../api/mesas';
import { getClientes } from '../api/clientes';
import { getEmpleados } from '../api/empleados';
import { getPlatillos } from '../api/platillos';
import type {
  PedidoRestaurante, EstadoPedido, Mesa, ClienteRestaurante,
  EmpleadoRestaurante, Platillo, DetallePedido,
} from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

function elapsed(fecha: string): string {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (diff < 60) return `${diff} min`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

function elapsedMinutes(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
}

// ── Columnas Kanban ────────────────────────────────────────────────────────────

interface Column {
  estado: EstadoPedido;
  label: string;
  accent: string;
  bg: string;
  dot: string;
}

const COLUMNS: Column[] = [
  { estado: 'pendiente',  label: 'Pendiente',  accent: '#f59e0b', bg: 'rgba(245,158,11,0.07)',  dot: 'bg-amber-400' },
  { estado: 'preparando', label: 'Preparando', accent: '#3b82f6', bg: 'rgba(59,130,246,0.07)',  dot: 'bg-blue-400' },
  { estado: 'servido',    label: 'Servido',    accent: '#22c55e', bg: 'rgba(34,197,94,0.07)',   dot: 'bg-emerald-400' },
  { estado: 'cancelado',  label: 'Cancelado',  accent: '#ef4444', bg: 'rgba(239,68,68,0.05)',   dot: 'bg-red-400' },
];

// ── Tarjeta de Pedido ─────────────────────────────────────────────────────────

interface CardProps {
  pedido: PedidoRestaurante;
  accent: string;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onCancel: () => void;
}

const PedidoCard: React.FC<CardProps> = ({ pedido, accent, onDelete, onDragStart, onCancel }) => {
  const mins = elapsedMinutes(pedido.fecha_pedido);
  const isLate = mins > 20 && pedido.estado_pedido === 'pendiente';
  const total = (pedido.detalle_pedido_restaurante ?? []).reduce(
    (s, d) => s + (d.precio_unitario ?? 0) * (d.cantidad ?? 0), 0,
  );
  const platillosList = (pedido.detalle_pedido_restaurante ?? [])
    .map(d => `${d.cantidad}× ${(d as any).platillo?.nombre_platillo ?? '—'}`)
    .join(', ');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={onDragStart}
      className="select-none cursor-grab active:cursor-grabbing"
    >
      <div
        className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-all hover:shadow-lg group"
        style={{ borderColor: `${accent}40`, boxShadow: `0 0 0 0 ${accent}00` }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 0 1px ${accent}60`)}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = `0 0 0 0 ${accent}00`)}
      >
        {/* Barra superior */}
        <div className="h-1" style={{ background: accent }} />

        <div className="p-3 space-y-2.5">
          {/* Mesa + tiempo */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-2xl font-black leading-none" style={{ color: accent }}>
                {pedido.mesa_restaurante ? `M${pedido.mesa_restaurante.numero_mesa}` : '—'}
              </div>
              {pedido.mesa_restaurante && (
                <div className="text-slate-500 text-xs mt-0.5">
                  {pedido.mesa_restaurante.capacidad} pers.
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isLate ? 'bg-red-500/15 text-red-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              <Clock className="w-3 h-3" />
              {elapsed(pedido.fecha_pedido)}
              {isLate && ' ⚠'}
            </div>
          </div>

          {/* Platillos */}
          {platillosList && (
            <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed line-clamp-2">
              {platillosList}
            </p>
          )}

          {/* Cliente */}
          {pedido.cliente_restaurante && (
            <p className="text-slate-500 text-xs truncate">
              👤 {pedido.cliente_restaurante.nombre} {pedido.cliente_restaurante.apellido}
            </p>
          )}

          {/* Total + acciones */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
            <span className="text-sm font-bold" style={{ color: accent }}>
              {fmtCurrency(total)}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {pedido.estado_pedido !== 'cancelado' && pedido.estado_pedido !== 'servido' && (
                <button
                  onClick={e => { e.stopPropagation(); onCancel(); }}
                  className="text-xs px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDelete(); }}
                className="p-1 text-slate-400 dark:text-slate-600 hover:text-red-400 transition-colors rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ── Columna Kanban ─────────────────────────────────────────────────────────────

interface ColumnProps {
  col: Column;
  pedidos: PedidoRestaurante[];
  onDrop: (estado: EstadoPedido) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
  onDragStart: (pedido: PedidoRestaurante) => void;
}

const KanbanColumn: React.FC<ColumnProps> = ({ col, pedidos, onDrop, onDelete, onCancel, onDragStart }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className="flex flex-col min-h-[400px] rounded-2xl transition-all"
      style={{ background: isDragOver ? col.bg : 'transparent', border: isDragOver ? `1px dashed ${col.accent}60` : '1px solid transparent' }}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => { setIsDragOver(false); onDrop(col.estado); }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="text-sm font-bold text-slate-900 dark:text-white">{col.label}</span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: `${col.accent}18`, color: col.accent }}
        >
          {pedidos.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 px-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {pedidos.map(p => (
            <PedidoCard
              key={p.id_pedido}
              pedido={p}
              accent={col.accent}
              onDragStart={e => onDragStart(p)}
              onDelete={() => onDelete(p.id_pedido)}
              onCancel={() => onCancel(p.id_pedido)}
            />
          ))}
        </AnimatePresence>

        {pedidos.length === 0 && !isDragOver && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-700">
            <UtensilsCrossed className="w-7 h-7 mb-2 opacity-40" />
            <p className="text-xs">Sin pedidos</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Formulario ─────────────────────────────────────────────────────────────────

interface ItemDetalle {
  id_platillo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

// ── Página principal ───────────────────────────────────────────────────────────

export const Pedidos: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [pedidos, setPedidos] = useState<PedidoRestaurante[]>([]);
  const [loading, setLoading] = useState(true);

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [clientes, setClientes] = useState<ClienteRestaurante[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoRestaurante[]>([]);
  const [platillos, setPlatillos] = useState<Platillo[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ id_mesa: '', id_cliente: '', id_empleado_restaurante: '' });
  const [items, setItems] = useState<ItemDetalle[]>([]);
  const [selectedPlatillo, setSelectedPlatillo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type DateFilter = 'hoy' | 'semana' | 'todos';
  const [dateFilter, setDateFilter] = useState<DateFilter>('hoy');
  const draggingRef = useRef<PedidoRestaurante | null>(null);

  function isInDateRange(fecha: string, filter: DateFilter): boolean {
    if (filter === 'todos') return true;
    const d = new Date(fecha);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filter === 'hoy') return d >= today;
    const sow = new Date(today); sow.setDate(today.getDate() - today.getDay());
    return d >= sow;
  }

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const id = restaurant.id_restaurant;
    const [p, m, c, e, pl] = await Promise.allSettled([
      getPedidos(id), getMesas(id), getClientes(id), getEmpleados(id), getPlatillos(id),
    ]);
    if (p.status === 'fulfilled') setPedidos(p.value);
    if (m.status === 'fulfilled') setMesas(m.value);
    if (c.status === 'fulfilled') setClientes(c.value);
    if (e.status === 'fulfilled') setEmpleados(e.value);
    if (pl.status === 'fulfilled') setPlatillos(pl.value.filter(x => x.activo));
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  // Auto-refresh cada 30s
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [restaurant]);

  const handleDrop = async (targetEstado: EstadoPedido) => {
    const p = draggingRef.current;
    if (!p || p.estado_pedido === targetEstado) return;
    draggingRef.current = null;
    setPedidos(prev => prev.map(x => x.id_pedido === p.id_pedido ? { ...x, estado_pedido: targetEstado } : x));
    await updateEstadoPedido(p.id_pedido, targetEstado);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este pedido?')) return;
    await deletePedido(id);
    setPedidos(prev => prev.filter(p => p.id_pedido !== id));
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setPedidos(prev => prev.map(p => p.id_pedido === id ? { ...p, estado_pedido: 'cancelado' } : p));
    await updateEstadoPedido(id, 'cancelado');
  };

  const openCreate = () => {
    setForm({ id_mesa: '', id_cliente: '', id_empleado_restaurante: '' });
    setItems([]);
    setSelectedPlatillo('');
    setError(null);
    setModalOpen(true);
  };

  const addItem = () => {
    const plat = platillos.find(p => p.id_platillo === selectedPlatillo);
    if (!plat) return;
    const exists = items.findIndex(i => i.id_platillo === plat.id_platillo);
    if (exists >= 0) {
      setItems(prev => prev.map((it, idx) => idx === exists ? { ...it, cantidad: it.cantidad + 1 } : it));
    } else {
      setItems(prev => [...prev, { id_platillo: plat.id_platillo, nombre: plat.nombre_platillo, cantidad: 1, precio_unitario: plat.precio }]);
    }
    setSelectedPlatillo('');
  };

  const total = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);

  const handleSave = async () => {
    if (items.length === 0) { setError('Agrega al menos un platillo.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = { id_restaurant: restaurant.id_restaurant, estado_pedido: 'pendiente' as EstadoPedido, id_mesa: form.id_mesa || undefined, id_cliente: form.id_cliente || undefined, id_empleado_restaurante: form.id_empleado_restaurante || undefined };
      const detalles: Omit<DetallePedido, 'id_detalle' | 'id_pedido'>[] = items.map(i => ({ id_platillo: i.id_platillo, cantidad: i.cantidad, precio_unitario: i.precio_unitario }));
      await createPedido(payload, detalles);
      await load();
      setModalOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const pedidosFiltrados = pedidos.filter(p => isInDateRange(p.fecha_pedido, dateFilter));
  const totalPedidos = pedidosFiltrados.length;
  const pendientes = pedidosFiltrados.filter(p => p.estado_pedido === 'pendiente').length;
  const preparando = pedidosFiltrados.filter(p => p.estado_pedido === 'preparando').length;

  const selectCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500";
  const labelCls = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 lg:p-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pedidos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {totalPedidos} pedidos · {pendientes} pendientes · {preparando} en cocina
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
          {(['hoy', 'semana', 'todos'] as const).map(f => (
            <button key={f} onClick={() => setDateFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                dateFilter === f ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
              {f === 'hoy' ? 'Hoy' : f === 'semana' ? 'Esta semana' : 'Todos'}
            </button>
          ))}
        </div>
        <p className="text-slate-400 dark:text-slate-600 text-xs">Arrastra las tarjetas entre columnas para cambiar el estado.</p>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.estado}
              col={col}
              pedidos={pedidosFiltrados.filter(p => p.estado_pedido === col.estado)}
              onDrop={handleDrop}
              onDelete={handleDelete}
              onCancel={handleCancel}
              onDragStart={p => { draggingRef.current = p; }}
            />
          ))}
        </div>
      )}

      {/* Modal nuevo pedido */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo pedido" size="lg">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Mesa</label>
              <select value={form.id_mesa} onChange={e => setForm(f => ({ ...f, id_mesa: e.target.value }))}
                className={selectCls}>
                <option value="">Sin mesa</option>
                {mesas.filter(m => m.estado !== 'reservada').map(m => (
                  <option key={m.id_mesa} value={m.id_mesa}>Mesa {m.numero_mesa} ({m.estado})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cliente</label>
              <select value={form.id_cliente} onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value }))}
                className={selectCls}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} {c.apellido}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Empleado</label>
              <select value={form.id_empleado_restaurante} onChange={e => setForm(f => ({ ...f, id_empleado_restaurante: e.target.value }))}
                className={selectCls}>
                <option value="">Sin asignar</option>
                {empleados.map(e => <option key={e.id_empleado_restaurante} value={e.id_empleado_restaurante}>{e.nombre_empleado} {e.apellido}</option>)}
              </select>
            </div>
          </div>

          {/* Selector POS de platillos */}
          <div>
            <label className={labelCls}>Agregar platillos</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {platillos.map(p => (
                <button
                  key={p.id_platillo}
                  onClick={() => { setSelectedPlatillo(p.id_platillo); }}
                  onDoubleClick={() => {
                    setSelectedPlatillo(p.id_platillo);
                    setTimeout(() => {
                      const plat = platillos.find(x => x.id_platillo === p.id_platillo);
                      if (plat) {
                        const exists = items.findIndex(i => i.id_platillo === plat.id_platillo);
                        if (exists >= 0) {
                          setItems(prev => prev.map((it, idx) => idx === exists ? { ...it, cantidad: it.cantidad + 1 } : it));
                        } else {
                          setItems(prev => [...prev, { id_platillo: plat.id_platillo, nombre: plat.nombre_platillo, cantidad: 1, precio_unitario: plat.precio }]);
                        }
                      }
                    }, 0);
                  }}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                    selectedPlatillo === p.id_platillo
                      ? 'bg-orange-500/15 border-orange-500/50 text-slate-900 dark:text-white'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="font-semibold truncate">{p.nombre_platillo}</div>
                  <div className="text-orange-400 mt-0.5">{fmtCurrency(p.precio)}</div>
                </button>
              ))}
            </div>
            <button
              onClick={addItem}
              disabled={!selectedPlatillo}
              className="mt-2 w-full py-1.5 bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-40 text-orange-400 text-sm font-medium rounded-xl transition-colors border border-orange-500/30"
            >
              + Agregar seleccionado
            </button>
          </div>

          {/* Lista de items */}
          {items.length > 0 && (
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left px-3 py-2 text-slate-500 dark:text-slate-400 font-medium">Platillo</th>
                    <th className="text-center px-3 py-2 text-slate-500 dark:text-slate-400 font-medium w-20">Cant.</th>
                    <th className="text-right px-3 py-2 text-slate-500 dark:text-slate-400 font-medium">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id_platillo} className="border-b border-slate-200 dark:border-slate-700/50 last:border-0">
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{item.nombre}</td>
                      <td className="px-3 py-2">
                        <input type="number" min={1} value={item.cantidad}
                          onChange={e => setItems(prev => prev.map(i => i.id_platillo === item.id_platillo ? { ...i, cantidad: parseInt(e.target.value) || 1 } : i))}
                          className="w-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-slate-900 dark:text-white text-center text-sm focus:outline-none focus:border-orange-500" />
                      </td>
                      <td className="px-3 py-2 text-right text-orange-400 font-medium">{fmtCurrency(item.precio_unitario * item.cantidad)}</td>
                      <td className="px-2 py-2">
                        <button onClick={() => setItems(prev => prev.filter(i => i.id_platillo !== item.id_platillo))} className="text-slate-400 dark:text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <td colSpan={2} className="px-3 py-2 text-slate-500 dark:text-slate-400 text-sm font-semibold">Total</td>
                    <td className="px-3 py-2 text-right text-slate-900 dark:text-white font-bold">{fmtCurrency(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || items.length === 0}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : `Crear pedido · ${fmtCurrency(total)}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
