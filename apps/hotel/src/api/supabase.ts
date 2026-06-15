import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar configuradas en .env.local'
  );
}

// En modo soporte (impersonación de administrador) usamos sessionStorage,
// aislado por pestaña, y además una "storageKey" única por pestaña: Supabase
// sincroniza sesiones entre pestañas mediante un BroadcastChannel basado en
// el storageKey, que se comparte entre pestañas del mismo origen aunque usen
// sessionStorage. Sin un storageKey único, abrir el enlace de soporte de otro
// propietario en otra pestaña reemplazaría la sesión activa en esta.
const isSupportSession =
  new URLSearchParams(window.location.search).get('soporte') === '1' ||
  sessionStorage.getItem('solaris_support_mode') === '1';

let supportStorageKey: string | undefined;
if (isSupportSession) {
  let sid = sessionStorage.getItem('solaris_support_session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('solaris_support_session_id', sid);
  }
  supportStorageKey = `sb-support-${sid}-auth-token`;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isSupportSession ? window.sessionStorage : window.localStorage,
    storageKey: supportStorageKey,
    autoRefreshToken: true,
    persistSession: true,
  },
});
