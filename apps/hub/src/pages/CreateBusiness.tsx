import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import axios from 'axios';
import { Loader2, ArrowLeft, Building2, Dumbbell, Utensils, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


export const CreateBusiness = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get('step');
    const moduleParam = params.get('module');
    if (stepParam === '3' && moduleParam) {
      setStep(3);
      setFormData(prev => ({ ...prev, tipo_modulo: moduleParam }));
    }
  }, []);

  const [formData, setFormData] = useState({
    tipo_modulo: 'hotel',
    plan_id: '',
    nombre_hotel: '',
    ciudad: '',
    direccion: '',
    telefono: '',
    correo_contacto: ''
  });

  const [loadingModule, setLoadingModule] = useState(false);

  const handleSelectModule = async (type: string) => {
    setFormData({ ...formData, tipo_modulo: type });
    setLoadingModule(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
      
      const [statusRes, businessesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/hub/billing/status`, {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
        }),
        axios.get(`${API_BASE_URL}/hub/businesses`, {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` }
        })
      ]);

      const subs = statusRes.data || [];
      const moduleSub = subs.find((s: any) => s.tipo_modulo === type);

      if (!moduleSub) {
        setError('subscription_required');
        return;
      }

      const currentCount = (businessesRes.data || []).filter((b: any) => b.tipo_modulo === type).length;
      const maxLimit = moduleSub.planes_suscripcion?.limite_negocios + (moduleSub.negocios_extra || 0);

      if (currentCount >= maxLimit) {
        setError('limit_reached');
        return;
      }

      setStep(3);
    } catch (err: any) {
      console.error('Error verificando suscripción', err);
      setError('Ocurrió un error al verificar tu suscripción.');
    } finally {
      setLoadingModule(false);
    }
  };



  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('No hay sesión activa');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

      const payload = {
        ...formData,
        nombre_modulo: formData.nombre_hotel,
      };

      await axios.post(`${API_BASE_URL}/hub/businesses`, payload, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`
        }
      });

      setShowSuccessModal(true);
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error?.includes('límite')) {
        setError('limit_reached');
      } else if (err.response?.status === 403 && err.response?.data?.error === 'SUBSCRIPTION_REQUIRED') {
        setError('subscription_required');
      } else {
        setError(err.response?.data?.error || err.message || 'Ocurrió un error al crear el negocio');
      }
      setLoading(false);
    }
  };



  const renderStep1 = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-900">¿Qué tipo de negocio deseas añadir?</h2>
        <p className="text-slate-500 mt-2">Selecciona el módulo base para comenzar a configurar tu nueva propiedad.</p>
      </div>

      {loadingModule && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-3xl">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
          <p className="text-slate-600 font-medium">Verificando suscripciones...</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto relative">
        <div 
          onClick={() => !loadingModule && handleSelectModule('hotel')}
          className={`bg-white border-2 border-slate-200 hover:border-indigo-500 rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-all relative overflow-hidden ${loadingModule ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Building2 size={32} className="text-indigo-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Sistema Hotelero</h3>
          <p className="text-sm text-slate-500 mt-2">Gestión de reservas, habitaciones, limpieza y facturación.</p>
        </div>

        <div 
          onClick={() => !loadingModule && handleSelectModule('gym')}
          className={`bg-white border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-all relative overflow-hidden ${loadingModule ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Dumbbell size={32} className="text-blue-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Gimnasio FitHub</h3>
          <p className="text-sm text-slate-500 mt-2">Control de accesos, membresías y entrenadores.</p>
        </div>

        <div 
          onClick={() => !loadingModule && handleSelectModule('restaurant')}
          className={`bg-white border-2 border-slate-200 hover:border-orange-500 rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-all relative overflow-hidden ${loadingModule ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Utensils size={32} className="text-orange-600 mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Restaurante POS</h3>
          <p className="text-sm text-slate-500 mt-2">Punto de venta, comandas de cocina e inventario.</p>
        </div>
      </div>

      {/* Modal Flotante de Error / Límite en Step 1 */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center"
            >
              {error === 'limit_reached' ? (
                <>
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-amber-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Límite Alcanzado</h3>
                  <p className="text-slate-500 mb-6">Tu plan actual no te permite crear más negocios de este tipo. Adquiere cupo extra o mejora tu plan para continuar.</p>
                  
                  <div className="flex flex-col gap-3 w-full">
                    <button 
                      onClick={() => { setError(''); navigate('/billing'); }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg"
                    >
                      Ir a Facturación
                    </button>
                    <button 
                      onClick={() => setError('')}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                      Volver al inicio
                    </button>
                  </div>
                </>
              ) : error === 'subscription_required' ? (
                <>
                   <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Suscripción Requerida</h3>
                  <p className="text-slate-500 mb-6">Para crear este tipo de negocio, necesitas tener una suscripción activa para este módulo.</p>
                  
                  <div className="flex flex-col gap-3 w-full">
                    <button 
                      onClick={() => { setError(''); navigate(`/upgrade?module=${formData.tipo_modulo}`); }}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg"
                    >
                      Ver Planes
                    </button>
                    <button 
                      onClick={() => setError('')}
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                    >
                      Volver al inicio
                    </button>
                  </div>
                </>
              ) : (
                <>
                   <h3 className="text-xl font-bold text-slate-900 mb-2">Error</h3>
                   <p className="text-slate-500 mb-6">{error}</p>
                   <button onClick={() => setError('')} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">Cerrar</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderStep3 = () => {
    const moduleMeta: Record<string, { icon: any; color: string; label: string; placeholder: string }> = {
      hotel:      { icon: Building2, color: 'text-indigo-600', label: 'Hotel / Alojamiento', placeholder: 'Ej. Hotel Gran Vista' },
      gym:        { icon: Dumbbell,  color: 'text-blue-600',   label: 'Gimnasio',            placeholder: 'Ej. FitHub Centro' },
      restaurant: { icon: Utensils,  color: 'text-orange-600', label: 'Restaurante / Bar',   placeholder: 'Ej. La Mesa Bistró' },
    };
    const meta = moduleMeta[formData.tipo_modulo] ?? moduleMeta.hotel;
    const ModIcon = meta.icon;

    return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="max-w-xl mx-auto space-y-6">
      <button onClick={() => setStep(1)} className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-2 transition-colors">
        <ArrowLeft size={16} className="mr-1" /> Volver a módulos
      </button>

      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ModIcon className={meta.color} /> Información del {meta.label}</h2>
        <p className="text-slate-500 mt-1">Ingresa los detalles principales de tu negocio. Podrás editarlos después.</p>
        
        {error && error !== 'limit_reached' && error !== 'subscription_required' && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre Comercial</label>
          <input required type="text" value={formData.nombre_hotel} onChange={(e) => setFormData({...formData, nombre_hotel: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder={meta.placeholder} />
        </div>
        
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Ciudad</label>
            <input required type="text" value={formData.ciudad} onChange={(e) => setFormData({...formData, ciudad: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="Ej. Madrid" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Teléfono</label>
            <input required type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="+34 123 456 789" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Dirección Exacta</label>
          <input required type="text" value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="Calle Principal 123, Zona Centro" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Correo de Contacto Público</label>
          <input required type="email" value={formData.correo_contacto} onChange={(e) => setFormData({...formData, correo_contacto: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none" placeholder="reservas@hotelgranvista.com" />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input 
            type="checkbox" 
            id="terms" 
            required 
            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
          />
          <label htmlFor="terms" className="text-sm text-slate-600">
            Acepto los <a href="#" className="text-indigo-600 hover:underline">Términos y Condiciones</a> y la Política de Privacidad de Solaris.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Dar de Alta Negocio'}
        </button>
      </form>
    </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans relative">
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-8 px-6 pt-12">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Building2 className="text-indigo-600" /> Solaris Hub
        </h1>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {step === 1 && renderStep1()}
          {step === 3 && renderStep3()}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center flex flex-col items-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="bg-emerald-50 p-4 rounded-full mb-6"
              >
                <CheckCircle className="w-16 h-16 text-emerald-500" strokeWidth={2.5} />
              </motion.div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">¡{formData.nombre_hotel || 'Negocio'} Registrado!</h3>
              <p className="text-slate-500 mb-8">Tu entorno ha sido aprovisionado exitosamente en nuestros servidores.</p>
              
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200"
              >
                Ir al Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
