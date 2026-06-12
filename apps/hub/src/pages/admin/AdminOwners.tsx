import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, CheckCircle2, Ban, Clock, ChevronRight, Loader2, RefreshCw,
  Building2, Package, ExternalLink, Copy, Check, Cpu, Zap, Pencil, X,
  PowerOff, Trash2, ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import apiClient from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hotel {
  id_hotel: string;
  nombre_hotel: string;
  ciudad: string;
  estado: string;
}

interface Module {
  id_module: string;
  tipo_modulo: string;
  is_active: boolean;
  hoteles?: Hotel[];
}

interface Owner {
  id_owner: string;
  nombre_empresa: string;
  email_contacto: string;
  telefono_contacto: string | null;
  estado: 'activo' | 'suspendido' | 'inactivo';
  is_solarys_admin: boolean;
  created_at: string;
  suscripciones_owner: Array<{ id_plan: string; estado: string; trial_end: string | null }>;
  business_modules: Module[];
}

interface Plan {
  id_plan: string;
  nombre: string;
  tipo_modulo: string;
  precio_mensual: number;
  precio_anual: number;
  activo: boolean;
}

interface Subscription {
  id_plan: string;
  estado: string;
  trial_end: string | null;
}

interface AIUsage {
  calls: number;
  total: number;
  input: number;
  output: number;
}

interface ImpersonateModal {
  url: string;
  empresa: string;
  email: string;
}

type ConfirmAction = 'deactivate' | 'delete';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ESTADO_CONFIG = {
  activo:     { label: 'Activo',     icon: CheckCircle2, cls: 'bg-green-100 text-green-700' },
  suspendido: { label: 'Suspendido', icon: Ban,          cls: 'bg-red-100 text-red-700' },
  inactivo:   { label: 'Inactivo',   icon: Clock,        cls: 'bg-slate-100 text-slate-600' },
};

