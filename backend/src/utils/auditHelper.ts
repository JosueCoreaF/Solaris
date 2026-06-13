import { Request } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const adminDb = () => supabaseAdmin ?? supabase;

/** Extrae el Bearer token del header Authorization */
export function extractToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const match = h.match(/^bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** Decodifica email, userId y rol del JWT sin re-verificar (solo para logging) */
export function getInfoFromToken(token: string): { email: string | null; role: string | null; userId: string | null } {
  try {
    const payload = token.split('.')[1];
    if (!payload) return { email: null, role: null, userId: null };
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const email = claims.email ?? claims.user_metadata?.email ?? null;
    const userId = claims.sub ?? null;
    return { email, role: null, userId };
  } catch {
    return { email: null, role: null, userId: null };
  }
}

/**
 * Parcha el registro más reciente de audit_log para una tabla dada,
 * asignando el email y rol del usuario logueado.
 * Busca por nombre de tabla + ventana de tiempo porque entidad_id es null
 * para tablas con PK personalizada (id_reserva_hotel, id_pago_hotel, etc.).
 * No lanza excepción — el fallo de auditoría no afecta la operación principal.
 */
export async function patchAuditUser(tableName: string, userId: string, email: string): Promise<void> {
  await new Promise(r => setTimeout(r, 500));

  const client = adminDb();
  const cutoff = new Date(Date.now() - 8000).toISOString();

  const { data, error: selectError } = await client
    .from('audit_log')
    .select('id')
    .eq('entidad', tableName)
    .is('usuario_email', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError || !data?.id) return;

  const { data: rolData } = await client
    .from('usuarios_roles')
    .select('rol')
    .eq('user_id', userId)
    .eq('estado', 'activo')
    .maybeSingle();

  await client
    .from('audit_log')
    .update({ usuario_email: email, usuario_rol: rolData?.rol ?? null })
    .eq('id', data.id);
}
