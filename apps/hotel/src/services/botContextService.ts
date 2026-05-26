import type { ChatMessage } from '../types/chat';

/**
 * Información de contexto sobre el hotel para mejorar respuestas del bot
 */
export interface HotelContext {
  hotel: {
    nombre: string;
    ciudad: string;
    telefono?: string;
    email?: string;
    descripcion?: string;
    estrellas?: number;
    comodidades?: string[];
  };
  politicas: {
    checkIn: string;
    checkOut: string;
    cancelacion: string;
    petsPolicy?: string;
    groupPolicy?: string;
  };
  faqs: FAQ[];
  habitaciones: {
    disponibles: number;
    tipos: { tipo: string; cantidad: number }[];
  };
  tarifas: {
    rangoPrecio: { min: number; max: number };
    monedas: string[];
    tipoCambio: number;
  };
}

export interface FAQ {
  pregunta: string;
  respuesta: string;
  categoria: 'general' | 'reservas' | 'facturacion' | 'servicios' | 'transporte';
  palabrasClave: string[];
}

export interface UserReservationContext {
  tieneReserva: boolean;
  reservas?: {
    id: string;
    checkIn: string;
    checkOut: string;
    habitacion: string;
    estado: string;
    total: number;
    moneda: string;
  }[];
  historialGastos?: {
    total: number;
    moneda: string;
    ultimaReserva?: string;
  };
}

/**
 * Base de datos de FAQs del hotel
 */
export const DEFAULT_FAQS: FAQ[] = [
  {
    pregunta: '¿Cuál es la hora de check-in y check-out?',
    respuesta: 'Check-in: 3:00 PM. Check-out: 12:00 PM. Pueden solicitar early check-in o late check-out según disponibilidad.',
    categoria: 'general',
    palabrasClave: ['check-in', 'check-out', 'hora', 'entrada', 'salida'],
  },
  {
    pregunta: '¿Dónde están ubicados? ¿Cuál es su dirección en Google Maps?',
    respuesta: 'Estamos ubicados en San Pedro Sula, Barrio Guamilito, 3ra calle, 7ma avenida. Puedes encontrarnos fácilmente en Google Maps buscando "Hotel Verona San Pedro Sula".',
    categoria: 'general',
    palabrasClave: ['ubicacion', 'direccion', 'donde', 'google', 'maps', 'llegar'],
  },
  {
    pregunta: '¿Pueden pagar directamente en la habitación?',
    respuesta: 'Sí, aceptamos tarjeta de crédito, efectivo (HNL y USD) y transferencia bancaria. El depósito de seguridad se retiene hasta el check-out.',
    categoria: 'facturacion',
    palabrasClave: ['pago', 'tarjeta', 'efectivo', 'transferencia', 'deposito'],
  },
  {
    pregunta: '¿Hay WiFi en el hotel?',
    respuesta: 'Sí, tenemos WiFi de alta velocidad en todas las habitaciones y áreas comunes. Puedes conectarte con la contraseña que aparece en la puerta.',
    categoria: 'servicios',
    palabrasClave: ['wifi', 'internet', 'conexion', 'velocidad'],
  },
  {
    pregunta: '¿Ofrecen servicio de transporte al aeropuerto?',
    respuesta: 'Sí, ofrecemos transporte privado al aeropuerto a tarifa especial. Contacta a recepción para reservar.',
    categoria: 'transporte',
    palabrasClave: ['transporte', 'aeropuerto', 'taxi', 'shuttle'],
  },
  {
    pregunta: '¿Puedo cancelar mi reserva?',
    respuesta: 'Las cancelaciones gratuitas se aceptan hasta 48 horas antes del check-in. Después de ese período, aplica la tarifa completa.',
    categoria: 'reservas',
    palabrasClave: ['cancelacion', 'reembolso', 'devolucion'],
  },
  {
    pregunta: '¿Hay mascotas permitidas?',
    respuesta: 'Aceptamos mascotas pequeñas (hasta 5 kg) con cargo adicional de $25 USD por noche. Contacta con anticipación.',
    categoria: 'general',
    palabrasClave: ['mascotas', 'perro', 'gato', 'animales'],
  },
  {
    pregunta: '¿Qué incluye el desayuno?',
    respuesta: 'El desayuno buffet incluye frutas, cereales, pan, huevos, jamón, queso, café, jugo y té. Servicio de 6:30 AM a 10:00 AM.',
    categoria: 'servicios',
    palabrasClave: ['desayuno', 'buffet', 'comida', 'comedor'],
  },
  {
    pregunta: '¿Cómo hago una reserva?',
    respuesta: 'Puedes reservar a través de nuestro portal web, llamando al teléfono de recepción, o contactando directamente por correo. Te confirmaremos por email.',
    categoria: 'reservas',
    palabrasClave: ['reserva', 'booking', 'reservacion', 'agendar'],
  },
];

