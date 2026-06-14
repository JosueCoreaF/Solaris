import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface AsistenciaClase {
  id_asistencia: string;
  id_clase: string;
  id_miembro: string;
  fecha: string;
  estado: 'asistio' | 'falto' | 'cancelado';
  created_at: string;
  miembros?: { nombre_completo: string };
}

export const fetchAsistenciaPorFecha = async (fecha: string): Promise<AsistenciaClase[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('asistencia_clases')
    .select('*, miembros(nombre_completo), clases_gym!inner(id_gimnasio)')
    .eq('clases_gym.id_gimnasio', ctx.gimnasioId)
    .eq('fecha', fecha);
  if (error) throw error;
  return data ?? [];
};

export const marcarAsistencia = async (
  id_clase: string,
  id_miembro: string,
  fecha: string,
  estado: AsistenciaClase['estado']
): Promise<AsistenciaClase> => {
  const { data, error } = await supabase
    .from('asistencia_clases')
    .upsert({ id_clase, id_miembro, fecha, estado }, { onConflict: 'id_clase,id_miembro,fecha' })
    .select('*, miembros(nombre_completo)')
    .single();
  if (error) throw error;
  return data;
};

export const quitarAsistencia = async (id_asistencia: string): Promise<void> => {
  const { error } = await supabase.from('asistencia_clases').delete().eq('id_asistencia', id_asistencia);
  if (error) throw error;
};
