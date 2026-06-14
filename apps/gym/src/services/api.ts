import axios from 'axios';
import { supabase } from '../api/supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  async (config) => {
    const gymId = localStorage.getItem('active_gym_id');
    if (gymId) config.headers['X-Gym-ID'] = gymId;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    } catch (_) { /* sin sesión activa */ }

    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;
