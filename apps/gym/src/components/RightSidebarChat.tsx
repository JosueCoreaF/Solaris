import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AsistenteAI } from './AsistenteAI';
import { Bot, ChevronRight } from 'lucide-react';

export const RightSidebarChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Toggle class on the dashboard-root element if needed to push/shift the layout
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

  // Support global events to open the Apolo assistant from other views if needed
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-gym-ai', handleOpen);
    return () => window.removeEventListener('open-gym-ai', handleOpen);
  }, []);

  return (
    <>
      <style>{`
        /* Push the main layout stage when the sidebar is open */
        .dashboard-shell {
          transition: margin-right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }

        @media (min-width: 641px) {
          .dashboard-root.right-sidebar-open .dashboard-shell {
            margin-right: 500px;
          }
        }

        /* Sidebar container positioning */
        .right-sidebar-container {
          position: fixed;
          top: 0;
          right: 0;
          height: 100vh;
          width: 500px; /* Slimmer for gym module focus */
          z-index: 990;
          display: flex;
          flex-direction: column;
          background: var(--shell-panel-strong);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-left: 1px solid var(--shell-border-strong);
          box-shadow: -8px 0 32px rgba(2, 6, 23, 0.25);
          overflow: hidden;
        }

        @media (max-width: 640px) {
          .right-sidebar-container {
            width: 100%;
          }
        }

        /* Top options header */
        .right-sidebar-header-bar {
          padding: 14px 20px;
          border-bottom: 1px solid var(--shell-border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(20, 23, 28, 0.4);
        }

        /* Folding button */
        .right-sidebar-fold-btn {
          width: 32px;
          height: 32px;
          border-radius: 4px;
          border: 1px solid var(--shell-border-strong);
          background: var(--surface-raised);
          color: var(--text-h);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .right-sidebar-fold-btn:hover {
          color: var(--accent-ink);
          background: var(--accent);
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
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--accent);
          color: var(--accent-ink);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(var(--accent-rgb), 0.35);
          z-index: 980;
          transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .right-sidebar-handle:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 12px 32px rgba(var(--accent-rgb), 0.45);
        }

        .right-sidebar-title-heading {
          font-family: var(--display);
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-h);
          display: flex;
          align-items: center;
          gap: 8px;
        }
      `}</style>

      {/* Collapsed Trigger Floating Button */}
      {!isOpen && (
        <button
          className="right-sidebar-handle"
          onClick={() => setIsOpen(true)}
          title="Abrir Asistente AI Apolo"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' // Technical fitness hexagon style
          }}
        >
          <Bot size={22} />
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
            <div className="right-sidebar-header-bar">
              <div className="right-sidebar-title-heading">
                <Bot size={16} className="text-[var(--accent)]" />
                <span>Asistente Apolo</span>
              </div>

              {/* Fold button */}
              <button
                className="right-sidebar-fold-btn"
                onClick={() => setIsOpen(false)}
                title="Cerrar panel"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Embedded View */}
            <div className="right-sidebar-content">
              <AsistenteAI embedded />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
