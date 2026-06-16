import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, X, CheckCircle, AlertCircle, RefreshCw, Download, AlertTriangle, DollarSign, CreditCard, Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DatePicker, DateRangePicker } from '../../components/DatePicker';
import {
  fetchPagos,
  fetchReservas,
  fetchEmpresas,
  createPago,
  updatePago,
  anularPago,
  type PagoDetalle,
  type Reserva,
  type Empresa,
  type MetodoPago,
  toDateKey,
  addDays,
  getOnlyDate,
} from '../../api/bookingsService';
import { useHasFeature } from '../../hooks/usePlanFeature';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const METODOS: { value: MetodoPago; label: string; requireRef?: boolean; requireFactura?: boolean }[] = [
  { value: 'efectivo', label: 'Efectivo', requireFactura: true },
  { value: 'tarjeta', label: 'Tarjeta', requireRef: true, requireFactura: true },
  { value: 'transferencia', label: 'Transferencia', requireRef: true, requireFactura: true },
  { value: 'deposito', label: 'Depósito', requireRef: true, requireFactura: true },
  { value: 'canje', label: 'Canje' },
  { value: 'otro', label: 'Otro' },
];

const METODO_COLORS: Record<string, string> = {
  efectivo: '#22c55e',
  tarjeta: '#3b82f6',
  transferencia: '#8b5cf6',
  deposito: '#f59e0b',
  canje: '#ec4899',
  otro: '#94a3b8',
};

const ESTADO_COLORS: Record<string, string> = {
  registrado: '#3b82f6',
  aplicado: '#22c55e',
  anulado: '#ef4444',
};

