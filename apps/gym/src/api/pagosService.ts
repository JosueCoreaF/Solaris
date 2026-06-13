import { supabase } from './supabase';

export interface PagoGym {
  id_pago_gym: string;
  owner_id: string;
  id_inscripcion: string;
  monto: number;
  metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia' | 'deposito' | 'otro';
  referencia?: string;
  fecha_pago: string;
  estado: 'registrado' | 'aplicado' | 'anulado';
  notas?: string;
  created_at: string;
  inscripciones_gym?: {
    miembros: { nombre_completo: string };
    planes_membresia: { nombre: string };
  };
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

export const fetchPagos = async (): Promise<PagoGym[]> => {
  const ownerId = await getOwnerId();
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('pagos_gym')
    .select('*, inscripciones_gym(miembros(nombre_completo), planes_membresia(nombre))')
    .eq('owner_id', ownerId)
    .order('fecha_pago', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const registrarPago = async (pago: Partial<PagoGym>): Promise<PagoGym> => {
  const ownerId = await getOwnerId();
  if (!ownerId) throw new Error('No owner_id');
  const { data, error } = await supabase
    .from('pagos_gym')
    .insert({ ...pago, owner_id: ownerId })
    .select()
    .single();
  if (error) throw error;

  // Actualizar estado_pago de la inscripcion a 'pagado'
  await supabase
    .from('inscripciones_gym')
    .update({ estado_pago: 'pagado', updated_at: new Date().toISOString() })
    .eq('id_inscripcion', pago.id_inscripcion);

  return data;
};

export const anularPago = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('pagos_gym')
    .update({ estado: 'anulado', updated_at: new Date().toISOString() })
    .eq('id_pago_gym', id);
  if (error) throw error;
};
