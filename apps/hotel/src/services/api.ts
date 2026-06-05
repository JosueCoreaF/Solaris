import axios from 'axios';
import { ApiResponse, Reserva, Habitacion } from '../types';
import { supabase } from '../api/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const activeHotelId = localStorage.getItem('active_hotel_id') || '';
    config.headers['X-Hotel-ID'] = activeHotelId;
    // Adjuntar JWT para rutas que requieren autenticación
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    } catch (_) { /* sin sesión activa */ }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosInstance.interceptors.response.use(
  (response) => {
    console.log('🌐 [API]:', response.config.url, '-> Success');
    return response;
  },
  (error) => {
    console.error('🌐 [API Error]:', error.config?.url, error.message);
    return Promise.reject(error);
  }
);

// Funciones de utilidad para fetch compatibilidad
const fetchAPI = async <T>(
  endpoint: string,
  options: any = {}
): Promise<ApiResponse<T>> => {
  try {
    const { method = 'GET', body, headers } = options;
    const response = await axiosInstance.request<T>({
      url: endpoint,
      method,
      data: body ? JSON.parse(body) : undefined,
      headers,
    });
    return { data: response.data };
  } catch (error: any) {
    return {
      error: error.response?.data?.error || error.message || 'Error desconocido',
    };
  }
};

// Servicios de Reservas
export const reservasService = {
  getAll: () => fetchAPI<Reserva[]>('/reservations'),
  getById: (id: string) => fetchAPI<Reserva>(`/reservations/${id}`),
  create: (data: Partial<Reserva>) =>
    fetchAPI<Reserva>('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Reserva>) =>
    fetchAPI<Reserva>(`/reservations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/reservations/${id}`, { method: 'DELETE' }),
};

// Servicios de Habitaciones
export const habitacionesService = {
  getAll: () => fetchAPI<Habitacion[]>('/rooms'),
  getById: (id: string) => fetchAPI<Habitacion>(`/rooms/${id}`),
  create: (data: Partial<Habitacion>) =>
    fetchAPI<Habitacion>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Habitacion>) =>
    fetchAPI<Habitacion>(`/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<void>(`/rooms/${id}`, { method: 'DELETE' }),
};

const apiClient = {
  get: <T = any>(endpoint: string) => axiosInstance.get<T>(endpoint).then(res => res.data),
  post: <T = any>(endpoint: string, data?: any) => axiosInstance.post<T>(endpoint, data).then(res => res.data),
  put: <T = any>(endpoint: string, data?: any) => axiosInstance.put<T>(endpoint, data).then(res => res.data),
  patch: <T = any>(endpoint: string, data?: any) => axiosInstance.patch<T>(endpoint, data).then(res => res.data),
  delete: <T = any>(endpoint: string) => axiosInstance.delete<T>(endpoint).then(res => res.data),
};

export default apiClient;
