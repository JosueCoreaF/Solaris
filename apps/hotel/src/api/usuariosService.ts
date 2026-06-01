import { UsuarioRol } from './usuariosRolesService';
import { supabase } from './supabase';

export interface CrearUsuarioParams {
  email: string;
  password: string;
  nombre: string;
  rol: string;
  estado: string;
}

/**
 * Crea un usuario manualmente (sin invitación)
 * Lanza un Error con el mensaje del backend si algo falla.
 */
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
