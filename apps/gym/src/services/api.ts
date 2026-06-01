import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const gymId = localStorage.getItem('active_gym_id');
  if (gymId) config.headers['X-Gym-ID'] = gymId;
  return config;
});

export default apiClient;
