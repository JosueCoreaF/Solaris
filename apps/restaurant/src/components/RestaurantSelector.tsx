import React from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Building2, LogOut } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Pantalla de selección de restaurante activo.
 * Se muestra cuando el usuario tiene más de un módulo tipo `restaurant`.
 */
export const RestaurantSelector: React.FC = () => {
  const { modules, modulesLoading, selectModule } = useRestaurant();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      {/* Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mx-auto mb-4">
            <ChefHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Selecciona tu restaurante</h1>
          <p className="text-slate-400 text-sm mt-1">Tienes acceso a múltiples restaurantes</p>
        </div>

        {/* Lista de módulos */}
        {modulesLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((mod, i) => (
              <motion.button
                key={mod.id_module}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => selectModule(mod)}
                className="w-full flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-orange-500/50 hover:bg-orange-500/5 rounded-2xl p-4 text-left transition-all duration-200 group"
              >
                <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/20 transition-colors">
                  <Building2 className="w-5 h-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {mod.nombre ?? `Restaurante ${i + 1}`}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5 font-mono truncate">
                    {mod.id_module}
                  </p>
                </div>
                <div className="text-slate-600 group-hover:text-orange-400 transition-colors">›</div>
              </motion.button>
            ))}
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 mx-auto mt-8 text-slate-500 hover:text-red-400 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" /> Cerrar sesión
        </button>
      </motion.div>
    </div>
  );
};
