import { supabase } from './supabase';
import type { PedidoRestaurante, DetallePedido, EstadoPedido } from '../types';

export async function getPedidos(idRestaurant: string): Promise<PedidoRestaurante[]> {
  const { data, error } = await supabase
    .from('pedido_restaurante')
    .select(`
      *,
      cliente_restaurante(*),
      empleado_restaurante(*),
      mesa_restaurante(*),
      detalle_pedido_restaurante(*, platillo(*))
    `)
    .eq('id_restaurant', idRestaurant)
    .order('fecha_pedido', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPedidosHoy(idRestaurant: string): Promise<PedidoRestaurante[]> {
  const hoy = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('pedido_restaurante')
    .select(`*, detalle_pedido_restaurante(*, platillo(*))`)
    .eq('id_restaurant', idRestaurant)
    .gte('fecha_pedido', `${hoy}T00:00:00`)
    .lte('fecha_pedido', `${hoy}T23:59:59`)
    .order('fecha_pedido', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createPedido(
  payload: Omit<PedidoRestaurante, 'id_pedido' | 'fecha_pedido' | 'total' | 'cliente_restaurante' | 'empleado_restaurante' | 'mesa_restaurante' | 'detalle_pedido_restaurante'>,
  detalles: Omit<DetallePedido, 'id_detalle' | 'id_pedido'>[],
): Promise<PedidoRestaurante> {
  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedido_restaurante')
    .insert(payload)
    .select()
    .single();
  if (pedidoErr) throw pedidoErr;

  if (detalles.length > 0) {
    const detallesPayload = detalles.map(d => ({ ...d, id_pedido: pedido.id_pedido }));
    const { error: detErr } = await supabase.from('detalle_pedido_restaurante').insert(detallesPayload);
    if (detErr) throw detErr;
  }

  return pedido;
}

export async function updateEstadoPedido(id: string, estado: EstadoPedido): Promise<void> {
  const { error } = await supabase
    .from('pedido_restaurante')
    .update({ estado_pedido: estado })
    .eq('id_pedido', id);
  if (error) throw error;
}

export async function deletePedido(id: string): Promise<void> {
  const { error } = await supabase.from('pedido_restaurante').delete().eq('id_pedido', id);
  if (error) throw error;
}
