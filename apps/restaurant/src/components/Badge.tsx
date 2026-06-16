import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'orange';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  danger:  'bg-red-500/15 text-red-400 border border-red-500/30',
  info:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  neutral: 'bg-slate-500/15 text-slate-400 border border-slate-500/30',
  orange:  'bg-orange-500/15 text-orange-400 border border-orange-500/30',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', children, className = '' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
    {children}
  </span>
);

// Helpers para estados específicos
export const estadoPedidoBadge = (estado: string) => {
  const map: Record<string, BadgeVariant> = {
    pendiente:  'warning',
    preparando: 'orange',
    servido:    'success',
    cancelado:  'danger',
  };
  return map[estado] ?? 'neutral';
};

export const estadoMesaBadge = (estado: string): BadgeVariant => {
  const map: Record<string, BadgeVariant> = {
    disponible: 'success',
    ocupada:    'danger',
    reservada:  'warning',
  };
  return map[estado] ?? 'neutral';
};

export const estadoReservaBadge = (estado: string): BadgeVariant => {
  const map: Record<string, BadgeVariant> = {
    pendiente:  'warning',
    preparando: 'orange',
    servido:    'success',
    cancelado:  'danger',
  };
  return map[estado] ?? 'neutral';
};
