/**
 * ExportadorDatos.tsx
 * Interfaz premium para exportar módulos de la base de datos en CSV o JSON.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
  icon: string;
  color: string;
  gradient: string;
  hasDateFilter: boolean;
}

const MODULES: ModuleConfig[] = [
  {
    key: 'clientes',
    endpoint: 'huespedes',
    label: 'Clientes',
    description: 'Huéspedes registrados con sus datos de contacto',
    icon: '🧑‍💼',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    hasDateFilter: false,
  },
  {
    key: 'reservas',
    endpoint: 'reservas',
    label: 'Reservas',
    description: 'Historial de reservas por rango de fechas',
    icon: '📅',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
    hasDateFilter: true,
  },
  {
    key: 'empresas',
    endpoint: 'empresas',
    label: 'Empresas',
    description: 'Empresas con crédito y datos de contacto',
    icon: '🏢',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    hasDateFilter: false,
  },
  {
    key: 'saldos',
    endpoint: 'saldos',
    label: 'Estados de Cuenta',
    description: 'Saldos y movimientos por cliente',
    icon: '📊',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    hasDateFilter: true,
  },
  {
    key: 'pagos',
    endpoint: 'pagos',
    label: 'Pagos',
    description: 'Registro de todos los pagos recibidos',
    icon: '💳',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    hasDateFilter: true,
  },
  {
    key: 'chats',
    endpoint: 'chats',
    label: 'Chats',
    description: 'Historial de mensajes y canales operativos',
    icon: '💬',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
    hasDateFilter: true,
  },
  {
    key: 'tarifas',
    endpoint: 'tarifas',
    label: 'Tarifas',
    description: 'Configuración de tarifas por tipo y categoría',
    icon: '💰',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
    hasDateFilter: false,
  },
];

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
    <div id="exportador-datos" style={{ padding: '28px 32px', minHeight: '100vh', background: 'var(--shell-bg)' }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
          }}>
            💾
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--text-h)', letterSpacing: -0.5 }}>
              Exportar Datos
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14, marginTop: 2 }}>
              Descarga una copia de tus datos en CSV o JSON para respaldo o análisis
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20,
          padding: '14px 20px',
          background: 'var(--shell-panel)',
          borderRadius: 14,
          border: '1px solid var(--shell-border-subtle)',
        }}>
          {MODULES.map(mod => (
            <div key={mod.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontSize: 16 }}>{mod.icon}</span>
              <span style={{ color: 'var(--muted)' }}>{mod.label}:</span>
              <span style={{ fontWeight: 700, color: mod.color }}>
                {loadingCounts ? '…' : ((counts[mod.key] ?? 0)).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Cards Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
        gap: 20,
      }}>
        {MODULES.map((mod) => {
          const count = counts[mod.key];
          const df = dateFilters[mod.endpoint] || { desde: '', hasta: '' };
          const isDownloadingCSV = downloading === `${mod.key}-csv`;
          const isDownloadingJSON = downloading === `${mod.key}-json`;
          const isAnyDownloading = isDownloadingCSV || isDownloadingJSON;

          return (
            <div
              key={mod.key}
              id={`export-card-${mod.key}`}
              style={{
                background: 'var(--shell-panel-strong)',
                border: '1px solid var(--shell-border-subtle)',
                borderRadius: 18,
                overflow: 'hidden',
                boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                display: 'flex', flexDirection: 'column',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.14)`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 16px rgba(0,0,0,0.08)';
              }}
            >
              {/* Card header with gradient */}
              <div style={{
                background: mod.gradient,
                padding: '20px 22px 16px',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{mod.icon}</div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
                    {mod.label}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>
                    {mod.description}
                  </p>
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 10,
                  padding: '8px 14px',
                  textAlign: 'center',
                  minWidth: 64,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                    {loadingCounts ? '…' : (count ?? 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.78)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    registros
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '16px 22px 20px', flex: 1 }}>
                {/* Date filter */}
                {mod.hasDateFilter && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', marginBottom: 8 }}>
                      Rango de Fechas (opcional)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Desde</label>
                        <input
                          id={`desde-${mod.key}`}
                          type="date"
                          value={df.desde}
                          onChange={e => setDateFilters(prev => ({
                            ...prev,
                            [mod.endpoint]: { ...prev[mod.endpoint], desde: e.target.value }
                          }))}
                          style={{
                            width: '100%', padding: '7px 10px', borderRadius: 8,
                            border: '1px solid var(--shell-border-strong)',
                            background: 'var(--shell-bg)', color: 'var(--text-h)',
                            fontSize: 12, boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Hasta</label>
                        <input
                          id={`hasta-${mod.key}`}
                          type="date"
                          value={df.hasta}
                          onChange={e => setDateFilters(prev => ({
                            ...prev,
                            [mod.endpoint]: { ...prev[mod.endpoint], hasta: e.target.value }
                          }))}
                          style={{
                            width: '100%', padding: '7px 10px', borderRadius: 8,
                            border: '1px solid var(--shell-border-strong)',
                            background: 'var(--shell-bg)', color: 'var(--text-h)',
                            fontSize: 12, boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>
                    {(!df.desde && !df.hasta) && (
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                        Sin filtro: se exportarán todos los registros
                      </p>
                    )}
                  </div>
                )}

                {/* Download buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {/* CSV */}
                  <button
                    id={`btn-csv-${mod.key}`}
                    onClick={() => handleDownload(mod, 'csv')}
                    disabled={!!downloading}
                    style={{
                      padding: '10px 0',
                      borderRadius: 10,
                      border: `1.5px solid ${mod.color}40`,
                      background: isDownloadingCSV ? mod.gradient : `${mod.color}14`,
                      color: isDownloadingCSV ? '#fff' : mod.color,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: (downloading && !isDownloadingCSV) ? 0.5 : 1,
                    }}
                  >
                    {isDownloadingCSV ? (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                        Descargando…
                      </>
                    ) : (
                      <>📄 CSV</>
                    )}
                  </button>

                  {/* JSON */}
                  <button
                    id={`btn-json-${mod.key}`}
                    onClick={() => handleDownload(mod, 'json')}
                    disabled={!!downloading}
                    style={{
                      padding: '10px 0',
                      borderRadius: 10,
                      border: '1.5px solid var(--shell-border-strong)',
                      background: isDownloadingJSON ? 'var(--shell-panel)' : 'transparent',
                      color: isDownloadingJSON ? 'var(--text-h)' : 'var(--muted)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: downloading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: (downloading && !isDownloadingJSON) ? 0.5 : 1,
                    }}
                  >
                    {isDownloadingJSON ? (
                      <>
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                        Descargando…
                      </>
                    ) : (
                      <>{ '{}'} JSON</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tip footer ── */}
      <div style={{
        marginTop: 32, padding: '16px 22px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.06) 100%)',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 14,
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 22 }}>💡</span>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-h)' }}>Tip de Importación</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
            Los archivos <strong>CSV</strong> se pueden abrir directamente en Excel. Los archivos <strong>JSON</strong> son ideales
            para importar a otras bases de datos o sistemas. Para restaurar datos, contacta al administrador del sistema.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ExportadorDatos;
