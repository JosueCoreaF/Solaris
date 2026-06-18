import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Wallet, Trash2, Search, Tag, TrendingDown } from 'lucide-react';
import { Modal } from '../components/Modal';
import { Table } from '../components/Table';
import { Badge } from '../components/Badge';
import { useRestaurant } from '../context/RestaurantContext';
import {
  getPagos, createPago, deletePago,
  getCategoriasGasto, createCategoriaGasto, deleteCategoriaGasto,
} from '../api/gastos';
import type { PagoRest, CategoriaGastoRest } from '../types';

type Vista = 'gastos' | 'categorias';
type DateFilter = 'hoy' | 'semana' | 'mes' | 'todos';

const emptyPagoForm = { id_categoria: '', fecha_pago: '', monto: 0, estado: 'pendiente' as const };
const emptyCatForm = { nombre: '' };

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

function isInRange(fechaStr: string | undefined, filter: DateFilter): boolean {
  if (filter === 'todos') return true;
  if (!fechaStr) return false;
  const fecha = new Date(fechaStr + 'T00:00:00');
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === 'hoy') return fecha >= startOfDay;
  if (filter === 'semana') {
    const sow = new Date(startOfDay);
    sow.setDate(startOfDay.getDate() - startOfDay.getDay());
    return fecha >= sow;
  }
  if (filter === 'mes') return fecha >= new Date(now.getFullYear(), now.getMonth(), 1);
  return true;
}

