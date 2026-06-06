import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ChatOperativo from './ChatOperativo';
import { AsistenteAI } from './AsistenteAI';
import { MessageSquare, Bot, ChevronRight, ChevronLeft } from 'lucide-react';

export const RightSidebarChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'operativo' | 'ai'>('operativo');
  const [unreadCount, setUnreadCount] = useState(0);

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
          width: 480px;
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
      `}</style>

      {/* Collapsed Trigger Floating Button */}
      {!isOpen && (
        <button
          className="right-sidebar-handle"
          onClick={() => setIsOpen(true)}
          title="Abrir Chat & Asistente AI"
        >
          {activeTab === 'operativo' ? (
            <MessageSquare size={20} />
          ) : (
            <Bot size={20} />
          )}
          {unreadCount > 0 && (
            <span className="right-sidebar-handle-badge">{unreadCount}</span>
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
                <button
                  className={`right-sidebar-tab-btn${activeTab === 'ai' ? ' active' : ''}`}
                  onClick={() => setActiveTab('ai')}
                >
                  <Bot size={13} />
                  Asistente AI
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
              ) : (
                <AsistenteAI embedded />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
