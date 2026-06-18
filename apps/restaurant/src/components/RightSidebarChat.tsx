import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatOperativo } from './ChatOperativo';
import { AsistenteAI } from './AsistenteAI';
import { useRestaurant } from '../context/RestaurantContext';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
.right-sidebar-container {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 620px;
  display: flex;
  flex-direction: column;
  z-index: 1000;
  box-shadow: -4px 0 32px rgba(0,0,0,0.18);
  overflow: hidden;
  background: var(--shell-bg);
}
.right-sidebar-handle {
  position: fixed;
  bottom: 28px;
  right: 28px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 20px rgba(249,115,22,.45);
  z-index: 999;
  transition: transform .15s, box-shadow .15s;
}
.right-sidebar-handle:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px rgba(249,115,22,.55);
}
.right-sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--shell-border);
  background: var(--shell-panel);
  flex-shrink: 0;
}
.right-sidebar-tab {
  flex: 1;
  padding: 13px 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color .15s, border-bottom-color .15s;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.right-sidebar-tab:hover { color: var(--text-h); }
.right-sidebar-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.right-sidebar-close {
  padding: 0 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--muted);
  display: flex;
  align-items: center;
  transition: color .15s;
  flex-shrink: 0;
}
.right-sidebar-close:hover { color: var(--text-h); }
.right-sidebar-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* Panel flota encima sin empujar el contenido */
`;

type Tab = 'chat' | 'ia';

export const RightSidebarChat: React.FC = () => {
  const { restaurant } = useRestaurant();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('chat');

  // Guardar ID del restaurante en localStorage para chatService
  useEffect(() => {
    if (restaurant?.id_restaurant) {
      localStorage.setItem('active_restaurant_id', restaurant.id_restaurant);
    }
  }, [restaurant?.id_restaurant]);

  // Abre el panel en la tab IA cuando el sidebar lo solicita
  useEffect(() => {
    const handler = () => { setOpen(true); setTab('ia'); };
    window.addEventListener('solaris:open-ai-chat', handler);
    return () => window.removeEventListener('solaris:open-ai-chat', handler);
  }, []);

  return (
    <>
      <style>{CSS}</style>

      {/* Botón flotante */}
      <motion.button
        className="right-sidebar-handle"
        onClick={() => setOpen(o => !o)}
        whileTap={{ scale: 0.92 }}
        title={open ? 'Cerrar panel' : 'Abrir Chat y Sol IA'}
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="close" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <circle cx="17" cy="9" r="3" fill="currentColor" stroke="none" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel lateral */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="right-sidebar-container"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 35 }}
          >
            {/* Tabs */}
            <div className="right-sidebar-tabs">
              <button
                className={`right-sidebar-tab${tab === 'chat' ? ' active' : ''}`}
                onClick={() => setTab('chat')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat Operativo
              </button>
              <button
                className={`right-sidebar-tab${tab === 'ia' ? ' active' : ''}`}
                onClick={() => setTab('ia')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                Sol IA
              </button>
              <button
                className="right-sidebar-close"
                onClick={() => setOpen(false)}
                title="Cerrar panel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Contenido */}
            <div className="right-sidebar-content">
              {tab === 'chat' ? <ChatOperativo /> : <AsistenteAI />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default RightSidebarChat;
