/**
 * ImportadorReservas.tsx
 * Modal de importación de reservas desde Excel.
 * Flujo: Subir archivo → Preview Grid (igual al Excel original) → Confirmar importación → Supabase
 */

import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, CheckCircle, AlertCircle, FileSpreadsheet, ChevronRight, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReservaImportada {
  fecha: string | null;
  check_out: string | null;
  mes: string;
  anio: number | null;
  dia_numero: number;
  dia_semana: string | null;
  habitacion_numero: number;
  habitacion_nombre: string;
  habitacion_alias: string;
  estado_pago: 'pagado' | 'cortesia' | 'credito' | 'abonada' | 'deuda' | null;
  estado_reserva: 'confirmada' | 'check_in' | 'check_out';
  tipo_reserva: 'noche' | 'hora';
  empresa: string | null;
  huesped_principal: string | null;
  huespedes_adicionales: string[];
  quien_reservo: string | null;
  total_reserva: number | null;
  telefono: string | null;
  factura: string | null;
  canal_reserva: string;
  es_cortesia: boolean;
  observaciones: string;
  texto_raw: string;
  // Campos extra para el bulk-import
  id_habitacion?: string;
  _sim_empresa?: string;
}

interface Stats {
  [key: string]: number;
}

interface PreviewData {
  registros: ReservaImportada[];
  mes: string;
  anio: number;
  stats: Stats;
}

interface ImportadorReservasProps {
  onClose: () => void;
  hotelId: string;
  hoteles: { id_hotel: string; nombre_hotel: string }[];
  habitaciones: { id_habitacion: string; nombre_habitacion: string; nombre_alias?: string }[];
  onImportComplete?: () => void;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

type EstadoPago = 'pagado' | 'cortesia' | 'credito' | 'abonada' | 'deuda' | null;

function getCellStyle(estado_pago: EstadoPago, es_cortesia: boolean): React.CSSProperties {
  if (es_cortesia || estado_pago === 'cortesia') {
    return { background: '#fef08a', color: '#92400e', border: '1px solid #fde047' };
  }
  switch (estado_pago) {
    case 'pagado':
      return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
    case 'credito':
      return { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
    case 'abonada':
      return { background: '#fed7aa', color: '#9a3412', border: '1px solid #fdba74' };
    case 'deuda':
      return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    default:
      return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' };
  }
}

function getEstadoBadge(estado_pago: EstadoPago, es_cortesia: boolean): { label: string; bg: string; color: string } {
  if (es_cortesia || estado_pago === 'cortesia') return { label: 'Cortesía', bg: '#fef08a', color: '#92400e' };
  switch (estado_pago) {
    case 'pagado':  return { label: 'Pagado',   bg: '#dcfce7', color: '#166534' };
    case 'credito': return { label: 'Crédito',  bg: '#dbeafe', color: '#1e40af' };
    case 'abonada': return { label: 'Abonada',  bg: '#fed7aa', color: '#9a3412' };
    case 'deuda':   return { label: 'Deuda',    bg: '#fee2e2', color: '#991b1b' };
    default:        return { label: 'Sin dato', bg: '#f1f5f9', color: '#64748b' };
  }
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

// ─── Component ────────────────────────────────────────────────────────────────

export const ImportadorReservas: React.FC<ImportadorReservasProps> = ({
  onClose,
  hotelId: initialHotelId,
  hoteles,
  habitaciones,
  onImportComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedHotelId, setSelectedHotelId] = useState(initialHotelId || '');
  const [file, setFile] = useState<File | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ insertadas: number; errores: number } | null>(null);
  const [importando, setImportando] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState<ReservaImportada | null>(null);
  const [viewMes, setViewMes] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag & Drop ──
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDraggingFile(true); };
  const handleDragLeave = () => setDraggingFile(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingFile(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) setFile(f);
    else setError('Solo se aceptan archivos .xlsx o .xls');
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  // ── Step 1 → 2: Procesar archivo con Python ──
  const handleProcesar = useCallback(async () => {
    if (!file) { setError('Selecciona un archivo primero'); return; }
    if (!selectedHotelId) { setError('Selecciona un hotel destino'); return; }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/bookings/simulate-import`, {
        method: 'POST',
        headers: { 'x-hotel-id': selectedHotelId },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al procesar el archivo' }));
        throw new Error(err.error || 'Error del servidor');
      }
      const data: ReservaImportada[] = await res.json();
      // El endpoint /simulate-import retorna el array directo
      // Leer mes/anio del primer registro
      const mes = data[0]?.mes || 'Sin mes';
      const anio = data[0]?.anio || new Date().getFullYear();
      // Calcular stats
      const stats: Stats = {};
      for (const r of data) {
        const k = `pago:${r.estado_pago ?? 'null'}`;
        stats[k] = (stats[k] ?? 0) + 1;
      }
      setPreview({ registros: data, mes, anio, stats });
      setViewMes(mes);
      setStep(2);
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [file, selectedHotelId]);

  // ── Step 3: Importar a Supabase ──
  const handleConfirmarImport = useCallback(async () => {
    if (!preview || !selectedHotelId) return;
    setImportando(true);
    setError(null);
    try {
      // Enriquecer registros con id_habitacion y _sim_empresa
      const reservasEnriquecidas = preview.registros.map(r => {
        // Normalizar: quitar acentos, pasar a minúsculas y trim para comparación robusta
        const norm = (s: string) =>
          s.toLowerCase().trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        const hab = habitaciones.find(h =>
          norm(h.nombre_habitacion) === norm(r.habitacion_nombre) ||
          (h.nombre_alias && norm(h.nombre_alias) === norm(r.habitacion_alias ?? ''))
        );
        return {
          ...r,
          check_in: r.fecha ? `${r.fecha}T15:00:00+00:00` : null,
          check_out: r.check_out ? `${r.check_out}T12:00:00+00:00` : null,
          huesped: r.huesped_principal || 'Huésped Importado',
          id_habitacion: hab?.id_habitacion || 'unknown',
          estado: r.estado_reserva || 'confirmada',
          moneda: 'HNL',
          _sim_empresa: r.empresa || undefined,
        };
      });

      const res = await fetch(`${API_BASE}/bookings/bulk-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hotel-id': selectedHotelId,
        },
        body: JSON.stringify({ reservas: reservasEnriquecidas }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error al importar' }));
        throw new Error(err.error || 'Error del servidor');
      }
      const result = await res.json();
      setImportResult({ insertadas: result.insertadas ?? 0, errores: result.errores ?? 0 });
      setStep(3);
      onImportComplete?.();
    } catch (e: any) {
      setError(e.message || 'Error desconocido');
    } finally {
      setImportando(false);
    }
  }, [preview, selectedHotelId, habitaciones, onImportComplete]);

