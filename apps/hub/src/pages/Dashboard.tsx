import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardLayout, useDashboard } from '../components/DashboardLayout';
import {
  Wallet,
  Building2,
  Dumbbell,
  Coffee,
  Bell,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Users,
  Plus,
  ArrowRight,
  Search,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';

const DashboardContent = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { modules, kpis, ownerNombre, summary, notifications, dataLoading, error, refetch } = useDashboard();

  // Si la sesión todavía no se ha cargado, mostrar spinner inicial
  if (session === undefined) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  const showEmptyState = !dataLoading && !error && modules.length === 0;
  const urgentCount = notifications.filter(n => n.severity === 'high').length;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 24 } },
  };

  const getModuleUrl = (type: string) => {
    const t = type?.toLowerCase?.() ?? 'hotel';
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
      const ports: Record<string, number> = { gym: 5175, restaurant: 5176, store: 5177, hotel: 5173 };
      return `http://localhost:${ports[t] || 5173}`;
    }
    
    // En producción (Vercel) usando subdominios
    return `https://${t}.solarys.uk`;
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hola, {ownerNombre || 'Usuario'} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">Resumen de todos tus negocios en Solaris</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar negocio..."
              className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl w-56 transition-all outline-none text-sm"
            />
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Bell className="w-6 h-6" />
            {urgentCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {urgentCount > 9 ? '9+' : urgentCount}
              </span>
            ) : (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full border-2 border-white" />
            )}
          </button>
          <button
            onClick={() => navigate('/create-business')}
            className="hidden md:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm shadow-indigo-200"
          >
            <Plus size={18} />
            Añadir Negocio
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-8 w-full max-w-7xl mx-auto space-y-10">

        {/* ── Estado: Cargando ── */}
        {dataLoading && (
          <div className="max-w-6xl animate-pulse space-y-6">
            <p className="text-slate-400 text-sm">Cargando tu información...</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 h-32">
                  <div className="flex justify-between mb-4">
                    <div className="h-10 w-10 bg-slate-200 rounded-xl" />
                    <div className="h-6 w-16 bg-slate-200 rounded-full" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                  <div className="h-6 bg-slate-200 rounded w-3/4" />
                </div>
              ))}
            </div>
            <div className="h-48 bg-slate-200 rounded-2xl w-full" />
          </div>
        )}

        {/* ── Estado: Error ── */}
        {!dataLoading && error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
            <div className="flex-1">
              <p className="text-red-800 font-bold mb-1">Error al cargar el dashboard</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button
              onClick={refetch}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar
            </button>
          </div>
        )}

        {/* ── Estado: Sin negocios ── */}
        {showEmptyState && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-slate-300 shadow-sm flex flex-col items-center justify-center mt-10"
          >
            <div className="w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-6">
              <Building2 size={40} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Aún no tienes negocios</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              Empieza a gestionar hoteles, gimnasios o restaurantes creando tu primer módulo en Solaris.
            </p>
            <button
              onClick={() => navigate('/create-business')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
            >
              <Plus size={20} />
              Crear Mi Primer Negocio
            </button>
          </motion.div>
        )}

        {/* ── Estado: Contenido Principal ── */}
        {!dataLoading && !error && modules.length > 0 && (
          <>
            {/* KPIs Globales */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {/* Ingresos */}
              <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Ingresos del Mes</p>
                    <h3 className="text-3xl font-bold text-slate-900">${kpis.ingresos.toLocaleString()}</h3>
                  </div>
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                    <Wallet size={24} />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm relative z-10">
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                    <TrendingUp size={14} /> Todos los negocios
                  </span>
                </div>
              </motion.div>

              {/* Negocios Activos */}
              <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Negocios Activos</p>
                    <h3 className="text-3xl font-bold text-slate-900">{kpis.negocios_activos}</h3>
                  </div>
                  <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                    <Building2 size={24} />
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-500 relative z-10">Operando con normalidad</div>
              </motion.div>

              {/* Ocupación */}
              <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Ocupación Promedio</p>
                    <h3 className="text-3xl font-bold text-slate-900">{kpis.ocupacion}%</h3>
                  </div>
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                    <Users size={24} />
                  </div>
                </div>
                <div className="mt-4 w-full bg-slate-100 rounded-full h-1.5 relative z-10">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(kpis.ocupacion, 100)}%` }}
                  />
                </div>
              </motion.div>

              {/* Alertas */}
              <motion.div variants={itemVariants} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-amber-50 rounded-full group-hover:scale-110 transition-transform" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">Alertas Urgentes</p>
                    <h3 className={`text-3xl font-bold ${urgentCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {urgentCount}
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                    <CheckCircle2 size={24} />
                  </div>
                </div>
                <button
                  onClick={() => navigate('/notifications')}
                  className="mt-4 text-sm text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md font-medium relative z-10 hover:bg-amber-100 transition-colors"
                >
                  {urgentCount > 0 ? 'Ver notificaciones' : 'Sin alertas'}
                </button>
              </motion.div>
            </motion.div>

            {/* Grid de Negocios */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">Tus Negocios</h3>
                <button
                  onClick={() => navigate('/create-business')}
                  className="text-indigo-600 text-sm font-medium hover:text-indigo-700 flex items-center gap-1"
                >
                  Añadir <ArrowRight size={16} />
                </button>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {modules.map((mod: any) => (
                  <motion.div
                    variants={itemVariants}
                    key={mod.id}
                    className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-indigo-400 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-4 rounded-2xl ${
                        mod.type === 'hotel' ? 'bg-emerald-50 text-emerald-600'
                        : mod.type === 'gym' ? 'bg-blue-50 text-blue-600'
                        : 'bg-orange-50 text-orange-600'
                      }`}>
                        {mod.type === 'hotel'
                          ? <Building2 size={28} />
                          : mod.type === 'gym'
                          ? <Dumbbell size={28} />
                          : <Coffee size={28} />}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        mod.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {mod.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                      {mod.name}
                    </h4>
                    <p className="text-sm text-slate-500 capitalize mb-4">{mod.type}</p>

                    {/* KPIs por negocio */}
                    <div className="flex-1 space-y-2.5 mb-5">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Ingresos (Mes)</span>
                        <span className="font-bold text-slate-900">
                          ${(mod.kpis?.ingresos || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Ocupación</span>
                        <span className="font-bold text-slate-900">{mod.kpis?.ocupacion ?? 0}%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">Alertas</span>
                        <span className={`font-bold ${mod.kpis?.tareas > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                          {mod.kpis?.tareas ?? 0}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const baseUrl = getModuleUrl(mod.type);
                        if (session) {
                          window.location.href = `${baseUrl}/?access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&business_id=${encodeURIComponent(mod.reference_id)}`;
                        } else {
                          window.location.href = `${baseUrl}/?business_id=${encodeURIComponent(mod.reference_id)}`;
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-colors shadow-sm"
                    >
                      Entrar al Panel <ArrowRight size={16} />
                    </button>
                  </motion.div>
                ))}

                {/* Botón agregar */}
                <motion.div
                  variants={itemVariants}
                  onClick={() => navigate('/create-business')}
                  className="border-2 border-dashed border-slate-300 rounded-3xl p-6 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group flex flex-col items-center justify-center text-center min-h-[220px]"
                >
                  <div className="w-14 h-14 bg-slate-100 group-hover:bg-indigo-100 rounded-full flex items-center justify-center mb-4 transition-colors">
                    <Plus size={28} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-700 group-hover:text-indigo-700 transition-colors">
                    Añadir Nuevo
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">Expande tus operaciones</p>
                </motion.div>
              </motion.div>
            </div>

            {/* Recomendación IA */}
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="show"
              className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-indigo-500 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
                <div className="bg-indigo-50 p-4 rounded-full shrink-0">
                  <Sparkles className="text-indigo-600 h-8 w-8" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">Recomendación Estratégica AI</h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold uppercase tracking-wide">
                      Nuevo
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-5">
                    {summary?.ai_recommendation || 'Analizando tus métricas para generar una recomendación...'}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                      Aplicar Ajuste
                    </button>
                    <button
                      onClick={() => navigate('/notifications')}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      Ver Alertas
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </>
  );
};

export const Dashboard = () => {
  return (
    <DashboardLayout>
      <DashboardContent />
    </DashboardLayout>
  );
};
