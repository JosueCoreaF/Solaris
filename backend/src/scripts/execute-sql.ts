import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const setupRLS = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Ejecutando SQL para crear función RPC...\n');
    
    const sql = `
-- Crear función para crear/actualizar rol de usuario (bypass RLS)
CREATE OR REPLACE FUNCTION public.fn_crear_usuario_rol(
  p_usuario_id UUID,
  p_id_hotel UUID,
  p_rol TEXT,
  p_estado TEXT
)
RETURNS json AS $$
DECLARE
  v_id_hotel UUID;
BEGIN
  v_id_hotel := COALESCE(p_id_hotel, '00000000-0000-0000-0000-000000000000'::UUID);
  
  INSERT INTO public.usuarios_roles (usuario_id, id_hotel, rol, estado, creado_en, actualizado_en)
  VALUES (p_usuario_id, v_id_hotel, p_rol, p_estado, NOW(), NOW())
  ON CONFLICT (usuario_id, id_hotel) DO UPDATE SET
    rol = p_rol,
    estado = p_estado,
    actualizado_en = NOW();
  
  RETURN json_build_object('success', true, 'message', 'Role assigned successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que usuarios autenticados ejecuten la función
GRANT EXECUTE ON FUNCTION public.fn_crear_usuario_rol TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crear_usuario_rol TO anon;
    `;
    
    await client.query(sql);
    console.log('✅ Función fn_crear_usuario_rol creada exitosamente!\n');
    
  } catch (error) {
    console.error('❌ Error ejecutando SQL:', error);
  } finally {
    client.release();
    await pool.end();
  }
};

setupRLS();
