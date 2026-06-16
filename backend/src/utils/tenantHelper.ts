import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Middleware factory: bloquea el acceso si el owner tiene estado 'suspendido'/'inactivo',
 * o si el módulo de negocio específico (tipoModulo) fue desactivado individualmente
 * desde el panel admin (business_modules.is_active = false).
 * También bloquea a usuarios cuyo token fue revocado (usuario eliminado → 401).
 */
export function checkAccountStatus(tipoModulo?: 'hotel' | 'restaurant' | 'gym' | 'store') {
  return async function (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Buscar el owner_id y estado: primero como propietario directo, luego como staff
    let ownerId: string | null = null;
    let estado: string | null = null;

    const { data: owner } = await supabaseAdmin!
      .from('owners')
      .select('id_owner, estado')
      .eq('id_owner', user.id)
      .maybeSingle();

    if (owner?.id_owner) {
      ownerId = owner.id_owner;
      estado = owner.estado;
    } else {
      const { data: role } = await supabaseAdmin!
        .from('usuarios_roles')
        .select('owner_id')
        .eq('user_id', user.id)
        .eq('estado', 'activo')
        .limit(1)
        .maybeSingle();

      if (role?.owner_id) {
        ownerId = role.owner_id;
        const { data: ownerData } = await supabaseAdmin!
          .from('owners')
          .select('estado')
          .eq('id_owner', role.owner_id)
          .maybeSingle();
        estado = ownerData?.estado ?? null;
      }
    }

    if (estado === 'suspendido') {
      res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Tu cuenta ha sido suspendida. Contacta con soporte para más información.',
      });
      return;
    }

    if (estado === 'inactivo') {
      res.status(403).json({
        error: 'ACCOUNT_INACTIVE',
        message: 'Tu cuenta está inactiva.',
      });
      return;
    }

    // Bloqueo a nivel de negocio individual: el owner está activo pero
    // este módulo específico fue suspendido/desactivado desde el panel admin.
    if (tipoModulo && ownerId) {
      const { data: module } = await supabaseAdmin!
        .from('business_modules')
        .select('is_active, estado')
        .eq('owner_id', ownerId)
        .eq('tipo_modulo', tipoModulo)
        .maybeSingle();

      if (module && (module.is_active === false || module.estado === 'inactivo')) {
        res.status(403).json({
          error: 'MODULE_SUSPENDED',
          message: 'Este negocio ha sido suspendido. Contacta con soporte para más información.',
        });
        return;
      }
    }

    (req as any).authUser = user;
    next();
  };
}

export async function getAuthUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin!.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Resuelve owner_id y hotel_ids para un usuario autenticado.
 *
 * Diseño del schema:
 * - El PROPIETARIO se identifica por: owners.id_owner = auth.uid()
 *   (no tiene fila en usuarios_roles)
 * - El staff (ADMIN, RECEPCIONISTA, etc.) tiene fila en usuarios_roles
 *   con user_id = auth.uid() y owner_id = su propietario
 */
export async function getOwnerHotelIdsForUser(user: any) {
  // 1. ¿Es propietario? (su auth.uid = owners.id_owner)
  const { data: ownerRow } = await supabaseAdmin!
    .from('owners')
    .select('id_owner')
    .eq('id_owner', user.id)
    .maybeSingle();

  if (ownerRow?.id_owner) {
    // Dos queries simples en vez de join embebido (más fiable en PostgREST)
    const { data: modules } = await supabaseAdmin!
      .from('business_modules')
      .select('id_module')
      .eq('owner_id', ownerRow.id_owner);

    const moduleIds = (modules || []).map((m: any) => m.id_module).filter(Boolean);

    let hotelIds: string[] = [];
    if (moduleIds.length > 0) {
      const { data: hoteles } = await supabaseAdmin!
        .from('hoteles')
        .select('id_hotel')
        .in('id_module', moduleIds);
      hotelIds = (hoteles || []).map((h: any) => h.id_hotel).filter(Boolean);
    }

    return { ownerIds: [ownerRow.id_owner], hotelIds, error: null };
  }

  // 2. ¿Es staff? (tiene fila en usuarios_roles o usuarios_roles_gym con user_id)
  const [rolesResult, gymRolesResult] = await Promise.all([
    supabaseAdmin!
      .from('usuarios_roles')
      .select('owner_id, id_hotel')
      .eq('user_id', user.id)
      .eq('estado', 'activo'),
    supabaseAdmin!
      .from('usuarios_roles_gym')
      .select('owner_id, id_gimnasio')
      .eq('user_id', user.id)
      .eq('estado', 'activo')
  ]);

  if (rolesResult.error) return { ownerIds: [] as string[], hotelIds: [] as string[], error: rolesResult.error };

  const ownerIdsSet = new Set<string>();
  const hotelIdsSet = new Set<string>();

  (rolesResult.data || []).forEach((r: any) => {
    if (r.owner_id) ownerIdsSet.add(r.owner_id);
    if (r.id_hotel) hotelIdsSet.add(r.id_hotel);
  });

  (gymRolesResult.data || []).forEach((r: any) => {
    if (r.owner_id) ownerIdsSet.add(r.owner_id);
    if (r.id_gimnasio) hotelIdsSet.add(r.id_gimnasio);
  });

  return {
    ownerIds: Array.from(ownerIdsSet),
    hotelIds: Array.from(hotelIdsSet),
    error: null
  };
}

/**
 * Obtiene el owner_id de un hotel via business_modules.
 */
export async function getOwnerIdsFromHotelId(hotelId: string) {
  const { data, error } = await supabaseAdmin!
    .from('hoteles')
    .select('business_modules!inner(owner_id)')
    .eq('id_hotel', hotelId)
    .maybeSingle();

  if (error) throw error;
  const ownerId = (data as any)?.business_modules?.owner_id;
  return ownerId ? [ownerId] : [];
}

/**
 * Verifica si el plan de suscripción del owner de un hotel incluye el
 * feature flag indicado (planes_suscripcion.feature_flags).
 */
export async function hotelHasFeature(hotelId: string, featureKey: string): Promise<boolean> {
  const [ownerId] = await getOwnerIdsFromHotelId(hotelId);
  if (!ownerId) return false;

  const { data: sub } = await supabaseAdmin!
    .from('suscripciones_owner')
    .select('planes_suscripcion(feature_flags)')
    .eq('owner_id', ownerId)
    .eq('tipo_modulo', 'hotel')
    .maybeSingle();

  const flags: string[] = (sub?.planes_suscripcion as any)?.feature_flags ?? [];
  return flags.includes(featureKey);
}
