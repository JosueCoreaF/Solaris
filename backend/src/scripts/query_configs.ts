import { supabaseAdmin } from '../config/supabase.js';

async function run() {
  if (!supabaseAdmin) {
    console.error("supabaseAdmin is null");
    return;
  }
  const { data, error } = await supabaseAdmin.from('configuracion_hotelera').select('*');
  if (error) {
    console.error("Error querying configuracion_hotelera:", error);
  } else {
    console.log("Configurations in DB:", JSON.stringify(data, null, 2));
  }
}

run();
