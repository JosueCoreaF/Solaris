import { supabase } from './supabase';
import type { FacturaRestaurante, DetalleFactura } from '../types';

export async function getFacturas(idRestaurant: string): Promise<FacturaRestaurante[]> {
  const { data, error } = await supabase
    .from('factura_restaurante')
    .select('*, detalle_factura(*, platillo(nombre_platillo), producto(nombre_producto))')
    .eq('id_restaurant', idRestaurant)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFactura(
  payload: Omit<FacturaRestaurante, 'id_factura' | 'detalle_factura'>,
  detalles: Omit<DetalleFactura, 'id_detalle_factura' | 'id_factura' | 'platillo' | 'producto'>[],
): Promise<FacturaRestaurante> {
  const { data: factura, error } = await supabase
    .from('factura_restaurante')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  if (detalles.length > 0) {
    const rows = detalles.map(d => ({ ...d, id_factura: factura.id_factura }));
    const { error: de } = await supabase.from('detalle_factura').insert(rows);
    if (de) throw de;
  }

  return factura;
}

export async function deleteFactura(id: string): Promise<void> {
  const { error } = await supabase.from('factura_restaurante').delete().eq('id_factura', id);
  if (error) throw error;
}
