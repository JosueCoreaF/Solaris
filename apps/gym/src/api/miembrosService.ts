import { supabase } from './supabase';

export interface Miembro {
  id_miembro: string;
  owner_id: string;
  nombre_completo: string;
  correo: string;
  telefono?: string;
  documento_identidad?: string;
  fecha_nacimiento?: string;
  genero?: 'masculino' | 'femenino' | 'otro';
  direccion?: string;
  contacto_emergencia?: string;
  telefono_emergencia?: string;
  observaciones?: string;
  estado: 'activo' | 'inactivo' | 'suspendido';
  fecha_registro: string;
  created_at: string;
}

const getOwnerId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: rol } = await supabase
    .from('usuarios_roles')
    .select('owner_id')
    .eq('usuario_id', data.user.id)
    .eq('estado', 'activo')
    .single();
  return rol?.owner_id ?? null;
};

export const fetchMiembros = async (): Promise<Miembro[]> => {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('miembros')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const crearMiembro = async (miembro: Partial<Miembro>): Promise<Miembro> => {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error('No owner_id');
  const { data, error } = await supabase
    .from('miembros')
    .insert({ ...miembro, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const actualizarMiembro = async (id: string, updates: Partial<Miembro>): Promise<Miembro> => {
  const { data, error } = await supabase
    .from('miembros')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id_miembro', id)
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const eliminarMiembro = async (id: string): Promise<void> => {
  const { error } = await supabase.from('miembros').delete().eq('id_miembro', id);
  if (error) throw error;
};
