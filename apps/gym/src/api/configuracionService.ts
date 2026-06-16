import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface ConfiguracionGym {
  id_config: string;
  id_gimnasio: string;
  moneda: string;
  porcentaje_impuesto: number;
  hora_apertura: string;
  hora_cierre: string;
  dias_aviso_vencimiento: number;
  permitir_congelar_membresia: boolean;
  nombre_negocio: string;
}

export const fetchConfiguracion = async (): Promise<ConfiguracionGym | null> => {
  const ctx = await getGymContext();
  if (!ctx) return null;
  const { data, error } = await supabase
    .from('configuracion_gym')
    .select('*')
    .eq('id_gimnasio', ctx.gimnasioId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const guardarConfiguracion = async (updates: Partial<ConfiguracionGym>): Promise<ConfiguracionGym> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');

  const { data: existing } = await supabase
    .from('configuracion_gym')
    .select('id_config')
    .eq('id_gimnasio', ctx.gimnasioId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('configuracion_gym')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id_config', existing.id_config)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('configuracion_gym')
    .insert({ ...updates, id_gimnasio: ctx.gimnasioId })
    .select()
    .single();
  if (error) throw error;
  return data;
};
