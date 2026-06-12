import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Dumbbell,
  Utensils,
  Loader2,
  CheckCircle,
  Sparkles,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import apiClient from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Configuración por módulo ───────────────────────────────────────────────

const MODULES = [
  {
    tipo: 'hotel',
    label: 'Sistema Hotelero',
    description: 'Reservas, habitaciones, limpieza y facturación.',
    icon: Building2,
    color: 'indigo',
    iconBg: 'bg-indigo-500/20',
    iconText: 'text-indigo-400',
    border: 'border-indigo-500/50',
    glow: 'shadow-indigo-900/40',
    placeholder: 'Ej. Hotel Gran Vista',
  },
  {
    tipo: 'gym',
    label: 'Gimnasio FitHub',
    description: 'Membresías, accesos y control de entrenadores.',
    icon: Dumbbell,
    color: 'blue',
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    border: 'border-blue-500/50',
    glow: 'shadow-blue-900/40',
    placeholder: 'Ej. FitZone Gym',
  },
  {
    tipo: 'restaurant',
    label: 'Restaurante POS',
    description: 'Punto de venta, comandas de cocina e inventario.',
    icon: Utensils,
    color: 'orange',
    iconBg: 'bg-orange-500/20',
    iconText: 'text-orange-400',
    border: 'border-orange-500/50',
    glow: 'shadow-orange-900/40',
    placeholder: 'Ej. La Terraza Restaurant',
  },
];

const MONEDAS = [
  { code: 'USD', label: 'USD — Dólar Americano' },
  { code: 'HNL', label: 'HNL — Lempira Hondureño' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'MXN', label: 'MXN — Peso Mexicano' },
  { code: 'GTQ', label: 'GTQ — Quetzal Guatemalteco' },
  { code: 'CRC', label: 'CRC — Colón Costarricense' },
  { code: 'NIO', label: 'NIO — Córdoba Nicaragüense' },
];

const STEP_LABELS = ['Bienvenida', 'Tipo de negocio', 'Datos', '¡Listo!'];

// ─── Variantes de animación ─────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

