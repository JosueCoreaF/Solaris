import React from 'react';
import { ClipboardList } from 'lucide-react';

export const Housekeeping: React.FC = () => {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mb-12">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">OPERATIVOS</p>
        <h1 className="text-4xl font-light text-gray-900 flex items-center gap-3">
          <ClipboardList size={36} className="text-gray-400" />
          Limpieza
        </h1>
        <p className="text-gray-500 text-sm mt-2">Gestiona el estado de limpieza de habitaciones</p>
      </div>

      <div className="bg-gray-50 rounded-lg border border-gray-100 p-12 text-center">
        <p className="text-gray-500">Módulo de Limpieza en desarrollo...</p>
      </div>
    </div>
  );
};
