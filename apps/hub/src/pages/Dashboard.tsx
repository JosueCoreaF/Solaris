import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import apiClient from '../services/api';
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  Building2,
  Dumbbell,
  Coffee,
  Settings,
  CreditCard,
  Search,
  Bell,
  LogOut,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Users,
  Plus,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [modules, setModules] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ ingresos: 0, negocios_activos: 0, ocupacion: 0, tareas: 0 });
  const [ownerNombre, setOwnerNombre] = useState('');
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setDataLoading(true);
        const d = await apiClient.get('/hub/dashboard-summary');
        // Si el backend nos dice que no hay perfil owner, redirigir al setup
        if (d?.needsOwnerSetup) {
          navigate('/setup-owner', { replace: true });
          return;
        }
        setModules(d?.modules || []);
        setKpis(d?.kpis || { ingresos: 0, negocios_activos: 0, ocupacion: 0, tareas: 0 });
        setOwnerNombre(d?.owner?.nombre || session?.user?.email?.split('@')[0] || 'Usuario');
      } catch (err: any) {
        if (err.response?.data?.needsOwnerSetup) {
          navigate('/setup-owner', { replace: true });
          return;
        }
        setError(err.response?.data?.error || err.message || 'Error al cargar el dashboard.');
      } finally {
        setDataLoading(false);
      }
    };
    if (session) fetchDashboard();
  }, [session, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const routeByModuleType = (type: string) => {
    const normalized = type?.toLowerCase?.() ?? 'hotel';
    switch (normalized) {
      case 'gym':
        return 5175;
      case 'restaurant':
        return 5176;
      case 'store':
        return 5177;
      case 'hotel':
      default:
        return 5174;
    }
  };

  const handleEnterBusiness = (moduleType: string, referenceId: string) => {
    const port = routeByModuleType(moduleType);
    try {
      if (session) {
        const accessToken = session.access_token;
        const refreshToken = session.refresh_token;
        window.location.href = `http://localhost:${port}/?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&business_id=${encodeURIComponent(referenceId)}`;
      } else {
        window.location.href = `http://localhost:${port}/?business_id=${encodeURIComponent(referenceId)}`;
      }
    } catch {
      window.location.href = `http://localhost:${port}/?business_id=${encodeURIComponent(referenceId)}`;
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  const showEmptyState = !dataLoading && !error && modules.length === 0;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">

      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col hidden md:flex shrink-0">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Solaris
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-8 scrollbar-hide">
          {/* General Section */}
          <div>
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">General</p>
            <nav className="space-y-1">
              <a href="#" className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-lg transition-colors">
                <LayoutDashboard size={18} />
                <span className="font-medium text-sm">Dashboard</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                <BarChart3 size={18} />
                <span className="font-medium text-sm">Analíticas</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                <Wallet size={18} />
                <span className="font-medium text-sm">Finanzas</span>
              </a>
            </nav>
          </div>

          {/* Mis Módulos Section */}
          <div>
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mis Módulos</p>
            <nav className="space-y-1">
              {dataLoading ? (
                <div className="px-4 py-2 flex gap-3 items-center animate-pulse">
                  <div className="w-4 h-4 bg-slate-800 rounded-full"></div>
                  <div className="h-3 bg-slate-800 rounded w-24"></div>
                </div>
              ) : modules.length > 0 ? (
                modules.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => handleEnterBusiness(mod.type, mod.reference_id)}
                    className="flex items-center justify-between w-full px-4 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {mod.type === 'hotel' ? (
                    <Building2 size={18} className="text-emerald-400" />
                  ) : mod.type === 'gym' ? (
                    <Dumbbell size={18} className="text-blue-400" />
                  ) : mod.type === 'restaurant' ? (
                    <Coffee size={18} className="text-orange-400" />
                  ) : (
                    <Sparkles size={18} className="text-violet-400" />
                  )}
                      <span className="font-medium text-sm truncate">{mod.name || `Módulo ${mod.type?.toUpperCase()}`}</span>
                    </div>
                    {mod.is_active && <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 ml-2"></div>}
                  </button>
                ))
              ) : (
                <div className="px-4 py-2 text-sm text-slate-500">No hay módulos activos</div>
              )}
            </nav>
          </div>

          {/* Administración Section */}
          <div>
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Administración</p>
            <nav className="space-y-1">
              <a href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                <Settings size={18} />
                <span className="font-medium text-sm">Configuración Global</span>
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 hover:text-white rounded-lg transition-colors">
                <CreditCard size={18} />
                <span className="font-medium text-sm">Suscripciones</span>
              </a>
            </nav>
          </div>
        </div>

        {/* User / Logout */}
        <div className="p-4 border-t border-slate-800/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 w-full text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">

        {/* Top Header Flotante */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-8 shrink-0 z-20">
          <div className="flex-1 max-w-md">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Buscar clientes, reservas o transacciones..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative text-slate-500 hover:text-slate-700 transition-colors">
              <Bell size={20} />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white transform translate-x-1/2 -translate-y-1/2"></span>
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="text-right hidden md:block">
                <p className="text-sm font-semibold text-slate-900">
                  {dataLoading ? <span className="animate-pulse bg-slate-200 h-4 w-20 block rounded"></span> : ownerNombre || 'Usuario'}
                </p>
                <p className="text-xs text-slate-500">Propietario</p>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-transparent group-hover:ring-indigo-100 transition-all">
                {ownerNombre ? ownerNombre.charAt(0).toUpperCase() : 'U'}
              </div>
            </div>
            <button onClick={handleLogout} className="md:hidden text-slate-500">
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 z-10 relative">

          {dataLoading ? (
            // Skeleton Loader Completo
            <div className="max-w-6xl animate-pulse">
              <div className="mb-10">
                <div className="h-8 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 h-32">
                    <div className="flex justify-between mb-4">
                      <div className="h-10 w-10 bg-slate-200 rounded-xl"></div>
                      <div className="h-6 w-16 bg-slate-200 rounded-full"></div>
                    </div>
                    <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                  </div>
                ))}
              </div>
              <div className="h-48 bg-slate-200 rounded-2xl w-full"></div>
            </div>
          ) : (
            <>
              {/* Encabezado de Página */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bienvenido, {ownerNombre || 'Usuario'} <span className="inline-block origin-bottom-right hover:animate-wave">👋</span></h1>
                <p className="text-slate-500 mt-2 text-sm">Aquí tienes el resumen de tus operaciones de hoy.</p>
              </div>

              {/* Banner de Error (Ej. Red Caída) */}
              {error && (
                <div className="mb-8 bg-red-50 text-red-600 border border-red-200 px-4 py-3 rounded-xl text-sm font-medium flex items-center justify-center">
                  {error}
                </div>
              )}

              {/* Condicional: Estado Vacío vs KPIs */}
              {showEmptyState ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
                  <Building2 className="w-20 h-20 text-slate-300 mb-6" />
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Aún no tienes negocios registrados</h2>
                  <p className="text-slate-500 max-w-md mx-auto mb-8">Comienza creando tu primer hotel o sucursal para ver tus métricas aquí.</p>
                  <button
                    onClick={() => navigate('/create-business')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/30"
                  >
                    Crear mi primer negocio
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="space-y-8 max-w-6xl"
                >
                  {/* Grid de KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                    {/* KPI 1 */}
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                          <Wallet size={20} />
                        </div>
                        <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          <TrendingUp size={12} className="mr-1" /> +12.5%
                        </span>
                      </div>
                      <h3 className="text-slate-500 text-sm font-medium mb-1">Ingresos Mensuales</h3>
                      <p className="text-2xl font-bold text-slate-900">${kpis.ingresos.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                    </motion.div>

                    {/* KPI 2 (Negocios Activos con Botón +) */}
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
                          <Building2 size={20} />
                        </div>
                        <span className="flex items-center text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                          Estables
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <div>
                          <h3 className="text-slate-500 text-sm font-medium mb-1">Negocios Activos</h3>
                          <p className="text-2xl font-bold text-slate-900">{kpis.negocios_activos}</p>
                        </div>
                        <button
                          onClick={() => navigate('/create-business')}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors group relative"
                          title="Registrar Nuevo Negocio"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </motion.div>

                    {/* KPI 3 */}
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                          <Users size={20} />
                        </div>
                        <span className="flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                          <TrendingUp size={12} className="mr-1" /> +5%
                        </span>
                      </div>
                      <h3 className="text-slate-500 text-sm font-medium mb-1">Ocupación / Capacidad</h3>
                      <p className="text-2xl font-bold text-slate-900">{kpis.ocupacion}%</p>
                    </motion.div>

                    {/* KPI 4 */}
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl">
                          <CheckCircle2 size={20} />
                        </div>
                        <span className="flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                          Urgentes
                        </span>
                      </div>
                      <h3 className="text-slate-500 text-sm font-medium mb-1">Tareas Pendientes</h3>
                      <p className="text-2xl font-bold text-slate-900">{kpis.tareas}</p>
                    </motion.div>
                  </div>

                  {/* Sección: Tus Negocios (Acceso a PartnerCentral) */}
                  <motion.div variants={itemVariants} className="mt-12">
                    <h2 className="text-xl font-bold text-slate-900 mb-6">Tus Negocios</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {modules.map((mod: any) => (
                        <div key={mod.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col transition-all hover:shadow-md">
                          <div className="flex justify-between items-start mb-6">
                            <div className="bg-indigo-50 p-3 rounded-xl">
                              {mod.type === 'HOTEL' ? <Building2 className="text-indigo-600" size={24} /> : <Dumbbell className="text-indigo-600" size={24} />}
                            </div>
                            {mod.is_active && (
                              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-md">
                                Activo
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-slate-900 mb-1">{mod.name || 'Módulo Hotel'}</h3>
                          <p className="text-sm text-slate-500 mb-6 flex-1">Gestión operativa del sistema central.</p>

                          <button
                            onClick={() => handleEnterBusiness(mod.id, mod.reference_id)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors shadow-sm"
                          >
                            Entrar al Panel <ArrowRight size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Recomendaciones de IA */}
                  <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-indigo-500 overflow-hidden transition-all hover:shadow-md mt-8">
                    <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
                      <div className="bg-indigo-50 p-4 rounded-full shrink-0">
                        <Sparkles className="text-indigo-600 h-8 w-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-slate-900">Recomendación Estratégica AI</h3>
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wide">Nuevo</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed mb-5">
                          Hemos detectado una <strong className="text-slate-900">alta demanda proyectada</strong> para tus instalaciones este próximo fin de semana, incrementando el interés de búsqueda un 42%. Sugerimos habilitar la estrategia de <strong>sobreventa dinámica</strong> según tu configuración de riesgos.
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                            Aplicar Ajuste Automático
                          </button>
                          <button className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg shadow-sm transition-colors">
                            Ver Detalles Analíticos
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
