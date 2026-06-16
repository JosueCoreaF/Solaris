import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchGimnasios } from '../api/dashboardService';
import apiClient from '../services/api';

interface PlanInfo {
  id_plan: string | null;
  nombre: string | null;
  estado: string | null;
  feature_flags: string[];
}

interface GimnasioData {
  id_gimnasio: string;
  id_module: string;
  nombre_gimnasio: string;
  ciudad: string;
  direccion: string;
  telefono?: string;
  correo_contacto?: string;
  estado: string;
  plan?: PlanInfo;
}

interface SyncContextValue {
  gimnasio: GimnasioData | null;
  gimnasios: GimnasioData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const SyncContext = createContext<SyncContextValue>({
  gimnasio: null,
  gimnasios: [],
  loading: true,
  error: null,
  refresh: () => {},
});

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gimnasios, setGimnasios] = useState<GimnasioData[]>([]);
  const [gimnasio, setGimnasio] = useState<GimnasioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchGimnasios();
      setGimnasios(list);

      if (list.length > 0) {
        let activeId = localStorage.getItem('active_gym_id');
        const exists = activeId && list.some(g => g.id_gimnasio === activeId);
        if (!exists) {
          activeId = list[0].id_gimnasio;
          localStorage.setItem('active_gym_id', activeId);
        }

        const response = await apiClient.get(`/gym/sync-context?business_id=${activeId}`);
        setGimnasio(response.data.data);
      } else {
        setGimnasio(null);
      }
    } catch (err: any) {
      console.error('Error sincronizando contexto:', err);
      setError(err.message || 'Error al obtener datos de sincronización');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SyncContext.Provider value={{ gimnasio, gimnasios, loading, error, refresh: load }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
