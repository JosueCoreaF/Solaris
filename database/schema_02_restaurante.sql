-- =============================================================================
-- SOLARIS — MÓDULO RESTAURANTE (ejecutar después de schema_00_base.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.restaurante (
  id_restaurante        bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_module             uuid        NOT NULL REFERENCES public.business_modules(id_module) ON DELETE CASCADE,
  nombre_restaurante    text        NOT NULL,
  ciudad                text        NOT NULL,
  direccion_restaurante text        NOT NULL,
  correo_restaurante    varchar     NOT NULL,
  telefono_restaurante  varchar     NOT NULL,
  estado                varchar     NOT NULL DEFAULT 'activo'
                          CHECK (estado IN ('activo','inactivo','mantenimiento')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT restaurante_pkey PRIMARY KEY (id_restaurante)
);

CREATE TABLE IF NOT EXISTS public.inventario_costos (
  id_prod        bigint      GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante bigint      NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  nombre_producto text        NOT NULL,
  cantidad        integer     NOT NULL,
  precio          numeric     NOT NULL,
  categoria       text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventario_costos_pkey PRIMARY KEY (id_prod)
);

CREATE TABLE IF NOT EXISTS public.categorias_gasto_rest (
  id_categoria   bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante bigint  NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  nombre         varchar NOT NULL,
  CONSTRAINT categorias_gasto_rest_pkey PRIMARY KEY (id_categoria)
);

CREATE TABLE IF NOT EXISTS public.pagos_rest (
  id_pago        bigint  GENERATED ALWAYS AS IDENTITY NOT NULL,
  id_restaurante bigint  NOT NULL REFERENCES public.restaurante(id_restaurante) ON DELETE CASCADE,
  id_categoria   bigint  NOT NULL REFERENCES public.categorias_gasto_rest(id_categoria),
  fecha_pago     date    NOT NULL DEFAULT CURRENT_DATE,
  monto          numeric NOT NULL,
  estado         text    NOT NULL DEFAULT 'Por pagar' CHECK (estado IN ('Por pagar','Pagado')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pagos_rest_pkey PRIMARY KEY (id_pago)
);

CREATE INDEX IF NOT EXISTS idx_rest_module   ON public.restaurante (id_module);
CREATE INDEX IF NOT EXISTS idx_invcost_rest  ON public.inventario_costos (id_restaurante);
CREATE INDEX IF NOT EXISTS idx_pagrest_rest  ON public.pagos_rest (id_restaurante);

-- Función RLS (después de la tabla)
CREATE OR REPLACE FUNCTION public.tiene_acceso_restaurante(p_id_restaurante bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurante r
    JOIN public.business_modules bm ON bm.id_module = r.id_module
    WHERE r.id_restaurante = p_id_restaurante AND (
      bm.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.usuarios_roles ur WHERE ur.user_id = auth.uid() AND ur.owner_id = bm.owner_id AND ur.id_module = r.id_module AND ur.estado = 'activo')
    )
  );
$$;
GRANT EXECUTE ON FUNCTION public.tiene_acceso_restaurante(bigint) TO authenticated;

ALTER TABLE public.restaurante           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_costos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_gasto_rest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_rest            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rest_all"    ON public.restaurante           FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
CREATE POLICY "invcost_all" ON public.inventario_costos     FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
CREATE POLICY "catrest_all" ON public.categorias_gasto_rest FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));
CREATE POLICY "pagrest_all" ON public.pagos_rest            FOR ALL USING (public.tiene_acceso_restaurante(id_restaurante));

-- Creacion de Tabla producto
--La tabla producto se encarga de almacenar los productos que ingresen para
--el restaurante, guardando el id del producto, tambien, su nombre,precio,cantida y muy importante
--la fecha del vencimiento del producto, relacionandola con la tabla restaurante y categoria_producto.


CREATE TABLE producto (
    id_producto BIGSERIAL PRIMARY KEY,

    id_restaurant BIGINT NOT NULL,
    id_categoria BIGINT NOT NULL,

    nombre_producto VARCHAR(100) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    cantidad INT NOT NULL,
    fecha_vencimiento DATE DEFAULT CURRENT_DATE,

    CONSTRAINT fk_producto_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE,

    CONSTRAINT fk_producto_categoria
        FOREIGN KEY (id_categoria)
        REFERENCES categoria(id_categoria)
        ON DELETE RESTRICT
);


