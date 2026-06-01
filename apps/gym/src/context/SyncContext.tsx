import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchGimnasios } from '../api/dashboardService';

interface SyncContextValue {
  gimnasio: any | null;
  gimnasios: any[];
  loading: boolean;
  refresh: () => void;
}

const SyncContext = createContext<SyncContextValue>({ gimnasio: null, gimnasios: [], loading: true, refresh: () => {} });

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gimnasios, setGimnasios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchGimnasios();
      setGimnasios(data);
      if (data.length > 0 && !localStorage.getItem('active_gym_id')) {
        localStorage.setItem('active_gym_id', data[0].id_gimnasio);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeId = localStorage.getItem('active_gym_id');
  const gimnasio = gimnasios.find(g => g.id_gimnasio === activeId) ?? gimnasios[0] ?? null;

  return (
    <SyncContext.Provider value={{ gimnasio, gimnasios, loading, refresh: load }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);
