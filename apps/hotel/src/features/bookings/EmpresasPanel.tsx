import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Plus, Pencil, Trash2, X, Loader2, Users, CreditCard,
  AlertTriangle, CheckCircle2, Search, ChevronDown, UserPlus, Clock,
  Bell, BadgeCheck, Ban,
} from 'lucide-react';
import apiClient from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Empresa {
  id_empresa: string;
  nombre: string;
  rtn?: string;
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_correo?: string;
  direccion?: string;
  limite_credito?: number;
  dias_credito?: number;
  estado?: string;
  notas?: string;
}

interface Colaborador {
  id: string;
  id_empresa: string;
  id_huesped: string;
  cargo?: string;
  activo: boolean;
  huespedes?: { id_huesped: string; nombre_completo: string; correo?: string; telefono?: string; documento_identidad?: string };
}

interface Credito {
  id: string;
  id_empresa: string;
  id_reserva?: string;
  monto: number;
  saldo_restante: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'activo' | 'pagado' | 'vencido' | 'anulado';
  notas?: string;
}

interface Huesped {
  id_huesped: string;
  nombre_completo: string;
  correo?: string;
  telefono?: string;
}

type Vista = 'empresas' | 'creditos' | 'alertas';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function diasHastaVencer(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const v = new Date(fecha + 'T00:00:00'); v.setHours(0, 0, 0, 0);
  return Math.round((v.getTime() - hoy.getTime()) / 86400000);
}

function fmtFecha(f: string) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-HN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMonto(n: number) {
  return 'L ' + n.toLocaleString('es-HN', { minimumFractionDigits: 2 });
}

const emptyEmpresa = (): Partial<Empresa> => ({
  nombre: '', rtn: '', contacto_nombre: '', contacto_telefono: '',
  contacto_correo: '', direccion: '', limite_credito: 0, dias_credito: 30,
  estado: 'activo', notas: '',
});

// ─── Style tokens ─────────────────────────────────────────────────────────────

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 };
const inp = 'mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all';

// ─── Componente principal ─────────────────────────────────────────────────────

