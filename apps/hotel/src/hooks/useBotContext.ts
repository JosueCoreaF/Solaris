import { useEffect, useState, useCallback } from 'react';
import {
  DEFAULT_HOTEL_CONTEXT,
  DEFAULT_FAQS,
  type HotelContext,
  type UserReservationContext,
  findRelevantFAQs,
  generateAutoResponse,
  buildBotSystemPrompt,
  enrichChatMessage,
  analyzeSentiment,
} from '../services/botContextService';
import { supabase } from '../api/supabase';
import type { ChatMessage } from '../types/chat';

interface UseBotContextOptions {
  userId?: string;
  hotelId?: string;
  enabled?: boolean;
}

export function useBotContext(options: UseBotContextOptions = {}) {
  const { userId, enabled = true } = options;
  const [hotelContext, setHotelContext] = useState<HotelContext>(DEFAULT_HOTEL_CONTEXT);
  const [userContext, setUserContext] = useState<UserReservationContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar contexto del hotel
  useEffect(() => {
    if (!enabled) return;

    const fetchHotelContext = async () => {
      try {
        setLoading(true);

        // Obtener configuración del hotel
        const { data: config } = await supabase
          .from('configuracion_hotelera')
          .select('*')
          .single();

        // Obtener hoteles disponibles
        const { data: hoteles } = await supabase
          .from('hoteles')
          .select('*')
          .limit(1);

        if (hoteles && hoteles.length > 0) {
          const hotel = hoteles[0];

          setHotelContext((prev) => ({
            ...prev,
            hotel: {
              ...prev.hotel,
              nombre: hotel.nombre_hotel || 'Hotel Verona',
              ciudad: hotel.ciudad || 'Tegucigalpa',
              telefono: hotel.telefono,
              email: hotel.correo_contacto,
              estrellas: hotel.estrellas,
            },
            tarifas: {
              ...prev.tarifas,
              tipoCambio: config?.tipo_cambio_base || 24.5,
            },
          }));
        }
      } catch (err) {
        console.error('Error cargando contexto del hotel:', err);
        setError('No se pudo cargar contexto del hotel');
      } finally {
        setLoading(false);
      }
    };

    fetchHotelContext();
  }, [enabled]);

  // Cargar contexto del usuario
  useEffect(() => {
    if (!enabled || !userId) {
      setUserContext(null);
      return;
    }

    const fetchUserContext = async () => {
      try {
        // Obtener reservas del usuario
        const { data: huespedes } = await supabase
          .from('huespedes')
          .select('id_huesped')
          .eq('id_huesped', userId)
          .single();

        if (!huespedes) {
          setUserContext({ tieneReserva: false });
          return;
        }

        const { data: reservas } = await supabase
          .from('reservas_hotel')
          .select('id_reserva_hotel, check_in, check_out, estado, total_reserva, moneda')
          .eq('id_huesped', userId)
          .in('estado', ['confirmada', 'check_in'])
          .order('check_in', { ascending: false });

        const { data: allReservas } = await supabase
          .from('reservas_hotel')
          .select('total_reserva, moneda')
          .eq('id_huesped', userId)
          .order('created_at', { ascending: false });

        const totalGastos =
          allReservas?.reduce((sum, r) => sum + (Number(r.total_reserva) || 0), 0) || 0;

        setUserContext({
          tieneReserva: (reservas?.length || 0) > 0,
          reservas: reservas
            ? reservas.map((r) => ({
                id: r.id_reserva_hotel,
                checkIn: r.check_in,
                checkOut: r.check_out,
                habitacion: 'Suite Deluxe', // Completar según datos reales
                estado: r.estado,
                total: r.total_reserva,
                moneda: r.moneda || 'USD',
              }))
            : undefined,
          historialGastos: {
            total: totalGastos,
            moneda: 'USD',
            ultimaReserva: reservas?.[0]?.check_in,
          },
        });
      } catch (err) {
        console.error('Error cargando contexto del usuario:', err);
      }
    };

    fetchUserContext();
  }, [enabled, userId]);

  // Función para encontrar FAQs relevantes
  const findRelevantFaqs = useCallback(
    (message: string, limit?: number) => {
      return findRelevantFAQs(message, hotelContext.faqs || DEFAULT_FAQS, limit);
    },
    [hotelContext.faqs]
  );

  // Función para generar respuesta automática
  const getAutoResponse = useCallback(
    (message: string) => {
      return generateAutoResponse(message, hotelContext.faqs || DEFAULT_FAQS);
    },
    [hotelContext.faqs]
  );

  // Función para enriquecer un mensaje con contexto
  const enrichMessage = useCallback(
    (message: ChatMessage) => {
      return enrichChatMessage(message, hotelContext, userContext || undefined);
    },
    [hotelContext, userContext]
  );

  // Función para obtener el prompt del sistema
  const getSystemPrompt = useCallback(() => {
    return buildBotSystemPrompt(hotelContext, userContext || undefined);
  }, [hotelContext, userContext]);

  // Función para analizar sentimiento
  const getSentiment = useCallback((message: string) => {
    return analyzeSentiment(message);
  }, []);

  return {
    hotelContext,
    userContext,
    loading,
    error,
    findRelevantFaqs,
    getAutoResponse,
    enrichMessage,
    getSystemPrompt,
    getSentiment,
  };
}