-- Creación de tabla categoria
-- La tabla categoria se utiliza para la normalización de datos,
-- Esta tabla evita la duplicación de categorías y se relaciona con la tabla producto.

CREATE TABLE categoria (
    id_categoria BIGSERIAL PRIMARY KEY,
    categoria VARCHAR(100) NOT NULL UNIQUE
);

---Tabla Platillo
--Creacion de tabla platillo donde se guarda la informacion del platillo
--como su nombre, la descripcion del platillo, su precio, y cual es el estado del platillo, se relaciono con la tabla restaurante y categoria platillo.

CREATE TABLE platillo (
    id_platillo BIGSERIAL PRIMARY KEY,

    id_restaurant BIGINT NOT NULL,
    id_categoria_platillo BIGINT NOT NULL,

    nombre_platillo VARCHAR(150) NOT NULL,
    descripcion VARCHAR (250) NOT NULL,
    precio DECIMAL(10,2) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_platillo_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE,

    CONSTRAINT fk_platillo_categoria_platillo
        FOREIGN KEY (id_categoria_platillo)
        REFERENCES categoria_platillo(id_categoria_platillo)
        ON DELETE RESTRICT
);

---Factura Restaurante
--Creación de la tabla de factura, donde se almacena toda la información de la facturación del restaurante,
-- donde almacenamos información como el tipo de pago, el ISV, etc. Esta tabla se relaciona con la tabla restaurante.

CREATE TABLE factura_restaurante (

    id_factura BIGSERIAL PRIMARY KEY,
    id_restaurant BIGINT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Subtotal DECIMAL(10,2) NOT NULL,
    isv DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,

    CONSTRAINT fk_factura_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE
);

--Tabla Cliente_restaurante
--creación de la tabla de clientes de restaurante, donde se almacena la información diaria
--de los clientes que visitan el restaurante, esta tabla esta relacionada con restaurante.

CREATE TABLE cliente_restaurante(

    id_cliente BIGSERIAL PRIMARY KEY NOT NULL,
    id_restaurant BIGINT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(50) NOT NULL,
    correo VARCHAR(150) UNIQUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,


    CONSTRAINT fk_cliente_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE
);

--Creacion de tabla Cargo y tabla empleado.

-- La tabla cargo_restaurant se utiliza para la normalización de datos,
-- almacenando los diferentes cargos o puestos dentro del restaurante.

CREATE TABLE cargo_restaurant (

    id_cargo_restaurante BIGSERIAL PRIMARY KEY,
    nombre_cargo VARCHAR(100) NOT NULL UNIQUE

);
--La tabla empleado_restauranre almacena la información de los empleados del restaurante,
-- Almacenando datos personales como el salario, fecha de contratación y su cargo.
-- Se relaciona con las tablas restaurant y cargo_restaurant.

CREATE TABLE empleado_restaurante (

    id_empleado_restaurante BIGSERIAL PRIMARY KEY,
    id_restaurant BIGINT NOT NULL,
    id_cargo_restaurante BIGINT NOT NULL,
    nombre_empleado VARCHAR(150) NOT NULL,
    apellido VARCHAR(150) NOT NULL,
    telefono VARCHAR(25) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    salario DECIMAL(10,2),
    fecha_contratacion DATE DEFAULT CURRENT_DATE,

    
    CONSTRAINT fk_empleado_restaurante_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE,

    CONSTRAINT fk_empleado_restaurante_cargoriaestaurant
        FOREIGN KEY (id_cargo_restaurante)
        REFERENCES cargo_restaurant(id_cargo_restaurante)
        ON DELETE RESTRICT

);

--Creacion de mesa_restaurante.
--La tabla mesa_restaurante es la que almacena la informacion de cada mesa que hay en el
--restaurante, por ejemplo viendo la candidad de mesas disponibles y la capasidad de cada mesa y
--si se encuentra disponible. Va relacionada con la tabla restaurante.

CREATE TABLE mesa_restaurante(

  id_mesa BIGSERIAL PRIMARY KEY NOT NULL,
  id_restaurant BIGINT NOT NULL,
  numero_mesa INT NOT NULL,
    capacidad INT NOT NULL,
    estado VARCHAR(50) DEFAULT 'disponible'
        CHECK (estado IN ('disponible','ocupada','reservada')),

    CONSTRAINT fk_mesa_restaurante_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE

);

