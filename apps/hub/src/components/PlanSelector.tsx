import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Zap } from 'lucide-react';

const plans = [
  {
    id: 'basico',
    name: 'Básico',
    description: 'Perfecto para empezar a gestionar un solo local.',
    priceMonthly: 'Gratis',
    priceAnnual: 'Gratis',
    icon: <Star className="w-6 h-6 text-slate-400" />,
    features: ['1 Negocio Activo', 'Funciones operativas base', 'Dashboard consolidado', '14 días de prueba Estándar'],
    popular: false,
  },
  {
    id: 'estandar',
    name: 'Estándar',
    description: 'Para negocios en crecimiento que necesitan más control.',
    priceMonthly: '$49/mes',
    priceAnnual: '$490/año',
    icon: <Zap className="w-6 h-6 text-indigo-500" />,
    features: ['Hasta 2 Negocios', 'Asistente IA (Consultas)', 'Soporte Multi-moneda', 'Chat Operativo'],
    popular: true, // Este resaltará
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Control total con inteligencia artificial avanzada.',
    priceMonthly: '$99/mes',
    priceAnnual: '$990/año',
    icon: <Star className="w-6 h-6 text-amber-500" fill="currentColor" />,
    features: ['Hasta 5 Negocios', 'Asistente IA (Acceso Total)', 'Auditoría Cruzada', 'Soporte Prioritario 24/7'],
    popular: false,
  },
];

// Animaciones de Framer Motion
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 } // Aparecen una por una
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
};

export default function PlanSelector({ onSelectPlan }: { onSelectPlan: (planId: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelectPlan(isAnnual && id !== 'basico' ? `${id}_anual` : id);
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* Toggle Mensual/Anual */}
      <div className="flex items-center justify-center gap-4 mt-4 mb-8 bg-slate-100 p-1.5 rounded-full">
        <button
          onClick={() => setIsAnnual(false)}
          className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
            !isAnnual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Mensual
        </button>
        <button
          onClick={() => setIsAnnual(true)}
          className={`px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
            isAnnual ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Anual <span className="ml-1 text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">-15%</span>
        </button>
      </div>

      <motion.div 
        variants={containerVariants} 
        initial="hidden" 
        animate="show" 
        className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mx-auto"
      >
        {plans.map((plan) => {
          const isSelected = selectedId === plan.id;

        return (
          <motion.div
            key={plan.id}
            variants={cardVariants}
            whileHover={{ y: -8, scale: 1.02 }} // Efecto de elevación al pasar el mouse
            whileTap={{ scale: 0.98 }}         // Efecto de presión al hacer clic
            onClick={() => handleSelect(plan.id)}
            className={`relative p-8 rounded-3xl cursor-pointer transition-all duration-300 border-2 bg-white
              ${isSelected 
                ? 'border-indigo-500 shadow-indigo-100 shadow-2xl' 
                : 'border-slate-100 shadow-sm hover:shadow-xl hover:border-slate-200'
              }
            `}
          >
            {/* Etiqueta de "Más Popular" */}
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                MÁS POPULAR
              </div>
            )}

            {/* Checkmark animado si está seleccionado */}
            {isSelected && (
              <motion.div 
                initial={{ scale: 0, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className="absolute top-6 right-6 bg-indigo-500 rounded-full p-1"
              >
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </motion.div>
            )}

            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 rounded-2xl ${isSelected ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                {plan.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
            </div>

            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">{plan.description}</p>
            
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-slate-900">
                {isAnnual ? plan.priceAnnual : plan.priceMonthly}
              </span>
            </div>

            <ul className="space-y-4">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className={`w-5 h-5 shrink-0 ${isSelected ? 'text-indigo-500' : 'text-slate-300'}`} />
                  <span className={`text-sm ${isSelected ? 'text-slate-700 font-medium' : 'text-slate-600'}`}>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            {/* Borde sutil inferior si es el popular */}
            {plan.popular && !isSelected && (
               <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-b-3xl opacity-20" />
            )}
          </motion.div>
        );
      })}
    </motion.div>
    </div>
  );
}
