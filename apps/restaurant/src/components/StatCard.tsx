import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  color?: 'orange' | 'amber' | 'emerald' | 'blue' | 'red' | 'purple';
  delay?: number;
}

const colorMap = {
  orange: {
    icon: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
  },
  amber: {
    icon: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  emerald: {
    icon: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  blue: {
    icon: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  red: {
    icon: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
  purple: {
    icon: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title, value, icon: Icon, trend, trendUp, color = 'orange', delay = 0,
}) => {
  const colors = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`relative bg-slate-900 border ${colors.border} rounded-2xl p-6 overflow-hidden`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
        <div className={`${colors.bg} p-3 rounded-xl`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
      {/* Glow decorativo */}
      <div className={`absolute -bottom-4 -right-4 w-24 h-24 ${colors.bg} rounded-full blur-2xl opacity-50`} />
    </motion.div>
  );
};
