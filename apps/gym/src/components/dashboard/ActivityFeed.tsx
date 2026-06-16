import React from 'react';
import { UserPlus, CreditCard, FileSignature } from 'lucide-react';
import type { ActivityItem } from '../../api/dashboardService';

const ICONS: Record<ActivityItem['type'], React.ReactNode> = {
  miembro: <UserPlus size={13} />,
  pago: <CreditCard size={13} />,
  inscripcion: <FileSignature size={13} />,
};

const COLORS: Record<ActivityItem['type'], string> = {
  miembro: 'var(--accent)',
  pago: '#60a5fa',
  inscripcion: 'var(--accent2)',
};

const timeAgo = (dateStr: string): string => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} hrs`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `hace ${diffD} día${diffD > 1 ? 's' : ''}`;
  const diffMo = Math.floor(diffD / 30);
  return `hace ${diffMo} mes${diffMo > 1 ? 'es' : ''}`;
};

interface Props {
  items: ActivityItem[];
}

export const ActivityFeed: React.FC<Props> = ({ items }) => {
  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Sin actividad reciente.
      </div>
    );
  }

  return (
    <div>
      {items.map(item => (
        <div key={item.id} className="activity-item">
          <div
            className="activity-icon"
            style={{ color: COLORS[item.type], background: 'var(--surface-raised)' }}
          >
            {ICONS[item.type]}
          </div>
          <div>
            <div className="activity-text">{item.message}</div>
            <div className="activity-time">{timeAgo(item.date)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
