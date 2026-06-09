import React, { useState, useEffect, useRef } from 'react';
import { fetchEmailPreview, sendCustomEmailApi } from '../api/bookingsService';

interface EmailStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  defaultType?: 'confirmation' | 'update' | 'cancellation';
  defaultChanges?: string[];
}

export const EmailStudioModal: React.FC<EmailStudioModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  defaultType = 'confirmation',
  defaultChanges = [],
}) => {
  const [type, setType] = useState<'confirmation' | 'update' | 'cancellation'>(defaultType);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [modifiedHtml, setModifiedHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Cargar datos predeterminados
  const loadDefaultPreview = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetchEmailPreview(bookingId, type, defaultChanges);
      setTo(res.guestEmail);
      setSubject(res.subject);
      setHtml(res.html);
      setModifiedHtml(res.html);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error al cargar previsualización' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && bookingId) {
      loadDefaultPreview();
    }
  }, [isOpen, bookingId, type]);

  // Habilitar la edición en caliente en el iframe
  const handleIframeLoad = () => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    // Selectores de los elementos de texto en la plantilla
    const editableSelectors = [
      '.greeting', 
      '.msg', 
      '.alert', 
      '.footer-text', 
      '.header-subtitle', 
      '.btn-accept', 
      '.btn-reject',
      'li',
      '.total-label',
      '.decision-title',
      '.decision-sub'
    ];

    editableSelectors.forEach(sel => {
      const elements = iframeDoc.querySelectorAll(sel);
      elements.forEach(el => {
        el.setAttribute('contenteditable', 'true');
        // Estilo visual Canva-like cuando pasa el cursor
        const baseStyle = el.getAttribute('style') || '';
        el.setAttribute('style', `${baseStyle}; outline: 1px dashed rgba(59, 130, 246, 0.4); padding: 4px; border-radius: 4px; cursor: text; transition: all 0.2s;`);

        // Efectos hover
        el.addEventListener('mouseenter', () => {
          (el as HTMLElement).style.outlineColor = '#3b82f6';
          (el as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
        });
        el.addEventListener('mouseleave', () => {
          (el as HTMLElement).style.outlineColor = 'rgba(59, 130, 246, 0.4)';
          (el as HTMLElement).style.backgroundColor = 'transparent';
        });

        // Registrar cambios al editar el texto
        el.addEventListener('input', () => {
          setModifiedHtml(iframeDoc.documentElement.outerHTML);
        });
      });
    });
  };

  const handleSend = async () => {
    if (!to || !subject || !modifiedHtml) {
      setStatus({ type: 'error', message: 'Faltan campos obligatorios' });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      // Remover atributos contenteditable y estilos de edición del HTML antes de enviar
      const parser = new DOMParser();
      const doc = parser.parseFromString(modifiedHtml, 'text/html');
      doc.querySelectorAll('[contenteditable]').forEach(el => {
        el.removeAttribute('contenteditable');
        // Limpiar estilos temporales
        const style = el.getAttribute('style') || '';
        const cleanStyle = style
          .replace(/outline:[^;]+;?/g, '')
          .replace(/background-color:[^;]+;?/g, '')
          .replace(/cursor:[^;]+;?/g, '')
          .replace(/padding:[^;]+;?/g, '')
          .trim();
        if (cleanStyle) {
          el.setAttribute('style', cleanStyle);
        } else {
          el.removeAttribute('style');
        }
      });

      const cleanHtml = doc.documentElement.outerHTML;

      await sendCustomEmailApi(bookingId, to, subject, cleanHtml);
      setStatus({ type: 'success', message: '¡Correo enviado exitosamente!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Error al enviar el correo' });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop}>
      <div style={styles.container}>
        {/* Cabecera */}
        <div style={styles.header}>
          <div style={styles.headerTitleGroup}>
            <span style={styles.headerIcon}>✉️</span>
            <div>
              <h2 style={styles.title}>Solaris Email Studio</h2>
              <p style={styles.subtitle}>Diseña y personaliza el correo del huésped antes de enviarlo</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeButton}>&times;</button>
        </div>

        {/* Cuerpo */}
        <div style={styles.body}>
          {/* Panel Izquierdo: Configuración */}
          <div style={styles.leftPanel}>
            <div style={styles.sectionTitle}>Ajustes del Correo</div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Tipo de Plantilla</label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value as any)}
                style={styles.select}
              >
                <option value="confirmation">Confirmación de Reserva</option>
                <option value="update">Modificación de Reserva</option>
                <option value="cancellation">Cancelación de Reserva</option>
              </select>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Destinatario (Email)</label>
              <input 
                type="email" 
                value={to} 
                onChange={(e) => setTo(e.target.value)}
                placeholder="correo@huesped.com"
                style={styles.input}
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Asunto del Correo</label>
              <input 
                type="text" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Asunto"
                style={styles.input}
              />
            </div>

            <div style={styles.variablesCard}>
              <div style={styles.variablesTitle}>✨ Consejo de Edición Canva</div>
              <p style={styles.variablesText}>
                ¡Haz clic en cualquier texto bordeado en el panel de la derecha para escribir directamente sobre el diseño! 
                Puedes reescribir saludos, observaciones o notas especiales.
              </p>
            </div>

            <button 
              onClick={loadDefaultPreview} 
              disabled={loading}
              style={styles.resetButton}
            >
              🔄 Restablecer Plantilla Original
            </button>
          </div>

          {/* Panel Derecho: Editor Visual */}
          <div style={styles.rightPanel}>
            <div style={styles.previewHeader}>
              <span style={styles.previewTitle}>Vista Previa Interactiva</span>
              <div style={styles.toggleGroup}>
                <button 
                  onClick={() => setPreviewMode('desktop')} 
                  style={{...styles.toggleBtn, ...(previewMode === 'desktop' ? styles.toggleBtnActive : {})}}
                >
                  🖥️ Escritorio
                </button>
                <button 
                  onClick={() => setPreviewMode('mobile')} 
                  style={{...styles.toggleBtn, ...(previewMode === 'mobile' ? styles.toggleBtnActive : {})}}
                >
                  📱 Móvil
                </button>
              </div>
            </div>

            <div style={styles.previewContainer}>
              {loading ? (
                <div style={styles.loadingSpinner}>Cargando plantilla visual...</div>
              ) : (
                <div style={{
                  ...styles.iframeWrapper,
                  width: previewMode === 'desktop' ? '100%' : '380px'
                }}>
                  <iframe 
                    ref={iframeRef}
                    srcDoc={html}
                    onLoad={handleIframeLoad}
                    title="Live Email Editor"
                    style={styles.iframe}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Barra de Estado / Alertas */}
        {status && (
          <div style={{
            ...styles.statusBar,
            backgroundColor: status.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: status.type === 'success' ? '#166534' : '#991b1b',
          }}>
            {status.message}
          </div>
        )}

        {/* Footer Acciones */}
        <div style={styles.footer}>
          <button 
            onClick={onClose} 
            style={styles.cancelBtn}
            disabled={sending}
          >
            Cancelar
          </button>
          <button 
            onClick={handleSend} 
            style={styles.sendBtn}
            disabled={sending || loading}
          >
            {sending ? 'Enviando Correo...' : '✉️ Enviar Correo Personalizado'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    width: '90vw',
    maxWidth: '1200px',
    height: '85vh',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontFamily: 'Inter, sans-serif',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  headerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIcon: {
    fontSize: '28px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
  },
  subtitle: {
    margin: '2px 0 0 0',
    fontSize: '12px',
    color: '#64748b',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  leftPanel: {
    width: '320px',
    borderRight: '1px solid #e2e8f0',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    overflowY: 'auto',
    backgroundColor: '#f8fafc',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#64748b',
  },
  select: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    color: '#0f172a',
    outline: 'none',
  },
  variablesCard: {
    backgroundColor: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '10px',
    padding: '14px 16px',
  },
  variablesTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#1d4ed8',
    marginBottom: '6px',
  },
  variablesText: {
    margin: 0,
    fontSize: '11px',
    lineHeight: 1.5,
    color: '#1e40af',
  },
  resetButton: {
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#475569',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f1f5f9',
  },
  previewHeader: {
    padding: '14px 24px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#334155',
  },
  toggleGroup: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    padding: '2px',
    borderRadius: '8px',
  },
  toggleBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#64748b',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  previewContainer: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflowY: 'auto',
  },
  iframeWrapper: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    overflow: 'hidden',
    transition: 'width 0.3s ease',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  loadingSpinner: {
    fontSize: '14px',
    color: '#64748b',
  },
  statusBar: {
    padding: '10px 24px',
    fontSize: '12px',
    fontWeight: 500,
    textAlign: 'center',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    backgroundColor: '#f8fafc',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  sendBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
};
