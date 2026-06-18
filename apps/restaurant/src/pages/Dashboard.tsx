import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Coffee, DollarSign, UtensilsCrossed,
  CalendarCheck, TrendingUp, TrendingDown, Users,
  Plus, CreditCard, Receipt,
} from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';
import { supabase } from '../api/supabase';
import type { PedidoRestaurante } from '../types';

// ── helpers ──────────────────────────────────────────────────────────────────
const hora = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
};

const GREETINGS: Partial<Record<UserRole, string>> = {
  PROPIETARIO: 'Panel del Propietario',
  ADMIN:       'Panel de Administración',
  GERENTE:     'Panel de Gerencia',
  CAJERO:      'Panel de Caja',
  MESERO:      'Panel de Servicio',
  COCINA:      'Panel de Cocina',
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) =>
  n >= 1000 ? `L. ${(n / 1000).toFixed(1)}k` : fmtCurrency(n);

// ── Donut ring SVG ────────────────────────────────────────────────────────────
const DonutRing: React.FC<{
  value: number; max: number; color: string; size?: number; stroke?: number;
}> = ({ value, max, color, size = 64, stroke = 7 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = pct * circ;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--shell-border)" strokeWidth={stroke} />
      <circle
        cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
};


// ── Revenue area chart ────────────────────────────────────────────────────────
const RevenueChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  if (!data.length) return null;
  const W = 560; const H = 160; const PAD = { t: 10, r: 20, b: 30, l: 52 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.value), 1);
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / (data.length - 1)) * iW,
    y: PAD.t + (1 - d.value / max) * iH,
  }));
  const polyPts = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPts = [
    `${pts[0].x},${PAD.t + iH}`,
    ...pts.map(p => `${p.x},${p.y}`),
    `${pts[pts.length - 1].x},${PAD.t + iH}`,
  ].join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: max * f, y: PAD.t + (1 - f) * iH }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="rev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y grid */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="var(--shell-border)" strokeWidth="1" strokeDasharray="4 4" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">
            {t.v >= 1000 ? `${(t.v / 1000).toFixed(0)}k` : Math.round(t.v)}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <polygon points={areaPts} fill="url(#rev-grad)" />
      {/* Line */}
      <polyline fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polyPts} />
      {/* Dots + labels */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#f97316" stroke="var(--card-bg)" strokeWidth="2" />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--mono)">
            {data[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
interface Stats {
  pedidosHoy: number;
  mesasOcupadas: number;
  mesasTotal: number;
  ingresosHoy: number;
  ingresosAyer: number;
  platillosActivos: number;
  reservasHoy: number;
  clientesTotal: number;
  pedidosPendientes: number;
}

interface TrendingPlatillo {
  id_platillo: string;
  nombre_platillo: string;
  precio: number;
  categoria?: string;
  pedidos: number;
}

export const Dashboard: React.FC = () => {
  const { restaurant } = useRestaurant();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    pedidosHoy: 0, mesasOcupadas: 0, mesasTotal: 1, ingresosHoy: 0,
    ingresosAyer: 0, platillosActivos: 0, reservasHoy: 0, clientesTotal: 0, pedidosPendientes: 0,
  });
  const [trending, setTrending] = useState<TrendingPlatillo[]>([]);
  const [revenueChart, setRevenueChart] = useState<{ label: string; value: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<PedidoRestaurante[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!restaurant) { setLoading(false); return; }
    const id = restaurant.id_restaurant;
    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    setLoading(true);

    const [
      mesasRes, platillosRes, reservasRes, clientesRes,
      pedidosHoyRes, pedidosAyerRes, recentRes,
    ] = await Promise.allSettled([
      supabase.from('mesa_restaurante').select('id_mesa, estado').eq('id_restaurant', id),
      supabase.from('platillo').select('id_platillo, nombre_platillo, precio, activo, categoria_platillo(nombre_categoria)').eq('id_restaurant', id).eq('activo', true),
      supabase.from('reserva').select('id_reserva', { count: 'exact' }).eq('id_restaurant', id).eq('fecha_reserva', hoy),
      supabase.from('cliente_restaurante').select('id_cliente', { count: 'exact' }).eq('id_restaurant', id),
      supabase.from('pedido_restaurante').select('id_pedido, estado_pedido, detalle_pedido_restaurante(id_platillo, precio_unitario, cantidad)').eq('id_restaurant', id).gte('fecha_pedido', `${hoy}T00:00:00`),
      supabase.from('pedido_restaurante').select('id_pedido, detalle_pedido_restaurante(precio_unitario, cantidad)').eq('id_restaurant', id).gte('fecha_pedido', `${ayer}T00:00:00`).lt('fecha_pedido', `${hoy}T00:00:00`),
      supabase.from('pedido_restaurante').select('*, cliente_restaurante(nombre, apellido), mesa_restaurante(numero_mesa)').eq('id_restaurant', id).order('fecha_pedido', { ascending: false }).limit(5),
    ]);

    // Mesas
    const mesas = mesasRes.status === 'fulfilled' ? (mesasRes.value.data ?? []) : [];
    const mesasOcupadas = mesas.filter((m: any) => m.estado === 'ocupada').length;
    const mesasTotal = mesas.length || 1;

    // Platillos
    const platillos: any[] = platillosRes.status === 'fulfilled' ? (platillosRes.value.data ?? []) : [];

    // Reservas
    const reservasHoy = reservasRes.status === 'fulfilled' ? (reservasRes.value.count ?? 0) : 0;

    // Clientes
    const clientesTotal = clientesRes.status === 'fulfilled' ? (clientesRes.value.count ?? 0) : 0;

    // Pedidos hoy
    let ingresosHoy = 0, pedidosHoyCount = 0, pendientesCount = 0;
    const platilloCount: Record<string, number> = {};
    if (pedidosHoyRes.status === 'fulfilled' && pedidosHoyRes.value.data) {
      const data = pedidosHoyRes.value.data;
      pedidosHoyCount = data.length;
      pendientesCount = data.filter((p: any) => p.estado_pedido === 'pendiente' || p.estado_pedido === 'preparando').length;
      for (const p of data) {
        const detalles: any[] = p.detalle_pedido_restaurante ?? [];
        for (const d of detalles) {
          ingresosHoy += (d.precio_unitario ?? 0) * (d.cantidad ?? 0);
          if (d.id_platillo) platilloCount[d.id_platillo] = (platilloCount[d.id_platillo] ?? 0) + (d.cantidad ?? 1);
        }
      }
    }

    // Ingresos ayer
    let ingresosAyer = 0;
    if (pedidosAyerRes.status === 'fulfilled' && pedidosAyerRes.value.data) {
      for (const p of pedidosAyerRes.value.data) {
        for (const d of (p.detalle_pedido_restaurante ?? [])) {
          ingresosAyer += (d.precio_unitario ?? 0) * (d.cantidad ?? 0);
        }
      }
    }

    // Trending platillos — top 5 by pedidos today
    const trendingList: TrendingPlatillo[] = platillos
      .map((p: any) => ({
        id_platillo: p.id_platillo,
        nombre_platillo: p.nombre_platillo,
        precio: p.precio,
        categoria: p.categoria_platillo?.nombre_categoria,
        pedidos: platilloCount[p.id_platillo] ?? 0,
      }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 5);

    setTrending(trendingList);

    // Revenue chart — last 7 days
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return {
        iso: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('es-HN', { weekday: 'short' }).slice(0, 3),
      };
    });

    const revResults = await Promise.all(
      days.map(day =>
        supabase
          .from('pedido_restaurante')
          .select('detalle_pedido_restaurante(precio_unitario, cantidad)')
          .eq('id_restaurant', id)
          .gte('fecha_pedido', `${day.iso}T00:00:00`)
          .lt('fecha_pedido', `${day.iso}T23:59:59`)
      )
    );

    const chartData = days.map((day, i) => {
      const res = revResults[i];
      const total = res.data?.reduce((sum: number, p: any) => {
        return sum + (p.detalle_pedido_restaurante ?? []).reduce((s: number, d: any) =>
          s + (d.precio_unitario ?? 0) * (d.cantidad ?? 0), 0);
      }, 0) ?? 0;
      return { label: day.label, value: total };
    });

    setRevenueChart(chartData);

    // Recent orders
    if (recentRes.status === 'fulfilled') {
      setRecentOrders(recentRes.value.data ?? []);
    }

    setStats({
      pedidosHoy: pedidosHoyCount,
      mesasOcupadas,
      mesasTotal,
      ingresosHoy,
      ingresosAyer,
      platillosActivos: platillos.length,
      reservasHoy,
      clientesTotal,
      pedidosPendientes: pendientesCount,
    });

    setLoading(false);
  }, [restaurant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const ingresosDelta = stats.ingresosAyer > 0
    ? ((stats.ingresosHoy - stats.ingresosAyer) / stats.ingresosAyer) * 100
    : null;

  const estadoColor: Record<string, string> = {
    pendiente: 'badge-yellow',
    preparando: 'badge-orange',
    servido: 'badge-green',
    cancelado: 'badge-red',
  };

  // ── KPI cards config ────────────────────────────────────────────────
  const kpis = [
    {
      label: 'Ingresos del Día',
      value: fmtShort(stats.ingresosHoy),
      sub: ingresosDelta !== null
        ? `${ingresosDelta >= 0 ? '+' : ''}${ingresosDelta.toFixed(1)}% vs ayer`
        : 'sin datos de ayer',
      icon: <DollarSign size={20} />,
      color: '#f97316',
      bg: 'rgba(249,115,22,0.10)',
      ring: stats.ingresosHoy,
      ringMax: Math.max(stats.ingresosHoy, stats.ingresosAyer, 1),
      trend: ingresosDelta,
    },
    {
      label: 'Pedidos Hoy',
      value: stats.pedidosHoy,
      sub: `${stats.pedidosPendientes} activos`,
      icon: <ShoppingBag size={20} />,
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.10)',
      ring: stats.pedidosHoy,
      ringMax: Math.max(stats.pedidosHoy, 20),
      trend: null,
    },
    {
      label: 'Mesas Ocupadas',
      value: `${stats.mesasOcupadas}/${stats.mesasTotal}`,
      sub: `${Math.round((stats.mesasOcupadas / stats.mesasTotal) * 100)}% ocupación`,
      icon: <Coffee size={20} />,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.10)',
      ring: stats.mesasOcupadas,
      ringMax: stats.mesasTotal,
      trend: null,
    },
    {
      label: 'Reservas Hoy',
      value: stats.reservasHoy,
      sub: `${stats.clientesTotal} clientes registrados`,
      icon: <CalendarCheck size={20} />,
      color: '#8b5cf6',
      bg: 'rgba(139,92,246,0.10)',
      ring: stats.reservasHoy,
      ringMax: Math.max(stats.reservasHoy, 10),
      trend: null,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <span className="page-kicker">
            {hora()} · {new Date().toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
          <div className="page-title">{GREETINGS[role] ?? restaurant?.nombre_restaurante ?? 'Dashboard'}</div>
          <div className="page-subtitle">{restaurant?.nombre_restaurante}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: '6px 14px', borderRadius: 20,
            background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
            fontSize: 12, fontWeight: 700, color: 'var(--accent)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
            En servicio
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <div className="auth-loading-spinner" style={{ width: 18, height: 18 }} />
          Cargando métricas...
        </div>
      ) : !restaurant ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 13 }}>
          No se encontraron datos de este restaurante.
        </div>
      ) : (
        <>
          {/* ── Acciones Rápidas ──────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            {[
              {
                label: 'Nueva Orden',
                icon: <Plus size={18} />,
                color: '#f97316',
                bg: 'rgba(249,115,22,0.12)',
                border: 'rgba(249,115,22,0.30)',
                path: '/pedidos',
              },
              {
                label: 'Cobrar Mesa',
                icon: <CreditCard size={18} />,
                color: '#22c55e',
                bg: 'rgba(34,197,94,0.10)',
                border: 'rgba(34,197,94,0.25)',
                path: '/facturas',
              },
              {
                label: 'Registrar Gasto',
                icon: <Receipt size={18} />,
                color: '#8b5cf6',
                bg: 'rgba(139,92,246,0.10)',
                border: 'rgba(139,92,246,0.25)',
                path: '/gastos',
              },
            ].map(a => (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '14px 8px', borderRadius: 14,
                  background: a.bg, border: `1px solid ${a.border}`,
                  cursor: 'pointer', transition: 'all 0.15s ease', color: a.color,
                  fontFamily: 'var(--body)', fontWeight: 700, fontSize: 12,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 20px ${a.color}25`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${a.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {a.icon}
                </div>
                {a.label}
              </button>
            ))}
          </div>

          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
            {kpis.map((k, i) => (
              <div
                key={k.label}
                className="stat-card"
                style={{ animation: `fadeInUp 0.35s ease-out ${i * 0.06}s both` }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>{k.label}</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 32, color: 'var(--text-h)', lineHeight: 1, letterSpacing: '0.01em' }}>
                      {k.value}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      {k.trend !== null && (
                        k.trend >= 0
                          ? <TrendingUp size={12} color="var(--success)" />
                          : <TrendingDown size={12} color="var(--danger)" />
                      )}
                      <span style={{ fontSize: 11, color: k.trend !== null ? (k.trend >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--muted)' }}>
                        {k.sub}
                      </span>
                    </div>
                  </div>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <DonutRing value={k.ring} max={k.ringMax} color={k.color} size={60} stroke={6} />
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: k.color, background: k.bg, borderRadius: '50%',
                      width: 36, height: 36, margin: 'auto', top: 0, bottom: 0,
                    }}>
                      {k.icon}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Middle row: Trending + Revenue ────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: 20 }}>

            {/* Trending Platillos */}
            <div className="dashboard-card" style={{ animation: 'fadeInUp 0.4s ease-out 0.25s both' }}>
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Platillos Populares</div>
                  <div className="dashboard-card-sub">Top pedidos del día</div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 20,
                  background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                }}>
                  Hoy
                </div>
              </div>
              <div className="dashboard-card-body" style={{ padding: '4px 22px 14px' }}>
                {trending.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>
                    Sin pedidos registrados hoy
                  </div>
                ) : (
                  trending.map((p, i) => (
                    <div key={p.id_platillo} className="trending-item">
                      <div className="trending-rank">#{i + 1}</div>
                      <div className="trending-img-placeholder">
                        <UtensilsCrossed size={18} />
                      </div>
                      <div className="trending-info">
                        <div className="trending-name">{p.nombre_platillo}</div>
                        <div className="trending-cat">{p.categoria ?? 'Sin categoría'}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-h)' }}>
                          L.{p.precio.toFixed(0)}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                          {p.pedidos > 0 ? `${p.pedidos} pedido${p.pedidos !== 1 ? 's' : ''}` : 'en menú'}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Revenue chart */}
            <div className="dashboard-card" style={{ animation: 'fadeInUp 0.4s ease-out 0.3s both' }}>
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Ingresos — Últimos 7 días</div>
                  <div className="dashboard-card-sub">Ingresos diarios en Lempiras</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: 'var(--text-h)', lineHeight: 1 }}>
                    {fmtShort(revenueChart.reduce((s, d) => s + d.value, 0))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>total 7 días</div>
                </div>
              </div>
              <div className="dashboard-card-body">
                {revenueChart.every(d => d.value === 0) ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
                    Sin ingresos registrados esta semana
                  </div>
                ) : (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <RevenueChart data={revenueChart} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Recent orders ──────────────────────────────────────── */}
          <div className="dashboard-card" style={{ animation: 'fadeInUp 0.4s ease-out 0.35s both' }}>
            <div className="dashboard-card-header">
              <div>
                <div className="dashboard-card-title">Pedidos Recientes</div>
                <div className="dashboard-card-sub">Últimos 5 pedidos registrados</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--success-bg)', fontSize: 11, fontWeight: 700, color: 'var(--success)' }}>
                  {stats.pedidosHoy} hoy
                </div>
                {stats.pedidosPendientes > 0 && (
                  <div style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--warning-bg)', fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}>
                    {stats.pedidosPendientes} activos
                  </div>
                )}
              </div>
            </div>
            {recentOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
                Sin pedidos recientes
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Mesa</th>
                    <th>Estado</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(p => (
                    <tr key={p.id_pedido}>
                      <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>
                        {p.cliente_restaurante
                          ? `${p.cliente_restaurante.nombre} ${p.cliente_restaurante.apellido}`
                          : 'Cliente sin nombre'}
                      </td>
                      <td style={{ color: 'var(--muted)' }}>
                        {p.mesa_restaurante ? `Mesa ${p.mesa_restaurante.numero_mesa}` : '—'}
                      </td>
                      <td>
                        <span className={`badge ${estadoColor[p.estado_pedido] ?? 'badge-gray'}`}>
                          {p.estado_pedido}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                        {new Date(p.fecha_pedido).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Bottom mini-stats ──────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginTop: 16 }}>
            {[
              { label: 'Platillos Activos', value: stats.platillosActivos, icon: <UtensilsCrossed size={16} />, color: '#f97316' },
              { label: 'Clientes Total', value: stats.clientesTotal, icon: <Users size={16} />, color: '#3b82f6' },
            ].map((m, i) => (
              <div
                key={m.label}
                className="stat-card"
                style={{ animation: `fadeInUp 0.35s ease-out ${0.4 + i * 0.05}s both`, padding: 16 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${m.color}18`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {m.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 24, color: 'var(--text-h)', lineHeight: 1 }}>{m.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{m.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