--Creacion de tabla pedido_restaurante
-- Esta tabla guarda los pedidos que se hacen en el restaurante.
-- Incluye el cliente, el empleado que lo atiende, la mesa y el estado del pedido.

CREATE TABLE pedido_restaurante(

    id_pedido BIGSERIAL PRIMARY KEY NOT NULL,
    id_restaurant BIGINT NOT NULL,
    id_cliente BIGINT NOT NULL,
    id_empleado_restaurante BIGINT NOT NULL,
    id_mesa BIGINT NOT NULL,
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_pedido VARCHAR(20) DEFAULT 'pendiente'
        CHECK (estado_pedido IN ('pendiente','preparando','servido','cancelado')),

    CONSTRAINT fk_pedido_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE,

    CONSTRAINT fk_pedido_cliente_restaurante
        FOREIGN KEY (id_cliente)
        REFERENCES cliente_restaurante(id_cliente)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pedido_empleado_restaurante
        FOREIGN KEY (id_empleado_restaurante)
        REFERENCES empleado_restaurante(id_empleado_restaurante)
        ON DELETE RESTRICT,

    CONSTRAINT fk_pedido_mesa_restaurante
        FOREIGN KEY (id_mesa)
        REFERENCES mesa_restaurante(id_mesa)
        ON DELETE RESTRICT

);

--Creacion de detalle_pedido_restaurante
-- Esta tabla guarda los platillos que tiene cada pedido, 
-- y tambien indica la cantidad, precio unitario y subtotal.Esta tabla se relaciona con 
--Pedido_restaurante, platillo.

CREATE TABLE detalle_pedido_restaurante (

    id_detalle_pedido BIGSERIAL PRIMARY KEY,
    id_pedido BIGINT NOT NULL,
    id_platillo BIGINT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_detallepedido_pedido_restaurante
        FOREIGN KEY (id_pedido)
        REFERENCES pedido_restaurante(id_pedido)
        ON DELETE CASCADE,

    CONSTRAINT fk_detallepedido_platillo
        FOREIGN KEY (id_platillo)
        REFERENCES platillo(id_platillo)
        ON DELETE RESTRICT

);

--Tabla principal de restaurante
--la funcionalidad de esta tabla es cuando el usuario seleccione el modelo de negocio de restaurante
--Podra registrar su restaurante, esta tabla esta relacionada con las tablas de owner y business model
--Lo cual identenfica a que usuario y modelo de negocio corresponde este restaurante
CREATE TABLE restaurant (
    id_restaurant BIGSERIAL PRIMARY KEY,



    id_owner UUID NOT NULL,
    id_module UUID NOT NULL,

    nombre_restaurante VARCHAR(150) NOT NULL,
    direccion TEXT,
    telefono VARCHAR(20),
    correo VARCHAR(150),
    ciudad VARCHAR(100),
    pais VARCHAR(100),

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT fk_restaurant_owner
        FOREIGN KEY (id_owner)
        REFERENCES owners(id_owner)
        ON DELETE CASCADE,

    CONSTRAINT fk_restaurant_module
        FOREIGN KEY (id_module)
        REFERENCES business_modules(id_module)
        ON DELETE RESTRICT
);

--Tabla inventario
--La funcionalidad de la tabla inventario es para tener un mejor control de todos los stock de cada uno de los productos
--Esta relaciada unicamente con la tabla prodcutos.

CREATE TABLE inventario (
    id_inventario BIGSERIAL PRIMARY KEY,

    id_producto BIGINT NOT NULL UNIQUE,

    stock_actual DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0,

    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_inventario_producto
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto)
        ON DELETE CASCADE
);
--Tabla receta platillo
--La funcionalidad de la tabla es para saber que productos y cantidades requiere cada una de los platillos y tambien ayudara 
--esta relacionada con la tabla platillo e inventarios, esto ayudara al dueño a tener una eficiencia de consumo de los inventarios.

