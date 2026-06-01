import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../hooks/useRole';
import { useSync } from '../context/SyncContext';

const IconDashboard = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const IconUsers = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconCard = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IconCalendar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconDollar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IconChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconSettings = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

const sections = [
  {
    title: 'Principal',
    items: [
      { to: '/', label: 'Dashboard', icon: IconDashboard },
      { to: '/miembros', label: 'Miembros', icon: IconUsers },
      { to: '/inscripciones', label: 'Membresías', icon: IconCard },
      { to: '/clases', label: 'Clases', icon: IconCalendar },
      { to: '/pagos', label: 'Pagos', icon: IconDollar },
    ],
  },
  {
    title: 'Administración',
    items: [
      { to: '/reportes', label: 'Reportes', icon: IconChart },
      { to: '/config', label: 'Configuración', icon: IconSettings },
    ],
  },
];

const allItems = sections.flatMap(s => s.items);

export const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const { gimnasio } = useSync();

  return (
    <div className="sidebar-cluster">
      <aside className="sidebar-rail">
        <div className="sidebar-rail-head">
          <div className="brand-badge" style={{ width: 38, height: 38, fontSize: 10, borderRadius: 12 }}>GYM</div>
        </div>
        <nav className="sidebar-rail-menu">
          {allItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'sidebar-rail-item active' : 'sidebar-rail-item'}
              title={item.label}
            >
              <div className="sidebar-rail-icon"><item.icon /></div>
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', paddingBottom: 10 }}>
          <button className="sidebar-rail-item" title="Cerrar sesión" onClick={() => signOut()}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </aside>

      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-lockup">
            <div className="brand-badge">GYM</div>
            <div className="brand-copy">
              <strong>{gimnasio?.nombre_gimnasio ?? 'Solaris Gym'}</strong>
              <span>Módulo Gimnasio</span>
            </div>
          </div>
        </div>

        <nav className="menu">
          {sections.map((section, idx) => (
            <div key={section.title} className="sidebar-group" style={{ marginTop: idx === 0 ? 0 : 16 }}>
              <div className="sidebar-group-title">{section.title}</div>
              <div className="sidebar-group-items">
                {section.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}
                  >
                    <span className="menu-icon"><item.icon /></span>
                    <span className="menu-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <strong style={{ fontSize: 13, color: 'var(--text-h)' }}>{user?.email?.split('@')[0] ?? 'Usuario'}</strong>
            <span style={{ fontSize: 11 }}>{user?.email}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{role}</span>
          </div>
          <button className="logout-button" onClick={() => signOut()}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Cerrar Sesión
          </button>
        </footer>
      </aside>
    </div>
  );
};
