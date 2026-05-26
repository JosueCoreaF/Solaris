import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as perfilService from '../../api/perfilService';
import type { SavedAccount } from '../../api/perfilService';

/* ── Input de línea única con label flotante ─────────── */
interface LineInputProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}
const LineInput: React.FC<LineInputProps> = ({ id, label, type = 'text', value, onChange, autoComplete }) => {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div className="auth-field">
      <label
        htmlFor={id}
        className={`auth-field-label ${lifted ? 'lifted' : ''}`}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        className="auth-field-input"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(e.target.value)}
        spellCheck={false}
      />
      <div className={`auth-field-line ${lifted ? 'active' : ''}`} />
    </div>
  );
};

/* ── Página de Login ─────────────────────────────────── */
export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Cargar email guardado si "recordar dispositivo" estaba habilitado
  const [email, setEmail] = useState(() => {
    const prefs = localStorage.getItem('userPreferences');
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        if (parsed.recordar_dispositivo && parsed.email) {
          return parsed.email;
        }
      } catch (e) {
        console.error('Error parsing saved preferences:', e);
      }
    }
    return '';
  });
  
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuentas recordadas y vista
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAccounts, setShowAccounts] = useState(false);

  useEffect(() => {
    const accounts = perfilService.obtenerCuentasRecordadas();
    setSavedAccounts(accounts);
    if (accounts.length > 0) {
      setShowAccounts(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError(translateError(err));
      return;
    }

    // Login exitoso - guardar contraseña si "recordar dispositivo" está habilitado
    const prefs = localStorage.getItem('userPreferences');
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        if (parsed.recordar_dispositivo) {
          // Actualizar cuenta recordada con la contraseña
          const savedAccounts = perfilService.obtenerCuentasRecordadas();
          const accountIndex = savedAccounts.findIndex(a => a.email === email);
          if (accountIndex >= 0) {
            savedAccounts[accountIndex].password = password;
            localStorage.setItem('savedAccounts', JSON.stringify(savedAccounts));
          }
        }
      } catch (e) {
        console.warn('Error saving password:', e);
      }
    }

    navigate('/');
  };

  const handleSelectAccount = (account: SavedAccount) => {
    setEmail(account.email);
    if (account.password) {
      setPassword(account.password);
    }
    setShowAccounts(false);
  };

  const handleRemoveAccount = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    perfilService.eliminarCuentaRecordada(email);
    setSavedAccounts(savedAccounts.filter(a => a.email !== email));
  };

  return (
    <div className="auth-shell">
      {/* Fondo con gradiente mesh */}
      <div className="auth-bg" />

      <div className="auth-card">
        {/* Marca */}
        <div className="auth-brand">
          <div className="auth-brand-badge">PC</div>
          <div>
            <p className="auth-brand-kicker">Partner Central</p>
            <h1 className="auth-brand-title">Iniciar sesión</h1>
          </div>
        </div>

        {/* Mostrar cuentas recordadas si existen */}
        {showAccounts && savedAccounts.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500, color: '#1e293b', margin: '0 0 16px', textAlign: 'center' }}>
              Elige una cuenta
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {savedAccounts.map(account => (
                <div
                  key={account.email}
                  onClick={() => handleSelectAccount(account)}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: '1px solid #e0e7ff',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.backgroundColor = '#f8fafc';
                    el.style.borderColor = '#2563eb';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.backgroundColor = '#fff';
                    el.style.borderColor = '#e0e7ff';
                  }}
                >
                  {/* Contenedor izquierdo: Avatar + Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Avatar */}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {account.foto_perfil_url ? '🖼️' : (account.nombre.charAt(0) || account.email.charAt(0)).toUpperCase()}
                    </div>
                    
                    {/* Nombre y Email */}
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: '#1e293b', margin: 0 }}>
                        {account.nombre || account.email.split('@')[0]}
                      </p>
                      <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>
                        {account.email}
                      </p>
                    </div>
                  </div>

                  {/* Botón eliminar */}
                  <button
                    onClick={(e) => handleRemoveAccount(account.email, e)}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 4,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.backgroundColor = '#fef2f2';
                      el.style.color = '#dc2626';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.backgroundColor = 'transparent';
                      el.style.color = '#64748b';
                    }}
                  >
                    Salir
                  </button>
                </div>
              ))}
            </div>

            {/* Usar otra cuenta */}
            <button
              onClick={() => setShowAccounts(false)}
              style={{
                marginTop: 16,
                width: '100%',
                padding: 12,
                fontSize: 14,
                color: '#64748b',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.backgroundColor = '#f1f5f9';
                el.style.borderColor = '#cbd5e1';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.backgroundColor = '#f8fafc';
                el.style.borderColor = '#e2e8f0';
              }}
            >
              Usar otra cuenta
            </button>
          </div>
        )}

        {/* Formulario - mostrar solo si no está seleccionando cuenta o no hay cuentas */}
        {!showAccounts && (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <LineInput
              id="email"
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <LineInput
              id="password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />

            {/* Error */}
            {error && (
              <div className="auth-error">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            {/* Botón */}
            <button type="submit" className="auth-submit-btn" disabled={loading || !email || !password}>
              {loading ? <span className="auth-spinner" /> : 'Ingresar'}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="auth-footer-text">
          ¿Sin cuenta?{' '}
          <Link to="/register" className="auth-link">Crear cuenta</Link>
        </p>
      </div>
    </div>
  );
};

/* ── Traducciones de errores de Supabase ─────────────── */
function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('Email not confirmed')) return 'Confirma tu correo antes de ingresar.';
  if (msg.includes('Too many requests')) return 'Demasiados intentos. Espera un momento.';
  if (msg.includes('User not found')) return 'No existe una cuenta con ese correo.';
  return msg;
}
