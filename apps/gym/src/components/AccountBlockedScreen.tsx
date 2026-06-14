import React from 'react';
import { ShieldOff, AlertTriangle, LogOut, Mail } from 'lucide-react';
import type { AccountBlockedReason } from '../context/AuthContext';
import SolarisLogo from './SolarisLogo';

interface Props {
  reason: AccountBlockedReason;
  onSignOut: () => Promise<void>;
}

const CONFIG = {
  ACCOUNT_SUSPENDED: {
    icon: ShieldOff,
    color: 'var(--warning)',
    colorBg: 'rgba(251,191,36,0.12)',
    badgeLabel: 'Acceso restringido',
    title: 'Cuenta suspendida',
    body: 'Tu cuenta ha sido suspendida temporalmente. Esto puede deberse a un problema con tu suscripción o a una revisión administrativa.',
    action: 'Contacta con soporte para restablecer tu acceso.',
  },
  ACCOUNT_INACTIVE: {
    icon: AlertTriangle,
    color: 'var(--danger)',
    colorBg: 'rgba(251,82,82,0.12)',
    badgeLabel: 'Cuenta inactiva',
    title: 'Cuenta inactiva',
    body: 'Tu cuenta ha sido desactivada. Los datos de tu negocio se conservan pero el acceso ha sido revocado.',
    action: 'Contacta con soporte si crees que esto es un error.',
  },
  MODULE_SUSPENDED: {
    icon: ShieldOff,
    color: 'var(--warning)',
    colorBg: 'rgba(251,191,36,0.12)',
    badgeLabel: 'Negocio suspendido',
    title: 'Negocio suspendido',
    body: 'Este negocio ha sido suspendido temporalmente desde la administración. El resto de tu cuenta y otros negocios no se ven afectados.',
    action: 'Contacta con soporte para restablecer el acceso a este negocio.',
  },
  INVALID_SESSION: {
    icon: ShieldOff,
    color: 'var(--muted)',
    colorBg: 'rgba(255,255,255,0.06)',
    badgeLabel: 'Sesión expirada',
    title: 'Sesión inválida',
    body: 'Tu sesión ha expirado o fue revocada. Por favor, vuelve a iniciar sesión.',
    action: null,
  },
};

export const AccountBlockedScreen: React.FC<Props> = ({ reason, onSignOut }) => {
  const cfg = reason ? CONFIG[reason] : CONFIG.ACCOUNT_SUSPENDED;
  const Icon = cfg.icon;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--shell-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
          <SolarisLogo variant="gym" size={36} />
          <span style={{ color: 'var(--text-h)', fontFamily: 'var(--display)', fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Solaris Gym
          </span>
        </div>

        <div style={{
          background: 'var(--shell-panel-strong)', borderRadius: 6, border: '1px solid var(--shell-border)',
          borderTop: `2px solid ${cfg.color}`, boxShadow: 'var(--shadow)', overflow: 'hidden',
          animation: 'fadeInUp 0.4s ease-out',
        }}>

          <div style={{ background: cfg.colorBg, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--shell-border-subtle)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 6, background: cfg.colorBg, color: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${cfg.color}` }}>
              <Icon size={22} />
            </div>
            <div>
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                color: cfg.color, background: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: 3,
              }}>
                {cfg.badgeLabel}
              </span>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: 19, marginTop: 8, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {cfg.title}
              </h1>
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.6 }}>{cfg.body}</p>

            {cfg.action && (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>{cfg.action}</p>
            )}

            {reason !== 'INVALID_SESSION' && (
              <a
                href="mailto:support@solarys.app"
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}
              >
                <Mail size={14} />
                support@solarys.app
              </a>
            )}
          </div>

          <div style={{ padding: '0 24px 20px' }}>
            <button onClick={onSignOut} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--muted)', marginTop: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          © {new Date().getFullYear()} Solarys · Sistema de Gestión Empresarial
        </p>
      </div>
    </div>
  );
};
