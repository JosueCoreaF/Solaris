-- Migration: Update Quotes for Taxes and Item-level Dates/Occupancy
-- Path: database/migrations/update_quotes_tax_and_dates.sql

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS impuestos_incluidos boolean NOT NULL DEFAULT false;

ALTER TABLE public.cotizacion_items
  ADD COLUMN IF NOT EXISTS check_in date,
  ADD COLUMN IF NOT EXISTS check_out date,
  ADD COLUMN IF NOT EXISTS noches integer,
  ADD COLUMN IF NOT EXISTS adultos integer NOT NULL DEFAULT 1 CHECK (adultos >= 0),
  ADD COLUMN IF NOT EXISTS ninos integer NOT NULL DEFAULT 0 CHECK (ninos >= 0);
