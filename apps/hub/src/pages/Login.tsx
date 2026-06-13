import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { LogIn, UserPlus, Loader2, Eye, EyeOff, Sparkles, Building2, Mail, Lock, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'login' | 'register';

export const Login = () => {
  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register
  const [regNombre, setRegNombre] = useState('');
  const [regEmpresa, setRegEmpresa] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPassword,
    });
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message
      );
    }
    // Si no hay error, AuthContext detecta la sesión y redirige automáticamente
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (regPassword !== regPasswordConfirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (regPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!regNombre.trim() || !regEmpresa.trim()) {
      setError('El nombre y el nombre de empresa son obligatorios.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: regEmail.trim().toLowerCase(),
      password: regPassword,
      options: {
        data: {
          full_name:       regNombre.trim(),
          nombre_empresa:  regEmpresa.trim(),
          tipo_registro:   'propietario',
        },
      },
    });

    if (error) {
      setError(
        error.message.includes('already registered')
          ? 'Ya existe una cuenta con ese correo. Inicia sesión.'
          : error.message
      );
      setLoading(false);
      return;
    }

    // Si no requiere confirmación de email, la sesión se activa y AuthContext redirige
    // Si requiere confirmación, mostramos mensaje y llevamos al usuario al login
    if (data.user && !data.session) {
      const email = regEmail.trim().toLowerCase();
      setSuccess(`¡Cuenta creada con éxito! Te enviamos un correo de confirmación a ${email}. Ábrelo y confirma tu cuenta, luego inicia sesión aquí.`);
      setTab('login');
      setLoginEmail(email);
      setRegNombre('');
      setRegEmpresa('');
      setRegEmail('');
      setRegPassword('');
      setRegPasswordConfirm('');
    }
    setLoading(false);
  };

  const tabVariants = {
    hidden: { opacity: 0, x: tab === 'login' ? -20 : 20 },
    show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: tab === 'login' ? 20 : -20, transition: { duration: 0.2 } },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-indigo-700/15 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-purple-700/15 rounded-full blur-3xl" />
        <div className="absolute top-3/4 left-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-2xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white tracking-tight">Solaris</span>
                <span className="text-xs text-indigo-400 block -mt-0.5 font-medium">Hub de Propietarios</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              {(['login', 'register'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); clearMessages(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tab === t
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
                  {t === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
                </button>
              ))}
            </div>
          </div>

          {/* Form Area */}
          <div className="px-8 pb-8">

            {/* Error / Success banners */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-5"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  key="ok"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm px-4 py-3 rounded-xl mb-5"
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {/* ── LOGIN ── */}
              {tab === 'login' && (
                <motion.form
                  key="login"
                  variants={tabVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="tu@empresa.com"
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type={showPass ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-11 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      />
                      <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 text-sm mt-2"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando sesión…</> : <><LogIn size={16} /> Entrar al Hub</>}
                  </motion.button>

                  <p className="text-center text-xs text-slate-500 pt-2">
                    ¿No tienes cuenta?{' '}
                    <button type="button" onClick={() => { setTab('register'); clearMessages(); }} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                      Regístrate aquí
                    </button>
                  </p>
                </motion.form>
              )}

              {/* ── REGISTER ── */}
              {tab === 'register' && (
                <motion.form
                  key="register"
                  variants={tabVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={regNombre}
                        onChange={e => setRegNombre(e.target.value)}
                        placeholder="Juan Pérez"
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Nombre de la Empresa</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={regEmpresa}
                        onChange={e => setRegEmpresa(e.target.value)}
                        placeholder="Ej. Inversiones Verona S.A."
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Correo electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="tu@empresa.com"
                        className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type={showPass ? 'text' : 'password'}
                          required
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Min. 8 caracteres"
                          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type={showPassConfirm ? 'text' : 'password'}
                          required
                          value={regPasswordConfirm}
                          onChange={e => setRegPasswordConfirm(e.target.value)}
                          placeholder="Repetir"
                          className="w-full pl-10 pr-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                        />
                        <button type="button" onClick={() => setShowPassConfirm(p => !p)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                          {showPassConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01 }}
                    whileTap={{ scale: loading ? 1 : 0.98 }}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 text-sm mt-2"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando cuenta…</> : <><UserPlus size={16} /> Crear mi cuenta</>}
                  </motion.button>

                  <p className="text-center text-xs text-slate-500 pt-2">
                    ¿Ya tienes cuenta?{' '}
                    <button type="button" onClick={() => { setTab('login'); clearMessages(); }} className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                      Inicia sesión
                    </button>
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          © 2025 Solaris · Plataforma de Gestión Hotelera
        </p>
      </motion.div>
    </div>
  );
};
