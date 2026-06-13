-- Permite cancelación al final del período (pattern Stripe): el plan sigue
-- activo hasta current_period_end, pero queda marcado para no renovarse.
ALTER TABLE public.suscripciones_owner
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
