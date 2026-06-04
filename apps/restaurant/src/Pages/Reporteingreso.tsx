// src/Pages/Reporteingreso.tsx
import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Plus, Search, ArrowUp, ArrowDown } from 'lucide-react';

interface Ingreso {
  id: string;
  monto: number;
  categoria: string;
  descripcion: string;
  fecha: string;
  metodo_pago: string;
}

const Reporteingreso = () => {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todos'); // 'todos', 'semana', 'mes'
  
  // Calcular totales
  const totalIngresos = ingresos.reduce((sum, ing) => sum + ing.monto, 0);
  const promedioIngreso = ingresos.length > 0 ? totalIngresos / ingresos.length : 0;
  const mayorIngreso = ingresos.length > 0 ? Math.max(...ingresos.map(i => i.monto)) : 0;

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header - Estilo tomado de tu Dashboard */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          REPORTE FINANCIERO
        </p>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-light text-gray-900 mb-1">Ingresos</h1>
            <p className="text-sm text-gray-500">Registro de todas las transacciones</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm">
            <Plus size={16} />
            Nuevo Ingreso
          </button>
        </div>
      </div>

      
      <div className="mb-6">
        <div className="flex gap-2">
          {['todos', 'semana', 'mes'].map((opcion) => (
            <button
              key={opcion}
              onClick={() => setFiltro(opcion)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                filtro === opcion
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opcion === 'todos' ? 'Todos' : opcion === 'semana' ? 'Última semana' : 'Último mes'}
            </button>
          ))}
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-100 hover:border-gray-200 transition-all">
          <p className="text-xs font-semibold text-gray-400 mb-3">INGRESOS TOTALES</p>
          <p className="text-3xl font-light text-gray-900 mb-2">
            L. {totalIngresos.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">{ingresos.length} transacciones</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-100 hover:border-gray-200 transition-all">
          <p className="text-xs font-semibold text-gray-400 mb-3">PROMEDIO POR INGRESO</p>
          <p className="text-3xl font-light text-gray-900 mb-2">
            L. {promedioIngreso.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">Valor promedio</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-100 hover:border-gray-200 transition-all">
          <p className="text-xs font-semibold text-gray-400 mb-3">INGRESO MÁS ALTO</p>
          <p className="text-3xl font-light text-gray-900 mb-2">
            L. {mayorIngreso.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500">Transacción máxima</p>
        </div>
      </div>

      {/* Tabla de ingresos - Estilo limpio de tu dashboard */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-light text-gray-900">Registro de ingresos</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-300"
            />
          </div>
        </div>
        
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Método</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Monto</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {ingresos.map((ingreso) => (
                <tr key={ingreso.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(ingreso.fecha).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {ingreso.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {ingreso.descripcion || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {ingreso.metodo_pago || 'Efectivo'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    L. {ingreso.monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {ingresos.length === 0 && (
            <div className="text-center py-12">
              <DollarSign size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No hay ingresos registrados</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Card - Estilo tomado de tu tip card */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 Resumen</h4>
        <p className="text-xs text-blue-700 leading-relaxed">
          Total de ingresos: L. {totalIngresos.toLocaleString('es-HN')} • 
          Promedio diario: L. {(totalIngresos / 30).toLocaleString('es-HN', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
};

export default Reporteingreso;