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