const dateLabels: Record<DateFilter, string> = { hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes', todos: 'Todos' };

export const Gastos: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [vista, setVista] = useState<Vista>('gastos');
  const [pagos, setPagos] = useState<PagoRest[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGastoRest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('mes');

  const [modalPagoOpen, setModalPagoOpen] = useState(false);
  const [formPago, setFormPago] = useState(emptyPagoForm);
  const [savingPago, setSavingPago] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);

  const [modalCatOpen, setModalCatOpen] = useState(false);
  const [formCat, setFormCat] = useState(emptyCatForm);
  const [savingCat, setSavingCat] = useState(false);
  const [errorCat, setErrorCat] = useState<string | null>(null);

  const load = async () => {
    if (!restaurant) return;
    setLoading(true);
    const id = restaurant.id_restaurant;
    const [p, c] = await Promise.all([getPagos(id), getCategoriasGasto(id)]);
    setPagos(p);
    setCategorias(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurant]);

  const openCreatePago = () => {
    setFormPago({ ...emptyPagoForm, fecha_pago: new Date().toISOString().split('T')[0] });
    setErrorPago(null);
    setModalPagoOpen(true);
  };

  const handleSavePago = async () => {
    if (!formPago.id_categoria) { setErrorPago('Selecciona una categoría.'); return; }
    if (!formPago.fecha_pago) { setErrorPago('La fecha es requerida.'); return; }
    if (formPago.monto <= 0) { setErrorPago('El monto debe ser mayor a 0.'); return; }
    if (!restaurant) return;
    setSavingPago(true);
    try {
      await createPago({ ...formPago, id_restaurante: restaurant.id_restaurant });
      await load();
      setModalPagoOpen(false);
    } catch (e: any) {
      setErrorPago(e.message ?? 'Error al guardar.');
    } finally {
      setSavingPago(false);
    }
  };

  const handleDeletePago = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await deletePago(id);
    await load();
  };

  const openCreateCat = () => { setFormCat(emptyCatForm); setErrorCat(null); setModalCatOpen(true); };

  const handleSaveCat = async () => {
    if (!formCat.nombre.trim()) { setErrorCat('El nombre es requerido.'); return; }
    if (!restaurant) return;
    setSavingCat(true);
    try {
      await createCategoriaGasto({ nombre: formCat.nombre, id_restaurante: restaurant.id_restaurant });
      await load();
      setModalCatOpen(false);
    } catch (e: any) {
      setErrorCat(e.message ?? 'Error al guardar.');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await deleteCategoriaGasto(id);
    await load();
  };

  const filteredPagos = useMemo(() =>
    pagos
      .filter(p => isInRange(p.fecha_pago, dateFilter))
      .filter(p => (p.categoria?.nombre ?? '').toLowerCase().includes(search.toLowerCase())),
    [pagos, dateFilter, search],
  );

  const filteredCats = categorias.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  const periodStats = useMemo(() => {
    const total = filteredPagos.reduce((s, p) => s + p.monto, 0);
    const pagado = filteredPagos.filter(p => p.estado === 'pagado').reduce((s, p) => s + p.monto, 0);
    const pendiente = filteredPagos.filter(p => p.estado === 'pendiente').reduce((s, p) => s + p.monto, 0);
    return { total, pagado, pendiente, count: filteredPagos.length };
  }, [filteredPagos]);

  const topCats = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPagos.forEach(p => {
      const cat = p.categoria?.nombre ?? 'Sin categoría';
      map[cat] = (map[cat] ?? 0) + p.monto;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [filteredPagos]);

  const inputCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500";
  const labelCls = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gastos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">{pagos.length} registros totales</p>
          </div>
        </div>
        <div className="flex gap-2">
          {vista === 'categorias' && (
            <button onClick={openCreateCat}
              className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold px-4 py-2 rounded-xl transition-colors border border-slate-300 dark:border-slate-700">
              <Tag className="w-4 h-4" /> Nueva categoría
            </button>
          )}
          {vista === 'gastos' && (
            <button onClick={openCreatePago}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
              <Plus className="w-4 h-4" /> Nuevo gasto
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
        {(['gastos', 'categorias'] as Vista[]).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              vista === v ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}>
            {v === 'gastos' ? 'Gastos' : 'Categorías'}
          </button>
        ))}
      </div>

      {vista === 'gastos' && (
        <>
          {/* Filtros de fecha */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
              {(['hoy', 'semana', 'mes', 'todos'] as DateFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setDateFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    dateFilter === f ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {dateLabels[f]}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por categoría..."
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors" />
            </div>
          </div>

          {/* Stats del período */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: `Total (${dateLabels[dateFilter]})`, value: fmtCurrency(periodStats.total), color: '#ef4444', icon: <TrendingDown className="w-4 h-4" /> },
              { label: 'Registros', value: periodStats.count, color: '#f59e0b', icon: <Wallet className="w-4 h-4" /> },
              { label: 'Pagado', value: fmtCurrency(periodStats.pagado), color: '#22c55e', icon: <>✓</> },
              { label: 'Pendiente', value: fmtCurrency(periodStats.pendiente), color: '#f97316', icon: <>⏳</> },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: s.color }} className="text-sm">{s.icon}</span>
                  <span className="text-slate-500 text-xs">{s.label}</span>
                </div>
                <p className="text-slate-900 dark:text-white font-bold text-lg font-mono">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Top categorías */}
          {topCats.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-slate-500 text-xs self-center">Top:</span>
              {topCats.map(([cat, monto]) => (
                <div key={cat} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1">
                  <span className="text-slate-700 dark:text-slate-300 text-xs font-medium">{cat}</span>
                  <span className="text-orange-400 text-xs font-mono">{fmtCurrency(monto)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {vista === 'categorias' && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar categoría..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-orange-500 transition-colors" />
        </div>
      )}

      <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {vista === 'gastos' ? (
          <Table
            data={filteredPagos}
            keyExtractor={p => p.id_pago}
            loading={loading}
            emptyMessage={`Sin gastos para ${dateLabels[dateFilter].toLowerCase()}.`}
            columns={[
              {
                key: 'fecha_pago', header: 'Fecha',
                render: p => new Date(p.fecha_pago + 'T00:00:00').toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' }),
              },
              { key: 'categoria', header: 'Categoría', render: p => p.categoria?.nombre ?? <span className="text-slate-400">—</span> },
              { key: 'monto', header: 'Monto', render: p => <span className="font-mono font-semibold text-red-400">{fmtCurrency(p.monto)}</span> },
              {
                key: 'estado', header: 'Estado',
                render: p => (
                  <Badge variant={p.estado === 'pagado' ? 'success' : p.estado === 'cancelado' ? 'danger' : 'warning'}>
                    {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                  </Badge>
                ),
              },
              {
                key: 'acciones', header: 'Acciones',
                render: p => (
                  <button onClick={() => handleDeletePago(p.id_pago)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                ),
              },
            ]}
          />
        ) : (
          <Table
            data={filteredCats}
            keyExtractor={c => c.id_categoria}
            loading={loading}
            emptyMessage="Sin categorías de gasto."
            columns={[
              { key: 'nombre', header: 'Nombre', render: c => <span className="font-medium">{c.nombre}</span> },
              {
                key: 'uso', header: 'Gastos asociados',
                render: c => {
                  const count = pagos.filter(p => String(p.id_categoria) === String(c.id_categoria)).length;
                  const total = pagos.filter(p => String(p.id_categoria) === String(c.id_categoria)).reduce((s, p) => s + p.monto, 0);
                  return (
                    <div>
                      <span>{count} gastos</span>
                      {total > 0 && <span className="text-slate-500 text-xs ml-2 font-mono">{fmtCurrency(total)}</span>}
                    </div>
                  );
                },
              },
              {
                key: 'acciones', header: 'Acciones',
                render: c => (
                  <button onClick={() => handleDeleteCat(c.id_categoria)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                ),
              },
            ]}
          />
        )}
      </motion.div>

      {/* Modal nuevo gasto */}
      <Modal open={modalPagoOpen} onClose={() => setModalPagoOpen(false)} title="Nuevo gasto" size="sm">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Categoría *</label>
            <select value={formPago.id_categoria} onChange={e => setFormPago(f => ({ ...f, id_categoria: e.target.value }))}
              className={inputCls}>
              <option value="">Selecciona una categoría...</option>
              {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha *</label>
              <input type="date" value={formPago.fecha_pago} onChange={e => setFormPago(f => ({ ...f, fecha_pago: e.target.value }))}
                className={`${inputCls} dark:[color-scheme:dark]`} />
            </div>
            <div>
              <label className={labelCls}>Monto (HNL) *</label>
              <input type="number" min={0} step={0.01} value={formPago.monto} onChange={e => setFormPago(f => ({ ...f, monto: parseFloat(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select value={formPago.estado} onChange={e => setFormPago(f => ({ ...f, estado: e.target.value as any }))}
              className={inputCls}>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          {errorPago && <p className="text-red-500 text-sm">{errorPago}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalPagoOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSavePago} disabled={savingPago}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {savingPago ? 'Guardando...' : 'Registrar gasto'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal nueva categoría */}
      <Modal open={modalCatOpen} onClose={() => setModalCatOpen(false)} title="Nueva categoría" size="sm">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={formCat.nombre} onChange={e => setFormCat({ nombre: e.target.value })}
              placeholder="Ej: Servicios, Suministros, Mantenimiento..."
              className={inputCls} />
          </div>
          {errorCat && <p className="text-red-500 text-sm">{errorCat}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalCatOpen(false)} className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors">
              Cancelar
            </button>
            <button onClick={handleSaveCat} disabled={savingCat}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
              {savingCat ? 'Guardando...' : 'Crear categoría'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
