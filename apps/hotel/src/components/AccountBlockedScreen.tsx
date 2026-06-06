import React from 'react';
import { ShieldOff, AlertTriangle, LogOut, Mail } from 'lucide-react';
import type { AccountBlockedReason } from '../context/AuthContext';

interface Props {
  reason: AccountBlockedReason;
  onSignOut: () => Promise<void>;
}

const CONFIG = {
  ACCOUNT_SUSPENDED: {
    icon: ShieldOff,
    color: 'amber',
    title: 'Cuenta suspendida',
    body: 'Tu cuenta ha sido suspendida temporalmente. Esto puede deberse a un problema con tu suscripción o a una revisión administrativa.',
    action: 'Contacta con soporte para restablecer tu acceso.',
  },
  ACCOUNT_INACTIVE: {
    icon: AlertTriangle,
    color: 'rose',
    title: 'Cuenta inactiva',
    body: 'Tu cuenta ha sido desactivada. Los datos de tu negocio se conservan pero el acceso ha sido revocado.',
    action: 'Contacta con soporte si crees que esto es un error.',
  },
  INVALID_SESSION: {
    icon: ShieldOff,
    color: 'slate',
    title: 'Sesión inválida',
    body: 'Tu sesión ha expirado o fue revocada. Por favor, vuelve a iniciar sesión.',
    action: null,
  },
};

const COLOR_MAP = {
  amber: {
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    icon:   'bg-amber-100 text-amber-600',
    title:  'text-amber-900',
    badge:  'bg-amber-100 text-amber-700',
  },
  rose: {
    bg:     'bg-rose-50',
    border: 'border-rose-200',
    icon:   'bg-rose-100 text-rose-600',
    title:  'text-rose-900',
    badge:  'bg-rose-100 text-rose-700',
  },
  slate: {
    bg:     'bg-slate-50',
    border: 'border-slate-200',
    icon:   'bg-slate-100 text-slate-600',
    title:  'text-slate-900',
    badge:  'bg-slate-100 text-slate-600',
  },
};

export const AccountBlockedScreen: React.FC<Props> = ({ reason, onSignOut }) => {
  const cfg = reason ? CONFIG[reason] : CONFIG.ACCOUNT_SUSPENDED;
  const colors = COLOR_MAP[cfg.color as keyof typeof COLOR_MAP];
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow">
            <span className="text-white font-bold text-base">S</span>
          </div>
          <span className="text-slate-700 font-semibold text-lg">Solarys</span>
        </div>

        {/* Tarjeta */}
        <div className={`bg-white rounded-2xl shadow-lg border ${colors.border} overflow-hidden`}>

          {/* Header de color */}
          <div className={`${colors.bg} px-6 py-5 flex items-center gap-4 border-b ${colors.border}`}>
            <div className={`w-12 h-12 rounded-2xl ${colors.icon} flex items-center justify-center shrink-0`}>
              <Icon size={22} />
            </div>
            <div>
              <span className={`text-xs font-semibold uppercase tracking-wide ${colors.badge} px-2 py-0.5 rounded-full`}>
                {reason === 'ACCOUNT_SUSPENDED' ? 'Acceso restringido' :
                 reason === 'ACCOUNT_INACTIVE'  ? 'Cuenta inactiva'   : 'Sesión expirada'}
              </span>
              <h1 className={`text-lg font-bold mt-1 ${colors.title}`}>{cfg.title}</h1>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-slate-600 text-sm leading-relaxed">{cfg.body}</p>

            {cfg.action && (
              <p className="text-slate-500 text-sm">{cfg.action}</p>
            )}

            {/* Contacto */}
            {reason !== 'INVALID_SESSION' && (
              <a
                href="mailto:support@solarys.app"
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition"
              >
                <Mail size={14} />
                support@solarys.app
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-5">
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-xl transition"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          © {new Date().getFullYear()} Solarys · Sistema de Gestión Empresarial
        </p>
      </div>
    </div>
  );
};