const SUB_ALERTA: Record<string, { label: string; cls: string }> = {
  impaga:    { label: 'Impaga',    cls: 'bg-rose-100 text-rose-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-slate-200 text-slate-600' },
  inactiva:  { label: 'Inactiva',  cls: 'bg-amber-100 text-amber-700' },
};

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function subNeedsAttention(subs: Owner['suscripciones_owner']): boolean {
  if (!subs?.length) return true;
  const problematic = ['impaga', 'cancelada', 'inactiva'];
  return subs.every(s => problematic.includes(s.estado));
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AdminOwners() {
  const [owners, setOwners]         = useState<Owner[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [q, setQ]                   = useState('');
  const [estadoFil, setEstadoFil]   = useState('');
  const [offset, setOffset]         = useState(0);
  const [patching, setPatching]     = useState<string | null>(null);
  const [selected, setSelected]     = useState<Owner | null>(null);

  const [patchingModule, setPatchingModule]   = useState<string | null>(null);
  const [bulkingModules, setBulkingModules]   = useState<'suspend' | 'activate' | null>(null);
  const [impersonating, setImpersonating]     = useState(false);
  const [impersonateModal, setImpersonateModal] = useState<ImpersonateModal | null>(null);
  const [urlCopied, setUrlCopied]             = useState(false);

  const [aiUsage, setAIUsage]     = useState<AIUsage | null>(null);
  const [aiLoading, setAILoading] = useState(false);

  // Suscripción
  const [plans, setPlans]         = useState<Plan[]>([]);
  const [editSub, setEditSub]     = useState(false);
  const [subForm, setSubForm]     = useState<Subscription>({ id_plan: '', estado: 'activa', trial_end: null });
  const [patchingSub, setPatchingSub] = useState(false);

  // Acciones destructivas
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmText, setConfirmText]     = useState('');
  const [actioning, setActioning]         = useState(false);

  // Eliminación de hotel
  const [selectedHotelToDelete, setSelectedHotelToDelete] = useState<Hotel | null>(null);
  const [deleteHotelConfirmText, setDeleteHotelConfirmText] = useState('');
  const [deletingHotel, setDeletingHotel] = useState(false);

  const LIMIT = 20;

  useEffect(() => {
    apiClient.get('/hub/admin/plans').then((data: any) => setPlans(data)).catch(() => {});
  }, []);

  const load = async (newOffset = 0) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(newOffset),
        ...(q && { q }),
        ...(estadoFil && { estado: estadoFil }),
      });
      const data = await apiClient.get(`/hub/admin/owners?${params}`);
      setOwners(data.data);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(0); }, [q, estadoFil]);

  useEffect(() => {
    if (!selected) { setAIUsage(null); setEditSub(false); return; }
    setAILoading(true);
    apiClient.get(`/hub/admin/ai-usage?ownerId=${selected.id_owner}`)
      .then((res: any) => setAIUsage(res))
      .catch(() => setAIUsage(null))
      .finally(() => setAILoading(false));

    const currentSub = selected.suscripciones_owner?.[0];
    setSubForm({
      id_plan:   currentSub?.id_plan   ?? (plans[0]?.id_plan ?? ''),
      estado:    currentSub?.estado    ?? 'activa',
      trial_end: currentSub?.trial_end ?? null,
    });
    setEditSub(false);
    setConfirmAction(null);
    setConfirmText('');
  }, [selected?.id_owner]);

  // ── Cambiar estado del owner ──
  const cambiarEstado = async (id: string, estado: string) => {
    setPatching(id);
    try {
      const updated = await apiClient.patch(`/hub/admin/owners/${id}`, { estado });
      setOwners(prev => prev.map(o => o.id_owner === id ? { ...o, estado: updated.estado } : o));
      if (selected?.id_owner === id) setSelected(prev => prev ? { ...prev, estado: updated.estado } : prev);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPatching(null);
    }
  };

  // ── Toggle módulo individual ──
  const toggleModule = async (mod: Module) => {
    setPatchingModule(mod.id_module);
    try {
      const updated = await apiClient.patch(`/hub/admin/modules/${mod.id_module}`, { is_active: !mod.is_active });
      const patch = (modules: Module[]) =>
        modules.map(m => m.id_module === mod.id_module ? { ...m, is_active: updated.is_active } : m);
      setSelected(prev => prev ? { ...prev, business_modules: patch(prev.business_modules) } : prev);
      setOwners(prev => prev.map(o =>
        o.id_owner === selected?.id_owner ? { ...o, business_modules: patch(o.business_modules) } : o
      ));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPatchingModule(null);
    }
  };

  // ── Suspender / Activar todos los módulos ──
  const bulkModules = async (action: 'suspend' | 'activate') => {
    if (!selected) return;
    setBulkingModules(action);
    try {
      const res = await apiClient.post(`/hub/admin/owners/${selected.id_owner}/bulk-modules`, { action });
      const newModules: Module[] = res.modules;
      setSelected(prev => prev ? { ...prev, business_modules: newModules } : prev);
      setOwners(prev => prev.map(o =>
        o.id_owner === selected.id_owner ? { ...o, business_modules: newModules } : o
      ));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBulkingModules(null);
    }
  };

  // ── Actualizar suscripción ──
  const updateSubscription = async () => {
    if (!selected || !subForm.id_plan) return;
    setPatchingSub(true);
    try {
      const payload: any = { id_plan: subForm.id_plan, estado: subForm.estado };
      if (subForm.trial_end) payload.trial_end = subForm.trial_end;
      const updated = await apiClient.patch(`/hub/admin/owners/${selected.id_owner}/subscription`, payload);
      const patchSub = (subs: Owner['suscripciones_owner']) =>
        subs.length > 0 ? subs.map((s, i) => i === 0 ? { ...s, ...updated } : s) : [updated];
      setSelected(prev => prev ? { ...prev, suscripciones_owner: patchSub(prev.suscripciones_owner) } : prev);
      setOwners(prev => prev.map(o =>
        o.id_owner === selected.id_owner ? { ...o, suscripciones_owner: patchSub(o.suscripciones_owner) } : o
      ));
      setEditSub(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPatchingSub(false);
    }
  };

  // ── Acciones destructivas (deactivate / delete) ──
  const executeAction = async () => {
    if (!selected || !confirmAction) return;
    if (confirmText.trim().toLowerCase() !== selected.nombre_empresa.toLowerCase()) return;
    setActioning(true);
    try {
      if (confirmAction === 'deactivate') {
        const res = await apiClient.post(`/hub/admin/owners/${selected.id_owner}/deactivate`, {});
        const inactiveModules = selected.business_modules.map(m => ({ ...m, is_active: false }));
        const updated = { ...selected, estado: res.owner.estado as Owner['estado'], business_modules: inactiveModules, suscripciones_owner: selected.suscripciones_owner.map(s => ({ ...s, estado: 'cancelada' })) };
        setSelected(updated);
        setOwners(prev => prev.map(o => o.id_owner === selected.id_owner ? updated : o));
      } else {
        await apiClient.delete(`/hub/admin/owners/${selected.id_owner}`);
        setOwners(prev => prev.filter(o => o.id_owner !== selected.id_owner));
        setTotal(t => t - 1);
        setSelected(null);
      }
      setConfirmAction(null);
      setConfirmText('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActioning(false);
    }
  };

  // ── Seleccionar Propietario con detalles completos ──
  const selectOwner = async (owner: Owner) => {
    setSelected(owner);
    try {
      const fullOwner = await apiClient.get(`/hub/admin/owners/${owner.id_owner}`);
      setSelected(fullOwner);
    } catch (e: any) {
      console.error('[selectOwner] error fetching full details:', e.message);
    }
  };

  // ── Eliminar Hotel ──
  const executeDeleteHotel = async () => {
    if (!selectedHotelToDelete || !selected) return;
    if (deleteHotelConfirmText.trim().toLowerCase() !== selectedHotelToDelete.nombre_hotel.toLowerCase()) return;
    setDeletingHotel(true);
    try {
      await apiClient.delete(`/hub/admin/hoteles/${selectedHotelToDelete.id_hotel}`);
      
      // Volver a cargar el owner seleccionado para refrescar la lista de hoteles en el lateral
      const fullOwner = await apiClient.get(`/hub/admin/owners/${selected.id_owner}`);
      setSelected(fullOwner);
      
      // También refrescar la lista de owners principal (para contar módulos, etc.)
      load(offset);
      
      setSelectedHotelToDelete(null);
      setDeleteHotelConfirmText('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeletingHotel(false);
    }
  };

  // ── Impersonación ──
  const impersonate = async (ownerId: string) => {
    setImpersonating(true);
    try {
      const res = await apiClient.post(`/hub/admin/impersonate/${ownerId}`, {});
      setImpersonateModal({ url: res.url, empresa: res.empresa, email: res.email });
    } catch (e: any) {
      alert(`Error al generar acceso: ${e.message}`);
    } finally {
      setImpersonating(false);
    }
  };

  const copyUrl = async () => {
    if (!impersonateModal) return;
    await navigator.clipboard.writeText(impersonateModal.url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  // ── Derivados del selected ──
  const hasActiveModules   = selected?.business_modules?.some(m => m.is_active) ?? false;
  const hasInactiveModules = selected?.business_modules?.some(m => !m.is_active) ?? false;
  const subAlert           = selected ? subNeedsAttention(selected.suscripciones_owner) : false;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
            <p className="text-slate-500 text-sm mt-1">{total} propietarios registrados</p>
          </div>
          <button onClick={() => load(0)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar empresa..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <select
            value={estadoFil}
            onChange={e => setEstadoFil(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none"
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : owners.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">Sin resultados</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Empresa</th>
                  <th className="text-left px-5 py-3">Módulos</th>
                  <th className="text-left px-5 py-3">Plan / Suscripción</th>
                  <th className="text-left px-5 py-3">Estado</th>
                  <th className="text-left px-5 py-3">Registro</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {owners.map(owner => {
                  const cfg    = ESTADO_CONFIG[owner.estado] ?? ESTADO_CONFIG.inactivo;
                  const IconE  = cfg.icon;
                  const sub    = owner.suscripciones_owner?.[0];
                  const modCount = owner.business_modules?.length ?? 0;
                  const alertSub = subNeedsAttention(owner.suscripciones_owner);

                  return (
                    <tr key={owner.id_owner} className="border-b border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-semibold text-slate-800">{owner.nombre_empresa}</p>
                            <p className="text-xs text-slate-400">{owner.email_contacto}</p>
                          </div>
                          {alertSub && owner.estado === 'activo' && (
                            <span title="Suscripción requiere atención">
                              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Package size={13} />
                          <span>{modCount} módulo{modCount !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {sub ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-md w-fit">
                              {sub.id_plan}
                            </span>
                            {SUB_ALERTA[sub.estado] && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-md w-fit ${SUB_ALERTA[sub.estado].cls}`}>
                                {SUB_ALERTA[sub.estado].label}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sin suscripción</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
                          <IconE size={11} /> {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs">
                        {new Date(owner.created_at).toLocaleDateString('es-HN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => selectOwner(owner)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {total > LIMIT && (
          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <span>{offset + 1}–{Math.min(offset + LIMIT, total)} de {total}</span>
            <div className="flex gap-2">
              <button onClick={() => load(Math.max(0, offset - LIMIT))} disabled={offset === 0 || loading}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">← Anterior</button>
              <button onClick={() => load(offset + LIMIT)} disabled={offset + LIMIT >= total || loading}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {/* ══ Panel lateral ══════════════════════════════════════════════════════ */}
      {selected && !confirmAction && createPortal(
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-[440px] bg-white h-full overflow-y-auto shadow-2xl p-6 flex flex-col gap-5">

            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.nombre_empresa}</h2>
                <p className="text-slate-400 text-sm">{selected.email_contacto}</p>
                {selected.telefono_contacto && (
                  <p className="text-slate-400 text-xs mt-0.5">{selected.telefono_contacto}</p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 text-xl font-light leading-none">✕</button>
            </div>

            {/* Alerta suscripción */}
            {subAlert && (
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold mb-0.5">Suscripción sin cobertura activa</p>
                  <p className="text-amber-600">El owner no tiene ninguna suscripción activa o en trial. Considera suspender sus módulos o asignar un plan.</p>
                </div>
              </div>
            )}

            {/* ── Módulos ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Módulos</p>
                <div className="flex gap-1.5">
                  {hasInactiveModules && (
                    <button
                      disabled={!!bulkingModules}
                      onClick={() => bulkModules('activate')}
                      title="Activar todos"
                      className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {bulkingModules === 'activate'
                        ? <Loader2 size={10} className="animate-spin" />
                        : <ToggleRight size={12} />}
                      Activar todos
                    </button>
                  )}
                  {hasActiveModules && (
                    <button
                      disabled={!!bulkingModules}
                      onClick={() => bulkModules('suspend')}
                      title="Suspender todos"
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg transition disabled:opacity-50"
                    >
                      {bulkingModules === 'suspend'
                        ? <Loader2 size={10} className="animate-spin" />
                        : <ToggleLeft size={12} />}
                      Suspender todos
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                {selected.business_modules?.length ? selected.business_modules.map(m => (
                  <div key={m.id_module} className="bg-slate-50 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 size={13} className="text-slate-400" />
                        <span className="font-medium capitalize text-slate-700">{m.tipo_modulo}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>
                          {m.is_active ? 'Activo' : 'Suspendido'}
                        </span>
                      </div>
                      <button
                        disabled={patchingModule === m.id_module}
                        onClick={() => toggleModule(m)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
                          ${m.is_active ? 'bg-emerald-500' : 'bg-slate-300'}
                          disabled:opacity-50`}
                      >
                        {patchingModule === m.id_module
                          ? <span className="absolute inset-0 flex items-center justify-center"><Loader2 size={11} className="animate-spin text-white" /></span>
                          : <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${m.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                        }
                      </button>
                    </div>

                    {m.tipo_modulo === 'hotel' && m.hoteles && m.hoteles.length > 0 && (
                      <div className="pl-5 border-l border-slate-200 space-y-1.5 mt-1.5">
                        {m.hoteles.map(h => (
                          <div key={h.id_hotel} className="flex items-center justify-between text-xs text-slate-600 py-0.5">
                            <span className="font-semibold text-slate-700">{h.nombre_hotel} ({h.ciudad})</span>
                            <button
                              onClick={() => {
                                setSelectedHotelToDelete(h);
                                setDeleteHotelConfirmText('');
                              }}
                              className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded transition"
                              title="Eliminar hotel permanentemente"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )) : <p className="text-slate-400 text-sm">Sin módulos</p>}
              </div>
            </div>

            {/* ── Suscripción ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Suscripción</p>
                {!editSub && (
                  <button onClick={() => setEditSub(true)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition">
                    <Pencil size={11} /> Editar
                  </button>
                )}
              </div>

              {editSub ? (
                <div className="bg-indigo-50 rounded-xl p-3 space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Plan</label>
                    <select
                      value={subForm.id_plan}
                      onChange={e => setSubForm(f => ({ ...f, id_plan: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      {plans.length === 0 && <option value="">Cargando planes...</option>}
                      {plans.map(p => (
                        <option key={p.id_plan} value={p.id_plan}>
                          {p.nombre} — ${p.precio_mensual}/mes
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium block mb-1">Estado de la suscripción</label>
                    <select
                      value={subForm.estado}
                      onChange={e => setSubForm(f => ({ ...f, estado: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none"
                    >
                      <option value="activa">Activa</option>
                      <option value="trial">Trial</option>
                      <option value="impaga">Impaga</option>
                      <option value="inactiva">Inactiva</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                  {subForm.estado === 'trial' && (
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">Fin de trial</label>
                      <input
                        type="date"
                        value={subForm.trial_end ? subForm.trial_end.slice(0, 10) : ''}
                        onChange={e => setSubForm(f => ({ ...f, trial_end: e.target.value ? e.target.value + 'T00:00:00Z' : null }))}
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none"
                      />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={patchingSub || !subForm.id_plan}
                      onClick={updateSubscription}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                      {patchingSub ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditSub(false)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                selected.suscripciones_owner?.length ? selected.suscripciones_owner.map((s, i) => (
                  <div key={i} className={`rounded-xl px-3 py-2.5 text-sm ${SUB_ALERTA[s.estado] ? 'bg-amber-50' : 'bg-indigo-50'}`}>
                    <p className="font-semibold text-slate-800">{s.id_plan}</p>
                    <p className={`text-xs capitalize ${SUB_ALERTA[s.estado] ? 'text-amber-600' : 'text-indigo-500'}`}>
                      {s.estado}{s.trial_end ? ` · Trial hasta ${new Date(s.trial_end).toLocaleDateString('es-HN')}` : ''}
                    </p>
                  </div>
                )) : (
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-slate-400 text-sm">Sin suscripción</p>
                    <button onClick={() => setEditSub(true)} className="text-xs text-indigo-600 hover:text-indigo-800">+ Asignar</button>
                  </div>
                )
              )}
            </div>

            {/* ── Consumo IA ── */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Cpu size={13} className="text-violet-500" />
                <p className="text-xs font-semibold text-slate-500 uppercase">Consumo de IA</p>
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <Loader2 size={13} className="animate-spin" /> Cargando...
                </div>
              ) : aiUsage && aiUsage.calls > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-xs text-violet-500 font-medium">Total tokens</p>
                    <p className="text-lg font-bold text-violet-800">{fmtTokens(aiUsage.total)}</p>
                  </div>
                  <div className="bg-violet-50 rounded-xl p-3">
                    <p className="text-xs text-violet-500 font-medium">Llamadas IA</p>
                    <p className="text-lg font-bold text-violet-800">{aiUsage.calls}</p>
                  </div>
                  <div className="col-span-2 flex justify-between text-xs text-slate-400 px-1">
                    <span className="flex items-center gap-1"><Zap size={11} /> Entrada: {fmtTokens(aiUsage.input)}</span>
                    <span>Salida: {fmtTokens(aiUsage.output)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Sin uso de IA registrado</p>
              )}
            </div>

            {/* ── Estado del owner ── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Estado del propietario</p>
              <div className="flex gap-2">
                {(['activo', 'suspendido', 'inactivo'] as const).map(e => (
                  <button
                    key={e}
                    disabled={selected.estado === e || patching === selected.id_owner}
                    onClick={() => cambiarEstado(selected.id_owner, e)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border transition
                      ${selected.estado === e
                        ? 'bg-indigo-600 text-white border-indigo-600 cursor-default'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
                      } disabled:opacity-50`}
                  >
                    {patching === selected.id_owner && selected.estado !== e
                      ? <Loader2 size={12} className="animate-spin" />
                      : null}
                    <span className="capitalize">{e}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Acceder como soporte ── */}
            <div>
              <button
                disabled={impersonating}
                onClick={() => impersonate(selected.id_owner)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
              >
                {impersonating ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Acceder como soporte
              </button>
              <p className="text-xs text-slate-400 text-center mt-1.5">Genera un enlace único de acceso (1 hora)</p>
            </div>

            {/* ── Zona de peligro ── */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-rose-500 uppercase mb-3">Zona de peligro</p>
              <div className="space-y-2">
                <button
                  onClick={() => { setConfirmAction('deactivate'); setConfirmText(''); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-medium rounded-xl transition"
                >
                  <PowerOff size={14} />
                  Desactivar cuenta completa
                </button>
                <button
                  onClick={() => { setConfirmAction('delete'); setConfirmText(''); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 text-sm font-medium rounded-xl transition"
                >
                  <Trash2 size={14} />
                  Eliminar cuenta permanentemente
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ══ Modal de confirmación de acción destructiva ══════════════════════ */}
      {selected && confirmAction && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header del modal */}
            <div className={`p-5 rounded-t-2xl ${confirmAction === 'delete' ? 'bg-rose-50' : 'bg-amber-50'}`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl ${confirmAction === 'delete' ? 'bg-rose-100' : 'bg-amber-100'}`}>
                  {confirmAction === 'delete'
                    ? <Trash2 size={18} className="text-rose-600" />
                    : <PowerOff size={18} className="text-amber-600" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    {confirmAction === 'delete' ? 'Eliminar cuenta permanentemente' : 'Desactivar cuenta completa'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">{selected.nombre_empresa}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {confirmAction === 'delete' ? (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800 space-y-1">
                  <p className="font-semibold">Esta acción es irreversible:</p>
                  <ul className="list-disc list-inside text-rose-700 space-y-0.5 text-xs">
                    <li>El usuario perderá acceso inmediatamente</li>
                    <li>Se cancelarán todas las suscripciones</li>
                    <li>Se suspenderán todos los módulos</li>
                    <li>Los datos del negocio se conservan por auditoría</li>
                  </ul>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 space-y-1">
                  <p className="font-semibold">Esta acción realizará:</p>
                  <ul className="list-disc list-inside text-amber-700 space-y-0.5 text-xs">
                    <li>Suspender todos los módulos del owner</li>
                    <li>Cancelar todas las suscripciones activas</li>
                    <li>Marcar el owner como inactivo</li>
                    <li>El usuario no podrá acceder al sistema</li>
                  </ul>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Escribe <span className="font-bold text-slate-900">"{selected.nombre_empresa}"</span> para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder={selected.nombre_empresa}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setConfirmAction(null); setConfirmText(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  disabled={actioning || confirmText.trim().toLowerCase() !== selected.nombre_empresa.toLowerCase()}
                  onClick={executeAction}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white text-sm font-medium rounded-xl transition disabled:opacity-40
                    ${confirmAction === 'delete' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                >
                  {actioning
                    ? <Loader2 size={14} className="animate-spin" />
                    : confirmAction === 'delete' ? <Trash2 size={14} /> : <PowerOff size={14} />}
                  {confirmAction === 'delete' ? 'Eliminar cuenta' : 'Desactivar cuenta'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ══ Modal de impersonación ══════════════════════════════════════════ */}
      {impersonateModal && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Enlace de soporte generado</h3>
                <p className="text-sm text-slate-400 mt-0.5">{impersonateModal.empresa} · {impersonateModal.email}</p>
              </div>
              <button onClick={() => setImpersonateModal(null)} className="text-slate-400 hover:text-slate-700 text-xl font-light leading-none">✕</button>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <p className="text-xs text-slate-400 font-mono break-all leading-relaxed select-all">
                {impersonateModal.url}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyUrl}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                {urlCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {urlCopied ? 'Copiado' : 'Copiar enlace'}
              </button>
              <button
                onClick={() => { window.open(impersonateModal.url, '_blank'); setImpersonateModal(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 rounded-xl text-sm font-medium text-white hover:bg-slate-900 transition"
              >
                <ExternalLink size={14} />
                Abrir en nueva pestaña
              </button>
            </div>
            <p className="text-xs text-slate-400 text-center mt-3">
              Recomendado: abre en ventana de incógnito para no cerrar tu sesión actual
            </p>
          </div>
        </div>,
        document.body
      )}

      {/* ══ Modal de confirmación de eliminación de hotel ═══════════════════ */}
      {selectedHotelToDelete && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 rounded-t-2xl bg-rose-50">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-100">
                  <Trash2 size={18} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Eliminar hotel permanentemente</h3>
                  <p className="text-sm text-slate-500 mt-1">{selectedHotelToDelete.nombre_hotel}</p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800 space-y-1">
                <p className="font-semibold">Esta acción es irreversible y eliminará:</p>
                <ul className="list-disc list-inside text-rose-700 space-y-0.5 text-xs">
                  <li>Toda la configuración y datos del hotel</li>
                  <li>Todas las habitaciones, comodidades y servicios</li>
                  <li>Todas las cotizaciones, reservas y pagos registrados</li>
                  <li>Todos los huéspedes, empresas y colaboradores de este hotel</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Escribe <span className="font-bold text-slate-900">"{selectedHotelToDelete.nombre_hotel}"</span> para confirmar:
                </label>
                <input
                  type="text"
                  value={deleteHotelConfirmText}
                  onChange={e => setDeleteHotelConfirmText(e.target.value)}
                  placeholder={selectedHotelToDelete.nombre_hotel}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setSelectedHotelToDelete(null); setDeleteHotelConfirmText(''); }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  disabled={deletingHotel || deleteHotelConfirmText.trim().toLowerCase() !== selectedHotelToDelete.nombre_hotel.toLowerCase()}
                  onClick={executeDeleteHotel}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-40"
                >
                  {deletingHotel ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Eliminar hotel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </AdminLayout>
  );
}
