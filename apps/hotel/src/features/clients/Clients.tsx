import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, RefreshCw, User, Phone, MapPin, Mail, CreditCard, ChevronRight } from 'lucide-react';
import { supabase } from '../../api/supabase';

/* ─── Tipos ──────────────────────────────────────────────── */
interface Huesped {
  id_huesped: string;
  nombre_completo: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}

/* ─── API ─────────────────────────────────────────────────── */
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function getHeaders(contentType = false): Promise<Record<string, string>> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const headers: Record<string, string> = { 'X-Hotel-ID': activeHotelId };
  if (contentType) headers['Content-Type'] = 'application/json';
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
  } catch (_) {}
  return headers;
}

async function fetchHuespedes(): Promise<Huesped[]> {
  const r = await fetch(`${API}/bookings/huespedes`, { headers: await getHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function createHuesped(data: {
  nombre_completo: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
}): Promise<Huesped> {
  const r = await fetch(`${API}/bookings/huespedes`, {
    method: 'POST',
    headers: await getHeaders(true),
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `Error ${r.status}`);
  }
  return r.json();
}

/* ─── Helpers ─────────────────────────────────────────────── */
function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}

const AVATAR_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
  '#14b8a6', '#06b6d4', '#84cc16', '#ef4444',
];
function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function isPlaceholderEmail(email?: string) {
  return !email || email.includes('@partnercentral.local');
}

/* ─── Modal nuevo cliente ─────────────────────────────────── */
interface NuevoClienteModalProps {
  onClose: () => void;
  onCreated: (h: Huesped) => void;
}

const NuevoClienteModal: React.FC<NuevoClienteModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({ nombre_completo: '', correo: '', telefono: '', ciudad: '', direccion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre_completo.trim()) { setError('El nombre es requerido'); return; }
    setSaving(true); setError(null);
    try {
      const h = await createHuesped({
        nombre_completo: form.nombre_completo.trim(),
        correo: form.correo.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        ciudad: form.ciudad.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
      });
      onCreated(h);
    } catch (e: any) {
      setError(e.message ?? 'Error al crear cliente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0006', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, padding: 28, boxShadow: '0 20px 60px #0003' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Nuevo Cliente</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Nombre completo *</label>
            <input value={form.nombre_completo} onChange={e => setForm(f => ({ ...f, nombre_completo: e.target.value }))}
              placeholder="Ej. Juan Pérez López"
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Correo electrónico</label>
            <input type="email" value={form.correo} onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
              placeholder="correo@ejemplo.com"
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Teléfono</label>
              <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="+504 9999-9999"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Ciudad</label>
              <input value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                placeholder="Tegucigalpa"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Dirección</label>
            <input value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
              placeholder="Col. Kennedy, casa #12"
              style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '9px 0', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '9px 0', border: 'none', borderRadius: 8, background: saving ? '#94a3b8' : '#3b82f6', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700 }}>
              {saving ? 'Guardando…' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Componente principal ───────────────────────────────── */
export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const [huespedes, setHuespedes] = useState<Huesped[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'con_correo' | 'sin_correo'>('todos');
  const [modalNuevo, setModalNuevo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setHuespedes(await fetchHuespedes()); }
    catch (e: any) { setError(e.message ?? 'Error al cargar clientes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = huespedes.filter(h => {
    const matchSearch = !search ||
      h.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      (!isPlaceholderEmail(h.correo) && (h.correo ?? '').toLowerCase().includes(search.toLowerCase())) ||
      (h.telefono ?? '').includes(search) ||
      (h.ciudad ?? '').toLowerCase().includes(search.toLowerCase());

    const matchFiltro =
      filtro === 'todos' ? true :
      filtro === 'con_correo' ? !isPlaceholderEmail(h.correo) :
      isPlaceholderEmail(h.correo);

    return matchSearch && matchFiltro;
  });

  const totalConCorreo = huespedes.filter(h => !isPlaceholderEmail(h.correo)).length;
  const totalSinCorreo = huespedes.filter(h => isPlaceholderEmail(h.correo)).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 28px' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'ok' ? '#22c55e' : '#ef4444', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 14px #0003' }}>
          {toast.msg}
        </div>
      )}

      {modalNuevo && (
        <NuevoClienteModal
          onClose={() => setModalNuevo(false)}
          onCreated={h => {
            setHuespedes(prev => [h, ...prev]);
            setModalNuevo(false);
            showToast(`Cliente "${h.nombre_completo}" creado ✓`);
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Directorio de huéspedes — gestiona contactos, historial y saldos</p>
        </div>
        <button onClick={() => setModalNuevo(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px #3b82f640' }}>
          <UserPlus size={15} />
          Nuevo Cliente
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', marginBottom: 6 }}>Total Clientes</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e293b' }}>{huespedes.length}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', marginBottom: 6 }}>Con correo registrado</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#3b82f6' }}>{totalConCorreo}</div>
        </div>
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', marginBottom: 6 }}>Sin correo</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706' }}>{totalSinCorreo}</div>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por nombre, correo, teléfono o ciudad…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px 8px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['todos', 'con_correo', 'sin_correo'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              style={{ padding: '7px 14px', border: `1px solid ${filtro === f ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 8, background: filtro === f ? '#eff6ff' : '#fff', color: filtro === f ? '#3b82f6' : '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: filtro === f ? 700 : 400 }}>
              {f === 'todos' ? 'Todos' : f === 'con_correo' ? 'Con correo' : 'Sin correo'}
            </button>
          ))}
        </div>
        <button onClick={() => void load()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
          <RefreshCw size={13} />
          Actualizar
        </button>
      </div>

      {/* Tabla / Lista */}
      {loading ? (
        <div style={{ padding: 64, textAlign: 'center', color: '#94a3b8' }}>Cargando clientes…</div>
      ) : error ? (
        <div style={{ padding: 64, textAlign: 'center', color: '#ef4444' }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 64, textAlign: 'center', color: '#94a3b8' }}>
          {search ? 'No se encontraron clientes con ese criterio' : 'No hay clientes registrados'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {/* Cabecera tabla */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr 1.5fr auto', gap: 12, padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            <span>Cliente</span>
            <span>Correo</span>
            <span>Teléfono</span>
            <span>Ciudad</span>
            <span></span>
          </div>

          {/* Filas */}
          {filtered.map((h, idx) => (
            <div
              key={h.id_huesped}
              onClick={() => navigate(`/clientes/${h.id_huesped}`)}
              style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 1.5fr 1.5fr auto', gap: 12, padding: '12px 20px', borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', alignItems: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Avatar + nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(h.nombre_completo), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {initials(h.nombre_completo)}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{h.nombre_completo}</div>
                  {h.direccion && (
                    <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
                      <MapPin size={10} />{h.direccion.length > 35 ? h.direccion.slice(0, 35) + '…' : h.direccion}
                    </div>
                  )}
                </div>
              </div>

              {/* Correo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isPlaceholderEmail(h.correo) ? (
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>Sin correo</span>
                ) : (
                  <>
                    <Mail size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.correo}</span>
                  </>
                )}
              </div>

              {/* Teléfono */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {h.telefono ? (
                  <>
                    <Phone size={12} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#475569' }}>{h.telefono}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                )}
              </div>

              {/* Ciudad */}
              <div>
                {h.ciudad ? (
                  <span style={{ fontSize: 12, color: '#475569' }}>{h.ciudad}</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                )}
              </div>

              {/* Flecha */}
              <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
            </div>
          ))}

          {/* Footer contador */}
          <div style={{ padding: '10px 20px', background: '#f8fafc', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
            Mostrando {filtered.length} de {huespedes.length} clientes
          </div>
        </div>
      )}
    </div>
  );
};
