import { supabase } from './supabase';

export interface UsuarioRol {
  id: string;
  user_id: string;
  id_hotel: string;
  email: string;
  rol: 'PROPIETARIO' | 'ADMIN' | 'RECEPCIONISTA' | 'MANTENIMIENTO' | 'CONTADOR';
  estado: 'activo' | 'inactivo' | 'suspendido' | 'pendiente_aprobacion' | 'bloqueado';
  creado_en: string;
  actualizado_en: string;
}

export interface AsignarRolParams {
  user_id: string;
  id_hotel: string;
  rol: string;
  estado: string;
  email?: string;
}

/**
 * Obtiene todos los usuarios con sus roles para un hotel
 */
export const obtenerUsuariosRoles = async (id_hotel: string): Promise<UsuarioRol[] | null> => {
  try {
    const { data, error } = await supabase
      .from('usuarios_roles_con_email')
      .select('*')
      .eq('id_hotel', id_hotel)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching usuarios_roles:', err);
    return null;
  }
};

/**
 * Obtiene un usuario específico con su rol
 */
export const obtenerUsuarioRol = async (usuario_id: string): Promise<UsuarioRol | null> => {
  try {
    const { data, error } = await supabase
      .from('usuarios_roles_con_email')
      .select('*')
      .eq('user_id', usuario_id)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error fetching usuario_rol:', err);
    return null;
  }
};

/**
 * Asigna o actualiza un rol de usuario
 */
export const asignarRol = async (params: AsignarRolParams): Promise<boolean> => {
  try {
    // Use backend endpoint to bypass Supabase RLS
    const response = await fetch('http://localhost:4000/api/roles/crear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: params.user_id,
        id_hotel: params.id_hotel || null,
        rol: params.rol,
        estado: params.estado,
        email: params.email || '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating role entry:', errorData);
      return false;
    }

    console.log('✅ Role entry created via backend');
    return true;
  } catch (err) {
    console.error('Error assigning role:', err);
    return false;
  }
};

/**
 * Cambia el estado de un usuario (activo/inactivo/suspendido)
 */
export const cambiarEstadoUsuario = async (
  usuario_id: string,
  id_hotel: string,
  estado: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('usuarios_roles')
      .update({ estado, actualizado_en: new Date().toISOString() })
      .eq('user_id', usuario_id)
      .eq('id_hotel', id_hotel);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error changing user status:', err);
    return false;
  }
};

/**
 * Solicita crear un nuevo rol (estado: pendiente_aprobacion)
 */
export const solicitarRegistro = async (
  usuario_id: string,
  id_hotel: string,
  email: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('usuarios_roles').insert({
      user_id: usuario_id,
      id_hotel,
      rol: 'RECEPCIONISTA',
      estado: 'pendiente',
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error requesting registration:', err);
    return false;
  }
};

/**
 * Obtiene TODOS los usuarios registrados (sin filtro de hotel)
 */
export const obtenerTodosLosUsuarios = async (): Promise<UsuarioRol[]> => {
  try {
    const { data, error } = await supabase
      .from('usuarios_roles_con_email')
      .select('*')
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching all usuarios:', err);
    return [];
  }
};
