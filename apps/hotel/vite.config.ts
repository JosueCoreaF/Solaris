import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  // Dev: lee credenciales del backend/.env
  // Prod (Vercel): usa las env vars configuradas en el dashboard de Vercel
  let backendEnv: Record<string, string> = {};
  const backendEnvPath = path.resolve(__dirname, '../../backend');
  if (fs.existsSync(path.join(backendEnvPath, '.env'))) {
    backendEnv = loadEnv(mode, backendEnvPath, '');
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:4000', changeOrigin: true },
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL':
        JSON.stringify(backendEnv.SUPABASE_URL      || process.env.VITE_SUPABASE_URL      || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY':
        JSON.stringify(backendEnv.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_API_BASE_URL':
        JSON.stringify(process.env.VITE_API_BASE_URL || 'http://localhost:4000/api'),
      'import.meta.env.VITE_MEDIA_BUCKET':
        JSON.stringify(process.env.VITE_MEDIA_BUCKET || 'solaris-media'),
      'import.meta.env.VITE_HUB_URL':
        JSON.stringify(process.env.VITE_HUB_URL || 'http://localhost:5174'),
    },
  };
});
