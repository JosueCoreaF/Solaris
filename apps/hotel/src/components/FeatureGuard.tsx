import React from 'react';
import { Loader2 } from 'lucide-react';
import { useSync } from '../context/SyncContext';
import { useHasFeature, PlanFeatureKey } from '../hooks/usePlanFeature';
import { PlanLock } from './PlanLock';

interface FeatureGuardProps {
  children: React.ReactNode;
  feature: PlanFeatureKey;
}

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ children, feature }) => {
  const { loading } = useSync();
  const hasFeature = useHasFeature(feature);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', color: 'var(--muted)',
      }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!hasFeature) {
    return <PlanLock feature={feature} />;
  }

  return <>{children}</>;
};
