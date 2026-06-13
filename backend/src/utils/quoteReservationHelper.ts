import { supabaseAdmin, supabase } from '../config/supabase.js';

const db = () => supabaseAdmin ?? supabase;

/**
 * Busca un huésped por correo en el hotel o lo crea si no existe.
 */
export async function getOrCreateGuestForQuote(
  hotelId: string,
  cliente_nombre: string,
  cliente_correo: string,
  cliente_telefono?: string | null,
  cliente_identificacion?: string | null,
  id_huesped?: string | null
): Promise<string> {
  if (id_huesped) return id_huesped;

  // Intentar buscar por correo
  const { data: existingGuest } = await db()
    .from('huespedes')
    .select('id_huesped')
    .eq('id_hotel', hotelId)
    .ilike('correo', cliente_correo.trim())
    .maybeSingle();

  if (existingGuest) return existingGuest.id_huesped;

  // Crear nuevo huésped
  const { data: newGuest, error: guestErr } = await db()
    .from('huespedes')
    .insert({
      id_hotel: hotelId,
      nombre_completo: cliente_nombre.toUpperCase(),
      correo: cliente_correo.toLowerCase().trim(),
      telefono: cliente_telefono || null,
      documento_identidad: cliente_identificacion || null,
      rtn: cliente_identificacion || null
    })
    .select()
    .single();

  if (guestErr) throw new Error(`Error registrando huésped para bloqueo de cupo: ${guestErr.message}`);
  return newGuest.id_huesped;
}

/**
 * Valida la disponibilidad física de las habitaciones en el hotel,
 * excluyendo reservas ya asociadas a esta cotización.
 */
export async function allocateRoomsForQuote(
  id_cotizacion: string | null,
  hotelId: string,
  roomItems: any[],
  defaultCheckIn: string,
  defaultCheckOut: string
): Promise<{ success: boolean; allocations?: { roomItem: any; roomIds: string[] }[]; error?: string }> {
  // Obtener todas las habitaciones físicas del hotel
  const { data: allRooms, error: roomsErr } = await db()
    .from('habitaciones')
    .select('id_habitacion, nombre_habitacion, id_tipo_habitacion')
    .eq('id_hotel', hotelId);

  if (roomsErr) return { success: false, error: roomsErr.message };
  if (!allRooms || allRooms.length === 0) {
    return { success: false, error: 'No se encontraron habitaciones físicas registradas en el hotel.' };
  }

  const allocations: { roomItem: any; roomIds: string[] }[] = [];
  const usedRoomIdsGlobal = new Set<string>();

  for (const roomItem of roomItems) {
    const checkInDate = roomItem.check_in || defaultCheckIn;
    const checkOutDate = roomItem.check_out || defaultCheckOut;
    const qty = roomItem.cantidad || 1;

    // Filtrar habitaciones físicas de este tipo
    const roomsOfType = allRooms.filter(r => r.id_tipo_habitacion === roomItem.id_tipo_habitacion);
    if (roomsOfType.length === 0) {
      return {
        success: false,
        error: `No se encontraron habitaciones físicas para el tipo cotizado: ${roomItem.descripcion}`
      };
    }

    // Buscar reservas activas en ese rango de fechas
    const { data: reserved, error: reservedErr } = await db()
      .from('reservas_hotel')
      .select('id_habitacion, id_cotizacion')
      .eq('id_hotel', hotelId)
      .not('estado', 'in', '("cancelada","no_show")')
      .lt('check_in', checkOutDate)
      .gt('check_out', checkInDate);

    if (reservedErr) return { success: false, error: reservedErr.message };

    // Excluir reservas de la misma cotización (si estamos editando/actualizando)
    const reservedRoomIds = (reserved || [])
      .filter(r => !id_cotizacion || r.id_cotizacion !== id_cotizacion)
      .map(r => r.id_habitacion);

    const itemAllocatedRoomIds: string[] = [];

    for (let i = 0; i < qty; i++) {
      const availableRoom = roomsOfType.find(
        r => !reservedRoomIds.includes(r.id_habitacion) && !usedRoomIdsGlobal.has(r.id_habitacion)
      );

      if (!availableRoom) {
        return {
          success: false,
          error: `No hay suficientes habitaciones disponibles del tipo '${roomItem.descripcion}' del ${checkInDate} al ${checkOutDate}`
        };
      }

      usedRoomIdsGlobal.add(availableRoom.id_habitacion);
      itemAllocatedRoomIds.push(availableRoom.id_habitacion);
    }

    allocations.push({
      roomItem,
      roomIds: itemAllocatedRoomIds
    });
  }

  return { success: true, allocations };
}

/**
 * Sincroniza las reservas asociadas a una cotización dependiendo de su estado:
 * - Borrador/Enviada: Crea reservas 'pendiente'
 * - Aceptada: Crea o actualiza a reservas 'confirmada' y asocia servicios
 * - Rechazada/Expirada: Elimina cualquier reserva asociada
 */
