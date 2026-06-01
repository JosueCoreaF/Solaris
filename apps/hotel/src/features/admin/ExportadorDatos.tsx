/**
 * ExportadorDatos.tsx
 * Interfaz premium y formal para la exportación de bases de datos operativas en CSV o JSON.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  Briefcase,
  Wallet,
  CreditCard,
  MessageSquare,
  Tags,
  Download,
  Database,
  Info,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { supabase } from '../../api/supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Counts {
  clientes: number;
  reservas: number;
  empresas: number;
  saldos: number;
  pagos: number;
  chats: number;
  tarifas: number;
}

interface ModuleConfig {
  key: keyof Counts;
  endpoint: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badgeColor: string;
  hasDateFilter: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportadorDatos: React.FC = () => {
  const [counts, setCounts] = useState<Partial<Counts>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Date filters per module
  const [dateFilters, setDateFilters] = useState<Record<string, { desde: string; hasta: string }>>({
    reservas: { desde: '', hasta: '' },
    saldos: { desde: '', hasta: '' },
    pagos: { desde: '', hasta: '' },
    chats: { desde: '', hasta: '' },
  });

  const activeHotelId = localStorage.getItem('active_hotel_id') || '';

  const MODULES: ModuleConfig[] = [
    {
      key: 'clientes',
      endpoint: 'huespedes',
      label: 'Huéspedes',
      description: 'Listado completo de clientes registrados con sus datos de contacto.',
      icon: <Users className="w-5 h-5" />,
      color: 'blue',
      badgeColor: 'bg-blue-50 border-blue-100 text-blue-600',
      hasDateFilter: false,
    },
    {
      key: 'reservas',
      endpoint: 'reservas',
      label: 'Reservas del Hotel',
      description: 'Historial detallado de reservas de estadías filtradas por rango de fechas.',
      icon: <Calendar className="w-5 h-5" />,
      color: 'indigo',
      badgeColor: 'bg-indigo-50 border-indigo-100 text-indigo-600',
      hasDateFilter: true,
    },
    {
      key: 'empresas',
      endpoint: 'empresas',
      label: 'Empresas & Créditos',
      description: 'Directorio de empresas corporativas y cuentas con crédito activo.',
      icon: <Briefcase className="w-5 h-5" />,
      color: 'amber',
      badgeColor: 'bg-amber-50 border-amber-100 text-amber-600',
      hasDateFilter: false,
    },
    {
      key: 'saldos',
      endpoint: 'saldos',
      label: 'Estados de Cuenta',
      description: 'Saldos insolutos, créditos pendientes y movimientos financieros de clientes.',
      icon: <Wallet className="w-5 h-5" />,
      color: 'emerald',
      badgeColor: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      hasDateFilter: true,
    },
    {
      key: 'pagos',
      endpoint: 'pagos',
      label: 'Transacciones de Pago',
      description: 'Libro de transacciones y conciliaciones de pagos físicos y digitales.',
      icon: <CreditCard className="w-5 h-5" />,
      color: 'rose',
      badgeColor: 'bg-rose-50 border-rose-100 text-rose-600',
      hasDateFilter: true,
    },
    {
      key: 'chats',
      endpoint: 'chats',
      label: 'Chats & Canales',
      description: 'Historial completo de mensajes operativos y registros de canales de chat.',
      icon: <MessageSquare className="w-5 h-5" />,
      color: 'teal',
      badgeColor: 'bg-teal-50 border-teal-100 text-teal-600',
      hasDateFilter: true,
    },
    {
      key: 'tarifas',
      endpoint: 'tarifas',
      label: 'Esquema de Tarifas',
      description: 'Catálogo formal de tarifas, categorías configuradas y tipos de habitación.',
      icon: <Tags className="w-5 h-5" />,
      color: 'violet',
      badgeColor: 'bg-violet-50 border-violet-100 text-violet-600',
      hasDateFilter: false,
    },
  ];

  // ── Load counts ──────────────────────────────────────────────────────────────
  const loadCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || '';
      const res = await fetch(`${API_BASE}/hotel/exports/counts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Hotel-ID': activeHotelId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data);
      }
    } catch (e) {
      console.error('Error loading counts:', e);
    } finally {
      setLoadingCounts(false);
    }
  }, [activeHotelId]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  // ── Download ─────────────────────────────────────────────────────────────────
  const handleDownload = async (mod: ModuleConfig, format: 'csv' | 'json') => {
    const key = `${mod.key}-${format}`;
    setDownloading(key);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token || '';
      const df = dateFilters[mod.endpoint] || { desde: '', hasta: '' };
      const params = new URLSearchParams({ format });
      if (df.desde) params.set('desde', df.desde);
      if (df.hasta) params.set('hasta', df.hasta);

      const res = await fetch(`${API_BASE}/hotel/exports/${mod.endpoint}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Hotel-ID': activeHotelId,
        },
      });

      if (!res.ok) throw new Error('Error al exportar');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cd = res.headers.get('Content-Disposition') || '';
      const fileMatch = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = fileMatch ? fileMatch[1] : `${mod.endpoint}_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Error al descargar. Verifica la conexión con el servidor.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-slate-50/50 to-blue-50/20 text-slate-700 p-8 relative overflow-hidden font-sans">
      {/* Ambient glows */}
      <div className="absolute top-[-200px] right-[-100px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none"></div>

      {/* Header Premium */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 border-b border-slate-200/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" /> Seguridad de Datos
          </div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-indigo-600 stroke-[1.5]" />
            Exportación & Respaldos
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 font-normal flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Descarga de manera formal y segura copias completas de la base de datos operativa del hotel activo.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCounts}
            className="flex items-center justify-center p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Recargar Volúmenes"
          >
            <RefreshCw size={16} className={`${loadingCounts ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
        {MODULES.map((mod) => {
          const count = counts[mod.key];
          const df = dateFilters[mod.endpoint] || { desde: '', hasta: '' };
          const isDownloadingCSV = downloading === `${mod.key}-csv`;
          const isDownloadingJSON = downloading === `${mod.key}-json`;

          return (
            <div
              key={mod.key}
              className="bg-white/80 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-slate-300 shadow-sm overflow-hidden relative group"
            >
              {/* Corner soft glow */}
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500"></div>

              <div>
                {/* Card Top Header */}
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className={`p-3 rounded-2xl border ${mod.badgeColor} shadow-inner`}>
                    {mod.icon}
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold tracking-tight text-slate-800">
                      {loadingCounts ? (
                        <div className="w-8 h-5 bg-slate-100 animate-pulse rounded-md ml-auto"></div>
                      ) : (
                        (count ?? 0).toLocaleString()
                      )}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Registros
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="mb-6 relative z-10">
                  <h3 className="text-base font-semibold text-slate-800">{mod.label}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{mod.description}</p>
                </div>

                {/* Date Filters */}
                {mod.hasDateFilter && (
                  <div className="mb-6 bg-slate-50/50 border border-slate-100 p-4 rounded-xl relative z-10">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">
                      Filtrar por Rango (Opcional)
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Desde</label>
                        <input
                          type="date"
                          value={df.desde}
                          onChange={e => setDateFilters(prev => ({
                            ...prev,
                            [mod.endpoint]: { ...prev[mod.endpoint], desde: e.target.value }
                          }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white/90 text-slate-800 text-xs outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-medium block mb-1">Hasta</label>
                        <input
                          type="date"
                          value={df.hasta}
                          onChange={e => setDateFilters(prev => ({
                            ...prev,
                            [mod.endpoint]: { ...prev[mod.endpoint], hasta: e.target.value }
                          }))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white/90 text-slate-800 text-xs outline-none focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4 relative z-10">
                {/* CSV Button */}
                <button
                  onClick={() => handleDownload(mod, 'csv')}
                  disabled={!!downloading}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                    isDownloadingCSV
                      ? 'bg-indigo-600 text-white border-transparent'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-350 active:scale-95 shadow-sm'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isDownloadingCSV ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Procesando
                    </>
                  ) : (
                    <>
                      <FileText size={13} className="text-slate-400" />
                      CSV (Excel)
                    </>
                  )}
                </button>

                {/* JSON Button */}
                <button
                  onClick={() => handleDownload(mod, 'json')}
                  disabled={!!downloading}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                    isDownloadingJSON
                      ? 'bg-indigo-600 text-white border-transparent'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-350 active:scale-95 shadow-sm'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isDownloadingJSON ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      Procesando
                    </>
                  ) : (
                    <>
                      <Download size={13} className="text-slate-400" />
                      JSON Raw
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info/Warning block */}
      <div className="mt-8 p-5 bg-white/75 backdrop-blur-md rounded-2xl border border-slate-200/60 flex items-start gap-4 relative z-10 shadow-sm max-w-4xl">
        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <Info size={18} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Directiva de Respaldos de Solaris</h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Las exportaciones en formato <strong>CSV</strong> son ideales para análisis directo en herramientas como Excel o Google Sheets. Los archivos en formato <strong>JSON</strong> conservan las estructuras anidadas relacionales, perfectas para integraciones API o migraciones de base de datos. Recuerda proteger estas copias de seguridad de acuerdo a la Ley de Protección de Datos.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportadorDatos;
