export type SolarisLogoVariant = 'main' | 'hotel' | 'gym' | 'restaurant';

const GRADIENTS: Record<SolarisLogoVariant, [string, string]> = {
  main: ['#f59e0b', '#2563eb'],
  hotel: ['#0369a1', '#2563eb'],
  gym: ['#047857', '#4f46e5'],
  restaurant: ['#d97706', '#f43f5e'],
};

const PETAL = 'M1.6,-230 L42.1,-105.9 L-42.1,-154.3 Z';
const ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

interface SolarisLogoProps {
  variant?: SolarisLogoVariant;
  size?: number;
  className?: string;
}

export default function SolarisLogo({ variant = 'main', size = 40, className }: SolarisLogoProps) {
  const gradId = `solaris-grad-${variant}`;
  const [from, to] = GRADIENTS[variant];

  return (
    <svg viewBox="-240 -240 480 480" width={size} height={size} className={className} role="img" aria-label="Solaris">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <g fill={`url(#${gradId})`}>
        {ANGLES.map((angle) => (
          <path key={angle} d={PETAL} transform={`rotate(${angle})`} />
        ))}
        {variant === 'main' && <circle cx="0" cy="0" r="65" />}
        {variant === 'hotel' && (
          <g transform="scale(2.5)">
            <circle cx="-10" cy="0" r="14" fill="none" stroke={`url(#${gradId})`} strokeWidth="7" />
            <rect x="2" y="-3.5" width="28" height="7" />
            <rect x="20" y="-3.5" width="7" height="12" />
            <rect x="30" y="-3.5" width="7" height="9" />
          </g>
        )}
        {variant === 'gym' && (
          <g transform="scale(2.5)">
            <rect x="-22" y="-5" width="44" height="10" rx="2" />
            <rect x="-32" y="-14" width="12" height="28" rx="3" />
            <rect x="20" y="-14" width="12" height="28" rx="3" />
          </g>
        )}
        {variant === 'restaurant' && (
          <g transform="scale(2.5)">
            <rect x="-15" y="-28" width="6" height="14" />
            <rect x="-3" y="-28" width="6" height="20" />
            <rect x="9" y="-28" width="6" height="14" />
            <rect x="-15" y="-14" width="30" height="6" />
            <rect x="-3" y="-8" width="6" height="36" />
          </g>
        )}
      </g>
    </svg>
  );
}
