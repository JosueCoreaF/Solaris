import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, Users, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { obtenerEstadisticas } from '../../api/reportesService';

interface ReportData {
  ocupacionPromedio: number;
  totalReservas: number;
  totalIngresos: number;
  tasaOcupacion: number[];
  ingresoPorDia: { dia: string; ingreso: number }[];
  reservasPorEstado: { estado: string; cantidad: number }[];
}

const SimpleLineChart: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#3b82f6' }) => {
  const max = Math.max(...data, 100);
  const width = 400;
  const height = 150;
  const points = data.map((val, i) => {
    const x = (width / (data.length - 1)) * i;
    const y = height - (val / max) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
      {data.map((val, i) => {
        const x = (width / (data.length - 1)) * i;
        const y = height - (val / max) * height;
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
};

const SimpleBarChart: React.FC<{ data: { label: string; value: number }[]; color?: string }> = ({ data, color = '#3b82f6' }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const width = 400;
  const height = 200;
  const barWidth = width / data.length - 10;
  
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full">
      {data.map((item, i) => {
        const x = i * (barWidth + 10) + 5;
        const barHeight = (item.value / max) * (height - 40);
        const y = height - barHeight - 20;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} opacity="0.7" />
            <text x={x + barWidth / 2} y={height - 5} textAnchor="middle" fontSize="11" fill="#64748b">
              {item.label}
            </text>
            <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#1e293b" fontWeight="600">
              {item.value}%
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const Reportes: React.FC = () => {
  const [data, setData] = useState<ReportData>({
    ocupacionPromedio: 0,
    totalReservas: 0,
    totalIngresos: 0,
    tasaOcupacion: [],
    ingresoPorDia: [],
    reservasPorEstado: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState('mes');

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        setLoading(true);
        setError(null);
        const stats = await obtenerEstadisticas(periodo);
        setData(stats);
      } catch (err: any) {
        console.error('Error cargando reportes:', err);
        setError(err?.message || 'Error al cargar los reportes');
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [periodo]);

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block text-gray-400">
          <div className="animate-pulse">Cargando reportes...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-start">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">REPORTES</p>
          <h1 className="text-3xl font-light text-gray-900 flex items-center gap-3">
            <BarChart3 size={36} className="text-blue-500" />
            Análisis e Informes
          </h1>
          <p className="text-gray-500 text-sm mt-2">Métricas de ocupación, ingresos y reservaciones</p>
        </div>
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Download size={16} /> Exportar PDF
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-100">
          <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Ocupación Promedio</p>
          <p className="text-3xl font-light text-blue-900">{data.ocupacionPromedio}%</p>
          <p className="text-xs text-blue-600 mt-2">↑ 5% vs semana anterior</p>
        </div>

        <div className="bg-green-50 rounded-lg p-6 border border-green-100">
          <p className="text-xs font-semibold text-green-600 uppercase mb-2">Total Reservas</p>
          <p className="text-3xl font-light text-green-900">{data.totalReservas}</p>
          <p className="text-xs text-green-600 mt-2">En el período</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-6 border border-purple-100">
          <p className="text-xs font-semibold text-purple-600 uppercase mb-2">Ingresos Período</p>
          <p className="text-3xl font-light text-purple-900">L {data.totalIngresos.toLocaleString()}</p>
          <p className="text-xs text-purple-600 mt-2">Total generado</p>
        </div>

        <div className="bg-orange-50 rounded-lg p-6 border border-orange-100">
          <p className="text-xs font-semibold text-orange-600 uppercase mb-2">Promedio/Noche</p>
          <p className="text-3xl font-light text-orange-900">L {Math.round(data.totalIngresos / 30).toLocaleString()}</p>
          <p className="text-xs text-orange-600 mt-2">Ingreso diario</p>
        </div>
      </div>

      {/* Filtro período */}
      <div className="flex gap-3 mb-8">
        {['semana', 'mes', 'trimestre', 'año'].map(p => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            style={{
              padding: '8px 16px',
              border: periodo === p ? 'none' : '1px solid #e2e8f0',
              background: periodo === p ? '#1e293b' : '#fff',
              color: periodo === p ? '#fff' : '#64748b',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ocupación */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-light text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" />
            Tendencia de Ocupación
          </h3>
          <SimpleLineChart data={data.tasaOcupacion} color="#3b82f6" />
        </div>

        {/* Ingresos por día */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-light text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-green-500" />
            Ingresos Diarios
          </h3>
          <div className="space-y-3">
            {data.ingresoPorDia.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{item.dia}</span>
                <div className="flex-1 mx-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${(item.ingreso / 3500) * 100}%`,
                      height: '100%',
                      background: '#10b981',
                    }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-900">L {item.ingreso}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Ocupación por rango */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-light text-gray-900 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-purple-500" />
            Tasa de Ocupación por Día
          </h3>
          <SimpleBarChart
            data={data.tasaOcupacion.map((val, i) => ({ label: `D${i + 1}`, value: val }))}
            color="#8b5cf6"
          />
        </div>

        {/* Estado reservas */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-light text-gray-900 mb-4 flex items-center gap-2">
            <Users size={20} className="text-orange-500" />
            Reservas por Estado
          </h3>
          <div className="space-y-4">
            {data.reservasPorEstado.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-600">{item.estado}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.cantidad}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${(item.cantidad / 30) * 100}%`,
                      height: '100%',
                      background: i === 0 ? '#10b981' : i === 1 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-sm text-blue-900">
          <strong>📊 Nota:</strong> Los datos se actualizan cada hora. Para análisis más detallados, contacta al equipo de administración.
        </p>
      </div>
    </div>
  );
};