const transition = { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

// ─── Componente principal ───────────────────────────────────────────────────

export const Onboarding = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [createdName, setCreatedName] = useState('');

  const [selectedTipo, setSelectedTipo] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    ciudad: '',
    telefono: '',
    correo_contacto: session?.user?.email || '',
    moneda: 'USD',
  });

  const selectedModule = MODULES.find(m => m.tipo === selectedTipo);

  const goTo = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectModule = (tipo: string) => {
    setSelectedTipo(tipo);
    goTo(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (session?.user?.id) {
      localStorage.setItem(`moneda_${session.user.id}`, form.moneda);
    }

    try {
      await apiClient.post('/hub/businesses', {
        tipo_modulo: selectedTipo,
        nombre_modulo: form.nombre.trim(),
        ciudad: form.ciudad.trim(),
        telefono: form.telefono.trim() || null,
        correo_contacto: form.correo_contacto.trim() || null,
      });
      setCreatedName(form.nombre.trim());
      setSubscriptionRequired(false);
      goTo(3);
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 403) {
        setCreatedName(form.nombre.trim());
        setSubscriptionRequired(true);
        goTo(3);
      } else {
        setError(data?.error || data?.message || 'Error al crear el negocio. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Botón de color según módulo seleccionado ──
  const btnClass = selectedModule
    ? {
        indigo: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40',
        blue:   'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40',
        orange: 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/40',
      }[selectedModule.color] ?? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40'
    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center px-4 font-sans">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg z-10">

        {/* ── Indicador de pasos ── */}
        {step < 3 && (
          <div className="flex items-center justify-center gap-1.5 mb-8">
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1.5 transition-opacity ${i <= step ? 'opacity-100' : 'opacity-25'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-400'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-xs font-medium hidden sm:inline ${i === step ? 'text-white' : 'text-slate-500'}`}>
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-8 transition-colors ${i < step ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait" custom={dir}>

          {/* ══ PASO 0: Bienvenida ══════════════════════════════════════════ */}
          {step === 0 && (
            <motion.div
              key="welcome"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-600 p-2.5 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Solaris
                </span>
              </div>

              <h1 className="text-3xl font-bold text-white mb-3">¡Bienvenido a Solaris!</h1>
              <p className="text-slate-400 leading-relaxed mb-8">
                Tu cuenta está lista. Configura tu primer negocio en minutos y comienza
                a gestionar todo desde un solo panel.
              </p>

              <div className="space-y-2.5 mb-8">
                {[
                  { icon: Building2, text: 'Elige el tipo de negocio que deseas registrar' },
                  { icon: MapPin,    text: 'Ingresa los datos básicos del establecimiento' },
                  { icon: Sparkles,  text: 'Accede al panel de gestión completo' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-sm text-slate-300 flex-1">{text}</span>
                    <span className="text-indigo-400 text-xs font-bold bg-indigo-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>

              <motion.button
                onClick={() => goTo(1)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 text-sm"
              >
                Comenzar configuración <ArrowRight className="w-4 h-4" />
              </motion.button>
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full mt-3 py-2.5 text-slate-600 hover:text-slate-400 text-sm font-medium transition-colors"
              >
                Omitir por ahora
              </button>
            </motion.div>
          )}

          {/* ══ PASO 1: Selección de módulo ══════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="module-select"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">¿Qué tipo de negocio?</h2>
                <p className="text-slate-400 text-sm">Selecciona el módulo que vas a configurar primero.</p>
              </div>

              <div className="space-y-3 mb-6">
                {MODULES.map(mod => {
                  const Icon = mod.icon;
                  return (
                    <motion.button
                      key={mod.tipo}
                      onClick={() => handleSelectModule(mod.tipo)}
                      whileHover={{ scale: 1.01, x: 4 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:${mod.border} rounded-2xl transition-all text-left group`}
                    >
                      <div className={`w-12 h-12 ${mod.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
                        <Icon className={`w-6 h-6 ${mod.iconText}`} />
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">{mod.label}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{mod.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                    </motion.button>
                  );
                })}
              </div>

              <button
                onClick={() => goTo(0)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-xl text-sm font-medium transition-colors border border-white/10"
              >
                Atrás
              </button>
            </motion.div>
          )}

          {/* ══ PASO 2: Formulario del negocio ══════════════════════════════ */}
          {step === 2 && selectedModule && (
            <motion.div
              key="business-form"
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transition}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8"
            >
              <div className="mb-6">
                <div className={`w-12 h-12 ${selectedModule.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
                  <selectedModule.icon className={`w-6 h-6 ${selectedModule.iconText}`} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{selectedModule.label}</h2>
                <p className="text-slate-400 text-sm">Datos básicos del establecimiento. Podrás editarlos después.</p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nombre del negocio */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nombre del negocio <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <selectedModule.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      required
                      placeholder={selectedModule.placeholder}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Ciudad */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Ciudad <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      name="ciudad"
                      value={form.ciudad}
                      onChange={handleChange}
                      required
                      placeholder="Ej. Tegucigalpa"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Teléfono + Moneda */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Teléfono <span className="text-slate-600 text-xs font-normal">(opc.)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        name="telefono"
                        value={form.telefono}
                        onChange={handleChange}
                        placeholder="+504 9999-9999"
                        className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Moneda</label>
                    <select
                      name="moneda"
                      value={form.moneda}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                    >
                      {MONEDAS.map(m => (
                        <option key={m.code} value={m.code} className="bg-slate-800">{m.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Correo */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Correo de contacto <span className="text-slate-600 text-xs font-normal">(opc.)</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      name="correo_contacto"
                      value={form.correo_contacto}
                      onChange={handleChange}
                      placeholder="contacto@minegocio.com"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => goTo(1)}
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-sm font-medium transition-colors border border-white/10"
                  >
                    Atrás
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className={`flex-1 py-3 ${btnClass} disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 text-sm`}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                    ) : (
                      <>Crear negocio <ArrowRight className="w-4 h-4" /></>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ══ PASO 3: Resultado ══════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, type: 'spring', damping: 20 }}
              className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', damping: 14 }}
                className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6
                  ${subscriptionRequired ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}
              >
                <CheckCircle className={`w-10 h-10 ${subscriptionRequired ? 'text-amber-400' : 'text-emerald-400'}`} />
              </motion.div>

              {subscriptionRequired ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-3">¡Cuenta configurada!</h2>
                  <p className="text-slate-400 leading-relaxed mb-2">
                    Para activar <span className="text-white font-semibold">"{createdName}"</span> necesitas un plan activo.
                  </p>
                  <p className="text-slate-500 text-sm mb-8">
                    Activa tu suscripción desde Facturación o contacta a soporte.
                  </p>
                  <motion.button
                    onClick={() => navigate('/billing', { replace: true })}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 text-sm mb-3"
                  >
                    Ver planes de suscripción <ArrowRight className="w-4 h-4" />
                  </motion.button>
                  <button
                    onClick={() => navigate('/dashboard', { replace: true })}
                    className="w-full py-2.5 text-slate-600 hover:text-slate-400 text-sm font-medium transition-colors"
                  >
                    Ir al Dashboard
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-3">¡Todo listo!</h2>
                  <p className="text-slate-400 leading-relaxed mb-2">
                    <span className="text-white font-semibold">"{createdName}"</span> fue creado exitosamente en Solaris.
                  </p>
                  <p className="text-slate-500 text-sm mb-6">
                    Ya puedes acceder al panel de gestión desde tu Dashboard.
                  </p>

                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-8 text-left space-y-2.5">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-3">Próximos pasos</p>
                    {selectedModule?.tipo === 'hotel' && [
                      'Añadir tipos de habitaciones',
                      'Configurar tarifas y temporadas',
                      'Invitar a tu equipo de trabajo',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="text-indigo-400 text-xs font-bold bg-indigo-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                        {item}
                      </div>
                    ))}
                    {selectedModule?.tipo === 'gym' && [
                      'Crear planes de membresía',
                      'Registrar tus entrenadores',
                      'Configurar horarios de acceso',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="text-blue-400 text-xs font-bold bg-blue-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                        {item}
                      </div>
                    ))}
                    {selectedModule?.tipo === 'restaurant' && [
                      'Crear el menú y categorías',
                      'Configurar mesas y áreas',
                      'Añadir a tu equipo de cocina',
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="text-orange-400 text-xs font-bold bg-orange-500/10 w-5 h-5 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                        {item}
                      </div>
                    ))}
                  </div>

                  <motion.button
                    onClick={() => navigate('/dashboard', { replace: true })}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3.5 ${btnClass} text-white font-semibold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 text-sm`}
                  >
                    Ir al Dashboard <ArrowRight className="w-4 h-4" />
                  </motion.button>

                  <button
                    onClick={() => {
                      setSelectedTipo(null);
                      setForm(prev => ({ ...prev, nombre: '', ciudad: '', telefono: '' }));
                      setError('');
                      goTo(1);
                    }}
                    className="w-full mt-3 py-2.5 text-slate-600 hover:text-slate-400 text-sm font-medium transition-colors"
                  >
                    Agregar otro negocio
                  </button>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};
