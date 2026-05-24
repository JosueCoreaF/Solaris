import { createClient } from '@supabase/supabase-js';

// Use admin client with service_role key if available, otherwise use regular client
const supabaseUrl = 'https://zgytjijozhdtgbqldydz.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneXRqaWpvemhkdGdicWxkeWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNTgwNzQsImV4cCI6MjA4OTczNDA3NH0.sVBaMy__KWHbKwdL_gMQ2LeIM6C7bnwj2OxFLf8q1UQ';

const supabase = createClient(supabaseUrl, anonKey);

const createRoleFunction = async () => {
  try {
    console.log('🔧 Creating fn_crear_usuario_rol function...');
    
    // Try to create function via RPC or SQL query
    const { data, error } = await supabase.rpc('fn_crear_usuario_rol', {
      p_usuario_id: '00000000-0000-0000-0000-000000000001',
      p_id_hotel: null,
      p_rol: 'TEST',
      p_estado: 'activo'
    });

    if (error && error.message.includes('not found')) {
      console.log('❌ Function does not exist. You need to run the SQL migration manually:');
      console.log('');
      console.log('Visit Supabase Dashboard -> SQL Editor and run:');
      console.log('');
      console.log(`
-- Create function with SECURITY DEFINER to bypass RLS
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
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.fn_crear_usuario_rol TO authenticated;
      `);
      return;
    }

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Function exists and works!');
  } catch (err) {
    console.error('Error:', err);
  }
};

createRoleFunction();
