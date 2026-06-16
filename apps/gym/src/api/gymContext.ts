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
  let isOwner = false;
  const { data: ownerRow } = await supabase
    .from('owners')
    .select('id_owner')
    .eq('id_owner', userId)
    .maybeSingle();

  let allowedModuleIds: string[] = [];

  if (ownerRow?.id_owner) {
    ownerId = ownerRow.id_owner;
    isOwner = true;
  } else {
    // Caso 2: es staff → buscar en usuarios_roles_gym
    const { data: roles } = await supabase
      .from('usuarios_roles_gym')
      .select('owner_id, id_gimnasio')
      .eq('user_id', userId)
      .eq('estado', 'activo');

    if (roles && roles.length > 0) {
      ownerId = roles[0].owner_id;
      const gymIds = roles.map(r => r.id_gimnasio).filter(Boolean) as string[];
      if (gymIds.length > 0) {
        const { data: gyms } = await supabase
          .from('gimnasios')
          .select('id_module')
          .in('id_gimnasio', gymIds);
        if (gyms) {
          allowedModuleIds = gyms.map(g => g.id_module).filter(Boolean);
        }
      }
    }
  }

  if (!ownerId) return null;

  const activeGymId = localStorage.getItem('active_gym_id');
  let gimnasioId: string | null = null;

  // Si hay un activeGymId en localStorage, intentamos validar que pertenezca al owner (y a los módulos permitidos si es staff)
  if (activeGymId) {
    const { data: gym } = await supabase
      .from('gimnasios')
      .select('id_gimnasio, id_module')
      .eq('id_gimnasio', activeGymId)
      .maybeSingle();

    if (gym) {
      if (isOwner) {
        const { data: mod } = await supabase
          .from('business_modules')
          .select('id_module')
          .eq('id_module', gym.id_module)
          .eq('owner_id', ownerId)
          .eq('tipo_modulo', 'gym')
          .eq('estado', 'activo')
          .maybeSingle();

        if (mod) {
          gimnasioId = gym.id_gimnasio;
        }
      } else {
        if (allowedModuleIds.includes(gym.id_module)) {
          gimnasioId = gym.id_gimnasio;
        }
      }
    }
  }

  // Si no se pudo resolver con activeGymId, buscamos el primer gimnasio disponible
  if (!gimnasioId) {
    if (isOwner) {
      const { data: mods } = await supabase
        .from('business_modules')
        .select('id_module')
        .eq('owner_id', ownerId)
        .eq('tipo_modulo', 'gym')
        .eq('estado', 'activo')
        .order('created_at', { ascending: true })
        .limit(1);

      const mod = mods?.[0];
      if (mod) {
        const { data: gym } = await supabase
          .from('gimnasios')
          .select('id_gimnasio')
          .eq('id_module', mod.id_module)
          .maybeSingle();

        if (gym) {
          gimnasioId = gym.id_gimnasio;
        } else {
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

          if (!gymErr && newGym) {
            gimnasioId = newGym.id_gimnasio;
          }
        }
      }
    } else if (allowedModuleIds.length > 0) {
      const { data: gyms } = await supabase
        .from('gimnasios')
        .select('id_gimnasio')
        .in('id_module', allowedModuleIds)
        .eq('estado', 'activo')
        .limit(1);

      if (gyms && gyms.length > 0) {
        gimnasioId = gyms[0].id_gimnasio;
      }
    }
  }

  if (!gimnasioId) return null;

  // Guardar en localStorage para mantener consistencia
  localStorage.setItem('active_gym_id', gimnasioId);

  _cache = { ownerId, gimnasioId };
  return _cache;
};

export const clearGymContextCache = () => { _cache = null; };
