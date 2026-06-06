import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validarInvitacion, marcarInvitacionComoUsada } from '../../api/invitacionesService';
import { asignarRol } from '../../api/usuariosRolesService';

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
      <label htmlFor={id} className={`auth-field-label ${lifted ? 'lifted' : ''}`}>
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

/* ── Página de Register ──────────────────────────────── */
export const Register: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0: Invitación, 1: Datos
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 0: Validación de invitación
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [rolSugerido, setRolSugerido] = useState<string | null>(null);
  const [idHotel, setIdHotel]         = useState<string | null>(null);
  const [ownerIdInv, setOwnerIdInv]   = useState<string | null>(null);

  // Paso 1: Datos de registro
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleValidarInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email.trim()) { setError('Ingresa tu correo.'); return; }
    if (!codigo.trim()) { setError('Ingresa el código de invitación.'); return; }

    setLoading(true);
    const resultado = await validarInvitacion(email, codigo);
    
    if (!resultado.valida) {
      setError(resultado.razon || 'Código inválido o ya fue usado. Verifica con el propietario.');
      setLoading(false);
      return;
    }

    setRolSugerido(resultado.rol_sugerido || 'RECEPCIONISTA');
    setIdHotel(resultado.id_hotel || null);
    setOwnerIdInv(resultado.owner_id || null);
    setStep(1);
    setLoading(false);
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!nombre.trim()) { setError('Ingresa tu nombre.'); return; }
    if (!password || !confirm) { setError('Completa contraseña y confirmación.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    
    setLoading(true);
    
    const { error: err, user_id } = await signUp(email, password, { tipo_registro: 'staff' });
    if (err) {
      setLoading(false);
      setError(translateError(err));
      return;
    }

    // Marcar invitación como usada y crear entrada en usuarios_roles
    if (user_id) {
      const success = await marcarInvitacionComoUsada(codigo, user_id);
      if (!success) {
        setError('Error al completar el registro. Intenta más tarde.');
        setLoading(false);
        return;
      }

      // Crear entrada en usuarios_roles bajo el owner_id correcto de la invitación
      const roleSuccess = await asignarRol({
        user_id:  user_id,
        id_hotel: idHotel || null,
        rol:      rolSugerido || 'RECEPCIONISTA',
        estado:   'activo',
        owner_id: ownerIdInv || undefined,
      });

      if (!roleSuccess) {
        setError('Error al asignar rol. Intenta más tarde.');
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    alert('✅ Registro completado. Acceso aprobado automáticamente.');
    navigate('/');
  };

  return (
    <div className="auth-shell">
      <div className="auth-bg" />

      <div className="auth-card auth-card-register">
        {/* Marca */}
        <div className="auth-brand">
          <div className="auth-brand-badge">PC</div>
          <div>
            <p className="auth-brand-kicker">Partner Central</p>
            <h1 className="auth-brand-title">Nueva cuenta</h1>
          </div>
        </div>

        <p style={{ fontSize: 13, color: '#64748b', margin: '16px 0', textAlign: 'center' }}>
          {step === 0 ? 'Ingresa tu código de invitación' : 'Completa tu información'}
        </p>

        {/* Contenido del formulario */}
        <form onSubmit={step === 0 ? handleValidarInvitacion : handleRegistro} className="auth-form" noValidate>
          
          {/* Paso 0: Invitación */}
          {step === 0 && (
            <>
              <LineInput id="inv-email" label="Correo electrónico" type="email" value={email} onChange={setEmail} autoComplete="email" />
              <LineInput id="inv-codigo" label="Código de invitación" value={codigo} onChange={setCodigo} />
            </>
          )}

          {/* Paso 1: Datos */}
          {step === 1 && (
            <>
              <LineInput id="reg-nombre" label="Nombre completo" value={nombre} onChange={setNombre} />
              <LineInput id="reg-password" label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
              <LineInput id="reg-confirm" label="Confirmar contraseña" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </>
          )}

          {/* Error */}
          {error && (
            <div className="auth-error">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="auth-btn-row">
            {step === 1 && (
              <button type="button" className="auth-back-btn" onClick={() => { setError(null); setStep(0); }}>
                ← Atrás
              </button>
            )}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading
                ? <span className="auth-spinner" />
                : step === 0 ? 'Validar →' : 'Registrarse'}
            </button>
          </div>
        </form>

        <p className="auth-footer-text">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="auth-link">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
};

function translateError(msg: string): string {
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese correo.';
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('invalid email')) return 'El correo ingresado no es válido.';
  if (msg.includes('Demasiados intentos')) return msg; // Pass through the retry message
  if (msg.includes('rate limit') || msg.includes('429')) return 'Demasiados intentos. Por favor, espera unos minutos.';
  return msg;
}
