import axios from 'axios';
import { supabase } from './supabaseClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.set('Authorization', `Bearer ${session.access_token}`);
    }
  } catch (error) {
    console.warn('🌐 [API] No se pudo obtener sesión de Supabase', error);
  }
  return config;
});

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

const apiClient = {
  get: <T = any>(endpoint: string) => axiosInstance.get<T>(endpoint).then(res => res.data),
  post: <T = any>(endpoint: string, data?: any) => axiosInstance.post<T>(endpoint, data).then(res => res.data),
  put: <T = any>(endpoint: string, data?: any) => axiosInstance.put<T>(endpoint, data).then(res => res.data),
  patch: <T = any>(endpoint: string, data?: any) => axiosInstance.patch<T>(endpoint, data).then(res => res.data),
  delete: <T = any>(endpoint: string) => axiosInstance.delete<T>(endpoint).then(res => res.data),
};

export default apiClient;
