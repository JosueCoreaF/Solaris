-- ============================================================================
-- SOLARIS MCP - Actualización de Autenticación Multimodular
-- ============================================================================

-- Actualizar función para generar tokens que soporte todos los módulos (Hoteles, Gyms, Restaurantes)
CREATE OR REPLACE FUNCTION public.generate_api_token(
  p_user_id UUID, 
  p_duracion INTERVAL DEFAULT '1 year'
)
RETURNS TABLE (
  token TEXT, 
  user_email TEXT, 
  owner_id UUID,
  negocios_acceso TEXT[],
  expira TIMESTAMP
) AS $$
DECLARE
  v_new_token VARCHAR(255);
  v_user_email VARCHAR(255);
  v_expires TIMESTAMP;
  v_owner_id UUID;
  v_negocios TEXT[];
BEGIN
  -- Generar token aleatorio seguro
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Obtener email del usuario desde auth.users
  SELECT email INTO v_user_email 
  FROM auth.users 
  WHERE id = p_user_id;
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado en auth.users';
  END IF;
  
  -- Resolver si es Owner o Staff
  IF EXISTS (SELECT 1 FROM public.owners WHERE id_owner = p_user_id) THEN
    -- Es dueño: Resolver todos sus negocios asociados de todos sus módulos
    v_owner_id := p_user_id;
    
    SELECT ARRAY(
      SELECT h.id_hotel::text FROM public.hoteles h 
      JOIN public.business_modules bm ON h.id_module = bm.id_module 
      WHERE bm.owner_id = p_user_id
      UNION
      SELECT g.id_gimnasio::text FROM public.gimnasios g 
      JOIN public.business_modules bm ON g.id_module = bm.id_module 
      WHERE bm.owner_id = p_user_id
      UNION
      SELECT r.id_restaurant::text FROM public.restaurant r 
      JOIN public.business_modules bm ON r.id_module = bm.id_module 
      WHERE bm.owner_id = p_user_id
    ) INTO v_negocios;
  ELSE
    -- Es staff: Resolver owner_id de sus roles activos
    SELECT owner_id INTO v_owner_id
    FROM (
      SELECT owner_id FROM public.usuarios_roles WHERE user_id = p_user_id AND estado = 'activo'
      UNION
      SELECT owner_id FROM public.usuarios_roles_gym WHERE user_id = p_user_id AND estado = 'activo'
    ) u LIMIT 1;
    
    IF v_owner_id IS NOT NULL THEN
      -- Obtener los negocios autorizados específicos
      SELECT ARRAY(
        SELECT id_hotel::text FROM public.usuarios_roles 
        WHERE user_id = p_user_id AND estado = 'activo' AND id_hotel IS NOT NULL
        UNION
        SELECT id_gimnasio::text FROM public.usuarios_roles_gym 
        WHERE user_id = p_user_id AND estado = 'activo' AND id_gimnasio IS NOT NULL
      ) INTO v_negocios;
    END IF;
  END IF;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'El usuario no tiene roles activos ni es un propietario registrado';
  END IF;
  
  -- Calcular fecha de expiración
  v_expires := NOW() + p_duracion;
  
  -- Insertar token
  INSERT INTO public.user_tokens (user_id, api_token, token_expires)
  VALUES (p_user_id, v_new_token, v_expires);
  
  -- Retornar resultados
  RETURN QUERY SELECT 
    v_new_token::TEXT,
    v_user_email::TEXT,
    v_owner_id,
    COALESCE(v_negocios, ARRAY[]::TEXT[]),
    v_expires;
END;
$$ LANGUAGE plpgsql;

-- Actualizar vista para listar/validar tokens y sus accesos multimodulares
CREATE OR REPLACE VIEW public.vw_valid_tokens AS
SELECT 
  ut.id,
  ut.user_id,
  ut.api_token,
  au.email as user_email,
  COALESCE(
    (SELECT id_owner FROM public.owners WHERE id_owner = ut.user_id),
    (SELECT owner_id FROM public.usuarios_roles WHERE user_id = ut.user_id AND estado = 'activo' LIMIT 1),
    (SELECT owner_id FROM public.usuarios_roles_gym WHERE user_id = ut.user_id AND estado = 'activo' LIMIT 1)
  ) as owner_id,
  (
    SELECT ARRAY(
      -- Negocios del owner si es owner
      SELECT h.id_hotel::text FROM public.hoteles h 
        JOIN public.business_modules bm ON h.id_module = bm.id_module 
        WHERE bm.owner_id = ut.user_id AND EXISTS (SELECT 1 FROM public.owners WHERE id_owner = ut.user_id)
      UNION
      SELECT g.id_gimnasio::text FROM public.gimnasios g 
        JOIN public.business_modules bm ON g.id_module = bm.id_module 
        WHERE bm.owner_id = ut.user_id AND EXISTS (SELECT 1 FROM public.owners WHERE id_owner = ut.user_id)
      UNION
      SELECT r.id_restaurant::text FROM public.restaurant r 
        JOIN public.business_modules bm ON r.id_module = bm.id_module 
        WHERE bm.owner_id = ut.user_id AND EXISTS (SELECT 1 FROM public.owners WHERE id_owner = ut.user_id)
      -- Negocios del staff si es staff (no es owner)
      UNION
      SELECT id_hotel::text FROM public.usuarios_roles 
        WHERE user_id = ut.user_id AND estado = 'activo' AND id_hotel IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM public.owners WHERE id_owner = ut.user_id)
      UNION
      SELECT id_gimnasio::text FROM public.usuarios_roles_gym 
        WHERE user_id = ut.user_id AND estado = 'activo' AND id_gimnasio IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM public.owners WHERE id_owner = ut.user_id)
    )
  ) as id_hoteles_acceso,
  ut.token_expires,
  ut.last_used_at,
  (ut.token_expires > NOW()) as is_active
FROM public.user_tokens ut
JOIN auth.users au ON ut.user_id = au.id;
