import { supabaseAdmin } from '../config/supabase.js';

/**
 * Feeds exchange rate from open.er-api.com and updates the Supabase configuracion_hotelera table.
 */
export async function updateExchangeRate(): Promise<number | null> {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured');
    }

    console.log('[Scheduler] Fetching daily USD to HNL exchange rate...');
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`Exchange Rate API returned status: ${response.status}`);
    }

    const data = (await response.json()) as any;
    if (data?.result !== 'success' || !data?.rates?.HNL) {
      throw new Error('Invalid format or missing HNL rate from Exchange Rate API');
    }

    const hnlRate = parseFloat(data.rates.HNL);
    console.log(`[Scheduler] Fetched exchange rate: 1 USD = ${hnlRate.toFixed(4)} HNL`);

    // Update in Supabase
    const { error } = await supabaseAdmin
      .from('configuracion_hotelera')
      .update({
        tipo_cambio_base: hnlRate,
        tipo_cambio_actualizado_en: new Date().toISOString()
      })
      .eq('id_config', 'default');

    if (error) {
      throw new Error(`Failed to update exchange rate in Supabase: ${error.message}`);
    }

    console.log(`[Scheduler] Supabase updated successfully with new exchange rate: ${hnlRate.toFixed(4)} HNL`);
    return hnlRate;
  } catch (err: any) {
    console.error('[Scheduler] Error in automatic exchange rate updater:', err.message || err);
    return null;
  }
}

/**
 * Initializes the background timer to fetch exchange rate every 12 hours.
 */
export function startExchangeRateScheduler() {
  // Execute immediately on server startup
  updateExchangeRate();

  // Schedule to execute every 12 hours (12 * 60 * 60 * 1000 ms)
  const INTERVAL_MS = 12 * 60 * 60 * 1000;
  setInterval(async () => {
    await updateExchangeRate();
  }, INTERVAL_MS);
}
