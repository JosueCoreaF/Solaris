import { supabaseAdmin, supabase } from './config/supabase.js';

const db = () => supabaseAdmin ?? supabase;

async function run() {
  const ownerId = 'c8332c45-8380-4097-a8d0-caeb631b8b3a';
  console.log('Testing Supabase connection with ownerId:', ownerId);
  console.log('supabaseAdmin is defined:', !!supabaseAdmin);
  
  try {
    const table = 'huespedes';
    let q = db().from(table).select('*', { count: 'exact', head: true }).eq('owner_id', ownerId);
    const { count, error, data } = await q;
    
    if (error) {
      console.error('Error querying huespedes:', error);
    } else {
      console.log('Huespedes count:', count);
    }

    const { count: resCount, error: resError } = await db()
      .from('reservas_hotel')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    
    if (resError) {
      console.error('Error querying reservas_hotel:', resError);
    } else {
      console.log('Reservas count:', resCount);
    }

  } catch (err) {
    console.error('Exception in test:', err);
  }
}

run();
