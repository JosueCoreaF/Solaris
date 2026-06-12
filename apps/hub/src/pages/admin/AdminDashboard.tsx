import { useEffect, useState } from 'react';
import { Users, Building2, TrendingUp, Package, AlertCircle, Loader2, RefreshCw, Cpu, Zap } from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import apiClient from '../../services/api';

interface Stats {
  totalOwners: number;
  activeOwners: number;
  suspendedOwners: number;
  totalModules: number;
  mrr: number;
  arr: number;
  totalTokens: number;
  totalAiCalls: number;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get('/hub/admin/stats');
      setStats(data);
    } catch (e: any) {
      setError(e.message || 'Error cargando estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Panel Solarys</h1>
            <p className="text-slate-500 text-sm mt-1">Vista global de la plataforma</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center h-60">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : stats && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard icon={<Users size={20} />}     label="Clientes totales"  value={stats.totalOwners}     color="blue"   />
              <KpiCard icon={<Building2 size={20} />} label="Clientes activos"  value={stats.activeOwners}    color="green"  />
              <KpiCard icon={<AlertCircle size={20} />} label="Suspendidos"     value={stats.suspendedOwners} color="red"    />
              <KpiCard icon={<Package size={20} />}   label="Módulos activos"   value={stats.totalModules}    color="purple" />
            </div>

            {/* MRR / ARR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3 opacity-80">
                  <TrendingUp size={18} />
                  <span className="text-sm font-medium">MRR (Ingresos mensuales)</span>
                </div>
                <p className="text-4xl font-bold">${stats.mrr.toLocaleString()}</p>
                <p className="text-indigo-200 text-sm mt-1">USD / mes</p>
              </div>
              <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3 opacity-80">
                  <TrendingUp size={18} />
                  <span className="text-sm font-medium">ARR (Ingresos anuales)</span>
                </div>
                <p className="text-4xl font-bold">${stats.arr.toLocaleString()}</p>
                <p className="text-violet-200 text-sm mt-1">USD / año</p>
              </div>
            </div>

            {/* IA Metrics */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Consumo de IA — plataforma total</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-violet-700 to-purple-800 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-2 mb-3 opacity-80">
                    <Zap size={18} />
                    <span className="text-sm font-medium">Tokens procesados</span>
                  </div>
                  <p className="text-4xl font-bold">{fmtTokens(stats.totalTokens)}</p>
                  <p className="text-purple-300 text-sm mt-1">
                    {stats.totalTokens.toLocaleString()} tokens acumulados
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="inline-flex p-2 rounded-xl bg-violet-50 text-violet-600">
                      <Cpu size={18} />
                    </div>
                  </div>
                  <p className="text-4xl font-bold text-slate-900">{stats.totalAiCalls.toLocaleString()}</p>
                  <p className="text-slate-500 text-sm mt-1">Llamadas totales al asistente IA</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    red:    'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className={`inline-flex p-2 rounded-xl mb-3 ${colors[color]}`}>{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="text-slate-500 text-sm mt-1">{label}</p>
    </div>
  );
}
