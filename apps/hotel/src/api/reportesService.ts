const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const apiFetch = async (endpoint: string, options?: RequestInit): Promise<any> => {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Hotel-ID': activeHotelId,
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
};

export interface ReportStats {
  ocupacionPromedio: number;
  totalReservas: number;
  totalIngresos: number;
  tasaOcupacion: number[];
  ingresoPorDia: { dia: string; ingreso: number }[];
  reservasPorEstado: { estado: string; cantidad: number }[];
}

export interface OcupacionData {
  promedio: number;
  dias: Array<{
    fecha: string;
    ocupacion: number;
    habitacionesOcupadas: number;
    habitacionesTotales: number;
  }>;
}

export interface IngresosData {
  total: number;
  totalUSD: number;
  tipoCambio: number;
  detalles: Array<{
    periodo: string;
    cantidad: number;
    reservas: number;
  }>;
}

export interface ReservasData {
  total: number;
  activas: number;
  pendientes: number;
  canceladas: number;
  detalles: Array<{
    estado: string;
    cantidad: number;
    porcentaje: number;
  }>;
}

export interface ClientesData {
  total: number;
  activos: number;
  recurrentes: number;
  nuevos: number;
  topClientes: Array<{
    nombre: string;
    reservas: number;
    gastado: number;
  }>;
}

// Obtener estadísticas generales
export const obtenerEstadisticas = async (periodo: string = 'mes'): Promise<ReportStats> => {
  const data = await apiFetch(`/reportes/estadisticas?periodo=${periodo}`);
  return data as ReportStats;
};

// Obtener datos de ocupación
export const obtenerOcupacion = async (startDate?: string, endDate?: string): Promise<OcupacionData> => {
  let url = '/reportes/ocupacion';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;
  
  const data = await apiFetch(url);
  return data as OcupacionData;
};

// Obtener datos de ingresos
export const obtenerIngresos = async (periodo: string = 'mes'): Promise<IngresosData> => {
  const data = await apiFetch(`/reportes/ingresos?periodo=${periodo}`);
  return data as IngresosData;
};

// Obtener análisis de reservas
export const obtenerReservas = async (periodo: string = 'mes'): Promise<ReservasData> => {
  const data = await apiFetch(`/reportes/reservas?periodo=${periodo}`);
  return data as ReservasData;
};

// Obtener análisis de clientes
export const obtenerClientes = async (startDate?: string, endDate?: string): Promise<ClientesData> => {
  let url = '/reportes/clientes';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;
  
  const data = await apiFetch(url);
  return data as ClientesData;
};
