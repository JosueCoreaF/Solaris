import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('reservas_hotel')
    .update({ estado: 'check_out' })
    .lt('check_out', new Date().toISOString())
    .eq('estado', 'pendiente');
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Fixed past reservations!', data);
  }
}
run();
