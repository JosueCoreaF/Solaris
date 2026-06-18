import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Package, Pencil, Trash2, Search, AlertTriangle, BarChart2, ChefHat } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import {
  getProductos, createProducto, updateProducto, deleteProducto, getCategoriasInventario,
  getInventarioStock, upsertInventarioStock,
  getRecetasPlatillo, createRecetaItem, deleteRecetaItem,
} from '../api/inventario';
import { getPlatillos } from '../api/platillos';
import type { ProductoInventario, CategoriaInventario, InventarioStock, RecetaPlatillo, Platillo } from '../types';

type Vista = 'productos' | 'stock' | 'recetas';
const STOCK_BAJO_THRESHOLD = 10;

const emptyForm = { nombre_producto: '', precio: 0, cantidad: 0, fecha_vencimiento: '', id_categoria: '' };
const emptyStockForm = { stock_actual: 0, stock_minimo: 0 };

export const Inventario: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [vista, setVista] = useState<Vista>('productos');

  const [productos, setProductos] = useState<ProductoInventario[]>([]);
  const [categorias, setCategorias] = useState<CategoriaInventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductoInventario | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stockItems, setStockItems] = useState<InventarioStock[]>([]);
  const [stockModal, setStockModal] = useState<ProductoInventario | null>(null);
  const [stockForm, setStockForm] = useState(emptyStockForm);
  const [savingStock, setSavingStock] = useState(false);

  const [platillos, setPlatillos] = useState<Platillo[]>([]);
  const [selectedPlatillo, setSelectedPlatillo] = useState('');
  const [recetas, setRecetas] = useState<RecetaPlatillo[]>([]);
  const [loadingRecetas, setLoadingRecetas] = useState(false);
  const [recetaModal, setRecetaModal] = useState(false);
  const [recetaForm, setRecetaForm] = useState({ id_inventario: '', cantidad_utilizada: 1 });
  const [savingReceta, setSavingReceta] = useState(false);
  const [errorReceta, setErrorReceta] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const [p, c, s, pl] = await Promise.all([
      getProductos(restaurant.id_restaurant),
      getCategoriasInventario(),
      getInventarioStock(restaurant.id_restaurant),
      getPlatillos(restaurant.id_restaurant),
    ]);
    setProductos(p);
    setCategorias(c);
    setStockItems(s as any);
    setPlatillos(pl);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const loadRecetas = async (idPlatillo: string) => {
    setLoadingRecetas(true);
    const r = await getRecetasPlatillo(idPlatillo);
    setRecetas(r as any);
    setLoadingRecetas(false);
  };

  useEffect(() => {
    if (selectedPlatillo) loadRecetas(selectedPlatillo);
    else setRecetas([]);
  }, [selectedPlatillo]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setError(null); setModalOpen(true); };
  const openEdit = (p: ProductoInventario) => {
    setEditing(p);
    setForm({ nombre_producto: p.nombre_producto, precio: p.precio, cantidad: p.cantidad, fecha_vencimiento: p.fecha_vencimiento ?? '', id_categoria: p.id_categoria ?? '' });
    setError(null); setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.nombre_producto.trim()) { setError('El nombre del producto es requerido.'); return; }
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload = { ...form, fecha_vencimiento: form.fecha_vencimiento || undefined, id_restaurant: restaurant.id_restaurant, id_categoria: form.id_categoria || undefined };
      if (editing) { await updateProducto(editing.id_producto, payload); }
      else { await createProducto(payload as any); }
      await load(); setModalOpen(false);
    } catch (e: any) { setError(e.message ?? 'Error al guardar.'); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await deleteProducto(id); await load();
  };

  const openStockModal = (p: ProductoInventario) => {
    const existing = stockItems.find((s: any) => String(s.id_producto) === String(p.id_producto)) as any;
    setStockForm({ stock_actual: existing?.stock_actual ?? 0, stock_minimo: existing?.stock_minimo ?? 0 });
    setStockModal(p);
  };

  const handleSaveStock = async () => {
    if (!stockModal) return;
    setSavingStock(true);
    try {
      await upsertInventarioStock(stockModal.id_producto, stockForm.stock_actual, stockForm.stock_minimo);
      await load(); setStockModal(null);
    } catch (e: any) { alert(e.message ?? 'Error.'); } finally { setSavingStock(false); }
  };

  const handleAddReceta = async () => {
    if (!recetaForm.id_inventario || !selectedPlatillo) { setErrorReceta('Selecciona un ingrediente.'); return; }
    if (recetaForm.cantidad_utilizada <= 0) { setErrorReceta('La cantidad debe ser mayor a 0.'); return; }
    setSavingReceta(true);
    try {
      await createRecetaItem({ id_platillo: selectedPlatillo, id_inventario: recetaForm.id_inventario, cantidad_utilizada: recetaForm.cantidad_utilizada });
      await loadRecetas(selectedPlatillo);
      setRecetaModal(false); setRecetaForm({ id_inventario: '', cantidad_utilizada: 1 }); setErrorReceta(null);
    } catch (e: any) { setErrorReceta(e.message ?? 'Error.'); } finally { setSavingReceta(false); }
  };

  const handleDeleteReceta = async (id: string) => {
    if (!confirm('¿Eliminar este ingrediente?')) return;
    await deleteRecetaItem(id);
    if (selectedPlatillo) await loadRecetas(selectedPlatillo);
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  const conAlerta = productos.filter(p => p.cantidad <= STOCK_BAJO_THRESHOLD);
  const filtered = productos
    .filter(p => !soloAlertas || p.cantidad <= STOCK_BAJO_THRESHOLD)
    .filter(p => p.nombre_producto.toLowerCase().includes(search.toLowerCase()));

  const inputCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500";
  const labelCls = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Inventario</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{productos.length} productos · {stockItems.length} con control de stock</p>
          </div>
        </div>
        {vista === 'productos' && (
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        )}
        {vista === 'recetas' && selectedPlatillo && (
          <button onClick={() => { setRecetaForm({ id_inventario: '', cantidad_utilizada: 1 }); setErrorReceta(null); setRecetaModal(true); }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
            <Plus className="w-4 h-4" /> Agregar ingrediente
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
        {([
          { key: 'productos', label: 'Productos', Icon: Package },
          { key: 'stock', label: 'Stock', Icon: BarChart2 },
          { key: 'recetas', label: 'Recetas', Icon: ChefHat },
        ] as const).map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setVista(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              vista === key ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {vista === 'productos' && (
          <>
            {conAlerta.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-amber-400 text-sm">
                  <span className="font-semibold">{conAlerta.length} producto{conAlerta.length > 1 ? 's' : ''}</span> con stock bajo o agotado.
                </p>
                <button onClick={() => setSoloAlertas(v => !v)}
                  className="ml-auto text-xs text-amber-400 hover:text-amber-300 border border-amber-500/40 px-2 py-1 rounded-lg transition-colors">
                  {soloAlertas ? 'Ver todos' : 'Ver solo alertas'}
                </button>
              </motion.div>
            )}
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
            <Table
              data={filtered} keyExtractor={p => p.id_producto} loading={loading}
              emptyMessage="Sin productos en inventario."
              columns={[
                { key: 'nombre_producto', header: 'Producto', render: p => <span className="font-medium">{p.nombre_producto}</span> },
                { key: 'categoria', header: 'Categoría', render: p => p.categoria?.categoria ?? <span className="text-slate-400">—</span> },
                { key: 'precio', header: 'Precio', render: p => <span className="text-orange-400 font-semibold">{fmtCurrency(p.precio)}</span> },
                {
                  key: 'cantidad', header: 'Cantidad',
                  render: p => (
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${p.cantidad <= STOCK_BAJO_THRESHOLD ? 'text-red-400' : ''}`}>{p.cantidad}</span>
                      {p.cantidad <= STOCK_BAJO_THRESHOLD && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                  ),
                },
                {
                  key: 'fecha_vencimiento', header: 'Vencimiento',
                  render: p => p.fecha_vencimiento
                    ? new Date(p.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-HN')
                    : <span className="text-slate-400">—</span>,
                },
                {
                  key: 'estado_stock', header: 'Estado',
                  render: p => (
                    p.cantidad === 0 ? <Badge variant="danger">Agotado</Badge>
                      : p.cantidad <= STOCK_BAJO_THRESHOLD ? <Badge variant="warning">Stock bajo</Badge>
                        : <Badge variant="success">Disponible</Badge>
                  ),
                },
                {
                  key: 'acciones', header: 'Acciones',
                  render: p => (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p.id_producto)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}

        {vista === 'stock' && (
          <>
            <p className="text-slate-500 dark:text-slate-400 text-sm">El color de la barra indica la proximidad al stock mínimo configurado. Haz clic en <strong className="text-slate-700 dark:text-white">Configurar</strong> para actualizar los valores.</p>
            {loading ? (
              <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : productos.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-sm">Sin productos. Crea productos primero en la pestaña Productos.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {productos.map(p => {
                  const s = stockItems.find((i: any) => String(i.id_producto) === String(p.id_producto)) as any;
                  const actual = s?.stock_actual ?? null;
                  const minimo = s?.stock_minimo ?? 0;
                  const pct = actual !== null && minimo > 0 ? Math.min((actual / (minimo * 2)) * 100, 100) : actual !== null ? 100 : 0;
                  const isAgotado = actual !== null && actual <= 0;
                  const isBajo = actual !== null && !isAgotado && actual <= minimo;
                  const barColor = isAgotado ? '#ef4444' : isBajo ? '#f59e0b' : '#22c55e';
                  const statusLabel = actual === null ? 'Sin control' : isAgotado ? 'Agotado' : isBajo ? 'Bajo mínimo' : 'OK';
                  const statusCls = actual === null ? 'text-slate-500' : isAgotado ? 'text-red-400' : isBajo ? 'text-amber-400' : 'text-emerald-400';

                  return (
                    <div key={p.id_producto} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{p.nombre_producto}</p>
                          <p className="text-slate-500 text-xs">{p.categoria?.categoria ?? 'Sin categoría'}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCls} bg-current/10`} style={{ color: barColor }}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Barra de progreso */}
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-500 dark:text-slate-400">Stock actual: <strong className="text-slate-900 dark:text-white">{actual ?? '—'}</strong></span>
                          <span className="text-slate-500">Mín: {minimo}</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: barColor }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                        {actual !== null && minimo > 0 && (
                          <p className="text-xs text-slate-400 mt-1">{Math.round(pct)}% del umbral mínimo×2</p>
                        )}
                      </div>

                      <button onClick={() => openStockModal(p)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 hover:border-orange-500/50 py-1.5 rounded-lg transition-colors">
                        <BarChart2 className="w-3 h-3" /> Configurar stock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {vista === 'recetas' && (
          <>
            <div>
              <label className={labelCls}>Platillo</label>
              <select value={selectedPlatillo} onChange={e => setSelectedPlatillo(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500 max-w-xs">
                <option value="">-- Elige un platillo --</option>
                {platillos.map(p => <option key={p.id_platillo} value={String(p.id_platillo)}>{p.nombre_platillo}</option>)}
              </select>
            </div>

            {selectedPlatillo ? (
              <Table
                data={recetas} keyExtractor={r => r.id_rec_platillo} loading={loadingRecetas}
                emptyMessage="Este platillo no tiene ingredientes en su receta."
                columns={[
                  {
                    key: 'ingrediente', header: 'Ingrediente',
                    render: (r: any) => <span className="font-medium">{r.inventario?.producto?.nombre_producto ?? `Inventario #${r.id_inventario}`}</span>,
                  },
                  {
                    key: 'cantidad', header: 'Cantidad utilizada',
                    render: r => <span className="text-orange-400 font-semibold">{r.cantidad_utilizada}</span>,
                  },
                  {
                    key: 'acciones', header: 'Acciones',
                    render: r => (
                      <button onClick={() => handleDeleteReceta(r.id_rec_platillo)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ),
                  },
                ]}
              />
            ) : (
              <div className="text-center py-16 text-slate-500">
                <ChefHat className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecciona un platillo para gestionar su receta de ingredientes.</p>
              </div>
            )}
          </>
        )}
      </motion.div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Nuevo producto'}>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre_producto} onChange={e => setForm(f => ({ ...f, nombre_producto: e.target.value }))}
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Categoría</label>
            <select value={form.id_categoria} onChange={e => setForm(f => ({ ...f, id_categoria: e.target.value }))}
              className={inputCls}>
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.categoria}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Cantidad</label>
              <input type="number" min={0} value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: parseInt(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Precio (HNL)</label>
              <input type="number" min={0} step={0.01} value={form.precio} onChange={e => setForm(f => ({ ...f, precio: parseFloat(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))}
                className={`${inputCls} dark:[color-scheme:dark]`} />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      {stockModal && (
        <Modal open={!!stockModal} onClose={() => setStockModal(null)} title={`Stock — ${stockModal.nombre_producto}`} size="sm">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Stock actual</label>
                <input type="number" min={0} step={0.01} value={stockForm.stock_actual}
                  onChange={e => setStockForm(f => ({ ...f, stock_actual: parseFloat(e.target.value) || 0 }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Stock mínimo</label>
                <input type="number" min={0} step={0.01} value={stockForm.stock_minimo}
                  onChange={e => setStockForm(f => ({ ...f, stock_minimo: parseFloat(e.target.value) || 0 }))}
                  className={inputCls} />
              </div>
            </div>
            <p className="text-slate-500 text-xs">Se emitirá alerta cuando el stock actual sea ≤ al mínimo.</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setStockModal(null)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleSaveStock} disabled={savingStock}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
                {savingStock ? 'Guardando...' : 'Guardar stock'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Modal open={recetaModal} onClose={() => setRecetaModal(false)} title="Agregar ingrediente" size="sm">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Ingrediente (registro de stock) *</label>
            <select value={recetaForm.id_inventario} onChange={e => setRecetaForm(f => ({ ...f, id_inventario: e.target.value }))}
              className={inputCls}>
              <option value="">Seleccionar...</option>
              {stockItems.map((s: any) => (
                <option key={s.id_inventario} value={String(s.id_inventario)}>
                  {s.producto?.nombre_producto ?? `#${s.id_inventario}`} (stock: {s.stock_actual})
                </option>
              ))}
            </select>
            {stockItems.length === 0 && (
              <p className="text-amber-400 text-xs mt-1">Primero configura el stock de los productos en la pestaña Stock.</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Cantidad utilizada *</label>
            <input type="number" min={0.01} step={0.01} value={recetaForm.cantidad_utilizada}
              onChange={e => setRecetaForm(f => ({ ...f, cantidad_utilizada: parseFloat(e.target.value) || 0 }))}
              className={inputCls} />
          </div>
          {errorReceta && <p className="text-red-500 text-sm">{errorReceta}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={() => setRecetaModal(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
            <button onClick={handleAddReceta} disabled={savingReceta}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {savingReceta ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
