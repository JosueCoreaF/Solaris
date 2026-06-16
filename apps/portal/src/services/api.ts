const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/public';

export interface HotelSuggestion {
  nombre: string;
  slug: string;
  ciudad: string | null;
  logoUrl: string | null;
}

export async function buscarHoteles(q: string): Promise<HotelSuggestion[]> {
  if (!q || q.trim().length < 2) return [];
  const params = new URLSearchParams({ q });
  const res = await fetch(`${BASE}/hoteles/buscar?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchHotelBySlug(slug: string) {
  const res = await fetch(`${BASE}/hotel/${slug}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Hotel no encontrado.');
  }
  return res.json();
}

export async function fetchDisponibilidad(hotelId: string, checkIn: string, checkOut: string) {
  const params = new URLSearchParams({ hotel_id: hotelId, checkIn, checkOut });
  const res = await fetch(`${BASE}/disponibilidad?${params}`);
  if (!res.ok) throw new Error('Error al cargar disponibilidad.');
  return res.json();
}

export async function buscarHuesped(correo: string, idHotel: string) {
  const res = await fetch(`${BASE}/buscar-huesped`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, id_hotel: idHotel }),
  });
  if (!res.ok) throw new Error('Error al buscar huésped.');
  return res.json();
}

export async function registrarHuesped(data: { nombre_completo: string; correo: string; telefono: string; id_hotel: string }) {
  const res = await fetch(`${BASE}/registrar-huesped`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al registrar huésped.');
  return body;
}

export async function fetchTarifaHabitacion(
  idHabitacion: string,
  fecha: string,
  checkIn?: string,
  checkOut?: string,
): Promise<{ tarifa_noche: number; total_tarifas?: number; es_periodo: boolean; nombre_periodo: string | null }> {
  const queryObj: Record<string, string> = { id_habitacion: idHabitacion };
  if (checkIn && checkOut) {
    queryObj.checkIn = checkIn;
    queryObj.checkOut = checkOut;
  } else {
    queryObj.fecha = fecha;
  }
  const params = new URLSearchParams(queryObj);
  const res = await fetch(`${BASE}/tarifa-habitacion?${params}`);
  if (!res.ok) throw new Error('Error al obtener tarifa');
  return res.json();
}

export async function crearSolicitudReserva(payload: Record<string, any>) {
  const res = await fetch(`${BASE}/solicitud-reserva`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear reserva.');
  return data;
}

export async function initGuestChat(nombre: string, correo: string | undefined, telefono: string | undefined, hotelId: string) {
  const res = await fetch(`${BASE}/chat/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hotel-id': hotelId },
    body: JSON.stringify({ nombre, correo, telefono }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al conectar con recepción.');
  return body as { channelId: string; guestId: string; messages: any[] };
}

export async function sendGuestMessage(channelId: string, guestId: string, nombre: string, content: string) {
  const res = await fetch(`${BASE}/chat/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, guestId, nombre, content }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al enviar mensaje.');
  return body;
}

export async function fetchGuestMessages(channelId: string, after?: string) {
  const params = after ? `?after=${encodeURIComponent(after)}` : '';
  const res = await fetch(`${BASE}/chat/messages/${channelId}${params}`);
  if (!res.ok) throw new Error('Error al obtener mensajes.');
  return res.json() as Promise<any[]>;
}
