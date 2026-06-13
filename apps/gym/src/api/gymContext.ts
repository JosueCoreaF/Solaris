import { supabase } from './supabase';

export interface GymContext {
  ownerId: string;
  gimnasioId: string;
}

let _cache: GymContext | null = null;

export const getGymContext = async (): Promise<GymContext | null> => {
  if (_cache) return _cache;

  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const userId = data.user.id;

  // Caso 1: el usuario ES el dueño (owners.id_owner = auth.uid())
  let ownerId: string | null = null;
  const { data: ownerRow } = await supabase
    .from('owners')
    .select('id_owner')
    .eq('id_owner', userId)
    .maybeSingle();

  if (ownerRow?.id_owner) {
    ownerId = ownerRow.id_owner;
  } else {
    // Caso 2: es staff → buscar en usuarios_roles
    const { data: roles } = await supabase
      .from('usuarios_roles')
      .select('owner_id')
      .eq('user_id', userId)
      .eq('estado', 'activo')
      .limit(1);
    ownerId = roles?.[0]?.owner_id ?? null;
  }

  if (!ownerId) return null;

  // Obtener el módulo gym del owner (puede tener varios negocios tipo gym)
  const activeGymId = localStorage.getItem('active_gym_id');
  let modQuery = supabase
    .from('business_modules')
    .select('id_module')
    .eq('owner_id', ownerId)
    .eq('tipo_modulo', 'gym')
    .eq('estado', 'activo');

  modQuery = activeGymId
    ? modQuery.eq('id_module', activeGymId)
    : modQuery.order('created_at', { ascending: true });

  const { data: mods } = await modQuery.limit(1);
  const mod = mods?.[0];

  if (!mod?.id_module) return null;

  // Obtener o crear el gimnasio
  let gimnasioId: string | null = null;
  const { data: gym } = await supabase
    .from('gimnasios')
    .select('id_gimnasio')
    .eq('id_module', mod.id_module)
    .maybeSingle();

  if (gym?.id_gimnasio) {
    gimnasioId = gym.id_gimnasio;
  } else {
    // El módulo existe pero no se creó el gimnasio — autocrearlo
    const { data: newGym, error: gymErr } = await supabase
      .from('gimnasios')
      .insert({
        id_module:       mod.id_module,
        nombre_gimnasio: 'Mi Gimnasio',
        ciudad:          'Sin definir',
        direccion:       'Sin definir',
        estado:          'activo',
      })
      .select('id_gimnasio')
      .single();

    if (gymErr) {
      console.error('[gymContext] Error creando gimnasio:', gymErr.message);
      return null;
    }
    gimnasioId = newGym?.id_gimnasio ?? null;
  }

  if (!gimnasioId) return null;

  _cache = { ownerId, gimnasioId };
  return _cache;
};

export const clearGymContextCache = () => { _cache = null; };
