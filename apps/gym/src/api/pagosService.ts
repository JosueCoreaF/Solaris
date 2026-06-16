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
  if (!pago.id_inscripcion || pago.monto == null) throw new Error('Inscripción y monto requeridos');

  const { data: rpcData, error: rpcError } = await supabase.rpc('fn_registrar_pago_gym', {
    p_owner_id: ctx.ownerId,
    p_id_inscripcion: pago.id_inscripcion,
    p_monto: pago.monto,
    p_metodo_pago: pago.metodo_pago ?? 'efectivo',
    p_referencia: pago.referencia ?? null,
    p_notas: pago.notas ?? null,
  });
  if (rpcError) throw rpcError;

  const idPagoGym = (rpcData as any)?.id_pago_gym;
  const { data, error } = await supabase
    .from('pagos_gym')
    .select('*, inscripciones_gym!inner(id_gimnasio, miembros(nombre_completo), planes_membresia(nombre))')
    .eq('id_pago_gym', idPagoGym)
    .single();
  if (error) throw error;
  return data;
};

export const anularPago = async (id: string): Promise<void> => {
  const ctx = await getGymContext();
  if (!ctx) throw new Error('Sin contexto de gimnasio');
  const { error } = await supabase.rpc('fn_anular_pago_gym', {
    p_owner_id: ctx.ownerId,
    p_id_pago_gym: id,
  });
  if (error) throw error;
};
