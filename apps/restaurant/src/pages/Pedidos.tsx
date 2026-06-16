import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ShoppingBag, RefreshCw, Trash2, ChevronDown } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge, estadoPedidoBadge } from '../components/Badge';
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

type FiltroEstado = EstadoPedido | 'todos';

const estadoLabels: Record<EstadoPedido, string> = {
  pendiente:  'Pendiente',
  preparando: 'Preparando',
  servido:    'Servido',
  cancelado:  'Cancelado',
};

const estadoSiguiente: Partial<Record<EstadoPedido, EstadoPedido>> = {
  pendiente:  'preparando',
  preparando: 'servido',
};

interface ItemDetalle {
  id_platillo: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export const Pedidos: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [pedidos, setPedidos] = useState<PedidoRestaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<FiltroEstado>('todos');

  // Datos para el formulario
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [clientes, setClientes] = useState<ClienteRestaurante[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoRestaurante[]>([]);
  const [platillos, setPlatillos] = useState<Platillo[]>([]);

  // Modal nuevo pedido
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    id_mesa: '',
    id_cliente: '',
    id_empleado_restaurante: '',
  });
  const [items, setItems] = useState<ItemDetalle[]>([]);
  const [selectedPlatillo, setSelectedPlatillo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const id = restaurant.id_restaurant;
    const [p, m, c, e, pl] = await Promise.allSettled([
      getPedidos(id),
      getMesas(id),
      getClientes(id),
      getEmpleados(id),
      getPlatillos(id),
    ]);
    if (p.status === 'fulfilled') setPedidos(p.value);
    if (m.status === 'fulfilled') setMesas(m.value);
    if (c.status === 'fulfilled') setClientes(c.value);
    if (e.status === 'fulfilled') setEmpleados(e.value);
    if (pl.status === 'fulfilled') setPlatillos(pl.value.filter(x => x.activo));
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

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
      setItems(prev => prev.map((it, idx) =>
        idx === exists ? { ...it, cantidad: it.cantidad + 1 } : it,
      ));
    } else {
      setItems(prev => [...prev, {
        id_platillo: plat.id_platillo,
        nombre: plat.nombre_platillo,
        cantidad: 1,
        precio_unitario: plat.precio,
      }]);
    }
    setSelectedPlatillo('');
  };

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id_platillo !== id));

  const updateCantidad = (id: string, cant: number) =>
    setItems(prev => prev.map(i => i.id_platillo === id ? { ...i, cantidad: Math.max(1, cant) } : i));

  const total = items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  const handleSave = async () => {
    if (items.length === 0) { setError('Agrega al menos un platillo.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = {
        id_restaurant: restaurant.id_restaurant,
        estado_pedido: 'pendiente' as EstadoPedido,
        id_mesa: form.id_mesa || undefined,
        id_cliente: form.id_cliente || undefined,
        id_empleado_restaurante: form.id_empleado_restaurante || undefined,
      };
      const detalles: Omit<DetallePedido, 'id_detalle' | 'id_pedido'>[] = items.map(i => ({
        id_platillo: i.id_platillo,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
      }));
      await createPedido(payload, detalles);
      await load();
      setModalOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvanzarEstado = async (pedido: PedidoRestaurante) => {
    const siguiente = estadoSiguiente[pedido.estado_pedido];
    if (!siguiente) return;
    await updateEstadoPedido(pedido.id_pedido, siguiente);
    await load();
  };

  const handleCancelar = async (id: string) => {
    if (!confirm('¿Cancelar este pedido?')) return;
    await updateEstadoPedido(id, 'cancelado');
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este pedido permanentemente?')) return;
    await deletePedido(id);
    await load();
  };

  const filtered = filtro === 'todos'
    ? pedidos
    : pedidos.filter(p => p.estado_pedido === filtro);

  const counts: Record<FiltroEstado, number> = {
    todos:      pedidos.length,
    pendiente:  pedidos.filter(p => p.estado_pedido === 'pendiente').length,
    preparando: pedidos.filter(p => p.estado_pedido === 'preparando').length,
    servido:    pedidos.filter(p => p.estado_pedido === 'servido').length,
    cancelado:  pedidos.filter(p => p.estado_pedido === 'cancelado').length,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Pedidos</h1>
            <p className="text-slate-400 text-xs">{pedidos.length} pedidos registrados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'pendiente', 'preparando', 'servido', 'cancelado'] as FiltroEstado[]).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              filtro === f
                ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {f === 'todos' ? `Todos (${counts.todos})` : `${estadoLabels[f]} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={p => p.id_pedido}
          loading={loading}
          emptyMessage="Sin pedidos para el filtro seleccionado."
          columns={[
            {
              key: 'cliente', header: 'Cliente',
              render: p => p.cliente_restaurante
                ? `${p.cliente_restaurante.nombre} ${p.cliente_restaurante.apellido}`
                : <span className="text-slate-600">Sin cliente</span>,
            },
            {
              key: 'mesa', header: 'Mesa',
              render: p => p.mesa_restaurante
                ? <span className="font-medium">Mesa {p.mesa_restaurante.numero_mesa}</span>
                : <span className="text-slate-600">—</span>,
            },
            {
              key: 'items', header: 'Platillos',
              render: p => {
                const count = p.detalle_pedido_restaurante?.length ?? 0;
                return <span className="text-slate-300">{count} {count === 1 ? 'item' : 'items'}</span>;
              },
            },
            {
              key: 'estado', header: 'Estado',
              render: p => <Badge variant={estadoPedidoBadge(p.estado_pedido)}>{estadoLabels[p.estado_pedido]}</Badge>,
            },
            {
              key: 'hora', header: 'Hora',
              render: p => new Date(p.fecha_pedido).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }),
            },
            {
              key: 'acciones', header: 'Acciones',
              render: p => (
                <div className="flex gap-1">
                  {estadoSiguiente[p.estado_pedido] && (
                    <button
                      onClick={() => handleAvanzarEstado(p)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg transition-colors"
                    >
                      <ChevronDown className="w-3 h-3 rotate-[-90deg]" />
                      {estadoLabels[estadoSiguiente[p.estado_pedido]!]}
                    </button>
                  )}
                  {p.estado_pedido !== 'cancelado' && p.estado_pedido !== 'servido' && (
                    <button
                      onClick={() => handleCancelar(p.id_pedido)}
                      className="px-2 py-1 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button onClick={() => handleDelete(p.id_pedido)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      {/* Modal nuevo pedido */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo pedido" size="lg">
        <div className="space-y-5">
          {/* Selects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Mesa</label>
              <select
                value={form.id_mesa}
                onChange={e => setForm(f => ({ ...f, id_mesa: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Sin mesa</option>
                {mesas.filter(m => m.estado !== 'reservada').map(m => (
                  <option key={m.id_mesa} value={m.id_mesa}>Mesa {m.numero_mesa} ({m.estado})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Cliente</label>
              <select
                value={form.id_cliente}
                onChange={e => setForm(f => ({ ...f, id_cliente: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Sin cliente</option>
                {clientes.map(c => (
                  <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} {c.apellido}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Empleado</label>
              <select
                value={form.id_empleado_restaurante}
                onChange={e => setForm(f => ({ ...f, id_empleado_restaurante: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Sin asignar</option>
                {empleados.map(e => (
                  <option key={e.id_empleado_restaurante} value={e.id_empleado_restaurante}>{e.nombre_empleado} {e.apellido}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Agregar platillos */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Agregar platillo</label>
            <div className="flex gap-2">
              <select
                value={selectedPlatillo}
                onChange={e => setSelectedPlatillo(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              >
                <option value="">Selecciona un platillo...</option>
                {platillos.map(p => (
                  <option key={p.id_platillo} value={p.id_platillo}>
                    {p.nombre_platillo} — {fmtCurrency(p.precio)}
                  </option>
                ))}
              </select>
              <button
                onClick={addItem}
                disabled={!selectedPlatillo}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de items */}
          {items.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Platillo</th>
                    <th className="text-center px-3 py-2 text-slate-400 font-medium w-24">Cant.</th>
                    <th className="text-right px-3 py-2 text-slate-400 font-medium">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id_platillo} className="border-b border-slate-700/50 last:border-0">
                      <td className="px-3 py-2 text-slate-200">{item.nombre}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={item.cantidad}
                          onChange={e => updateCantidad(item.id_platillo, parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white text-center text-sm focus:outline-none focus:border-orange-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-orange-400 font-medium">
                        {fmtCurrency(item.precio_unitario * item.cantidad)}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeItem(item.id_platillo)} className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800/50">
                    <td colSpan={2} className="px-3 py-2 text-slate-400 text-sm font-semibold">Total</td>
                    <td className="px-3 py-2 text-right text-white font-bold">{fmtCurrency(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || items.length === 0}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? 'Guardando...' : `Crear pedido — ${fmtCurrency(total)}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
