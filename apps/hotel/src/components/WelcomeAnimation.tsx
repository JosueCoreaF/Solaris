import React, { useEffect, useState } from 'react';

interface WelcomeAnimationProps {
  nombre: string;
  onDone: () => void;
  duracionMs?: number;
}

/**
 * Overlay de bienvenida tras iniciar sesión, con la misma estética
 * (colores, tipografía y badge) que la pantalla de login.
 * Se auto-destruye llamando a onDone() después de duracionMs.
 */
export const WelcomeAnimation: React.FC<WelcomeAnimationProps> = ({ nombre, onDone, duracionMs = 1600 }) => {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setSaliendo(true), duracionMs - 300);
    const doneTimer = setTimeout(onDone, duracionMs);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [duracionMs, onDone]);

  return (
    <div className={`welcome-anim-overlay ${saliendo ? 'welcome-anim-out' : ''}`}>
      <style>{`
        @keyframes wa-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes wa-fade-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes wa-badge-in {
          from { opacity: 0; transform: scale(.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes wa-text-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wa-ring-pulse {
          0%   { transform: scale(1); opacity: .35; }
          100% { transform: scale(1.6); opacity: 0; }
        }

        .welcome-anim-overlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--shell-bg, #f8fafc);
          animation: wa-fade-in .25s ease-out;
        }
        .welcome-anim-overlay.welcome-anim-out {
          animation: wa-fade-out .3s ease-in forwards;
        }

        .wa-badge-wrap {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .wa-ring {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          border: 1.5px solid var(--accent, #2563eb);
          animation: wa-ring-pulse 1.8s ease-out infinite;
        }
        .wa-badge {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--accent, #2563eb), var(--accent-strong, #1d4ed8));
          color: #fff;
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 8px 20px rgba(37, 99, 235, 0.24);
          opacity: 0;
          animation: wa-badge-in .4s ease-out forwards;
        }

        .wa-title {
          font-family: 'Outfit', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--text-h, #0f172a);
          margin: 0;
          text-align: center;
          opacity: 0;
          animation: wa-text-in .4s .15s ease-out forwards;
        }
        .wa-sub {
          margin-top: 6px;
          font-size: 13px;
          color: var(--muted, #64748b);
          opacity: 0;
          animation: wa-text-in .4s .25s ease-out forwards;
        }
      `}</style>

      <div className="wa-badge-wrap">
        <div className="wa-ring" />
        <div className="wa-badge">PC</div>
      </div>

      <h1 className="wa-title">Bienvenido, {nombre}</h1>
      <p className="wa-sub">Preparando tu panel...</p>
    </div>
  );
};

export default WelcomeAnimation;
