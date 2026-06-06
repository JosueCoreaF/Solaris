import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { DatePicker } from '../../components/DatePicker';

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

  // ── Money field helper ──
  const MoneyField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--shell-border-strong)', borderRadius: 10, background: 'var(--card-bg)', overflow: 'hidden', transition: 'border-color .18s' }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--shell-border-strong)')}>
        <span style={{ padding: '8px 6px 8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--muted)', userSelect: 'none' as const, flexShrink: 0 }}>L.</span>
        <input type="number" step="0.01" placeholder="0.00" value={value}
          onChange={e => onChange(e.target.value)} onFocus={e => e.target.select()}
          style={{ flex: 1, border: 'none', outline: 'none', padding: '8px 12px 8px 0', fontSize: 13, fontWeight: 600, color: 'var(--text-h)', background: 'transparent', fontFamily: 'var(--sans)', appearance: 'textfield' as any }} />
      </div>
    </div>
  );

  return (
    <div style={{ padding: '28px clamp(20px, 3vw, 52px)', width: '100%' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'ok' ? '#10b981' : '#ef4444',
          color: '#fff', padding: '10px 18px', borderRadius: 12,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,.18)',
          display: 'flex', alignItems: 'center', gap: 8, animation: 'fadeInUp .25s ease',
        }}>
          {toast.type === 'ok' ? <Check size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ───────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <div className="page-header-left" style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 0, top: 2, bottom: 4, width: 4, borderRadius: 99, background: 'linear-gradient(to bottom, #8b5cf6, #3b82f6)' }} />
          <span className="page-kicker">Estructura comercial</span>
          <h1 className="page-title" style={{ background: 'linear-gradient(135deg, var(--text-h) 0%, #8b5cf6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Tarifas del Sistema
          </h1>
          <p className="page-sub">Precios por noche, hora y pasadía según tipo de habitación y categoría</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={load} title="Actualizar"
            style={{ width: 38, height: 38, borderRadius: 9, border: '1px solid var(--shell-border-strong)', background: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .18s ease' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-h)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--shell-border-strong)'; }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowCatModal(true)} className="btn-premium btn-premium-secondary" style={{ height: 38, gap: 7, fontSize: 13 }}>
            <Folder size={14} /> Categorías
          </button>
          <button onClick={() => setCreateModal(true)} className="btn-premium btn-premium-primary" style={{ height: 38, gap: 7, fontSize: 13 }}>
            <Plus size={14} /> Nueva Tarifa
          </button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="kpi-card kpi-card-violet" style={{ animationDelay: '0ms' }}>
          <div className="kpi-icon-wrap"><TrendingUp size={16} /></div>
          <div className="kpi-label">Tarifas Activas</div>
          <div className="kpi-value">{tarifas.length}</div>
          <div className="kpi-sub"><span className="kpi-sub-text">{tarifasFiltradas.length} en filtro actual</span></div>
        </div>
        <div className="kpi-card kpi-card-blue" style={{ animationDelay: '60ms' }}>
          <div className="kpi-icon-wrap"><Folder size={16} /></div>
          <div className="kpi-label">Categorías</div>
          <div className="kpi-value">{categorias.length}</div>
          <div className="kpi-sub"><span className="kpi-sub-text">Segmentos comerciales</span></div>
        </div>
        <div className="kpi-card kpi-card-emerald" style={{ animationDelay: '120ms' }}>
          <div className="kpi-icon-wrap"><DollarSign size={16} /></div>
          <div className="kpi-label">Promedio Noche</div>
          <div className="kpi-value" style={{ fontSize: 22 }}>
            {tarifas.length > 0
              ? `L ${Math.round(tarifas.reduce((s, t) => s + t.tarifa_noche, 0) / tarifas.length).toLocaleString('es-HN')}`
              : '—'}
          </div>
          <div className="kpi-sub"><span className="kpi-sub-text">Promedio del catálogo</span></div>
        </div>
      </div>

      {/* ── Table Panel ───────────────────────────────────── */}
      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Filter bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(15,23,42,.02)' }}>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="input-premium" style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
            <option value="todos">Todos los tipos</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="input-premium" style={{ width: 'auto', padding: '7px 12px', fontSize: 12 }}>
            <option value="todos">Todas las categorías</option>
            {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
          </select>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--muted)', background: 'var(--card-bg)', padding: '4px 12px', borderRadius: 99, border: '1px solid var(--shell-border)' }}>
            {tarifasFiltradas.length} tarifa{tarifasFiltradas.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '52px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando tarifas...</span>
          </div>
        ) : error ? (
          <div className="alert-banner alert-banner-red" style={{ margin: 20 }}>
            <div className="alert-banner-icon"><AlertCircle size={16} /></div>
            <div><p className="alert-banner-title">Error al cargar</p><p className="alert-banner-desc">{error}</p></div>
          </div>
        ) : tarifasFiltradas.length === 0 ? (
          <div style={{ padding: '52px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <DollarSign size={28} color="var(--shell-border-strong)" />
            <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>No hay tarifas para los filtros seleccionados</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Tipo de Habitación</th>
                  <th>Categoría</th>
                  <th style={{ textAlign: 'right' }}>🌙 Por Noche</th>
                  <th style={{ textAlign: 'right' }}>⏱ Por Hora</th>
                  <th style={{ textAlign: 'right' }}>☀️ Pasadía</th>
                  <th style={{ textAlign: 'center' }}>Vigencia</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tarifasFiltradas.map(t => (
                  <tr key={t.id_tarifa}>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text-h)', fontSize: 13 }}>{t.tipo_habitacion}</span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,.1)', color: '#7c3aed', border: '1px solid rgba(139,92,246,.18)' }}>
                        <Tag size={9} /> {t.categoria}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,.08)', color: '#065f46', border: '1px solid rgba(16,185,129,.16)', fontVariantNumeric: 'tabular-nums' }}>
                        L {t.tarifa_noche.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(59,130,246,.07)', color: '#1e40af', border: '1px solid rgba(59,130,246,.14)', fontVariantNumeric: 'tabular-nums' }}>
                        L {t.tarifa_hora.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(245,158,11,.07)', color: '#78350f', border: '1px solid rgba(245,158,11,.14)', fontVariantNumeric: 'tabular-nums' }}>
                        L {t.tarifa_pasadia.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={10} /> {t.vigente_desde}
                        </span>
                        {t.vigente_hasta && <span style={{ fontSize: 10, color: 'var(--muted)', opacity: .65 }}>hasta {t.vigente_hasta}</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button onClick={() => abrirEditar(t)} className="btn-premium btn-premium-secondary" style={{ fontSize: 11, padding: '4px 12px', height: 'auto', gap: 5 }}>
                          <Edit2 size={11} /> Editar
                        </button>
                        <button onClick={() => void eliminar(t.id_tarifa)}
                          style={{ fontSize: 11, color: 'var(--danger)', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, transition: 'all .18s' }}>
                          <Trash2 size={11} /> Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Gestionar Categorías ──────────────────── */}
      {showCatModal && createPortal(
        <div className="modal-backdrop-premium"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}
          onClick={() => setShowCatModal(false)}
        >
          <div className="modal-content-premium" style={{ width: '100%', maxWidth: 500, margin: 'auto 0', maxHeight: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--shell-border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Folder size={16} color="var(--accent)" /> Gestionar Categorías
                </h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Define los segmentos comerciales (Temporada Alta, Promo, etc.)</p>
              </div>
              <button onClick={() => setShowCatModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 8, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Nueva categoría */}
              <form onSubmit={handleCrearCategoria} style={{ background: 'rgba(15,23,42,.02)', border: '1px solid var(--shell-border)', borderRadius: 14, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Nueva categoría</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <input type="text" required placeholder="Nombre (ej. Promo)" value={catNombre} onChange={e => setCatNombre(e.target.value)} className="input-premium" style={{ fontSize: 13 }} />
                  <input type="text" placeholder="Descripción" value={catDesc} onChange={e => setCatDesc(e.target.value)} className="input-premium" style={{ fontSize: 13 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" disabled={catSaving} className="btn-premium btn-premium-primary" style={{ fontSize: 12, gap: 6, opacity: catSaving ? .7 : 1 }}>
                    <Plus size={13} /> {catSaving ? 'Creando…' : 'Crear Categoría'}
                  </button>
                </div>
              </form>

              {/* Lista de categorías */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 10 }}>Categorías activas</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categorias.map(cat => (
                    <div key={cat.id_categoria} style={{ padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--shell-border)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color .18s' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--shell-border-strong)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--shell-border)')}>
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--text-h)' }}>{cat.nombre}</strong>
                        {cat.descripcion && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{cat.descripcion}</p>}
                      </div>
                      <button onClick={() => handleEliminarCategoria(cat.id_categoria)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--danger)', padding: 6, borderRadius: 8, display: 'flex', opacity: .7, transition: 'opacity .15s' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '.7')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {editModal && createPortal(
        <div className="modal-backdrop-premium"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}
          onClick={() => setEditModal(null)}
        >
          <div className="modal-content-premium" style={{ width: '100%', maxWidth: 480, margin: 'auto 0', maxHeight: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--shell-border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit2 size={15} color="var(--accent)" /> Actualizar Tarifas
                </h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-h)' }}>{editModal.tipo_habitacion}</span>
                  {' · '}
                  <span style={{ color: '#7c3aed', fontWeight: 600 }}>{editModal.categoria}</span>
                </p>
              </div>
              <button onClick={() => setEditModal(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 8, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <MoneyField label="Por Noche" value={editForm.tarifa_noche} onChange={v => setEditForm(f => ({ ...f, tarifa_noche: v }))} />
                <MoneyField label="Por Hora" value={editForm.tarifa_hora} onChange={v => setEditForm(f => ({ ...f, tarifa_hora: v }))} />
                <MoneyField label="Pasadía" value={editForm.tarifa_pasadia} onChange={v => setEditForm(f => ({ ...f, tarifa_pasadia: v }))} />
              </div>

              <div style={{ borderTop: '1px solid var(--shell-border-subtle)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Vigente Desde</label>
                  <DatePicker value={editForm.vigente_desde} onChange={v => setEditForm(f => ({ ...f, vigente_desde: v }))} placeholder="Sin fecha inicio" className="input-premium" />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Vigente Hasta (Opcional)</label>
                  <DatePicker value={editForm.vigente_hasta} onChange={v => setEditForm(f => ({ ...f, vigente_hasta: v }))} placeholder="Sin fecha fin" className="input-premium" />
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditModal(null)} className="btn-premium btn-premium-secondary">Cancelar</button>
              <button onClick={() => void guardar()} disabled={saving} className="btn-premium btn-premium-primary" style={{ opacity: saving ? .7 : 1 }}>
                {saving ? 'Guardando…' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {createModal && createPortal(
        <div className="modal-backdrop-premium"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 16px', overflowY: 'auto' }}
          onClick={() => setCreateModal(false)}
        >
          <div className="modal-content-premium" style={{ width: '100%', maxWidth: 480, margin: 'auto 0', maxHeight: 'none' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--shell-border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-h)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={15} color="var(--accent)" /> Nueva Tarifa
                </h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Establece precios para un tipo de habitación y categoría</p>
              </div>
              <button onClick={() => setCreateModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 8, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Tipo de Habitación</label>
                  <select value={createForm.id_tipo_habitacion} onChange={e => setCreateForm(f => ({ ...f, id_tipo_habitacion: e.target.value }))} className="input-premium">
                    <option value="">-- Selecciona tipo --</option>
                    {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Categoría</label>
                  <select value={createForm.id_categoria} onChange={e => setCreateForm(f => ({ ...f, id_categoria: e.target.value }))} className="input-premium">
                    <option value="">-- Selecciona categoría --</option>
                    {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <MoneyField label="Por Noche" value={createForm.tarifa_noche} onChange={v => setCreateForm(f => ({ ...f, tarifa_noche: v }))} />
                <MoneyField label="Por Hora" value={createForm.tarifa_hora} onChange={v => setCreateForm(f => ({ ...f, tarifa_hora: v }))} />
                <MoneyField label="Pasadía" value={createForm.tarifa_pasadia} onChange={v => setCreateForm(f => ({ ...f, tarifa_pasadia: v }))} />
              </div>

              <div style={{ borderTop: '1px solid var(--shell-border-subtle)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Vigente Desde</label>
                  <DatePicker value={createForm.vigente_desde} onChange={v => setCreateForm(f => ({ ...f, vigente_desde: v }))} placeholder="Sin fecha inicio" className="input-premium" />
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>Vigente Hasta (Opcional)</label>
                  <DatePicker value={createForm.vigente_hasta} onChange={v => setCreateForm(f => ({ ...f, vigente_hasta: v }))} placeholder="Sin fecha fin" className="input-premium" />
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setCreateModal(false)} className="btn-premium btn-premium-secondary">Cancelar</button>
              <button onClick={() => void crear()} disabled={saving} className="btn-premium btn-premium-primary" style={{ opacity: saving ? .7 : 1 }}>
                {saving ? 'Creando…' : 'Crear Tarifa'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
