import React, { useCallback, useEffect, useState } from 'react';

/* ─── Tipos ─────────────────────────────────────────────── */
interface SaldoEntry {
  id_saldo: string;
  id_huesped: string;
  monto: number;
  descripcion: string;
  tipo: 'credito' | 'debito' | 'devolucion' | 'ajuste';
  created_at: string;
  fecha_aplicacion: string | null;
  aplicado: boolean;
  huesped?: { nombre_completo: string };
}

interface Movimiento {
  id: string;
  fecha: string;
  tipo: 'pago' | 'pago_anulado' | 'credito' | 'credito_aplicado' | 'debito' | 'devolucion' | 'ajuste';
  descripcion: string;
  monto: number;
  moneda: string;
  metodo?: string | null;
  referencia?: string | null;
  reserva_info?: string | null;
  id_saldo?: string;
  id_reserva_hotel?: string;
  aplicado?: boolean;
  fecha_aplicacion?: string | null;
  estado_pago?: string;
  signo: 'cargo' | 'abono' | 'anulado';
  es_saldo?: boolean;
}

interface ReservaPendiente {
  id_reserva_hotel: string;
  check_in: string;
  check_out: string;
  total_reserva: number;
  saldo_pendiente: number;
  habitacion: string;
}

interface ClienteGrupo {
  id_huesped: string;
  nombre: string;
  saldo_disponible: number;
  entradas: SaldoEntry[];
}

/* ─── API ─────────────────────────────────────────────────── */
const API = 'http://localhost:4000/api';

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hotel-ID': activeHotelId,
  };
  try {
    const { supabase } = await import('../../api/supabase');
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) headers['Authorization'] = `Bearer ${data.session.access_token}`;
  } catch (_) {}
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...headers, ...opts?.headers }
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `Error ${r.status}`);
  }
  return r.json() as Promise<T>;
}

/* ─── Helpers ─────────────────────────────────────────────── */
const TIPO_COLORS: Record<string, [string, string]> = {
  credito:         ['#dcfce7', '#16a34a'],
  credito_aplicado:['#f0fdf4', '#86efac'],
  debito:          ['#fee2e2', '#dc2626'],
  devolucion:      ['#dbeafe', '#2563eb'],
  ajuste:          ['#fef3c7', '#d97706'],
  pago:            ['#eff6ff', '#3b82f6'],
  pago_anulado:    ['#f1f5f9', '#94a3b8'],
};

const TIPO_LABEL: Record<string, string> = {
  credito: 'Crédito', credito_aplicado: 'Crédito (aplicado)',
  debito: 'Débito', devolucion: 'Devolución', ajuste: 'Ajuste',
  pago: 'Pago', pago_anulado: 'Pago anulado',
};

const TIPO_ICON: Record<string, string> = {
  credito: '💰', credito_aplicado: '✅',
  debito: '➖', devolucion: '↩️', ajuste: '⚖️',
  pago: '💳', pago_anulado: '🚫',
};

const METODO_ICON: Record<string, string> = {
  Efectivo: '💵', Tarjeta: '💳', Transferencia: '🏦',
  Depósito: '🏧', Canje: '🔄', Otro: '📝',
};

