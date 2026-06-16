import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Receipt, Trash2, Eye, X, Search } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import { getFacturas, createFactura, deleteFactura } from '../api/facturas';
import { getPlatillos } from '../api/platillos';
import { getProductos } from '../api/inventario';
import type { FacturaRestaurante, DetalleFactura, Platillo, ProductoInventario } from '../types';

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';

interface LineaForm {
  tipo_item: 'platillo' | 'producto';
  id_ref: string;
  cantidad: number;
  precio_unitario: number;
}

const emptyLinea = (): LineaForm => ({ tipo_item: 'platillo', id_ref: '', cantidad: 1, precio_unitario: 0 });

export const Facturas: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [facturas, setFacturas] = useState<FacturaRestaurante[]>([]);
  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [viewFactura, setViewFactura] = useState<FacturaRestaurante | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo');
  const [isv, setIsv] = useState(15);
  const [lineas, setLineas] = useState<LineaForm[]>([emptyLinea()]);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const [f, p, pr] = await Promise.all([
      getFacturas(restaurant.id_restaurant),
      getPlatillos(restaurant.id_restaurant),
      getProductos(restaurant.id_restaurant),
    ]);
    setFacturas(f);
    setPlatillos(p);
    setProductos(pr);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreate = () => {
    setFecha(new Date().toISOString().split('T')[0]);
    setMetodoPago('efectivo');
    setIsv(15);
    setLineas([emptyLinea()]);
    setError(null);
    setModalOpen(true);
  };

  const addLinea = () => setLineas(l => [...l, emptyLinea()]);

  const updateLinea = (idx: number, patch: Partial<LineaForm>) => {
    setLineas(l => l.map((ln, i) => {
      if (i !== idx) return ln;
      const updated = { ...ln, ...patch };
      if (patch.tipo_item || patch.id_ref) {
        const ref = (updated.tipo_item === 'platillo'
          ? platillos.find(p => String(p.id_platillo) === updated.id_ref)
          : productos.find(p => String(p.id_producto) === updated.id_ref));
        if (ref) updated.precio_unitario = (ref as any).precio;
      }
      return updated;
    }));
  };

  const removeLinea = (idx: number) => setLineas(l => l.filter((_, i) => i !== idx));

  const subtotalCalc = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  const isvCalc = subtotalCalc * (isv / 100);
  const totalCalc = subtotalCalc + isvCalc;

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  const handleSave = async () => {
    if (!restaurant) return;
    if (lineas.some(l => !l.id_ref)) { setError('Selecciona el ítem para cada línea.'); return; }
    if (lineas.some(l => l.cantidad <= 0)) { setError('La cantidad debe ser mayor a 0.'); return; }
    setSaving(true);
    try {
      const detalles: Omit<DetalleFactura, 'id_detalle_factura' | 'id_factura' | 'platillo' | 'producto'>[] = lineas.map(l => ({
        tipo_item: l.tipo_item,
        id_platillo: l.tipo_item === 'platillo' ? l.id_ref : undefined,
        id_producto: l.tipo_item === 'producto' ? l.id_ref : undefined,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.cantidad * l.precio_unitario,
      }));
      await createFactura(
        { id_restaurant: restaurant.id_restaurant, fecha, subtotal: subtotalCalc, isv: isvCalc, total: totalCalc, metodo_pago: metodoPago },
        detalles,
      );
      await load();
      setModalOpen(false);
    } catch (e: any) {
      setError(e.message ?? 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta factura y su detalle?')) return;
    await deleteFactura(id);
    await load();
  };

  const filtered = facturas.filter(f =>
    (f.metodo_pago ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Receipt className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Facturas</h1>
            <p className="text-slate-400 text-xs">{facturas.length} facturas emitidas</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-4 h-4" /> Nueva factura
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por método de pago..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
        />
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Table
          data={filtered}
          keyExtractor={f => f.id_factura}
          loading={loading}
          emptyMessage="Sin facturas emitidas."
          columns={[
            {
              key: 'fecha', header: 'Fecha',
              render: f => f.fecha
                ? new Date(f.fecha.replace(' ', 'T')).toLocaleDateString('es-HN')
                : <span className="text-slate-600">—</span>,
            },
            {
              key: 'metodo_pago', header: 'Método de pago',
              render: f => <Badge variant="neutral">{f.metodo_pago.charAt(0).toUpperCase() + f.metodo_pago.slice(1)}</Badge>,
            },
            { key: 'subtotal', header: 'Subtotal', render: f => fmtCurrency(f.subtotal) },
            { key: 'isv', header: 'ISV', render: f => <span className="text-slate-400">{fmtCurrency(f.isv)}</span> },
            { key: 'total', header: 'Total', render: f => <span className="font-semibold text-orange-400">{fmtCurrency(f.total)}</span> },
            {
              key: 'acciones', header: 'Acciones',
              render: f => (
                <div className="flex gap-1">
                  <button onClick={() => setViewFactura(f)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(f.id_factura)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </motion.div>

      {/* Modal nueva factura */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva factura">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Método de pago</label>
              <select value={metodoPago} onChange={e => setMetodoPago(e.target.value as MetodoPago)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">ISV (%)</label>
            <input type="number" min={0} max={100} value={isv} onChange={e => setIsv(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>

          {/* Líneas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-300">Ítems</span>
              <button onClick={addLinea} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar línea
              </button>
            </div>
            <div className="space-y-2">
              {lineas.map((ln, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-shrink-0 w-28">
                    <select value={ln.tipo_item} onChange={e => updateLinea(idx, { tipo_item: e.target.value as any, id_ref: '', precio_unitario: 0 })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500">
                      <option value="platillo">Platillo</option>
                      <option value="producto">Producto</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <select value={ln.id_ref} onChange={e => updateLinea(idx, { id_ref: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500">
                      <option value="">Seleccionar...</option>
                      {(ln.tipo_item === 'platillo' ? platillos : productos).map((p: any) => (
                        <option key={p.id_platillo ?? p.id_producto} value={p.id_platillo ?? p.id_producto}>
                          {p.nombre_platillo ?? p.nombre_producto}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-16">
                    <input type="number" min={1} value={ln.cantidad} onChange={e => updateLinea(idx, { cantidad: parseInt(e.target.value) || 1 })}
                      placeholder="Cant."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500" />
                  </div>
                  <div className="w-24">
                    <input type="number" min={0} step={0.01} value={ln.precio_unitario} onChange={e => updateLinea(idx, { precio_unitario: parseFloat(e.target.value) || 0 })}
                      placeholder="Precio"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500" />
                  </div>
                  <div className="w-24 text-right text-xs text-slate-400 py-1.5">
                    {fmtCurrency(ln.cantidad * ln.precio_unitario)}
                  </div>
                  {lineas.length > 1 && (
                    <button onClick={() => removeLinea(idx)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totales */}
          <div className="bg-slate-800/50 rounded-xl p-3 space-y-1 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmtCurrency(subtotalCalc)}</span></div>
            <div className="flex justify-between text-slate-400"><span>ISV ({isv}%)</span><span>{fmtCurrency(isvCalc)}</span></div>
            <div className="flex justify-between text-white font-semibold border-t border-slate-700 pt-1 mt-1"><span>Total</span><span className="text-orange-400">{fmtCurrency(totalCalc)}</span></div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : 'Emitir factura'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal ver detalle */}
      {viewFactura && (
        <Modal open={!!viewFactura} onClose={() => setViewFactura(null)} title={`Factura #${viewFactura.id_factura}`} size="sm">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-400 block">Fecha</span>
                <span className="text-white font-medium">
                  {viewFactura.fecha ? new Date(viewFactura.fecha.replace(' ', 'T')).toLocaleDateString('es-HN') : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Método de pago</span>
                <span className="text-white font-medium capitalize">{viewFactura.metodo_pago}</span>
              </div>
            </div>

            {(viewFactura.detalle_factura ?? []).length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Detalle</p>
                <div className="space-y-1">
                  {viewFactura.detalle_factura!.map(d => (
                    <div key={d.id_detalle_factura} className="flex justify-between text-sm bg-slate-800/50 rounded-lg px-3 py-2">
                      <span className="text-slate-300">
                        {d.platillo?.nombre_platillo ?? d.producto?.nombre_producto ?? '—'} × {d.cantidad}
                      </span>
                      <span className="text-orange-400 font-medium">{fmtCurrency(d.subtotal)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-800/50 rounded-xl p-3 space-y-1 text-sm">
              <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{fmtCurrency(viewFactura.subtotal)}</span></div>
              <div className="flex justify-between text-slate-400"><span>ISV</span><span>{fmtCurrency(viewFactura.isv)}</span></div>
              <div className="flex justify-between text-white font-semibold border-t border-slate-700 pt-1 mt-1"><span>Total</span><span className="text-orange-400">{fmtCurrency(viewFactura.total)}</span></div>
            </div>

            <button onClick={() => setViewFactura(null)} className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
