import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  Plus,
  Edit2,
  X,
  Folder,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw,
  Calendar,
  Tag,
  DollarSign,
  Info
} from 'lucide-react';
import { supabase } from '../../api/supabase';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || 'all';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (activeHotelId && activeHotelId !== 'all') {
    headers['X-Hotel-ID'] = activeHotelId;
  }
  
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {
    // Sin sesión activa o error al recuperarla
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}


// ─── Types ───────────────────────────────────────────────────────────────────────

interface Categoria {
  id_categoria: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
}

interface TipoHabitacion {
  id: string;
  nombre: string;
  descripcion?: string;
  precio_base: number;
}

interface Tarifa {
  id_tarifa: string;
  id_tipo_habitacion: string;
  id_categoria: string;
  tarifa_noche: number;
  tarifa_hora: number;
  tarifa_pasadia: number;
  vigente_desde: string;
  vigente_hasta?: string;
  activa: boolean;
  tipo_habitacion: string;
  categoria: string;
}

// ─── Component ───────────────────────────────────────────────────────────────────

export const Tarifas: React.FC = () => {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tipos, setTipos] = useState<TipoHabitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');

  // Modal editar tarifa
  const [editModal, setEditModal] = useState<Tarifa | null>(null);
  const [editForm, setEditForm] = useState({
    tarifa_noche: '',
    tarifa_hora: '',
    tarifa_pasadia: '',
    vigente_desde: '',
    vigente_hasta: '',
  });
  const [saving, setSaving] = useState(false);

  // Modal crear tarifa
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    id_tipo_habitacion: '',
    id_categoria: '',
    tarifa_noche: '',
    tarifa_hora: '',
    tarifa_pasadia: '',
    vigente_desde: new Date().toLocaleDateString('en-CA'),
    vigente_hasta: '',
  });

  // Modal Gestionar Categorías
  const [showCatModal, setShowCatModal] = useState(false);
  const [catNombre, setCatNombre] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Load data ──
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cat, tip, tar] = await Promise.all([
        apiFetch<Categoria[]>('/tarifas/categorias'),
        apiFetch<TipoHabitacion[]>('/config/tipos-habitacion'),
        apiFetch<Tarifa[]>('/tarifas/vigentes'),
      ]);
      setCategorias(Array.isArray(cat) ? cat : []);
      setTipos(Array.isArray(tip) ? tip : []);
      setTarifas(Array.isArray(tar) ? tar : []);
    } catch (e: any) {
      setError(e?.message ?? 'Error cargando tarifas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Filtrado ──
  const tarifasFiltradas = tarifas.filter(t => {
    if (filtroTipo !== 'todos' && t.id_tipo_habitacion !== filtroTipo) return false;
    if (filtroCategoria !== 'todos' && t.id_categoria !== filtroCategoria) return false;
    return true;
  });

  // ── Edit ──
  const abrirEditar = (t: Tarifa) => {
    setEditModal(t);
    setEditForm({
      tarifa_noche: String(t.tarifa_noche),
      tarifa_hora: String(t.tarifa_hora),
      tarifa_pasadia: String(t.tarifa_pasadia),
      vigente_desde: t.vigente_desde || '',
      vigente_hasta: t.vigente_hasta || '',
    });
  };

  const guardar = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const payload = {
        tarifa_noche: parseFloat(editForm.tarifa_noche) || 0,
        tarifa_hora: parseFloat(editForm.tarifa_hora) || 0,
        tarifa_pasadia: parseFloat(editForm.tarifa_pasadia) || 0,
        vigente_desde: editForm.vigente_desde || null,
        vigente_hasta: editForm.vigente_hasta || null,
      };
      await apiFetch(`/tarifas/${editModal.id_tarifa}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      showToast('Tarifa actualizada');
      setEditModal(null);
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al guardar', 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Crear Tarifa ──
  const crear = async () => {
    if (!createForm.id_tipo_habitacion || !createForm.id_categoria) {
      showToast('Completa tipo y categoría', 'err');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id_tipo_habitacion: createForm.id_tipo_habitacion,
        id_categoria: createForm.id_categoria,
        tarifa_noche: parseFloat(createForm.tarifa_noche) || 0,
        tarifa_hora: parseFloat(createForm.tarifa_hora) || 0,
        tarifa_pasadia: parseFloat(createForm.tarifa_pasadia) || 0,
        vigente_desde: createForm.vigente_desde || null,
        vigente_hasta: createForm.vigente_hasta || null,
      };
      await apiFetch('/tarifas', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Tarifa creada');
      setCreateModal(false);
      setCreateForm({
        id_tipo_habitacion: '',
        id_categoria: '',
        tarifa_noche: '',
        tarifa_hora: '',
        tarifa_pasadia: '',
        vigente_desde: new Date().toLocaleDateString('en-CA'),
        vigente_hasta: '',
      });
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al crear', 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar Tarifa ──
  const eliminar = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta tarifa?')) {
      return;
    }
    try {
      await apiFetch(`/tarifas/${id}`, {
        method: 'DELETE'
      });
      showToast('Tarifa eliminada');
      void load();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar tarifa', 'err');
    }
  };

  // ── Crear Categoría ──
  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNombre.trim()) return;
    setCatSaving(true);
    try {
      await apiFetch('/tarifas/categorias', {
        method: 'POST',
        body: JSON.stringify({ nombre: catNombre, descripcion: catDesc }),
      });
      showToast('Categoría de tarifa creada');
      setCatNombre('');
      setCatDesc('');
      void load();
    } catch (err: any) {
      showToast(err.message || 'Error al crear categoría', 'err');
    } finally {
      setCatSaving(false);
    }
  };

  // ── Eliminar Categoría ──
  const handleEliminarCategoria = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta categoría de tarifa? Se eliminarán todas las tarifas asociadas a ella.')) {
      return;
    }
    try {
      await apiFetch(`/tarifas/categorias/${id}`, {
        method: 'DELETE'
      });
      showToast('Categoría eliminada');
      void load();
    } catch (err: any) {
      showToast(err.message || 'Error al eliminar categoría', 'err');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-slate-50/50 to-blue-50/20 text-slate-700 p-8 relative overflow-hidden font-sans">
      {/* Glow Effects */}
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none"></div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 rounded-2xl px-5 py-3 text-xs font-bold text-white shadow-xl flex items-center gap-2.5 transition-all duration-300 animate-fade-in ${
          toast.type === 'ok' ? 'bg-emerald-600 shadow-emerald-600/10' : 'bg-rose-600 shadow-rose-600/10'
        }`}>
          {toast.type === 'ok' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header Premium */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 border-b border-slate-200/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-sm">
            <TrendingUp className="w-3.5 h-3.5" /> Estructura Comercial
          </div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-indigo-600 stroke-[1.5]" />
            Tarifas del Sistema
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 font-normal flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Configura y administra las tarifas por noche, hora o pasadía según el tipo de habitación y categoría operativa.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCatModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm active:scale-95"
          >
            <Folder className="w-4 h-4 text-slate-400" /> Gestionar Categorías
          </button>
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white border-none rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md active:scale-98"
          >
            <Plus className="w-4 h-4" /> Nueva Tarifa
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-8 flex flex-wrap gap-4 bg-white/70 backdrop-blur-md border border-slate-200/60 p-4 rounded-2xl relative z-10 shadow-sm items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 text-xs bg-white/95 font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
          >
            <option value="todos">🏨 Todos los tipos de habitación</option>
            {tipos.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>

          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            className="border border-slate-200 hover:border-slate-300 rounded-xl px-4 py-2 text-xs bg-white/95 font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
          >
            <option value="todos">🏷️ Todas las categorías</option>
            {categorias.map(c => (
              <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
            ))}
          </select>
        </div>

        <span className="text-xxs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50">
          {tarifasFiltradas.length} tarifa{tarifasFiltradas.length !== 1 ? 's' : ''} activa{tarifasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {loading ? (
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl p-16 text-center text-slate-400 text-xs font-semibold shadow-sm flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-indigo-500" />
            Cargando tarifas y categorías configuradas...
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-600 text-xs font-semibold flex items-center justify-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        ) : tarifasFiltradas.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 rounded-2xl p-16 text-center text-slate-400 text-xs font-semibold shadow-sm">
            No hay tarifas configuradas para los filtros seleccionados.
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-md border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200/80">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo de Habitación</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Categoría</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Noche</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hora</th>
                    <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pasadía</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vigencia</th>
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tarifasFiltradas.map((t) => (
                    <tr key={t.id_tarifa} className="hover:bg-slate-50/50 transition-all duration-150">
                      <td className="px-6 py-4.5 text-xs text-slate-900 font-bold">{t.tipo_habitacion}</td>
                      <td className="px-6 py-4.5 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold shadow-sm">
                          <Tag className="w-3 h-3 text-indigo-400" /> {t.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-right text-xs text-slate-900 font-bold font-mono">
                        L. {t.tarifa_noche.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4.5 text-right text-xs text-slate-600 font-medium font-mono">
                        L. {t.tarifa_hora.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4.5 text-right text-xs text-slate-600 font-medium font-mono">
                        L. {t.tarifa_pasadia.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4.5 text-center text-[10px] text-slate-400 font-semibold">
                        <div className="flex items-center justify-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          <span>{t.vigente_desde}</span>
                        </div>
                        {t.vigente_hasta && <div className="text-[9px] text-slate-400 mt-0.5">hasta {t.vigente_hasta}</div>}
                      </td>
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => abrirEditar(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
                          >
                            <Edit2 size={11} className="text-indigo-400" /> Editar
                          </button>
                          <button
                            onClick={() => void eliminar(t.id_tarifa)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-100 rounded-lg text-[11px] font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
                            title="Eliminar tarifa"
                          >
                            <Trash2 size={11} className="text-rose-400" /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Gestionar Categorías (Dynamic CRUD) */}
      {showCatModal && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 w-full max-w-[500px] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Folder className="w-4.5 h-4.5 text-indigo-500" /> Gestionar Categorías
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Define los segmentos comerciales del hotel (Temporada Alta, Promo, etc.)</p>
              </div>
              <button
                onClick={() => setShowCatModal(false)}
                className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 transition-all p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-6">
              
              {/* Form to create new category */}
              <form onSubmit={handleCrearCategoria} className="bg-slate-50/70 border border-slate-200/60 p-4 rounded-xl flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  ➕ Nueva Categoría
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nombre (ej. Promo)"
                    value={catNombre}
                    onChange={e => setCatNombre(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans"
                  />
                  <input
                    type="text"
                    placeholder="Descripción"
                    value={catDesc}
                    onChange={e => setCatDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans"
                  />
                </div>
                <div className="flex justify-end mt-1">
                  <button
                    type="submit"
                    disabled={catSaving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold border-none cursor-pointer transition-all active:scale-95 shadow-md shadow-indigo-600/10"
                  >
                    {catSaving ? 'Creando...' : 'Crear Categoría'}
                  </button>
                </div>
              </form>

              {/* Categories list */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
                  Categorías Activas
                </span>
                
                <div className="flex flex-col gap-2">
                  {categorias.map(cat => (
                    <div key={cat.id_categoria} className="p-3.5 bg-white border border-slate-200 rounded-xl flex justify-between items-center hover:border-slate-300 transition-all shadow-sm">
                      <div>
                        <strong className="text-xs font-bold text-slate-800">{cat.nombre}</strong>
                        {cat.descripcion && <p className="text-[11px] text-slate-400 mt-0.5">{cat.descripcion}</p>}
                      </div>
                      <button
                        onClick={() => handleEliminarCategoria(cat.id_categoria)}
                        className="p-2 border-none bg-transparent hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg cursor-pointer transition-all"
                        title="Eliminar categoría"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Modal editar tarifa */}
      {editModal && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 w-full max-w-[480px] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-500" />
                  Actualizar Tarifas
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{editModal.tipo_habitacion} • {editModal.categoria}</p>
              </div>
              <button
                onClick={() => setEditModal(null)}
                className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 transition-all p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inputs */}
            <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Por Noche
                  </label>
                  <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all bg-white overflow-hidden flex items-center">
                    <span className="pl-3 pr-1.5 text-xs font-bold text-slate-400 select-none">L.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.tarifa_noche}
                      onChange={e => setEditForm(f => ({ ...f, tarifa_noche: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className="w-full py-2.5 pr-3.5 bg-transparent border-none text-slate-800 text-xs font-semibold outline-none font-sans [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Por Hora
                  </label>
                  <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all bg-white overflow-hidden flex items-center">
                    <span className="pl-3 pr-1.5 text-xs font-bold text-slate-400 select-none">L.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.tarifa_hora}
                      onChange={e => setEditForm(f => ({ ...f, tarifa_hora: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className="w-full py-2.5 pr-3.5 bg-transparent border-none text-slate-800 text-xs font-semibold outline-none font-sans [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Pasadía
                  </label>
                  <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all bg-white overflow-hidden flex items-center">
                    <span className="pl-3 pr-1.5 text-xs font-bold text-slate-400 select-none">L.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.tarifa_pasadia}
                      onChange={e => setEditForm(f => ({ ...f, tarifa_pasadia: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className="w-full py-2.5 pr-3.5 bg-transparent border-none text-slate-800 text-xs font-semibold outline-none font-sans [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Date Ranges for seasonal rates/discounts */}
              <div className="grid grid-cols-2 gap-4 mt-1 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Vigente Desde
                  </label>
                  <input
                    type="date"
                    value={editForm.vigente_desde}
                    onChange={e => setEditForm(f => ({ ...f, vigente_desde: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-850 text-xs font-semibold outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Vigente Hasta (Opcional)
                  </label>
                  <input
                    type="date"
                    value={editForm.vigente_hasta}
                    onChange={e => setEditForm(f => ({ ...f, vigente_hasta: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-850 text-xs font-semibold outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => void guardar()}
                disabled={saving}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-350 text-white border-none rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-md shadow-slate-900/10"
              >
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear tarifa */}
      {createModal && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/80 w-full max-w-[480px] shadow-2xl overflow-hidden animate-fade-in flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-500" />
                  Nueva Tarifa
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Establece precios para un tipo de habitación y categoría</p>
              </div>
              <button
                onClick={() => setCreateModal(false)}
                className="border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 transition-all p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inputs */}
            <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Tipo de Habitación
                  </label>
                  <select
                    value={createForm.id_tipo_habitacion}
                    onChange={e => setCreateForm(f => ({ ...f, id_tipo_habitacion: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer font-sans"
                  >
                    <option value="">-- Selecciona tipo --</option>
                    {tipos.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Categoría
                  </label>
                  <select
                    value={createForm.id_categoria}
                    onChange={e => setCreateForm(f => ({ ...f, id_categoria: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-semibold outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer font-sans"
                  >
                    <option value="">-- Selecciona categoría --</option>
                    {categorias.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Por Noche
                  </label>
                  <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all bg-white overflow-hidden flex items-center">
                    <span className="pl-3 pr-1.5 text-xs font-bold text-slate-400 select-none">L.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={createForm.tarifa_noche}
                      onChange={e => setCreateForm(f => ({ ...f, tarifa_noche: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className="w-full py-2.5 pr-3.5 bg-transparent border-none text-slate-800 text-xs font-semibold outline-none font-sans [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Por Hora
                  </label>
                  <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all bg-white overflow-hidden flex items-center">
                    <span className="pl-3 pr-1.5 text-xs font-bold text-slate-400 select-none">L.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={createForm.tarifa_hora}
                      onChange={e => setCreateForm(f => ({ ...f, tarifa_hora: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className="w-full py-2.5 pr-3.5 bg-transparent border-none text-slate-800 text-xs font-semibold outline-none font-sans [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Pasadía
                  </label>
                  <div className="relative rounded-xl border border-slate-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all bg-white overflow-hidden flex items-center">
                    <span className="pl-3 pr-1.5 text-xs font-bold text-slate-400 select-none">L.</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={createForm.tarifa_pasadia}
                      onChange={e => setCreateForm(f => ({ ...f, tarifa_pasadia: e.target.value }))}
                      onFocus={e => e.target.select()}
                      className="w-full py-2.5 pr-3.5 bg-transparent border-none text-slate-800 text-xs font-semibold outline-none font-sans [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Date Ranges for seasonal rates/discounts */}
              <div className="grid grid-cols-2 gap-4 mt-1 border-t border-slate-100 pt-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Vigente Desde
                  </label>
                  <input
                    type="date"
                    value={createForm.vigente_desde}
                    onChange={e => setCreateForm(f => ({ ...f, vigente_desde: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-850 text-xs font-semibold outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Vigente Hasta (Opcional)
                  </label>
                  <input
                    type="date"
                    value={createForm.vigente_hasta}
                    onChange={e => setCreateForm(f => ({ ...f, vigente_hasta: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-855 text-xs font-semibold outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                onClick={() => setCreateModal(false)}
                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => void crear()}
                disabled={saving}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-350 text-white border-none rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-md shadow-slate-900/10"
              >
                {saving ? 'Creando...' : 'Crear Tarifa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
