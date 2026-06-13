import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(() => ({
  plugins: [react()],
  envDir: path.resolve(__dirname, '../hub'),
  server: { port: 5177 },
  define: {
    // Dev: localhost. Prod (Vercel): VITE_API_URL configurado en el dashboard
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL || 'http://localhost:4000/api/public'
    ),
  },
}));