CREATE TABLE receta_platillo (
    id_rec_platillo BIGSERIAL PRIMARY KEY,

    id_platillo BIGINT NOT NULL,
    id_inventario BIGINT NOT NULL,

    cantidad_utilizada DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_rec_platillo
        FOREIGN KEY (id_platillo)
        REFERENCES platillo(id_platillo)
        ON DELETE CASCADE,

    CONSTRAINT fk_rec_inventario
        FOREIGN KEY (id_inventario)
        REFERENCES inventario(id_inventario)
        ON DELETE RESTRICT
);

--Tabla cateforia platillo
--Funcionalidad principal tener una mejor estructura de las categorias que tiene asignada cada platillo
--cuando se haga una actualizacion en las categorias sera mas eficiente los cambio y evitamos marge de error 
CREATE TABLE categoria_platillo (
    id_categoria_platillo BIGSERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
);
--Tabla reserva
--Esta realiza una funcion muy eficiente, el usuario tendra el registro o podra visualizar
--todas las reservas que tiene el restaurante
CREATE TABLE reserva (
    id_reserva BIGSERIAL PRIMARY KEY,

    id_restaurant BIGINT NOT NULL,
    id_cliente BIGINT NOT NULL,
    id_mesa BIGINT NOT NULL,

    fecha_reserva DATE NOT NULL,
    hora_reserva TIME NOT NULL,
    cantidad_personas INT NOT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN('pendiente','preparando','servido','cancelado')),

    observaciones VARCHAR(250),

    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT  fk_reserva_mesa
    FOREIGN KEY (id_mesa)
    REFERENCES mesa_restaurante(id_mesa),

    CONSTRAINT fk_reserva_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant),

    CONSTRAINT fk_reserva_cliente
        FOREIGN KEY (id_cliente)
        REFERENCES cliente_restaurante(id_cliente)
);

--Tabla menu

--En esta tabla se mostrara el resumen de todos los  platillos activos hasta de la fecha que fue creado.
CREATE TABLE menu (
    id_menu BIGSERIAL PRIMARY KEY,

    id_restaurant BIGINT NOT NULL,

    nombre_menu VARCHAR(100) NOT NULL,
    descripcion VARCHAR(250),

    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_menu_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
        ON DELETE CASCADE
);

--Tabla menu de platillo
--Esta tabla guarda el historico de los platillo aun si se dejan de vender
CREATE TABLE menu_platillo (
    id_menu BIGINT NOT NULL,
    id_platillo BIGINT NOT NULL,

    PRIMARY KEY (id_menu, id_platillo),

    CONSTRAINT fk_mp_menu
        FOREIGN KEY (id_menu)
        REFERENCES menu(id_menu)
        ON DELETE CASCADE,

    CONSTRAINT fk_mp_platillo
        FOREIGN KEY (id_platillo)
        REFERENCES platillo(id_platillo)
        ON DELETE CASCADE
);
--Tabla detalle factura
--Principal funcionalidad es mostrar el detalle de la fatura que queda en nuestros registros.
--para un mejor control y registro de las faturas y serian datos mas especificos.
--esta relaciona con tabla producto porque es donde entra la venta de las bebidas, que estaria guardada en la tabla producto

CREATE TABLE detalle_factura (
    id_detalle_factura BIGSERIAL PRIMARY KEY,

    id_factura BIGINT NOT NULL,

    tipo_item VARCHAR(20) NOT NULL,
    -- 'PLATILLO' o 'PRODUCTO'

    id_platillo BIGINT,
    id_producto BIGINT,

    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,

    CONSTRAINT fk_detalle_factura
        FOREIGN KEY (id_factura)
        REFERENCES factura_restaurante(id_factura)
        ON DELETE CASCADE,

    CONSTRAINT fk_detalle_platillo
        FOREIGN KEY (id_platillo)
        REFERENCES platillo(id_platillo),

    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto)
);

--Tabla proveedor
--Un mejor manejo de los proveedores, unicamente esta relacionada con la tabla restaurante, para identificar a que restaurante
--provee producto
CREATE TABLE proveedor (
    id_proveedor BIGSERIAL PRIMARY KEY,

    id_restaurant BIGINT NOT NULL,

    nombre_proveedor VARCHAR(150) NOT NULL,
    nombre_contacto VARCHAR(150),
    telefono VARCHAR(20),
    correo VARCHAR(150),
    direccion VARCHAR(250),

    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_proveedor_restaurant
        FOREIGN KEY (id_restaurant)
        REFERENCES restaurant(id_restaurant)
);