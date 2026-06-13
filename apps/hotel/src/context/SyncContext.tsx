import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../services/api';

interface PlanInfo {
  id_plan: string | null;
  nombre: string | null;
  estado: string | null;
  feature_flags: string[];
}

interface HotelData {
  id_hotel: string;
  nombre_hotel: string;
  ciudad: string;
  estado: string;
  plan?: PlanInfo;
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
        // Clave histórica que quedaba "pegada" entre cuentas distintas en el
        // mismo navegador y hacía que se mostraran datos de otro hotel/plan.
        // Ya no se usa: se elimina para evitar fugas entre cuentas.
        localStorage.removeItem('solaris_active_business_id');

        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');

        // Guardar token en local storage si viene en la URL
        if (accessToken && refreshToken) {
          localStorage.setItem('sb-rmdflsphuxjdcxqpfwvv-auth-token', JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }));
        }

        // El id del negocio activo: de la URL (redirección desde el hub) o,
        // si no hay, el que ya esté seleccionado en el panel (active_hotel_id,
        // la misma clave que usa el resto de la app y el switcher del sidebar).
        const urlBusinessId = urlParams.get('hotel_id') || urlParams.get('business_id');
        const businessId = urlBusinessId || localStorage.getItem('active_hotel_id') || '';

        if (urlBusinessId) {
          // Limpiar URL (AuthContext ya guardó el id correcto en active_hotel_id)
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Obtener contexto del backend. Si no llega business_id (login directo
        // al panel hotelero), el backend resuelve el hotel del usuario autenticado.
        const response = await apiClient.get(`/hotel/sync-context${businessId ? `?business_id=${businessId}` : ''}`);
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
