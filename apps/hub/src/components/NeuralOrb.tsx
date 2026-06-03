import { useEffect, useRef, useState } from 'react';

export type OrbState = 'idle' | 'thinking' | 'listening' | 'offline';

interface NeuralOrbProps {
  state?: OrbState;
  voiceLevel?: number;
  onClick?: () => void;
  size?: number;
}

const PALETTE = {
  idle:      { primary: '#22d3ee', secondary: '#6366f1', glow: '#4f46e5', scan: '#a5f3fc', text: '#67e8f9', label: 'EN ESPERA' },
  thinking:  { primary: '#e879f9', secondary: '#ec4899', glow: '#c026d3', scan: '#f0abfc', text: '#f0abfc', label: 'PROCESANDO' },
  listening: { primary: '#34d399', secondary: '#10b981', glow: '#047857', scan: '#6ee7b7', text: '#6ee7b7', label: 'ESCUCHANDO' },
  offline:   { primary: '#ef4444', secondary: '#b91c1c', glow: '#7f1d1d', scan: '#fca5a5', text: '#f87171', label: 'OFFLINE'    },
};

export default function NeuralOrb({ state = 'idle', voiceLevel = 0, onClick, size = 200 }: NeuralOrbProps) {
  const [tick,    setTick]    = useState(0);
  const [hexData, setHexData] = useState<string[]>(['0x4F', '0xA1', '0xC3', '0xD2']);
  const [particles] = useState(() =>
    Array.from({ length: 24 }, (_, i) => ({
      angle: (i * 360) / 24 + Math.random() * 8,
      r: 80 + Math.random() * 20,
      size: 0.8 + Math.random() * 1.4,
      speed: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    }))
  );

  const frameRef = useRef<number | null>(null);
  const tRef     = useRef(0);
  const pal = PALETTE[state];

  useEffect(() => {
    const animate = () => {
      tRef.current += 0.012;
      setTick(Math.floor(tRef.current * 20));
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  useEffect(() => {
    if (state !== 'thinking') return;
    const id = setInterval(() => {
      setHexData(Array.from({ length: 4 }, () => '0x' + Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')));
    }, 160);
    return () => clearInterval(id);
  }, [state]);

  const t = tRef.current;
  const cx = 120, cy = 120;
  const breathScale = state === 'idle'      ? 1 + Math.sin(t * 1.2) * 0.025
                    : state === 'thinking'  ? 1 + Math.sin(t * 5.0) * 0.06
                    : state === 'listening' ? 1 + (voiceLevel / 100) * 0.12 + Math.sin(t * 8) * 0.02
                    : 1 + Math.sin(t * 1.5) * 0.008;

  // Circular voice waveform path
  const buildVoiceRing = (baseR: number, amplitude: number, segments = 120) => {
    const points = Array.from({ length: segments + 1 }, (_, i) => {
      const a = (i / segments) * Math.PI * 2;
      const wave = state === 'listening'
        ? Math.sin(a * 8 + t * 12) * (voiceLevel / 100) * amplitude
          + Math.sin(a * 5 + t * 7) * (voiceLevel / 100) * amplitude * 0.5
        : Math.sin(a * 6 + t * 2) * amplitude * 0.15;
      const r = baseR + wave;
      return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`;
    });
    return `M${points.join('L')}Z`;
  };

  // Rotating scanner beam
  const scanAngle = (t * (state === 'thinking' ? 3.5 : 1.2)) % (Math.PI * 2);
  const scanX = cx + Math.cos(scanAngle) * 96;
  const scanY = cy + Math.sin(scanAngle) * 96;

  // Corner HUD bracket path
  const bracket = (x: number, y: number, dx: number, dy: number, len = 14) =>
    `M${x + dx * len},${y} L${x},${y} L${x},${y + dy * len}`;

  // Ring dash patterns per state
  const ringDash = state === 'offline'
    ? ['8 20', '5 15', '3 10', '2 8', '1 5']
    : state === 'thinking'
    ? ['18 4 4 4', '30 6', '4 4', '20 8 2 8', '3 3']
    : ['22 6 6 6', '35 8', '3 7', '18 10 4 10', '2 4'];

  // Orbital satellite positions (6 dots)
  const satellites = Array.from({ length: 6 }, (_, i) => {
    const base = (i * Math.PI * 2) / 6;
    const speed = state === 'thinking' ? 1.8 : state === 'listening' ? 1.2 : 0.5;
    const angle = base + t * speed * (i % 2 === 0 ? 1 : -0.7);
    const r = i % 2 === 0 ? 88 : 76;
    return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, i };
  });

  return (
    <div className="flex flex-col items-center gap-3 select-none" style={{ width: size + 80 }}>
      <style>{`
        @keyframes orb-spin-cw  { to { transform: rotate(360deg);  } }
        @keyframes orb-spin-ccw { to { transform: rotate(-360deg); } }
        @keyframes orb-shimmer  { 0%,100% { opacity:.15; } 50% { opacity:.45; } }
        @keyframes orb-glitch   {
          0%,100% { opacity:1; filter:none; }
          7%  { opacity:.3; transform:translate(-2px,1px); filter:hue-rotate(30deg); }
          8%  { opacity:1; transform:none; }
          40% { opacity:.8; filter:none; }
          42% { opacity:.2; transform:translate(2px,-1px); filter:brightness(2); }
          43% { opacity:1; transform:none; }
          80% { opacity:.9; }
          82% { opacity:.1; transform:translate(-1px,2px); filter:saturate(0); }
          83% { opacity:1; transform:none; }
        }
        @keyframes orb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes orb-data  { 0%{opacity:0;transform:translateY(3px)} 30%{opacity:1} 80%{opacity:1} 100%{opacity:0;transform:translateY(-3px)} }

        .orb-cw-xs   { animation: orb-spin-cw  60s linear infinite; transform-origin: 120px 120px; }
        .orb-cw-sm   { animation: orb-spin-cw  28s linear infinite; transform-origin: 120px 120px; }
        .orb-cw-md   { animation: orb-spin-cw  18s linear infinite; transform-origin: 120px 120px; }
        .orb-cw-fast { animation: orb-spin-cw   4s linear infinite; transform-origin: 120px 120px; }
        .orb-ccw-sm  { animation: orb-spin-ccw 22s linear infinite; transform-origin: 120px 120px; }
        .orb-ccw-md  { animation: orb-spin-ccw 12s linear infinite; transform-origin: 120px 120px; }
        .orb-ccw-fast{ animation: orb-spin-ccw  3s linear infinite; transform-origin: 120px 120px; }
        .orb-float   { animation: orb-float 5s ease-in-out infinite; }
        .orb-glitch  { animation: orb-glitch 1.8s ease-in-out infinite; }
        .orb-shimmer { animation: orb-shimmer 3s ease-in-out infinite; }
        .orb-data    { animation: orb-data 1.2s ease-in-out infinite; }
      `}</style>

      <div
        onClick={onClick}
        className={`relative cursor-pointer group ${state === 'offline' ? 'orb-glitch' : 'orb-float'}`}
        style={{ width: size + 48, height: size + 48 }}
      >
        {/* Glow bloom behind everything */}
        <div className="absolute inset-0 rounded-full pointer-events-none" style={{
          background: `radial-gradient(circle, ${pal.glow}55 0%, transparent 65%)`,
          filter: 'blur(24px)',
          transform: `scale(${breathScale})`,
          transition: 'background 0.5s',
        }} />

        <svg viewBox="0 0 240 240" className="w-full h-full" style={{ overflow: 'visible' }}>
          <defs>
            {/* Core gradient */}
            <radialGradient id={`core-${state}`} cx="38%" cy="32%" r="65%">
              <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="25%"  stopColor={pal.primary} stopOpacity="1" />
              <stop offset="65%"  stopColor={pal.secondary} stopOpacity="0.8" />
              <stop offset="100%" stopColor={pal.glow} stopOpacity="0.3" />
            </radialGradient>
            {/* Inner glow */}
            <radialGradient id={`inner-${state}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor={pal.primary} stopOpacity="0.6" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            {/* Scanner gradient */}
            <linearGradient id={`scan-${state}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={pal.scan} stopOpacity="0" />
              <stop offset="70%" stopColor={pal.scan} stopOpacity="0.6" />
              <stop offset="100%" stopColor={pal.scan} stopOpacity="0.1" />
            </linearGradient>
            {/* Outer ring gradient */}
            <linearGradient id={`ring-${state}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={pal.primary} stopOpacity="0.9" />
              <stop offset="50%"  stopColor={pal.secondary} stopOpacity="0.4" />
              <stop offset="100%" stopColor={pal.primary} stopOpacity="0.8" />
            </linearGradient>
            {/* Glow filter */}
            <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-soft" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="glow-xl" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="orb-clip"><circle cx="120" cy="120" r="110" /></clipPath>
          </defs>

          {/* ── Background hex grid (very faint) ── */}
          <g opacity="0.06" stroke={pal.primary} strokeWidth="0.5" fill="none" clipPath="url(#orb-clip)">
            {Array.from({ length: 7 }, (_, row) =>
              Array.from({ length: 7 }, (_, col) => {
                const hx = 20 + col * 35 + (row % 2) * 17.5;
                const hy = 20 + row * 30;
                const r = 10;
                const pts = Array.from({ length: 6 }, (_, k) => {
                  const a = (k * Math.PI) / 3 - Math.PI / 6;
                  return `${hx + r * Math.cos(a)},${hy + r * Math.sin(a)}`;
                }).join(' ');
                return <polygon key={`${row}-${col}`} points={pts} />;
              })
            )}
          </g>

          {/* ── Corner HUD brackets ── */}
          {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx, dy], i) => {
            const bx = cx + dx * 104, by = cy + dy * 104;
            return (
              <path key={i} d={bracket(bx, by, dx, dy, 16)}
                fill="none" stroke={pal.primary} strokeWidth="1.5" strokeLinecap="square"
                opacity="0.7" filter="url(#glow-soft)" />
            );
          })}

          {/* ── Tick marks on outer boundary ── */}
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * Math.PI * 2) / 36;
            const r1 = 102, r2 = i % 3 === 0 ? 96 : 99;
            return (
              <line key={i}
                x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
                x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
                stroke={pal.primary} strokeWidth={i % 9 === 0 ? 1.5 : 0.7} opacity={i % 3 === 0 ? 0.7 : 0.25} />
            );
          })}

          {/* ── Ring 5: outermost slow ── */}
          <circle cx={cx} cy={cy} r="95" fill="none"
            stroke={`url(#ring-${state})`} strokeWidth="1"
            strokeDasharray={ringDash[0]}
            className={state === 'thinking' ? 'orb-cw-fast' : 'orb-cw-xs'}
            filter="url(#glow-soft)" opacity="0.65" />

          {/* ── Ring 4 ── */}
          <circle cx={cx} cy={cy} r="83" fill="none"
            stroke={pal.primary} strokeWidth="1.5"
            strokeDasharray={ringDash[1]}
            className={state === 'thinking' ? 'orb-ccw-fast' : 'orb-ccw-sm'}
            filter="url(#glow-soft)" opacity="0.7" />

          {/* ── Ring 3 ── */}
          <circle cx={cx} cy={cy} r="72" fill="none"
            stroke={pal.secondary} strokeWidth="1"
            strokeDasharray={ringDash[2]}
            className={state === 'thinking' ? 'orb-cw-fast' : 'orb-cw-md'}
            opacity="0.5" />

          {/* ── Ring 2 ── */}
          <circle cx={cx} cy={cy} r="62" fill="none"
            stroke={pal.primary} strokeWidth="2"
            strokeDasharray={ringDash[3]}
            className={state === 'thinking' ? 'orb-ccw-fast' : 'orb-ccw-md'}
            filter="url(#glow-soft)" opacity="0.6" />

          {/* ── Ring 1: innermost ── */}
          <circle cx={cx} cy={cy} r="50" fill="none"
            stroke={pal.secondary} strokeWidth="1.5"
            strokeDasharray={ringDash[4]}
            className={state === 'thinking' ? 'orb-cw-fast' : 'orb-cw-sm'}
            opacity="0.45" />

          {/* ── Scanner beam ── */}
          {state !== 'offline' && (
            <g filter="url(#glow-soft)">
              <line
                x1={cx} y1={cy} x2={scanX} y2={scanY}
                stroke={pal.scan} strokeWidth="1.5" opacity="0.5"
                strokeLinecap="round" />
              {/* Sweep arc */}
              <path
                d={`M${cx},${cy} L${cx + Math.cos(scanAngle - 0.45) * 95},${cy + Math.sin(scanAngle - 0.45) * 95} A95,95 0 0,1 ${scanX},${scanY} Z`}
                fill={`url(#scan-${state})`} opacity="0.08" />
            </g>
          )}

          {/* ── Orbital satellites ── */}
          {satellites.map(({ x, y, i }) => (
            <circle key={i} cx={x} cy={y}
              r={i % 2 === 0 ? 2.5 : 1.8}
              fill={i % 2 === 0 ? pal.primary : pal.secondary}
              filter="url(#glow-strong)"
              opacity={0.75 + Math.sin(t * 2 + i) * 0.2} />
          ))}

          {/* ── Voice waveform ring ── */}
          <path
            d={buildVoiceRing(45, state === 'listening' ? 14 : 4)}
            fill="none"
            stroke={pal.primary}
            strokeWidth={state === 'listening' ? 1.8 : 1}
            opacity={state === 'listening' ? 0.9 : 0.35}
            filter="url(#glow-soft)" />

          {/* ── Core glow backdrop ── */}
          <circle cx={cx} cy={cy} r={34 * breathScale}
            fill={`url(#inner-${state})`} filter="url(#glow-xl)"
            opacity="0.6" />

          {/* ── Core sphere ── */}
          <circle cx={cx} cy={cy} r={32 * breathScale}
            fill={`url(#core-${state})`}
            filter="url(#glow-strong)" />

          {/* ── Core internal lattice lines ── */}
          <g opacity="0.25" stroke="white" strokeWidth="0.6" clipPath="url(#orb-clip)">
            {[-16,-8,0,8,16].map(offset => (
              <g key={offset}>
                <line x1={cx - 28} y1={cy + offset} x2={cx + 28} y2={cy + offset} />
                <line x1={cx + offset} y1={cy - 28} x2={cx + offset} y2={cy + 28} />
              </g>
            ))}
          </g>

          {/* ── Specular highlight ── */}
          <ellipse
            cx={cx - 10} cy={cy - 10}
            rx={10 * breathScale} ry={6 * breathScale}
            fill="white" opacity="0.3"
            transform={`rotate(-30, ${cx}, ${cy})`} />

          {/* ── Center pulse dot ── */}
          {state === 'thinking' && (
            <>
              <circle cx={cx} cy={cy} r="6" fill="white" opacity="0.9" filter="url(#glow-strong)" />
              <circle cx={cx} cy={cy} r="12" fill="none"
                stroke={pal.primary} strokeWidth="1.5"
                opacity={0.5 + Math.sin(t * 10) * 0.4} />
            </>
          )}
          {state === 'listening' && (
            <circle cx={cx} cy={cy} r="5" fill="white"
              opacity={0.7 + (voiceLevel / 100) * 0.25}
              filter="url(#glow-strong)" />
          )}
          {state === 'idle' && (
            <circle cx={cx} cy={cy} r="4" fill="white"
              opacity={0.25 + Math.sin(t * 2) * 0.15} />
          )}
          {state === 'offline' && (
            <circle cx={cx} cy={cy} r="5" fill="#ef4444"
              opacity={0.4 + Math.sin(t * 6) * 0.4}
              filter="url(#glow-strong)" />
          )}

          {/* ── Crosshair ── */}
          {state !== 'offline' && (
            <g stroke={pal.primary} strokeWidth="0.8" opacity="0.4">
              <line x1={cx - 48} y1={cy} x2={cx - 36} y2={cy} />
              <line x1={cx + 36} y1={cy} x2={cx + 48} y2={cy} />
              <line x1={cx} y1={cy - 48} x2={cx} y2={cy - 36} />
              <line x1={cx} y1={cy + 36} x2={cx} y2={cy + 48} />
            </g>
          )}

          {/* ── Data readout around ring ── */}
          {state === 'thinking' && hexData.map((val, i) => {
            const a = (i * Math.PI * 2) / 4 + t * 0.3;
            const rx = cx + Math.cos(a) * 108, ry = cy + Math.sin(a) * 108;
            return (
              <text key={i} x={rx} y={ry}
                fill={pal.primary} fontSize="6" fontFamily="monospace"
                textAnchor="middle" dominantBaseline="middle"
                opacity={0.6 + Math.sin(t * 3 + i) * 0.3}>{val}</text>
            );
          })}

          {/* ── Hover ring ── */}
          <circle cx={cx} cy={cy} r="108" fill="transparent"
            stroke={pal.primary} strokeWidth="0" className="group-hover:stroke-[0.8]"
            opacity="0.3" style={{ transition: 'stroke-width 0.3s' }} />
        </svg>
      </div>

      {/* ── Status bar ── */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: pal.primary, boxShadow: `0 0 6px ${pal.primary}`, animation: state !== 'offline' ? 'orb-shimmer 2s ease-in-out infinite' : 'none' }} />
          <span className="text-[10px] font-black tracking-[0.25em] font-mono" style={{ color: pal.text }}>
            {pal.label}
          </span>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: pal.primary, boxShadow: `0 0 6px ${pal.primary}`, animation: state !== 'offline' ? 'orb-shimmer 2s ease-in-out infinite 0.5s' : 'none' }} />
        </div>
        {state === 'listening' && (
          <div className="flex items-center gap-1">
            {Array.from({ length: 12 }, (_, i) => {
              const h = Math.max(3, (voiceLevel / 100) * 18 * (0.4 + Math.abs(Math.sin((tick + i * 3) * 0.4))) );
              return (
                <div key={i} className="rounded-full transition-all duration-75"
                  style={{ width: 2, height: h, background: pal.primary, opacity: 0.7 }} />
              );
            })}
          </div>
        )}
        {state === 'thinking' && (
          <div className="flex gap-1">
            {hexData.map((v, i) => (
              <span key={i} className="text-[8px] font-mono opacity-50 orb-data" style={{ color: pal.text, animationDelay: `${i * 0.15}s` }}>{v}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
