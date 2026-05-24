import express from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export async function getAuthUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin!.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function getOwnerHotelIdsForUser(user: any) {
  const { data: roles, error } = await supabaseAdmin!
    .from('usuarios_roles')
    .select('owner_id, id_hotel')
    .eq('usuario_id', user.id)
    .eq('estado', 'activo');

  if (error) return { ownerIds: [] as string[], hotelIds: [] as string[], error };

  const ownerIds = Array.from(
    new Set(
      (roles || [])
        .map((item: any) => item.owner_id)
        .filter((id: any) => !!id)
    )
  );

  const hotelIds = Array.from(
    new Set(
      (roles || [])
        .map((item: any) => item.id_hotel)
        .filter((id: any) => !!id)
    )
  );

  if (ownerIds.length > 0) {
    return { ownerIds, hotelIds, error: null };
  }

  const email = user.email?.toLowerCase() ?? '';
  if (!email) {
    return { ownerIds, hotelIds, error: null };
  }

  const { data: ownerRow, error: ownerError } = await supabaseAdmin!
    .from('owners')
    .select('id_owner')
    .eq('email_contacto', email)
    .maybeSingle();

  if (ownerError) return { ownerIds: [], hotelIds: [], error: ownerError };
  if (ownerRow?.id_owner) {
    ownerIds.push(ownerRow.id_owner);
  }

  return { ownerIds, hotelIds, error: null };
}

export async function getOwnerIdsFromHotelId(hotelId: string) {
  const { data, error } = await supabaseAdmin!
    .from('hoteles')
    .select('owner_id')
    .eq('id_hotel', hotelId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data?.owner_id) return [];
  return [data.owner_id];
}
