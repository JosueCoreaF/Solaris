import { UsuarioRol } from './usuariosRolesService';
import { supabase } from './supabase';

export interface CrearUsuarioParams {
  email: string;
  password: string;
  nombre: string;
  rol: string;
  estado: string;
  id_hotel?: string;
}

/**
 * Crea un usuario manualmente (sin invitación)
 * Lanza un Error con el mensaje del backend si algo falla.
 */
export interface BusquedaUsuario {
  user_id: string;
  email: string;
  created_at: string;
  en_owners: boolean;
  nombre_empresa: string | null;
  roles: { rol: string; estado: string; owner_id: string }[];
}

export const buscarUsuarioPorEmail = async (email: string): Promise<BusquedaUsuario> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const response = await fetch(
    `http://localhost:4000/api/users/buscar?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
};

export const eliminarUsuarioPorEmail = async (email: string): Promise<void> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const response = await fetch('http://localhost:4000/api/users/por-email', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
};

export const eliminarUsuario = async (userId: string): Promise<void> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const response = await fetch(`http://localhost:4000/api/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
};

export const crearUsuarioManual = async (params: CrearUsuarioParams): Promise<UsuarioRol> => {
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';
  const response = await fetch('http://localhost:4000/api/users/crear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }

  return {
    id:               data.user_id,
    user_id:          data.user_id,
    owner_id:         '',
    id_hotel:         null,
    email:            data.email,
    rol:              data.rol as any,
    estado:           data.estado as any,
    creado_en:        new Date().toISOString(),
    actualizado_en:   new Date().toISOString(),
  };
};
