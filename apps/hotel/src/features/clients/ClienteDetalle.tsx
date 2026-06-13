import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import {
  ArrowLeft, Edit2, Save, X, Phone, MapPin, Mail, Calendar,
  CreditCard, CheckCircle, Clock, AlertCircle, TrendingUp, Wallet,
  BedDouble, Layers, Moon, Users
} from 'lucide-react';

/* ─── Tipos ──────────────────────────────────────────────── */
interface Reserva {
  id_reserva_hotel: string;
  check_in: string;
  check_out: string;
  estado: string;
  estado_display: string;
  total_reserva: number;
  moneda: string;
  adultos: number;
  ninos: number;
  observaciones?: string;
  es_cortesia: boolean;
  habitacion: string;
}

interface SaldoEntry {
  id_saldo: string;
  monto: number;
  descripcion: string;
  tipo: string;
  created_at: string;
  aplicado: boolean;
}

interface Estadisticas {
  totalReservas: number;
  totalGastado: number;
  ultimaVisita: string | null;
  reservasCompletadas: number;
  saldoTotal: number;
}

interface Preferencias {
  habitacionFrecuente: string | null;
  tipoFrecuente: string | null;
  pisoFrecuente: string | null;
  promedioNoches: number | null;
  promedioHuespedes: number | null;
}

interface ClientePerfil {
  id_huesped: string;
  nombre_completo: string;
  correo?: string;
  telefono?: string;
  ciudad?: string;
  direccion?: string;
  reservas: Reserva[];
  saldos: SaldoEntry[];
  estadisticas: Estadisticas;
  preferencias?: Preferencias;
}

/* ─── API ─────────────────────────────────────────────────── */
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function getAuthHeaders(contentType = false): Promise<Record<string, string>> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const headers: Record<string, string> = { 'X-Hotel-ID': activeHotelId };
  if (contentType) headers['Content-Type'] = 'application/json';
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
  } catch (_) {}
  return headers;
}

async function fetchCliente(id: string): Promise<ClientePerfil> {
  const r = await fetch(`${API}/bookings/huespedes/${id}`, { headers: await getAuthHeaders() });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `Error ${r.status}`);
  }
  return r.json();
}

