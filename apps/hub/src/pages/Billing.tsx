import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Zap, CheckCircle, ShieldAlert, Loader2, ArrowRight, Wallet, Bitcoin, Smartphone, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function Billing() {
  const [data, setData] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const fetchBillingStatus = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const [statusRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/hub/billing/status`, {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
        }),
        axios.get(`${API_BASE_URL}/hub/billing/history`, {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
        })
      ]);
      setData(statusRes.data || []);
      setHistory(historyRes.data || []);
    } catch (err: any) {
      console.error('Error fetching billing status', err);
      // Si el error es 400, probablemente no tiene perfil de owner
      if (err.response?.status === 400) {
        navigate('/setup-owner');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }



  const handleOpenPortal = async () => {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await axios.post(`${API_BASE_URL}/hub/billing/portal`, {}, {
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      console.error('Error opening portal:', err);
      const errorMsg = err.response?.data?.error || err.message;
      alert(`No se pudo abrir el portal de pagos: ${errorMsg}\n\nSi dice algo sobre "configure your portal", necesitas ir a tu panel de Stripe y habilitar el Customer Portal.`);
      setLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!selectedMethod) return;
    setSimulatingPayment(true);
    
    // Simulamos un delay de red y validación
    setTimeout(() => {
      setData((prev: any) => ({
        ...prev,
        paymentMethod: {
          brand: selectedMethod,
          last4: 'SIMU'
        }
      }));
      setSimulatingPayment(false);
      setIsPaymentModalOpen(false);
      setSelectedMethod(null);
    }, 1500);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-12 px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-indigo-500" />
          Suscripciones y Facturación
        </h1>
        <p className="text-slate-500 mt-2">Gestiona tu plan actual, límites operativos y métodos de pago.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Tarjetas de Módulos (Iteradas) */}
        <div className="lg:col-span-2 space-y-6">
          {data.map((sub, idx) => {
            const isTrial = sub.estado === 'trial';
            const isExpired = isTrial && sub.trial_end && new Date(sub.trial_end) < new Date();
            let daysLeft = 0;
            if (isTrial && !isExpired && sub.trial_end) {
              const diffTime = Math.abs(new Date(sub.trial_end).getTime() - new Date().getTime());
              daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
            const planData = Array.isArray(sub.planes_suscripcion) ? sub.planes_suscripcion[0] : sub.planes_suscripcion;

            return (
              <motion.div key={sub.id_suscripcion} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-bl-full -z-10" />

                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-1">Módulo: {sub.tipo_modulo}</p>
                    <h2 className="text-4xl font-extrabold text-slate-900 capitalize">{planData?.nombre || 'Básico'}</h2>
                    {sub.estado === 'activa' && sub.current_period_end && (
                      <p className="text-sm font-medium text-slate-500 mt-2">
                        Próximo cobro: {new Date(sub.current_period_end).toLocaleDateString()} — ${planData?.precio_mensual}/mes
                      </p>
                    )}
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
                    sub.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
                    isTrial && !isExpired ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {sub.estado}
                  </span>
                </div>

                {isTrial && (
                  <div className={`p-4 rounded-2xl mb-8 flex items-start gap-3 ${isExpired ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <ShieldAlert className={`w-6 h-6 shrink-0 ${isExpired ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <h4 className={`font-bold ${isExpired ? 'text-red-800' : 'text-amber-800'}`}>
                        {isExpired ? 'Tu periodo de prueba ha finalizado' : `Estás en tu periodo de prueba (${daysLeft} días restantes)`}
                      </h4>
                      <p className={`text-sm mt-1 ${isExpired ? 'text-red-600' : 'text-amber-700'}`}>
                        {isExpired 
                          ? 'Para seguir operando o crear nuevos negocios, por favor actualiza tu plan.'
                          : 'Puedes crear negocios y operar sin costo. Agrega tu método de pago antes de que finalice la prueba.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm font-semibold text-slate-700 mb-2">
                      <span>Límite de Negocios (Base + Extras)</span>
                      <span>{(planData?.limite_negocios || 1) + (sub.negocios_extra || 0)} Total</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3">
                      <div className="bg-indigo-500 h-3 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Plan Base: {planData?.limite_negocios || 1} • Cupos Extra: {sub.negocios_extra || 0}
                    </p>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex gap-4">
                    <button 
                      onClick={() => navigate(`/upgrade?module=${sub.tipo_modulo}`)}
                      className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                    >
                      Mejorar Plan <Zap className="w-4 h-4 text-amber-400" />
                    </button>
                    <button onClick={() => navigate(`/upgrade?module=${sub.tipo_modulo}`)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-6 py-3 rounded-xl font-bold transition-colors">
                      Añadir Cupo Extra
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          
          {data.length === 0 && (
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center">
              <p className="text-slate-500">No tienes suscripciones activas. Añade un negocio para comenzar.</p>
              <button onClick={() => navigate('/create-business')} className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Añadir Negocio</button>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 mb-4">Método de Pago</h3>
            {data?.paymentMethod ? (
              <div className="flex items-center gap-4 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-12 h-8 bg-white rounded border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shadow-sm capitalize">
                  {data.paymentMethod.brand}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">•••• {data.paymentMethod.last4}</p>
                  <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Método principal
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-8 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">
                  NO
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Sin método asociado</p>
                  <p className="text-xs text-slate-500">Agrega uno para evitar interrupciones.</p>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              className="w-full text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {data?.paymentMethod ? 'Gestionar Métodos' : 'Agregar Método de Pago'}
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="bg-slate-900 text-white rounded-3xl p-6 shadow-lg shadow-indigo-500/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Zap className="w-24 h-24" />
            </div>
            <h3 className="font-bold text-lg mb-2">¿Necesitas soporte técnico?</h3>
            <p className="text-slate-400 text-sm mb-6">Nuestro equipo está listo para ayudarte con tu facturación.</p>
            <button 
              onClick={() => navigate('/support')}
              className="flex items-center gap-2 text-sm font-bold text-white hover:text-indigo-300 transition-colors"
            >
              Abrir Ticket <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>

      </div>

      {/* Tabla de Historial de Pagos */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-slate-900">Historial de Transacciones</h3>
          <button 
            onClick={() => {
              const headers = ['Fecha', 'Concepto', 'Metodo', 'Monto', 'Estado'];
              const rows = history.map(h => [
                new Date(h.created_at).toLocaleDateString(),
                h.concepto,
                h.metodo_pago,
                h.monto,
                h.estado
              ]);
              const csvContent = "data:text/csv;charset=utf-8," 
                + headers.join(',') + '\n' 
                + rows.map(e => e.join(',')).join('\n');
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement('a');
              link.setAttribute('href', encodedUri);
              link.setAttribute('download', 'historial_pagos.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium shadow-sm hover:bg-slate-50 transition-colors"
          >
            Exportar CSV
          </button>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Fecha</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Concepto</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Método</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Monto</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length > 0 ? (
                history.map((h, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-700">{new Date(h.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{h.concepto}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 capitalize flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> {h.metodo_pago}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${h.monto}</td>
                    <td className="px-6 py-4">
                      <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        {h.estado}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No hay transacciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => !simulatingPayment && setIsPaymentModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
            >
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                disabled={simulatingPayment}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Agregar Método de Pago</h3>
                <p className="text-slate-500 text-sm mt-1">Selecciona una opción para simular la vinculación.</p>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  { id: 'visa', name: 'Tarjeta de Crédito / Débito', icon: <CreditCard className="w-5 h-5" /> },
                  { id: 'paypal', name: 'PayPal', icon: <img src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg" alt="PayPal" className="h-4" /> },
                  { id: 'applepay', name: 'Apple Pay / Google Wallet', icon: <Smartphone className="w-5 h-5" /> },
                  { id: 'crypto', name: 'Criptomonedas (USDT/BTC)', icon: <Bitcoin className="w-5 h-5" /> },
                ].map((method) => (
                  <button
                    key={method.id}
                    disabled={simulatingPayment}
                    onClick={() => setSelectedMethod(method.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      selectedMethod === method.id 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className={selectedMethod === method.id ? 'text-indigo-600' : 'text-slate-400'}>
                      {method.icon}
                    </div>
                    <span className="font-semibold">{method.name}</span>
                    {selectedMethod === method.id && (
                      <CheckCircle className="w-5 h-5 text-indigo-600 ml-auto" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSimulatePayment}
                disabled={!selectedMethod || simulatingPayment}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {simulatingPayment ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verificando método...
                  </>
                ) : (
                  'Verificar y Vincular'
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
