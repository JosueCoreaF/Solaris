-- =============================================================================
-- PATCH: fn_handle_new_user — solo crea owners para propietarios reales
-- Problema: el trigger metía a TODOS los usuarios en owners (staff + propietarios)
-- Fix: solo crea la entrada en owners si el usuario tiene tipo_registro = 'propietario'
-- Los usuarios de staff (invitación o creación manual) tienen tipo_registro = 'staff'
-- y se gestionan exclusivamente en usuarios_roles via el backend.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nombre varchar;
  v_email  varchar;
BEGIN
  -- Si es usuario de staff, no crear entrada en owners.
  -- El backend gestiona usuarios_roles directamente.
  IF COALESCE(NEW.raw_user_meta_data->>'tipo_registro', 'propietario') = 'staff' THEN
    RETURN NEW;
  END IF;

  -- Solo para propietarios registrados desde el Hub
  v_email  := COALESCE(NULLIF(TRIM(NEW.email), ''), NEW.id::text || '@sin-email.local');
  v_nombre := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'nombre_empresa'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(v_email, '@', 1)
  );

  INSERT INTO public.owners (id_owner, nombre_empresa, email_contacto, estado)
  VALUES (NEW.id, v_nombre, v_email, 'activo')
  ON CONFLICT (id_owner) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Reasignar el trigger (por si acaso)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();
GRANT EXECUTE ON FUNCTION public.fn_handle_new_user() TO supabase_auth_admin;
