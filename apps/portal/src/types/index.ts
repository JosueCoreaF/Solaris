export interface Hotel {
  id: string;
  nombre: string;
  slug: string;
  ciudad: string;
  direccion: string;
  telefono: string | null;
  correo: string | null;
  estrellas: number;
  mapsUrl: string | null;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorSecundario?: string | null;
  redesSociales?: Record<string, string> | null;
  moneda: string;
  tipoCambio: number;
  tasaIsv: number;
  tasaTuristica: number;
  horaCheckin: string;
  horaCheckout: string;
  cargoPersonaExtra: number; // cargo por noche por persona adicional sobre la capacidad
  serviciosAdicionales?: ServicioAdicional[];
}

export interface ServicioAdicional {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
}

export interface Habitacion {
  id: string;
  id_hotel: string;
  nombre: string;
  nombreAlias: string | null;
  tipo: string;
  tarifaNoche: number;
  esTarifaPeriodo?: boolean;   // true cuando aplica tarifa especial por período
  nombrePeriodo?: string | null;
  totalTarifas?: number;       // total acumulado por rango de fechas
  numeroCamas: number;
  capacidad: number;
  imagenes: string[];
  imagen_360: string | null;
  comodidades: string[];
  disponible: boolean;
}

export interface ReservaForm {
  nombre: string;
  correo: string;
  telefono: string;
  dni: string;
  checkIn: string;
  checkOut: string;
  adultos: number;
  ninos: number;
  observaciones: string;
  camaExtra: boolean;
  limpiezaDiaria: boolean;
  neverita: boolean;
  plancha: boolean;
  serviciosPersonalizados: string[];
}
