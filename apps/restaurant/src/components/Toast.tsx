import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastCtx { addToast: (message: string, type?: ToastType, duration?: number) => void; }

const ToastContext = createContext<ToastCtx>({ addToast: () => {} });

const ToastIcon: React.FC<{ type: ToastType }> = ({ type }) => {
  const props = { size: 15, style: { flexShrink: 0 } };
  if (type === 'success') return <CheckCircle {...props} />;
  if (type === 'error') return <XCircle {...props} />;
  if (type === 'warning') return <AlertTriangle {...props} />;
  return <Info {...props} />;
};

let counter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = ++counter;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span style={{ fontWeight: 700, flexShrink: 0, display: 'flex' }}>
              <ToastIcon type={t.type} />
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
