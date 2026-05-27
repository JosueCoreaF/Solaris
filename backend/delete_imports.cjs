const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data, error } = await supabase.from('reservas_hotel').delete().like('observaciones', '%[EXCEL:%');
  console.log(error ? error : 'Deleted successfully');
}
run();