/**
 * Contexto predefinido del hotel (ejemplo)
 */
export const DEFAULT_HOTEL_CONTEXT: HotelContext = {
  hotel: {
    nombre: 'Hotel Verona',
    ciudad: 'Tegucigalpa',
    telefono: '+504 2232-1234',
    email: 'info@hotelverona.hn',
    descripcion:
      'Hotel de 4 estrellas con 45 habitaciones, piscina, restaurante y servicio de concierge 24/7.',
    estrellas: 4,
    comodidades: ['WiFi gratis', 'Aire acondicionado', 'TV Smart', 'Piscina', 'Restaurante', 'Bar'],
  },
  politicas: {
    checkIn: '3:00 PM',
    checkOut: '12:00 PM',
    cancelacion: 'Cancelación gratuita hasta 48 horas antes del check-in',
    petsPolicy: 'Mascotas pequeñas (hasta 5 kg) permitidas con cargo adicional',
    groupPolicy: 'Grupos de 10 o más personas reciben descuento especial',
  },
  faqs: DEFAULT_FAQS,
  habitaciones: {
    disponibles: 8,
    tipos: [
      { tipo: 'Individual', cantidad: 15 },
      { tipo: 'Doble', cantidad: 20 },
      { tipo: 'Suite', cantidad: 10 },
    ],
  },
  tarifas: {
    rangoPrecio: { min: 75, max: 250 },
    monedas: ['USD', 'HNL'],
    tipoCambio: 24.5,
  },
};

/**
 * Motor de búsqueda de FAQs con similitud de palabras clave
 */
