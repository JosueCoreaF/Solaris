import { supabase } from './supabase';
import { getGymContext } from './gymContext';

export interface PagoGym {
  id_pago_gym: string;
  id_inscripcion: string;
  monto: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'deposito' | 'otro';
  referencia?: string;
  moneda: string;
  fecha_pago: string;
  estado: 'registrado' | 'aplicado' | 'anulado';
  notas?: string;
  created_at: string;
  inscripciones_gym?: {
    miembros: { nombre_completo: string };
    planes_membresia: { nombre: string };
  };
}

export const fetchPagos = async (): Promise<PagoGym[]> => {
  const ctx = await getGymContext();
  if (!ctx) return [];
  const { data, error } = await supabase
    .from('pagos_gym')
    .select('*, inscripciones_gym!inner(id_gimnasio, miembros(nombre_completo), planes_membresia(nombre))')
    .eq('inscripciones_gym.id_gimnasio', ctx.gimnasioId)
    .order('fecha_pago', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const registrarPago = async (pago: Partial<PagoGym>): Promise<PagoGym> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { data, error } = await supabase
    .from('pagos_gym')
    .insert({ ...pago })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const anularPago = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('pagos_gym')
    .update({ estado: 'anulado', updated_at: new Date().toISOString() })
    .eq('id_pago_gym', id);
  if (error) throw error;
};
