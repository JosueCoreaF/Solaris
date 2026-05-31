import React, { useState, useEffect } from 'react';
import {
  Plus,
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { fetchReservas, fetchHabitaciones, fetchHoteles } from '../api/bookingsService';
import {
  obtenerKPIsDashboard,
  calcularTendenciasOcupacion,
  obtenerSolicitudesPendientes,
  type DashboardKPI,
  type TendenciaOcupacion,
} from '../api/dashboardService';
import type { Reserva } from '../api/bookingsService';

interface StatCard {
  label: string;
  value: string | number;
  subtext: string;
}

export const Dashboard: React.FC = () => {
  const { role } = useRole();
  const [kpis, setKpis] = useState<DashboardKPI>({
    ocupacion: 0,
    ingresosHoy: 0,
    reservasPendientes: 0,
    scoreClientes: 75,
    ingresosMes: 0,
    gastosMes: 0,
  });
  const [tendencias, setTendencias] = useState<TendenciaOcupacion[]>([]);
  const [usuariosPendientes, setUsuariosPendientes] = useState(0);
  const [hoteles, setHoteles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const activeHotelId = localStorage.getItem('active_hotel_id') || 'all';

  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        // Cargar hoteles
        const hotelesData = await fetchHoteles().catch(() => []);
        setHoteles(hotelesData);

        // Cargar KPIs reales
        const kpisData = await obtenerKPIsDashboard();
        setKpis(kpisData);

        // Cargar tendencias
        const tendenciasData = await calcularTendenciasOcupacion();
        setTendencias(tendenciasData);

        // Cargar usuarios pendientes si es PROPIETARIO
        if (role === 'PROPIETARIO') {
          const pendientes = await obtenerSolicitudesPendientes();
          setUsuariosPendientes(pendientes);
        }
      } catch (err) {
        console.error('Error cargando datos del dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [role]);

  // Vista Ejecutiva para PROPIETARIO
  if (role === 'PROPIETARIO') {
    const isTendenciasEmpty = tendencias.length === 0 || tendencias.every(item => item.ocupacion === 0);
    const tendenciasFinales = tendencias;

    // Alertas
    const alertas = [
      ...(usuariosPendientes > 0
        ? [
          {
            id: 'users',
            tipo: 'solicitud',
            titulo: 'Solicitudes de Aprobación',
            descripcion: `${usuariosPendientes} usuario(s) esperando aprobación`,
            icono: <Clock className="text-orange-500" size={20} />,
            color: 'orange',
          },
        ]
        : []),
      ...(kpis.reservasPendientes > 0
        ? [
          {
            id: 'reservas',
            tipo: 'info',
            titulo: 'Huéspedes Por Ingresar',
            descripcion: `${kpis.reservasPendientes} check-in en próximos 3 días`,
            icono: <Calendar className="text-blue-500" size={20} />,
            color: 'blue',
          },
        ]
        : []),
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        {/* Header Ejecutivo */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Panel Ejecutivo
          </p>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-5xl font-light text-slate-900 mb-2">Dirección Operativa</h1>
              <p className="text-sm text-slate-600">
                Resumen ejecutivo del hotel • {new Date().toLocaleDateString('es-HN')}
              </p>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-emerald-200 shadow-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-700">Sistema Activo</span>
            </div>
          </div>
        </div>

        {/* KPIs Principales (4 columnas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* KPI 1: Ocupación */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ocupación Actual
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.ocupacion}%</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp size={24} className="text-blue-600" />
              </div>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${kpis.ocupacion}%` }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-3">{kpis.ocupacion >= 75 ? '✓ Meta alcanzada' : '↑ Potencial de mejora'}</p>
          </div>

          {/* KPI 2: Ingresos Hoy */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Ingresos Hoy
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-2">
                  L. {kpis.ingresosHoy.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign size={24} className="text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-emerald-600 font-medium">
              {kpis.ingresosHoy > 0 ? '✓ Ingresos registrados' : 'Sin ingresos aún'}
            </p>
            <p className="text-xs text-slate-500 mt-2">Mes: L. {kpis.ingresosMes.toLocaleString('es-HN', { minimumFractionDigits: 2 })}</p>
          </div>

          {/* KPI 3: Reservas Pendientes */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Por Ingresar
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.reservasPendientes}</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Calendar size={24} className="text-amber-600" />
              </div>
            </div>
            <p className="text-xs text-amber-600 font-medium">Check-in próximos 3 días</p>
            <p className="text-xs text-slate-500 mt-2">
              {kpis.reservasPendientes === 0 ? 'Sin ingresos pendientes' : 'Requieren preparación'}
            </p>
          </div>

          {/* KPI 4: Score Satisfacción */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Score Operativo
                </p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.scoreClientes}%</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users size={24} className="text-purple-600" />
              </div>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-lg" style={{ color: i < Math.round(kpis.scoreClientes / 20) ? '#f59e0b' : '#d1d5db' }}>★</span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Basado en operaciones</p>
          </div>
        </div>

        {/* Alertas Críticas */}
        {alertas.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            {alertas.map((alerta) => (
              <div
                key={alerta.id}
                className={`bg-white rounded-xl p-5 border-l-4 border-${alerta.color}-500 shadow-sm hover:shadow-lg transition-shadow`}
              >
                <div className="flex gap-4">
                  <div className="mt-1">{alerta.icono}</div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{alerta.titulo}</h4>
                    <p className="text-sm text-slate-600 mt-1">{alerta.descripcion}</p>
                    {alerta.id === 'users' && (
                      <button className="text-xs font-medium text-${alerta.color}-600 hover:text-${alerta.color}-700 mt-3">
                        Revisar solicitudes →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gráfico de Tendencias + Financiero */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Ocupación 7 días */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <BarChart3 size={20} className="text-slate-600" />
              Ocupación Última Semana
            </h3>
            {isTendenciasEmpty ? (
              <div className="flex flex-col items-center justify-center h-40 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4">
                <BarChart3 className="text-slate-300 mb-2 animate-bounce" size={32} />
                <p className="text-sm font-semibold text-slate-700">Sin ocupación registrada esta semana</p>
                <p className="text-xs text-slate-400 mt-1 text-center">No hay reservaciones confirmadas o activas en los últimos 7 días.</p>
              </div>
            ) : (
              <div className="flex items-end justify-between h-40 gap-2">
                {tendenciasFinales.map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center flex-1">
                    <div className="w-full bg-slate-100 rounded-t-lg relative group hover:shadow-lg transition-all" style={{ height: `${(item.ocupacion / 100) * 140}px` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {item.ocupacion}%
                      </div>
                      <div
                        className="w-full h-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t-lg transition-all"
                        style={{ height: `100%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 font-medium">{item.dia}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumen Financiero */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <DollarSign size={20} className="text-slate-600" />
              Resumen Financiero Mes
            </h3>
            <div className="space-y-4">
              {[
                {
                  label: 'Ingresos',
                  valor: `L. ${kpis.ingresosMes.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`,
                  trend: 'up',
                  color: 'emerald',
                },
                {
                  label: 'Gastos',
                  valor: `L. ${kpis.gastosMes.toLocaleString('es-HN', { minimumFractionDigits: 2 })}`,
                  trend: 'down',
                  color: 'slate',
                },
                {
                  label: 'Neto',
                  valor: `L. ${(kpis.ingresosMes - kpis.gastosMes).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`,
                  trend: 'up',
                  color: 'blue',
                },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-2">
                    {item.trend === 'up' ? (
                      <ArrowUp size={16} className="text-emerald-600" />
                    ) : (
                      <ArrowDown size={16} className="text-slate-400" />
                    )}
                    <span className="font-semibold text-slate-900">{item.valor}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desglose por hotel si es consolidado */}
            {activeHotelId === 'all' && kpis.desglose && Object.keys(kpis.desglose).length > 0 && (
              <div className="mt-5 pt-5 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Desglose de Ingresos por Sede
                </h4>
                <div className="space-y-2">
                  {Object.entries(kpis.desglose).map(([hId, monto]) => {
                    const hotelName = hoteles.find((h) => h.id_hotel === hId)?.nombre_hotel || 'Hotel Verona';
                    return (
                      <div key={hId} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100 hover:shadow-sm transition-shadow">
                        <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          {hotelName}
                        </span>
                        <span className="text-xs font-semibold text-slate-900">
                          L. {monto.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6">Acciones Rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Plus size={24} />, label: 'Nueva Reserva', color: 'blue' },
              { icon: <Users size={24} />, label: 'Gestionar Roles', color: 'purple' },
              { icon: <BarChart3 size={24} />, label: 'Reportes', color: 'slate' },
              { icon: <Settings size={24} />, label: 'Configuración', color: 'gray' },
            ].map((action, idx) => (
              <button
                key={idx}
                className={`p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group text-center`}
              >
                <div className={`flex justify-center mb-3 text-${action.color}-600 group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <p className="text-xs font-medium text-slate-700">{action.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Vista estándar para otros roles
  const stats: StatCard[] = [
    {
      label: 'RESERVAS',
      value: '0',
      subtext: 'Registradas hoy',
    },
    {
      label: 'OCUPACIÓN',
      value: '0%',
      subtext: 'Promedio periodo',
    },
    {
      label: 'ASIGNACIONES',
      value: '0',
      subtext: 'Efectuadas',
    },
    {
      label: 'PRESUPUESTO',
      value: 'L.0.00',
      subtext: 'Estimado',
    },
  ];

  const quickAccess = [
    {
      icon: <Plus size={22} />,
      label: 'Nueva\nReserva',
      color: 'text-blue-600',
    },
    {
      icon: <Users size={22} />,
      label: 'Gestión\nHabitaciones',
      color: 'text-orange-600',
    },
    {
      icon: <DollarSign size={22} />,
      label: 'Corte\nCaja',
      color: 'text-amber-600',
    },
    {
      icon: <Settings size={22} />,
      label: 'Configuración',
      color: 'text-gray-600',
    },
  ];

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <div className="mb-12">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          HOTEL VERONA DIRECCIÓN
        </p>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-light text-gray-900 mb-1">Panel</h1>
            <p className="text-sm text-gray-500">Resumen operativo del hotel</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-gray-600">En línea</span>
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
        {stats.map((stat, idx) => (
          <div
            key={idx}
            className="bg-gray-50 rounded-lg p-6 border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200"
          >
            <p className="text-xs font-semibold text-gray-400 mb-3">{stat.label}</p>
            <p className="text-3xl font-light text-gray-900 mb-2">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Reservas por día */}
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-light text-gray-900">Reservas por día</h2>
                <p className="text-sm text-gray-500 mt-1">01 may - 31 may</p>
              </div>
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-600 hover:border-gray-300 transition-colors cursor-pointer">
                <option>Todos</option>
                <option>Esta semana</option>
                <option>Este mes</option>
              </select>
            </div>
            <div className="h-48 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center">
              <div className="text-center">
                <Calendar size={40} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Sin datos disponibles</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-xl font-light text-gray-900 mb-6">Accesos Rápidos</h3>
            <div className="grid grid-cols-2 gap-4">
              {quickAccess.map((action, idx) => (
                <button
                  key={idx}
                  className={`p-6 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-200 group text-center`}
                >
                  <div className={`flex justify-center mb-3 ${action.color}`}>
                    {action.icon}
                  </div>
                  <p className="text-xs font-medium text-gray-700 whitespace-pre-line leading-relaxed">
                    {action.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Estado del Periodo */}
          <div>
            <h3 className="text-lg font-light text-gray-900 mb-6">Estado del Período</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Hoteles</span>
                <span className="text-lg font-light text-gray-900">1</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">Reservas</span>
                <span className="text-lg font-light text-gray-900">0</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-gray-600">Ocupación</span>
                <span className="text-lg font-light text-gray-900">0%</span>
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Tip</h4>
            <p className="text-xs text-blue-700 leading-relaxed">
              Sincroniza tus reservas regularmente para mantener todas las métricas actualizadas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
