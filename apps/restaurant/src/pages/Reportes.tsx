import React, { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart3, ShoppingBag, Wallet, PieChart, Users } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { supabase } from '../api/supabase';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL', maximumFractionDigits: 0 }).format(n);
const fmtShort = (n: number) =>
  n >= 1000 ? `L. ${(n / 1000).toFixed(1)}k` : `L. ${n.toFixed(0)}`;

// ── Bar chart SVG ─────────────────────────────────────────────────────────────
const BarChart: React.FC<{
  data: { label: string; value: number; value2?: number }[];
  color?: string;
  color2?: string;
  height?: number;
}> = ({ data, color = '#f97316', color2, height = 140 }) => {
  if (!data.length) return null;
  const W = 560; const H = height; const PAD = { t: 8, r: 10, b: 28, l: 52 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const allVals = data.flatMap(d => color2 ? [d.value, d.value2 ?? 0] : [d.value]);
  const max = Math.max(...allVals, 1);
  const barW = (iW / data.length) * 0.35;
  const gap = iW / data.length;
  const yTicks = [0, 0.5, 1].map(f => ({ v: max * f, y: PAD.t + (1 - f) * iH }));

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="var(--shell-border)" strokeWidth="1" strokeDasharray="4 4" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="var(--muted)" fontFamily="var(--mono)">
            {t.v >= 1000 ? `${(t.v / 1000).toFixed(0)}k` : Math.round(t.v)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = PAD.l + i * gap + gap / 2;
        const bh = (d.value / max) * iH;
        const bh2 = ((d.value2 ?? 0) / max) * iH;
        return (
          <g key={i}>
            {color2 && (
              <rect
                x={cx - barW - 2} y={PAD.t + iH - bh2} width={barW} height={bh2}
                rx="3" fill={color2} opacity="0.7"
              />
            )}
            <rect
              x={color2 ? cx + 2 : cx - barW / 2} y={PAD.t + iH - bh} width={barW} height={bh}
              rx="3" fill={color}
            />
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--mono)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ── Area chart SVG ────────────────────────────────────────────────────────────
const AreaChart: React.FC<{ data: { label: string; value: number }[]; color?: string; height?: number }> = ({
  data, color = '#f97316', height = 140,
}) => {
  if (!data.length) return null;
  const W = 560; const H = height; const PAD = { t: 8, r: 16, b: 28, l: 52 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;
  const max = Math.max(...data.map(d => d.value), 1);
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / Math.max(data.length - 1, 1)) * iW,
    y: PAD.t + (1 - d.value / max) * iH,
  }));
  const polyPts = pts.map(p => `${p.x},${p.y}`).join(' ');
  const areaPts = [`${pts[0].x},${PAD.t + iH}`, ...pts.map(p => `${p.x},${p.y}`), `${pts[pts.length-1].x},${PAD.t + iH}`].join(' ');
  const yTicks = [0, 0.5, 1].map(f => ({ v: max * f, y: PAD.t + (1 - f) * iH }));
  const gradId = `area-grad-${color.replace('#', '')}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="var(--shell-border)" strokeWidth="1" strokeDasharray="4 4" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="var(--muted)" fontFamily="var(--mono)">
            {t.v >= 1000 ? `${(t.v / 1000).toFixed(0)}k` : Math.round(t.v)}
          </text>
        </g>
      ))}
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polyPts} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill={color} stroke="var(--card-bg)" strokeWidth="2" />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)" fontFamily="var(--mono)">
            {data[i].label}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface ReportData {
  ingresos30: number;
  ingresosAnt30: number;
  gastos30: number;
  pedidos30: number;
  ticketPromedio: number;
  topPlatillos: { nombre: string; cantidad: number; ingreso: number }[];
  revenueByWeek: { label: string; value: number }[];
  gastosVsIngresos: { label: string; value: number; value2: number }[];
  byCategory: { label: string; value: number }[];
  clientesNuevos30: number;
  reservas30: number;
}

// ── Stat card mini ────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; trend?: number | null;
}> = ({ label, value, sub, icon, color, trend }) => (
  <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
    </div>
    <div style={{ fontFamily: 'var(--display)', fontSize: 28, color: 'var(--text-h)', lineHeight: 1 }}>{value}</div>
    {(sub || trend !== null && trend !== undefined) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {trend !== null && trend !== undefined && (
          trend >= 0
            ? <TrendingUp size={12} color="var(--success)" />
            : <TrendingDown size={12} color="var(--danger)" />
        )}
        <span style={{ fontSize: 11, color: trend !== null && trend !== undefined ? (trend >= 0 ? 'var(--success)' : 'var(--danger)') : 'var(--muted)' }}>
          {sub}
        </span>
      </div>
    )}
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
export const Reportes: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!restaurant) { setLoading(false); return; }
    const id = restaurant.id_restaurant;

    const now = new Date();
    const d30ago = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
const d30str = new Date(now.getTime() - 30 * 86400000).toISOString();
    const d60str = new Date(now.getTime() - 60 * 86400000).toISOString();

    setLoading(true);

    // Llamamos al mismo RPC que usa Sol IA + queries auxiliares en paralelo
    const [rpcRes, pedidos30Res, pedidosAnt30Res, gastos30Res, clientes30Res, reservas30Res] = await Promise.allSettled([
      supabase.rpc('get_restaurant_ai_context', { p_restaurant_id: Number(id) }),
      supabase.from('pedido_restaurante')
        .select('id_pedido, fecha_pedido, estado_pedido, detalle_pedido_restaurante(precio_unitario, cantidad)')
        .eq('id_restaurant', id)
        .gte('fecha_pedido', d30str),
      supabase.from('pedido_restaurante')
        .select('id_pedido, detalle_pedido_restaurante(precio_unitario, cantidad)')
        .eq('id_restaurant', id)
        .gte('fecha_pedido', d60str)
        .lt('fecha_pedido', d30str),
      supabase.from('pagos_rest').select('monto, fecha_pago').eq('id_restaurante', id).gte('fecha_pago', d30ago),
      supabase.from('cliente_restaurante').select('id_cliente, fecha_registro').eq('id_restaurant', id).gte('fecha_registro', d30str),
      supabase.from('reserva').select('id_reserva', { count: 'exact' }).eq('id_restaurant', id).gte('fecha_reserva', d30ago),
    ]);

    // Top platillos desde el mismo RPC que usa Sol IA (mismos números)
    const rpcCtx = rpcRes.status === 'fulfilled' ? (rpcRes.value.data as any) : null;
    const rpcTopPlatillos: any[] = rpcCtx?.top_platillos_mes ?? [];
    const topPlatillos = rpcTopPlatillos.slice(0, 8).map((t: any) => ({
      nombre: t.nombre_platillo,
      cantidad: Number(t.total_pedidos ?? 0),
      ingreso: Number(t.total_ingresos ?? 0),
    }));

    // Ingresos 30 días desde pedidos (para gráficas de semana y gastos vs ingresos)
    const pedidos30 = pedidos30Res.status === 'fulfilled' ? (pedidos30Res.value.data ?? []) : [];
    let ingresos30 = 0;
    let pedidos30Count = pedidos30.filter((p: any) => p.estado_pedido !== 'cancelado').length;

    for (const p of pedidos30) {
      if (p.estado_pedido === 'cancelado') continue;
      for (const d of (p.detalle_pedido_restaurante ?? [])) {
        ingresos30 += (d.precio_unitario ?? 0) * (d.cantidad ?? 0);
      }
    }

    // Ingresos período anterior
    const pedidosAnt30 = pedidosAnt30Res.status === 'fulfilled' ? (pedidosAnt30Res.value.data ?? []) : [];
    let ingresosAnt30 = 0;
    for (const p of pedidosAnt30) {
      for (const d of (p.detalle_pedido_restaurante ?? [])) {
        ingresosAnt30 += (d.precio_unitario ?? 0) * (d.cantidad ?? 0);
      }
    }

    // Gastos
    const gastos30 = gastos30Res.status === 'fulfilled' ? (gastos30Res.value.data ?? []) : [];
    const totalGastos30 = gastos30.reduce((s: number, g: any) => s + (g.monto ?? 0), 0);

    // Ticket promedio
    const ticketPromedio = pedidos30Count > 0 ? ingresos30 / pedidos30Count : 0;

    // Revenue últimas 4 semanas
    const weeks = Array.from({ length: 4 }, (_, i) => {
      const from = new Date(now.getTime() - (4 - i) * 7 * 86400000);
      const to = new Date(now.getTime() - (3 - i) * 7 * 86400000);
      return { label: `S-${4 - i}`, from: from.toISOString(), to: to.toISOString() };
    });

    const revenueByWeek = weeks.map(w => {
      const total = pedidos30
        .filter((p: any) => p.estado_pedido !== 'cancelado' && p.fecha_pedido >= w.from && p.fecha_pedido < w.to)
        .reduce((s: number, p: any) =>
          s + (p.detalle_pedido_restaurante ?? []).reduce((ss: number, d: any) =>
            ss + (d.precio_unitario ?? 0) * (d.cantidad ?? 0), 0), 0);
      return { label: w.label, value: total };
    });

    // Gastos vs ingresos últimos 7 días
    const days7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * 86400000);
      return { iso: d.toISOString().split('T')[0], label: d.toLocaleDateString('es-HN', { weekday: 'short' }).slice(0, 3) };
    });

    const gastosVsIngresos = days7.map(day => {
      const ing = pedidos30
        .filter((p: any) => p.estado_pedido !== 'cancelado' && p.fecha_pedido.startsWith(day.iso))
        .reduce((s: number, p: any) =>
          s + (p.detalle_pedido_restaurante ?? []).reduce((ss: number, d: any) =>
            ss + (d.precio_unitario ?? 0) * (d.cantidad ?? 0), 0), 0);
      const gst = gastos30.filter((g: any) => g.fecha_pago === day.iso).reduce((s: number, g: any) => s + (g.monto ?? 0), 0);
      return { label: day.label, value: ing, value2: gst };
    });

    // Por categoría desde el top del RPC (si tiene categoria) o agrupando los top platillos
    const catMap: Record<string, number> = {};
    for (const t of rpcTopPlatillos) {
      const cat = t.categoria ?? t.nombre_categoria ?? 'Otros';
      catMap[cat] = (catMap[cat] ?? 0) + Number(t.total_ingresos ?? 0);
    }
    const byCategory = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label: label.slice(0, 10), value }));

    setData({
      ingresos30,
      ingresosAnt30,
      gastos30: totalGastos30,
      pedidos30: pedidos30Count,
      ticketPromedio,
      topPlatillos,
      revenueByWeek,
      gastosVsIngresos,
      byCategory,
      clientesNuevos30: clientes30Res.status === 'fulfilled' ? (clientes30Res.value.data?.length ?? 0) : 0,
      reservas30: reservas30Res.status === 'fulfilled' ? (reservas30Res.value.count ?? 0) : 0,
    });

    setLoading(false);
  }, [restaurant]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const ingresosDelta = data && data.ingresosAnt30 > 0
    ? ((data.ingresos30 - data.ingresosAnt30) / data.ingresosAnt30) * 100
    : null;

  const margenBruto = data && data.ingresos30 > 0
    ? ((data.ingresos30 - data.gastos30) / data.ingresos30) * 100
    : null;

  return (
    <div>
      <div className="page-header">
        <span className="page-kicker">Plan Pro · Últimos 30 días</span>
        <div className="page-title">Reportes y Análisis</div>
        <div className="page-subtitle">{restaurant?.nombre_restaurante}</div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)', fontSize: 13 }}>
          <div className="auth-loading-spinner" style={{ width: 18, height: 18 }} />
          Cargando reportes...
        </div>
      ) : !data ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 13 }}>
          No se pudieron cargar los datos.
        </div>
      ) : (
        <>
          {/* KPIs principales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            <KpiCard
              label="Ingresos 30 días"
              value={fmtShort(data.ingresos30)}
              sub={ingresosDelta !== null ? `${ingresosDelta >= 0 ? '+' : ''}${ingresosDelta.toFixed(1)}% vs periodo ant.` : 'sin datos anteriores'}
              icon={<TrendingUp size={16} />}
              color="#f97316"
              trend={ingresosDelta}
            />
            <KpiCard
              label="Gastos 30 días"
              value={fmtShort(data.gastos30)}
              sub={margenBruto !== null ? `Margen bruto: ${margenBruto.toFixed(1)}%` : undefined}
              icon={<Wallet size={16} />}
              color="#ef4444"
            />
            <KpiCard
              label="Pedidos Completados"
              value={data.pedidos30}
              sub={`Ticket promedio: ${fmtShort(data.ticketPromedio)}`}
              icon={<ShoppingBag size={16} />}
              color="#3b82f6"
              trend={null}
            />
            <KpiCard
              label="Clientes Nuevos"
              value={data.clientesNuevos30}
              sub={`${data.reservas30} reservas`}
              icon={<Users size={16} />}
              color="#8b5cf6"
              trend={null}
            />
          </div>

          {/* Gráficas fila 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Ingresos por semana */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Ingresos por Semana</div>
                  <div className="dashboard-card-sub">Últimas 4 semanas</div>
                </div>
                <BarChart3 size={16} color="var(--muted)" />
              </div>
              <div className="dashboard-card-body">
                {data.revenueByWeek.every(d => d.value === 0) ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>Sin ingresos este mes</div>
                ) : (
                  <BarChart data={data.revenueByWeek} color="#f97316" height={140} />
                )}
              </div>
            </div>

            {/* Ingresos vs Gastos últimos 7 días */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Ingresos vs Gastos</div>
                  <div className="dashboard-card-sub">Últimos 7 días</div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#f97316', display: 'inline-block' }} /> Ingresos
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} /> Gastos
                  </span>
                </div>
              </div>
              <div className="dashboard-card-body">
                {data.gastosVsIngresos.every(d => d.value === 0 && d.value2 === 0) ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>Sin datos esta semana</div>
                ) : (
                  <BarChart data={data.gastosVsIngresos} color="#f97316" color2="#ef4444" height={140} />
                )}
              </div>
            </div>
          </div>

          {/* Fila 2: Top platillos + por categoría */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Top platillos */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Top Platillos</div>
                  <div className="dashboard-card-sub">Por ingreso generado — últimos 30 días</div>
                </div>
              </div>
              <div className="dashboard-card-body" style={{ padding: '0 22px 14px' }}>
                {data.topPlatillos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>Sin pedidos este mes</div>
                ) : (
                  <div>
                    {data.topPlatillos.map((p, i) => {
                      const maxIngreso = data.topPlatillos[0].ingreso;
                      const pct = maxIngreso > 0 ? (p.ingreso / maxIngreso) * 100 : 0;
                      const colors = ['#f97316','#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#84cc16'];
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--shell-border-subtle)' }}>
                          <div style={{ width: 22, height: 22, borderRadius: 4, background: `${colors[i % colors.length]}18`, color: colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 800 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</div>
                            <div style={{ height: 3, background: 'var(--shell-border)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: 2, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-h)' }}>{fmtShort(p.ingreso)}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.cantidad} pedidos</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Por categoría */}
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Ingresos por Categoría</div>
                  <div className="dashboard-card-sub">Distribución últimos 30 días</div>
                </div>
                <PieChart size={16} color="var(--muted)" />
              </div>
              <div className="dashboard-card-body">
                {data.byCategory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 12 }}>Sin datos</div>
                ) : (
                  <>
                    <AreaChart data={data.byCategory} color="#8b5cf6" height={100} />
                    <div style={{ padding: '8px 22px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {data.byCategory.map((c, i) => {
                        const total = data.byCategory.reduce((s, d) => s + d.value, 0);
                        const pct = total > 0 ? (c.value / total * 100).toFixed(1) : '0';
                        const colors = ['#8b5cf6','#f97316','#3b82f6','#10b981','#f59e0b','#ef4444'];
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{c.label}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{pct}%</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--text-h)', minWidth: 52, textAlign: 'right' }}>{fmtShort(c.value)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Resumen de rentabilidad */}
          {data.ingresos30 > 0 && (
            <div className="dashboard-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="dashboard-card-title">Resumen de Rentabilidad</div>
                  <div className="dashboard-card-sub">Últimos 30 días · consolidado</div>
                </div>
              </div>
              <div className="dashboard-card-body" style={{ padding: '12px 22px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                {[
                  { label: 'Total Ingresos', value: fmtCurrency(data.ingresos30), color: '#f97316' },
                  { label: 'Total Gastos',   value: fmtCurrency(data.gastos30),   color: '#ef4444' },
                  { label: 'Ganancia Bruta', value: fmtCurrency(data.ingresos30 - data.gastos30), color: data.ingresos30 - data.gastos30 >= 0 ? '#10b981' : '#ef4444' },
                  { label: 'Margen Bruto',   value: margenBruto !== null ? `${margenBruto.toFixed(1)}%` : '—', color: '#8b5cf6' },
                  { label: 'Ticket Promedio',value: fmtCurrency(data.ticketPromedio), color: '#3b82f6' },
                  { label: 'Pedidos / día',  value: (data.pedidos30 / 30).toFixed(1), color: '#f59e0b' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--surface-raised)', border: '1px solid var(--shell-border-subtle)' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>{item.label}</div>
                    <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: item.color, lineHeight: 1 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reportes;
