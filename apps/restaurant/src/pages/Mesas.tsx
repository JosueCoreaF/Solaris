import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Grid3X3, Pencil, Trash2, Clock, Users, ShoppingBag } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Badge, estadoMesaBadge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getMesas, createMesa, updateMesa, deleteMesa, cambiarEstadoMesa } from '../api/mesas';
import { getPedidos } from '../api/pedidos';
import type { Mesa, EstadoMesa, PedidoRestaurante } from '../types';

const emptyForm = { numero_mesa: 1, capacidad: 2, estado: 'disponible' as EstadoMesa };

const estadoConfig: Record<EstadoMesa, { label: string; border: string; bg: string; glow: string; dot: string }> = {
  disponible: { label: 'Disponible', border: 'border-emerald-500/50', bg: 'bg-emerald-500/5',  glow: '#22c55e', dot: 'bg-emerald-400' },
  ocupada:    { label: 'Ocupada',    border: 'border-red-500/50',     bg: 'bg-red-500/5',      glow: '#ef4444', dot: 'bg-red-400'     },
  reservada:  { label: 'Reservada',  border: 'border-amber-500/50',   bg: 'bg-amber-500/5',    glow: '#f59e0b', dot: 'bg-amber-400'   },
};

const estadoTextColors: Record<EstadoMesa, string> = {
  disponible: 'text-emerald-400',
  ocupada:    'text-red-400',
  reservada:  'text-amber-400',
};

function elapsedMin(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
}
function fmtElapsed(min: number): string {
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', maximumFractionDigits: 0 }).format(n);
}

export const Mesas: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<PedidoRestaurante[]>([]);
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
    const id = restaurant.id_restaurant;
    const [m, p] = await Promise.allSettled([getMesas(id), getPedidos(id)]);
    if (m.status === 'fulfilled') setMesas(m.value);
    if (p.status === 'fulfilled') {
      setPedidos(p.value.filter(p => p.estado_pedido === 'pendiente' || p.estado_pedido === 'preparando'));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(null); setModalOpen(true); };

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
    setMesas(prev => prev.map(m => m.id_mesa === id ? { ...m, estado } : m));
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Plano del Salón</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              {counts.disponible} disponibles · {counts.ocupada} ocupadas · {counts.reservada} reservadas
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nueva mesa
        </button>
      </div>

      {/* Leyenda + filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'disponible', 'ocupada', 'reservada'] as const).map(est => {
          const cfg = est !== 'todos' ? estadoConfig[est] : null;
          const count = est === 'todos' ? mesas.length : counts[est];
          return (
            <button
              key={est}
              onClick={() => setFilterEstado(est)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                filterEstado === est
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {cfg && <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />}
              {est === 'todos' ? `Todas (${count})` : `${estadoConfig[est].label} (${count})`}
            </button>
          );
        })}
      </div>

      {/* Grid de mesas */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-slate-400">
          <Grid3X3 className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">Sin mesas para mostrar</p>
          <button onClick={openCreate} className="mt-4 text-orange-400 text-sm hover:text-orange-300">+ Agregar mesa</button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {filtered.map((mesa, i) => {
            const cfg = estadoConfig[mesa.estado];
            const pedidoActivo = pedidos.find(p => p.id_mesa === mesa.id_mesa);
            const min = pedidoActivo ? elapsedMin(pedidoActivo.fecha_pedido) : 0;
            const isLate = min > 20 && mesa.estado === 'ocupada';
            const pedidoTotal = pedidoActivo
              ? (pedidoActivo.detalle_pedido_restaurante ?? []).reduce((s, d) => s + (d.precio_unitario ?? 0) * (d.cantidad ?? 0), 0)
              : 0;
            const numPlatillos = pedidoActivo
              ? (pedidoActivo.detalle_pedido_restaurante ?? []).reduce((s, d) => s + (d.cantidad ?? 0), 0)
              : 0;

            return (
              <motion.div
                key={mesa.id_mesa}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`relative bg-white dark:bg-slate-900 border ${cfg.border} ${cfg.bg} rounded-2xl overflow-hidden group transition-all`}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px 2px ${cfg.glow}20`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                {/* Barra de color superior */}
                <div className="h-1" style={{ background: cfg.glow }} />

                <div className="p-3 space-y-2">
                  {/* Número y capacidad */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{mesa.numero_mesa}</p>
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                        <Users className="w-3 h-3" />
                        {mesa.capacidad}
                      </div>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} style={{ boxShadow: `0 0 6px ${cfg.glow}` }} />
                  </div>

                  {/* Info pedido activo */}
                  {pedidoActivo ? (
                    <div className={`rounded-xl p-2 space-y-1 ${isLate ? 'bg-red-500/10 border border-red-500/20' : 'bg-slate-100 dark:bg-slate-800/60'}`}>
                      <div className={`flex items-center gap-1 text-xs font-semibold ${isLate ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        <Clock className="w-3 h-3" />
                        {fmtElapsed(min)}{isLate ? ' ⚠' : ''}
                      </div>
                      {pedidoActivo.cliente_restaurante && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {pedidoActivo.cliente_restaurante.nombre}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <ShoppingBag className="w-3 h-3" />
                          {numPlatillos} ítem{numPlatillos !== 1 ? 's' : ''}
                        </div>
                        <span className="text-xs font-bold text-orange-400">{fmtCurrency(pedidoTotal)}</span>
                      </div>
                    </div>
                  ) : mesa.estado === 'disponible' ? (
                    <p className="text-xs text-emerald-600 font-medium">Lista para recibir</p>
                  ) : (
                    <p className="text-xs text-amber-600 font-medium">Sin pedido activo</p>
                  )}

                  {/* Cambiar estado rápido */}
                  <div className="flex gap-1 flex-wrap">
                    {(['disponible', 'ocupada', 'reservada'] as EstadoMesa[])
                      .filter(e => e !== mesa.estado)
                      .map(e => (
                        <button
                          key={e}
                          onClick={() => handleCambiarEstado(mesa.id_mesa, e)}
                          className={`text-xs px-1.5 py-0.5 rounded-md border transition-colors ${estadoTextColors[e]} border-current bg-current/5 hover:bg-current/15`}
                        >
                          {estadoConfig[e].label}
                        </button>
                      ))}
                  </div>
                </div>

                {/* Acciones editar/borrar */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(mesa)} className="p-1 text-slate-500 hover:text-orange-400 bg-white/80 dark:bg-slate-800/80 rounded-lg shadow">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDelete(mesa.id_mesa)} className="p-1 text-slate-500 hover:text-red-400 bg-white/80 dark:bg-slate-800/80 rounded-lg shadow">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar mesa' : 'Nueva mesa'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Número de mesa *</label>
            <input
              type="number" min={1} value={form.numero_mesa}
              onChange={e => setForm(f => ({ ...f, numero_mesa: parseInt(e.target.value) || 1 }))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Capacidad *</label>
            <input
              type="number" min={1} value={form.capacidad}
              onChange={e => setForm(f => ({ ...f, capacidad: parseInt(e.target.value) || 1 }))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Estado</label>
            <select
              value={form.estado}
              onChange={e => setForm(f => ({ ...f, estado: e.target.value as EstadoMesa }))}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500"
            >
              <option value="disponible">Disponible</option>
              <option value="ocupada">Ocupada</option>
              <option value="reservada">Reservada</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-2">
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