function fmtMoney(n: number, moneda = 'HNL') {
  return `${moneda} ${n.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s: string) {
  if (!s) return '—';
  const d = new Date(s + (s.includes('T') ? '' : 'T00:00:00'));
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function abreviarId(id: string) {
  if (!id) return '—';
  return id.length > 8 ? `…${id.slice(-8)}` : id;
}

function exportCSV(pagos: PagoDetalle[]) {
  const headers = ['Fecha', 'Huésped', 'Habitación', 'Hotel', 'Check-in', 'Check-out', 'Método', 'Referencia', 'Monto', 'Moneda', 'Estado', 'Notas'];
  const rows = pagos.map(p => [
    p.fecha_pago?.split('T')[0] ?? '',
    p.huesped ?? '',
    p.habitacion ?? '',
    p.hotel ?? '',
    p.check_in?.split('T')[0] ?? '',
    p.check_out?.split('T')[0] ?? '',
    METODOS.find(m => m.value === p.metodo_pago)?.label ?? p.metodo_pago,
    p.referencia ?? '',
    p.monto.toFixed(2),
    p.moneda,
    p.estado,
    p.notas ?? '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pagos_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SaldoEntry {
  id_saldo: string;
  id_huesped: string;
  monto: number;
  descripcion: string;
  tipo: string;
  created_at: string;
  aplicado: boolean;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function getAuthHeaders(contentType = false): Promise<Record<string, string>> {
  const hotelId = localStorage.getItem('active_hotel_id') || '';
  const hdrs: Record<string, string> = { 'X-Hotel-ID': hotelId };
  if (contentType) hdrs['Content-Type'] = 'application/json';
  try {
    const { supabase } = await import('../../api/supabase');
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) hdrs['Authorization'] = `Bearer ${data.session.access_token}`;
  } catch (_) {}
  return hdrs;
}

async function fetchSaldosHuesped(id_huesped: string): Promise<SaldoEntry[]> {
  const r = await fetch(`${API_BASE}/bookings/saldos`, { headers: await getAuthHeaders() });
  if (!r.ok) return [];
  const all: SaldoEntry[] = await r.json();
  return all.filter(s => s.id_huesped === id_huesped && !s.aplicado && s.tipo === 'credito');
}

async function aplicarSaldoAReserva(id_saldo: string, id_reserva_hotel: string): Promise<{ monto_aplicado: number; diferencia: number }> {
  const r = await fetch(`${API_BASE}/bookings/saldos/${id_saldo}/aplicar`, {
    method: 'POST',
    headers: await getAuthHeaders(true),
    body: JSON.stringify({ id_reserva_hotel }),
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? await r.text());
  }
  return r.json();
}

interface PagoForm {
  id_reserva_hotel: string;
  monto: string;
  moneda: string;
  metodo_pago: MetodoPago;
  referencia: string;
  fecha_pago: string;
  estado: 'registrado' | 'aplicado' | 'anulado';
  notas: string;
}

const defaultForm = (): PagoForm => ({
  id_reserva_hotel: '',
  monto: '',
  moneda: 'HNL',
  metodo_pago: 'efectivo',
  referencia: '',
  fecha_pago: toDateKey(new Date()),
  estado: 'registrado',
  notas: '',
});

// ─── Component ───────────────────────────────────────────────────────────────

export const Pagos: React.FC = () => {
  const today = toDateKey(new Date());
  const [searchParams] = useSearchParams();
  const hasMultimoneda = useHasFeature('multimoneda');

  const [desde, setDesde] = useState(() => toDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [hasta, setHasta] = useState(today);
  const [pagos, setPagos] = useState<PagoDetalle[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'historial' | 'pendientes' | 'empresas'>('historial');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaExpandida, setEmpresaExpandida] = useState<string | null>(null);
  const [empresaModalOpen, setEmpresaModalOpen] = useState(false);
  const [empresaModalData, setEmpresaModalData] = useState<{ empresa: Empresa; reservas: (Reserva & { saldo: number; pagado: number })[] } | null>(null);
  const [empresaReservasSeleccionadas, setEmpresaReservasSeleccionadas] = useState<Set<string>>(new Set());
  const [modoFactura, setModoFactura] = useState<'unica' | 'individual'>('unica');
  const [facturaUnica, setFacturaUnica] = useState('');
  const [facturasInd, setFacturasInd] = useState<Record<string, string>>({});

  // Filtros
  const [filtroMetodo, setFiltroMetodo] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [searchText, setSearchText] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PagoForm>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [reservaSearch, setReservaSearch] = useState('');

  // Saldos del cliente (para modal de pago)
  const [saldosCliente, setSaldosCliente] = useState<SaldoEntry[]>([]);
  const [usarSaldo, setUsarSaldo] = useState(false);
  // Total de TODOS los saldos disponibles del cliente
  const totalSaldosDisponibles = saldosCliente.reduce((sum, s) => sum + s.monto, 0);
  const [montoSaldoManual, setMontoSaldoManual] = useState('');
  const [loadingSaldos, setLoadingSaldos] = useState(false);

  // Múltiples métodos de pago
  const [usarSplits, setUsarSplits] = useState(false);
  const [splits, setSplits] = useState<{ id: string; metodo: MetodoPago; monto: string; referencia: string }[]>(
    [{ id: '1', metodo: 'efectivo', monto: '', referencia: '' }]
  );

  // Factura
  const [numeroFactura, setNumeroFactura] = useState('');
  const [sinFactura, setSinFactura] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, r, emps] = await Promise.all([
        fetchPagos({ desde, hasta }),
        fetchReservas(
          toDateKey(addDays(new Date(), -365)),
          toDateKey(addDays(new Date(), 365))
        ),
        fetchEmpresas(),
      ]);
      setPagos(p);
      setReservas(r);
      setEmpresas(emps);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void load(); }, [load]);

  // Auto-abrir modal con reserva desde URL param (?reserva=ID)
  const [autoOpenDone, setAutoOpenDone] = useState(false);
  useEffect(() => {
    const reservaId = searchParams.get('reserva');
    if (reservaId && reservas.length > 0 && !autoOpenDone) {
      setAutoOpenDone(true);
      openNew(reservaId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, reservas]);

  // ── Filtrado ──
  const pagosFiltrados = useMemo(() => {
    return pagos.filter(p => {
      if (filtroMetodo !== 'todos' && p.metodo_pago !== filtroMetodo) return false;
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (
          !p.huesped?.toLowerCase().includes(q) &&
          !p.habitacion?.toLowerCase().includes(q) &&
          !p.referencia?.toLowerCase().includes(q) &&
          !p.notas?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [pagos, filtroMetodo, filtroEstado, searchText]);

  // ── Totales ──
  const totales = useMemo(() => {
    const activos = pagosFiltrados.filter(p => p.estado !== 'anulado');
    const porMetodo: Record<string, number> = {};
    let totalHNL = 0, totalUSD = 0;
    for (const p of activos) {
      porMetodo[p.metodo_pago] = (porMetodo[p.metodo_pago] ?? 0) + p.monto;
      if (p.moneda === 'USD') totalUSD += p.monto;
      else totalHNL += p.monto;
    }
    return { porMetodo, totalHNL, totalUSD, count: activos.length };
  }, [pagosFiltrados]);

  // ── Reservas con saldo pendiente ──
  const todayMs = new Date().setHours(0, 0, 0, 0);

  // ── Datos por empresa (crédito) ──
  const empresasConCredito = useMemo(() => {
    return empresas
      .map(emp => {
        const reservasEmp = reservas
          .filter(r => r.id_empresa === emp.id_empresa && r.estado !== 'cancelada')
          .map(r => {
            const pagado = (r.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
            return { ...r, pagado, saldo: Math.max(0, r.total_reserva - pagado) };
          });
        const totalDeuda = reservasEmp.reduce((s, r) => s + r.saldo, 0);
        const reservasPendientesEmp = reservasEmp.filter(r => r.saldo > 0.01);
        const diasCredito = emp.dias_credito ?? 30;
        const reservasVencidas = reservasPendientesEmp.filter(r => {
          const checkOutMs = new Date(r.check_out).setHours(0,0,0,0);
          const diasDesdeCheckout = Math.floor((Date.now() - checkOutMs) / 86400000);
          return diasDesdeCheckout > diasCredito && checkOutMs <= todayMs;
        });
        return { empresa: emp, reservas: reservasEmp, totalDeuda, pendientes: reservasPendientesEmp.length, vencidas: reservasVencidas.length };
      })
      .filter(e => e.reservas.length > 0)
      .sort((a, b) => b.totalDeuda - a.totalDeuda);
  }, [empresas, reservas, todayMs]);

  function openEmpresaModal(emp: Empresa) {
    const reservasEmp = reservas
      .filter(r => r.id_empresa === emp.id_empresa && r.estado !== 'cancelada')
      .map(r => {
        const pagado = (r.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
        return { ...r, pagado, saldo: Math.max(0, r.total_reserva - pagado) };
      })
      .filter(r => r.saldo > 0.01)
      .sort((a, b) => new Date(a.check_out).getTime() - new Date(b.check_out).getTime());
    setEmpresaModalData({ empresa: emp, reservas: reservasEmp });
    setEmpresaReservasSeleccionadas(new Set(reservasEmp.map(r => r.id_reserva_hotel)));
    setForm(f => ({ ...f, moneda: reservasEmp[0]?.moneda ?? 'HNL', monto: reservasEmp.reduce((s, r) => s + r.saldo, 0).toFixed(2) }));
    setModoFactura('unica');
    setFacturaUnica('');
    setFacturasInd({});
    setEmpresaModalOpen(true);
  }

  async function handleSaveEmpresaPago() {
    if (!empresaModalData) return;
    if (!form.monto || Number(form.monto) <= 0) { showToast('El monto debe ser mayor a 0', 'err'); return; }
    const metodoObj = METODOS.find(m => m.value === form.metodo_pago);
    if (metodoObj?.requireRef && !form.referencia.trim()) {
      showToast(`Ingresa el número de referencia para ${metodoObj.label}`, 'err'); return;
    }
    const reservasTarget = empresaModalData.reservas.filter(r => empresaReservasSeleccionadas.has(r.id_reserva_hotel));
    if (reservasTarget.length === 0) { showToast('Selecciona al menos una reserva', 'err'); return; }
    setSaving(true);
    try {
      let montoRestante = Number(form.monto);
      for (const r of reservasTarget) {
        if (montoRestante <= 0) break;
        const montoEstaReserva = Math.min(montoRestante, r.saldo);
        const numFactura = modoFactura === 'unica' ? facturaUnica : (facturasInd[r.id_reserva_hotel] ?? '');
        const parteFactura = numFactura.trim() ? `Factura: ${numFactura.trim()} | ` : '';
        const parteNotas = form.notas.trim() ? ` | ${form.notas.trim()}` : '';
        await createPago({
          id_reserva_hotel: r.id_reserva_hotel,
          monto: montoEstaReserva,
          moneda: form.moneda,
          metodo_pago: form.metodo_pago,
          referencia: form.referencia || undefined,
          fecha_pago: form.fecha_pago,
          estado: form.estado,
          notas: `${parteFactura}${empresaModalData.empresa.nombre}${parteNotas}`,
        });
        montoRestante -= montoEstaReserva;
      }
      showToast(`Pago registrado para ${empresaModalData.empresa.nombre}`);
      setEmpresaModalOpen(false);
      setEmpresaModalData(null);
      setForm(defaultForm());
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al guardar', 'err');
    } finally {
      setSaving(false);
    }
  }

  const reservasPendientes = useMemo(() => {
    return reservas
      .filter(r => r.estado !== 'cancelada' && !r.es_cortesia && !r.id_empresa)
      .map(r => {
        const pagado = (r.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
        const saldo = r.total_reserva - pagado;
        return { ...r, pagado, saldo };
      })
      .filter(r => r.saldo > 0.01)
      .sort((a, b) => new Date(a.check_out).getTime() - new Date(b.check_out).getTime());
  }, [reservas]);

  // ── Reservas filtradas para búsqueda en el form ──
  const reservasFiltradas = useMemo(() => {
    if (!reservaSearch.trim()) return reservas.filter(r => r.estado !== 'cancelada' && !r.es_cortesia && !r.id_empresa).slice(0, 10);
    const q = reservaSearch.toLowerCase();
    return reservas.filter(r =>
      r.estado !== 'cancelada' && !r.es_cortesia && !r.id_empresa && (
        r.huesped?.toLowerCase().includes(q) ||
        r.habitacion?.toLowerCase().includes(q)
      )
    ).slice(0, 12);
  }, [reservas, reservaSearch]);

  // ── Reserva seleccionada y saldo ──
  const selectedReserva = reservas.find(r => r.id_reserva_hotel === form.id_reserva_hotel);

  const saldoPendiente = useMemo(() => {
    if (!selectedReserva) return null;
    const pagado = (selectedReserva.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
    return Math.max(0, selectedReserva.total_reserva - pagado);
  }, [selectedReserva]);

  const montoNum = parseFloat(form.monto) || 0;
  const montoExcedeSaldo = saldoPendiente !== null && montoNum > saldoPendiente + 0.009;
  const metodoRequiereRef = METODOS.find(m => m.value === form.metodo_pago)?.requireRef;

  // ── Abrir modal ──
  // Cuando cambia la reserva seleccionada → buscar saldos del huésped
  useEffect(() => {
    if (!form.id_reserva_hotel || editingId) { setSaldosCliente([]); setUsarSaldo(false); setMontoSaldoManual(''); return; }
    const r = reservas.find(rv => rv.id_reserva_hotel === form.id_reserva_hotel);
    if (!r?.id_huesped) { setSaldosCliente([]); return; }
    setLoadingSaldos(true);
    fetchSaldosHuesped(r.id_huesped)
      .then(s => { setSaldosCliente(s); if (s.length === 0) { setUsarSaldo(false); setMontoSaldoManual(''); } })
      .finally(() => setLoadingSaldos(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id_reserva_hotel]);

  // Inicializar montoSaldoManual con el total de todos los saldos al activar "usar saldo"
  useEffect(() => {
    if (usarSaldo && totalSaldosDisponibles > 0 && saldoPendiente != null) {
      setMontoSaldoManual(Math.min(totalSaldosDisponibles, saldoPendiente).toFixed(2));
    }
    if (!usarSaldo) setMontoSaldoManual('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usarSaldo, totalSaldosDisponibles]);

  const montoSaldoAplicar = usarSaldo && totalSaldosDisponibles > 0
    ? Math.min(Math.max(0, parseFloat(montoSaldoManual) || 0), Math.min(totalSaldosDisponibles, saldoPendiente ?? 0))
    : 0;
  const diferenciaPagar = Math.max(0, (saldoPendiente ?? 0) - montoSaldoAplicar);
  const totalSplits = splits.reduce((s, sp) => s + (parseFloat(sp.monto) || 0), 0);
  const splitsCompletos = !usarSplits || Math.abs(totalSplits - diferenciaPagar) < 0.02;

  // Si alguno de los métodos activos requiere factura (efectivo, tarjeta, transferencia, depósito)
  const pagoRequiereFactura = !editingId && (
    usarSplits
      ? splits.some(sp => METODOS.find(m => m.value === sp.metodo)?.requireFactura)
      : METODOS.find(m => m.value === form.metodo_pago)?.requireFactura === true &&
        (!usarSaldo || diferenciaPagar > 0.01)
  );


  function openNew(reservaId?: string) {
    setEditingId(null);
    const f = defaultForm();
    if (reservaId) {
      f.id_reserva_hotel = reservaId;
      const r = reservas.find(rv => rv.id_reserva_hotel === reservaId);
      if (r) f.moneda = r.moneda;
    }
    setForm(f);
    setReservaSearch('');
    setUsarSaldo(false);
    setMontoSaldoManual('');
    setSaldosCliente([]);
    setUsarSplits(false);
    setSplits([{ id: '1', metodo: 'efectivo', monto: '', referencia: '' }]);
    setNumeroFactura('');
    setSinFactura(false);
    setModalOpen(true);
  }

  function openEdit(p: PagoDetalle) {
    setEditingId(p.id_pago_hotel);
    setForm({
      id_reserva_hotel: p.id_reserva_hotel,
      monto: String(p.monto),
      moneda: p.moneda,
      metodo_pago: p.metodo_pago as MetodoPago,
      referencia: p.referencia ?? '',
      fecha_pago: p.fecha_pago?.split('T')[0] ?? today,
      estado: p.estado,
      notas: p.notas ?? '',
    });
    setReservaSearch('');
    setNumeroFactura('');
    setSinFactura(false);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setUsarSaldo(false);
    setMontoSaldoManual('');
    setSaldosCliente([]);
    setUsarSplits(false);
    setSplits([{ id: '1', metodo: 'efectivo', monto: '', referencia: '' }]);
    setNumeroFactura('');
    setSinFactura(false);
  }

  // ── Guardar ──
  async function handleSave() {
    if (!form.id_reserva_hotel) { showToast('Selecciona una reserva', 'err'); return; }
    const reservaSeleccionada = reservas.find(r => r.id_reserva_hotel === form.id_reserva_hotel);
    if (reservaSeleccionada?.es_cortesia) { showToast('Las reservas de cortesía no generan cobro', 'err'); return; }

    // Validaciones según modo
    if (usarSplits) {
      if (splits.some(sp => !sp.monto || parseFloat(sp.monto) <= 0)) {
        showToast('Todos los métodos de pago deben tener un monto mayor a 0', 'err'); return;
      }
      const refFaltante = splits.find(sp => METODOS.find(m => m.value === sp.metodo)?.requireRef && !sp.referencia.trim());
      if (refFaltante) {
        showToast(`Ingresa referencia para ${METODOS.find(m => m.value === refFaltante.metodo)?.label}`, 'err'); return;
      }
      if (!splitsCompletos) {
        const diff = (diferenciaPagar - totalSplits).toFixed(2);
        showToast(`La suma de métodos (${fmtMoney(totalSplits, form.moneda)}) no coincide con el total a cobrar. Faltan: HNL ${diff}`, 'err'); return;
      }
    } else if (!usarSaldo || diferenciaPagar > 0.01) {
      if (!form.monto || isNaN(Number(form.monto)) || Number(form.monto) <= 0) {
        showToast('El monto debe ser mayor a 0', 'err'); return;
      }
      if (metodoRequiereRef && !form.referencia.trim()) {
        showToast(`Ingresa el número de referencia para ${METODOS.find(m => m.value === form.metodo_pago)?.label}`, 'err'); return;
      }
    }

    // Validación de factura
    if (pagoRequiereFactura && !sinFactura && !numeroFactura.trim()) {
      showToast('Ingresa el número de factura o marca "Sin factura"', 'err'); return;
    }

    // Helper: prefija la factura en las notas
    const buildNotas = (baseNotas: string): string | undefined => {
      if (!pagoRequiereFactura) return baseNotas || undefined;
      const prefijo = sinFactura ? 'Sin factura' : `Factura: ${numeroFactura.trim()}`;
      return baseNotas.trim() ? `${prefijo} | ${baseNotas.trim()}` : prefijo;
    };

    setSaving(true);
    try {
      if (editingId) {
        await updatePago(editingId, {
          monto: Number(form.monto),
          moneda: form.moneda,
          metodo_pago: form.metodo_pago,
          referencia: form.referencia || undefined,
          fecha_pago: form.fecha_pago,
          estado: form.estado,
          notas: form.notas || undefined,
        });
        showToast('Pago actualizado');
      } else {
        // 1) Aplicar saldos en orden FIFO hasta cubrir el montoSaldoAplicar
        if (usarSaldo && montoSaldoAplicar > 0.01) {
          let restante = montoSaldoAplicar;
          for (const s of saldosCliente) {
            if (restante <= 0.01) break;
            await aplicarSaldoAReserva(s.id_saldo, form.id_reserva_hotel);
            restante -= s.monto;
          }
        }
        // 2) Registrar diferencia: con splits o pago único
        if (diferenciaPagar > 0.01) {
          if (usarSplits) {
            for (const sp of splits) {
              await createPago({
                id_reserva_hotel: form.id_reserva_hotel,
                monto: parseFloat(sp.monto),
                moneda: form.moneda,
                metodo_pago: sp.metodo,
                referencia: sp.referencia || undefined,
                fecha_pago: form.fecha_pago,
                estado: form.estado,
                notas: buildNotas(form.notas),
              });
            }
            const metodosUsados = splits.map(sp => METODOS.find(m => m.value === sp.metodo)?.label).join(' + ');
            showToast(usarSaldo && montoSaldoAplicar > 0.01
              ? `Saldo HNL ${montoSaldoAplicar.toFixed(2)} aplicado + ${fmtMoney(diferenciaPagar, form.moneda)} cobrado (${metodosUsados})`
              : `Pago registrado: ${metodosUsados}`);
          } else {
            await createPago({
              id_reserva_hotel: form.id_reserva_hotel,
              monto: diferenciaPagar > 0.01 ? diferenciaPagar : Number(form.monto),
              moneda: form.moneda,
              metodo_pago: form.metodo_pago,
              referencia: form.referencia || undefined,
              fecha_pago: form.fecha_pago,
              estado: form.estado,
              notas: buildNotas(form.notas),
            });
            showToast(usarSaldo && montoSaldoAplicar > 0.01
              ? `Saldo HNL ${montoSaldoAplicar.toFixed(2)} aplicado + diferencia ${fmtMoney(diferenciaPagar, form.moneda)} registrada`
              : 'Pago registrado');
          }
        } else {
          showToast('Saldo aplicado ✓ Reserva cubierta completamente');
        }
      }
      closeModal();
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al guardar', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleAnular(id: string) {
    const motivo = prompt('Por favor, ingrese el motivo de la anulación del pago (obligatorio):');
    if (motivo === null) return; // Cancelado por el usuario
    if (!motivo.trim()) {
      showToast('Debe ingresar un motivo para anular el pago', 'err');
      return;
    }

    try {
      await anularPago(id, motivo.trim());
      showToast('Pago anulado');
      void load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al anular', 'err');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--shell-bg)' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'ok' ? '#22c55e' : '#ef4444',
          color: '#fff', padding: '10px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 20px #0003',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--shell-border-subtle)', flexShrink: 0, background: 'var(--card-bg)' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div className="page-header-left" style={{ position: 'relative', paddingLeft: 18 }}>
            <div style={{ position: 'absolute', left: 0, top: 2, bottom: 4, width: 4, borderRadius: 99, background: 'linear-gradient(to bottom, #10b981, #3b82f6)' }} />
            <span className="page-kicker">Contabilidad</span>
            <h1 className="page-title" style={{ fontSize: 22, background: 'linear-gradient(135deg, var(--text-h) 0%, #10b981 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Pagos
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <DateRangePicker
              from={desde} to={hasta}
              onFromChange={setDesde} onToChange={setHasta}
              placeholderFrom="Desde" placeholderTo="Hasta"
              gap={6}
            />
            <button onClick={load}
              title="Actualizar"
              style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--shell-border-strong)', background: 'var(--card-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', transition: 'all .18s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-h)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--shell-border-strong)'; }}
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => exportCSV(pagosFiltrados.filter(p => p.estado !== 'anulado'))}
              className="btn-premium btn-premium-secondary"
              style={{ height: 34, gap: 6, fontSize: 12 }}>
              <Download size={13} /> Exportar CSV
            </button>
            <button onClick={() => openNew()}
              className="btn-premium btn-premium-primary"
              style={{ height: 34, gap: 6, fontSize: 12 }}>
              <Plus size={13} /> Nuevo pago
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, padding: '14px 24px', flexShrink: 0 }}>
        <div className="kpi-card kpi-card-emerald" style={{ animationDelay: '0ms', padding: '16px 18px' }}>
          <div className="kpi-icon-wrap"><DollarSign size={16} /></div>
          <div className="kpi-label">Cobrado HNL</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>L {totales.totalHNL.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</div>
          <div className="kpi-sub"><span className="kpi-sub-text">{totales.count} pago{totales.count !== 1 ? 's' : ''} activos</span></div>
        </div>
        <div className="kpi-card kpi-card-blue" style={{ animationDelay: '50ms', padding: '16px 18px' }}>
          <div className="kpi-icon-wrap"><CreditCard size={16} /></div>
          <div className="kpi-label">Cobrado USD</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{totales.totalUSD > 0 ? `$ ${totales.totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}</div>
          <div className="kpi-sub"><span className="kpi-sub-text">Dólares en período</span></div>
        </div>
        <div className="kpi-card kpi-card-violet" style={{ animationDelay: '100ms', padding: '16px 18px' }}>
          <div className="kpi-icon-wrap"><CheckCircle size={16} /></div>
          <div className="kpi-label">Pagos registrados</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{totales.count}</div>
          <div className="kpi-sub"><span className="kpi-sub-text">{pagosFiltrados.filter(p => p.estado === 'anulado').length} anulados</span></div>
        </div>
        <div className={`kpi-card ${reservasPendientes.length > 0 ? 'kpi-card-amber' : 'kpi-card-emerald'}`} style={{ animationDelay: '150ms', padding: '16px 18px' }}>
          <div className="kpi-icon-wrap"><Clock size={16} /></div>
          <div className="kpi-label">Saldos pendientes</div>
          <div className="kpi-value" style={{ fontSize: 20 }}>{reservasPendientes.length}</div>
          <div className="kpi-sub">
            {reservasPendientes.length > 0
              ? <><span className="kpi-trend-badge kpi-trend-down" style={{ fontSize: 10 }}>{reservasPendientes.filter(r => new Date(r.check_out).setHours(0,0,0,0) <= todayMs).length} vencidos</span></>
              : <span className="kpi-trend-badge kpi-trend-up" style={{ fontSize: 10 }}>Todo al día</span>
            }
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', padding: '10px 24px', borderBottom: '1px solid var(--shell-border-subtle)', flexShrink: 0, background: 'var(--card-bg)', gap: 4 }}>
        {[
          { id: 'historial', label: 'Historial de pagos' },
          { id: 'pendientes', label: `Saldos pendientes${reservasPendientes.length > 0 ? ` (${reservasPendientes.length})` : ''}` },
          { id: 'empresas', label: `Crédito empresarial${empresasConCredito.filter(e => e.totalDeuda > 0.01).length > 0 ? ` (${empresasConCredito.filter(e => e.totalDeuda > 0.01).length})` : ''}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)} style={{
            padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontSize: 12.5, fontWeight: 600, transition: 'all .18s ease',
            background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
            color: activeTab === tab.id ? '#ffffff' : 'var(--muted)',
            boxShadow: activeTab === tab.id ? '0 2px 8px rgba(37,99,235,.22)' : 'none',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Cuerpo ── */}
      {activeTab === 'historial' ? (
        <>
          {/* Filtros + totales por método */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 24px', borderBottom: '1px solid var(--shell-border-subtle)', flexShrink: 0, background: 'var(--card-bg)', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)} className="input-premium" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
              <option value="todos">Todos los métodos</option>
              {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="input-premium" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>
              <option value="todos">Todos los estados</option>
              <option value="registrado">Registrado</option>
              <option value="aplicado">Aplicado</option>
              <option value="anulado">Anulado</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1.5px solid var(--shell-border-strong)', borderRadius: 10, padding: '5px 12px', background: 'var(--card-bg)', transition: 'border-color .18s' }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--shell-border-strong)')}
            >
              <Search size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="Buscar huésped, habitación, referencia…"
                style={{ border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-h)', background: 'transparent', width: 220, fontFamily: 'var(--sans)' }} />
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {Object.entries(totales.porMetodo).map(([metodo, monto]) => (
                <div key={metodo} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: (METODO_COLORS[metodo] ?? '#94a3b8') + '12',
                  border: `1px solid ${(METODO_COLORS[metodo] ?? '#94a3b8')}25`,
                  borderRadius: 99, padding: '3px 11px',
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: METODO_COLORS[metodo] ?? 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    {METODOS.find(m => m.value === metodo)?.label ?? metodo}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-h)' }}>
                    L {monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla historial */}
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--muted)', fontSize: 13, gap: 8 }}>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Cargando…
              </div>
            ) : error ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--danger)', fontSize: 13, gap: 8 }}>
                <AlertCircle size={16} /> {error}
              </div>
            ) : pagosFiltrados.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--muted)', gap: 8 }}>
                <DollarSign size={28} color="var(--shell-border-strong)" />
                <span style={{ fontSize: 13, fontWeight: 500 }}>No hay pagos en el rango seleccionado</span>
              </div>
            ) : (
              <table className="table-premium">
                <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    {['Fecha', 'ID Reserva', 'Huésped', 'Habitación', 'Período', 'Método', 'Referencia', 'Factura / Notas', 'Monto', 'Estado', ''].map(h => (
                      <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagosFiltrados.map((p) => (
                    <tr key={p.id_pago_hotel} style={{ opacity: p.estado === 'anulado' ? 0.5 : 1 }}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-h)' }}>{fmtDate(p.fecha_pago)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)', fontSize: 11.5, fontFamily: 'monospace', fontWeight: 600 }} title={p.id_reserva_hotel}>{abreviarId(p.id_reserva_hotel)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-h)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.huesped ?? '—'}</td>
                      <td style={{ color: 'var(--muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.habitacion ?? '—'}{p.hotel ? <span style={{ color: 'var(--muted)', fontSize: 11, opacity: .7 }}> · {p.hotel}</span> : null}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {p.check_in ? `${p.check_in.split('T')[0]} → ${p.check_out?.split('T')[0]}` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap',
                            color: METODO_COLORS[p.metodo_pago] ?? 'var(--muted)',
                            background: (METODO_COLORS[p.metodo_pago] ?? '#94a3b8') + '14',
                            border: `1px solid ${(METODO_COLORS[p.metodo_pago] ?? '#94a3b8')}28`,
                          }}>
                            {METODOS.find(m => m.value === p.metodo_pago)?.label ?? p.metodo_pago}
                          </span>
                          {p.estado !== 'anulado' && p.fecha_pago && p.check_in && getOnlyDate(p.fecha_pago) < getOnlyDate(p.check_in) && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', padding: '1px 5px', borderRadius: 4 }} title="Pago antes del check-in">
                              Anticipo
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.referencia || '—'}</td>
                      <td style={{ maxWidth: 200 }}>
                        {(() => {
                          const notas = p.notas ?? '';
                          const match = notas.match(/Factura:\s*([^|]+)/);
                          const numFactura = match ? match[1].trim() : null;
                          const resto = notas.replace(/Factura:\s*[^|]+\|?\s*/, '').trim();
                          return notas ? (
                            <div title={notas}>
                              {numFactura && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', border: '1px solid var(--accent-border)' }}>
                                  🧾 {numFactura}
                                </span>
                              )}
                              {resto && (
                                <div style={{ fontSize: 11, color: p.estado === 'anulado' ? 'var(--danger)' : 'var(--muted)', fontWeight: p.estado === 'anulado' ? 600 : 400, marginTop: numFactura ? 3 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }} title={resto}>
                                  {resto}
                                </div>
                              )}
                            </div>
                          ) : <span style={{ color: 'var(--shell-border-strong)' }}>—</span>;
                        })()}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--text-h)', whiteSpace: 'nowrap' }}>{fmtMoney(p.monto, p.moneda)}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99,
                          color: ESTADO_COLORS[p.estado] ?? 'var(--muted)',
                          background: (ESTADO_COLORS[p.estado] ?? '#94a3b8') + '14',
                          border: `1px solid ${(ESTADO_COLORS[p.estado] ?? '#94a3b8')}28`,
                        }}>
                          {p.estado}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.estado !== 'anulado' && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => openEdit(p)} className="btn-premium btn-premium-secondary" style={{ fontSize: 11, padding: '3px 10px', height: 'auto' }}>
                              Editar
                            </button>
                            <button onClick={() => void handleAnular(p.id_pago_hotel)}
                              style={{ fontSize: 11, color: 'var(--danger)', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, padding: '3px 10px', cursor: 'pointer', fontWeight: 600, transition: 'all .18s' }}>
                              Anular
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : activeTab === 'empresas' ? (
        /* ── Tab: Crédito Empresarial ── */
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 13 }}>Cargando…</div>
          ) : empresasConCredito.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
              <CheckCircle size={40} style={{ color: '#22c55e' }} />
              <div style={{ color: '#374151', fontSize: 14, fontWeight: 600 }}>No hay reservas de crédito</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Ninguna empresa tiene reservas activas</div>
            </div>
          ) : empresasConCredito.map(({ empresa, reservas: resEmp, totalDeuda, pendientes, vencidas }) => {
            const isExpanded = empresaExpandida === empresa.id_empresa;
            const reservasConSaldo = resEmp.filter(r => r.saldo > 0.01);
            const reservasCobradas = resEmp.filter(r => r.saldo <= 0.01);
            return (
              <div key={empresa.id_empresa} style={{ border: `1px solid ${totalDeuda > 0.01 ? (vencidas > 0 ? '#fecaca' : '#bfdbfe') : '#e2e8f0'}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                {/* Empresa header */}
                <div
                  style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', background: totalDeuda > 0.01 ? (vencidas > 0 ? '#fef2f2' : '#eff6ff') : '#f8fafc' }}
                  onClick={() => setEmpresaExpandida(isExpanded ? null : empresa.id_empresa)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>🏢 {empresa.nombre}</span>
                      {empresa.rtn && <span style={{ fontSize: 11, color: '#64748b', background: '#f1f5f9', padding: '1px 8px', borderRadius: 20 }}>RTN: {empresa.rtn}</span>}
                      {vencidas > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '1px 8px', borderRadius: 20 }}>⚠ {vencidas} vencida{vencidas !== 1 ? 's' : ''}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                      {resEmp.length} reserva{resEmp.length !== 1 ? 's' : ''} total
                      {empresa.contacto_nombre ? ` · Contacto: ${empresa.contacto_nombre}` : ''}
                      {empresa.contacto_telefono ? ` · ${empresa.contacto_telefono}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo adeudado</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: totalDeuda > 0.01 ? (vencidas > 0 ? '#ef4444' : '#1d4ed8') : '#22c55e' }}>
                      {totalDeuda > 0.01 ? `HNL ${totalDeuda.toLocaleString('es-HN', { minimumFractionDigits: 2 })}` : '✓ Al día'}
                    </div>
                    {pendientes > 0 && <div style={{ fontSize: 11, color: '#64748b' }}>{pendientes} reserva{pendientes !== 1 ? 's' : ''} sin cobrar</div>}
                  </div>
                  {totalDeuda > 0.01 && (
                    <button
                      onClick={e => { e.stopPropagation(); openEmpresaModal(empresa); }}
                      style={{ padding: '7px 14px', fontSize: 12, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}
                    >
                      Registrar cobro
                    </button>
                  )}
                  <span style={{ color: '#94a3b8', fontSize: 16, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {/* Reservas detalle (expandible) */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    {reservasConSaldo.length > 0 && (
                      <>
                        <div style={{ padding: '8px 18px', fontSize: 11, fontWeight: 700, color: '#3b82f6', background: '#eff6ff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Pendientes de cobro</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              {['Huésped', 'Habitación', 'Check-in', 'Check-out', 'Total', 'Pagado', 'Saldo', 'Días crédito', ''].map(h => (
                                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {reservasConSaldo.map((r, i) => {
                              const checkOutMs = new Date(r.check_out).setHours(0,0,0,0);
                              const diasDesdeCheckout = Math.floor((Date.now() - checkOutMs) / 86400000);
                              const diasCredito = empresa.dias_credito ?? 30;
                              const estaVencida = diasDesdeCheckout > diasCredito && checkOutMs <= todayMs;
                              const diasRestantes = diasCredito - diasDesdeCheckout;
                              return (
                                <tr key={r.id_reserva_hotel} style={{ borderBottom: '1px solid #f1f5f9', background: estaVencida ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                  <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                                    {estaVencida && <AlertTriangle size={12} style={{ color: '#ef4444', marginRight: 4 }} />}
                                    {r.huesped ?? '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.habitacion ?? '—'}</td>
                                  <td style={{ padding: '8px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(r.check_in)}</td>
                                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: estaVencida ? '#ef4444' : '#374151', fontWeight: estaVencida ? 600 : 400 }}>{fmtDate(r.check_out)}</td>
                                  <td style={{ padding: '8px 12px', color: '#374151' }}>{fmtMoney(r.total_reserva, r.moneda)}</td>
                                  <td style={{ padding: '8px 12px', color: '#22c55e', fontWeight: 500 }}>{fmtMoney(r.pagado, r.moneda)}</td>
                                  <td style={{ padding: '8px 12px', fontWeight: 700, color: estaVencida ? '#ef4444' : '#f97316' }}>{fmtMoney(r.saldo, r.moneda)}</td>
                                  <td style={{ padding: '8px 12px' }}>
                                    {checkOutMs <= todayMs ? (
                                      <span style={{ fontSize: 11, fontWeight: 600, color: estaVencida ? '#ef4444' : '#22c55e', background: estaVencida ? '#fef2f2' : '#f0fdf4', padding: '2px 7px', borderRadius: 20 }}>
                                        {estaVencida ? `${diasDesdeCheckout - diasCredito}d vencido` : `${diasRestantes}d restantes`}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11, color: '#94a3b8' }}>En estancia</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <button onClick={() => openNew(r.id_reserva_hotel)}
                                      style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>
                                      Cobrar
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
                    {reservasCobradas.length > 0 && (
                      <>
                        <div style={{ padding: '8px 18px', fontSize: 11, fontWeight: 700, color: '#22c55e', background: '#f0fdf4', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reservas cobradas</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <tbody>
                            {reservasCobradas.map((r, i) => (
                              <tr key={r.id_reserva_hotel} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa', opacity: 0.7 }}>
                                <td style={{ padding: '6px 12px', color: '#64748b' }}>{r.huesped ?? '—'}</td>
                                <td style={{ padding: '6px 12px', color: '#64748b' }}>{r.habitacion ?? '—'}</td>
                                <td style={{ padding: '6px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</td>
                                <td style={{ padding: '6px 12px', fontWeight: 600, color: '#22c55e' }}>{fmtMoney(r.total_reserva, r.moneda)}</td>
                                <td style={{ padding: '6px 12px' }}><span style={{ fontSize: 11, color: '#22c55e', background: '#f0fdf4', padding: '1px 7px', borderRadius: 20 }}>✓ Cobrado</span></td>
                              </tr>
                            ))}
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
      ) : (
        /* ── Tab: Saldos Pendientes ── */
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#94a3b8', fontSize: 13 }}>Cargando…</div>
          ) : reservasPendientes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
              <CheckCircle size={40} style={{ color: '#22c55e' }} />
              <div style={{ color: '#374151', fontSize: 14, fontWeight: 600 }}>No hay saldos pendientes</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>Todas las reservas están al día</div>
            </div>
          ) : (
            <table className="table-premium">
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  {['Huésped', 'Habitación', 'Check-in', 'Check-out', 'Total', 'Pagado', 'Saldo pendiente', 'Estado', ''].map(h => (
                    <th key={h} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservasPendientes.map((r, i) => {
                  const checkOutMs = new Date(r.check_out).setHours(0, 0, 0, 0);
                  const isVencida = checkOutMs <= todayMs;
                  const isProxima = !isVencida && checkOutMs - todayMs <= 3 * 86400000;
                  const pctPagado = r.total_reserva > 0 ? Math.min(100, (r.pagado / r.total_reserva) * 100) : 0;
                  return (
                    <tr key={r.id_reserva_hotel}
                      style={{ borderBottom: '1px solid #f1f5f9', background: isVencida ? '#fff5f5' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isVencida && <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />}
                          {r.huesped ?? '—'}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{r.habitacion ?? '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(r.check_in)}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: isVencida ? '#ef4444' : isProxima ? '#f97316' : '#374151', fontWeight: isVencida || isProxima ? 600 : 400 }}>
                          {fmtDate(r.check_out)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{fmtMoney(r.total_reserva, r.moneda)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ color: '#374151' }}>{fmtMoney(r.pagado, r.moneda)}</span>
                          <div style={{ width: 80, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${pctPagado}%`, height: '100%', background: pctPagado >= 100 ? '#22c55e' : pctPagado > 0 ? '#eab308' : '#e2e8f0', borderRadius: 2 }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: isVencida ? '#ef4444' : '#f97316' }}>
                        {fmtMoney(r.saldo, r.moneda)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: isVencida ? '#fef2f2' : isProxima ? '#fff7ed' : '#eff6ff',
                          color: isVencida ? '#ef4444' : isProxima ? '#f97316' : '#3b82f6',
                        }}>
                          {isVencida ? 'Vencida' : isProxima ? 'Próxima' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => openNew(r.id_reserva_hotel)}
                          style={{ fontSize: 11, color: '#fff', background: '#1e293b', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}>
                          Cobrar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="modal-backdrop-premium" onClick={closeModal}>
          <div className="modal-content-premium" style={{ width: '100%', maxWidth: 520 }}
            onClick={e => e.stopPropagation()}>

            {/* Header modal */}
            <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--shell-border-subtle)', paddingBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-h)' }}>
                  {editingId ? 'Editar pago' : 'Registrar pago'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  {editingId ? 'Modifica los datos del pago' : 'Asocia un cobro a una reserva'}
                </p>
              </div>
              <button onClick={closeModal} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 8, display: 'flex', transition: 'color .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-h)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Seleccionar reserva */}
              {!editingId && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Reserva *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', background: '#fff' }}>
                    <Search size={13} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <input
                      value={form.id_reserva_hotel
                        ? (selectedReserva ? `${selectedReserva.huesped} · ${selectedReserva.habitacion}` : form.id_reserva_hotel)
                        : reservaSearch}
                      onChange={e => { setReservaSearch(e.target.value); setForm(f => ({ ...f, id_reserva_hotel: '' })); }}
                      placeholder="Buscar por huésped o habitación…"
                      style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1 }}
                    />
                    {form.id_reserva_hotel && (
                      <button onClick={() => { setForm(f => ({ ...f, id_reserva_hotel: '' })); setReservaSearch(''); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {/* Dropdown resultados */}
                  {!form.id_reserva_hotel && reservaSearch.length > 0 && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, marginTop: 4, overflow: 'hidden', maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px #0002' }}>
                      {reservasFiltradas.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>Sin resultados</div>
                      ) : reservasFiltradas.map(rv => {
                        const pagadoRv = (rv.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0);
                        const saldoRv = rv.total_reserva - pagadoRv;
                        return (
                          <button key={rv.id_reserva_hotel}
                            onClick={() => { setForm(f => ({ ...f, id_reserva_hotel: rv.id_reserva_hotel, moneda: rv.moneda })); setReservaSearch(''); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', background: '#fff', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                              <div>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>{rv.huesped}</span>
                                <span style={{ color: '#64748b', marginLeft: 6, fontSize: 12 }}>{rv.habitacion}</span>
                              </div>
                              <span style={{ fontSize: 11, color: saldoRv > 0.01 ? '#f97316' : '#22c55e', fontWeight: 600 }}>
                                {saldoRv > 0.01 ? `Saldo: L ${saldoRv.toFixed(2)}` : '✓ Al día'}
                              </span>
                            </div>
                            <span style={{ color: '#94a3b8', fontSize: 11 }}>
                              {rv.check_in?.split('T')[0]} → {rv.check_out?.split('T')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* Panel info de reserva seleccionada con saldo */}
                  {selectedReserva && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginTop: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{selectedReserva.huesped}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>
                            {selectedReserva.habitacion} · {selectedReserva.check_in?.split('T')[0]} → {selectedReserva.check_out?.split('T')[0]}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>Total reserva</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{fmtMoney(selectedReserva.total_reserva, selectedReserva.moneda)}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                          <span style={{ color: '#22c55e' }}>
                            ✓ Pagado: {fmtMoney(
                              (selectedReserva.pagos ?? []).filter(p => p.estado !== 'anulado').reduce((s, p) => s + p.monto, 0),
                              selectedReserva.moneda
                            )}
                          </span>
                          <span style={{ color: (saldoPendiente ?? 0) > 0 ? '#f97316' : '#22c55e', fontWeight: 600 }}>
                            {(saldoPendiente ?? 0) > 0 ? `Saldo: ${fmtMoney(saldoPendiente ?? 0, selectedReserva.moneda)}` : '✓ Completamente pagada'}
                          </span>
                        </div>
                        {(saldoPendiente ?? 0) > 0 && (
                          <button
                            onClick={() => setForm(f => ({ ...f, monto: (saldoPendiente ?? 0).toFixed(2) }))}
                            style={{ fontSize: 11, color: '#fff', background: '#3b82f6', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                            Cobrar saldo exacto
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Saldo disponible del cliente ── */}
              {!editingId && selectedReserva && (
                <>
                  {loadingSaldos && (
                    <div style={{ fontSize: 12, color: '#94a3b8', padding: '6px 0' }}>Verificando saldo del cliente…</div>
                  )}
                  {!loadingSaldos && saldosCliente.length > 0 && (
                    <div style={{ background: usarSaldo ? '#f0fdf4' : '#fafafa', border: `1px solid ${usarSaldo ? '#bbf7d0' : '#e2e8f0'}`, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: usarSaldo ? 10 : 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                          <input type="checkbox" checked={usarSaldo}
                            onChange={e => { setUsarSaldo(e.target.checked); if (!e.target.checked) setMontoSaldoManual(''); }}
                            style={{ width: 15, height: 15, accentColor: '#16a34a', cursor: 'pointer' }} />
                          💰 Aplicar saldo del cliente
                        </label>
                        <span style={{ fontSize: 11, background: '#dcfce7', color: '#16a34a', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>
                          {saldosCliente.length} crédito{saldosCliente.length > 1 ? 's' : ''} · Total: HNL {totalSaldosDisponibles.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {usarSaldo && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Resumen de créditos disponibles */}
                          <div style={{ background: '#fff', border: '1px solid #bbf7d0', borderRadius: 8, overflow: 'hidden' }}>
                            {saldosCliente.map((s, i) => (
                              <div key={s.id_saldo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: i < saldosCliente.length - 1 ? '1px solid #f0fdf4' : 'none' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.descripcion}</div>
                                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(s.created_at).toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', flexShrink: 0, marginLeft: 8 }}>HNL {s.monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f0fdf4', fontWeight: 700, fontSize: 12 }}>
                              <span style={{ color: '#15803d' }}>Total disponible</span>
                              <span style={{ color: '#15803d' }}>HNL {totalSaldosDisponibles.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          {/* Breakdown saldo + diferencia */}
                          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Input monto a aplicar del saldo */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <label style={{ fontSize: 12, color: '#64748b', flexShrink: 0 }}>Aplicar del saldo:</label>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#94a3b8' }}>HNL</span>
                                <input type="number" min="0.01" step="0.01" max={Math.min(totalSaldosDisponibles, saldoPendiente ?? 0)}
                                  value={montoSaldoManual}
                                  onChange={e => setMontoSaldoManual(e.target.value)}
                                  style={{ width: '100%', border: '1px solid #bbf7d0', borderRadius: 6, padding: '5px 8px 5px 36px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                              </div>
                              <button onClick={() => setMontoSaldoManual(Math.min(totalSaldosDisponibles, saldoPendiente ?? 0).toFixed(2))}
                                style={{ fontSize: 11, color: '#16a34a', background: '#dcfce7', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', flexShrink: 0, fontWeight: 600 }}>
                                Máx.
                              </button>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8' }}>
                              <span>Disponible en cuenta: HNL {totalSaldosDisponibles.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                              <span>Pendiente reserva: HNL {(saldoPendiente ?? 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#16a34a', fontWeight: 600, paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>
                              <span>✓ Se aplica del saldo</span><span>− HNL {montoSaldoAplicar.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: diferenciaPagar < 0.01 ? '#16a34a' : '#dc2626' }}>
                              <span>{diferenciaPagar < 0.01 ? '✓ Cubierto completamente' : 'Diferencia a cobrar'}</span>
                              <span>{diferenciaPagar < 0.01 ? '¡Listo!' : `HNL ${diferenciaPagar.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Monto — solo visible en modo simple (sin splits y sin saldo que cubra todo) */}
              {!usarSplits && (!usarSaldo || diferenciaPagar > 0.01) && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  {usarSaldo && montoSaldoAplicar > 0.01 ? 'Diferencia a cobrar *' : 'Monto *'}
                </label>
                <input type="number" min="0" step="0.01"
                  value={usarSaldo && montoSaldoAplicar > 0.01 ? diferenciaPagar.toFixed(2) : form.monto}
                  onChange={e => { if (!usarSaldo || !(montoSaldoAplicar > 0.01)) setForm(f => ({ ...f, monto: e.target.value })); }}
                  readOnly={!!(usarSaldo && montoSaldoAplicar > 0.01)}
                  style={{ width: '100%', border: `1px solid ${montoExcedeSaldo && !usarSaldo ? '#f97316' : '#e2e8f0'}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: usarSaldo && montoSaldoAplicar > 0.01 ? '#f8fafc' : '#fff' }} />
                {montoExcedeSaldo && !usarSaldo && (
                  <div style={{ fontSize: 11, color: '#f97316', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} /> Monto supera el saldo pendiente ({fmtMoney(saldoPendiente!, selectedReserva?.moneda)})
                  </div>
                )}
              </div>
              )}

              {/* Método y fecha */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Fecha de pago</label>
                  <DatePicker value={form.fecha_pago} onChange={v => setForm(f => ({ ...f, fecha_pago: v }))} placeholder="Seleccionar fecha" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Moneda</label>
                  <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                    disabled={!hasMultimoneda}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 8px', fontSize: 13, ...(hasMultimoneda ? {} : { background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed' }) }}>
                    <option value="HNL">HNL</option>
                    {hasMultimoneda && <option value="USD">USD</option>}
                  </select>
                </div>
              </div>

              {/* Toggle múltiples métodos de pago — solo en nuevo pago y si hay diferencia que cobrar */}
              {!editingId && diferenciaPagar > 0.01 && (
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: usarSplits ? 10 : 0 }}>
                    <input type="checkbox" checked={usarSplits}
                      onChange={e => {
                        setUsarSplits(e.target.checked);
                        if (e.target.checked) {
                          setSplits([
                            { id: '1', metodo: 'efectivo', monto: (diferenciaPagar / 2).toFixed(2), referencia: '' },
                            { id: '2', metodo: 'tarjeta', monto: (diferenciaPagar / 2).toFixed(2), referencia: '' },
                          ]);
                        } else {
                          setSplits([{ id: '1', metodo: 'efectivo', monto: '', referencia: '' }]);
                        }
                      }}
                      style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }} />
                    🔀 Dividir entre varios métodos de pago
                  </label>
                  {usarSplits && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {splits.map((sp, idx) => {
                        const spRequiereRef = METODOS.find(m => m.value === sp.metodo)?.requireRef;
                        return (
                          <div key={sp.id} style={{ display: 'grid', gridTemplateColumns: '120px 90px 1fr auto', gap: 6, alignItems: 'center' }}>
                            <select value={sp.metodo}
                              onChange={e => setSplits(prev => prev.map((s, i) => i === idx ? { ...s, metodo: e.target.value as MetodoPago } : s))}
                              style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 7px', fontSize: 12 }}>
                              {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <input type="number" min="0.01" step="0.01" placeholder="Monto"
                              value={sp.monto}
                              onChange={e => setSplits(prev => prev.map((s, i) => i === idx ? { ...s, monto: e.target.value } : s))}
                              style={{ border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                            <input placeholder={spRequiereRef ? 'Referencia *' : 'Referencia (opcional)'}
                              value={sp.referencia}
                              onChange={e => setSplits(prev => prev.map((s, i) => i === idx ? { ...s, referencia: e.target.value } : s))}
                              style={{ border: `1px solid ${spRequiereRef && !sp.referencia ? '#f97316' : '#e2e8f0'}`, borderRadius: 7, padding: '6px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                            {splits.length > 1 && (
                              <button onClick={() => setSplits(prev => prev.filter((_, i) => i !== idx))}
                                style={{ padding: '5px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✕</button>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <button
                          onClick={() => setSplits(prev => [...prev, { id: String(Date.now()), metodo: 'efectivo', monto: '', referencia: '' }])}
                          style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: '1px dashed #93c5fd', borderRadius: 7, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}>
                          + Agregar método
                        </button>
                        <span style={{ fontSize: 12, fontWeight: 700, color: splitsCompletos ? '#16a34a' : '#dc2626' }}>
                          Total: HNL {totalSplits.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                          {' / '}
                          <span style={{ color: '#64748b', fontWeight: 400 }}>a cobrar: HNL {diferenciaPagar.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</span>
                          {!splitsCompletos && <span style={{ color: '#dc2626' }}> ⚠ Ajustar</span>}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Método y referencia — modo normal (no splits) */}
              {(!usarSplits && (!usarSaldo || diferenciaPagar > 0.01)) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Método de pago *</label>
                  <select value={form.metodo_pago} onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPago }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 8px', fontSize: 13 }}>
                    {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: metodoRequiereRef ? '#1e293b' : '#64748b', display: 'block', marginBottom: 4 }}>
                    Referencia / Voucher
                    {metodoRequiereRef && <span style={{ color: '#ef4444' }}> *</span>}
                    {metodoRequiereRef && (
                      <span style={{ color: '#94a3b8', fontSize: 11, fontWeight: 400, marginLeft: 4 }}>
                        (requerido para {METODOS.find(m => m.value === form.metodo_pago)?.label})
                      </span>
                    )}
                  </label>
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    placeholder="Nº de transacción, voucher, comprobante…"
                    style={{ width: '100%', border: `1px solid ${metodoRequiereRef && !form.referencia ? '#f97316' : '#e2e8f0'}`, borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              )}

              {/* Número de Factura */}
              {pagoRequiereFactura && (
                <div style={{ background: '#fffbeb', border: `1px solid ${!sinFactura && !numeroFactura.trim() ? '#f97316' : '#fde68a'}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: sinFactura ? '#94a3b8' : '#92400e', display: 'block', marginBottom: 4 }}>
                      🧾 N° Factura
                      {!sinFactura && <span style={{ color: '#ef4444' }}> *</span>}
                    </label>
                    <input
                      value={numeroFactura}
                      onChange={e => setNumeroFactura(e.target.value)}
                      disabled={sinFactura}
                      placeholder="Ej: F-2024-001"
                      style={{
                        width: '100%', border: `1px solid ${!sinFactura && !numeroFactura.trim() ? '#f97316' : '#e2e8f0'}`,
                        borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                        background: sinFactura ? '#f8fafc' : '#fff', color: sinFactura ? '#94a3b8' : '#1e293b',
                      }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={sinFactura}
                      onChange={e => { setSinFactura(e.target.checked); if (e.target.checked) setNumeroFactura(''); }}
                      style={{ width: 14, height: 14, accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: '#78350f', fontWeight: 500 }}>Sin factura (exonerado / no aplica)</span>
                  </label>
                </div>
              )}

              {/* Estado (solo en edición) */}
              {editingId && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Estado</label>
                  <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as PagoForm['estado'] }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 8px', fontSize: 13 }}>
                    <option value="registrado">Registrado</option>
                    <option value="aplicado">Aplicado</option>
                    <option value="anulado">Anulado</option>
                  </select>
                </div>
              )}

              {/* Notas */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Notas</label>
                <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  rows={2} placeholder="Notas internas opcionales…"
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={closeModal} className="btn-premium btn-premium-secondary">
                Cancelar
              </button>
              <button onClick={() => void handleSave()} disabled={saving} className="btn-premium btn-premium-primary" style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Pago Empresarial ── */}
      {empresaModalOpen && empresaModalData && (
        <div className="modal-backdrop-premium" onClick={() => setEmpresaModalOpen(false)}>
          <div className="modal-content-premium" style={{ width: '100%', maxWidth: 580 }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--shell-border-subtle)' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--accent)' }}>🏢 Registrar cobro empresarial</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>{empresaModalData!.empresa.nombre}</p>
              </div>
              <button onClick={() => setEmpresaModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 8, display: 'flex' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Selección de reservas a cobrar */}
              <div>
                {/* Toggle modo factura */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Reservas a incluir en este pago</div>
                  <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
                    <button onClick={() => setModoFactura('unica')}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: modoFactura === 'unica' ? '#fff' : 'transparent', color: modoFactura === 'unica' ? '#1d4ed8' : '#94a3b8', boxShadow: modoFactura === 'unica' ? '0 1px 4px #0001' : 'none' }}>
                      Factura única
                    </button>
                    <button onClick={() => setModoFactura('individual')}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, background: modoFactura === 'individual' ? '#fff' : 'transparent', color: modoFactura === 'individual' ? '#1d4ed8' : '#94a3b8', boxShadow: modoFactura === 'individual' ? '0 1px 4px #0001' : 'none' }}>
                      Por habitación
                    </button>
                  </div>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  {empresaModalData!.reservas.map((r, i) => {
                    const checked = empresaReservasSeleccionadas.has(r.id_reserva_hotel);
                    return (
                      <div key={r.id_reserva_hotel} style={{ background: checked ? '#eff6ff' : i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: i < empresaModalData!.reservas.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: modoFactura === 'individual' ? '8px 12px 4px' : '9px 12px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={checked}
                            onChange={e => {
                              const next = new Set(empresaReservasSeleccionadas);
                              if (e.target.checked) next.add(r.id_reserva_hotel); else next.delete(r.id_reserva_hotel);
                              setEmpresaReservasSeleccionadas(next);
                              const total = empresaModalData!.reservas.filter(rv => next.has(rv.id_reserva_hotel)).reduce((s, rv) => s + rv.saldo, 0);
                              setForm(f => ({ ...f, monto: total.toFixed(2) }));
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.huesped ?? '—'} <span style={{ fontWeight: 400, color: '#64748b', fontSize: 12 }}>· {r.habitacion}</span></div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(r.check_in)} → {fmtDate(r.check_out)}</div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: checked ? '#f97316' : '#cbd5e1' }}>{fmtMoney(r.saldo, r.moneda)}</span>
                        </label>
                        {modoFactura === 'individual' && checked && (
                          <div style={{ padding: '0 12px 8px 36px' }}>
                            <input
                              value={facturasInd[r.id_reserva_hotel] ?? ''}
                              onChange={e => setFacturasInd(f => ({ ...f, [r.id_reserva_hotel]: e.target.value }))}
                              placeholder="N° Factura para esta habitación (opcional)"
                              style={{ width: '100%', border: '1px solid #dbeafe', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Factura única */}
                {modoFactura === 'unica' && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>N° Factura:</label>
                    <input
                      value={facturaUnica}
                      onChange={e => setFacturaUnica(e.target.value)}
                      placeholder="Ej. F-0001, 00345… (opcional)"
                      style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 10px', fontSize: 13, color: '#1e293b' }}
                    />
                  </div>
                )}
                <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', marginTop: 6 }}>
                  Total seleccionado: <strong style={{ color: '#1d4ed8', fontSize: 13 }}>
                    HNL {empresaModalData!.reservas.filter(r => empresaReservasSeleccionadas.has(r.id_reserva_hotel)).reduce((s, r) => s + r.saldo, 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Monto, método, referencia */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Monto recibido (HNL) *</label>
                  <input type="number" min="0.01" step="0.01" value={form.monto}
                    onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 14, boxSizing: 'border-box', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Moneda</label>
                  <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                    disabled={!hasMultimoneda}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: hasMultimoneda ? '#fff' : '#f1f5f9', color: hasMultimoneda ? undefined : '#94a3b8', cursor: hasMultimoneda ? undefined : 'not-allowed' }}>
                    <option value="HNL">HNL</option>
                    {hasMultimoneda && <option value="USD">USD</option>}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Método de pago *</label>
                  <select value={form.metodo_pago} onChange={e => setForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPago }))}
                    style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, background: '#fff' }}>
                    {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Fecha</label>
                  <DatePicker value={form.fecha_pago} onChange={v => setForm(f => ({ ...f, fecha_pago: v }))} placeholder="Seleccionar fecha" />
                </div>
              </div>
              {METODOS.find(m => m.value === form.metodo_pago)?.requireRef && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', display: 'block', marginBottom: 4 }}>Número de referencia *</label>
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    placeholder="N° transacción / cheque / recibo…"
                    style={{ width: '100%', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Notas adicionales</label>
                <input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Observaciones internas, referencia adicional…"
                  style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEmpresaModalOpen(false)} className="btn-premium btn-premium-secondary">
                Cancelar
              </button>
              <button onClick={() => void handleSaveEmpresaPago()} disabled={saving} className="btn-premium btn-premium-primary" style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Registrando…' : 'Registrar cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
