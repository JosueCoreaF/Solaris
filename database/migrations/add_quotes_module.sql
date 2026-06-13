-- Migration: Add Quotes (Cotizaciones) Module
-- Create cotizaciones and cotizacion_items tables with RLS and Indexes

CREATE TABLE IF NOT EXISTS public.cotizaciones (
  id_cotizacion          uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_hotel               uuid        NOT NULL REFERENCES public.hoteles(id_hotel) ON DELETE CASCADE,
  numero_cotizacion      varchar     NOT NULL, -- Correlativo ej. COT-2026-0045
  id_huesped             uuid        REFERENCES public.huespedes(id_huesped) ON DELETE SET NULL,
  id_empresa             uuid        REFERENCES public.empresas(id_empresa) ON DELETE SET NULL,
  cliente_nombre         varchar     NOT NULL,
  cliente_identificacion varchar,              -- RTN o DNI
  cliente_correo         varchar     NOT NULL,
  cliente_telefono       varchar,
  fecha_emision          date        NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento      date        NOT NULL,
  check_in               date        NOT NULL,
  check_out              date        NOT NULL,
  cant_noches            integer     NOT NULL,
  adultos                integer     NOT NULL DEFAULT 1 CHECK (adultos > 0),
  ninos                  integer     NOT NULL DEFAULT 0 CHECK (ninos >= 0),
  estado                 varchar     NOT NULL DEFAULT 'Borrador'
                           CHECK (estado IN ('Borrador', 'Enviada', 'Aceptada', 'Rechazada', 'Expirada')),
  subtotal               numeric     NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  impuesto_isv           numeric     NOT NULL DEFAULT 0.00 CHECK (impuesto_isv >= 0), -- 15% ISV
  impuesto_turismo       numeric     NOT NULL DEFAULT 0.00 CHECK (impuesto_turismo >= 0), -- 4% Turístico
  total                  numeric     NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  moneda                 varchar     NOT NULL DEFAULT 'HNL',
  tipo_cambio            numeric     NOT NULL DEFAULT 26.58,
  clausula_no_fiscalidad text,
  politicas_cancelacion  text,
  vigencia_texto         varchar,
  cuentas_bancarias      text,
  notas                  text,
  owner_id               uuid        NOT NULL REFERENCES public.owners(id_owner) ON DELETE CASCADE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizaciones_pkey PRIMARY KEY (id_cotizacion),
  CONSTRAINT cotizaciones_fechas_check CHECK (check_out > check_in)
);

-- Índice único para el correlativo por hotel
CREATE UNIQUE INDEX IF NOT EXISTS idx_cotizaciones_num_hotel 
  ON public.cotizaciones(id_hotel, numero_cotizacion);

-- ── ITEMS DE LA COTIZACIÓN ──
CREATE TABLE IF NOT EXISTS public.cotizacion_items (
  id_item            uuid        NOT NULL DEFAULT gen_random_uuid(),
  id_cotizacion      uuid        NOT NULL REFERENCES public.cotizaciones(id_cotizacion) ON DELETE CASCADE,
  tipo_item          varchar     NOT NULL CHECK (tipo_item IN ('habitacion', 'servicio')),
  descripcion        varchar     NOT NULL, -- Ej: "Habitación Sencilla (Adultos: 1)" o "Desayuno Buffet"
  id_tipo_habitacion uuid        REFERENCES public.tipos_habitacion(id_tipo_habitacion) ON DELETE SET NULL,
  id_servicio        uuid        REFERENCES public.servicios_adicionales(id_servicio) ON DELETE SET NULL,
  cantidad           integer     NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario    numeric     NOT NULL DEFAULT 0.00 CHECK (precio_unitario >= 0),
  subtotal           numeric     NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  detalles_huespedes jsonb,                -- Opcional: { adultos, ninos } para habitaciones
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizacion_items_pkey PRIMARY KEY (id_item)
);

-- RLS
ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_items ENABLE ROW LEVEL SECURITY;

-- Evitamos duplicidad al crear políticas
DROP POLICY IF EXISTS cotizaciones_all ON public.cotizaciones;
CREATE POLICY "cotizaciones_all" ON public.cotizaciones FOR ALL 
  USING (public.tiene_acceso_hotel(id_hotel));

DROP POLICY IF EXISTS cotizacion_items_all ON public.cotizacion_items;
CREATE POLICY "cotizacion_items_all" ON public.cotizacion_items FOR ALL 
  USING (EXISTS (
    SELECT 1 FROM public.cotizaciones c 
    WHERE c.id_cotizacion = cotizacion_items.id_cotizacion AND public.tiene_acceso_hotel(c.id_hotel)
  ));
