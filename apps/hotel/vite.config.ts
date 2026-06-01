import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Lee el .env del backend (fuente única de verdad para credenciales)
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../../backend'), '');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    define: {
      // Mapea las vars del backend al formato VITE_ que usa el frontend
      'import.meta.env.VITE_SUPABASE_URL':      JSON.stringify(backendEnv.SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(backendEnv.SUPABASE_ANON_KEY),
      'import.meta.env.VITE_API_BASE_URL':       JSON.stringify('http://localhost:4000/api'),
      'import.meta.env.VITE_MEDIA_BUCKET':       JSON.stringify('solaris-media'),
    },
  };
});
