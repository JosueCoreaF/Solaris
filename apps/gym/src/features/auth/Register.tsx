import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { validarInvitacion, completarRegistro } from '../../api/invitacionesService';

function translateError(msg: string): string {
  if (msg.includes('already been registered') || msg.includes('User already registered')) return 'Ya existe una cuenta con ese correo.';
  if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (msg.includes('invalid email') || msg.includes('is invalid')) return 'El correo ingresado no es válido.';
  if (msg.includes('rate limit') || msg.includes('429')) return 'Demasiados intentos. Por favor, espera unos minutos.';
  return msg;
}

export const Register: React.FC = () => {
  const { signIn } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0: Invitación, 1: Datos
  const [loading, setLoading] = useState(false);

  // Paso 0: Validación de invitación
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');

  // Paso 1: Datos de registro
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleValidarInvitacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !codigo) { addToast('Completa correo y código de invitación', 'warning'); return; }

    setLoading(true);
    const resultado = await validarInvitacion(email, codigo);
    setLoading(false);

    if (!resultado.valida) {
      addToast(resultado.razon || 'Código inválido o ya fue usado. Verifica con el propietario.', 'error');
      return;
    }

    setStep(1);
  };

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { addToast('Ingresa tu nombre completo', 'warning'); return; }
    if (!password || !confirm) { addToast('Completa contraseña y confirmación', 'warning'); return; }
    if (password.length < 6) { addToast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }
    if (password !== confirm) { addToast('Las contraseñas no coinciden', 'warning'); return; }

    setLoading(true);

    const resultado = await completarRegistro({ email, codigo, password, nombre: nombre.trim() });
    if (!resultado.success) {
      setLoading(false);
      addToast(translateError(resultado.error || 'Error al completar el registro. Intenta más tarde.'), 'error');
      return;
    }

    const { error: signInErr } = await signIn(email, password);
    setLoading(false);

    if (signInErr) {
      addToast('Registro completado. Ya puedes iniciar sesión.', 'success');
      navigate('/login');
      return;
    }

    addToast('¡Bienvenido a Solaris Gym!', 'success');
    navigate('/');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--shell-bg)', padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%', width: 480, height: 480, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(200,255,61,0.10), transparent 70%)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', left: '-10%', width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,92,53,0.07), transparent 70%)', pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
        background: 'var(--shell-panel-strong)',
        border: '1px solid var(--shell-border)',
        borderTop: '2px solid var(--accent)',
        borderRadius: 6, padding: 40,
        boxShadow: 'var(--shadow)',
        animation: 'fadeInUp 0.4s ease-out',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 6, margin: '0 auto 18px',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent-ink)', fontFamily: 'var(--display)', fontSize: 18, letterSpacing: '0.04em',
            boxShadow: '0 0 32px rgba(var(--accent-rgb), 0.35)',
          }}>GYM</div>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 26, color: 'var(--text-h)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Solaris Gym
          </h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            {step === 0 ? 'Validar invitación de acceso' : 'Completa tu registro'}
          </p>
        </div>

        <form onSubmit={step === 0 ? handleValidarInvitacion : handleRegistro}>
          {step === 0 && (
            <>
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input className="form-input" type="email" placeholder="tu@correo.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="form-group">
                <label className="form-label">Código de Invitación</label>
                <input className="form-input" type="text" placeholder="ABC123"
                  value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} autoComplete="off"
                  style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <input className="form-input" type="text" placeholder="Tu nombre"
                  value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar Contraseña</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            {step === 1 && (
              <button type="button" className="btn-secondary" onClick={() => setStep(0)}
                style={{ padding: '13px 16px', fontSize: 13 }}>
                Atrás
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={loading}
              style={{ flex: 1, justifyContent: 'center', padding: '13px 16px', fontSize: 13 }}>
              {loading ? 'Procesando...' : step === 0 ? 'Validar Código' : 'Crear Cuenta'}
            </button>
          </div>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Iniciar Sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
