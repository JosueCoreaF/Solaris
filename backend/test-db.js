import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  console.log('=== HOTELES CON MODULE ID ===');
  const { data, error } = await supabase
    .from('hoteles')
    .select('id_hotel, nombre_hotel, id_module, owner_id');
  if (error) console.error('Error:', error);
  else console.log(data);
}

test();