async function patchCliente(id: string, updates: { nombre_completo?: string; telefono?: string; ciudad?: string; direccion?: string }): Promise<void> {
  const r = await fetch(`${API}/bookings/huespedes/${id}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(true),
    body: JSON.stringify(updates),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `Error ${r.status}`);
  }
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number, currency = 'HNL') {
  return `${currency} ${n.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
}

function nightsBetween(ci: string, co: string) {
  const a = new Date(ci), b = new Date(co);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  confirmada:  { label: 'Confirmada',  bg: '#eff6ff', color: '#3b82f6', icon: <Clock size={11} /> },
  check_in:    { label: 'En hotel',    bg: '#f0fdf4', color: '#16a34a', icon: <CheckCircle size={11} /> },
  check_out:   { label: 'Check-out',   bg: '#f1f5f9', color: '#64748b', icon: <CheckCircle size={11} /> },
  cancelada:   { label: 'Cancelada',   bg: '#fef2f2', color: '#dc2626', icon: <X size={11} /> },
  no_show:     { label: 'No show',     bg: '#fef3c7', color: '#d97706', icon: <AlertCircle size={11} /> },
  pagada:      { label: 'Pagada',      bg: '#f0fdf4', color: '#16a34a', icon: <CheckCircle size={11} /> },
  abonada:     { label: 'Abonada',     bg: '#fffbeb', color: '#d97706', icon: <Clock size={11} /> },
  reservada:   { label: 'Reservada',   bg: '#eff6ff', color: '#3b82f6', icon: <Clock size={11} /> },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, bg: '#f1f5f9', color: '#64748b', icon: null };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

/* ─── Componente principal ───────────────────────────────── */
export const ClienteDetalle: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<ClientePerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Modo edición
  const [editando, setEditando] = useState(false);
  const [editForm, setEditForm] = useState({ nombre_completo: '', correo: '', telefono: '', ciudad: '', direccion: '' });
  const [saving, setSaving] = useState(false);

  // Filtro reservas
  const [tabReservas, setTabReservas] = useState<'todas' | 'activas' | 'historial'>('todas');
  const [paginaReservas, setPaginaReservas] = useState(1);
  const [saldosExpandidos, setSaldosExpandidos] = useState(false);
  const RESERVAS_POR_PAGINA = 10;
  const SALDOS_VISIBLES = 3;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const c = await fetchCliente(id);
      setCliente(c);
      setEditForm({
        nombre_completo: c.nombre_completo,
        correo: isPlaceholderEmail(c.correo) ? '' : (c.correo ?? ''),
        telefono: c.telefono ?? '',
        ciudad: c.ciudad ?? '',
        direccion: c.direccion ?? '',
      });
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar cliente');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!id || !cliente) return;
    if (!editForm.nombre_completo.trim()) { showToast('El nombre es requerido', 'err'); return; }
    setSaving(true);
    try {
      await patchCliente(id, {
        nombre_completo: editForm.nombre_completo.trim(),
        telefono: editForm.telefono.trim() || undefined,
        ciudad: editForm.ciudad.trim() || undefined,
        direccion: editForm.direccion.trim() || undefined,
      });
      await load();
      setEditando(false);
      showToast('Datos actualizados ✓');
    } catch (e: any) {
      showToast(e.message ?? 'Error al guardar', 'err');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
      Cargando perfil del cliente…
    </div>
  );

  if (error || !cliente) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ color: '#ef4444', fontSize: 15 }}>{error ?? 'Cliente no encontrado'}</div>
      <button onClick={() => navigate('/clientes')} style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>← Volver a Clientes</button>
    </div>
  );

  const reservasFiltradas = cliente.reservas.filter(r => {
    if (tabReservas === 'activas') return ['confirmada', 'check_in'].includes(r.estado);
    if (tabReservas === 'historial') return ['check_out', 'cancelada', 'no_show'].includes(r.estado);
    return true;
  });
  const totalPaginas = Math.ceil(reservasFiltradas.length / RESERVAS_POR_PAGINA);
  const reservasPagina = reservasFiltradas.slice((paginaReservas - 1) * RESERVAS_POR_PAGINA, paginaReservas * RESERVAS_POR_PAGINA);
  const saldosVisibles = saldosExpandidos ? cliente.saldos : cliente.saldos.slice(0, SALDOS_VISIBLES);

  const color = avatarColor(cliente.nombre_completo);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 28px' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'ok' ? '#22c55e' : '#ef4444', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 14px #0003' }}>
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb + botón volver */}
      <button onClick={() => navigate('/clientes')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 13, marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={15} />
        Volver a Clientes
      </button>

      {/* ── Perfil header ── */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '24px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar + info */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
              {initials(cliente.nombre_completo)}
            </div>
            <div>
              {editando ? (
                <input value={editForm.nombre_completo}
                  onChange={e => setEditForm(f => ({ ...f, nombre_completo: e.target.value }))}
                  style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', border: '1px solid #93c5fd', borderRadius: 8, padding: '4px 10px', outline: 'none', marginBottom: 8 }} />
              ) : (
                <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>{cliente.nombre_completo}</h1>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13, color: '#475569' }}>
                {!isPlaceholderEmail(cliente.correo) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Mail size={13} style={{ color: '#94a3b8' }} />
                    {cliente.correo}
                  </span>
                )}
                {editando ? (
                  <>
                    <input placeholder="Teléfono" value={editForm.telefono} onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))}
                      style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', fontSize: 12, width: 130, outline: 'none' }} />
                    <input placeholder="Ciudad" value={editForm.ciudad} onChange={e => setEditForm(f => ({ ...f, ciudad: e.target.value }))}
                      style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 8px', fontSize: 12, width: 130, outline: 'none' }} />
                  </>
                ) : (
                  <>
                    {cliente.telefono && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={13} style={{ color: '#94a3b8' }} />{cliente.telefono}</span>}
                    {cliente.ciudad && <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={13} style={{ color: '#94a3b8' }} />{cliente.ciudad}</span>}
                  </>
                )}
              </div>
              {editando && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input placeholder="Dirección" value={editForm.direccion} onChange={e => setEditForm(f => ({ ...f, direccion: e.target.value }))}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 8px', fontSize: 12, width: 300, outline: 'none' }} />
                </div>
              )}
            </div>
          </div>

          {/* Botones edición */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {editando ? (
              <>
                <button onClick={() => setEditando(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>
                  <X size={13} />Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8, background: saving ? '#94a3b8' : '#16a34a', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700 }}>
                  <Save size={13} />{saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditando(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                <Edit2 size={13} />Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Estadísticas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Reservas</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e293b' }}>{cliente.estadisticas.totalReservas}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Completadas</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{cliente.estadisticas.reservasCompletadas}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Total gastado</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>
            {cliente.estadisticas.totalGastado > 0 ? `HNL ${cliente.estadisticas.totalGastado.toLocaleString('es-HN', { minimumFractionDigits: 0 })}` : '—'}
          </div>
        </div>
        {cliente.estadisticas.saldoTotal > 0 ? (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Saldo disponible</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#d97706' }}>HNL {cliente.estadisticas.saldoTotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</div>
          </div>
        ) : (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Saldo</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>✓ Sin saldo</div>
          </div>
        )}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>Última visita</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
            {cliente.estadisticas.ultimaVisita ? fmtDate(cliente.estadisticas.ultimaVisita) : '—'}
          </div>
        </div>
      </div>

      {/* ── Preferencias de habitación ── */}
      {cliente.preferencias && (cliente.preferencias.habitacionFrecuente || cliente.preferencias.tipoFrecuente || cliente.preferencias.pisoFrecuente || cliente.preferencias.promedioNoches || cliente.preferencias.promedioHuespedes) && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <BedDouble size={16} style={{ color: '#3b82f6' }} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Preferencias de habitación</h2>
            <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4 }}>basado en historial</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
            {cliente.preferencias.habitacionFrecuente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fdf4ff', borderRadius: 10, padding: '10px 14px' }}>
                <BedDouble size={18} style={{ color: '#a21caf', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Habitación favorita</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{cliente.preferencias.habitacionFrecuente}</div>
                </div>
              </div>
            )}
            {cliente.preferencias.tipoFrecuente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#eff6ff', borderRadius: 10, padding: '10px 14px' }}>
                <BedDouble size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tipo favorito</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{cliente.preferencias.tipoFrecuente}</div>
                </div>
              </div>
            )}
            {cliente.preferencias.pisoFrecuente && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f5f3ff', borderRadius: 10, padding: '10px 14px' }}>
                <Layers size={18} style={{ color: '#7c3aed', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Piso habitual</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>Piso {cliente.preferencias.pisoFrecuente}</div>
                </div>
              </div>
            )}
            {cliente.preferencias.promedioNoches !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', borderRadius: 10, padding: '10px 14px' }}>
                <Moon size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Estadía promedio</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{cliente.preferencias.promedioNoches} noche{cliente.preferencias.promedioNoches !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
            {cliente.preferencias.promedioHuespedes !== null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff7ed', borderRadius: 10, padding: '10px 14px' }}>
                <Users size={18} style={{ color: '#ea580c', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Huéspedes típicos</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{cliente.preferencias.promedioHuespedes} persona{cliente.preferencias.promedioHuespedes !== 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Saldos disponibles ── */}
      {cliente.saldos.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Wallet size={16} style={{ color: '#d97706' }} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400e' }}>Créditos disponibles</h2>
            <span style={{ fontSize: 11, background: '#fef3c7', color: '#d97706', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>
              Total: HNL {cliente.estadisticas.saldoTotal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {saldosVisibles.map((s) => (
              <div key={s.id_saldo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', borderRadius: 8, padding: '8px 14px', border: '1px solid #fde68a' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.descripcion}</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{fmtDate(s.created_at)}</div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#d97706' }}>HNL {s.monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
          {cliente.saldos.length > SALDOS_VISIBLES && (
            <button onClick={() => setSaldosExpandidos(v => !v)}
              style={{ marginTop: 8, background: 'none', border: '1px solid #fde68a', borderRadius: 8, padding: '5px 14px', fontSize: 11, color: '#92400e', cursor: 'pointer', fontWeight: 600 }}>
              {saldosExpandidos ? '▲ Ver menos' : `▼ Ver ${cliente.saldos.length - SALDOS_VISIBLES} más`}
            </button>
          )}
          <div style={{ marginTop: 10, fontSize: 11, color: '#92400e' }}>
            💡 Para aplicar estos créditos, ve a <strong>Pagos</strong> y selecciona una reserva del cliente.
          </div>
        </div>
      )}

      {/* ── Historial de reservas ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {/* Header tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} style={{ color: '#64748b' }} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Historial de Reservas</h2>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['todas', 'activas', 'historial'] as const).map(t => (
              <button key={t} onClick={() => { setTabReservas(t); setPaginaReservas(1); }}
                style={{ padding: '5px 12px', border: `1px solid ${tabReservas === t ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 7, background: tabReservas === t ? '#eff6ff' : '#fff', color: tabReservas === t ? '#3b82f6' : '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: tabReservas === t ? 700 : 400 }}>
                {t === 'todas' ? 'Todas' : t === 'activas' ? 'Activas' : 'Historial'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista reservas */}
        {reservasFiltradas.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No hay reservas en esta categoría
          </div>
        ) : (
          <div>
            {reservasPagina.map((r, idx) => {
              const noches = nightsBetween(r.check_in, r.check_out);
              return (
                <div key={r.id_reserva_hotel}
                  style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr 1fr', gap: 12, padding: '14px 20px', borderBottom: idx < reservasPagina.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
                  {/* Habitación + fechas */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.habitacion}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={10} />
                      {fmtDate(r.check_in)} → {fmtDate(r.check_out)}
                      <span style={{ background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 6, fontSize: 10 }}>{noches} noche{noches > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Estado */}
                  <div><EstadoBadge estado={r.estado_display || r.estado} /></div>

                  {/* Personas */}
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {r.adultos} adulto{r.adultos > 1 ? 's' : ''}
                    {r.ninos > 0 ? ` · ${r.ninos} niño${r.ninos > 1 ? 's' : ''}` : ''}
                  </div>

                  {/* Total */}
                  <div>
                    {r.es_cortesia ? (
                      <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 700 }}>Cortesía</span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{fmtMoney(r.total_reserva, r.moneda)}</span>
                    )}
                  </div>

                  {/* ID corto */}
                  <div style={{ fontSize: 10, color: '#cbd5e1', textAlign: 'right' }}>
                    #{r.id_reserva_hotel.slice(-8)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ padding: '10px 20px', background: '#f8fafc', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            {reservasFiltradas.length} reserva{reservasFiltradas.length !== 1 ? 's' : ''}
            {tabReservas !== 'todas' ? ` (${tabReservas})` : ' en total'}
            {totalPaginas > 1 && ` · Página ${paginaReservas} de ${totalPaginas}`}
          </span>
          {totalPaginas > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setPaginaReservas(p => Math.max(1, p - 1))} disabled={paginaReservas === 1}
                style={{ padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: paginaReservas === 1 ? '#f8fafc' : '#fff', color: paginaReservas === 1 ? '#cbd5e1' : '#475569', cursor: paginaReservas === 1 ? 'default' : 'pointer', fontSize: 11 }}>
                ‹ Anterior
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPaginas || Math.abs(p - paginaReservas) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === '...' ? (
                  <span key={`e${i}`} style={{ padding: '3px 6px', fontSize: 11, color: '#94a3b8' }}>…</span>
                ) : (
                  <button key={p} onClick={() => setPaginaReservas(p as number)}
                    style={{ padding: '3px 9px', border: `1px solid ${paginaReservas === p ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 6, background: paginaReservas === p ? '#eff6ff' : '#fff', color: paginaReservas === p ? '#3b82f6' : '#475569', cursor: 'pointer', fontSize: 11, fontWeight: paginaReservas === p ? 700 : 400 }}>
                    {p}
                  </button>
                ))}
              <button onClick={() => setPaginaReservas(p => Math.min(totalPaginas, p + 1))} disabled={paginaReservas === totalPaginas}
                style={{ padding: '3px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: paginaReservas === totalPaginas ? '#f8fafc' : '#fff', color: paginaReservas === totalPaginas ? '#cbd5e1' : '#475569', cursor: paginaReservas === totalPaginas ? 'default' : 'pointer', fontSize: 11 }}>
                Siguiente ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
