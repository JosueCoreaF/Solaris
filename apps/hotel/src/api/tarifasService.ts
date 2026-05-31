const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 
      'Content-Type': 'application/json', 
      'X-Hotel-ID': activeHotelId,
      ...options.headers 
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface Categoria {
  id_categoria: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
}

export interface Tarifa {
  id_tarifa: string;
  id_tipo_habitacion: string;
  id_categoria: string;
  tarifa_noche: number;
  tarifa_hora: number;
  tarifa_pasadia: number;
  vigente_desde: string;
  vigente_hasta?: string;
  activa: boolean;
  tipo_habitacion?: string;
  categoria?: string;
}

// ─── API Calls ───────────────────────────────────────────────────────────────────

export async function obtenerCategorias(): Promise<Categoria[]> {
  return apiFetch<Categoria[]>('/tarifas/categorias');
}

export async function obtenerTariffas(
  id_tipo?: string,
  id_categoria?: string,
  vigentes_solo: boolean = true
): Promise<Tarifa[]> {
  const params = new URLSearchParams();
  if (id_tipo) params.set('id_tipo_habitacion', id_tipo);
  if (id_categoria) params.set('id_categoria', id_categoria);
  if (vigentes_solo) params.set('vigentes_solo', 'true');
  return apiFetch<Tarifa[]>(`/tarifas?${params.toString()}`);
}

export async function obtenerTarifasVigentes(): Promise<Tarifa[]> {
  return apiFetch<Tarifa[]>('/tarifas/vigentes');
}

export async function crearTarifa(data: {
  id_tipo_habitacion: string;
  id_categoria: string;
  tarifa_noche: number;
  tarifa_hora?: number;
  tarifa_pasadia?: number;
  vigente_desde?: string;
  vigente_hasta?: string;
}): Promise<Tarifa> {
  return apiFetch<Tarifa>('/tarifas', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function actualizarTarifa(
  id: string,
  data: {
    tarifa_noche?: number;
    tarifa_hora?: number;
    tarifa_pasadia?: number;
    vigente_desde?: string;
    vigente_hasta?: string;
    activa?: boolean;
  }
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tarifas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function eliminarTarifa(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/tarifas/${id}`, {
    method: 'DELETE',
  });
}

export async function crearCategoria(data: {
  nombre: string;
  descripcion?: string;
  activa?: boolean;
}): Promise<Categoria> {
  return apiFetch<Categoria>('/tarifas/categorias', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function actualizarCategoria(
  id: string,
  data: {
    nombre?: string;
    descripcion?: string;
    activa?: boolean;
  }
): Promise<Categoria> {
  return apiFetch<Categoria>(`/tarifas/categorias/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function eliminarCategoria(id: string): Promise<{ success: boolean; message?: string }> {
  return apiFetch<{ success: boolean; message?: string }>(`/tarifas/categorias/${id}`, {
    method: 'DELETE',
  });
}