export async function syncQuoteReservations(
  quoteId: string,
  hotelId: string,
  targetStatus: string,
  quoteData: {
    cliente_nombre: string;
    cliente_correo: string;
    cliente_telefono?: string | null;
    cliente_identificacion?: string | null;
    id_huesped?: string | null;
    id_empresa?: string | null;
    check_in: string;
    check_out: string;
    adultos: number;
    ninos: number;
    moneda: string;
    numero_cotizacion: string;
    notas?: string | null;
    userId?: string | null;
  },
  items: any[]
): Promise<{ success: boolean; bookings?: any[]; error?: string }> {
  const isHoldState = ['Borrador', 'Enviada', 'Aceptada'].includes(targetStatus);

  // 1. Limpiar reservas anteriores de esta cotización para evitar duplicidades
  const { error: deleteErr } = await db()
    .from('reservas_hotel')
    .delete()
    .eq('id_cotizacion', quoteId);

  if (deleteErr) {
    return { success: false, error: `Error limpiando reservas de cotización: ${deleteErr.message}` };
  }

  if (!isHoldState) {
    // Si no requiere bloqueo (Rechazada o Expirada), ya hemos liberado las habitaciones
    return { success: true };
  }

  // 2. Filtrar items de tipo habitación
  const roomItems = items.filter(it => it.tipo_item === 'habitacion');
  if (roomItems.length === 0) {
    return { success: true };
  }

  // 3. Validar disponibilidad y obtener asignación
  const allocResult = await allocateRoomsForQuote(
    quoteId,
    hotelId,
    roomItems,
    quoteData.check_in,
    quoteData.check_out
  );

  if (!allocResult.success) {
    return { success: false, error: allocResult.error };
  }

  const allocations = allocResult.allocations || [];

  // 4. Resolver o crear el huésped
  let guestId: string;
  try {
    guestId = await getOrCreateGuestForQuote(
      hotelId,
      quoteData.cliente_nombre,
      quoteData.cliente_correo,
      quoteData.cliente_telefono,
      quoteData.cliente_identificacion,
      quoteData.id_huesped
    );
  } catch (gErr: any) {
    return { success: false, error: gErr.message };
  }

  // 5. Crear las reservas correspondientes (pendiente o confirmada)
  const targetBookingState = targetStatus === 'Aceptada' ? 'confirmada' : 'pendiente';
  const bookingsCreated = [];

  for (const alloc of allocations) {
    const { roomItem, roomIds } = alloc;
    const checkInDate = roomItem.check_in || quoteData.check_in;
    const checkOutDate = roomItem.check_out || quoteData.check_out;
    const numAdults = roomItem.adultos ?? quoteData.adultos;
    const numChildren = roomItem.ninos ?? quoteData.ninos;
    const qty = roomItem.cantidad || 1;

    for (let i = 0; i < roomIds.length; i++) {
      const roomId = roomIds[i];
      const { data: booking, error: bookingErr } = await db()
        .from('reservas_hotel')
        .insert({
          id_hotel: hotelId,
          id_huesped: guestId,
          id_habitacion: roomId,
          id_empresa: quoteData.id_empresa || null,
          check_in: `${checkInDate}T15:00:00`,
          check_out: `${checkOutDate}T12:00:00`,
          adultos: numAdults,
          ninos: numChildren,
          estado: targetBookingState,
          total_reserva: Number((Number(roomItem.subtotal || 0) / qty).toFixed(2)),
          moneda: quoteData.moneda || 'HNL',
          estado_pago: quoteData.id_empresa ? 'credito' : 'deuda',
          anticipo: 0,
          es_cortesia: false,
          observaciones: `${targetBookingState === 'confirmada' ? 'Reserva' : 'Bloqueo temporal'} asociado a cotización ${quoteData.numero_cotizacion}. ` + (quoteData.notas || ''),
          id_cotizacion: quoteId,
          created_by: quoteData.userId || null
        })
        .select()
        .single();

      if (bookingErr) {
        // Hacemos rollback
        await db().from('reservas_hotel').delete().eq('id_cotizacion', quoteId);
        return { success: false, error: `Error creando reserva asociada: ${bookingErr.message}` };
      }
      bookingsCreated.push(booking);
    }
  }

  // 6. Si es Aceptada, asociar servicios adicionales a la primera reserva
  if (targetBookingState === 'confirmada') {
    const serviceItems = items.filter(it => it.tipo_item === 'servicio' && it.id_servicio);
    if (serviceItems.length > 0 && bookingsCreated.length > 0) {
      const { error: srvErr } = await db()
        .from('reserva_servicios')
        .insert(
          serviceItems.map(srv => ({
            id_reserva_hotel: bookingsCreated[0].id_reserva_hotel,
            id_servicio: srv.id_servicio,
            cantidad: srv.cantidad,
            precio_unitario: srv.precio_unitario
          }))
        );
      if (srvErr) {
        console.error('Error insertando servicios al confirmar cotización:', srvErr);
      }
    }
  }

  return { success: true, bookings: bookingsCreated };
}