function agrupar(saldos: SaldoEntry[]): ClienteGrupo[] {
  const map = new Map<string, ClienteGrupo>();
  for (const s of saldos) {
    if (!map.has(s.id_huesped)) {
      map.set(s.id_huesped, { id_huesped: s.id_huesped, nombre: s.huesped?.nombre_completo ?? '—', saldo_disponible: 0, entradas: [] });
    }
    const g = map.get(s.id_huesped)!;
    g.entradas.push(s);
    if (!s.aplicado && s.tipo === 'credito') g.saldo_disponible += s.monto;
  }
  return [...map.values()].sort((a, b) => b.saldo_disponible - a.saldo_disponible);
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || '?';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtCur(n: number) {
  return n.toLocaleString('es-HN', { minimumFractionDigits: 2 });
}

/* ─── Componente ─────────────────────────────────────────── */
export const EstadoCuenta: React.FC = () => {
  const [saldos, setSaldos]           = useState<SaldoEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [expandidos, setExpandidos]   = useState<Set<string>>(new Set());
  const [procesando, setProcesando]   = useState<string | null>(null);
  const [toast, setToast]             = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Movimientos lazy por cliente
  const [movimientosMap, setMovimientosMap]   = useState<Record<string, Movimiento[]>>({});
  const [loadingMov, setLoadingMov]           = useState<Record<string, boolean>>({});

  // Modal aplicar a reserva
  const [apModal, setApModal]             = useState(false);
  const [apSaldo, setApSaldo]             = useState<SaldoEntry | null>(null);
  const [apReservas, setApReservas]       = useState<ReservaPendiente[]>([]);
  const [apLoadingRes, setApLoadingRes]   = useState(false);
  const [apSelected, setApSelected]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSaldos(await apiFetch<SaldoEntry[]>('/bookings/saldos')); }
    catch (e: any) { setError(e?.message ?? 'Error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const showToast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const toggleExpand = (id: string) => {
    setExpandidos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    // Carga lazy de movimientos si no se han cargado
    if (!movimientosMap[id]) {
      setLoadingMov(prev => ({ ...prev, [id]: true }));
      apiFetch<Movimiento[]>(`/bookings/estado-cuenta/${id}`)
        .then(movs => setMovimientosMap(prev => ({ ...prev, [id]: movs })))
        .catch(() => setMovimientosMap(prev => ({ ...prev, [id]: [] })))
        .finally(() => setLoadingMov(prev => ({ ...prev, [id]: false })));
    }
  };

  const handleDevolver = async (id: string) => {
    setProcesando(id);
    try {
      await apiFetch(`/bookings/saldos/${id}`, { method: 'PATCH' });
      showToast('Marcado como devuelto ✓');
      // Limpiar cache de movimientos para recargar
      setMovimientosMap({});
      void load();
    } catch (e: any) { showToast(e?.message ?? 'Error', 'err'); }
    finally { setProcesando(null); }
  };

  const openAplicarModal = async (saldo: SaldoEntry) => {
    setApSaldo(saldo); setApModal(true); setApSelected(null); setApLoadingRes(true);
    try {
      const res = await apiFetch<ReservaPendiente[]>(`/bookings/saldos/reservas-pendientes/${saldo.id_huesped}`);
      setApReservas(res);
    } catch { setApReservas([]); }
    finally { setApLoadingRes(false); }
  };

  const handleConfirmarAplicar = async () => {
    if (!apSaldo || !apSelected) return;
    setProcesando(apSaldo.id_saldo);
    try {
      const result = await apiFetch<{ monto_aplicado: number; diferencia: number }>(
        `/bookings/saldos/${apSaldo.id_saldo}/aplicar`,
        { method: 'POST', body: JSON.stringify({ id_reserva_hotel: apSelected }) }
      );
      const diff = result.diferencia;
      showToast(`Aplicado HNL ${fmtCur(result.monto_aplicado)}${diff > 0.01 ? ` · Diferencia: HNL ${fmtCur(diff)}` : ' · Reserva cubierta ✓'}`);
      setApModal(false);
      setMovimientosMap({});
      void load();
    } catch (e: any) { showToast(e?.message ?? 'Error al aplicar', 'err'); }
    finally { setProcesando(null); }
  };

  const grupos = agrupar(saldos).filter(g =>
    !search || g.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalDisponible = saldos.filter(s => !s.aplicado && s.tipo === 'credito').reduce((s, e) => s + e.monto, 0);
  const totalAplicado   = saldos.filter(s =>  s.aplicado && s.tipo === 'credito').reduce((s, e) => s + e.monto, 0);
  const clientesCon     = grupos.filter(g => g.saldo_disponible > 0).length;

  const reservaSeleccionada = apReservas.find(r => r.id_reserva_hotel === apSelected);
  const montoAplicar = apSaldo && reservaSeleccionada
    ? Math.min(apSaldo.monto, reservaSeleccionada.saldo_pendiente) : 0;
  const diferencia = apSaldo ? apSaldo.monto - montoAplicar : 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '24px 28px' }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 9999, background: toast.type === 'ok' ? '#22c55e' : '#ef4444', color: '#fff', padding: '10px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 14px #0003' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>Estado de Cuenta</h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>Saldos por cliente — aplica capital a nuevas reservas o registra devoluciones</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', marginBottom: 6 }}>Saldo total disponible</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>HNL {fmtCur(totalDisponible)}</div>
        </div>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', marginBottom: 6 }}>Total aplicado / devuelto</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>HNL {fmtCur(totalAplicado)}</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#78716c', textTransform: 'uppercase', marginBottom: 6 }}>Clientes con saldo</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{clientesCon}</div>
        </div>
      </div>

      {/* Barra búsqueda */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input type="text" placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
        <button onClick={() => void load()} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#64748b' }}>↻ Actualizar</button>
      </div>

      {/* Contenido por cliente */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Cargando saldos…</div>
      ) : error ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#ef4444' }}>{error}</div>
      ) : grupos.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>No hay clientes con saldo</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grupos.map(g => {
            const expanded  = expandidos.has(g.id_huesped);
            const pendientes = g.entradas.filter(e => !e.aplicado).length;
            return (
              <div key={g.id_huesped} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {/* Cabecera cliente */}
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
                  onClick={() => toggleExpand(g.id_huesped)}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {initials(g.nombre)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{g.nombre}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                      {(movimientosMap[g.id_huesped] ?? g.entradas).length} movimientos · {g.entradas.filter(e => !e.aplicado).length} crédito{g.entradas.filter(e => !e.aplicado).length !== 1 ? 's' : ''} disponible{g.entradas.filter(e => !e.aplicado).length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {g.saldo_disponible > 0 && (
                    <div style={{ background: '#fef3c7', color: '#d97706', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                      HNL {fmtCur(g.saldo_disponible)}
                    </div>
                  )}
                  {g.saldo_disponible === 0 && (
                    <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                      ✓ Sin saldo pendiente
                    </div>
                  )}
                  <span style={{ color: '#94a3b8', fontSize: 11, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
                </div>

                {/* Historial expandido */}
                {expanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    {loadingMov[g.id_huesped] ? (
                      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Cargando movimientos…</div>
                    ) : (movimientosMap[g.id_huesped] ?? []).length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sin movimientos registrados</div>
                    ) : (
                      <>
                        {/* Resumen rápido */}
                        {(() => {
                          const movs = movimientosMap[g.id_huesped] ?? [];
                          const totalCargos  = movs.filter(m => m.signo === 'cargo').reduce((s, m) => s + m.monto, 0);
                          const totalAbonos  = movs.filter(m => m.signo === 'abono').reduce((s, m) => s + m.monto, 0);
                          const totalAnulado = movs.filter(m => m.signo === 'anulado').reduce((s, m) => s + m.monto, 0);
                          return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ padding: '10px 18px', background: '#fafafa', borderRight: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Total cobrado</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b' }}>HNL {fmtCur(totalCargos)}</div>
                              </div>
                              <div style={{ padding: '10px 18px', background: '#f0fdf4', borderRight: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Total créditos/devoluciones</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#16a34a' }}>HNL {fmtCur(totalAbonos)}</div>
                              </div>
                              <div style={{ padding: '10px 18px', background: '#f8fafc' }}>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Pagos anulados</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#94a3b8' }}>HNL {fmtCur(totalAnulado)}</div>
                              </div>
                            </div>
                          );
                        })()}
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              {['', 'Fecha', 'Tipo', 'Descripción', 'Método', 'Cargo', 'Abono', 'Estado', 'Acciones'].map(h => (
                                <th key={h} style={{ padding: '7px 14px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textAlign: h === 'Cargo' || h === 'Abono' ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(movimientosMap[g.id_huesped] ?? []).map((m, i) => {
                              const [bg, fg] = TIPO_COLORS[m.tipo] ?? ['#f1f5f9', '#64748b'];
                              return (
                                <tr key={m.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: m.signo === 'anulado' ? 0.5 : 1 }}>
                                  <td style={{ padding: '9px 8px 9px 16px', fontSize: 16, lineHeight: 1 }}>{TIPO_ICON[m.tipo] ?? '•'}</td>
                                  <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(m.fecha)}</td>
                                  <td style={{ padding: '9px 14px' }}>
                                    <span style={{ background: bg, color: fg, padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                      {TIPO_LABEL[m.tipo] ?? m.tipo}
                                    </span>
                                  </td>
                                  <td style={{ padding: '9px 14px', fontSize: 12, color: '#475569', maxWidth: 260 }}>
                                    <div title={m.descripcion} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion}</div>
                                    {m.referencia && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Ref: {m.referencia}</div>}
                                  </td>
                                  <td style={{ padding: '9px 14px', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
                                    {m.metodo ? `${METODO_ICON[m.metodo] ?? ''} ${m.metodo}` : '—'}
                                  </td>
                                  <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#dc2626', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {m.signo === 'cargo' ? `HNL ${fmtCur(m.monto)}` : '—'}
                                  </td>
                                  <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 700, color: '#16a34a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {m.signo === 'abono' ? `HNL ${fmtCur(m.monto)}` : m.signo === 'anulado' ? <span style={{ color: '#94a3b8' }}>—</span> : '—'}
                                  </td>
                                  <td style={{ padding: '9px 14px' }}>
                                    {m.tipo === 'pago' && (
                                      <span style={{ background: '#dbeafe', color: '#3b82f6', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>Registrado</span>
                                    )}
                                    {m.tipo === 'pago_anulado' && (
                                      <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>Anulado</span>
                                    )}
                                    {m.tipo === 'credito' && !m.aplicado && (
                                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>Disponible</span>
                                    )}
                                    {(m.tipo === 'credito_aplicado' || (m.tipo === 'credito' && m.aplicado)) && (
                                      <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>Aplicado</span>
                                    )}
                                    {m.tipo === 'devolucion' && (
                                      <span style={{ background: '#dbeafe', color: '#2563eb', padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>Devuelto</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '9px 14px' }}>
                                    {m.es_saldo && !m.aplicado && m.tipo === 'credito' && (
                                      <div style={{ display: 'flex', gap: 5 }}>
                                        <button
                                          onClick={() => {
                                            const saldoEntry = saldos.find(s => s.id_saldo === m.id_saldo);
                                            if (saldoEntry) void openAplicarModal(saldoEntry);
                                          }}
                                          disabled={procesando !== null}
                                          style={{ padding: '3px 9px', fontSize: 10, fontWeight: 600, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                          Aplicar
                                        </button>
                                        <button
                                          onClick={() => { if (m.id_saldo) void handleDevolver(m.id_saldo); }}
                                          disabled={procesando !== null}
                                          style={{ padding: '3px 9px', fontSize: 10, fontWeight: 600, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer' }}>
                                          Devolver
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: Aplicar saldo a reserva ── */}
      {apModal && apSaldo && (
        <div style={{ position: 'fixed', inset: 0, background: '#0007', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setApModal(false)}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px #0005' }}
            onClick={e => e.stopPropagation()}>
            {/* Header modal */}
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Aplicar saldo a reserva</h3>
              <button onClick={() => setApModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Saldo disponible */}
              <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#78716c', fontWeight: 600, textTransform: 'uppercase' }}>Saldo disponible</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>HNL {fmtCur(apSaldo.monto)}</div>
                </div>
                <div style={{ fontSize: 13, color: '#78716c', fontWeight: 600 }}>{apSaldo.huesped?.nombre_completo}</div>
              </div>

              {/* Reservas pendientes */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Selecciona una reserva con saldo pendiente:</div>
                {apLoadingRes ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Cargando reservas…</div>
                ) : apReservas.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13, background: '#f8fafc', borderRadius: 10 }}>
                    Este cliente no tiene reservas con saldo pendiente
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                    {apReservas.map(r => (
                      <div key={r.id_reserva_hotel} onClick={() => setApSelected(r.id_reserva_hotel)}
                        style={{ border: `2px solid ${apSelected === r.id_reserva_hotel ? '#3b82f6' : '#e2e8f0'}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', background: apSelected === r.id_reserva_hotel ? '#eff6ff' : '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{r.habitacion}</div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{r.check_in?.split('T')[0]} → {r.check_out?.split('T')[0]}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Pendiente</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>HNL {fmtCur(r.saldo_pendiente)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cálculo */}
              {apSelected && reservaSeleccionada && (
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span>Saldo disponible del cliente</span><span>HNL {fmtCur(apSaldo.monto)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                    <span>Saldo pendiente de reserva</span><span>HNL {fmtCur(reservaSeleccionada.saldo_pendiente)}</span>
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 7, display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800 }}>
                    <span style={{ color: '#16a34a' }}>✓ Se aplicará</span>
                    <span style={{ color: '#16a34a' }}>HNL {fmtCur(montoAplicar)}</span>
                  </div>
                  {diferencia > 0.01 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#d97706', fontWeight: 600, background: '#fef9c3', borderRadius: 6, padding: '6px 10px' }}>
                      <span>Saldo sobrante (queda en cuenta del cliente)</span>
                      <span>HNL {fmtCur(diferencia)}</span>
                    </div>
                  )}
                  {reservaSeleccionada.saldo_pendiente > apSaldo.monto + 0.01 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ef4444', fontWeight: 600, background: '#fef2f2', borderRadius: 6, padding: '6px 10px' }}>
                      <span>Diferencia a cobrar por otro método</span>
                      <span>HNL {fmtCur(reservaSeleccionada.saldo_pendiente - apSaldo.monto)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void handleConfirmarAplicar()} disabled={!apSelected || procesando !== null}
                  style={{ flex: 1, padding: '11px', fontSize: 13, fontWeight: 700, background: apSelected ? '#16a34a' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, cursor: apSelected ? 'pointer' : 'not-allowed' }}>
                  {procesando ? 'Aplicando…' : 'Confirmar aplicación'}
                </button>
                <button onClick={() => setApModal(false)} style={{ padding: '11px 18px', fontSize: 13, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', borderRadius: 8, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
