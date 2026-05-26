import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: './backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: variables de entorno no configuradas');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function getOwnerIdsFromRoles(user) {
  const { data: roles, error } = await supabaseAdmin
    .from('usuarios_roles')
    .select('owner_id')
    .eq('usuario_id', user.id)
    .eq('estado', 'activo')
    .not('owner_id', 'is', null);

  if (error) return { ownerIds: [], error };

  const ownerIds = Array.from(new Set((roles || []).map((item) => item.owner_id).filter(Boolean)));
  return { ownerIds, error: null };
}

async function findOwnerForUser(user) {
  const email = user.email?.toLowerCase() ?? '';
  const { ownerIds, error: rolesError } = await getOwnerIdsFromRoles(user);
  if (rolesError) return { ownerRow: null, ownerIds: [], error: rolesError };

  if (ownerIds.length > 0) {
    const { data: ownerRow, error } = await supabaseAdmin
      .from('owners')
      .select('id_owner, nombre_empresa, email_contacto')
      .in('id_owner', ownerIds)
      .limit(1)
      .maybeSingle();

    return { ownerRow, ownerIds, error };
  }

  const { data: ownerRow, error } = await supabaseAdmin
    .from('owners')
    .select('id_owner, nombre_empresa, email_contacto')
    .eq('email_contacto', email)
    .maybeSingle();

  return { ownerRow, ownerIds: ownerRow ? [ownerRow.id_owner] : [], error };
}

async function simulateForUser(email, id) {
  const user = { email, id };
  console.log(`\n=======================================\nSimulando para: ${email} (${id})`);

  const { ownerRow, ownerIds, error: ownerError } = await findOwnerForUser(user);
  if (ownerError) {
    console.error('Error obteniendo propietario:', ownerError);
    return;
  }

  console.log('Propietario resuelto:', ownerRow);
  console.log('ownerIds:', ownerIds);

  if (ownerIds.length === 0) {
    console.log('Resultado: Redirige a /setup-owner (needsOwnerSetup: true)');
    return;
  }

  // Obtener módulos activos del owner
  const { data: modules, error: modulesErr } = await supabaseAdmin
    .from('business_modules')
    .select('id_module, tipo_modulo, nombre_modulo, estado')
    .in('owner_id', ownerIds)
    .eq('estado', 'activo');

  if (modulesErr) {
    console.error('Error al consultar business_modules:', modulesErr);
    return;
  }

  const { data: hoteles, error: hotelesErr } = await supabaseAdmin
    .from('hoteles')
    .select('id_hotel, nombre_hotel, estado, id_module')
    .in('owner_id', ownerIds)
    .eq('estado', 'activo');

  if (hotelesErr) {
    console.error('Error al consultar hoteles:', hotelesErr);
    return;
  }

  console.log('Módulos en business_modules:', modules);
  console.log('Hoteles en hoteles:', hoteles);

  const moduleIds = new Set((modules || []).map((m) => m.id_module));
  const hotelFallbacks = (hoteles || [])
    .filter((hotel) => !hotel.id_module || !moduleIds.has(hotel.id_module))
    .map((hotel) => ({
      id: hotel.id_hotel,
      type: 'hotel',
      reference_id: hotel.id_module || hotel.id_hotel,
      is_active: hotel.estado === 'activo',
      name: hotel.nombre_hotel,
    }));

  let combinedModules = [
    ...(modules || []).map((m) => ({
      id: m.id_module,
      type: m.tipo_modulo?.toLowerCase() ?? 'hotel',
      reference_id: m.id_module,
      is_active: m.estado === 'activo',
      name: m.nombre_modulo,
    })),
    ...hotelFallbacks,
  ];

  console.log('Módulos Combinados:', combinedModules);
}

async function run() {
  // Obtener usuarios de auth.users
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error('Error obteniendo usuarios de auth.users:', error);
    return;
  }

  for (const user of users.users) {
    await simulateForUser(user.email, user.id);
  }
}

run();
