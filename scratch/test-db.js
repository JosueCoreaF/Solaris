import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Probando consulta a habitaciones_con_detalles...');
  const { data, error } = await supabase
    .from('habitaciones_con_detalles')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error en habitaciones_con_detalles:', error);
  } else {
    console.log('Éxito en habitaciones_con_detalles:', data);
  }

  console.log('Probando consulta a habitaciones...');
  const { data: habs, error: habError } = await supabase
    .from('habitaciones')
    .select('*')
    .limit(1);

  if (habError) {
    console.error('Error en habitaciones:', habError);
  } else {
    console.log('Éxito en habitaciones:', habs);
  }
}

test();
