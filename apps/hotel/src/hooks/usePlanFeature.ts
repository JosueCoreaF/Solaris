import { useSync } from '../context/SyncContext';

/** Claves de feature flags soportadas (planes_suscripcion.feature_flags) */
export type PlanFeatureKey =
  | 'cotizaciones'
  | 'email_studio'
  | 'ai_asistente'
  | 'auditoria'
  | 'multimoneda'
  | 'reportes'
  | 'exportador_datos';

export const usePlanFeatures = (): PlanFeatureKey[] => {
  const { hotel } = useSync();
  return (hotel?.plan?.feature_flags ?? []) as PlanFeatureKey[];
};

export const useHasFeature = (key: PlanFeatureKey): boolean => {
  return usePlanFeatures().includes(key);
};
