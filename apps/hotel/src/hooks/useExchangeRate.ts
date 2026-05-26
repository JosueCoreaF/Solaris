import { useState, useEffect } from 'react';

const POLL_INTERVAL = parseInt(import.meta.env.VITE_EXCHANGE_POLL_MS || '600000');

export const useExchangeRate = () => {
  const [exchangeRate, setExchangeRate] = useState<number>(24.5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExchangeRate = async () => {
      setLoading(true);
      try {
        // TODO: Integrar con API del backend para obtener tipo de cambio
        // const response = await fetch('/api/finance/exchange-rate');
        // const data = await response.json();
        // setExchangeRate(data.rate);
        
        // Por ahora, usar valor por defecto
        setExchangeRate(24.5);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error fetching exchange rate');
      } finally {
        setLoading(false);
      }
    };

    fetchExchangeRate();

    // Polling para actualizar tipo de cambio
    const interval = setInterval(fetchExchangeRate, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const convertUsdToHnl = (usd: number): number => {
    return Math.round(usd * exchangeRate * 100) / 100;
  };

  const convertHnlToUsd = (hnl: number): number => {
    return Math.round((hnl / exchangeRate) * 100) / 100;
  };

  return {
    exchangeRate,
    loading,
    error,
    convertUsdToHnl,
    convertHnlToUsd,
  };
};
