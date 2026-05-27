import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, CheckCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export const SetupOwner = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const [form, setForm] = useState({
    nombre_empresa: '',
    email_contacto: '',
    telefono_contacto: '',
  });

  useEffect(() => {
    if (session?.user?.email) {
      setForm((prev) => ({ ...prev, email_contacto: session.user.email || '' }));
    }
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.nombre_empresa.trim() || !form.email_contacto.trim()) {
      setError('El nombre de empresa y el correo son obligatorios.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/hub/owner', {
        nombre_empresa: form.nombre_empresa.trim(),
        email_contacto: form.email_contacto.trim().toLowerCase(),
        telefono_contacto: form.telefono_contacto.trim() || null,
      });
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear el perfil de propietario. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center px-4 font-sans">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center gap-4"
          >
            <div className="bg-emerald-500/20 p-6 rounded-full">
              <CheckCircle className="w-16 h-16 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">¡Perfil creado exitosamente!</h2>
            <p className="text-slate-400">Redirigiendo al Dashboard…</p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md"
          >
            {/* Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8">
              {/* Brand */}
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-indigo-600 p-2.5 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Solaris
                </span>
              </div>

              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Configura tu perfil</h1>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Es tu primera vez aquí. Completa los datos de tu empresa para continuar.
                  Este perfil vinculará todos tus hoteles y negocios.
                </p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl mb-6"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nombre de la Empresa <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      name="nombre_empresa"
                      value={form.nombre_empresa}
                      onChange={handleChange}
                      required
                      placeholder="Ej. Inversiones Verona S.A."
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Correo de Contacto <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email_contacto"
                    value={form.email_contacto}
                    onChange={handleChange}
                    required
                    placeholder="admin@tuempresa.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Teléfono de Contacto <span className="text-slate-500 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="tel"
                    name="telefono_contacto"
                    value={form.telefono_contacto}
                    onChange={handleChange}
                    placeholder="+504 9999-9999"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.01 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2 text-sm mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando perfil…
                    </>
                  ) : (
                    'Crear mi perfil y continuar →'
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
