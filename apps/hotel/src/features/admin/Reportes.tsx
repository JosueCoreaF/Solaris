import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Info,
  Percent,
  Sparkles
} from 'lucide-react';
import {
  Grid,
  Col,
  Text,
  Title,
  AreaChart,
  BarChart,
  DonutChart,
  Legend,
  Badge,
  TabGroup,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Flex,
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  List,
  ListItem
} from '@tremor/react';
import {
  obtenerEstadisticas,
  obtenerOcupacion,
  obtenerIngresos,
  obtenerClientes,
  ReportStats,
  OcupacionData,
  IngresosData,
  ClientesData
} from '../../api/reportesService';

export const Reportes: React.FC = () => {
  const [periodo, setPeriodo] = useState('mes');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States para los distintos reportes
  const [statsData, setStatsData] = useState<ReportStats | null>(null);
  const [ocupacionData, setOcupacionData] = useState<OcupacionData | null>(null);
  const [ingresosData, setIngresosData] = useState<IngresosData | null>(null);
  const [clientesData, setClientesData] = useState<ClientesData | null>(null);

  const getPeriodDates = (p: string) => {
    const ahora = new Date();
    const hasta = ahora.toLocaleDateString('en-CA');
    const desde = new Date(ahora);

    if (p === 'semana') desde.setDate(ahora.getDate() - 7);
    else if (p === 'trimestre') desde.setDate(ahora.getDate() - 90);
    else if (p === 'año') desde.setFullYear(ahora.getFullYear() - 1);
    else desde.setDate(ahora.getDate() - 30); // mes por defecto

    return { desde: desde.toLocaleDateString('en-CA'), hasta };
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const { desde, hasta } = getPeriodDates(periodo);

      const [stats, ocupacion, ingresos, clientes] = await Promise.all([
        obtenerEstadisticas(periodo),
        obtenerOcupacion(desde, hasta),
        obtenerIngresos(periodo),
        obtenerClientes(),
      ]);

      setStatsData(stats);
      setOcupacionData(ocupacion);
      setIngresosData(ingresos);
      setClientesData(clientes);
    } catch (err: any) {
      console.error('Error cargando reportes:', err);
      setError(err?.message || 'Error al cargar los reportes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [periodo]);

  const handleExportPDF = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center gap-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -left-1/4 -top-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute -right-1/4 -bottom-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[120px] animate-pulse delay-700"></div>

        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-indigo-500 animate-spin"></div>
          <BarChart3 size={24} className="text-blue-600 animate-bounce" />
        </div>
        <div className="text-center relative z-10">
          <p className="font-light text-lg text-slate-800 tracking-wide animate-pulse">Sincronizando con base de datos...</p>
          <p className="text-xs text-blue-600 mt-2 font-mono uppercase tracking-widest font-semibold">Supabase Live Connection</p>
        </div>
      </div>
    );
  }

  if (error || !statsData || !ocupacionData || !ingresosData || !clientesData) {
    return (
      <div className="min-h-screen bg-slate-50/50 p-8 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.02),transparent_60%)]"></div>
        <div className="w-full max-w-md bg-white border border-slate-200 text-center p-8 rounded-3xl relative z-10 shadow-xl shadow-slate-100/50">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100">
            <AlertCircle size={26} />
          </div>
          <h2 className="text-slate-800 font-medium text-lg tracking-tight">Fallo en la Sincronización</h2>
          <p className="text-slate-500 mt-3 text-sm leading-relaxed">
            {error || 'No se pudieron recuperar los datos analíticos desde Supabase.'}
          </p>
          <button
            onClick={cargarDatos}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-lg shadow-blue-600/10"
          >
            <RefreshCw size={14} /> Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  // Preparar tendencias para gráficos
  const ocupacionTendencia = statsData.tasaOcupacion.map((pct, idx) => ({
    dia: `Día ${idx + 1}`,
    'Tasa Ocupación': pct,
  }));

  const reservasEstadoData = statsData.reservasPorEstado.map(r => ({
    name: r.estado,
    value: r.cantidad,
  }));

  const ingresosDiariosChart = ingresosData.detalles.map(d => ({
    dia: d.periodo,
    'Monto HNL': d.cantidad,
    'Reservas': d.reservas,
  }));

  const clientesNuevosRecurrentes = [
    { name: 'Recurrentes', value: clientesData.recurrentes },
    { name: 'Nuevos', value: clientesData.nuevos },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-slate-50/50 to-blue-50/20 text-slate-700 p-8 relative overflow-hidden font-sans">
      {/* Ambient Lighting Background Glows */}
      <div className="absolute top-[-300px] right-[-100px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(59,130,246,0.04),transparent_60%)] pointer-events-none"></div>
      <div className="absolute bottom-[-200px] left-[-200px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(99,102,241,0.03),transparent_60%)] pointer-events-none"></div>

      {/* Header Premium */}
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10 border-b border-slate-200/60 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3 shadow-sm">
            <Sparkles size={11} className="animate-pulse" /> Inteligencia de Negocio
          </div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 flex items-center gap-3">
            <BarChart3 size={32} className="text-blue-600 stroke-[1.5]" />
            Análisis e Informes
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 font-normal flex items-center gap-1.5">
            <Info size={14} className="text-blue-400" />
            Métricas consolidadas a partir de la base de datos de habitaciones y cobros registrados.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end lg:self-auto w-full lg:w-auto justify-end">
          <button
            onClick={cargarDatos}
            className="flex items-center justify-center p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Sincronizar Datos"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white border-none rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-md active:scale-98"
          >
            <Download size={14} /> Exportar Reporte
          </button>
        </div>
      </div>

      {/* Grid de KPIs - Bespoke Premium Glassmorphic Cards */}
      <Grid numItemsColSpanLg={4} className="gap-6 mb-8 relative z-10">
        {/* KPI 1: Ocupación Promedio */}
        <Col numItemsColSpanLg={1}>
          <div className="relative group bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-blue-500/20 overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ocupación Promedio</span>
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 border border-blue-100/50">
                <Percent size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-800">{statsData.ocupacionPromedio}%</span>
              <span className="text-emerald-600 text-xxs font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">↑ 4.2%</span>
            </div>
            <p className="text-slate-400 text-xs mt-3 font-normal">Capacidad operativa activa</p>
          </div>
        </Col>

        {/* KPI 2: Ingresos Período */}
        <Col numItemsColSpanLg={1}>
          <div className="relative group bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-500/20 overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingresos Período</span>
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 border border-emerald-100/50">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-extrabold tracking-tight text-slate-800">L {statsData.totalIngresos.toLocaleString()}</span>
            </div>
            <p className="text-slate-400 text-xs mt-4 font-normal">Equivale a ≈ ${ingresosData.totalUSD.toLocaleString()} USD</p>
          </div>
        </Col>

        {/* KPI 3: Total Reservaciones */}
        <Col numItemsColSpanLg={1}>
          <div className="relative group bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-500/20 overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Reservas</span>
              <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 border border-indigo-100/50">
                <Calendar size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-800">{statsData.totalReservas}</span>
              <span className="text-indigo-600 text-xxs font-semibold uppercase tracking-wider bg-indigo-50 border border-indigo-100/30 px-1.5 py-0.5 rounded-md">Reservas</span>
            </div>
            <p className="text-slate-400 text-xs mt-3 font-normal">Estadías en el período</p>
          </div>
        </Col>

        {/* KPI 4: Huéspedes Activos */}
        <Col numItemsColSpanLg={1}>
          <div className="relative group bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/5 hover:border-amber-500/20 overflow-hidden shadow-sm">
            <div className="absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Huéspedes Activos</span>
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300 border border-amber-100/50">
                <Users size={14} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-slate-800">{clientesData.activos}</span>
              <span className="text-slate-400 text-xs font-semibold">de {clientesData.total}</span>
            </div>
            <p className="text-slate-400 text-xs mt-3 font-normal">Registrados en la plataforma</p>
          </div>
        </Col>
      </Grid>

      {/* Navegación y Período con diseño Premium Táctil */}
      <TabGroup className="relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-4 mb-6">
          <TabList className="flex gap-1.5 p-1 bg-slate-100 border border-slate-200/50 rounded-xl max-w-full overflow-x-auto scrollbar-none">
            <Tab className="text-xs font-bold tracking-wide uppercase px-4 py-2 border-none rounded-lg text-slate-500 transition-all focus:outline-none hover:text-slate-800 ui-selected:bg-white ui-selected:text-blue-600 ui-selected:shadow-sm cursor-pointer">
              Resumen Ejecutivo
            </Tab>
            <Tab className="text-xs font-bold tracking-wide uppercase px-4 py-2 border-none rounded-lg text-slate-500 transition-all focus:outline-none hover:text-slate-800 ui-selected:bg-white ui-selected:text-blue-600 ui-selected:shadow-sm cursor-pointer">
              Ocupación
            </Tab>
            <Tab className="text-xs font-bold tracking-wide uppercase px-4 py-2 border-none rounded-lg text-slate-500 transition-all focus:outline-none hover:text-slate-800 ui-selected:bg-white ui-selected:text-blue-600 ui-selected:shadow-sm cursor-pointer">
              Finanzas
            </Tab>
            <Tab className="text-xs font-bold tracking-wide uppercase px-4 py-2 border-none rounded-lg text-slate-500 transition-all focus:outline-none hover:text-slate-800 ui-selected:bg-white ui-selected:text-blue-600 ui-selected:shadow-sm cursor-pointer">
              Clientes
            </Tab>
          </TabList>

          {/* Selector de Períodos Tactil */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/50 shadow-sm">
            {['semana', 'mes', 'trimestre', 'año'].map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-4 py-2 border-none text-[11px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all duration-350 ${
                  periodo === p
                    ? 'bg-white text-slate-800 shadow-sm border border-slate-200/30'
                    : 'bg-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <TabPanels>
          {/* TAB 1: RESUMEN EJECUTIVO */}
          <TabPanel className="focus:outline-none">
            <Grid numItemsColSpanLg={3} className="gap-6 animate-fade-in">
              {/* Ocupación General */}
              <Col numItemsColSpanLg={2}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm">
                  <div className="mb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 tracking-tight">Tendencia de Ocupación</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Porcentaje de habitaciones vendidas en la propiedad activa</p>
                    </div>
                    <Badge color="blue" className="bg-blue-50 border border-blue-100 text-blue-600 text-[10px] font-bold">
                      Historial
                    </Badge>
                  </div>
                  {ocupacionTendencia.length > 0 ? (
                    <AreaChart
                      className="h-80 mt-4 custom-tremor-chart"
                      data={ocupacionTendencia}
                      index="dia"
                      categories={['Tasa Ocupación']}
                      colors={['blue']}
                      valueFormatter={(v) => `${v}%`}
                      yAxisWidth={40}
                      showGridLines={false}
                    />
                  ) : (
                    <div className="h-80 flex items-center justify-center text-slate-400 text-xs">
                      Sin datos suficientes en este período
                    </div>
                  )}
                </div>
              </Col>

              {/* Rosca de Reservas por Estado */}
              <Col numItemsColSpanLg={1}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <div className="mb-4">
                      <h3 className="text-base font-semibold text-slate-800 tracking-tight">Distribución de Reservas</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Comportamiento por estados en el período</p>
                    </div>
                    {reservasEstadoData.length > 0 ? (
                      <>
                        <DonutChart
                          className="h-56 mt-4"
                          data={reservasEstadoData}
                          category="value"
                          index="name"
                          colors={['emerald', 'blue', 'amber', 'rose', 'violet']}
                          valueFormatter={(v) => `${v} reservas`}
                          variant="donut"
                        />
                        <Legend
                          className="mt-6 flex-wrap justify-center gap-x-4 gap-y-2 text-slate-400"
                          categories={reservasEstadoData.map(r => r.name)}
                          colors={['emerald', 'blue', 'amber', 'rose', 'violet']}
                        />
                      </>
                    ) : (
                      <div className="h-56 flex items-center justify-center text-slate-455 text-xs mt-6">
                        No se registraron reservaciones
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            </Grid>
          </TabPanel>

          {/* TAB 2: DETALLE DE OCUPACIÓN */}
          <TabPanel className="focus:outline-none">
            <Grid numItemsColSpanLg={3} className="gap-6 animate-fade-in">
              {/* Ocupación Diaria */}
              <Col numItemsColSpanLg={2}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm">
                  <div className="mb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 tracking-tight">Detalle de Ocupación Diaria</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Sincronización detallada con la capacidad física</p>
                    </div>
                    <Badge color="indigo" className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold">
                      Día por Día
                    </Badge>
                  </div>
                  {ocupacionData.dias.length > 0 ? (
                    <AreaChart
                      className="h-80 mt-4"
                      data={ocupacionData.dias.map(d => ({
                        Fecha: d.fecha.substring(5),
                        'Ocupación %': d.ocupacion,
                        'Habitaciones': d.habitacionesOcupadas,
                      }))}
                      index="Fecha"
                      categories={['Ocupación %']}
                      colors={['indigo']}
                      valueFormatter={(v) => `${v}%`}
                      yAxisWidth={40}
                      showGridLines={false}
                    />
                  ) : (
                    <div className="h-80 flex items-center justify-center text-slate-400 text-xs">
                      No hay registros disponibles para el rango indicado.
                    </div>
                  )}
                </div>
              </Col>

              {/* Estadísticas de habitaciones */}
              <Col numItemsColSpanLg={1}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1">Métricas de Ocupación</h3>
                    <p className="text-[11px] text-slate-400 mb-6">Eficiencia de inventario físico</p>

                    <div className="space-y-6">
                      <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl">
                        <Flex>
                          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Ocupación Promedio</Text>
                          <Badge color="indigo" className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold py-0.5">
                            {ocupacionData.promedio}%
                          </Badge>
                        </Flex>
                        <div className="w-full bg-slate-200/60 rounded-full h-1.5 mt-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-blue-500 h-1.5 rounded-full"
                            style={{ width: `${ocupacionData.promedio}%` }}
                          ></div>
                        </div>
                      </div>

                      <List className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-slate-600">
                        <ListItem className="py-3">
                          <span className="text-slate-500 text-xs font-normal">Días Analizados</span>
                          <span className="font-semibold text-slate-800 font-mono">{ocupacionData.dias.length}</span>
                        </ListItem>
                        <ListItem className="py-3">
                          <span className="text-slate-500 text-xs font-normal">Total Habitaciones</span>
                          <span className="font-semibold text-slate-800 font-mono">
                            {ocupacionData.dias[0]?.habitacionesTotales || 0}
                          </span>
                        </ListItem>
                        <ListItem className="py-3">
                          <span className="text-slate-500 text-xs font-normal">Pico Máximo</span>
                          <span className="font-bold text-emerald-600 font-mono">
                            {ocupacionData.dias.length > 0
                              ? Math.max(...ocupacionData.dias.map(d => d.ocupacion))
                              : 0}
                            %
                          </span>
                        </ListItem>
                      </List>
                    </div>
                  </div>
                </div>
              </Col>
            </Grid>
          </TabPanel>

          {/* TAB 3: DESGLOSE FINANCIERO */}
          <TabPanel className="focus:outline-none">
            <Grid numItemsColSpanLg={3} className="gap-6 animate-fade-in">
              {/* Gráfico ingresos */}
              <Col numItemsColSpanLg={2}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm">
                  <div className="mb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 tracking-tight">Ingresos por Día</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Efectivo cobrado expresado en moneda nacional (HNL)</p>
                    </div>
                    <Badge color="emerald" className="bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-bold">
                      Finanzas
                    </Badge>
                  </div>
                  {ingresosDiariosChart.length > 0 ? (
                    <BarChart
                      className="h-80 mt-4"
                      data={ingresosDiariosChart}
                      index="dia"
                      categories={['Monto HNL']}
                      colors={['emerald']}
                      valueFormatter={(v) => `L. ${v.toLocaleString()}`}
                      yAxisWidth={80}
                      showGridLines={false}
                    />
                  ) : (
                    <div className="h-80 flex items-center justify-center text-slate-500 text-xs">
                      Sin movimientos financieros en el período
                    </div>
                  )}
                </div>
              </Col>

              {/* Conversión y caja */}
              <Col numItemsColSpanLg={1}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1">Caja y Equivalencias</h3>
                    <p className="text-[11px] text-slate-400 mb-6">Conciliación contable consolidada</p>

                    <div className="space-y-4">
                      {/* Moneda Local */}
                      <div className="relative group bg-slate-50 border border-slate-200 p-5 rounded-2xl transition-all hover:border-emerald-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Moneda Local (HNL)</span>
                          <span className="text-emerald-600 text-xxs font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Activo</span>
                        </div>
                        <h4 className="text-2xl font-extrabold tracking-tight text-emerald-600">L {ingresosData.total.toLocaleString()}</h4>
                      </div>

                      {/* Moneda Extranjera */}
                      <div className="relative group bg-slate-50 border border-slate-200 p-5 rounded-2xl transition-all hover:border-blue-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dólares (USD)</span>
                          <span className="text-slate-400 text-[10px] font-medium">Ref: {ingresosData.tipoCambio}</span>
                        </div>
                        <h4 className="text-2xl font-extrabold tracking-tight text-blue-600">$ {ingresosData.totalUSD.toLocaleString()}</h4>
                      </div>
                    </div>
                  </div>

                  <List className="divide-y divide-slate-100 border-t border-slate-100 pt-4 mt-6 text-slate-600">
                    <ListItem className="py-3">
                      <span className="text-slate-500 text-xs font-normal">Transacciones Totales</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {ingresosData.detalles.reduce((acc, curr) => acc + curr.reservas, 0)} cobros
                      </span>
                    </ListItem>
                  </List>
                </div>
              </Col>
            </Grid>
          </TabPanel>

          {/* TAB 4: PERFIL DE CLIENTES */}
          <TabPanel className="focus:outline-none">
            <Grid numItemsColSpanLg={3} className="gap-6 animate-fade-in">
              {/* Top Clientes */}
              <Col numItemsColSpanLg={2}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm">
                  <div className="mb-4 flex justify-between items-start">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800 tracking-tight">Top Clientes de la Propiedad</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Listado premium de huéspedes de mayor volumen operativo</p>
                    </div>
                    <Badge color="violet" className="bg-violet-50 border border-violet-100 text-violet-600 text-[10px] font-bold">
                      Clientes Elite
                    </Badge>
                  </div>

                  {clientesData.topClientes.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table className="mt-4 w-full">
                        <TableHead className="border-b border-slate-200">
                          <TableRow>
                            <TableHeaderCell className="text-slate-400 font-bold text-[10px] uppercase tracking-wider py-3">Huésped</TableHeaderCell>
                            <TableHeaderCell className="text-slate-400 font-bold text-[10px] uppercase tracking-wider text-right py-3">Estadías</TableHeaderCell>
                            <TableHeaderCell className="text-slate-400 font-bold text-[10px] uppercase tracking-wider text-right py-3">Total Facturado</TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody className="divide-y divide-slate-100">
                          {clientesData.topClientes.map((c, i) => (
                            <TableRow key={i} className="hover:bg-slate-50 transition-all duration-150">
                              <TableCell className="font-semibold text-slate-800 py-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-blue-600 shadow-sm">
                                  {c.nombre.charAt(0)}
                                </div>
                                {c.nombre}
                              </TableCell>
                              <TableCell className="text-right text-slate-600 font-mono py-4">{c.reservas}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600 font-mono py-4">
                                L {c.gastado.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="h-60 flex items-center justify-center text-slate-500 text-xs">
                      No hay historial de clientes en el hotel
                    </div>
                  )}
                </div>
              </Col>

              {/* Distribución de fidelidad */}
              <Col numItemsColSpanLg={1}>
                <div className="bg-white/70 backdrop-blur-md border border-slate-200/60 p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 tracking-tight mb-1">Fidelización de Clientes</h3>
                    <p className="text-[11px] text-slate-400 mb-6">Fórmula de recurrencia e impacto comercial</p>

                    {clientesNuevosRecurrentes.some(x => x.value > 0) ? (
                      <>
                        <DonutChart
                          className="h-56 mt-4"
                          data={clientesNuevosRecurrentes}
                          category="value"
                          index="name"
                          colors={['teal', 'violet']}
                          valueFormatter={(v) => `${v} clientes`}
                        />
                        <Legend
                          className="mt-6 flex-wrap justify-center gap-x-4 gap-y-2 text-slate-400"
                          categories={clientesNuevosRecurrentes.map(r => r.name)}
                          colors={['teal', 'violet']}
                        />
                      </>
                    ) : (
                      <div className="h-56 flex items-center justify-center text-slate-500 text-xs mt-4">
                        Sin datos suficientes de fidelidad
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            </Grid>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Footer Premium Info Glassmorphic Block */}
      <div className="mt-8 p-5 bg-white/75 backdrop-blur-md rounded-2xl border border-slate-200/60 flex items-center gap-4 relative z-10 shadow-sm">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
          <Info size={18} />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            <strong>📊 Auditoría Operativa de Solaris:</strong> Los datos agregados y de rendimiento presentados en este módulo corresponden a la conciliación en tiempo real de reservas y transacciones contables del hotel seleccionado.
          </p>
        </div>
      </div>
    </div>
  );
};
