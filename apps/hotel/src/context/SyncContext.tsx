import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../services/api';

interface HotelData {
  id_hotel: string;
  nombre_hotel: string;
  ciudad: string;
  estado: string;
}

interface SyncContextType {
  hotel: HotelData | null;
  loading: boolean;
  error: string | null;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hotel, setHotel] = useState<HotelData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initSync = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        let businessId = urlParams.get('business_id');
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');

        // Guardar token en local storage si viene en la URL
        if (accessToken && refreshToken) {
          localStorage.setItem('sb-yefaoqzyjfqpwrnzgofb-auth-token', JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }));
        }

        if (businessId) {
          localStorage.setItem('solaris_active_business_id', businessId);
          // Limpiar URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          businessId = localStorage.getItem('solaris_active_business_id');
        }

        if (!businessId) {
          setLoading(false);
          return;
        }

        // Obtener contexto del backend
        const response = await apiClient.get(`/hotel/sync-context?business_id=${businessId}`);
        setHotel(response.data);
      } catch (err: any) {
        console.error('Error sincronizando contexto:', err);
        setError(err.message || 'Error al obtener datos del hotel');
      } finally {
        setLoading(false);
      }
    };

    initSync();
  }, []);

  return (
    <SyncContext.Provider value={{ hotel, loading, error }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync debe usarse dentro de un SyncProvider');
  }
  return context;
};
