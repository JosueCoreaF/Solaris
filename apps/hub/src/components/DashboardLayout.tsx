import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import apiClient from '../services/api';
import SolarisLogo from './SolarisLogo';
import {
  LayoutDashboard,
  Building2,
  Dumbbell,
  Coffee,
  Settings,
  CreditCard,
  LogOut,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  Bell,
  Globe,
  ExternalLink,
} from 'lucide-react';

const PORTAL_BASE = import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:5177';

// URLs de cada módulo — en dev usa localhost, en prod usa las env vars de Vercel
const MODULE_URLS: Record<string, string> = {
  hotel:      import.meta.env.VITE_HOTEL_URL      || 'http://localhost:5173',
  gym:        import.meta.env.VITE_GYM_URL        || 'http://localhost:5175',
  restaurant: import.meta.env.VITE_RESTAURANT_URL || 'http://localhost:5176',
  store:      import.meta.env.VITE_STORE_URL      || 'http://localhost:5178',
};

interface DashboardContextType {
  modules: any[];
  kpis: any;
  ownerNombre: string;
  summary: any;
  notifications: any[];
  dataLoading: boolean;
  error: string | null;
  refetch: () => void;
}

const DashboardContext = createContext<DashboardContextType>({
  modules: [],
  kpis: { ingresos: 0, negocios_activos: 0, ocupacion: 0, tareas: 0 },
  ownerNombre: '',
  summary: null,
  notifications: [],
  dataLoading: false,
  error: null,
  refetch: () => {},
});