export function findRelevantFAQs(userMessage: string, faqs: FAQ[], limit: number = 3): FAQ[] {
  const messageWords = userMessage.toLowerCase().split(/\s+/);

  const scored = faqs.map((faq) => {
    let score = 0;

    // Búsqueda de palabras clave
    faq.palabrasClave.forEach((keyword) => {
      if (messageWords.some((word) => word.includes(keyword) || keyword.includes(word))) {
        score += 2;
      }
    });

    // Búsqueda en pregunta
    const preguntaWords = faq.pregunta.toLowerCase().split(/\s+/);
    messageWords.forEach((word) => {
      if (preguntaWords.some((pWord) => pWord.includes(word) || word.includes(pWord))) {
        score += 1;
      }
    });

    return { faq, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.faq);
}

/**
 * Construye un prompt del sistema para Claude/GPT con contexto del hotel
 */
export function buildBotSystemPrompt(hotelContext: HotelContext, userContext?: UserReservationContext): string {
  const { hotel, politicas, faqs } = hotelContext;

  let prompt = `Eres un asistente de concierge de ${hotel.nombre}, un hotel de ${hotel.estrellas} estrellas en ${hotel.ciudad}.

INFORMACIÓN DEL HOTEL:
- Nombre: ${hotel.nombre}
- Ciudad: ${hotel.ciudad}
- Teléfono: ${hotel.telefono || 'No disponible'}
- Email: ${hotel.email || 'No disponible'}
- Descripción: ${hotel.descripcion || 'Hotel de lujo'}
- Comodidades: ${hotel.comodidades?.join(', ') || 'Varias'}

POLÍTICAS IMPORTANTES:
- Check-in: ${politicas.checkIn}
- Check-out: ${politicas.checkOut}
- Cancelación: ${politicas.cancelacion}
- Mascotas: ${politicas.petsPolicy || 'No permitidas'}
- Grupos: ${politicas.groupPolicy || 'Sin política especial'}

HORARIO DE OPERACIÓN: Disponible 24/7

INSTRUCCIONES:
1. Responde en español (Honduras)
2. Sé amable, profesional y servicial
3. Si no sabes algo, ofrece transferir a recepción
4. Usa emojis apropiados para mejorar la experiencia
5. Sugiere servicios adicionales cuando sea relevante
6. Si el cliente solicita hablar con un agente, ofrece conectarlo

CONTEXTO DEL CLIENTE:
${
  userContext
    ? `- Tiene reserva activa: ${userContext.tieneReserva}
${userContext.reservas ? `- Próxima reserva: ${userContext.reservas[0]?.checkIn} a ${userContext.reservas[0]?.checkOut}` : ''}
${userContext.historialGastos ? `- Total gastado: ${userContext.historialGastos.total} ${userContext.historialGastos.moneda}` : ''}`
    : '- Cliente nuevo'
}

PREGUNTAS FRECUENTES (usa esto para responder):
${faqs.map((f) => `Q: ${f.pregunta}\nA: ${f.respuesta}`).join('\n\n')}

IMPORTANTE: 
- Siempre mantén un tono cálido y profesional
- Si el usuario es un cliente existente, personaliza tu respuesta
- Ofrece ayuda proactiva (ej: "¿Necesitas ayuda con transporte al aeropuerto?")
- Para problemas complejos, sugiere hablar con recepción`;

  return prompt;
}

/**
 * Analiza sentimiento básico de un mensaje
 */
export function analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
  const positive = ['gracias', 'excelente', 'perfecto', 'muy bien', 'adorar', 'amor', '❤️', '😍', '😊'];
  const negative = ['problema', 'error', 'queja', 'mal', 'terrible', 'horrible', 'molesto', '😠', '😡', '😞'];

  const lower = message.toLowerCase();
  const posCount = positive.filter((word) => lower.includes(word)).length;
  const negCount = negative.filter((word) => lower.includes(word)).length;

  if (negCount > posCount) return 'negative';
  if (posCount > negCount) return 'positive';
  return 'neutral';
}

/**
 * Genera respuesta automática basada en FAQs
 */
export function generateAutoResponse(
  userMessage: string,
  faqs: FAQ[] = DEFAULT_FAQS
): { response: string; source: 'faq' | 'manual' } | null {
  const relevantFaqs = findRelevantFAQs(userMessage, faqs, 1);

  if (relevantFaqs.length > 0) {
    return {
      response: `📚 Basado en nuestras FAQs:\n\n${relevantFaqs[0].respuesta}\n\n¿Hay algo más que necesites?`,
      source: 'faq',
    };
  }

  return null;
}

/**
 * Formatea mensaje con contexto para enviar al API de IA (si lo tienes)
 */
export interface ChatMessageWithContext extends ChatMessage {
  systemPrompt?: string;
  hotelContext?: HotelContext;
  userContext?: UserReservationContext;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export function enrichChatMessage(
  message: ChatMessage,
  hotelContext: HotelContext,
  userContext?: UserReservationContext
): ChatMessageWithContext {
  return {
    ...message,
    systemPrompt: buildBotSystemPrompt(hotelContext, userContext),
    hotelContext,
    userContext,
    sentiment: analyzeSentiment(message.content),
  };
}
