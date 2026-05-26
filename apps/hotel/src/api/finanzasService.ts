const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const apiFetch = async (endpoint: string, options?: RequestInit): Promise<any> => {
  const activeHotelId = localStorage.getItem('active_hotel_id') || '2816eaed-e555-44b1-a7dc-f5772e4784de';
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

export interface FinanzaResumen {
  ingresoTotal: number;
  egresosTotal: number;
  saldo: number;
  tipoCambio: number;
  ingresoUSD: number;
  egresosUSD: number;
  saldoUSD: number;
}

export interface Movimiento {
  id: number;
  tipo: 'ingreso' | 'egreso';
  concepto: string;
  monto: number;
  fecha: string;
  referencia: string;
}

export interface IngresosPeriodo {
  total: number;
  totalUSD: number;
  detalles: Array<{
    periodo: string;
    cantidad: number;
    reservas: number;
    promedioPorReserva: number;
  }>;
}

export interface EgresosPeriodo {
  total: number;
  totalUSD: number;
  detalles: Array<{
    categoria: string;
    cantidad: number;
    porcentaje: number;
    transacciones: number;
  }>;
}

export interface TipoCambio {
  HNL_USD: number;
  USD_HNL: number;
  actualizadoEn: string;
  fuente: string;
}

export interface Tendencias {
  ultimosDias: number;
  ingresoPromedioDia: number;
  egresoPromedioDia: number;
  margenPromedio: number;
  tendencia: 'alcista' | 'bajista' | 'estable';
  detalles: Array<{
    fecha: string;
    ingresos: number;
    egresos: number;
    saldo: number;
  }>;
}

// Obtener resumen financiero general
export const obtenerResumen = async (periodo: string = 'mes'): Promise<FinanzaResumen> => {
  const data = await apiFetch(`/finanzas/resumen?periodo=${periodo}`);
  return data as FinanzaResumen;
};

// Obtener movimientos financieros
export const obtenerMovimientos = async (
  startDate?: string,
  endDate?: string,
  tipo?: 'ingreso' | 'egreso'
): Promise<Movimiento[]> => {
  let url = '/finanzas/movimientos';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (tipo) params.append('tipo', tipo);
  if (params.toString()) url += `?${params.toString()}`;
  
  const data = await apiFetch(url);
  return data as Movimiento[];
};

// Obtener detalles de ingresos por período
export const obtenerIngresos = async (
  agruparPor: string = 'dia',
  startDate?: string,
  endDate?: string
): Promise<IngresosPeriodo> => {
  let url = `/finanzas/ingresos?agruparPor=${agruparPor}`;
  if (startDate) url += `&startDate=${startDate}`;
  if (endDate) url += `&endDate=${endDate}`;
  
  const data = await apiFetch(url);
  return data as IngresosPeriodo;
};

// Obtener detalles de egresos por categoría
export const obtenerEgresos = async (startDate?: string, endDate?: string): Promise<EgresosPeriodo> => {
  let url = '/finanzas/egresos';
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (params.toString()) url += `?${params.toString()}`;
  
  const data = await apiFetch(url);
  return data as EgresosPeriodo;
};

// Obtener tendencias financieras
export const obtenerTendencias = async (dias: number = 30): Promise<Tendencias> => {
  const data = await apiFetch(`/finanzas/tendencias?dias=${dias}`);
  return data as Tendencias;
};

// Obtener tipo de cambio actual
export const obtenerTipoCambio = async (): Promise<TipoCambio> => {
  const data = await apiFetch('/finanzas/tipo-cambio');
  return data as TipoCambio;
};

// Utilidad para convertir moneda
export const convertirMoneda = (monto: number, tipoCambio: number, de: 'HNL' | 'USD', a: 'HNL' | 'USD'): number => {
  if (de === a) return monto;
  if (de === 'HNL' && a === 'USD') return monto / tipoCambio;
  if (de === 'USD' && a === 'HNL') return monto * tipoCambio;
  return monto;
};

// Obtener lista de facturas registradas
export const obtenerFacturas = async (periodo: string = 'mes'): Promise<any[]> => {
  return await apiFetch(`/finanzas/facturas?periodo=${periodo}`);
};

// Guardar una nueva factura (con soporte opcional de desglose)
export const guardarFactura = async (factura: any): Promise<any> => {
  return await apiFetch('/finanzas/facturas', {
    method: 'POST',
    body: JSON.stringify(factura),
  });
};

// Actualizar una factura existente
export const actualizarFactura = async (id: string, factura: any): Promise<any> => {
  return await apiFetch(`/finanzas/facturas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(factura),
  });
};

// Eliminar una factura
export const eliminarFactura = async (id: string): Promise<any> => {
  return await apiFetch(`/finanzas/facturas/${id}`, {
    method: 'DELETE',
  });
};
