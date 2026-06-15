import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../hooks/useRole';
import { fetchHoteles } from '../api/bookingsService';
import { useSync } from '../context/SyncContext';
import SolarisLogo from './SolarisLogo';

/* ── Iconos SVG ─────────────────────────────────────────── */
const IconPanel = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" fill="currentColor" />
  </svg>
);
const IconServices = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5zm3 1.5h8m-8 3h8m-8 3h5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const IconReservations = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4v3M17 4v3M5 9h14M6.5 6h11A1.5 1.5 0 0 1 19 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconPayments = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5zm0 3.5h16M8 14h3m2 0h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconRates = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 7h14M5 12h9M5 17h14M18 5l2 2-2 2M15 15l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSettings = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);
const IconChart = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="20" x2="12" y2="4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="6" y1="20" x2="6" y2="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconExport = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="7 10 12 15 17 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="15" x2="12" y2="3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M16 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconWallet = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="16" cy="13" r="1" fill="currentColor" />
  </svg>
);

const IconChat = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconQuotes = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const IconClients = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" fill="currentColor" />
  </svg>
);
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M3 9h6M3 15h6M15 9h3M15 13h3M15 17h3" />
  </svg>
);
const IconWrench = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const IconSparkles = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.88 5.76L20 10l-5.76 1.88L12 18l-1.88-5.76L4 10l5.76-1.88z" />
    <path d="M5 3l.94 2.88L9 7l-2.88.94L5 11l-.94-2.88L1 7l2.88-.94z" strokeWidth="1.4" />
    <path d="M19 17l.94 2.88L23 21l-2.88.94L19 25" strokeWidth="1.4" />
  </svg>
);
const IconMail = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconUploadCloud = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
/* ── Insignia visual del plan de suscripción activo ───────── */
const PLAN_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  hotel_starter: { label: 'Starter', color: '#64748b', bg: 'rgba(100,116,139,.10)', border: 'rgba(100,116,139,.25)' },
  hotel_pro: { label: 'Estándar', color: '#2563eb', bg: 'rgba(37,99,235,.10)', border: 'rgba(37,99,235,.25)' },
  hotel_business: { label: 'Premium', color: '#d97706', bg: 'rgba(217,119,6,.10)', border: 'rgba(217,119,6,.25)' },
};

