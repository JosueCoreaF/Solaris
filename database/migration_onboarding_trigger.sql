-- =============================================================================
-- TRIGGER DE ONBOARDING AUTOMÁTICO
-- Al crear un usuario en auth.users genera owner + rol PROPIETARIO
-- =============================================================================

-- Política INSERT en owners (faltaba)
DROP POLICY IF EXISTS "owners_insert" ON public.owners;
CREATE POLICY "owners_insert" ON public.owners FOR INSERT
  WITH CHECK (true);

-- Política INSERT en usuarios_roles para el propio usuario
DROP POLICY IF EXISTS "uroles_insert_self" ON public.usuarios_roles;
CREATE POLICY "uroles_insert_self" ON public.usuarios_roles FOR INSERT
  WITH CHECK (usuario_id = auth.uid() OR public.my_rol() IN ('PROPIETARIO','ADMIN'));

-- Función principal
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id  uuid;
  v_nombre    varchar;
  v_email     varchar;
BEGIN
  -- Email seguro (fallback si viene vacío)
  v_email := COALESCE(NULLIF(TRIM(NEW.email), ''), NEW.id::text || '@sin-email.local');

  -- Nombre de empresa desde metadata o prefijo del email
  v_nombre := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre_empresa'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'),      ''),
    split_part(v_email, '@', 1)
  );

  -- Crear owner
  INSERT INTO public.owners (id_owner, nombre_empresa, email_contacto, estado)
  VALUES (gen_random_uuid(), v_nombre, v_email, 'activo')
  RETURNING id_owner INTO v_owner_id;

  -- Asignar PROPIETARIO
  INSERT INTO public.usuarios_roles (owner_id, usuario_id, rol, estado)
  VALUES (v_owner_id, NEW.id, 'PROPIETARIO', 'activo');

  RETURN NEW;
END;
$$;

-- Registrar trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();

GRANT EXECUTE ON FUNCTION public.fn_handle_new_user() TO supabase_auth_admin;
