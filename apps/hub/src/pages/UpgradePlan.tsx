import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Star, Zap, Building2, ChevronLeft, Loader2, CreditCard, Info, X, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { supabase } from '../services/supabaseClient';
import { DashboardLayout } from '../components/DashboardLayout';

// Los planes dinámicos se cargarán desde la DB

// Etiquetas legibles para las feature_flags de gating (módulo hotel)
const FEATURE_LABELS: Record<string, string> = {
  cotizaciones: 'Cotizaciones',
  email_studio: 'Email Studio (plantillas de correo)',
  email_confirmaciones: 'Emails automáticos de confirmación de reserva',
  ai_asistente: 'Asistente IA',
  auditoria: 'Auditoría cruzada',
  multimoneda: 'Multi-moneda',
  reportes: 'Reportes',
  exportador_datos: 'Exportador de datos',
};

export const UpgradePlan = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [detailsPlan, setDetailsPlan] = useState<any>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [currentBilling, setCurrentBilling] = useState<any>(null);
  const [currentCount, setCurrentCount] = useState(0);
  
  const searchParams = new URLSearchParams(window.location.search);
  const currentModule = searchParams.get('module') || 'hotel';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
        
        const [statusRes, plansRes, businessesRes] = await Promise.all([
          apiClient.get('/hub/billing/status').catch(() => []),
          apiClient.get('/hub/billing/plans').catch(() => []),
          apiClient.get('/hub/businesses').catch(() => [])
        ]);
        
        // Find the specific active subscription for this module
        const moduleSub = Array.isArray(statusRes) ? statusRes.find((sub: any) => sub.tipo_modulo === currentModule) : null;
        setCurrentBilling(moduleSub || null);
        
        // Filter plans by module
        setPlans(Array.isArray(plansRes) ? plansRes.filter((p: any) => p.tipo_modulo === currentModule) : []);
        
        const moduleBusinesses = Array.isArray(businessesRes) ? businessesRes.filter((b: any) => b.tipo_modulo?.toLowerCase() === currentModule.toLowerCase()) : [];
        setCurrentCount(moduleBusinesses.length);
      } catch (err) {
        console.error('Error fetching billing data', err);
      }
    };
    fetchData();
  }, [currentModule]);

  const handleSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsConfirmModalOpen(true);
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      await apiClient.post('/hub/billing/upgrade', { plan_id: selectedPlan.id_plan, tipo_modulo: currentModule });
      // Simulamos un pequeño delay de procesamiento
      setTimeout(() => {
        navigate('/billing');
      }, 1500);
    } catch (err: any) {
      console.error('Error al actualizar plan', err);
      if (err.response?.data?.error === 'DOWNGRADE_BLOCKED') {
        const { active, limite } = err.response.data;
        alert(`No puedes cambiar a este plan: tienes ${active} negocio(s) activo(s) y este plan permite hasta ${limite}. Desactiva negocios o reduce cupos extra antes de degradar.`);
      } else {
        alert('Ocurrió un error al procesar el pago.');
      }
      setLoading(false);
    }
  };

  const handleAddon = async () => {
    setLoading(true);
    try {
      await apiClient.post('/hub/billing/addon', { tipo_modulo: currentModule });
      setIsAddonModalOpen(false);
      navigate('/billing');
    } catch (err) {
      console.error('Error al añadir cupo', err);
      alert('Ocurrió un error al procesar la compra del cupo extra.');
      setLoading(false);
    }
  };

  const maxLimit = currentBilling?.planes_suscripcion?.limite_negocios 
    ? currentBilling.planes_suscripcion.limite_negocios + (currentBilling.negocios_extra || 0)
    : 1; // Basic assumption if no sub

  const remaining = Math.max(0, maxLimit - currentCount);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50 font-sans pb-20">
        {/* Header */}
        <div className="bg-slate-900 text-white pt-12 pb-24 px-6 text-center relative overflow-hidden rounded-b-[3rem] mx-4 mt-4 shadow-xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/30 blur-[120px] rounded-full pointer-events-none" />
          
          <button 
            onClick={() => navigate('/billing')}
            className="absolute top-8 left-8 text-slate-400 hover:text-white flex items-center gap-2 transition-colors z-20"
          >
            <ChevronLeft className="w-5 h-5" /> Volver
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 max-w-2xl mx-auto mt-8">
            {/* Banner de Límites */}
            {currentBilling && (
              <div className="mb-8 inline-flex items-center gap-3 bg-indigo-500/20 border border-indigo-400/30 text-indigo-100 px-6 py-3 rounded-2xl backdrop-blur-md">
                <Info className="w-5 h-5 text-indigo-300" />
                <div className="text-left text-sm">
                  <p className="font-semibold text-white">Tienes {currentCount} de {maxLimit} negocios registrados ({currentModule.toUpperCase()})</p>
                  <p className="text-indigo-200">
                    {remaining > 0 
                      ? `¡Aún tienes cupo para ${remaining} ${remaining === 1 ? 'negocio' : 'negocios'} más!` 
                      : 'Has alcanzado el límite de tu plan actual. Añade cupos extra o mejora tu plan.'}
                  </p>
                </div>
              </div>
            )}

            <h1 className="text-4xl md:text-5xl font-extrabold mb-6">Lleva tu negocio al siguiente nivel</h1>
            <p className="text-lg text-slate-300">Elige el plan que mejor se adapte a tus necesidades. Cancela o cambia en cualquier momento.</p>
            
            {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-10">
            <span className={`text-sm font-semibold ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>Mensual</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="w-14 h-7 bg-indigo-600 rounded-full p-1 relative transition-colors"
            >
              <motion.div 
                animate={{ x: isAnnual ? 28 : 0 }}
                className="w-5 h-5 bg-white rounded-full shadow-md"
              />
            </button>
            <span className={`text-sm font-semibold flex items-center gap-2 ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
              Anual <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Ahorra 20%</span>
            </span>
          </div>
        </motion.div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-5xl mx-auto px-6 -mt-12 relative z-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 justify-center">
          {plans.map((plan, index) => (
            <motion.div 
              key={plan.id_plan}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-3xl p-8 shadow-xl border-2 relative ${plan.precio_mensual > 0 ? 'border-indigo-500 shadow-indigo-500/10' : 'border-transparent shadow-slate-200/50'}`}
            >
              {plan.precio_mensual > 0 && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1">
                  <Star className="w-3 h-3" fill="currentColor" /> Pro
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl bg-indigo-50 text-indigo-600`}>
                  {currentModule === 'hotel' ? <Building2 className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                </div>
                <h3 className="text-2xl font-bold text-slate-900">{plan.nombre}</h3>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold text-slate-900">
                    ${isAnnual ? Math.round(plan.precio_anual) : plan.precio_mensual}
                  </span>
                  <span className="text-slate-500 font-medium">/{isAnnual ? 'año' : 'mes'}</span>
                </div>
                <p className="text-sm text-slate-500 mt-2 min-h-[40px]">{plan.descripcion}</p>
              </div>

              <div className="space-y-4 mb-8 border-t border-slate-100 pt-6">
                {plan.features?.map((feat: string, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-1 rounded-full text-emerald-600 shrink-0">
                      <Check className="w-3 h-3" />
                    </div>
                    <span className="text-slate-700 font-medium text-sm">{feat}</span>
                  </div>
                ))}
              </div>

              {currentBilling?.estado === 'activa' && currentBilling?.id_plan === plan.id_plan ? (
                <div className="w-full py-4 rounded-xl font-bold text-center bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" /> Tu Plan Actual
                </div>
              ) : (
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                    plan.precio_mensual > 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                  }`}
                >
                  {currentBilling?.estado === 'activa' ? `Cambiar a ${plan.nombre}` : `Seleccionar ${plan.nombre}`}
                </button>
              )}

              <button
                onClick={() => setDetailsPlan(plan)}
                className="w-full mt-3 py-3 rounded-xl font-semibold text-sm text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" /> Ver detalles
              </button>
            </motion.div>
          ))}
        </div>

        {/* Add-on Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-start gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xl font-bold text-slate-900">¿Necesitas un negocio extra?</h4>
              <p className="text-slate-500 text-sm mt-1">Compra un cupo de hotel adicional sin cambiar tu plan base.</p>
            </div>
          </div>
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="text-center md:text-right">
              <span className="text-2xl font-bold text-slate-900">$20</span>
              <span className="text-slate-500 text-sm block">/mes por negocio</span>
            </div>
            <button 
              onClick={() => setIsAddonModalOpen(true)}
              disabled={loading}
              className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Añadir Cupo
            </button>
          </div>
        </motion.div>
      </div>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !loading && setIsConfirmModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
            >
              <div className="text-center mb-6 border-b border-slate-100 pb-6">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Resumen de Compra</h3>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium">Plan {selectedPlan?.nombre}</span>
                  <span className="font-bold">${isAnnual ? Math.round(selectedPlan?.precio_anual) : selectedPlan?.precio_mensual}.00</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium">Ciclo de facturación</span>
                  <span>{isAnnual ? 'Anual' : 'Mensual'}</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-900">Total a pagar hoy</span>
                  <span className="text-2xl font-extrabold text-indigo-600">
                    ${isAnnual ? Math.round(selectedPlan?.precio_anual) : selectedPlan?.precio_mensual}.00
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl flex items-center gap-3 mb-8 border border-slate-100">
                <div className="bg-white p-1 rounded shadow-sm border border-slate-200">
                  <span className="font-bold text-[10px] text-blue-800">VISA</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Tarjeta Vinculada</p>
                  <p className="text-xs text-slate-500">•••• 4242</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    'Pagar Suscripción'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Addon Modal */}
      <AnimatePresence>
        {isAddonModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !loading && setIsAddonModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full"
            >
              <div className="text-center mb-6 border-b border-slate-100 pb-6">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">1 Cupo Adicional</h3>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium">Módulo</span>
                  <span className="font-bold uppercase">{currentModule}</span>
                </div>
                <div className="flex justify-between items-center text-slate-700">
                  <span className="font-medium">Precio extra mensual</span>
                  <span className="font-bold">$20.00</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-lg font-bold text-slate-900">Total a cargar</span>
                  <span className="text-2xl font-extrabold text-amber-600">
                    $20.00
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsAddonModalOpen(false)}
                  disabled={loading}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddon}
                  disabled={loading}
                  className="flex-[2] py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Cargo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Plan Details / Comparison Modal */}
      <AnimatePresence>
        {detailsPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDetailsPlan(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setDetailsPlan(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Plan {detailsPlan.nombre}</h3>
                <p className="text-slate-500 text-sm mt-1">{detailsPlan.descripcion}</p>
              </div>

              <div className="mb-8">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Beneficios incluidos</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(detailsPlan.features || []).map((feat: string, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="bg-emerald-100 p-1 rounded-full text-emerald-600 shrink-0">
                        <Check className="w-3 h-3" />
                      </div>
                      <span className="text-slate-700 font-medium text-sm">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Comparativa entre planes</h4>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        <th className="py-2 px-2 text-xs font-semibold text-slate-500"></th>
                        {plans.map((p) => (
                          <th key={p.id_plan} className={`py-2 px-2 text-sm font-bold text-center ${p.id_plan === detailsPlan.id_plan ? 'text-indigo-600' : 'text-slate-900'}`}>
                            {p.nombre}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-2.5 px-2 text-sm font-medium text-slate-700">Negocios activos</td>
                        {plans.map((p) => (
                          <td key={p.id_plan} className={`py-2.5 px-2 text-sm text-center font-bold ${p.id_plan === detailsPlan.id_plan ? 'text-indigo-600' : 'text-slate-900'}`}>
                            {p.limite_negocios}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-2 text-sm font-medium text-slate-700">Reservas + Chat operativo</td>
                        {plans.map((p) => (
                          <td key={p.id_plan} className="py-2.5 px-2 text-center">
                            <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                          </td>
                        ))}
                      </tr>
                      {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                        <tr key={key}>
                          <td className="py-2.5 px-2 text-sm font-medium text-slate-700">{label}</td>
                          {plans.map((p) => (
                            <td key={p.id_plan} className="py-2.5 px-2 text-center">
                              {(p.feature_flags || []).includes(key)
                                ? <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                                : <Minus className="w-4 h-4 text-slate-300 mx-auto" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {!(currentBilling?.estado === 'activa' && currentBilling?.id_plan === detailsPlan.id_plan) && (
                <button
                  onClick={() => { handleSelectPlan(detailsPlan); setDetailsPlan(null); }}
                  className="w-full mt-8 py-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all"
                >
                  {currentBilling?.estado === 'activa' ? `Cambiar a ${detailsPlan.nombre}` : `Seleccionar ${detailsPlan.nombre}`}
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </DashboardLayout>
  );
};
