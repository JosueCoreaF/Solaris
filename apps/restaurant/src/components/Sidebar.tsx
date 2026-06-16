import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Sun, Moon, LogOut, ArrowLeft, RefreshCw,
  LayoutDashboard, UtensilsCrossed, Coffee, ClipboardList,
  Users, UserCog, Package, CalendarDays, Truck, ShieldCheck,
  BookOpen, Receipt, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import { useTheme } from '../context/ThemeContext';
import SolarisLogo from './SolarisLogo';

const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const sections = [
  {
    title: 'Principal',
    items: [
      { to: '/',            label: 'Dashboard',   icon: LayoutDashboard },
      { to: '/platillos',   label: 'Platillos',   icon: UtensilsCrossed },
      { to: '/menus',       label: 'Menús',       icon: BookOpen },
      { to: '/mesas',       label: 'Mesas',       icon: Coffee },
      { to: '/pedidos',     label: 'Pedidos',     icon: ClipboardList },
      { to: '/clientes',    label: 'Clientes',    icon: Users },
      { to: '/reservas',    label: 'Reservas',    icon: CalendarDays },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { to: '/empleados',   label: 'Empleados',   icon: UserCog },
      { to: '/inventario',  label: 'Inventario',  icon: Package },
      { to: '/proveedores', label: 'Proveedores', icon: Truck },
      { to: '/facturas',    label: 'Facturas',    icon: Receipt },
      { to: '/gastos',      label: 'Gastos',      icon: Wallet },
      { to: '/usuarios',    label: 'Usuarios',    icon: ShieldCheck },
    ],
  },
];

const getInitials = (nombre?: string) => {
  if (!nombre) return 'RS';
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

export const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { restaurant, modules, activeModule, selectModule } = useRestaurant();
  const { theme, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);

  const displayName = restaurant?.nombre_restaurante ?? activeModule?.nombre ?? 'Restaurante';
  const hasMultiple = modules.length > 1;
  const activeModuleId = activeModule?.id_module ?? '';

  const getHubUrl = () => {
    const envHubUrl = import.meta.env.VITE_HUB_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) return envHubUrl || 'http://localhost:5174';
    if (!envHubUrl || envHubUrl.includes('localhost')) {
      const hostname = window.location.hostname;
      if (hostname.endsWith('.solarys.uk')) return 'https://hub.solarys.uk';
      const parts = hostname.split('.');
      if (parts.length > 2) return `${window.location.protocol}//hub.${parts.slice(1).join('.')}`;
      return 'https://hub.solarys.uk';
    }
    return envHubUrl;
  };

  const handleModuleChange = (modId: string) => {
    const mod = modules.find((m: any) => m.id_module === modId);
    if (mod) { selectModule(mod); setModalOpen(false); }
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-top">
        <div className="brand-lockup">
          <SolarisLogo variant="restaurant" size={38} />
          <div className="brand-copy">
            <strong>Solaris</strong>
            <span>Restaurante</span>
          </div>
        </div>
      </div>

      {/* Active restaurant selector */}
      <div style={{ padding: '10px 14px 4px' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
          Restaurante
        </div>
        <button
          onClick={() => hasMultiple && setModalOpen(true)}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid var(--shell-border)', background: 'var(--surface-raised)',
            color: 'var(--text-h)', fontSize: 13, fontWeight: 600,
            cursor: hasMultiple ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (hasMultiple) e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--shell-border)'; }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: 'var(--accent-bg)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800,
          }}>
            {getInitials(displayName)}
          </div>
          <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          {hasMultiple && <RefreshCw size={11} color="var(--muted)" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="menu">
        {sections.map((section, idx) => (
          <div key={section.title} className="sidebar-group" style={{ marginTop: idx === 0 ? 4 : 8 }}>
            <div className="sidebar-group-title">{section.title}</div>
            <div className="sidebar-group-items">
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}
                  >
                    <span className="menu-icon"><Icon size={16} /></span>
                    <span className="menu-label">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <footer className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6, borderBottom: '1px solid var(--shell-border-subtle)', marginBottom: 2 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'var(--accent-bg)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800,
          }}>
            {(user?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email?.split('@')[0] ?? 'Usuario'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>

        <button
          onClick={() => window.location.href = getHubUrl()}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--shell-border)', background: 'transparent',
            color: 'var(--accent)', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 6, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-bg)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--shell-border)'; }}
        >
          <ArrowLeft size={12} /> Volver al Hub
        </button>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
        >
          <span>{theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}</span>
          <span className="theme-toggle-icon">
            {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
          </span>
        </button>

        <button
          className="logout-button"
          onClick={() => signOut()}
          style={{ justifyContent: 'center' }}
        >
          <LogOut size={13} /> Cerrar Sesión
        </button>
      </footer>

      {/* Restaurant selector modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--shell-border)',
            borderTop: '3px solid var(--accent)', borderRadius: 14,
            width: '90%', maxWidth: 400, boxShadow: 'var(--shadow-lg)',
            animation: 'fadeInUp 0.25s ease-out',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-h)' }}>Cambiar Restaurante</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Selecciona el restaurante activo</div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '10px', maxHeight: '50vh', overflowY: 'auto' }}>
              {modules.map((mod: any) => (
                <div
                  key={mod.id_module}
                  onClick={() => handleModuleChange(mod.id_module)}
                  style={{
                    padding: '11px 14px', borderRadius: 8, marginBottom: 4,
                    background: activeModuleId === mod.id_module ? 'var(--accent-bg)' : 'transparent',
                    border: activeModuleId === mod.id_module ? '1px solid var(--accent-border)' : '1px solid transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (activeModuleId !== mod.id_module) e.currentTarget.style.background = 'var(--sidebar-item-hover)'; }}
                  onMouseLeave={e => { if (activeModuleId !== mod.id_module) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--surface-raised)', color: activeModuleId === mod.id_module ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                      {getInitials(mod.nombre)}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-h)' }}>{mod.nombre ?? mod.id_module}</div>
                  </div>
                  {activeModuleId === mod.id_module && <span style={{ color: 'var(--accent)' }}><IconCheck /></span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
