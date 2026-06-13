-- Migration: Add snapshot column to public.cierres_diarios
-- Description: Adds a jsonb column to store daily closure metrics and snapshots.

ALTER TABLE public.cierres_diarios ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
