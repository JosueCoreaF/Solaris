import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  // Dev: lee credenciales del hub/.env (compartido en el monorepo)
  // Prod (Vercel): usa las env vars configuradas en el dashboard de Vercel
  let hubEnv: Record<string, string> = {}
  const hubEnvPath = path.resolve(__dirname, '../hub')
  if (fs.existsSync(path.join(hubEnvPath, '.env'))) {
    hubEnv = loadEnv(mode, hubEnvPath, '')
  }

  return {
    plugins: [react()],
    server: {
      port: 5176,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL':
        JSON.stringify(hubEnv.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY':
        JSON.stringify(hubEnv.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''),
      'import.meta.env.VITE_API_BASE_URL':
        JSON.stringify(hubEnv.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || 'http://localhost:4000/api'),
      'import.meta.env.VITE_HUB_URL':
        JSON.stringify(hubEnv.VITE_HUB_URL || process.env.VITE_HUB_URL || 'http://localhost:5174'),
      'import.meta.env.VITE_GEMINI_API_KEY':
        JSON.stringify(hubEnv.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
    },
  }
})
