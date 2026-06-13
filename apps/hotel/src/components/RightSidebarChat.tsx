import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatOperativo from './ChatOperativo';
import { AsistenteAI } from './AsistenteAI';
import { NotificationsPanel } from './NotificationsPanel';
import { MessageSquare, Bot, Bell, ChevronRight, ChevronLeft } from 'lucide-react';
import { useHasFeature } from '../hooks/usePlanFeature';
import { fetchUnreadCount } from '../api/notificacionesService';
import { getSocket } from '../api/chatService';
import { playNotificationChime } from '../utils/notificationSound';

const NOTIF_SOUND_INTERVAL_MS = 5 * 60 * 1000;

export const RightSidebarChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'operativo' | 'ai' | 'notificaciones'>('operativo');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('notif-sound-enabled') !== 'false'; } catch { return true; }
  });
  const hasAIAssistant = useHasFeature('ai_asistente');

  // Conteo inicial de notificaciones no leídas + actualización en tiempo real
  useEffect(() => {
    fetchUnreadCount().then(setNotifUnread).catch(() => {});

    const activeHotelId = localStorage.getItem('active_hotel_id');
    if (activeHotelId) {
      getSocket().emit('join_hotel', activeHotelId);
    }

    const onNueva = () => setNotifUnread(c => c + 1);
    const s = getSocket();
    s.on('nueva_notificacion', onNueva);
    return () => { s.off('nueva_notificacion', onNueva); };
  }, []);

  const handleNotifUnreadChange = useCallback((count: number) => {
    setNotifUnread(count);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('notif-sound-enabled', String(next)); } catch {}
      return next;
    });
  }, []);

  // Timbre recordatorio cada 5 minutos mientras haya notificaciones sin leer
  useEffect(() => {
    const interval = setInterval(() => {
      if (soundEnabled && notifUnread > 0) {
        playNotificationChime();
      }
    }, NOTIF_SOUND_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [soundEnabled, notifUnread]);

  // Synchronize unread count from session storage / global event
  useEffect(() => {
    const handleUnreadUpdate = (ev: Event) => {
      const ce = ev as CustomEvent<number>;
      setUnreadCount(ce.detail ?? 0);
    };
    window.addEventListener('chat-unread-update', handleUnreadUpdate);

    // Initial load
    try {
      const cached = sessionStorage.getItem('chat-unread-count');
      if (cached) setUnreadCount(parseInt(cached, 10));
    } catch { }

    return () => {
      window.removeEventListener('chat-unread-update', handleUnreadUpdate);
    };
  }, []);

  // Listen to open-right-chat global trigger
  useEffect(() => {
    const handleOpen = (ev: Event) => {
      const ce = ev as CustomEvent<{ tab?: 'operativo' | 'ai' }>;
      setIsOpen(true);
      if (ce.detail?.tab) {
        setActiveTab(ce.detail.tab);
      }
    };
    window.addEventListener('open-right-chat', handleOpen);
    return () => window.removeEventListener('open-right-chat', handleOpen);
  }, []);

  // Si el plan pierde el acceso al Asistente IA mientras está activo, volver al chat operativo
  useEffect(() => {
    if (!hasAIAssistant && activeTab === 'ai') {
      setActiveTab('operativo');
    }
  }, [hasAIAssistant, activeTab]);

  // Toggle class on the dashboard-root element to shift/push the content
  useEffect(() => {
    const root = document.querySelector('.dashboard-root');
    if (root) {
      if (isOpen) {
        root.classList.add('right-sidebar-open');
      } else {
        root.classList.remove('right-sidebar-open');
      }
    }
    return () => {
      if (root) {
        root.classList.remove('right-sidebar-open');
      }
    };
  }, [isOpen]);

  return (
    <>
      <style>{`
        /* Sidebar container positioning */
        .right-sidebar-container {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: 720px;
          z-index: 990;
          display: flex;
          flex-direction: column;
          background: var(--shell-panel-strong);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-left: 1px solid var(--shell-border-strong);
          box-shadow: -8px 0 32px rgba(2, 6, 23, 0.18);
          overflow: hidden;
        }

        /* Top options header */
        .right-sidebar-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--shell-border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(15, 23, 42, 0.12);
        }

        /* Segmented control tabs */
        .right-sidebar-tabs {
          display: flex;
          background: var(--shell-bg);
          padding: 4px;
          border-radius: 999px;
          border: 1px solid var(--shell-border-strong);
          gap: 2px;
        }

        .right-sidebar-tab-btn {
          border: none;
          background: transparent;
          color: var(--muted);
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .right-sidebar-tab-btn:hover {
          color: var(--text-h);
        }

        .right-sidebar-tab-btn.active {
          background: var(--accent);
          color: #fff;
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.22);
        }

        /* Folding button */
        .right-sidebar-fold-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid var(--shell-border-strong);
          background: var(--shell-bg);
          color: var(--muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .right-sidebar-fold-btn:hover {
          color: var(--text-h);
          border-color: var(--accent);
          transform: scale(1.05);
        }

        /* Embedded component wrapper */
        .right-sidebar-content {
          flex: 1;
          overflow: hidden;
          position: relative;
        }

        /* Floating handle when collapsed */
        .right-sidebar-handle {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: #fff;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35);
          z-index: 980;
          transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .right-sidebar-handle:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 32px rgba(37, 99, 235, 0.45);
        }

        .right-sidebar-handle-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--danger);
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 999px;
          padding: 2px 6px;
          border: 2px solid var(--shell-panel-strong);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .right-sidebar-handle-badge-notif {
          position: absolute;
          bottom: -4px;
          left: -4px;
          background: #ef4444;
          color: white;
          font-size: 10px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          border: 2px solid var(--shell-panel-strong);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        @keyframes right-sidebar-handle-shake {
          0%, 100% { transform: translateX(0) translateY(0); }
          10% { transform: translateX(-3px) translateY(-1px); }
          20% { transform: translateX(3px) translateY(1px); }
          30% { transform: translateX(-3px) translateY(-1px); }
          40% { transform: translateX(3px) translateY(1px); }
          50% { transform: translateX(-2px); }
          60% { transform: translateX(2px); }
          70%, 100% { transform: translateX(0); }
        }

        @keyframes right-sidebar-handle-glow {
          0%, 100% { box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35), 0 0 0 0 rgba(239, 68, 68, 0.55); }
          50% { box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35), 0 0 0 10px rgba(239, 68, 68, 0); }
        }

        .right-sidebar-handle.has-unread-notif {
          animation: right-sidebar-handle-glow 2.2s ease-in-out infinite, right-sidebar-handle-shake 4s ease-in-out infinite;
        }
      `}</style>

      {/* Collapsed Trigger Floating Button */}
      {!isOpen && (
        <button
          className={`right-sidebar-handle${notifUnread > 0 ? ' has-unread-notif' : ''}`}
          onClick={() => setIsOpen(true)}
          title="Abrir Chat & Asistente AI"
        >
          {activeTab === 'operativo' ? (
            <MessageSquare size={20} />
          ) : activeTab === 'ai' ? (
            <Bot size={20} />
          ) : (
            <Bell size={20} />
          )}
          {unreadCount > 0 && (
            <span className="right-sidebar-handle-badge">{unreadCount}</span>
          )}
          {notifUnread > 0 && (
            <span className="right-sidebar-handle-badge-notif">{notifUnread > 9 ? '9+' : notifUnread}</span>
          )}
        </button>
      )}

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="right-sidebar-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          >
            {/* Upper controls bar */}
            <div className="right-sidebar-header">
              {/* Tab Selector Options */}
              <div className="right-sidebar-tabs">
                <button
                  className={`right-sidebar-tab-btn${activeTab === 'operativo' ? ' active' : ''}`}
                  onClick={() => setActiveTab('operativo')}
                >
                  <MessageSquare size={13} />
                  Chat
                </button>
                {hasAIAssistant && (
                  <button
                    className={`right-sidebar-tab-btn${activeTab === 'ai' ? ' active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                  >
                    <Bot size={13} />
                    Asistente AI
                  </button>
                )}
                <button
                  className={`right-sidebar-tab-btn${activeTab === 'notificaciones' ? ' active' : ''}`}
                  onClick={() => setActiveTab('notificaciones')}
                >
                  <Bell size={13} />
                  Notificaciones
                  {notifUnread > 0 && (
                    <span className="right-sidebar-handle-badge-notif" style={{ position: 'static', marginLeft: 2 }}>
                      {notifUnread > 9 ? '9+' : notifUnread}
                    </span>
                  )}
                </button>
              </div>

              {/* Fold button */}
              <button
                className="right-sidebar-fold-btn"
                onClick={() => setIsOpen(false)}
                title="Plegar chat"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Embedded Views */}
            <div className="right-sidebar-content">
              {activeTab === 'operativo' ? (
                <ChatOperativo embedded />
              ) : activeTab === 'ai' ? (
                <AsistenteAI embedded />
              ) : (
                <NotificationsPanel
                  embedded
                  onUnreadChange={handleNotifUnreadChange}
                  soundEnabled={soundEnabled}
                  onToggleSound={toggleSound}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