const getSidebarSections = (role: string, featureFlags: string[]) => {
  // Roles alineados con src/config/rbac.ts ROUTE_ROLES
  const sections: Array<{
    title: string;
    items: Array<{ to: string; label: string; icon: () => JSX.Element; roles?: string[]; feature?: string }>;
  }> = [
      {
        title: 'Operativos',
        items: [
          { to: '/', label: 'Panel', icon: IconPanel, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'] },
          { to: '/habitaciones', label: 'Habitaciones', icon: IconServices, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'] },
          { to: '/housekeeping', label: 'Housekeeping', icon: IconSparkles, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'] },
          { to: '/mantenimiento', label: 'Mantenimiento', icon: IconWrench, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO'] },
          { to: '/reservas', label: 'Reservas', icon: IconReservations, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'] },
          { to: '/pagos', label: 'Pagos', icon: IconPayments, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'] },
          { to: '/clientes', label: 'Clientes', icon: IconClients, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'] },
          { to: '/empresas', label: 'Empresas', icon: IconBuilding, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'] },
          { to: '/cotizaciones', label: 'Cotizaciones', icon: IconQuotes, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'], feature: 'cotizaciones' },
          { to: '/estado-cuenta', label: 'Estado de Cuenta', icon: IconWallet, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'CONTADOR'] },
          { to: '/chat', label: 'Chat', icon: IconChat, roles: ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'] },
        ],
      },
      {
        title: 'Administración',
        items: [
          { to: '/finanzas', label: 'Ingresos', icon: IconPayments, roles: ['PROPIETARIO', 'ADMIN', 'CONTADOR'] },
          { to: '/tarifas', label: 'Tarifas', icon: IconRates, roles: ['PROPIETARIO', 'ADMIN'] },
          { to: '/exportar', label: 'Exportar Datos', icon: IconExport, roles: ['PROPIETARIO', 'ADMIN', 'CONTADOR'], feature: 'exportador_datos' },
          { to: '/importar-reservas', label: 'Importar', icon: IconUploadCloud, roles: ['PROPIETARIO', 'ADMIN'] },
          { to: '/config', label: 'Configuración', icon: IconSettings, roles: ['PROPIETARIO', 'ADMIN'] },
          { to: '/plantillas-correo', label: 'Plantillas Correo', icon: IconMail, roles: ['PROPIETARIO', 'ADMIN'], feature: 'email_studio' },
          { to: '/gestionar-roles', label: 'Roles y Permisos', icon: IconUsers, roles: ['PROPIETARIO'] },
          { to: '/auditoria', label: 'Auditoría', icon: IconShield, roles: ['PROPIETARIO', 'ADMIN'], feature: 'auditoria' },
        ],
      },
      {
        title: 'Reportes',
        items: [
          { to: '/reportes', label: 'Reportes', icon: IconChart, roles: ['PROPIETARIO', 'ADMIN', 'CONTADOR'], feature: 'reportes' },
        ],
      },
    ];

  // Filtrar secciones y items según el rol y los feature flags del plan
  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        (!item.roles || item.roles.includes(role)) &&
        (!item.feature || featureFlags.includes(item.feature))
      ),
    }))
    .filter(section => section.items.length > 0);
};

/* ── Items para rail (todos los items filtrados) ──────────── */
const getAllItems = (role: string, featureFlags: string[]) => {
  const sections = getSidebarSections(role, featureFlags);
  return sections.flatMap(s => s.items);
};

/* ── Iniciales de un hotel para su avatar (ej. "Hotel Solar" -> "HS") ── */
const getHotelInitials = (nombre?: string) => {
  if (!nombre) return 'H';
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
};

/* ── Componente ─────────────────────────────────────────── */
export const Sidebar: React.FC = () => {
  const { user, session, signOut } = useAuth();
  const { role } = useRole();
  const { hotel: syncHotel } = useSync();

  const getHubUrl = () => {
    const envHubUrl = import.meta.env.VITE_HUB_URL;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
      return envHubUrl || 'http://localhost:5174';
    }
    
    if (!envHubUrl || envHubUrl.includes('localhost') || envHubUrl.includes('127.0.0.1')) {
      const hostname = window.location.hostname;
      if (hostname.endsWith('.solarys.uk')) {
        return 'https://hub.solarys.uk';
      }
      if (hostname.includes('-gym')) {
        return `${window.location.protocol}//${hostname.replace('-gym', '-hub')}`;
      }
      if (hostname.includes('-hotel')) {
        return `${window.location.protocol}//${hostname.replace('-hotel', '-hub')}`;
      }
      const parts = hostname.split('.');
      if (parts.length > 2) {
        return `${window.location.protocol}//hub.${parts.slice(1).join('.')}`;
      }
      return 'https://hub.solarys.uk';
    }
    return envHubUrl;
  };

  const hubUrl = getHubUrl();

  const goToHub = () => {
    if (session) {
      const params = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      window.location.href = `${hubUrl}/dashboard?${params.toString()}`;
    } else {
      window.location.href = hubUrl;
    }
  };
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoteles, setHoteles] = useState<any[]>([]);
  const [activeHotelId, setActiveHotelId] = useState(localStorage.getItem('active_hotel_id') || '');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchHoteles()
      .then(data => {
        if (data && Array.isArray(data)) {
          setHoteles(data);
          // Garantizar selección de hotel individual activo
          const current = localStorage.getItem('active_hotel_id') || '';
          const exists = current && current !== 'all' && data.some((h: any) => h.id_hotel === current);
          if ((!exists || current === 'all') && data.length > 0) {
            const firstId = data[0].id_hotel;
            localStorage.setItem('active_hotel_id', firstId);
            setActiveHotelId(firstId);
            // Recargar para que todos los componentes usen el hotel correcto.
            // Sin esto, Dashboard y otros que ya iniciaron peticiones con el ID
            // antiguo mostrarían datos del usuario anterior.
            window.location.reload();
          } else if (current && current !== 'all') {
            setActiveHotelId(current);
          }
        }
      })
      .catch(err => console.error('Error loading hotels in sidebar:', err));
  }, []);

  const handleHotelChange = (val: string) => {
    if (val === 'all') return;
    localStorage.setItem('active_hotel_id', val);
    setActiveHotelId(val);
    setModalOpen(false);
    window.location.reload();
  };

  useEffect(() => {
    const handleUnreadUpdate = (ev: Event) => {
      const ce = ev as CustomEvent<number>;
      setUnreadCount(ce.detail ?? 0);
    };
    window.addEventListener('chat-unread-update', handleUnreadUpdate);

    // Carga inicial desde sessionStorage
    try {
      const cached = sessionStorage.getItem('chat-unread-count');
      if (cached) setUnreadCount(parseInt(cached, 10));
    } catch { }

    return () => {
      window.removeEventListener('chat-unread-update', handleUnreadUpdate);
    };
  }, []);

  const featureFlags = syncHotel?.plan?.feature_flags ?? [];
  const sidebarSections = getSidebarSections(role, featureFlags);
  const allItems = getAllItems(role, featureFlags);

  return (
    <div className="sidebar-cluster">
      {/* Rail compacto (visible por defecto) */}
      <aside className="sidebar-rail">
        <div className="sidebar-rail-head">
          <div style={{ position: 'relative' }}>
            <SolarisLogo variant="hotel" size={38} />
            {syncHotel?.plan?.id_plan && PLAN_BADGES[syncHotel.plan.id_plan] && (
              <div
                title={`Plan ${PLAN_BADGES[syncHotel.plan.id_plan].label}`}
                style={{
                  position: 'absolute',
                  bottom: -3,
                  right: -3,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: PLAN_BADGES[syncHotel.plan.id_plan].color,
                  border: '2px solid var(--shell-bg)',
                }}
              />
            )}
          </div>
          <div
            style={{
              marginTop: 10,
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              cursor: 'pointer'
            }}
            title="Hotel Individual Activo"
          >
            🏨
          </div>

        </div>

        <nav className="sidebar-rail-menu">
          {allItems.map(item => (
            <NavLink
              key={`rail-${item.to}`}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'sidebar-rail-item active' : 'sidebar-rail-item'}
              title={item.label}
              onClick={(e) => {
                if (item.to === '/chat') {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('open-right-chat', { detail: { tab: 'operativo' } }));
                }
              }}
            >
              <div className="sidebar-rail-icon" style={{ position: 'relative' }}>
                <item.icon />
                {item.to === '/chat' && unreadCount > 0 && (
                  <span className="sidebar-unread-badge-rail">{unreadCount}</span>
                )}
              </div>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingBottom: 10 }}>
          <button
            className="sidebar-rail-item"
            title="Volver al Hub"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: '8px' }}
            onClick={goToHub}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            className="sidebar-rail-item"
            title="Cerrar sesión"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            onClick={() => signOut()}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Sidebar completo (aparece en hover) */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-lockup sidebar-brand-lockup">
            <SolarisLogo variant="hotel" size={40} />
            <div className="brand-copy">
              <strong className="brand">Partner Central</strong>
              <span>Sistema hotelero</span>
            </div>
          </div>
        </div>

        <div style={{ padding: '4px 8px', marginTop: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
            Propiedad Activa
          </label>
          {(() => {
            const propiedadActiva = syncHotel
              ? { nombre_hotel: syncHotel.nombre_hotel, ciudad: hoteles.find(h => h.id_hotel === activeHotelId)?.ciudad }
              : hoteles.find(h => h.id_hotel === activeHotelId);
            const puedeCambiar = hoteles.length > 1;
            return (
              <button
                onClick={() => puedeCambiar && setModalOpen(true)}
                title={puedeCambiar ? 'Cambiar de propiedad' : 'Esta es tu única propiedad'}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--shell-border-strong)',
                  backgroundColor: 'rgba(0, 0, 0, 0.03)',
                  color: 'var(--text-h)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: puedeCambiar ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
                onMouseEnter={(e) => { if (puedeCambiar) e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--shell-border-strong)'; }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'var(--sidebar-item-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: 'var(--text-h)',
                }}>
                  {getHotelInitials(propiedadActiva?.nombre_hotel)}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {propiedadActiva?.nombre_hotel || 'Cargando...'}
                  </div>
                  {propiedadActiva?.ciudad && (
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {propiedadActiva.ciudad}
                    </div>
                  )}
                </div>
                {puedeCambiar && (
                  <div style={{ color: 'var(--muted)', display: 'flex', flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })()}
        </div>

        {(() => {
          const planInfo = syncHotel?.plan?.id_plan ? PLAN_BADGES[syncHotel.plan.id_plan] : null;
          if (!planInfo) return null;
          const isTopTier = syncHotel?.plan?.id_plan === 'hotel_business';
          return (
            <div style={{ padding: '6px 8px 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: planInfo.bg,
                  border: `1px solid ${planInfo.border}`,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 800, color: planInfo.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Plan {planInfo.label}
                </span>
                {!isTopTier && (
                  <a
                    href={`${hubUrl}/upgrade`}
                    style={{ fontSize: 11, fontWeight: 700, color: planInfo.color, textDecoration: 'none' }}
                  >
                    Mejorar →
                  </a>
                )}
              </div>
            </div>
          );
        })()}

        <nav className="menu">
          {sidebarSections.map((section, idx) => (
            <div
              key={section.title}
              className="sidebar-group"
              style={{ marginTop: idx === 0 ? 0 : 18 }}
            >
              <div className="sidebar-group-title">{section.title}</div>
              <div className="sidebar-group-items">
                {section.items.map((item, i) => (
                  <NavLink
                    key={`full-${item.to}`}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => isActive ? 'menu-item active' : 'menu-item'}
                    onClick={(e) => {
                      if (item.to === '/chat') {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent('open-right-chat', { detail: { tab: 'operativo' } }));
                      }
                    }}
                    style={{
                      animation: `fadeInUp 0.4s ${i * 0.04 + idx * 0.08}s both`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="menu-icon"><item.icon /></span>
                      <span className="menu-label">{item.label}</span>
                    </div>
                    {item.to === '/chat' && unreadCount > 0 && (
                      <span className="sidebar-unread-badge-full">{unreadCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>



        <footer className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 4 }}>
            <strong>{user?.email?.split('@')[0] ?? 'Usuario'}</strong>
            <span>{user?.email ?? 'Partner Central'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{role}</span>
          </div>
          <button
            onClick={goToHub}
            style={{
              marginTop: 6, width: '100%', padding: 9, borderRadius: 10,
              border: '1px solid rgba(37, 99, 235, 0.2)',
              background: 'rgba(37, 99, 235, 0.06)', color: '#2563eb',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all .18s ease'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(37, 99, 235, 0.12)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(37, 99, 235, 0.36)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(37, 99, 235, 0.06)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(37, 99, 235, 0.2)';
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Volver al Hub
          </button>
          <NavLink
            to="/perfil"
            className={({ isActive }) => isActive ? 'logout-button active' : 'logout-button'}
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" />
            </svg>
            Mi Perfil
          </NavLink>
          <button className="logout-button" onClick={() => signOut()}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Cerrar Sesión
          </button>
        </footer>
      </aside>


      {/* MODAL DE SELECCIÓN DE PROPIEDAD */}
      {modalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            backgroundColor: 'var(--shell-panel-strong)',
            border: '1px solid var(--shell-border-strong)',
            borderRadius: '16px',
            width: '90%', maxWidth: '450px',
            boxShadow: 'var(--shadow)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeInUp 0.3s ease-out'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--shell-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--text-h)', fontSize: 18, fontWeight: 700 }}>Cambiar Propiedad</h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: 13 }}>Selecciona el entorno de trabajo activo</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ padding: '12px', maxHeight: '60vh', overflowY: 'auto' }}>
              {hoteles.map((h: any) => (
                <div
                  key={h.id_hotel}
                  onClick={() => handleHotelChange(h.id_hotel)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    marginBottom: 8,
                    backgroundColor: activeHotelId === h.id_hotel ? 'var(--accent-bg)' : 'transparent',
                    border: activeHotelId === h.id_hotel ? '1px solid var(--accent-border)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                  onMouseEnter={(e) => { if (activeHotelId !== h.id_hotel) e.currentTarget.style.backgroundColor = 'var(--sidebar-item-hover)' }}
                  onMouseLeave={(e) => { if (activeHotelId !== h.id_hotel) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'var(--sidebar-item-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{getHotelInitials(h.nombre_hotel)}</div>
                    <div>
                      <div style={{ color: 'var(--text-h)', fontWeight: 600, fontSize: 15 }}>{h.nombre_hotel}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{h.ciudad || 'Operación regular'}</div>
                    </div>
                  </div>
                  {activeHotelId === h.id_hotel && <span style={{ color: 'var(--accent)' }}><IconCheck /></span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
