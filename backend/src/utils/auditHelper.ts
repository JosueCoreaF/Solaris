import { Request } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const adminDb = () => supabaseAdmin ?? supabase;

/** Extrae el Bearer token del header Authorization */
export function extractToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7);
}

/** Decodifica email y rol del JWT sin re-verificar (solo para logging) */
export function getInfoFromToken(token: string): { email: string | null; role: string | null } {
  try {
    const payload = token.split('.')[1];
    if (!payload) return { email: null, role: null };
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const email = claims.email ?? claims.user_metadata?.email ?? null;
    return { email, role: null };
  } catch {
    return { email: null, role: null };
  }
}

/**
 * Actualiza directamente el registro más reciente de audit_log para esa entidad,
 * asignando el email del usuario logueado. Usa el cliente admin para bypasear RLS.
 * No lanza excepción — el fallo de auditoría no afecta la operación principal.
 */
export async function patchAuditUser(entidadId: string, email: string): Promise<void> {
  // Pequeña espera para que el trigger termine de insertar antes de buscar
  await new Promise(r => setTimeout(r, 300));

  const client = adminDb();

  // Buscar el log más reciente sin usuario asignado para esta entidad
  // .maybeSingle() devuelve null si no hay filas — NO lanza error
  const { data, error: selectError } = await client
    .from('audit_log')
    .select('id')
    .eq('entidad_id', entidadId)
    .is('usuario_email', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    console.error('[audit] Error buscando log:', selectError.message);
    return;
  }
  if (!data?.id) {
    console.warn('[audit] No se encontró log sin usuario para entidad:', entidadId);
    return;
  }

  // Obtener el rol del usuario desde usuarios_roles
  const { data: rolData } = await client
    .from('usuarios_roles')
    .select('rol')
    .eq('email', email)
    .eq('estado', 'activo')
    .maybeSingle();

  const { error: updateError } = await client
    .from('audit_log')
    .update({
      usuario_email: email,
      usuario_rol: rolData?.rol ?? null,
    })
    .eq('id', data.id);

  if (updateError) {
    console.error('[audit] Error actualizando log:', updateError.message);
  } else {
    console.log(`[audit] ✓ Usuario "${email}" registrado en log ${data.id}`);
  }
}
