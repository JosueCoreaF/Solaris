-- Centro de notificaciones in-app: nuevas reservas web, cotizaciones aceptadas, etc.
create table if not exists public.notificaciones (
  id_notificacion uuid primary key default gen_random_uuid(),
  id_hotel        uuid not null references public.hoteles(id_hotel) on delete cascade,
  tipo            varchar(40) not null,
  titulo          varchar(160) not null,
  mensaje         text,
  link            text,
  leida           boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists idx_notificaciones_hotel_created on public.notificaciones(id_hotel, created_at desc);
create index if not exists idx_notificaciones_hotel_unread on public.notificaciones(id_hotel, leida) where leida = false;
