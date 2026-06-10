    // src/Pages/Dashboard.jsx - Con Sidebar agregado
    import React, { useState } from 'react';
    import Topbar from '../components/Topvar';
    import { NavLink } from 'react-router-dom';
    import {
    Menu,
    X,
    DollarSign,
    Users,
    TrendingUp,
    Clock,
    BarChart3,
    ArrowUp,
    ArrowDown,
    Coffee,
    ShoppingBag,
    Star,
    UtensilsCrossed,
    Receipt,
    AlertTriangle,
    } from 'lucide-react';

    const Dashboard = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Datos estáticos
    const kpis = {
        ocupacion: 78,
        ingresosHoy: 24500,
        pedidosPendientes: 4,
        scoreClientes: 92,
        ingresosMes: 458000,
        gastosMes: 312000,
        ordenesEnCurso: 8,
        ticketPromedio: 345,
        platosMasVendidos: [
        { nombre: 'Parrillada Mixta', cantidad: 23 },
        { nombre: 'Ceviche de Camarón', cantidad: 18 },
        { nombre: 'Lomo Saltado', cantidad: 15 },
        { nombre: 'Suspiro Limeño', cantidad: 12 },
        ],
    };

    const tendencias = [
        { dia: 'Lun', ventas: 18500 },
        { dia: 'Mar', ventas: 21200 },
        { dia: 'Mié', ventas: 19800 },
        { dia: 'Jue', ventas: 23500 },
        { dia: 'Vie', ventas: 31200 },
        { dia: 'Sáb', ventas: 35800 },
        { dia: 'Dom', ventas: 28900 },
    ];

    const mesasOcupadas = 18;
    const mesasTotales = 25;

    const alertas = [
        {
        id: 'stock',
        tipo: 'warning',
        titulo: 'Stock Bajo',
        descripcion: 'Queso Mozzarella y Tomate bajo inventario',
        icono: <AlertTriangle size={20} className="text-amber-500" />,
        },
        {
        id: 'pedidos',
        tipo: 'info',
        titulo: 'Pedidos en Espera',
        descripcion: '4 pedidos pendientes de entrega',
        icono: <Clock size={20} className="text-blue-500" />,
        },
    ];

    const menuItems = [
        { to: '/dashboard', label: 'Dashboard', icon: '📊' },
        { to: '/reportes/ingresos', label: 'Ingresos', icon: '💰' },
        { to: '/inventarios', label: 'Inventarios', icon: '📦' },
        { to: '/productos', label: 'Productos', icon: '🍽️' },
        { to: '/categoria', label: 'Platos', icon: '👨‍🍳' },
        { to: '/reportes/promocion', label: 'Promociones', icon: '🎉' },
    ];

    return (
        <div className="bg-gray-100 min-h-screen">
        {/* Botón para abrir sidebar */}
        <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-50 p-2 bg-amber-500 rounded-lg text-white shadow-lg hover:bg-amber-600 transition-colors"
        >
            <Menu size={24} />
        </button>

        {sidebarOpen && (
            <div className="fixed inset-0 z-50 flex">
        
            <div
                className="fixed inset-0 bg-black/50"
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className="relative w-72 bg-white h-full shadow-xl">
            
                <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-bold text-amber-600">🍽️ RestoManager</h1>
                    <p className="text-xs text-gray-500 mt-1">Sistema de Gestión</p>
                </div>
                <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X size={20} className="text-gray-600" />
                </button>
                </div>

                {/* Info del usuario */}
                <div className="mx-4 mt-4 p-3 bg-amber-50 rounded-lg">
                <p className="text-sm font-medium text-gray-800">Carlos Chef</p>
                <p className="text-xs text-amber-600 mt-1">ADMIN</p>
                </div>

                {/* Menú de navegación */}
                <nav className="px-3 py-4 space-y-1">
                {menuItems.map((item) => (
                    <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                            ? 'bg-amber-50 text-amber-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`
                    }
                    >
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-sm font-medium">{item.label}</span>
                    </NavLink>
                ))}
                </nav>

                {/* Footer del sidebar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
                <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all">
                    <span className="text-xl">🚪</span>
                    <span className="text-sm font-medium">Cerrar Sesión</span>
                </button>
                </div>
            </aside>
            </div>
        )}

        <Topbar />
        <div className="p-6 pt-16">
        
            <div className="mb-8">
            <div className="flex justify-between items-start mb-6">
                <div>
                <h1 className="text-4xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                    <UtensilsCrossed size={40} className="text-amber-600" />
                    Sabores del Chef
                </h1>
                <p className="text-sm text-slate-600">
                    Resumen operativo • {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-lg border border-amber-200 shadow-sm">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700">En Servicio</span>
                </div>
            </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {/* Ocupación */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Ocupación de Mesas</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.ocupacion}%</p>
                    <p className="text-sm text-slate-600 mt-1">{mesasOcupadas} / {mesasTotales} mesas</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Users size={24} className="text-amber-600" />
                </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${kpis.ocupacion}%` }}></div>
                </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Ventas Hoy</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">L. {kpis.ingresosHoy.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <DollarSign size={24} className="text-emerald-600" />
                </div>
                </div>
                <p className="text-xs text-emerald-600 font-medium">Ticket promedio: L. {kpis.ticketPromedio}</p>
            </div>

            {/* Pedidos */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Pedidos en Curso</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.ordenesEnCurso}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ShoppingBag size={24} className="text-orange-600" />
                </div>
                </div>
                <p className="text-xs text-orange-600 font-medium">⏳ {kpis.pedidosPendientes} pendientes</p>
            </div>

            {/* Satisfacción */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Satisfacción</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{kpis.scoreClientes}%</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Star size={24} className="text-yellow-600" />
                </div>
                </div>
                <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                    <span key={i}>{i < Math.round(kpis.scoreClientes / 20) ? '⭐' : '☆'}</span>
                ))}
                </div>
            </div>
            </div>

            {/* Alertas */}
            {alertas.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
                {alertas.map((alerta) => (
                <div key={alerta.id} className="bg-white rounded-xl p-5 border-l-4 border-amber-500 shadow-sm">
                    <div className="flex gap-4">
                    <div className="mt-1">{alerta.icono}</div>
                    <div>
                        <h4 className="font-semibold text-slate-900">{alerta.titulo}</h4>
                        <p className="text-sm text-slate-600 mt-1">{alerta.descripcion}</p>
                    </div>
                    </div>
                </div>
                ))}
            </div>
            )}

            {/* Gráfico de Ventas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 size={20} /> Ventas Última Semana
                </h3>
                <div className="flex items-end justify-between h-40 gap-2">
                {tendencias.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1">
                    <div className="w-full bg-slate-100 rounded-t-lg relative group" style={{ height: `${(item.ventas / 40000) * 140}px` }}>
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        L. {item.ventas.toLocaleString()}
                        </div>
                        <div className="w-full h-full bg-gradient-to-t from-amber-500 to-orange-300 rounded-t-lg" style={{ height: `100%` }}></div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 font-medium">{item.dia}</p>
                    </div>
                ))}
                </div>
            </div>

            {/* Financiero */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <Receipt size={20} /> Resumen Financiero del Mes
                </h3>
                <div className="space-y-4">
                {[
                    { label: 'Ventas Totales', valor: kpis.ingresosMes, trend: 'up' },
                    { label: 'Gastos', valor: kpis.gastosMes, trend: 'down' },
                    { label: 'Utilidad Neta', valor: kpis.ingresosMes - kpis.gastosMes, trend: 'up' },
                ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    <div className="flex items-center gap-2">
                        {item.trend === 'up' ? <ArrowUp size={16} className="text-emerald-600" /> : <ArrowDown size={16} className="text-slate-400" />}
                        <span className="font-semibold text-slate-900">L. {item.valor.toLocaleString()}</span>
                    </div>
                    </div>
                ))}
                </div>
            </div>
            </div>

            {/* Top Platos */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <Coffee size={20} /> Top Platos del Día
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {kpis.platosMasVendidos.map((plato, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-3">
                    <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🍽️'}</span>
                    <span className="font-medium text-slate-800">{plato.nombre}</span>
                    </div>
                    <span className="text-sm font-semibold text-amber-700">{plato.cantidad} vendidos</span>
                </div>
                ))}
            </div>
            </div>
        </div>
        </div>
    );
    };

    export default Dashboard;