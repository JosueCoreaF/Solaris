import React from 'react';
import { motion } from 'framer-motion';
import type { ClaseGym } from '../../api/clasesService';

interface Props {
  clases: ClaseGym[];
  asistenciaPorClase: Record<string, number>;
}

export const ClassesToday: React.FC<Props> = ({ clases, asistenciaPorClase }) => {
  if (clases.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        No hay clases programadas para hoy.
      </div>
    );
  }

  return (
    <div>
      {clases.map((c, i) => {
        const ocupados = asistenciaPorClase[c.id_clase] ?? 0;
        const pct = Math.min(100, Math.round((ocupados / c.capacidad_maxima) * 100));
        const lleno = pct >= 90;
        return (
          <div key={c.id_clase} className="class-today-item">
            <div className="class-today-time">{c.hora_inicio?.slice(0, 5)} – {c.hora_fin?.slice(0, 5)}</div>
            <div style={{ flex: 1 }}>
              <div className="class-today-name">{c.nombre_clase}</div>
              <div className="class-today-trainer">{c.entrenadores?.nombre_completo ?? 'Sin instructor asignado'}</div>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <motion.div
                  className={`progress-fill ${lleno ? 'is-full' : ''}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.08 }}
                />
              </div>
            </div>
            <div className="class-today-occupancy">{ocupados}/{c.capacidad_maxima} Cupos</div>
          </div>
        );
      })}
    </div>
  );
};
