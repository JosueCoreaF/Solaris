import { UsuarioRol } from './usuariosRolesService';

export interface CrearUsuarioParams {
  email: string;
  password: string;
  nombre: string;
  rol: string;
  estado: string;
}

/**
 * Crea un usuario manualmente (sin invitación)
 */
export const crearUsuarioManual = async (params: CrearUsuarioParams): Promise<UsuarioRol | null> => {
  try {
    const response = await fetch('http://localhost:4000/api/users/crear', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creating user:', errorData);
      return null;
    }

    const data = await response.json();
    return {
      id: data.user_id,
      usuario_id: data.user_id,
      id_hotel: '00000000-0000-0000-0000-000000000000',
      email: data.email,
      rol: data.rol as any,
      estado: data.estado as any,
      creado_en: new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Error creating user:', err);
    return null;
  }
};
