import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const backendEnv = loadEnv(mode, path.resolve(__dirname, '../../backend'), '');

  return {
    plugins: [react()],
    server: { port: 5177 },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        backendEnv.VITE_API_URL || 'http://localhost:4000/api/public'
      ),
    },
  };
});
