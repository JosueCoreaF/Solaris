import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, Moon, LogOut, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../hooks/useRole';
import { useSync } from '../context/SyncContext';
import { useTheme } from '../context/ThemeContext';

const IconDashboard = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const IconUsers = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconCard = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
const IconCalendar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IconDollar = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IconChart = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const IconSettings = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PLAN_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gym_starter: { label: 'Starter', color: '#8b94a0', bg: 'rgba(139, 148, 160, 0.1)', border: 'rgba(139, 148, 160, 0.25)' },
  gym_pro: { label: 'Pro', color: 'var(--accent)', bg: 'rgba(200, 255, 61, 0.1)', border: 'var(--accent-border)' },
};

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

const getGymInitials = (nombre?: string) => {
  if (!nombre) return 'GYM';
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
};

export const Sidebar: React.FC = () => {
  const { user, signOut } = useAuth();
  const { role } = useRole();
  const { gimnasio, gimnasios } = useSync();
  const { theme, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);

  const activeGymId = gimnasio?.id_gimnasio || '';
  const puedeCambiar = gimnasios.length > 1;

  const handleGymChange = (val: string) => {
    localStorage.setItem('active_gym_id', val);
    setModalOpen(false);
    window.location.reload();
  };

  const planInfo = gimnasio?.plan?.id_plan ? PLAN_BADGES[gimnasio.plan.id_plan] : null;

  return (
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

      {/* SELECTOR DE GIMNASIO / PROPIEDAD */}
      <div style={{ padding: '4px 14px', marginTop: 8 }}>
        <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 6 }}>
          Sucursal Activa
        </label>
        <button
          onClick={() => puedeCambiar && setModalOpen(true)}
          title={puedeCambiar ? 'Cambiar de sucursal' : 'Esta es tu única sucursal'}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '4px',
            border: '1px solid var(--shell-border)',
            backgroundColor: 'var(--shell-panel-strong)',
            color: 'var(--text-h)',
            fontSize: 13,
            fontWeight: 600,
            cursor: puedeCambiar ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
          onMouseEnter={(e) => { if (puedeCambiar) e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--shell-border)'; }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 4, flexShrink: 0,
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800,
          }}>
            {getGymInitials(gimnasio?.nombre_gimnasio)}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-h)' }}>
              {gimnasio?.nombre_gimnasio || 'Cargando...'}
            </div>
            {gimnasio?.ciudad && (
              <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {gimnasio.ciudad}
              </div>
            )}
          </div>
          {puedeCambiar && (
            <div style={{ color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
              <RefreshCw size={12} />
            </div>
          )}
        </button>
      </div>

      {/* DETALLES DE MEMBRESÍA/PLAN */}
      {planInfo && (
        <div style={{ padding: '6px 14px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '4px',
              background: planInfo.bg,
              border: `1px solid ${planInfo.border}`,
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: planInfo.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Membresía {planInfo.label}
            </span>
            {gimnasio?.plan?.id_plan === 'gym_starter' && (
              <a
                href={`${import.meta.env.VITE_HUB_URL || 'http://localhost:5174'}/upgrade`}
                style={{ fontSize: 10, fontWeight: 700, color: planInfo.color, textDecoration: 'none' }}
              >
                Mejorar →
              </a>
            )}
          </div>
        </div>
      )}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6 }}>
          <strong style={{ fontSize: 13, color: 'var(--text-h)' }}>{user?.email?.split('@')[0] ?? 'Usuario'}</strong>
          <span style={{ fontSize: 11, wordBreak: 'break-all' }}>{user?.email}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{role}</span>
        </div>

        <button
          onClick={() => {
            const hubUrl = import.meta.env.VITE_HUB_URL || 'http://localhost:5174';
            window.location.href = hubUrl;
          }}
          style={{
            width: '100%',
            padding: '9px 12px',
            borderRadius: '4px',
            border: '1px solid var(--shell-border)',
            background: 'rgba(200, 255, 61, 0.04)',
            color: 'var(--accent)',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200, 255, 61, 0.1)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200, 255, 61, 0.04)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--shell-border)';
          }}
        >
          <ArrowLeft size={13} />
          Volver al Hub
        </button>

        <button className="theme-toggle" onClick={toggleTheme} style={{ width: '100%', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--shell-border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
          <span>{theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}</span>
          <span className="theme-toggle-icon" style={{ display: 'flex' }}>{theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}</span>
        </button>

        <button className="logout-button" onClick={() => signOut()} style={{ width: '100%', justifyContent: 'center', gap: 8, padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--shell-border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 12 }}>
          <LogOut size={13} />
          Cerrar Sesión
        </button>
      </footer>

      {/* MODAL DE SELECCIÓN DE SUCURSAL */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(10, 12, 15, 0.6)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--shell-panel-strong)',
            border: '1px solid var(--shell-border-strong)',
            borderTop: '2px solid var(--accent)',
            borderRadius: '6px',
            width: '90%', maxWidth: '420px',
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeInUp 0.3s ease-out'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--display)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cambiar Sucursal</h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Selecciona el gimnasio activo</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '12px', maxHeight: '50vh', overflowY: 'auto' }}>
              {gimnasios.map((g: any) => (
                <div
                  key={g.id_gimnasio}
                  onClick={() => handleGymChange(g.id_gimnasio)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '4px',
                    marginBottom: 6,
                    backgroundColor: activeGymId === g.id_gimnasio ? 'var(--accent-bg)' : 'transparent',
                    border: activeGymId === g.id_gimnasio ? '1px solid var(--accent-border)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                  onMouseEnter={(e) => { if (activeGymId !== g.id_gimnasio) e.currentTarget.style.backgroundColor = 'var(--sidebar-item-hover)' }}
                  onMouseLeave={(e) => { if (activeGymId !== g.id_gimnasio) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: '4px', background: 'var(--sidebar-item-hover)', color: activeGymId === g.id_gimnasio ? 'var(--accent)' : 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                      {getGymInitials(g.nombre_gimnasio)}
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: 14 }}>{g.nombre_gimnasio}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{g.ciudad || 'Operación regular'}</div>
                    </div>
                  </div>
                  {activeGymId === g.id_gimnasio && <span style={{ color: 'var(--accent)', display: 'flex' }}><IconCheck /></span>}
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
