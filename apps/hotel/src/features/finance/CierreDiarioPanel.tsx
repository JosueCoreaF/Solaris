import React, { useState, useEffect } from 'react';
import { Calendar, User, Save, Lock, Unlock, RefreshCw, AlertCircle, CheckCircle2, FileText, ArrowRight, DollarSign, BedDouble, Sparkles, Wrench, CreditCard, Users, ShieldAlert } from 'lucide-react';
import { supabase } from '../../api/supabase';
import { saveCierreDiario, loadCierreDiario, listCierresDiarios, CierreDiarioRecord } from '../../components/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';

export const CierreDiarioPanel: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  // Date initialized to local date (YYYY-MM-DD)
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [fecha, setFecha] = useState<string>(getLocalDateString());
  const [cierreExistente, setCierreExistente] = useState<CierreDiarioRecord | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Calculations
  const [ingresos, setIngresos] = useState(0);
  const [egresos, setEgresos] = useState(0);
  const [saldoTeorico, setSaldoTeorico] = useState(0);
  const [efectivoReal, setEfectivoReal] = useState<number | ''>('');
  const [diferencia, setDiferencia] = useState(0);
  const [notas, setNotas] = useState('');
  
  // Lists & breakdowns
  const [desglosePagos, setDesglosePagos] = useState<any[]>([]);
  const [desgloseFacturas, setDesgloseFacturas] = useState<any[]>([]);
  const [historialCierres, setHistorialCierres] = useState<CierreDiarioRecord[]>([]);
  
  // Phase 2 states
  const [resumenHabitaciones, setResumenHabitaciones] = useState<Record<string, number>>({
    disponible: 0,
    ocupada: 0,
    mantenimiento: 0,
    bloqueada: 0,
    limpieza: 0
  });
  const [pagosPorMetodo, setPagosPorMetodo] = useState<Record<string, number>>({});
  
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';

  const cargarCierresHistoricos = async () => {
    try {
      const list = await listCierresDiarios(5);
      setHistorialCierres(list || []);
    } catch (err: any) {
      console.error('Error cargando historial de cierres:', err);
    }
  };

  const cargarDatosDelDia = async () => {
    if (!activeHotelId) return;
    
    try {
      setLoading(true);
      
      // 1. Check if a closure already exists for this date and hotel
      const cierre = await loadCierreDiario(fecha, activeHotelId);
      
      if (cierre) {
        setCierreExistente(cierre);
        
        // Restore from snapshot
        const snap = cierre.snapshot || {};
        setIngresos(Number(snap.ingresos || 0));
        setEgresos(Number(snap.egresos || 0));
        setSaldoTeorico(Number(snap.saldo_teorico || 0));
        setEfectivoReal(Number(snap.efectivo_real || 0));
        setDiferencia(Number(snap.diferencia || 0));
        setNotas(snap.notas || snap.observaciones || '');
        setDesglosePagos(snap.desglose_pagos || []);
        setDesgloseFacturas(snap.desglose_facturas || []);
        
        // Restore Phase 2 values
        setResumenHabitaciones(snap.habitaciones?.resumen || {
          disponible: 0,
          ocupada: 0,
          mantenimiento: 0,
          bloqueada: 0,
          limpieza: 0
        });
        setPagosPorMetodo(snap.pagos_por_metodo || {});
      } else {
        setCierreExistente(null);
        setEfectivoReal('');
        setNotas('');
        
        // 2. Fetch payments of that day
        const startOfDay = new Date(fecha);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(fecha);
        endOfDay.setHours(23, 59, 59, 999);
        
        const { data: pagos, error: pagosErr } = await supabase
          .from('pagos_hotel')
          .select(`
            id_pago_hotel,
            monto,
            metodo_pago,
            fecha_pago,
            estado,
            reservas_hotel!inner (
              id_hotel,
              huespedes ( nombre_completo ),
              habitaciones ( nombre_habitacion )
            )
          `)
          .eq('reservas_hotel.id_hotel', activeHotelId)
          .neq('estado', 'anulado')
          .gte('fecha_pago', startOfDay.toISOString())
          .lte('fecha_pago', endOfDay.toISOString());
          
        if (pagosErr) throw pagosErr;
        
        // 3. Fetch invoices of that day
        const { data: facturas, error: facErr } = await supabase
          .from('facturas')
          .select('id_factura, proveedor, no_factura, tipo, monto_total, descripcion, fecha')
          .eq('id_hotel', activeHotelId)
          .eq('fecha', fecha);
          
        if (facErr) throw facErr;
        
        // 4. Fetch current room states
        const { data: rooms, error: roomsErr } = await supabase
          .from('habitaciones')
          .select('id_habitacion, codigo_habitacion, nombre_habitacion, estado')
          .eq('id_hotel', activeHotelId);
          
        if (roomsErr) throw roomsErr;
        
        const counts = {
          disponible: 0,
          ocupada: 0,
          mantenimiento: 0,
          bloqueada: 0,
          limpieza: 0
        };
        (rooms || []).forEach(r => {
          const est = r.estado as keyof typeof counts;
          if (counts[est] !== undefined) {
            counts[est]++;
          }
        });
        setResumenHabitaciones(counts);
        
        // 5. Calculate totals
        const sumIngresos = (pagos || []).reduce((sum, p: any) => sum + Number(p.monto || 0), 0);
        const sumEgresos = (facturas || []).reduce((sum, f: any) => sum + Number(f.monto_total || 0), 0);
        
        setIngresos(sumIngresos);
        setEgresos(sumEgresos);
        setSaldoTeorico(sumIngresos - sumEgresos);
        setDiferencia(0 - (sumIngresos - sumEgresos)); // if cash is 0 initially
        
        // Map lists for display
        setDesglosePagos((pagos || []).map((p: any) => ({
          id: p.id_pago_hotel,
          monto: p.monto,
          metodo_pago: p.metodo_pago,
          huesped: p.reservas_hotel?.huespedes?.nombre_completo || 'Huésped desconocido',
          habitacion: p.reservas_hotel?.habitaciones?.nombre_habitacion || 'Habitación'
        })));
        
        setDesgloseFacturas((facturas || []).map((f: any) => ({
          id: f.id_factura,
          monto: f.monto_total,
          proveedor: f.proveedor,
          no_factura: f.no_factura || 'S/N',
          descripcion: f.descripcion || 'Gasto registrado',
          tipo: f.tipo
        })));
        
        // Map payments by method
        const methods: Record<string, number> = {};
        (pagos || []).forEach((p: any) => {
          const met = p.metodo_pago || 'Desconocido';
          methods[met] = (methods[met] || 0) + Number(p.monto || 0);
        });
        setPagosPorMetodo(methods);
      }
    } catch (err: any) {
      console.error('Error cargando datos del cierre diario:', err);
      addToast(err.message || 'Error al cargar los datos financieros del día', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatosDelDia();
    cargarCierresHistoricos();
  }, [fecha, activeHotelId]);

  // Handle cash box count change
  const handleEfectivoChange = (val: string) => {
    if (cierreExistente) return; // read-only
    const num = val === '' ? '' : parseFloat(val);
    setEfectivoReal(num);
    if (num === '') {
      setDiferencia(0 - saldoTeorico);
    } else {
      setDiferencia(num - saldoTeorico);
    }
  };

  const handleConfirmarCierre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cierreExistente || !activeHotelId) return;
    
    if (efectivoReal === '') {
      addToast('Por favor, ingresa el efectivo real contado en caja.', 'warning');
      return;
    }
    
    try {
      setSaving(true);
      
      const userMeta = user?.user_metadata || {};
      const encargado = userMeta.nombre || userMeta.nombre_completo || userMeta.fullName || user?.email?.split('@')[0] || 'Encargado';
      
      // Fetch rooms again to make sure we have the exact snapshot at save time
      const { data: rooms, error: roomsErr } = await supabase
        .from('habitaciones')
        .select('id_habitacion, codigo_habitacion, nombre_habitacion, estado')
        .eq('id_hotel', activeHotelId);
        
      if (roomsErr) throw roomsErr;
      
      const finalCounts = {
        disponible: 0,
        ocupada: 0,
        mantenimiento: 0,
        bloqueada: 0,
        limpieza: 0
      };
      (rooms || []).forEach(r => {
        const est = r.estado as keyof typeof finalCounts;
        if (finalCounts[est] !== undefined) {
          finalCounts[est]++;
        }
      });
      
      const snapshot = {
        ingresos,
        egresos,
        saldo_teorico: saldoTeorico,
        efectivo_real: efectivoReal,
        diferencia,
        notas,
        desglose_pagos: desglosePagos,
        desglose_facturas: desgloseFacturas,
        pagos_por_metodo: pagosPorMetodo,
        habitaciones: {
          resumen: finalCounts,
          detalle: (rooms || []).map(r => ({
            id: r.id_habitacion,
            codigo: r.codigo_habitacion,
            nombre: r.nombre_habitacion,
            estado: r.estado
          }))
        }
      };
      
      await saveCierreDiario({
        fecha,
        hotel: activeHotelId,
        encargadoNombre: encargado,
        snapshot
      });
      
      addToast(`Cierre diario del ${fecha} guardado exitosamente.`, 'success');
      await cargarDatosDelDia();
      await cargarCierresHistoricos();
    } catch (err: any) {
      console.error('Error al guardar cierre diario:', err);
      addToast(err.message || 'Error al guardar el cierre diario', 'error');
    } finally {
      setSaving(false);
    }
  };

  const symb = 'L'; // Lempiras
  
  // Calculate total rooms and occupancy
  const totalHabs = Object.values(resumenHabitaciones).reduce((a, b) => a + b, 0);
  const ocupacionPorcentaje = totalHabs > 0 ? Math.round((resumenHabitaciones.ocupada / totalHabs) * 100) : 0;
  
  // User metadata name for display
  const userMeta = user?.user_metadata || {};
  const currentEncargado = userMeta.nombre || userMeta.nombre_completo || userMeta.fullName || user?.email?.split('@')[0] || 'Encargado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
      {/* Row de controles y fecha */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '10px 14px', borderRadius: 12, background: cierreExistente ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)',
            border: `1px solid ${cierreExistente ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}`,
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
            color: cierreExistente ? '#10b981' : '#d97706'
          }}>
            {cierreExistente ? (
              <>
                <Lock size={15} /> Cierre Realizado por {cierreExistente.encargadoNombre}
              </>
            ) : (
              <>
                <Unlock size={15} /> Caja Abierta · Encargado: {currentEncargado}
              </>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-bg)', border: '1px solid var(--shell-border)', padding: '4px 12px', borderRadius: 12 }}>
          <Calendar size={14} className="text-slate-400" />
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              color: 'var(--text-h)', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <RefreshCw size={22} className="animate-spin text-indigo-500" />
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>Cargando conciliación financiera…</span>
        </div>
      ) : (
        <>
          {/* KPI Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="kpi-card kpi-card-blue">
              <div className="kpi-label">Saldo Teórico Esperado</div>
              <div className="kpi-value">{symb} {saldoTeorico.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</div>
              <div className="kpi-sub">
                <span className="kpi-sub-text">Ingresos ({ingresos}) − Egresos ({egresos})</span>
              </div>
            </div>
            
            <div className="kpi-card kpi-card-emerald">
              <div className="kpi-label">Efectivo Real en Caja</div>
              <div className="kpi-value">
                {efectivoReal === '' ? 'Pendiente' : `${symb} ${efectivoReal.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}
              </div>
              <div className="kpi-sub">
                <span className="kpi-sub-text">Monto físico contado</span>
              </div>
            </div>
            
            <div className={`kpi-card ${diferencia === 0 ? 'kpi-card-emerald' : diferencia < 0 ? 'kpi-card-rose' : 'kpi-card-blue'}`}>
              <div className="kpi-label">Diferencia (Sobrante/Faltante)</div>
              <div className="kpi-value">
                {diferencia === 0 ? 'Cuadrado' : `${diferencia > 0 ? '+' : ''}L ${diferencia.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}
              </div>
              <div className="kpi-sub">
                <span className={`kpi-trend-badge ${diferencia === 0 ? 'kpi-trend-up' : 'kpi-trend-down'}`}>
                  {diferencia === 0 ? 'Cuadrado' : diferencia > 0 ? 'Sobrante' : 'Faltante'}
                </span>
                <span className="kpi-sub-text">Real vs. Esperado</span>
              </div>
            </div>
          </div>

          {/* Formulario de Reconciliación + Desglose del Día + Estado de Habitaciones */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            
            {/* Columna 1: Formulario de Cierre */}
            <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p className="panel-card-title">
                <FileText size={15} color="var(--accent)" /> {cierreExistente ? 'Detalles del Cierre Registrado' : 'Realizar Cierre de Caja'}
              </p>
              
              <form onSubmit={handleConfirmarCierre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                    Efectivo Contado Físicamente en Caja ({symb})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={efectivoReal}
                    onChange={(e) => handleEfectivoChange(e.target.value)}
                    disabled={!!cierreExistente}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: '1px solid var(--shell-border-strong)',
                      backgroundColor: cierreExistente ? 'var(--shell-border-subtle)' : 'var(--card-bg)',
                      color: 'var(--text-h)', fontSize: 14, fontWeight: 600, outline: 'none'
                    }}
                  />
                  {!cierreExistente && (
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                      Cuenta el dinero en físico de la caja registradora e ingresa el monto total.
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                    Observaciones y Novedades del Día
                  </label>
                  <textarea
                    rows={5}
                    placeholder={cierreExistente ? 'Sin observaciones' : 'Escribe novedades en turnos, justificación de faltantes/sobrantes, canjes, etc.'}
                    value={notas}
                    onChange={(e) => !cierreExistente && setNotas(e.target.value)}
                    disabled={!!cierreExistente}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 10,
                      border: '1px solid var(--shell-border-strong)',
                      backgroundColor: cierreExistente ? 'var(--shell-border-subtle)' : 'var(--card-bg)',
                      color: 'var(--text-h)', fontSize: 13, outline: 'none', resize: 'vertical'
                    }}
                  />
                </div>

                {!cierreExistente ? (
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-premium"
                    style={{
                      width: '100%', padding: '12px', borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none'
                    }}
                  >
                    {saving ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Confirmar Cierre Diario
                  </button>
                ) : (
                  <div style={{
                    padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,.06)',
                    border: '1px solid rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12.5, color: '#10b981', fontWeight: 600
                  }}>
                    <CheckCircle2 size={16} /> Este cierre diario ha sido guardado y el saldo de la caja se encuentra asegurado en la base de datos.
                  </div>
                )}
              </form>
            </div>
            
            {/* Columna 2: Estado de las Habitaciones */}
            <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <p className="panel-card-title">
                <BedDouble size={15} color="var(--accent)" /> Estado de Habitaciones
              </p>
              
              {totalHabs > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Ocupación Circle / Bar */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(30,41,59,0.02), rgba(15,23,42,0.05))',
                    border: '1px solid var(--shell-border-subtle)',
                    padding: '16px',
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ocupación de Hoy</p>
                      <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-h)', margin: '4px 0 0 0' }}>{ocupacionPorcentaje}%</h3>
                    </div>
                    
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--shell-border)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--card-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text-h)' }}>
                        {resumenHabitaciones.ocupada}/{totalHabs}
                      </div>
                    </div>
                  </div>

                  {/* List breakdown of rooms */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Disponible */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-h)' }}>
                          <CheckCircle2 size={13} color="#10b981" /> Disponible
                        </span>
                        <span style={{ fontWeight: 700 }}>{resumenHabitaciones.disponible}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(15,23,42,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(resumenHabitaciones.disponible / totalHabs) * 100}%`, height: '100%', background: '#10b981', borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Ocupada */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-h)' }}>
                          <Users size={13} color="#3b82f6" /> Ocupada
                        </span>
                        <span style={{ fontWeight: 700 }}>{resumenHabitaciones.ocupada}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(15,23,42,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(resumenHabitaciones.ocupada / totalHabs) * 100}%`, height: '100%', background: '#3b82f6', borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Limpieza */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-h)' }}>
                          <Sparkles size={13} color="#06b6d4" /> Limpieza
                        </span>
                        <span style={{ fontWeight: 700 }}>{resumenHabitaciones.limpieza}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(15,23,42,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(resumenHabitaciones.limpieza / totalHabs) * 100}%`, height: '100%', background: '#06b6d4', borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Mantenimiento */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-h)' }}>
                          <Wrench size={13} color="#f59e0b" /> Mantenimiento
                        </span>
                        <span style={{ fontWeight: 700 }}>{resumenHabitaciones.mantenimiento}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(15,23,42,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(resumenHabitaciones.mantenimiento / totalHabs) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 3 }} />
                      </div>
                    </div>

                    {/* Bloqueada */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-h)' }}>
                          <Lock size={13} color="#8b5cf6" /> Bloqueada
                        </span>
                        <span style={{ fontWeight: 700 }}>{resumenHabitaciones.bloqueada}</span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(15,23,42,0.05)', overflow: 'hidden' }}>
                        <div style={{ width: `${(resumenHabitaciones.bloqueada / totalHabs) * 100}%`, height: '100%', background: '#8b5cf6', borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}>
                  <AlertCircle size={20} color="var(--shell-border-strong)" />
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>Cargando estado de habitaciones...</span>
                </div>
              )}
            </div>
            
            {/* Columna 3: Transacciones & Métodos de Pago */}
            <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="panel-card-title">
                <FileText size={15} color="var(--accent)" /> Transacciones Conciliadas
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Métodos de Pago Summary */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCard size={13} /> Resumen por Métodos de Pago
                  </h4>
                  {Object.keys(pagosPorMetodo).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', background: 'rgba(15,23,42,.02)', borderRadius: 10, border: '1px solid var(--shell-border-subtle)' }}>
                      {Object.entries(pagosPorMetodo).map(([metodo, total]) => (
                        <div key={metodo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0' }}>
                          <span style={{ color: 'var(--text-h)', fontWeight: 600 }}>💳 {metodo}</span>
                          <span style={{ fontWeight: 700, color: 'var(--success)' }}>+{symb} {total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, padding: '12px', background: 'rgba(15,23,42,.01)', borderRadius: 8, border: '1px dashed var(--shell-border)' }}>
                      Sin ingresos registrados hoy.
                    </p>
                  )}
                </div>

                {/* Ingresos (Pagos) */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    💰 Ingresos de Huéspedes ({desglosePagos.length})
                  </h4>
                  {desglosePagos.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                      {desglosePagos.map((p, i) => (
                        <div key={p.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(15,23,42,.015)', border: '1px solid var(--shell-border-subtle)', borderRadius: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-h)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.huesped}</p>
                            <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>{p.habitacion} · {p.metodo_pago}</span>
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--success)' }}>+{symb} {p.monto.toLocaleString('es-HN')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, padding: '8px 12px', background: 'rgba(15,23,42,.01)', borderRadius: 8, border: '1px dashed var(--shell-border)' }}>
                      No se registraron ingresos.
                    </p>
                  )}
                </div>
                
                {/* Egresos (Facturas) */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                    🧾 Egresos y Gastos ({desgloseFacturas.length})
                  </h4>
                  {desgloseFacturas.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                      {desgloseFacturas.map((f, i) => (
                        <div key={f.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(15,23,42,.015)', border: '1px solid var(--shell-border-subtle)', borderRadius: 8 }}>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-h)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.proveedor}</p>
                            <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>Fact: {f.no_factura} · {f.descripcion}</span>
                          </div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--danger)' }}>-{symb} {f.monto.toLocaleString('es-HN')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, padding: '8px 12px', background: 'rgba(15,23,42,.01)', borderRadius: 8, border: '1px dashed var(--shell-border)' }}>
                      No se registraron egresos.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Historial de Cierres Recientes */}
          <div className="panel-card">
            <p className="panel-card-title">
              <RefreshCw size={15} color="var(--accent)" /> Cierres Diarios Recientes
            </p>
            {historialCierres.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr 1fr', padding: '8px 12px', background: 'rgba(15,23,42,.02)', borderRadius: 8, fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  <span>Fecha</span>
                  <span>Encargado</span>
                  <span style={{ textAlign: 'right' }}>Teórico</span>
                  <span style={{ textAlign: 'right' }}>Efectivo Real</span>
                  <span style={{ textAlign: 'right' }}>Diferencia</span>
                </div>
                {historialCierres.map((c) => {
                  const snap = c.snapshot || {};
                  const diff = Number(snap.diferencia || 0);
                  return (
                    <div
                      key={c.id}
                      onClick={() => setFecha(c.fecha)}
                      style={{
                        display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1fr 1fr',
                        padding: '12px', border: '1px solid var(--shell-border-subtle)',
                        borderRadius: 10, fontSize: 12.5, color: 'var(--text-h)', cursor: 'pointer',
                        transition: 'all 0.18s', background: 'var(--card-bg)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--shell-border-subtle)'}
                    >
                      <span style={{ fontWeight: 700 }}>📅 {c.fecha}</span>
                      <span style={{ color: 'var(--muted)' }}>👤 {c.encargadoNombre || 'Sistema'}</span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {symb} {Number(snap.saldo_teorico || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {symb} {Number(snap.efectivo_real || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </span>
                      <span style={{
                        textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700,
                        color: diff === 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--accent)'
                      }}>
                        {diff === 0 ? 'Cuadrado' : `${diff > 0 ? '+' : ''}${diff.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, gap: 8 }}>
                <AlertCircle size={20} color="var(--shell-border-strong)" />
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>No hay cierres diarios registrados recientemente</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
