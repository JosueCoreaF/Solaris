// ─── Business modules (multi-tenant) ────────────────────────────────────────
export interface BusinessModule {
  id: string;
  owner_id: string;
  tipo_modulo: string;
  id_module: string;
  nombre?: string;
  activo?: boolean;
  created_at?: string;
}

export interface UsuarioRol {
  id: string;
  owner_id: string;
  user_id: string;
  id_module: string;
  rol?: string;
}

// ─── Restaurant ─────────────────────────────────────────────────────────────
export interface Restaurant {
  id_restaurant: string;
  id_owner: string;
  id_module?: string;
  nombre_restaurante: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  pais?: string;
  activo: boolean;
  imagen_url?: string;
}

// ─── Categoría de platillo ───────────────────────────────────────────────────
export interface CategoriaPlatillo {
  id_categoria_platillo: string;
  nombre_categoria: string;
}

// ─── Platillo ────────────────────────────────────────────────────────────────
export interface Platillo {
  id_platillo: string;
  id_restaurant: string;
  id_categoria_platillo: string;
  nombre_platillo: string;
  descripcion: string;
  precio: number;
  activo: boolean;
  categoria_platillo?: CategoriaPlatillo;
}

// ─── Mesa ────────────────────────────────────────────────────────────────────
export type EstadoMesa = 'disponible' | 'ocupada' | 'reservada';

export interface Mesa {
  id_mesa: string;
  id_restaurant: string;
  numero_mesa: number;
  capacidad: number;
  estado: EstadoMesa;
}

// ─── Cliente ─────────────────────────────────────────────────────────────────
export interface ClienteRestaurante {
  id_cliente: string;
  id_restaurant: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  correo?: string;
}

// ─── Cargo (catálogo global) ─────────────────────────────────────────────────
export interface CargoRestaurant {
  id_cargo_restaurante: string;
  nombre_cargo: string;
}

// ─── Empleado ────────────────────────────────────────────────────────────────
export interface EmpleadoRestaurante {
  id_empleado_restaurante: string;
  id_restaurant: string;
  id_cargo_restaurante?: string;
  nombre_empleado: string;
  apellido: string;
  telefono?: string;
  correo?: string;
  salario?: number;
  fecha_contratacion?: string;
  cargo_restaurant?: CargoRestaurant;
}

// ─── Pedido ──────────────────────────────────────────────────────────────────
export type EstadoPedido = 'pendiente' | 'preparando' | 'servido' | 'cancelado';

export interface PedidoRestaurante {
  id_pedido: string;
  id_restaurant: string;
  id_cliente?: string;
  id_empleado_restaurante?: string;
  id_mesa?: string;
  estado_pedido: EstadoPedido;
  fecha_pedido: string;
  total?: number;
  cliente_restaurante?: ClienteRestaurante;
  empleado_restaurante?: EmpleadoRestaurante;
  mesa_restaurante?: Mesa;
  detalle_pedido_restaurante?: DetallePedido[];
}

// ─── Detalle de pedido ───────────────────────────────────────────────────────
export interface DetallePedido {
  id_detalle: string;
  id_pedido: string;
  id_platillo: string;
  cantidad: number;
  precio_unitario: number;
  platillo?: Platillo;
}

// ─── Factura ─────────────────────────────────────────────────────────────────
export interface FacturaRestaurante {
  id_factura: string;
  id_restaurant: string;
  fecha?: string;
  subtotal: number;
  isv: number;
  total: number;
  metodo_pago: string;
  detalle_factura?: DetalleFactura[];
}

export interface DetalleFactura {
  id_detalle_factura: string;
  id_factura: string;
  tipo_item: string;
  id_platillo?: string;
  id_producto?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  platillo?: { nombre_platillo: string };
  producto?: { nombre_producto: string };
}

// ─── Inventario ──────────────────────────────────────────────────────────────
export interface CategoriaInventario {
  id_categoria: string;
  categoria: string;
}

export interface ProductoInventario {
  id_producto: string;
  id_restaurant: string;
  id_categoria?: string;
  nombre_producto: string;
  precio: number;
  cantidad: number;
  fecha_vencimiento?: string;
  categoria?: CategoriaInventario;
}

export interface InventarioStock {
  id_inventario: string;
  id_producto: string;
  stock_actual: number;
  stock_minimo: number;
  fecha_actualizacion?: string;
  producto?: ProductoInventario;
}

export interface RecetaPlatillo {
  id_rec_platillo: string;
  id_platillo: string;
  id_inventario: string;
  cantidad_utilizada: number;
  inventario?: InventarioStock & { producto?: ProductoInventario };
}

// ─── Reserva ─────────────────────────────────────────────────────────────────
export interface ReservaMesa {
  id_reserva: string;
  id_restaurant: string;
  id_mesa?: string;
  id_cliente?: string;
  fecha_reserva: string;
  hora_reserva: string;
  cantidad_personas: number;
  estado: EstadoPedido;
  observaciones?: string;
  cliente_restaurante?: ClienteRestaurante;
  mesa_restaurante?: Mesa;
}

// ─── Proveedor ───────────────────────────────────────────────────────────────
export interface Proveedor {
  id_proveedor: string;
  id_restaurant: string;
  nombre_proveedor: string;
  contacto?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
}

export interface Compra {
  id_compra: string;
  id_restaurant: string;
  id_proveedor?: string;
  fecha_compra: string;
  subtotal: number;
  isv: number;
  total: number;
  estado_pago: 'pendiente' | 'abono' | 'pagado';
  cant_aboo?: number;
  proveedor?: Proveedor;
}

export interface DetalleCompra {
  id_detalle_compra: string;
  id_compra: string;
  id_producto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto?: ProductoInventario;
}

// ─── Menú ────────────────────────────────────────────────────────────────────
export interface Menu {
  id_menu: string;
  id_restaurant: string;
  nombre_menu: string;
  descripcion?: string;
  activo?: boolean;
  fecha_creacion?: string;
  platillos?: Platillo[];
}

// ─── Gastos ──────────────────────────────────────────────────────────────────
export interface CategoriaGastoRest {
  id_categoria: string;
  id_restaurante: string;
  nombre: string;
}

export interface PagoRest {
  id_pago: string;
  id_restaurante: string;
  id_categoria: string;
  fecha_pago: string;
  monto: number;
  estado: 'pendiente' | 'pagado' | 'cancelado';
  created_at?: string;
  categoria?: CategoriaGastoRest;
}

// ─── Dashboard stats ─────────────────────────────────────────────────────────
export interface DashboardStats {
  totalPlatillosActivos: number;
  pedidosHoy: number;
  mesasDisponibles: number;
  ingresosHoy: number;
  pedidosPendientes: number;
  reservasHoy: number;
}
