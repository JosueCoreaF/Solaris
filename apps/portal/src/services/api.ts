const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/public';

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
