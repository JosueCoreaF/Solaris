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
  moneda: string;
  tipoCambio: number;
  tasaIsv: number;
  tasaTuristica: number;
  horaCheckin: string;
  horaCheckout: string;
  cargoPersonaExtra: number; // cargo por noche por persona adicional sobre la capacidad
}

export interface Habitacion {
  id: string;
  id_hotel: string;
  nombre: string;
  nombreAlias: string | null;
  tipo: string;
  tarifaNoche: number;
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
}
