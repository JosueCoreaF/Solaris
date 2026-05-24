-- Habilitar RLS y proteger la tabla de hoteles por owner/rol.
ALTER TABLE public.hoteles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo hoteles del owner asignado" ON public.hoteles
  FOR SELECT
  USING (
    owner_id IN (
      SELECT owner_id
      FROM public.usuarios_roles
      WHERE usuario_id = auth.uid()
        AND estado = 'activo'
    )
  );

-- Opcional: si quieres también restringir inserts/updates en hoteles
-- CREATE POLICY "Propietarios pueden insertar hoteles en su empresa" ON public.hoteles
--   FOR INSERT
--   WITH CHECK (
--     owner_id IN (
--       SELECT owner_id
--       FROM public.usuarios_roles
--       WHERE usuario_id = auth.uid()
--         AND estado = 'activo'
--     )
--   );

-- CREATE POLICY "Propietarios pueden actualizar hoteles de su empresa" ON public.hoteles
--   FOR UPDATE
--   USING (
--     owner_id IN (
--       SELECT owner_id
--       FROM public.usuarios_roles
--       WHERE usuario_id = auth.uid()
--         AND estado = 'activo'
--     )
--   );
