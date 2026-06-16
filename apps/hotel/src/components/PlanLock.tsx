import React from 'react';
import { PlanFeatureKey } from '../hooks/usePlanFeature';

const FEATURE_LABELS: Record<PlanFeatureKey, string> = {
  cotizaciones: 'Cotizaciones',
  email_studio: 'Email Studio / Plantillas de correo',
  ai_asistente: 'Asistente IA',
  auditoria: 'Auditoría cruzada',
  multimoneda: 'Multi-moneda',
  reportes: 'Reportes',
  exportador_datos: 'Exportador de Datos',
};

export const PlanLock: React.FC<{ feature: PlanFeatureKey }> = ({ feature }) => {
  const label = FEATURE_LABELS[feature] ?? 'Esta función';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', flexDirection: 'column', gap: 16, padding: 24,
      textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'rgba(245,158,11,.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>
        🔒
      </div>
      <div>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: 'var(--text-h)' }}>
          Disponible en un plan superior
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          <strong>{label}</strong> no está incluido en tu plan actual. Mejora tu suscripción para desbloquear esta función.
        </p>
      </div>
      <a href="/" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
        Volver al Panel
      </a>
    </div>
  );
};