export const EmpresasPanel: React.FC = () => {
  const [vista, setVista] = useState<Vista>('empresas');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Modal empresa
  const [modalEmpresa, setModalEmpresa] = useState(false);
  const [editandoEmpresa, setEditandoEmpresa] = useState<Empresa | null>(null);
  const [formEmp, setFormEmp] = useState<Partial<Empresa>>(emptyEmpresa());
  const [savingEmp, setSavingEmp] = useState(false);

  // Detalle empresa seleccionada
  const [empresaDetalle, setEmpresaDetalle] = useState<Empresa | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Agregar colaborador
  const [modalColaborador, setModalColaborador] = useState(false);
  const [huespedes, setHuespedes] = useState<Huesped[]>([]);
  const [busqHuesped, setBusqHuesped] = useState('');
  const [cargoNuevo, setCargoNuevo] = useState('');
  const [savingColab, setSavingColab] = useState(false);

  // Alertas
  const [alertas, setAlertas] = useState<(Credito & { empresas?: { nombre: string; contacto_nombre?: string; contacto_telefono?: string } })[]>([]);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Carga inicial ──
  const loadEmpresas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/bookings/empresas?estado=todos') as any;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setEmpresas(list);
    } catch { setEmpresas([]); }
    finally { setLoading(false); }
  }, []);

  const loadAlertas = useCallback(async () => {
    try {
      const data = await apiClient.get('/bookings/empresas/creditos/alertas') as any;
      setAlertas(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    } catch { setAlertas([]); }
  }, []);

  useEffect(() => { void loadEmpresas(); void loadAlertas(); }, [loadEmpresas, loadAlertas]);

  // ── Detalle empresa ──
  const toArr = (r: any): any[] => Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];

  async function abrirDetalle(emp: Empresa) {
    setEmpresaDetalle(emp);
    setLoadingDetalle(true);
    try {
      const [colabs, creds] = await Promise.all([
        apiClient.get(`/bookings/empresas/${emp.id_empresa}/colaboradores`) as Promise<any>,
        apiClient.get(`/bookings/empresas/${emp.id_empresa}/creditos`) as Promise<any>,
      ]);
      setColaboradores(toArr(colabs));
      setCreditos(toArr(creds));
    } catch { setColaboradores([]); setCreditos([]); }
    finally { setLoadingDetalle(false); }
  }

  // ── CRUD empresa ──
  function abrirModalEmpresa(emp?: Empresa) {
    setEditandoEmpresa(emp ?? null);
    setFormEmp(emp ? { ...emp } : emptyEmpresa());
    setModalEmpresa(true);
  }

  async function guardarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (!formEmp.nombre?.trim()) { showToast('El nombre es obligatorio.', 'err'); return; }
    setSavingEmp(true);
    try {
      if (editandoEmpresa) {
        await apiClient.put(`/bookings/empresas/${editandoEmpresa.id_empresa}`, formEmp);
        showToast('Empresa actualizada.');
      } else {
        await apiClient.post('/bookings/empresas', formEmp);
        showToast('Empresa creada.');
      }
      setModalEmpresa(false);
      await loadEmpresas();
      if (empresaDetalle && editandoEmpresa?.id_empresa === empresaDetalle.id_empresa) {
        setEmpresaDetalle(prev => prev ? { ...prev, ...formEmp } : prev);
      }
    } catch (err: any) { showToast(err?.message ?? 'Error al guardar.', 'err'); }
    finally { setSavingEmp(false); }
  }

  async function eliminarEmpresa(emp: Empresa) {
    if (!window.confirm(`¿Desactivar la empresa "${emp.nombre}"?`)) return;
    try {
      await apiClient.delete(`/bookings/empresas/${emp.id_empresa}`);
      showToast('Empresa desactivada.');
      if (empresaDetalle?.id_empresa === emp.id_empresa) setEmpresaDetalle(null);
      await loadEmpresas();
    } catch (err: any) { showToast(err?.message ?? 'Error.', 'err'); }
  }

  // ── Colaboradores ──
  async function abrirModalColaborador() {
    setModalColaborador(true);
    setBusqHuesped('');
    setCargoNuevo('');
    try {
      const data = await apiClient.get('/bookings/huespedes') as any;
      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setHuespedes(list);
    } catch { setHuespedes([]); }
  }

  async function agregarColaborador(huesped: Huesped) {
    if (!empresaDetalle) return;
    setSavingColab(true);
    try {
      await apiClient.post(`/bookings/empresas/${empresaDetalle.id_empresa}/colaboradores`, {
        id_huesped: huesped.id_huesped, cargo: cargoNuevo || null,
      });
      showToast('Colaborador agregado.');
      setModalColaborador(false);
      await abrirDetalle(empresaDetalle);
    } catch (err: any) { showToast(err?.message ?? 'Error.', 'err'); }
    finally { setSavingColab(false); }
  }

  async function quitarColaborador(colab: Colaborador) {
    if (!empresaDetalle || !window.confirm('¿Quitar este colaborador?')) return;
    try {
      await apiClient.delete(`/bookings/empresas/${empresaDetalle.id_empresa}/colaboradores/${colab.id_huesped}`);
      showToast('Colaborador eliminado.');
      setColaboradores(prev => prev.filter(c => c.id !== colab.id));
    } catch (err: any) { showToast(err?.message ?? 'Error.', 'err'); }
  }

  // ── Filtros ──
  const empresasFiltradas = empresas.filter(e => {
    const q = busqueda.toLowerCase();
    return !q || e.nombre.toLowerCase().includes(q) || (e.rtn ?? '').toLowerCase().includes(q);
  });

  const huespedesFiltrados = huespedes.filter(h => {
    const q = busqHuesped.toLowerCase();
    return !q || h.nombre_completo.toLowerCase().includes(q) || (h.correo ?? '').toLowerCase().includes(q);
  });

  // ── Render ──
  return (
    <div className="min-h-screen bg-slate-50/60">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 right-5 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-medium"
            style={{ background: toast.type === 'ok' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
            {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <X size={15} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-8 pt-7 pb-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">Operativos</p>
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            Empresas
            {alertas.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200">
                <Bell size={11} /> {alertas.length} alerta{alertas.length !== 1 ? 's' : ''}
              </span>
            )}
          </h1>
          {vista === 'empresas' && (
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => abrirModalEmpresa()}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm">
              <Plus size={15} /> Nueva empresa
            </motion.button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {([
            { key: 'empresas', label: 'Empresas',  icon: <Building2 size={14} /> },
            { key: 'creditos', label: 'Créditos',  icon: <CreditCard size={14} /> },
            { key: 'alertas',  label: `Alertas${alertas.length ? ` (${alertas.length})` : ''}`, icon: <Bell size={14} /> },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setVista(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all border-b-2"
              style={{ borderColor: vista === tab.key ? '#0f172a' : 'transparent', color: vista === tab.key ? '#0f172a' : '#94a3b8' }}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Vista: Empresas ── */}
      {vista === 'empresas' && (
        <div className="flex h-[calc(100vh-160px)]">
          {/* Lista */}
          <div className="w-80 flex-shrink-0 border-r border-slate-100 bg-white overflow-y-auto">
            <div className="p-4 border-b border-slate-50">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar empresa..." className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
            </div>

            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
              </div>
            ) : empresasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center py-16 px-4 gap-2 text-center">
                <Building2 size={28} className="text-slate-200" />
                <p className="text-sm text-slate-400">{busqueda ? 'Sin resultados' : 'Sin empresas registradas'}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {empresasFiltradas.map(emp => (
                  <motion.button key={emp.id_empresa} whileTap={{ scale: 0.99 }}
                    onClick={() => abrirDetalle(emp)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                    style={{ background: empresaDetalle?.id_empresa === emp.id_empresa ? '#f1f5f9' : undefined }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{emp.nombre}</p>
                        {emp.rtn && <p className="text-[11px] text-slate-400 mt-0.5">RTN: {emp.rtn}</p>}
                        {emp.contacto_nombre && <p className="text-[11px] text-slate-400 truncate">{emp.contacto_nombre}</p>}
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${emp.estado === 'activo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {emp.estado === 'activo' ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          {/* Detalle */}
          <div className="flex-1 overflow-y-auto">
            {!empresaDetalle ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Building2 size={28} className="text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">Selecciona una empresa</p>
                <p className="text-slate-400 text-sm">Haz clic en una empresa para ver su detalle, créditos y colaboradores.</p>
              </div>
            ) : (
              <div className="p-6 max-w-3xl">
                {/* Encabezado detalle */}
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{empresaDetalle.nombre}</h2>
                    {empresaDetalle.rtn && <p className="text-sm text-slate-500 mt-0.5">RTN: {empresaDetalle.rtn}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => abrirModalEmpresa(empresaDetalle)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-all">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => eliminarEmpresa(empresaDetalle)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Info empresa */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { label: 'Contacto',   value: empresaDetalle.contacto_nombre },
                    { label: 'Teléfono',   value: empresaDetalle.contacto_telefono },
                    { label: 'Correo',     value: empresaDetalle.contacto_correo },
                    { label: 'Dirección',  value: empresaDetalle.direccion },
                    { label: 'Límite crédito', value: empresaDetalle.limite_credito ? fmtMonto(empresaDetalle.limite_credito) : undefined },
                    { label: 'Días crédito',   value: empresaDetalle.dias_credito ? `${empresaDetalle.dias_credito} días` : undefined },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-sm text-slate-700 font-medium">{f.value}</p>
                    </div>
                  ))}
                </div>

                {loadingDetalle ? (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                    <Loader2 size={15} className="animate-spin" /> Cargando...
                  </div>
                ) : (
                  <>
                    {/* Colaboradores */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Users size={14} /> Colaboradores ({colaboradores.length})</h3>
                        <button onClick={abrirModalColaborador}
                          className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors">
                          <UserPlus size={12} /> Agregar
                        </button>
                      </div>
                      {colaboradores.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">Sin colaboradores vinculados.</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {colaboradores.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                                {(c.huespedes?.nombre_completo ?? '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">{c.huespedes?.nombre_completo ?? c.id_huesped}</p>
                                <p className="text-[11px] text-slate-400">{c.cargo || c.huespedes?.correo || '—'}</p>
                              </div>
                              <button onClick={() => quitarColaborador(c)}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                                <X size={11} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Créditos */}
                    <div>
                      <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-3"><CreditCard size={14} /> Historial de créditos ({creditos.length})</h3>
                      {creditos.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">Sin créditos registrados.</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {creditos.map(c => {
                            const dias = diasHastaVencer(c.fecha_vencimiento);
                            const vencido = dias < 0;
                            const urgente = !vencido && dias <= 7;
                            return (
                              <div key={c.id} className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl border"
                                style={{ background: vencido ? '#fef2f2' : urgente ? '#fffbeb' : '#f8fafc', borderColor: vencido ? '#fecaca' : urgente ? '#fde68a' : '#e2e8f0' }}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-bold text-slate-800">{fmtMonto(c.monto)}</span>
                                    {c.saldo_restante < c.monto && (
                                      <span className="text-[10px] text-slate-500">· saldo: {fmtMonto(c.saldo_restante)}</span>
                                    )}
                                    <CreditBadge estado={c.estado} diasRestantes={dias} />
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Emitido {fmtFecha(c.fecha_emision)} · Vence {fmtFecha(c.fecha_vencimiento)}
                                    {!vencido && ` · ${dias} día${dias !== 1 ? 's' : ''}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vista: Créditos (todos) ── */}
      {vista === 'creditos' && (
        <CreditosGlobales empresas={empresas} showToast={showToast} />
      )}

      {/* ── Vista: Alertas ── */}
      {vista === 'alertas' && (
        <div className="px-8 py-6 max-w-3xl">
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <p className="text-slate-600 font-medium">Sin alertas activas</p>
              <p className="text-slate-400 text-sm">Todos los créditos están al día o tienen más de 7 días de vigencia.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500 mb-1">{alertas.length} crédito{alertas.length !== 1 ? 's' : ''} requieren atención:</p>
              {alertas.map(a => {
                const dias = diasHastaVencer(a.fecha_vencimiento);
                const vencido = dias < 0;
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-4 px-5 py-4 rounded-2xl border"
                    style={{ background: vencido ? '#fef2f2' : '#fffbeb', borderColor: vencido ? '#fca5a5' : '#fde68a' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: vencido ? '#fee2e2' : '#fef3c7' }}>
                      {vencido ? <AlertTriangle size={18} className="text-red-500" /> : <Clock size={18} className="text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{a.empresas?.nombre ?? 'Empresa'}</p>
                      <p className="text-sm text-slate-600 mt-0.5">
                        Crédito de {fmtMonto(a.saldo_restante)} · {vencido ? `Venció hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}` : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Vencimiento: {fmtFecha(a.fecha_vencimiento)}</p>
                      {a.empresas?.contacto_telefono && (
                        <p className="text-[11px] text-slate-500 mt-0.5">Contacto: {a.empresas.contacto_nombre} · {a.empresas.contacto_telefono}</p>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${vencido ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                      {vencido ? 'Vencido' : 'Por vencer'}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Modal empresa ── */}
      <AnimatePresence>
        {modalEmpresa && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setModalEmpresa(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center">
                    <Building2 size={15} className="text-white" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{editandoEmpresa ? 'Editar empresa' : 'Nueva empresa'}</h3>
                </div>
                <button onClick={() => setModalEmpresa(false)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={15} /></button>
              </div>

              <form onSubmit={guardarEmpresa} className="overflow-y-auto px-6 py-5 flex flex-col gap-5">
                {/* Sección: Datos generales */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ ...lbl, marginBottom: 0 }}>Datos generales</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="col-span-2">
                      <span style={lbl}>Nombre *</span>
                      <input required className={inp} placeholder="Nombre de la empresa" value={formEmp.nombre ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, nombre: e.target.value }))} />
                    </label>
                    <label>
                      <span style={lbl}>RTN</span>
                      <input className={inp} placeholder="Ej. 0501-1990-00001" value={formEmp.rtn ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, rtn: e.target.value }))} />
                    </label>
                    <label>
                      <span style={lbl}>Estado</span>
                      <select className={inp} value={formEmp.estado ?? 'activo'}
                        onChange={e => setFormEmp(f => ({ ...f, estado: e.target.value }))}>
                        <option value="activo">Activa</option>
                        <option value="inactivo">Inactiva</option>
                      </select>
                    </label>
                    <label className="col-span-2">
                      <span style={lbl}>Dirección</span>
                      <input className={inp} placeholder="Dirección fiscal" value={formEmp.direccion ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, direccion: e.target.value }))} />
                    </label>
                  </div>
                </div>

                {/* Sección: Contacto */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ ...lbl, marginBottom: 0 }}>Contacto</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label>
                      <span style={lbl}>Nombre de contacto</span>
                      <input className={inp} placeholder="Nombre del responsable" value={formEmp.contacto_nombre ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, contacto_nombre: e.target.value }))} />
                    </label>
                    <label>
                      <span style={lbl}>Teléfono</span>
                      <input className={inp} placeholder="+504 0000-0000" value={formEmp.contacto_telefono ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, contacto_telefono: e.target.value }))} />
                    </label>
                    <label className="col-span-2">
                      <span style={lbl}>Correo</span>
                      <input type="email" className={inp} placeholder="correo@empresa.com" value={formEmp.contacto_correo ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, contacto_correo: e.target.value }))} />
                    </label>
                  </div>
                </div>

                {/* Sección: Crédito */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span style={{ ...lbl, marginBottom: 0 }}>Configuración de crédito</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label>
                      <span style={lbl}>Límite de crédito (L)</span>
                      <input type="number" min={0} step={0.01} className={inp} placeholder="0.00" value={formEmp.limite_credito ?? ''}
                        onChange={e => setFormEmp(f => ({ ...f, limite_credito: parseFloat(e.target.value) || 0 }))} />
                    </label>
                    <label>
                      <span style={lbl}>Días de crédito</span>
                      <input type="number" min={1} max={365} className={inp} placeholder="30" value={formEmp.dias_credito ?? 30}
                        onChange={e => setFormEmp(f => ({ ...f, dias_credito: parseInt(e.target.value) || 30 }))} />
                    </label>
                  </div>
                </div>

                {/* Notas */}
                <label>
                  <span style={lbl}>Notas internas</span>
                  <textarea className={`${inp} resize-none`} rows={2} placeholder="Observaciones internas..." value={formEmp.notas ?? ''}
                    onChange={e => setFormEmp(f => ({ ...f, notas: e.target.value }))} />
                </label>

                <div className="flex justify-end gap-2.5 pt-1">
                  <button type="button" onClick={() => setModalEmpresa(false)}
                    className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">Cancelar</button>
                  <button type="submit" disabled={savingEmp}
                    className="px-5 py-2 text-sm font-semibold text-white rounded-xl flex items-center gap-2 transition-colors"
                    style={{ background: savingEmp ? '#94a3b8' : '#1e293b' }}>
                    {savingEmp && <Loader2 size={13} className="animate-spin" />}
                    {editandoEmpresa ? 'Guardar cambios' : 'Crear empresa'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal colaborador ── */}
      <AnimatePresence>
        {modalColaborador && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setModalColaborador(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <UserPlus size={15} className="text-indigo-500" /> Agregar colaborador
                </h3>
                <button onClick={() => setModalColaborador(false)}
                  className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X size={13} /></button>
              </div>
              <div className="px-5 py-3 border-b border-slate-50">
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={busqHuesped} onChange={e => setBusqHuesped(e.target.value)}
                    placeholder="Buscar huésped por nombre o correo..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
                </div>
                <label>
                  <span style={lbl}>Cargo / puesto</span>
                  <input className={inp} placeholder="Ej. Gerente, Coordinador..." value={cargoNuevo}
                    onChange={e => setCargoNuevo(e.target.value)} />
                </label>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-slate-50 px-1">
                {huespedesFiltrados.slice(0, 40).map(h => {
                  const yaColaborador = colaboradores.some(c => c.id_huesped === h.id_huesped);
                  return (
                    <button key={h.id_huesped} disabled={yaColaborador || savingColab}
                      onClick={() => agregarColaborador(h)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                        {h.nombre_completo.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{h.nombre_completo}</p>
                        {h.correo && <p className="text-[11px] text-slate-400 truncate">{h.correo}</p>}
                      </div>
                      {yaColaborador && <BadgeCheck size={14} className="text-emerald-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Sub-componente: badge de estado de crédito ───────────────────────────────

function CreditBadge({ estado, diasRestantes }: { estado: Credito['estado']; diasRestantes: number }) {
  if (estado === 'pagado') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Pagado</span>;
  if (estado === 'anulado') return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">Anulado</span>;
  if (estado === 'vencido' || diasRestantes < 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Vencido</span>;
  if (diasRestantes <= 7) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Por vencer</span>;
  return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Activo</span>;
}

// ─── Sub-componente: créditos globales ────────────────────────────────────────

function CreditosGlobales({ empresas, showToast }: { empresas: Empresa[]; showToast: (m: string, t?: 'ok' | 'err') => void }) {
  const [creditos, setCreditos] = useState<(Credito & { empresas?: { nombre: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  useEffect(() => {
    setLoading(true);
    const toArr2 = (r: any): Credito[] => Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
    const calls = empresas.map(e =>
      (apiClient.get(`/bookings/empresas/${e.id_empresa}/creditos`) as Promise<any>)
        .then(creds => toArr2(creds).map((c: Credito) => ({ ...c, empresas: { nombre: e.nombre } })))
        .catch(() => [] as (Credito & { empresas?: { nombre: string } })[])
    );
    Promise.all(calls)
      .then(results => setCreditos(results.flat().sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))))
      .finally(() => setLoading(false));
  }, [empresas]);

  const filtrados = creditos.filter(c => {
    if (filtroEmpresa !== 'todos' && !c.empresas?.nombre.includes(filtroEmpresa)) return false;
    if (filtroEstado !== 'todos' && c.estado !== filtroEstado) return false;
    return true;
  });

  const totalSaldo = filtrados.filter(c => c.estado === 'activo').reduce((s, c) => s + c.saldo_restante, 0);

  return (
    <div className="px-8 py-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2.5 mb-5 items-center">
        <div className="relative">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none cursor-pointer">
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="pagado">Pagado</option>
            <option value="vencido">Vencido</option>
            <option value="anulado">Anulado</option>
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>
        <span className="text-xs text-slate-400 ml-auto font-medium">
          {filtrados.filter(c => c.estado === 'activo').length} activo{filtrados.filter(c => c.estado === 'activo').length !== 1 ? 's' : ''} · saldo total: <strong className="text-slate-700">{fmtMonto(totalSaldo)}</strong>
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <CreditCard size={28} className="text-slate-200" />
          <p className="text-slate-400 text-sm">Sin créditos registrados</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map(c => {
            const dias = diasHastaVencer(c.fecha_vencimiento);
            return (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-800">{fmtMonto(c.monto)}</span>
                    {c.saldo_restante < c.monto && <span className="text-xs text-slate-400">saldo: {fmtMonto(c.saldo_restante)}</span>}
                    <CreditBadge estado={c.estado} diasRestantes={dias} />
                    <span className="text-[11px] text-indigo-500 font-medium">{c.empresas?.nombre}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Emitido {fmtFecha(c.fecha_emision)} · Vence {fmtFecha(c.fecha_vencimiento)}
                    {c.estado === 'activo' && (dias < 0 ? ` · Vencido hace ${Math.abs(dias)} días` : ` · ${dias} días restantes`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
