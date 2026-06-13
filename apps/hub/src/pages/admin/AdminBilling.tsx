import { useEffect, useState } from 'react';
import {
  DollarSign, CheckCircle2, Clock, AlertCircle, Loader2,
  RefreshCw, CreditCard, Download, X, Check,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import apiClient from '../../services/api';

interface BillingEntry {
  owner_id: string;
  nombre_empresa: string;
  email_contacto: string;
  owner_estado: string;
  plan_id: string | null;
  plan_nombre: string | null;
  plan_estado: string | null;
  precio_mensual: number;
  modulos_activos: number;
  estado_pago: 'cobrado' | 'parcial' | 'pendiente' | 'sin_plan';
  monto_pagado: number;
  saldo_pendiente: number;
}

interface Totals {
  total_cobrar: number;
  cobrado: number;
  pendiente: number;
}

interface PaymentModal {
  owner_id: string;
  nombre_empresa: string;
  saldo_pendiente: number;
  precio_mensual: number;
}

const ESTADO_CFG = {
  cobrado:  { label: 'Cobrado',   cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  parcial:  { label: 'Parcial',   cls: 'bg-amber-100 text-amber-700',  icon: AlertCircle  },
  pendiente:{ label: 'Pendiente', cls: 'bg-red-100   text-red-700',    icon: Clock        },
  sin_plan: { label: 'Sin plan',  cls: 'bg-slate-100 text-slate-500',  icon: Clock        },
};

const METODOS = ['transferencia', 'efectivo', 'tarjeta', 'paypal', 'otro'];

function fmt(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentMes() {
  return new Date().toISOString().slice(0, 7);
}

export default function AdminBilling() {
  const [mes, setMes]             = useState(currentMes());
  const [entries, setEntries]     = useState<BillingEntry[]>([]);
  const [totals, setTotals]       = useState<Totals>({ total_cobrar: 0, cobrado: 0, pendiente: 0 });
  const [loading, setLoading]     = useState(true);
  const [payModal, setPayModal]   = useState<PaymentModal | null>(null);
  const [payForm, setPayForm]     = useState({ monto: '', metodo: 'transferencia', concepto: '' });
  const [paying, setPaying]       = useState(false);
  const [filterEstado, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/hub/admin/billing/summary?mes=${mes}`);
      setEntries(res.summary ?? []);
      setTotals(res.totals ?? { total_cobrar: 0, cobrado: 0, pendiente: 0 });
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [mes]);

  const openPayModal = (e: BillingEntry) => {
    setPayModal({ owner_id: e.owner_id, nombre_empresa: e.nombre_empresa, saldo_pendiente: e.saldo_pendiente, precio_mensual: e.precio_mensual });
    setPayForm({ monto: String(e.saldo_pendiente || e.precio_mensual), metodo: 'transferencia', concepto: `Suscripción ${e.plan_nombre || ''} — ${mes}` });
  };

  const registrarPago = async () => {
    if (!payModal || !payForm.monto || Number(payForm.monto) <= 0) return;
    setPaying(true);
    try {
      await apiClient.post('/hub/admin/billing/register-payment', {
        owner_id:    payModal.owner_id,
        monto:       Number(payForm.monto),
        metodo_pago: payForm.metodo,
        concepto:    payForm.concepto,
      });
      setPayModal(null);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPaying(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Empresa', 'Email', 'Plan', 'Precio/mes', 'Módulos activos', 'Estado pago', 'Pagado', 'Saldo'];
    const rows = filtered.map(e => [
      e.nombre_empresa,
      e.email_contacto,
      e.plan_nombre ?? '—',
      e.precio_mensual,
      e.modulos_activos,
      e.estado_pago,
      e.monto_pagado,
      e.saldo_pendiente,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `facturacion_${mes}.csv`;
    a.click();
  };

  const filtered = filterEstado ? entries.filter(e => e.estado_pago === filterEstado) : entries;

  const porcentaje = totals.total_cobrar > 0
    ? Math.round((totals.cobrado / totals.total_cobrar) * 100)
    : 0;

  return (
    <AdminLayout>
      <div className="p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Facturación SaaS</h1>
            <p className="text-slate-500 text-sm mt-1">Resumen mensual de cobros por propietario</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <SummaryCard
            icon={<DollarSign size={20} />}
            label="Total a cobrar"
            value={fmt(totals.total_cobrar)}
            sub={`${entries.filter(e => e.precio_mensual > 0).length} clientes con plan activo`}
            color="blue"
          />
          <SummaryCard
            icon={<CheckCircle2 size={20} />}
            label="Cobrado"
            value={fmt(totals.cobrado)}
            sub={`${porcentaje}% del total`}
            color="green"
          />
          <SummaryCard
            icon={<Clock size={20} />}
            label="Pendiente"
            value={fmt(totals.pendiente)}
            sub={`${entries.filter(e => ['pendiente', 'parcial'].includes(e.estado_pago)).length} clientes sin pago completo`}
            color="red"
          />
        </div>

        {/* Barra de progreso de cobro */}
        {totals.total_cobrar > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">
            <div className="flex justify-between text-sm font-medium text-slate-600 mb-2">
              <span>Progreso de cobro — {mes}</span>
              <span className="text-slate-900 font-bold">{porcentaje}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all duration-500"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1.5">
              <span>{fmt(totals.cobrado)} cobrados</span>
              <span>{fmt(totals.pendiente)} pendientes</span>
            </div>
          </div>
        )}

        {/* Filtro + Export */}
        <div className="flex items-center justify-between mb-4">
          <select
            value={filterEstado}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="cobrado">Cobrado</option>
            <option value="parcial">Parcial</option>
            <option value="pendiente">Pendiente</option>
            <option value="sin_plan">Sin plan</option>
          </select>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <Download size={14} /> Exportar CSV
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sin resultados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Empresa</th>
                  <th className="text-left px-5 py-3">Plan</th>
                  <th className="text-left px-5 py-3">Precio/mes</th>
                  <th className="text-left px-5 py-3">Módulos</th>
                  <th className="text-left px-5 py-3">Pagado</th>
                  <th className="text-left px-5 py-3">Saldo</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => {
                  const cfg = ESTADO_CFG[e.estado_pago] ?? ESTADO_CFG.sin_plan;
                  const Icon = cfg.icon;
                  return (
                    <tr key={e.owner_id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800">{e.nombre_empresa}</p>
                        <p className="text-xs text-slate-400">{e.email_contacto}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {e.plan_nombre ? (
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-lg">
                            {e.plan_nombre}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {e.precio_mensual > 0 ? fmt(e.precio_mensual) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{e.modulos_activos}</td>
                      <td className="px-5 py-3.5 text-green-700 font-medium">
                        {e.monto_pagado > 0 ? fmt(e.monto_pagado) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-red-600 font-medium">
                        {e.saldo_pendiente > 0 ? fmt(e.saldo_pendiente) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
                          <Icon size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {e.estado_pago !== 'cobrado' && e.estado_pago !== 'sin_plan' && (
                          <button
                            onClick={() => openPayModal(e)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition whitespace-nowrap"
                          >
                            <CreditCard size={11} /> Registrar pago
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* Modal registrar pago */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Registrar pago manual</h3>
                <p className="text-sm text-slate-400 mt-0.5">{payModal.nombre_empresa}</p>
              </div>
              <button onClick={() => setPayModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-light leading-none">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Monto (USD)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payForm.monto}
                  onChange={e => setPayForm(f => ({ ...f, monto: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                {payModal.precio_mensual > 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    Precio del plan: {fmt(payModal.precio_mensual)} · Saldo: {fmt(payModal.saldo_pendiente)}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Método de pago</label>
                <select
                  value={payForm.metodo}
                  onChange={e => setPayForm(f => ({ ...f, metodo: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none"
                >
                  {METODOS.map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Concepto</label>
                <input
                  type="text"
                  value={payForm.concepto}
                  onChange={e => setPayForm(f => ({ ...f, concepto: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                disabled={paying || !payForm.monto || Number(payForm.monto) <= 0}
                onClick={registrarPago}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {paying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar pago
              </button>
              <button
                onClick={() => setPayModal(null)}
                className="px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function SummaryCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'green' | 'red';
}) {
  const colors = {
    blue:  'bg-blue-50  text-blue-600',
    green: 'bg-green-50 text-green-600',
    red:   'bg-red-50   text-red-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-slate-500 text-xs mt-1">{label}</p>
      <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
    </div>
  );
}
