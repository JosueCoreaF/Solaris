import { supabaseAdmin } from '../config/supabase.js';
import { getIO } from '../routes/hotel/chat.js';

export type TipoNotificacion = 'reserva_web' | 'cotizacion_aceptada' | 'mensaje_cliente';

type CrearNotificacionOpts = {
  hotelId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje?: string;
  link?: string;
};

/**
 * Inserta una notificación para el hotel y la emite por socket
 * (room `hotel:{id}`) para actualizar el centro de notificaciones en vivo.
 */
export async function crearNotificacion(opts: CrearNotificacionOpts) {
  const { hotelId, tipo, titulo, mensaje, link } = opts;

  const { data, error } = await supabaseAdmin!
    .from('notificaciones')
    .insert({ id_hotel: hotelId, tipo, titulo, mensaje: mensaje ?? null, link: link ?? null })
    .select()
    .single();

  if (error) {
    console.warn('[Notificaciones] Error creando notificación:', error.message);
    return null;
  }

  const io = getIO();
  if (io && data) {
    io.to(`hotel:${hotelId}`).emit('nueva_notificacion', data);
  }

  return data;
}
