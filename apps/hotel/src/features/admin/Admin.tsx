import React from 'react';
import { Settings } from 'lucide-react';

export const Admin: React.FC = () => {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mb-12">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">ADMINISTRACIÓN</p>
        <h1 className="text-4xl font-light text-gray-900 flex items-center gap-3">
          <Settings size={36} className="text-gray-400" />
          Configuración
        </h1>
        <p className="text-gray-500 text-sm mt-2">Gestiona configuración del sistema y auditoría</p>
      </div>

      <div className="bg-gray-50 rounded-lg border border-gray-100 p-12 text-center">
        <p className="text-gray-500">Módulo de Administración en desarrollo...</p>
      </div>
    </div>
  );
};
