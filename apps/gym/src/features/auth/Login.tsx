import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { addToast('Completa todos los campos', 'warning'); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) addToast(error, 'error');
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
            Panel de administración
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Correo Electrónico</label>
            <input className="form-input" type="email" placeholder="tu@correo.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input className="form-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 10, padding: '13px 16px', fontSize: 13 }}>
            {loading ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--muted)' }}>
          ¿Tienes un código de invitación?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
};
