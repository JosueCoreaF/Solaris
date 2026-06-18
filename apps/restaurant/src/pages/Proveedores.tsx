import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Truck, Pencil, Trash2, Search, ShoppingCart, Eye, X } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import {
  getProveedores, createProveedor, updateProveedor, deleteProveedor,
  getCompras, createCompra, getDetalleCompra, createDetalleCompra, deleteDetalleCompra,
} from '../api/proveedores';
import { getProductos } from '../api/inventario';
import type { Proveedor, Compra, DetalleCompra, ProductoInventario } from '../types';

type Vista = 'proveedores' | 'compras';

const emptyProvForm = { nombre_proveedor: '', contacto: '', telefono: '', correo: '', direccion: '' };
const emptyCompraForm = { id_proveedor: '', fecha_compra: '', subtotal: 0, isv: 0, estado_pago: 'pendiente' as const };

export const Proveedores: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [vista, setVista] = useState<Vista>('proveedores');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal proveedor
  const [modalProvOpen, setModalProvOpen] = useState(false);
  const [editingProv, setEditingProv] = useState<Proveedor | null>(null);
  const [formProv, setFormProv] = useState(emptyProvForm);

  // Modal compra
  const [modalCompraOpen, setModalCompraOpen] = useState(false);
  const [formCompra, setFormCompra] = useState(emptyCompraForm);

  // Modal detalle compra
  const [detalleCompra, setDetalleCompra] = useState<DetalleCompra[]>([]);
  const [detalleCompraOpen, setDetalleCompraOpen] = useState<Compra | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [detalleForm, setDetalleForm] = useState({ id_producto: '', cantidad: 1, precio_unitario: 0 });
  const [savingDetalle, setSavingDetalle] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const id = restaurant.id_restaurant;
    const [p, c, pr] = await Promise.all([getProveedores(id), getCompras(id), getProductos(id)]);
    setProveedores(p);
    setCompras(c);
    setProductos(pr);
    setLoading(false);
  };

  const openDetalleCompra = async (c: Compra) => {
    setDetalleCompraOpen(c);
    setLoadingDetalle(true);
    const d = await getDetalleCompra(c.id_compra);
    setDetalleCompra(d as any);
    setLoadingDetalle(false);
    setDetalleForm({ id_producto: '', cantidad: 1, precio_unitario: 0 });
  };

  const handleAddDetalle = async () => {
    if (!detalleCompraOpen || !detalleForm.id_producto) return;
    setSavingDetalle(true);
    try {
      const subtotal = detalleForm.cantidad * detalleForm.precio_unitario;
      await createDetalleCompra({ id_compra: detalleCompraOpen.id_compra, ...detalleForm, subtotal });
      const d = await getDetalleCompra(detalleCompraOpen.id_compra);
      setDetalleCompra(d as any);
      setDetalleForm({ id_producto: '', cantidad: 1, precio_unitario: 0 });
    } catch (e: any) { alert(e.message ?? 'Error.'); } finally { setSavingDetalle(false); }
  };

  const handleDeleteDetalle = async (id: string) => {
    await deleteDetalleCompra(id);
    if (detalleCompraOpen) {
      const d = await getDetalleCompra(detalleCompraOpen.id_compra);
      setDetalleCompra(d as any);
    }
  };

  useEffect(() => { load(); }, [restaurant]);

  // ── Proveedor CRUD ───────────────────────────────────────────────────────
  const openCreateProv = () => {
    setEditingProv(null);
    setFormProv(emptyProvForm);
    setError(null);
    setModalProvOpen(true);
  };

  const openEditProv = (p: Proveedor) => {
    setEditingProv(p);
    setFormProv({
      nombre_proveedor: p.nombre_proveedor,
      contacto: p.contacto ?? '',
      telefono: p.telefono ?? '',
      correo: p.correo ?? '',
      direccion: p.direccion ?? '',
    });
    setError(null);
    setModalProvOpen(true);
  };

  const handleSaveProv = async () => {
    if (!formProv.nombre_proveedor.trim()) { setError('El nombre del proveedor es requerido.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = { ...formProv, id_restaurant: restaurant.id_restaurant };
      if (editingProv) {
        await updateProveedor(editingProv.id_proveedor, payload);
      } else {
        await createProveedor(payload);
      }
      await load();
      setModalProvOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProv = async (id: string) => {
    if (!confirm('¿Eliminar este proveedor?')) return;
    await deleteProveedor(id);
    await load();
  };

  // ── Compra ───────────────────────────────────────────────────────────────
  const openCreateCompra = () => {
    setFormCompra({ ...emptyCompraForm, fecha_compra: new Date().toISOString().split('T')[0] });
    setError(null);
    setModalCompraOpen(true);
  };

  const handleSaveCompra = async () => {
    if (!formCompra.id_proveedor) { setError('Selecciona un proveedor.'); return; }
    if (!formCompra.fecha_compra) { setError('La fecha es requerida.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      await createCompra({
        ...formCompra,
        total: formCompra.subtotal + formCompra.isv,
        id_restaurant: restaurant.id_restaurant,
        id_proveedor: formCompra.id_proveedor || undefined,
      });
      await load();
      setModalCompraOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  const filteredProv = proveedores.filter(p =>
    p.nombre_proveedor.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredCompras = compras.filter(c =>
    (c.proveedor?.nombre_proveedor ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Truck className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Proveedores</h1>
            <p className="text-slate-400 text-xs">{proveedores.length} proveedores · {compras.length} compras</p>
          </div>
        </div>
        <div className="flex gap-2">
          {vista === 'compras' && (
            <button
              onClick={openCreateCompra}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-4 py-2 rounded-xl transition-colors border border-slate-700"
            >
              <ShoppingCart className="w-4 h-4" /> Nueva compra
            </button>
          )}
          <button
            onClick={openCreateProv}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
          >
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['proveedores', 'compras'] as Vista[]).map(v => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              vista === v ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar ${vista}...`}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      {/* Tables */}
      <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {vista === 'proveedores' ? (
          <Table
            data={filteredProv}
            keyExtractor={p => p.id_proveedor}
            loading={loading}
            emptyMessage="Sin proveedores registrados."
            columns={[
              { key: 'nombre_proveedor', header: 'Nombre', render: p => <span className="font-medium text-slate-900 dark:text-white">{p.nombre_proveedor}</span> },
              { key: 'contacto', header: 'Contacto', render: p => p.contacto ?? <span className="text-slate-600">—</span> },
              { key: 'telefono', header: 'Teléfono', render: p => p.telefono ?? <span className="text-slate-600">—</span> },
              { key: 'correo', header: 'Correo', render: p => p.correo ?? <span className="text-slate-600">—</span> },
              {
                key: 'acciones', header: 'Acciones',
                render: p => (
                  <div className="flex gap-1">
                    <button onClick={() => openEditProv(p)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteProv(p.id_proveedor)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Table
            data={filteredCompras}
            keyExtractor={c => c.id_compra}
            loading={loading}
            emptyMessage="Sin compras registradas."
            columns={[
              { key: 'proveedor', header: 'Proveedor', render: c => c.proveedor?.nombre_proveedor ?? <span className="text-slate-600">—</span> },
              {
                key: 'fecha_compra', header: 'Fecha',
                render: c => new Date(c.fecha_compra.replace(' ', 'T')).toLocaleDateString('es-HN'),
              },
              { key: 'total', header: 'Total', render: c => <span className="font-semibold text-orange-400">{fmtCurrency(c.total)}</span> },
              {
                key: 'estado_pago', header: 'Estado',
                render: c => (
                  <Badge variant={c.estado_pago === 'pagado' ? 'success' : c.estado_pago === 'abono' ? 'orange' : 'warning'}>
                    {c.estado_pago.charAt(0).toUpperCase() + c.estado_pago.slice(1)}
                  </Badge>
                ),
              },
              {
                key: 'acciones', header: 'Detalle',
                render: c => (
                  <button onClick={() => openDetalleCompra(c)}
                    className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 hover:border-orange-500/60 px-2 py-1 rounded-lg transition-colors">
                    <Eye className="w-3.5 h-3.5" /> Ver ítems
                  </button>
                ),
              },
            ]}
          />
        )}
      </motion.div>

      {/* Modal proveedor */}
      <Modal open={modalProvOpen} onClose={() => setModalProvOpen(false)} title={editingProv ? 'Editar proveedor' : 'Nuevo proveedor'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
            <input value={formProv.nombre_proveedor} onChange={e => setFormProv(f => ({ ...f, nombre_proveedor: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Contacto</label>
              <input value={formProv.contacto} onChange={e => setFormProv(f => ({ ...f, contacto: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono</label>
              <input value={formProv.telefono} onChange={e => setFormProv(f => ({ ...f, telefono: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Correo</label>
            <input type="email" value={formProv.correo} onChange={e => setFormProv(f => ({ ...f, correo: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Dirección</label>
            <input value={formProv.direccion} onChange={e => setFormProv(f => ({ ...f, direccion: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalProvOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSaveProv} disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal nueva compra */}
      <Modal open={modalCompraOpen} onClose={() => setModalCompraOpen(false)} title="Nueva compra" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Proveedor *</label>
            <select value={formCompra.id_proveedor} onChange={e => setFormCompra(f => ({ ...f, id_proveedor: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="">Selecciona un proveedor...</option>
              {proveedores.map(p => <option key={p.id_proveedor} value={p.id_proveedor}>{p.nombre_proveedor}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Fecha *</label>
            <input type="date" value={formCompra.fecha_compra}
              onChange={e => setFormCompra(f => ({ ...f, fecha_compra: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Subtotal (HNL)</label>
              <input type="number" min={0} step={0.01} value={formCompra.subtotal}
                onChange={e => setFormCompra(f => ({ ...f, subtotal: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">ISV (HNL)</label>
              <input type="number" min={0} step={0.01} value={formCompra.isv}
                onChange={e => setFormCompra(f => ({ ...f, isv: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div className="text-sm text-slate-400">
            Total: <span className="text-slate-900 dark:text-white font-semibold">{fmtCurrency(formCompra.subtotal + formCompra.isv)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Estado de pago</label>
            <select value={formCompra.estado_pago} onChange={e => setFormCompra(f => ({ ...f, estado_pago: e.target.value as typeof emptyCompraForm.estado_pago }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="pendiente">Pendiente</option>
              <option value="abono">Abono</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalCompraOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSaveCompra} disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : 'Registrar compra'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal detalle compra */}
      {detalleCompraOpen && (
        <Modal open={!!detalleCompraOpen} onClose={() => setDetalleCompraOpen(null)} title={`Detalle — Compra #${detalleCompraOpen.id_compra}`}>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              {detalleCompraOpen.proveedor?.nombre_proveedor} · {new Date(detalleCompraOpen.fecha_compra.replace(' ', 'T')).toLocaleDateString('es-HN')}
            </p>

            {loadingDetalle ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-1">
                {detalleCompra.length === 0
                  ? <p className="text-slate-500 text-sm text-center py-4">Sin ítems registrados.</p>
                  : detalleCompra.map((d: any) => (
                    <div key={d.id_detalle_compra} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2 text-sm">
                      <span className="flex-1 text-slate-200">{d.producto?.nombre_producto ?? `Producto #${d.id_producto}`}</span>
                      <span className="text-slate-400">{d.cantidad} × {fmtCurrency(d.precio_unitario)}</span>
                      <span className="text-orange-400 font-semibold">{fmtCurrency(d.subtotal)}</span>
                      <button onClick={() => handleDeleteDetalle(d.id_detalle_compra)} className="p-1 text-slate-600 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))
                }
              </div>
            )}

            <div className="border-t border-slate-800 pt-3">
              <p className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wide">Agregar ítem</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <select value={detalleForm.id_producto} onChange={e => {
                    const p = productos.find(pr => String(pr.id_producto) === e.target.value);
                    setDetalleForm(f => ({ ...f, id_producto: e.target.value, precio_unitario: p?.precio ?? 0 }));
                  }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500">
                    <option value="">Seleccionar producto...</option>
                    {productos.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre_producto}</option>)}
                  </select>
                </div>
                <div className="w-16">
                  <input type="number" min={1} step={0.01} value={detalleForm.cantidad}
                    onChange={e => setDetalleForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 1 }))}
                    placeholder="Cant."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500" />
                </div>
                <div className="w-24">
                  <input type="number" min={0} step={0.01} value={detalleForm.precio_unitario}
                    onChange={e => setDetalleForm(f => ({ ...f, precio_unitario: parseFloat(e.target.value) || 0 }))}
                    placeholder="Precio"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500" />
                </div>
                <button onClick={handleAddDetalle} disabled={savingDetalle || !detalleForm.id_producto}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                  {savingDetalle ? '...' : 'Añadir'}
                </button>
              </div>
            </div>

            <button onClick={() => setDetalleCompraOpen(null)} className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
