import React, { useEffect, useState, useRef } from 'react';

interface Room360ViewerProps {
  imageUrl: string;
  roomName: string;
  onClose: () => void;
}

declare global {
  interface Window {
    pannellum: any;
  }
}

export const Room360Viewer: React.FC<Room360ViewerProps> = ({ imageUrl, roomName, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    // 1. Cargar CSS de Pannellum
    const cssId = 'pannellum-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
      document.head.appendChild(link);
    }

    // 2. Cargar Script de Pannellum
    const scriptId = 'pannellum-js';
    const initViewer = () => {
      if (window.pannellum && containerRef.current) {
        try {
          viewerRef.current = window.pannellum.viewer(containerRef.current, {
            type: 'equirectangular',
            panorama: imageUrl,
            autoLoad: true,
            autoRotate: -1.5, // Rotación suave automática
            compass: false,
            showControls: true,
            dragToLook: true,
            hfov: 110, // Campo de visión inicial cómodo
            minHfov: 50,
            maxHfov: 120
          });

          // Listener de carga completada
          viewerRef.current.on('load', () => setLoading(false));
          viewerRef.current.on('error', () => {
            setError(true);
            setLoading(false);
          });
        } catch (e) {
          console.error("Error al iniciar Pannellum:", e);
          setError(true);
          setLoading(false);
        }
      }
    };

    if (!window.pannellum) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
      script.async = true;
      script.onload = () => {
        initViewer();
      };
      document.body.appendChild(script);
    } else {
      // Retrasar una pizca para asegurar el montaje del div
      const t = setTimeout(initViewer, 100);
      return () => clearTimeout(t);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
      }
    };
  }, [imageUrl]);

  return (
    <div className="tour-360-overlay">
      <div className="tour-360-modal">
        {/* Encabezado */}
        <div className="tour-360-header">
          <div>
            <h3>Recorrido Virtual 360°</h3>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>{roomName}</p>
          </div>
          <button className="tour-360-close-btn" onClick={onClose} aria-label="Cerrar recorrido">
            ×
          </button>
        </div>

        {/* Contenedor del Visor */}
        <div className="tour-360-viewer-box">
          {loading && (
            <div className="tour-360-loading">
              <div className="tour-360-spinner"></div>
              <span>Preparando la vista tridimensional...</span>
            </div>
          )}

          {error && (
            <div className="tour-360-error">
              No pudimos cargar la imagen panorámica. Verifica que el enlace sea correcto y sea de tipo equirectangular.
            </div>
          )}

          <div 
            ref={containerRef} 
            style={{ width: '100%', height: '100%', borderRadius: '12px', background: '#000' }} 
          />
        </div>

        {/* Instrucciones de uso */}
        <div className="tour-360-footer">
          <strong>Tip de uso:</strong> Mantén presionado tu dedo o mouse y arrastra para mirar en cualquier dirección. Usa la rueda del mouse o los botones +/- para hacer zoom.
        </div>
      </div>
    </div>
  );
};
