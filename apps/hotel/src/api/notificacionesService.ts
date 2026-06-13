import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export interface Notificacion {
  id_notificacion: string;
  id_hotel: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  link: string | null;
  leida: boolean;
  created_at: string;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const token = (await supabase.auth.getSession()).data.session?.access_token || '';

  const res = await fetch(`${API_BASE}/hotel/notificaciones${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Hotel-ID': activeHotelId,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

export async function fetchNotificaciones(): Promise<Notificacion[]> {
  return apiFetch<Notificacion[]>('');
}

export async function fetchUnreadCount(): Promise<number> {
  const { count } = await apiFetch<{ count: number }>('/unread-count');
  return count;
}

export async function marcarNotificacionLeida(id: string): Promise<void> {
  await apiFetch<void>(`/${id}/leer`, { method: 'PATCH' });
}

export async function marcarTodasLeidas(): Promise<void> {
  await apiFetch<void>('/leer-todas', { method: 'POST' });
}
