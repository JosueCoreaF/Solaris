// src/components/Sidebar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  DollarSign, 
  ShoppingBag, 
  Utensils, 
  ChefHat, 
  Gift 
} from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { path: '/dashboard', nombre: 'Dashboard', icono: LayoutDashboard },
    { path: '/reportes/ingresos', nombre: 'Ingresos', icono: DollarSign },
    { path: '/reportes/pedidos', nombre: 'Pedidos', icono: ShoppingBag },
    { path: '/reportes/producto', nombre: 'Productos', icono: Utensils },
    { path: '/reportes/plato', nombre: 'Platos', icono: ChefHat },
    { path: '/reportes/promocion', nombre: 'Promociones', icono: Gift },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-amber-600">🍽️ RestoManager</h1>
        <p className="text-xs text-gray-500 mt-1">Sistema de Gestión</p>
      </div>
      
      <nav className="px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icono = item.icono;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-amber-50 text-amber-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icono size={20} />
              <span className="text-sm">{item.nombre}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;