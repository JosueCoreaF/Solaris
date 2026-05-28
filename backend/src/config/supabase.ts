import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL no está configurada en .env');
}

if (!supabaseKey) {
  throw new Error('SUPABASE_ANON_KEY no está configurada en .env');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL no está configurada en .env');
}

// Cliente Supabase para operaciones desde el servidor
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Cliente con service role (para operaciones admin)
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

/**
 * Crea un cliente Supabase usando el JWT del usuario.
 * Esto hace que auth.uid() funcione en los triggers de PostgreSQL,
 * permitiendo registrar quién realizó cada acción en audit_log.
 */
export function crearClienteUsuario(token: string) {
  return createClient(supabaseUrl!, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export const config_env = {
  supabaseUrl,
  supabaseKey,
  supabaseServiceRoleKey,
  databaseUrl,
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  resendApiKey: process.env.RESEND_API_KEY || '',
};
