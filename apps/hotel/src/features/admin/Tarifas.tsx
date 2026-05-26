import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TrendingUp, Plus, Edit2, X } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || 'all';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (activeHotelId && activeHotelId !== 'all') {
    headers['X-Hotel-ID'] = activeHotelId;
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
  id_tipo_habitacion: string;
  nombre_tipo: string;
  descripcion?: string;
  tarifa_base: number;
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

  // Modal editar
  const [editModal, setEditModal] = useState<Tarifa | null>(null);
  const [editForm, setEditForm] = useState({ tarifa_noche: 0, tarifa_hora: 0, tarifa_pasadia: 0 });
  const [saving, setSaving] = useState(false);

  // Modal crear
  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    id_tipo_habitacion: '',
    id_categoria: '',
    tarifa_noche: 0,
    tarifa_hora: 0,
    tarifa_pasadia: 0,
  });

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
    setEditForm({ tarifa_noche: t.tarifa_noche, tarifa_hora: t.tarifa_hora, tarifa_pasadia: t.tarifa_pasadia });
  };

  const guardar = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      await apiFetch(`/tarifas/${editModal.id_tarifa}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
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

  // ── Crear ──
  const crear = async () => {
    if (!createForm.id_tipo_habitacion || !createForm.id_categoria) {
      showToast('Completa tipo y categoría', 'err');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/tarifas', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      showToast('Tarifa creada');
      setCreateModal(false);
      setCreateForm({ id_tipo_habitacion: '', id_categoria: '', tarifa_noche: 0, tarifa_hora: 0, tarifa_pasadia: 0 });
      void load();
    } catch (e: any) {
      showToast(e?.message ?? 'Error al crear', 'err');
    } finally {
      setSaving(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', borderRadius: 8, padding: '10px 18px',
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px #0003',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">ADMINISTRACIÓN</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-light text-gray-900 flex items-center gap-3">
            <TrendingUp size={30} className="text-gray-400" />
            Tarifas
          </h1>
          <button
            onClick={() => setCreateModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: '#1e293b',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Nueva Tarifa
          </button>
        </div>
        <p className="text-gray-500 text-sm mt-2">Matriz de tarifas: Normal, Corporativa, Especial × Sencilla, Doble, Triple</p>
      </div>

      {/* Filtros */}
      <div className="px-8 py-4 flex flex-wrap gap-3 border-b border-gray-50">
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="todos">Todos los tipos</option>
          {tipos.map(t => (
            <option key={t.id_tipo_habitacion} value={t.id_tipo_habitacion}>{t.nombre_tipo}</option>
          ))}
        </select>

        <select
          value={filtroCategoria}
          onChange={e => setFiltroCategoria(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="todos">Todas las categorías</option>
          {categorias.map(c => (
            <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
          ))}
        </select>

        <span className="text-xs text-gray-400 self-center ml-auto">
          {tarifasFiltradas.length} tarifa{tarifasFiltradas.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {loading ? (
          <div className="text-center text-gray-400 py-20 text-sm">Cargando tarifas…</div>
        ) : error ? (
          <div className="text-center text-red-500 py-20 text-sm">{error}</div>
        ) : tarifasFiltradas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">No hay tarifas con esos filtros.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tipo</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Categoría</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Noche (L)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Hora (L)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pasadía (L)</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Vigencia</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {tarifasFiltradas.map((t, i) => (
                  <tr key={t.id_tarifa} style={{ borderBottom: i < tarifasFiltradas.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{t.tipo_habitacion}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 13, color: '#1e293b' }}>
                      <span style={{ display: 'inline-block', padding: '4px 10px', background: '#ede9fe', color: '#6d28d9', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {t.categoria}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#1e293b', fontWeight: 600 }}>
                      {t.tarifa_noche.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#1e293b' }}>
                      {t.tarifa_hora.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: '#1e293b' }}>
                      {t.tarifa_pasadia.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
                      {t.vigente_desde}
                      {t.vigente_hasta && <div>{t.vigente_hasta}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => abrirEditar(t)}
                        style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', background: '#fff', cursor: 'pointer', color: '#3b82f6', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Edit2 size={12} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal editar */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px #0005', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
                {editModal.tipo_habitacion} • {editModal.categoria}
              </h3>
              <button onClick={() => setEditModal(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tarifa / noche (HNL)</div>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.tarifa_noche}
                  onChange={e => setEditForm(f => ({ ...f, tarifa_noche: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </label>

              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tarifa / hora (HNL)</div>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.tarifa_hora}
                  onChange={e => setEditForm(f => ({ ...f, tarifa_hora: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </label>

              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tarifa / pasadía (HNL)</div>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.tarifa_pasadia}
                  onChange={e => setEditForm(f => ({ ...f, tarifa_pasadia: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fafafa' }}>
              <button
                onClick={() => setEditModal(null)}
                style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void guardar()}
                disabled={saving}
                style={{ padding: '8px 18px', fontSize: 13, border: 'none', borderRadius: 6, background: saving ? '#94a3b8' : '#1e293b', color: '#fff', cursor: saving ? 'default' : 'pointer', fontWeight: 600 }}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {createModal && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px #0005', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Nueva Tarifa</h3>
              <button onClick={() => setCreateModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tipo de Habitación</div>
                <select
                  value={createForm.id_tipo_habitacion}
                  onChange={e => setCreateForm(f => ({ ...f, id_tipo_habitacion: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                >
                  <option value="">-- Selecciona tipo --</option>
                  {tipos.map(t => (
                    <option key={t.id_tipo_habitacion} value={t.id_tipo_habitacion}>{t.nombre_tipo}</option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Categoría</div>
                <select
                  value={createForm.id_categoria}
                  onChange={e => setCreateForm(f => ({ ...f, id_categoria: e.target.value }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                >
                  <option value="">-- Selecciona categoría --</option>
                  {categorias.map(c => (
                    <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tarifa / noche (HNL)</div>
                <input
                  type="number"
                  step="0.01"
                  value={createForm.tarifa_noche}
                  onChange={e => setCreateForm(f => ({ ...f, tarifa_noche: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </label>

              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tarifa / hora (HNL)</div>
                <input
                  type="number"
                  step="0.01"
                  value={createForm.tarifa_hora}
                  onChange={e => setCreateForm(f => ({ ...f, tarifa_hora: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </label>

              <label>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Tarifa / pasadía (HNL)</div>
                <input
                  type="number"
                  step="0.01"
                  value={createForm.tarifa_pasadia}
                  onChange={e => setCreateForm(f => ({ ...f, tarifa_pasadia: parseFloat(e.target.value) || 0 }))}
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#fafafa' }}>
              <button
                onClick={() => setCreateModal(false)}
                style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void crear()}
                disabled={saving}
                style={{ padding: '8px 18px', fontSize: 13, border: 'none', borderRadius: 6, background: saving ? '#94a3b8' : '#1e293b', color: '#fff', cursor: saving ? 'default' : 'pointer', fontWeight: 600 }}
              >
                {saving ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
