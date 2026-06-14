import React from 'react';
import { motion } from 'framer-motion';
import type { TrendPoint } from '../../api/dashboardService';

const W = 320;
const H = 130;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;

interface ChartProps {
  data: TrendPoint[];
}

export const MemberGrowthChart: React.FC<ChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>
        // SIN REGISTROS DE CRECIMIENTO
      </div>
    );
  }

  const max = Math.max(1, ...data.map(d => d.value));
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const step = data.length > 1 ? (W - PAD_X * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    x: PAD_X + i * step,
    y: PAD_TOP + innerH - (d.value / max) * innerH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? 0} ${PAD_TOP + innerH} L ${points[0]?.x ?? 0} ${PAD_TOP + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="memberAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + innerH * f} y2={PAD_TOP + innerH * f}
          stroke="var(--shell-border-subtle)" strokeWidth="1" />
      ))}

      <motion.path
        d={areaPath}
        fill="url(#memberAreaGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      />

      <motion.path
        d={linePath}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(var(--accent-rgb), 0.7))' }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3.5"
          fill="var(--bg)"
          stroke="var(--accent)"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 0 4px rgba(var(--accent-rgb), 0.8))' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 1.0 + i * 0.06 }}
        />
      ))}

      {points.map((p, i) => (
        <text key={`l-${i}`} x={p.x} y={H - 6} textAnchor="middle"
          fontFamily="var(--mono)" fontSize="9" fontWeight={700} letterSpacing="0.06em"
          fill="var(--muted)" style={{ textTransform: 'uppercase' }}>
          {p.label}
        </text>
      ))}
    </svg>
  );
};

export const WeeklyRevenueChart: React.FC<ChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 11, fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>
        // SIN INGRESOS REGISTRADOS
      </div>
    );
  }

  const max = Math.max(1, ...data.map(d => d.value));
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const slot = (W - PAD_X * 2) / data.length;
  const barW = Math.min(28, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent2)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent2)" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1={PAD_X} x2={W - PAD_X} y1={PAD_TOP + innerH * f} y2={PAD_TOP + innerH * f}
          stroke="var(--shell-border-subtle)" strokeWidth="1" />
      ))}

      {data.map((d, i) => {
        const h = (d.value / max) * innerH;
        const x = PAD_X + i * slot + (slot - barW) / 2;
        const y = PAD_TOP + innerH - h;
        return (
          <g key={i}>
            <motion.rect
              x={x}
              width={barW}
              rx="2"
              fill="url(#revenueBarGrad)"
              style={{ filter: 'drop-shadow(0 0 5px rgba(255,92,53,0.35))' }}
              initial={{ y: PAD_TOP + innerH, height: 0 }}
              animate={{ y, height: h }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.06 }}
            />
            <text x={x + barW / 2} y={H - 6} textAnchor="middle"
              fontFamily="var(--mono)" fontSize="9" fontWeight={700} letterSpacing="0.06em"
              fill="var(--muted)" style={{ textTransform: 'uppercase' }}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
