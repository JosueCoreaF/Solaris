import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Wallet, Trash2, Search, Tag } from 'lucide-react';
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

const emptyPagoForm = { id_categoria: '', fecha_pago: '', monto: 0, estado: 'pendiente' as const };
const emptyCatForm = { nombre: '' };

export const Gastos: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [vista, setVista] = useState<Vista>('gastos');
  const [pagos, setPagos] = useState<PagoRest[]>([]);
  const [categorias, setCategorias] = useState<CategoriaGastoRest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const openCreateCat = () => {
    setFormCat(emptyCatForm);
    setErrorCat(null);
    setModalCatOpen(true);
  };

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

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(n);

  const filteredPagos = pagos.filter(p =>
    (p.categoria?.nombre ?? '').toLowerCase().includes(search.toLowerCase()),
  );
  const filteredCats = categorias.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  const totalGastos = pagos.reduce((s, p) => s + p.monto, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Gastos</h1>
            <p className="text-slate-400 text-xs">{pagos.length} registros · Total {fmtCurrency(totalGastos)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {vista === 'categorias' && (
            <button onClick={openCreateCat}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold px-4 py-2 rounded-xl transition-colors border border-slate-700">
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
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['gastos', 'categorias'] as Vista[]).map(v => (
          <button key={v} onClick={() => setVista(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              vista === v ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}>
            {v === 'gastos' ? 'Gastos' : 'Categorías'}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Buscar ${vista}...`}
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors" />
      </div>

      <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {vista === 'gastos' ? (
          <Table
            data={filteredPagos}
            keyExtractor={p => p.id_pago}
            loading={loading}
            emptyMessage="Sin gastos registrados."
            columns={[
              {
                key: 'fecha_pago', header: 'Fecha',
                render: p => new Date(p.fecha_pago + 'T00:00:00').toLocaleDateString('es-HN'),
              },
              { key: 'categoria', header: 'Categoría', render: p => p.categoria?.nombre ?? <span className="text-slate-600">—</span> },
              { key: 'monto', header: 'Monto', render: p => <span className="font-semibold text-orange-400">{fmtCurrency(p.monto)}</span> },
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
              { key: 'nombre', header: 'Nombre', render: c => <span className="font-medium text-white">{c.nombre}</span> },
              {
                key: 'uso', header: 'Gastos asociados',
                render: c => {
                  const count = pagos.filter(p => String(p.id_categoria) === String(c.id_categoria)).length;
                  return <span className="text-slate-400">{count}</span>;
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Categoría *</label>
            <select value={formPago.id_categoria} onChange={e => setFormPago(f => ({ ...f, id_categoria: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="">Selecciona una categoría...</option>
              {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fecha *</label>
              <input type="date" value={formPago.fecha_pago} onChange={e => setFormPago(f => ({ ...f, fecha_pago: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Monto (HNL) *</label>
              <input type="number" min={0} step={0.01} value={formPago.monto} onChange={e => setFormPago(f => ({ ...f, monto: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Estado</label>
            <select value={formPago.estado} onChange={e => setFormPago(f => ({ ...f, estado: e.target.value as any }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500">
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {errorPago && <p className="text-red-400 text-sm">{errorPago}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalPagoOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
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
            <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
            <input value={formCat.nombre} onChange={e => setFormCat({ nombre: e.target.value })}
              placeholder="Ej: Servicios, Suministros, Mantenimiento..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500" />
          </div>

          {errorCat && <p className="text-red-400 text-sm">{errorCat}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={() => setModalCatOpen(false)} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors">
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