  // ── Grid helpers ──
  const mesesData = preview ? [...new Set(preview.registros.map(r => r.mes))] : [];
  const mesFiltrado = viewMes || mesesData[0] || '';

  const registrosFiltrados = preview?.registros.filter(r => r.mes === mesFiltrado) ?? [];

  // Habitaciones únicas en orden
  const habitacionesGrid = [...new Map(
    registrosFiltrados.map(r => [r.habitacion_numero, { numero: r.habitacion_numero, nombre: r.habitacion_nombre, alias: r.habitacion_alias }])
  ).entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);

  // Días del mes
  const diasGrid = [...new Set(registrosFiltrados.map(r => r.dia_numero))].sort((a, b) => a - b);

  // Mapa: dia_numero → habitacion_numero → ReservaImportada[]
  const gridMap: Record<number, Record<number, ReservaImportada[]>> = {};
  for (const r of registrosFiltrados) {
    if (!gridMap[r.dia_numero]) gridMap[r.dia_numero] = {};
    if (!gridMap[r.dia_numero][r.habitacion_numero]) gridMap[r.dia_numero][r.habitacion_numero] = [];
    gridMap[r.dia_numero][r.habitacion_numero].push(r);
  }

  // Conteo resumen
  const totalPagadas   = preview?.registros.filter(r => r.estado_pago === 'pagado').length ?? 0;
  const totalCortesias = preview?.registros.filter(r => r.es_cortesia || r.estado_pago === 'cortesia').length ?? 0;
  const totalCredito   = preview?.registros.filter(r => r.estado_pago === 'credito').length ?? 0;
  const totalAbonadas  = preview?.registros.filter(r => r.estado_pago === 'abonada').length ?? 0;
  const totalDeuda     = preview?.registros.filter(r => r.estado_pago === 'deuda').length ?? 0;
  const sinHabitacion  = preview?.registros.filter(r => {
    const hab = habitaciones.find(h => h.nombre_habitacion.toLowerCase() === r.habitacion_nombre.toLowerCase());
    return !hab;
  }).length ?? 0;

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.42)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          width: '100%',
          maxWidth: step === 2 ? 1100 : 560,
          boxShadow: '0 24px 52px -10px rgba(15,23,42,.22)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 400,
          maxHeight: step === 2 ? 'calc(100vh - 80px)' : undefined,
          overflow: 'hidden',
          margin: 'auto 0',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: '#f0f9ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet size={18} color="#0369a1" />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>Importar Reservas desde Excel</h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
                {step === 1 ? 'Sube el archivo y selecciona el hotel destino' :
                 step === 2 ? `Vista previa — ${preview?.mes} ${preview?.anio} · ${preview?.registros.length} reservas detectadas` :
                 'Importación completada'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 6, borderRadius: 8 }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Progress Bar ── */}
        <div style={{ display: 'flex', padding: '12px 24px 0', gap: 8, flexShrink: 0 }}>
          {['Subir archivo', 'Vista previa', 'Completado'].map((label, idx) => {
            const isActive = step === idx + 1;
            const isDone = step > idx + 1;
            return (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ height: 3, borderRadius: 2, background: isDone ? '#22c55e' : isActive ? '#0369a1' : '#e2e8f0', transition: 'background 0.3s' }} />
                <span style={{ fontSize: 10, color: isDone ? '#22c55e' : isActive ? '#0369a1' : '#94a3b8', fontWeight: isActive ? 600 : 400, textAlign: 'center' }}>
                  {isDone ? '✓ ' : ''}{label}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ═══════════ PASO 1 ═══════════ */}
          {step === 1 && (
            <div style={{ padding: '24px 24px 20px' }}>

              {/* Hotel selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Hotel destino <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedHotelId}
                  onChange={e => setSelectedHotelId(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#0f172a', background: '#fff' }}
                >
                  <option value="">— Selecciona el hotel —</option>
                  {hoteles.map(h => (
                    <option key={h.id_hotel} value={h.id_hotel}>{h.nombre_hotel}</option>
                  ))}
                </select>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${draggingFile ? '#0369a1' : file ? '#22c55e' : '#cbd5e1'}`,
                  borderRadius: 12,
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: draggingFile ? '#f0f9ff' : file ? '#f0fdf4' : '#f8fafc',
                  transition: 'all 0.2s',
                  marginBottom: 20,
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                {file ? (
                  <>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#166534', margin: '0 0 4px' }}>{file.name}</p>
                    <p style={{ fontSize: 12, color: '#4ade80', margin: 0 }}>{(file.size / 1024).toFixed(1)} KB — Listo para procesar</p>
                  </>
                ) : (
                  <>
                    <Upload size={36} color="#94a3b8" style={{ marginBottom: 12 }} />
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
                      Arrastra tu archivo aquí
                    </p>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>o haz clic para seleccionar · .xlsx / .xls</p>
                  </>
                )}
              </div>

              {/* Leyenda de colores */}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Leyenda de colores del Excel</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { color: '#dcfce7', border: '#86efac', text: '#166534', label: 'Pagado (negro, sin relleno)' },
                    { color: '#fef08a', border: '#fde047', text: '#92400e', label: 'Cortesía/Canje (amarillo+rojo)' },
                    { color: '#dbeafe', border: '#93c5fd', text: '#1e40af', label: 'Crédito (texto azul)' },
                    { color: '#fed7aa', border: '#fdba74', text: '#9a3412', label: 'Abonada (naranja tema)' },
                    { color: '#fee2e2', border: '#fca5a5', text: '#991b1b', label: 'Deuda' },
                  ].map(c => (
                    <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 14, height: 14, background: c.color, border: `1.5px solid ${c.border}`, borderRadius: 3 }} />
                      <span style={{ fontSize: 11, color: '#475569' }}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                  <AlertCircle size={15} color="#ef4444" />
                  <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
                </div>
              )}

              <button
                onClick={handleProcesar}
                disabled={!file || !selectedHotelId || loading}
                style={{
                  width: '100%',
                  padding: '11px 20px',
                  background: (!file || !selectedHotelId || loading) ? '#94a3b8' : '#0369a1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (!file || !selectedHotelId || loading) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'background 0.2s',
                }}
              >
                {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Procesando…</> : <><ChevronRight size={16} /> Procesar y previsualizar</>}
              </button>
            </div>
          )}

          {/* ═══════════ PASO 2: PREVIEW GRID ═══════════ */}
          {step === 2 && preview && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

              {/* Stats bar */}
              <div style={{ padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 20, flexWrap: 'wrap', flexShrink: 0 }}>
                {[
                  { label: 'Total', value: preview.registros.length, color: '#0f172a' },
                  { label: 'Pagadas', value: totalPagadas, color: '#166534' },
                  { label: 'Cortesías', value: totalCortesias, color: '#92400e' },
                  { label: 'Crédito', value: totalCredito, color: '#1e40af' },
                  { label: 'Abonadas', value: totalAbonadas, color: '#9a3412' },
                  { label: 'Deuda', value: totalDeuda, color: '#991b1b' },
                  ...(sinHabitacion > 0 ? [{ label: '⚠ Sin hab.', value: sinHabitacion, color: '#f59e0b' }] : []),
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{s.label}</div>
                  </div>
                ))}
                {/* Selector de mes si hay múltiples */}
                {mesesData.length > 1 && (
                  <select
                    value={viewMes ?? ''}
                    onChange={e => setViewMes(e.target.value)}
                    style={{ marginLeft: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                  >
                    {mesesData.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>

              {/* Two-panel layout */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── Grid Panel ── */}
                <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 10px', background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 11, textAlign: 'left', position: 'sticky', top: 0, left: 0, zIndex: 3, minWidth: 56 }}>
                          Día
                        </th>
                        {habitacionesGrid.map(h => (
                          <th key={h.numero} style={{ padding: '6px 8px', background: '#1e293b', color: '#fff', fontWeight: 600, fontSize: 10, textAlign: 'center', position: 'sticky', top: 0, zIndex: 2, minWidth: 100, whiteSpace: 'nowrap' }}>
                            {h.alias ? `${h.alias}` : h.nombre}
                            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 400 }}>{h.nombre}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diasGrid.map(dia => (
                        <tr key={dia} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Día */}
                          <td style={{ padding: '4px 10px', fontWeight: 700, color: '#475569', background: dia % 2 === 0 ? '#f8fafc' : '#fff', position: 'sticky', left: 0, zIndex: 1, fontSize: 12 }}>
                            {dia}
                          </td>
                          {/* Celdas de habitaciones */}
                          {habitacionesGrid.map(h => {
                            const reservasEnCelda = gridMap[dia]?.[h.numero] ?? [];
                            return (
                              <td key={h.numero} style={{ padding: 2, background: dia % 2 === 0 ? '#f8fafc' : '#fff', verticalAlign: 'top' }}>
                                {reservasEnCelda.map((r, i) => {
                                  const cellS = getCellStyle(r.estado_pago, r.es_cortesia);
                                  const isSelected = selectedReserva === r;
                                  return (
                                    <div
                                      key={i}
                                      onClick={() => setSelectedReserva(isSelected ? null : r)}
                                      style={{
                                        ...cellS,
                                        borderRadius: 4,
                                        padding: '3px 6px',
                                        marginBottom: i < reservasEnCelda.length - 1 ? 2 : 0,
                                        cursor: 'pointer',
                                        fontSize: 10,
                                        lineHeight: 1.3,
                                        outline: isSelected ? '2px solid #0369a1' : 'none',
                                        transition: 'outline 0.1s',
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>
                                        {r.huesped_principal || '?'}
                                      </div>
                                      {r.total_reserva ? (
                                        <div style={{ fontSize: 9, opacity: 0.8 }}>L.{r.total_reserva.toLocaleString()}</div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Detail Panel (solo si hay seleccionado) ── */}
                {selectedReserva && (
                  <div style={{ width: 240, borderLeft: '1px solid #f1f5f9', padding: '16px 14px', overflowY: 'auto', background: '#fafafa', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Detalle</span>
                      <button onClick={() => setSelectedReserva(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}>
                        <X size={14} />
                      </button>
                    </div>
                    {(() => {
                      const badge = getEstadoBadge(selectedReserva.estado_pago, selectedReserva.es_cortesia);
                      return (
                        <>
                          <div style={{ background: badge.bg, color: badge.color, padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, display: 'inline-block', marginBottom: 10 }}>
                            {badge.label}
                          </div>
                          {[
                            ['Huésped', selectedReserva.huesped_principal || '—'],
                            ['Habitación', selectedReserva.habitacion_nombre + (selectedReserva.habitacion_alias ? ` (${selectedReserva.habitacion_alias})` : '')],
                            ['Check-in', selectedReserva.fecha || '—'],
                            ['Check-out', selectedReserva.check_out || '—'],
                            ['Tipo', selectedReserva.tipo_reserva],
                            ['Total', selectedReserva.total_reserva != null ? `L.${selectedReserva.total_reserva.toLocaleString()}` : '—'],
                            ['Canal', selectedReserva.canal_reserva || '—'],
                            ['Empresa', selectedReserva.empresa || '—'],
                            ['Teléfono', selectedReserva.telefono || '—'],
                          ].map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 7 }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{k}</div>
                              <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 500, wordBreak: 'break-word' }}>{v}</div>
                            </div>
                          ))}
                          {selectedReserva.observaciones && (
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>Notas</div>
                              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.4, wordBreak: 'break-word' }}>{selectedReserva.observaciones}</div>
                            </div>
                          )}
                          {selectedReserva.texto_raw && (
                            <div style={{ marginTop: 10, padding: '6px 8px', background: '#f1f5f9', borderRadius: 6 }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginBottom: 3 }}>TEXTO ORIGINAL</div>
                              <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.4, wordBreak: 'break-word' }}>{selectedReserva.texto_raw}</div>
                            </div>
                          )}
                          {/* Verificar si la habitación existe */}
                          {!habitaciones.find(h => h.nombre_habitacion.toLowerCase() === selectedReserva.habitacion_nombre.toLowerCase()) && (
                            <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '6px 8px' }}>
                              <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>⚠ Habitación no encontrada</div>
                              <div style={{ fontSize: 10, color: '#dc2626' }}>"{selectedReserva.habitacion_nombre}" no existe en la BD. Esta reserva será omitida.</div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexShrink: 0, background: '#fff' }}>
                <button onClick={() => { setStep(1); setPreview(null); setError(null); }} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>
                  ← Volver
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {sinHabitacion > 0 && (
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>⚠ {sinHabitacion} reserva{sinHabitacion !== 1 ? 's' : ''} sin habitación se omitirán</span>
                  )}
                  {error && (
                    <span style={{ fontSize: 12, color: '#dc2626' }}>❌ {error}</span>
                  )}
                  <button
                    onClick={handleConfirmarImport}
                    disabled={importando || preview.registros.length === 0}
                    style={{
                      padding: '8px 20px',
                      fontSize: 14,
                      background: importando ? '#94a3b8' : '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: importando ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {importando
                      ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Importando…</>
                      : `✓ Importar ${preview.registros.length} reservas a Supabase`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ PASO 3: RESULTADO ═══════════ */}
          {step === 3 && importResult && (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <CheckCircle size={56} color="#22c55e" style={{ marginBottom: 16 }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>¡Importación completada!</h3>
              <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 28px' }}>
                Los datos han sido enviados a Supabase correctamente.
              </p>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32 }}>
                <div style={{ padding: '16px 28px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12 }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a' }}>{importResult.insertadas}</div>
                  <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>Reservas insertadas</div>
                </div>
                {importResult.errores > 0 && (
                  <div style={{ padding: '16px 28px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
                    <div style={{ fontSize: 32, fontWeight: 800, color: '#dc2626' }}>{importResult.errores}</div>
                    <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>Con errores / omitidas</div>
                  </div>
                )}
              </div>
              {importResult.errores > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 16px', marginBottom: 24, fontSize: 12, color: '#dc2626', textAlign: 'left' }}>
                  Las reservas con error suelen ser aquellas cuya habitación no existe en la base de datos con el mismo nombre exacto. Revisa el panel de detalle en el paso de preview.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => { setStep(1); setFile(null); setPreview(null); setImportResult(null); setError(null); }}
                  style={{ padding: '9px 18px', fontSize: 13, border: '1px solid #e2e8f0', color: '#64748b', borderRadius: 8, cursor: 'pointer', background: '#fff' }}
                >
                  Importar otro archivo
                </button>
                <button
                  onClick={onClose}
                  style={{ padding: '9px 18px', fontSize: 13, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body
  );
};

export default ImportadorReservas;
