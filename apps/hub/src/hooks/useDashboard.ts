import { useState, useEffect } from 'react';
import axios from 'axios';
import { supabase } from '../services/supabaseClient';

export interface DashboardData {
  owner: {
    nombre: string;
    plan: string;
  };
  modules: Array<{
    id: string;
    type: string;
    reference_id: string;
    is_active: boolean;
  }>;
  kpis: {
    ingresos: number;
    negocios_activos: number;
    ocupacion: number;
    tareas: number;
  };
}

export const useDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardInfo = async () => {
      try {
        setLoading(true);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !sessionData.session) {
          throw new Error('No hay sesión activa');
        }

        const token = sessionData.session.access_token;
        
        const response = await axios.get('http://localhost:4000/api/hub/dashboard-summary', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        setData(response.data);
      } catch (err: any) {
        console.error('Error fetching dashboard:', err);
        if (err.code === 'ERR_NETWORK') {
          setError('No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.');
        } else {
          setError(err.response?.data?.error || err.message || 'Error al obtener datos');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardInfo();
  }, []);

  return { data, loading, error };
};
