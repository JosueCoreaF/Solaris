import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Volume2, VolumeX } from 'lucide-react';
import { getSocket } from '../api/chatService';
import {
  fetchNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type Notificacion,
} from '../api/notificacionesService';

const IconBell = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IconCalendarCheck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M9 16l2 2 4-4" />
  </svg>
);

const IconFileCheck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 15l1.5 1.5L15 12" />
  </svg>
);

const IconMessageCircle = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const TIPO_META: Record<string, { icon: () => JSX.Element; color: string; bg: string }> = {
  reserva_web: { icon: IconCalendarCheck, color: '#2563eb', bg: 'rgba(37,99,235,.10)' },
  cotizacion_aceptada: { icon: IconFileCheck, color: '#10b981', bg: 'rgba(16,185,129,.10)' },
  mensaje_cliente: { icon: IconMessageCircle, color: '#a855f7', bg: 'rgba(168,85,247,.10)' },
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

interface NotificationsPanelProps {
  embedded?: boolean;
  onUnreadChange?: (count: number) => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ onUnreadChange, soundEnabled, onToggleSound }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notificacion[]>([]);

  useEffect(() => {
    fetchNotificaciones().then(setItems).catch(() => {});

    const activeHotelId = localStorage.getItem('active_hotel_id');
    if (activeHotelId) {
      getSocket().emit('join_hotel', activeHotelId);
    }

    const onNueva = (notif: Notificacion) => {
      setItems(prev => [notif, ...prev].slice(0, 50));
    };

    const s = getSocket();
    s.on('nueva_notificacion', onNueva);
    return () => { s.off('nueva_notificacion', onNueva); };
  }, []);

  useEffect(() => {
    onUnreadChange?.(items.filter(n => !n.leida).length);
  }, [items, onUnreadChange]);

  const unreadCount = items.filter(n => !n.leida).length;

  const handleItemClick = (notif: Notificacion) => {
    if (!notif.leida) {
      setItems(prev => prev.map(n => n.id_notificacion === notif.id_notificacion ? { ...n, leida: true } : n));
      marcarNotificacionLeida(notif.id_notificacion).catch(() => {});
    }
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = () => {
    setItems(prev => prev.map(n => ({ ...n, leida: true })));
    marcarTodasLeidas().catch(() => {});
  };

  return (
    <div className="notif-panel">
      <div className="notif-panel-header">
        <span>Notificaciones</span>
        <div className="notif-panel-header-actions">
          {unreadCount > 0 && (
            <button className="notif-mark-all" onClick={handleMarkAllRead}>Marcar todas como leídas</button>
          )}
          {onToggleSound && (
            <button
              className="notif-sound-toggle"
              onClick={onToggleSound}
              title={soundEnabled ? 'Desactivar recordatorio sonoro' : 'Activar recordatorio sonoro'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          )}
        </div>
      </div>
      <div className="notif-panel-list">
        {items.length === 0 && (
          <div className="notif-empty">No tienes notificaciones</div>
        )}
        {items.map(notif => {
          const meta = TIPO_META[notif.tipo] ?? { icon: IconBell, color: '#64748b', bg: 'rgba(100,116,139,.10)' };
          const Icon = meta.icon;
          return (
            <button
              key={notif.id_notificacion}
              className={`notif-item ${notif.leida ? '' : 'unread'}`}
              onClick={() => handleItemClick(notif)}
            >
              <div className="notif-item-icon" style={{ color: meta.color, background: meta.bg }}>
                <Icon />
              </div>
              <div className="notif-item-body">
                <div className="notif-item-title">{notif.titulo}</div>
                {notif.mensaje && <div className="notif-item-msg">{notif.mensaje}</div>}
                <div className="notif-item-time">{formatRelativeTime(notif.created_at)}</div>
              </div>
              {!notif.leida && <span className="notif-item-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationsPanel;