export const useDashboard = () => useContext(DashboardContext);

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();

  const [modules, setModules] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ ingresos: 0, negocios_activos: 0, ocupacion: 0, tareas: 0 });
  const [ownerNombre, setOwnerNombre] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false); // inicia en false; se activa solo cuando hay sesión
  const [error, setError] = useState<string | null>(null);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const fetchDashboard = async () => {
    try {
      setDataLoading(true);
      setError(null);
      const d = await apiClient.get('/hub/dashboard-summary');
      if (d?.needsOwnerSetup) {
        navigate('/setup-owner', { replace: true });
        return;
      }
      setModules(d?.modules || []);
      setKpis(d?.kpis || { ingresos: 0, negocios_activos: 0, ocupacion: 0, tareas: 0 });
      setOwnerNombre(d?.owner?.nombre || session?.user?.email?.split('@')[0] || '');
      setSummary(d || null);
      setFetchedOnce(true);

      // Notificaciones en background (no bloquean el render)
      apiClient.get('/hub/notifications')
        .then((notifs: any[]) => setNotifications(Array.isArray(notifs) ? notifs : []))
        .catch(() => {});
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.needsOwnerSetup) {
        navigate('/setup-owner', { replace: true });
        return;
      }
      setError(errData?.error || err.message || 'Error al conectar con el servidor.');
    } finally {
      setDataLoading(false);
    }
  };

  // Solo lanzar el fetch cuando la sesión esté disponible
  useEffect(() => {
    if (session && !fetchedOnce) {
      fetchDashboard();
    }
    // Si la sesión existe pero aún no hemos hecho fetch, esperamos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleEnterBusiness = (moduleType: string, referenceId: string, hotelId?: string | null) => {
    const normalized = moduleType?.toLowerCase?.() ?? 'hotel';
    const base = MODULE_URLS[normalized] || MODULE_URLS.hotel;
    const params = new URLSearchParams({ business_id: referenceId });
    if (hotelId) params.set('hotel_id', hotelId);
    if (session) {
      params.set('access_token', session.access_token);
      params.set('refresh_token', session.refresh_token);
    }
    window.open(`${base}/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const urgentNotifCount = notifications.filter(n => n.severity === 'high').length;

  return (
    <DashboardContext.Provider value={{ modules, kpis, ownerNombre, summary, notifications, dataLoading, error, refetch: fetchDashboard }}>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">

        {/* Sidebar */}
        <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col hidden md:flex shrink-0">
          <div className="pt-8 pb-4 flex items-center justify-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <SolarisLogo variant="main" size={56} animated />
            <h2 className="text-5xl font-bold tracking-tight solaris-text-gradient">
              Solaris
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
            {/* Principal */}
            <div>
              <p className="px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Principal</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => navigate('/dashboard')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-left text-sm font-medium ${
                    location.pathname === '/dashboard'
                      ? 'bg-indigo-500/15 text-indigo-400'
                      : 'hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <LayoutDashboard size={17} />
                  <span>Resumen General</span>
                </button>
              </nav>
            </div>

            {/* Mis Módulos */}
            <div>
              <p className="px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Mis Módulos</p>
              <nav className="space-y-0.5">
                {dataLoading ? (
                  <div className="px-4 py-2.5 flex gap-3 items-center animate-pulse">
                    <div className="w-4 h-4 bg-slate-800 rounded-full" />
                    <div className="h-3 bg-slate-800 rounded w-28" />
                  </div>
                ) : modules.length > 0 ? (
                  modules.map(mod => (
                    <div key={mod.id} className="flex items-center gap-1">
                      <button
                        onClick={() => handleEnterBusiness(mod.type, mod.reference_id, mod.hotel_id)}
                        className="flex items-center justify-between flex-1 px-4 py-2.5 hover:bg-slate-800 hover:text-white rounded-xl transition-all text-left text-sm text-slate-400"
                      >
                        <div className="flex items-center gap-3">
                          {mod.type === 'hotel' ? (
                            <Building2 size={17} className="text-emerald-400 shrink-0" />
                          ) : mod.type === 'gym' ? (
                            <Dumbbell size={17} className="text-blue-400 shrink-0" />
                          ) : mod.type === 'restaurant' ? (
                            <Coffee size={17} className="text-orange-400 shrink-0" />
                          ) : (
                            <Sparkles size={17} className="text-violet-400 shrink-0" />
                          )}
                          <span className="font-medium truncate">{mod.name || `Módulo ${mod.type?.toUpperCase()}`}</span>
                        </div>
                        {mod.is_active && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      </button>
                      {mod.type === 'hotel' && (
                        <button
                          onClick={() => {
                            const key = mod.slug || mod.hotel_id;
                            window.open(key ? `${PORTAL_BASE}/${key}` : PORTAL_BASE, '_blank');
                          }}
                          className="p-2 rounded-xl hover:bg-slate-800 text-slate-600 hover:text-emerald-400 transition-all shrink-0"
                          title="Ver portal público"
                        >
                          <Globe size={14} />
                        </button>
                      )}
                    </div>
                  ))

                ) : (
                  <p className="px-4 py-2 text-xs text-slate-600 italic">Sin módulos activos</p>
                )}
              </nav>
            </div>

            {/* Administración */}
            <div>
              <p className="px-4 text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1">Administración</p>
              <nav className="space-y-0.5">
                {[
                  { label: 'Portal de Reservas', icon: <Globe size={17} />, path: '__portal__', match: [], portalKey: null },
                  { label: 'Facturación y Planes', icon: <CreditCard size={17} />, path: '/billing', match: ['/billing', '/upgrade'] },
                  { label: 'Notificaciones', icon: <Bell size={17} />, path: '/notifications', match: ['/notifications'], badge: urgentNotifCount },
                  { label: 'Chat Operativo', icon: <MessageSquare size={17} />, path: '/chat', match: ['/chat'] },
                  { label: 'Integración IA (MCP)', icon: <Sparkles size={17} />, path: '/mcp', match: ['/mcp'] },
                  { label: 'Soporte y Ayuda', icon: <CheckCircle2 size={17} />, path: '/support', match: ['/support'] },
                  { label: 'Configuración', icon: <Settings size={17} />, path: '#', match: [] },
                ].map(item => {
                  const active = item.match.some(m => location.pathname.includes(m));
                  return (
                    <button
                      key={item.label}
                      onClick={() => {
                        if (item.path === '__portal__') window.open((item as any).portalKey ? `${PORTAL_BASE}/${(item as any).portalKey}` : PORTAL_BASE, '_blank');
                        else if (item.path !== '#') navigate(item.path);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all text-left text-sm font-medium ${
                        active ? 'bg-indigo-500/15 text-indigo-400' : 'hover:bg-slate-800 hover:text-white text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {item.path === '__portal__' ? (
                        <ExternalLink size={12} className="text-slate-600" />
                      ) : item.badge && item.badge > 0 ? (
                        <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* User / Logout */}
          <div className="p-4 border-t border-slate-800/60">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 w-full text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all text-sm"
            >
              <LogOut size={17} />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
            <div className="mt-3 flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
                {(ownerNombre || session?.user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-white truncate">{ownerNombre || 'Usuario'}</p>
                <p className="text-xs text-slate-500 truncate">{session?.user?.email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </DashboardContext.Provider>
  );
};
