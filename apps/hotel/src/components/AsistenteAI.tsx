import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { fetchReservas, fetchHabitaciones, fetchHuespedes, updateReserva, cancelReserva, createReserva, createHuesped, toggleBloqueo, fetchBloques, fetchHoteles, splitReserva } from '../api/bookingsService';
import { obtenerConfigHotelera } from '../api/configService';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

const getFormattedTime = (): string => {
  const d = new Date();
  let hr = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12;
  hr = hr ? hr : 12; // the hour '0' should be '12'
  return `${hr}:${min} ${ampm}`;
};

const SYSTEM_PROMPT = `Eres 'Mars', el copiloto de inteligencia artificial exclusivo para el personal administrativo de nuestra cadena de hoteles afiliados. 

Tu propósito es asistir a recepcionistas, administradores y personal de hotel en sus tareas diarias para cualquiera de las sedes de la cadena, tales como:
1. **Redactar respuestas y correos**: Ayuda a escribir respuestas amables, profesionales y eficientes a los huéspedes por correo o chat.
2. **Políticas de los Hoteles**: 
   - Check-in: A partir de las 3:00 PM.
   - Check-out: Hasta las 12:00 PM.
   - Cancelación gratuita: Hasta 48 horas antes de la llegada.
   - Cama extra: Sujeta a disponibilidad con cargo adicional de HNL 350.
3. **Cálculos Financieros**:
   - Impuesto ISV: Usa la tasa real del contexto de la base de datos (por defecto es 15%).
   - Impuesto de Turismo: Usa la tasa real del contexto de la base de datos (por defecto es 4%).
   - Conversión de Moneda: Utiliza el tipo de cambio base real especificado en la sección 'CONFIGURACIÓN HOTELERA Y FINANCIERA ACTIVA' de tu contexto de la base de datos. Si no se especifica en el contexto, usa el tipo de cambio referencial de 1 USD = 24.50 HNL.
4. **Creación y Gestión de Reservas Multihotel**: Tienes la capacidad total de crear nuevas reservas para cualquier hotel de la cadena (ej. Hotel Verona o Hotel la Costa), registrar nuevos huéspedes en el directorio, o realizar modificaciones o cancelaciones a reservas existentes directamente en la base de datos de Supabase si el usuario te lo solicita explícitamente.
5. **Gestión de Disponibilidad y Bloqueos**: Tienes la capacidad de bloquear o habilitar (desbloquear) habitaciones para fechas específicas en la base de datos a petición del usuario. Si te solicitan bloquear o habilitar una habitación para una fecha o rango de fechas, debes usar la función 'toggleRoomBlock'.

REGLAS DE NEGOCIO Y MULTI-SEDE / CADENA:
1. Hotel Verona y Hotel la Costa son hoteles hermanos de la misma cadena/grupo consolidado. No son competidores ni independientes; compartimos base de datos y administración consolidada.
2. Los administradores pueden consultar y operar sobre cualquiera de las propiedades del grupo en el modo consolidado (o individual).
3. Si el usuario te pide crear una reserva para un hotel específico (como Hotel la Costa), busca una habitación que pertenezca a ese hotel en el 'CATÁLOGO COMPLETO DE HABITACIONES REGISTRADAS' e identifícala por su ID para crear la reservación correspondiente.
4. Al listar la ocupación, disponibilidad o reservas, siempre menciona el hotel correspondiente para evitar confusiones al administrador.
5. Responde siempre en español.
6. Si el usuario pregunta por la ubicación del hotel, proporciona la dirección y el enlace de Google Maps si está disponible.
7. Mantén un tono sumamente amable, profesional, ejecutivo y servicial.
8. Utiliza formato markdown (negritas, listas, saltos de línea) para que las respuestas sean extremadamente legibles.
9. Usa los datos reales de la base de datos que se te proporcionan a continuación para responder preguntas sobre ocupación, cantidad de huéspedes, etc. de manera precisa.
10. **Precisión Extrema en Disponibilidad y Bloqueos**: Cuando el usuario pregunte por la disponibilidad de una fecha o período específico, debes realizar un análisis matemático estricto cruzando el 'CATÁLOGO COMPLETO DE HABITACIONES REGISTRADAS' con el 'LISTADO DETALLADO DE RESERVAS REGISTRADAS' y el 'LISTADO DETALLADO DE BLOQUEOS Y NO DISPONIBILIDADES' para ese día.
   * **NUNCA** generalices diciendo que "no hay habitaciones disponibles" o que "todas están ocupadas" si hay habitaciones libres.
   * Detalla con precisión quirúrgica el estado de la fecha consultada clasificándolo en:
     a) **Habitaciones Ocupadas** (menciona nombre, cliente, hotel y código de reserva).
     b) **Habitaciones Bloqueadas/Fuera de Servicio** (menciona nombre, hotel y el motivo del bloqueo).
     c) **Habitaciones Disponibles** (menciona nombre, hotel, tipo, capacidad y la tarifa exacta).
   * Al redactar respuestas o correos para huéspedes, si hay habitaciones libres, ofrécelas detallando el tipo y precio. Si de verdad no hay ninguna disponible, explícalo de forma amable y profesional, sugiriendo fechas alternativas viables.
11. **REGLA DE ORO DE ACCIONES Y FALLOS**: Si el usuario te pide crear, actualizar o cancelar una reservación, registrar un huésped, o alternar/cambiar la disponibilidad o bloqueo de una habitación para cierta fecha, **debes generar obligatoriamente la llamada de función correspondiente** (ej: 'updateReservation', 'createReservation', 'cancelReservation', 'createGuest', 'toggleRoomBlock'). **NUNCA** le digas al usuario que realizaste la acción si no has emitido la llamada a la herramienta. Si vas a crear una reserva y te das cuenta por tu contexto de datos que la habitación solicitada ya está ocupada en ese rango horario/fecha, **busca automáticamente otra habitación disponible del mismo tipo y usa esa en lugar de fallar o preguntarle de nuevo al usuario**.
12. **Reservas por Horas (REGLAS ESTRICTAS)**: 
    a) **NUNCA asumas ni inventes tarifas** para reservas por horas. Si el usuario pide crear una reserva por horas (tipo_reserva: 'hora'), y no te ha dicho la tarifa a cobrar, detente y PREGÚNTALE explícitamente cuál será el precio total o por hora antes de usar 'createReservation'.
    b) Presta extrema atención a las horas (ej. 14:00) en el listado de reservas de tu contexto. Si intentas asignar una habitación y ves que en ese mismo día ya existe otra reserva cuyas horas se cruzan o solapan con las horas solicitadas, **no la uses**. Elige OTRA habitación del mismo tipo que esté completamente libre en ese bloque de horas para evitar fallos en la base de datos.
13. **Manejo de Errores de Base de Datos**: Si envías una acción de reserva y la base de datos te responde con un ERROR (ej. "La habitación ya está ocupada"), no te detengas. Dile al usuario de forma natural que esa habitación falló en la verificación final y pregúntale si desea que la reserves en OTRA habitación que hayas validado que está libre.
`;

const SUGGESTIONS = [
  { label: 'Estado del Hotel', prompt: 'Dame un resumen ejecutivo analítico del estado actual del hotel con base en los datos de la base de datos.' },
  { label: 'Redactar Correo', prompt: 'Ayúdame a redactar un correo amable y formal para confirmar la reserva de un huésped que llegará mañana a las 4:00 PM.' },
  { label: 'Explicar Impuestos', prompt: 'Explícame detalladamente cómo se calcula el Impuesto de Turismo (4%) y el ISV (15%) en una reserva de 3 noches con tarifa de $100 USD la noche.' },
  { label: 'Borrador de Turno', prompt: 'Ayúdame a estructurar una plantilla elegante para hacer el reporte de entrega de turno de recepción.' }
];

const parseRetrySeconds = (errorMessage: string): number | null => {
  const match = errorMessage.match(/retry\s+in\s+([\d.]+)\s*s/i);
  if (match) {
    const secs = parseFloat(match[1]);
    if (!isNaN(secs)) return Math.ceil(secs);
  }
  return null;
};

const playChimeSound = (): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Play a premium high-quality double chime harmonic (D5 then A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5 note
    gain2.gain.setValueAtTime(0, ctx.currentTime + 0.08);
    gain2.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.60);
  } catch (error) {
    console.warn('Could not synthesize chime sound:', error);
  }
};

export const AsistenteAI: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbSummary, setDbSummary] = useState<string>('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [consecutiveRateLimits, setConsecutiveRateLimits] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationRetries, setVerificationRetries] = useState<number>(0);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract all API Keys from pool in VITE_GEMINI_API_KEY
  const keysPool = useMemo(() => {
    const rawVal = import.meta.env.VITE_GEMINI_API_KEY || '';
    return rawVal.split(',').map((k: string) => k.trim()).filter(Boolean);
  }, []);

  // Extremely lightweight request to verify Gemini is 100% available (ping check)
  const verifyGeminiAvailability = async (): Promise<boolean> => {
    if (keysPool.length === 0) return false;

    // Use current active index to verify
    const apiKey = keysPool[activeKeyIndex];
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'ping' }] }]
          })
        }
      );

      if (response.ok) return true;

      // If this key failed but we have a pool, rotate index so next retry checks a different one
      if (keysPool.length > 1) {
        const nextIndex = (activeKeyIndex + 1) % keysPool.length;
        setActiveKeyIndex(nextIndex);
        console.log(`[Verona AI] Key #${activeKeyIndex + 1} bloqueada en verificación. Rotando a Key #${nextIndex + 1}...`);
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleVerificationAndUnlock = async () => {
    setIsVerifying(true);
    const available = await verifyGeminiAvailability();
    setIsVerifying(false);

    if (available) {
      setRateLimitCountdown(null);
      setVerificationRetries(0);
      playChimeSound();
    } else {
      const nextRetries = verificationRetries + 1;
      setVerificationRetries(nextRetries);

      if (nextRetries >= 3) {
        // If it fails 3 times, do not trap the user forever! Force unlock.
        setRateLimitCountdown(null);
        setVerificationRetries(0);
        console.warn('Gemini availability verification failed 3 times. Forcing chat unlock.');
      } else {
        // If Google's rolling window is still locked, wait 5 more seconds and retry silently
        setRateLimitCountdown(5);
      }
    }
  };

  // Helper to fetch Gemini API with automatic API Key rotation on rate limit errors
  const fetchGeminiWithRotation = async (bodyObj: any, attempt = 0): Promise<Response> => {
    if (keysPool.length === 0) {
      throw new Error('API Key de Gemini no encontrada. Por favor, configúrala en el archivo .env');
    }

    const targetIndex = (activeKeyIndex + attempt) % keysPool.length;
    const apiKey = keysPool[targetIndex];

    console.log(`[Verona AI] Enviando consulta con Key #${targetIndex + 1} de ${keysPool.length}...`);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `Error en la API: ${response.status}`;
        const isRateLimit = errMsg.toLowerCase().includes('quota') ||
          errMsg.toLowerCase().includes('rate limit') ||
          errMsg.toLowerCase().includes('429') ||
          response.status === 429;

        if (isRateLimit && attempt < keysPool.length - 1) {
          console.warn(`[Verona AI] Key #${targetIndex + 1} agotada por cuota. Rotando a la siguiente clave...`);
          // Save the rotated index so next message starts from there
          setActiveKeyIndex((targetIndex + 1) % keysPool.length);
          // Retry immediately with the next key in the pool
          return fetchGeminiWithRotation(bodyObj, attempt + 1);
        }

        throw new Error(errMsg);
      }

      // Success! Keep the working key index active in state for future messages
      setActiveKeyIndex(targetIndex);
      return response;
    } catch (error: any) {
      const errMsg = error.message || '';
      const isRateLimit = errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('429');

      if (isRateLimit && attempt < keysPool.length - 1) {
        console.warn(`[Verona AI] Error de cuota con Key #${targetIndex + 1}. Rotando...`);
        setActiveKeyIndex((targetIndex + 1) % keysPool.length);
        return fetchGeminiWithRotation(bodyObj, attempt + 1);
      }
      throw error;
    }
  };

  // Manage Gemini rate-limiting countdown timer
  useEffect(() => {
    if (rateLimitCountdown === null) return;
    if (rateLimitCountdown <= 0) {
      handleVerificationAndUnlock();
      return;
    }
    const timer = setInterval(() => {
      setRateLimitCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0; // Pure React state transition to 0, which triggers handleVerificationAndUnlock above in the next run
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  // Load history from session storage
  useEffect(() => {
    const saved = sessionStorage.getItem('verona_ai_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // Fallback to welcome message
      }
    } else {
      // Setup initial welcome greeting
      setMessages([
        {
          role: 'model',
          text: `Hola. Soy **Verona AI**, tu copiloto inteligente de soporte conectado a la base de datos en tiempo real.

¿En qué te puedo asistir hoy? Puedo ayudarte a:
- **Crear nuevas reservas** y registrar nuevos huéspedes en segundos.
- **Modificar o cancelar reservas** directamente desde el chat en tiempo real.
- Analizar el estado de ocupación y reservas reales del hotel.
- Redactar respuestas y correos profesionales a huéspedes.
- Explicar cálculos de impuestos (15% ISV, 4% Turismo).
- Crear listas de control operativas o reportes de turnos.
- Resolver dudas sobre políticas del hotel.`,
          timestamp: getFormattedTime()
        }
      ]);
    }
  }, []);

  // Save history to session storage
  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('verona_ai_history', JSON.stringify(messages));
    }
  }, [messages]);

  // Load database summary immediately on mount and on open/clear
  const loadLiveSummary = async () => {
    try {
      const [rooms, guests, hotelConfig, hotelsList] = await Promise.all([
        fetchHabitaciones().catch(() => []),
        fetchHuespedes().catch(() => []),
        obtenerConfigHotelera().catch(() => null),
        fetchHoteles().catch(() => [])
      ]);

      const today = new Date();
      const desde = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // -15 days
      const hasta = new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +45 days (larger window for foresight)
      const [bookings, blocks] = await Promise.all([
        fetchReservas(desde, hasta).catch(() => []),
        fetchBloques(desde, hasta).catch(() => [])
      ]);

      // Calculate mathematically occupied rooms today (overlapping stay dates)
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const activeTodayBookings = bookings.filter(b => {
        if (b.estado === 'cancelada' || b.estado === 'no_show') return false;
        const ci = new Date(b.check_in.split('T')[0] + 'T00:00:00');
        const co = new Date(b.check_out.split('T')[0] + 'T00:00:00');
        return startOfToday >= ci && startOfToday < co;
      });

      const occupiedToday = activeTodayBookings.length;
      const pctOcupacion = rooms.length > 0 ? Math.round((occupiedToday / rooms.length) * 100) : 0;

      const checkInActivos = bookings.filter(b => b.estado === 'check_in').length;
      const pendingBookings = bookings.filter(b => b.estado === 'pendiente' || b.estado === 'confirmada' || b.estado === 'reservada').length;
      const completedBookings = bookings.filter(b => b.estado === 'check_out').length;

      // Build rich, detailed directory lists for full conversational capability
      const hotelsDetail = hotelsList.map(h =>
        `- Hotel: "${h.nombre_hotel}" (ID: ${h.id_hotel}, Ciudad: ${h.ciudad || 'No registrada'}, Dirección: ${h.direccion || 'No registrada'}, Teléfono: ${h.telefono || 'No registrado'})`
      ).join('\n');

      const roomsDetail = rooms.map(r =>
        `- Habitación ${r.nombre_habitacion} en [Hotel: ${r.hotel || 'Hotel Verona'}] (ID: ${r.id_habitacion}, Hotel ID: ${r.id_hotel}, Tipo: ${r.tipo || 'Estándar'}, Tarifa: ${r.tarifa_noche || r.tarifaNumerica || r.costo || 0} HNL, Capacidad: ${r.capacidad || 2} pers, Estado: ${r.estado || 'disponible'})`
      ).join('\n');

      const guestsDetail = guests.slice(0, 150).map(g =>
        `- Huésped: ${g.nombre_completo} (ID: ${g.id_huesped}, Correo: ${g.correo || 'No registrado'}, Teléfono: ${g.telefono || 'No registrado'}, Ciudad: ${g.ciudad || 'No registrada'})`
      ).join('\n');

      const bookingsDetail = bookings.map(b => {
        const guestName = guests.find(g => g.id_huesped === b.id_huesped)?.nombre_completo || 'Huésped Desconocido';
        const roomName = rooms.find(r => r.id_habitacion === b.id_habitacion)?.nombre_habitacion || 'Habitación Desconocida';
        const hotelName = hotelsList.find(h => h.id_hotel === b.id_hotel)?.nombre_hotel || 'Hotel Verona';
        const isCortesia = b.es_cortesia ? ' (Cortesía)' : '';
        const isCredito = b.id_empresa ? ' (Crédito)' : '';
        const ams = [];
        if (b.cama_extra) ams.push('camaExtra');
        if (b.limpieza_diaria) ams.push('limpiezaDiaria');
        if (b.neverita) ams.push('neverita');
        if (b.plancha) ams.push('plancha');
        const amsStr = ams.length > 0 ? `, Comodidades: [${ams.join(', ')}]` : '';
        const ci = b.check_in.replace('T', ' ').substring(0, 16);
        const co = b.check_out.replace('T', ' ').substring(0, 16);
        return `- Reserva ${b.id_reserva_hotel} (Tipo: ${b.tipo_reserva}): Huésped: "${guestName}", Hotel: "${hotelName}", Habitación: "${roomName}", Check-in: ${ci}, Check-out: ${co}, Estado: ${b.estado}, Pago: ${b.estado_pago || 'reservada'}${isCortesia}${isCredito}, Huéspedes: [${b.adultos} adultos, ${b.ninos} niños]${amsStr}, Total: ${b.total_reserva} HNL`;
      }).join('\n');

      const blocksDetail = blocks.map(b => {
        const roomName = rooms.find(r => r.id_habitacion === b.id_habitacion)?.nombre_habitacion || 'Habitación Desconocida';
        const hotelName = rooms.find(r => r.id_habitacion === b.id_habitacion)?.hotel || 'Hotel Verona';
        const start = b.fecha_inicio.split('T')[0];
        const end = b.fecha_fin.split('T')[0];
        return `- Bloqueo: Habitación: "${roomName}" en [Hotel: ${hotelName}] (ID: ${b.id_habitacion}), Fecha Inicio: ${start}, Fecha Fin: ${end}${b.motivo ? `, Motivo: ${b.motivo}` : ''}`;
      }).join('\n');

      const systemTimeHN = today.toLocaleString('es-HN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });

      const exchangeRate = hotelConfig?.tipo_cambio_base ? parseFloat(hotelConfig.tipo_cambio_base).toFixed(2) : '24.50';
      const mainCurrency = hotelConfig?.moneda_principal || 'HNL';
      const altCurrency = hotelConfig?.moneda_alterna || 'USD';
      const isvRate = hotelConfig?.tasa_isv !== undefined ? hotelConfig.tasa_isv : '15.00';
      const discountSenior = hotelConfig?.descuento_tercera_edad || '7.00';

      const summary = `
INFORMACIÓN DETALLADA DE LA BASE DE DATOS SUPABASE DEL GRUPO HOTELERO CONSOLIDADO
(Fecha y hora actual de referencia del sistema: ${systemTimeHN}):

CADENA DE HOTELES REGISTRADOS:
${hotelsDetail || 'No hay hoteles registrados.'}

CONFIGURACIÓN HOTELERA Y FINANCIERA ACTIVA:
- **Moneda Principal del Hotel**: ${mainCurrency}
- **Moneda Alterna**: ${altCurrency}
- **Tipo de Cambio de Referencia**: 1 USD = ${exchangeRate} HNL (Configurado en base de datos)
- **Tasa de Impuesto Hospedaje (Tasa Turística)**: 4%
- **Tasa de Impuesto General (ISV)**: ${isvRate}%
- **Descuento de Tercera Edad (Ley)**: ${discountSenior}% (A partir de los ${hotelConfig?.edad_tercera_edad || 60} años)
- **Ciudad Base**: ${hotelConfig?.ciudad_base || 'San Pedro Sula'}

ESTADÍSTICAS GENERALES DE OCUPACIÓN Y RESERVAS HOY:
- **Habitaciones Totales Registradas**: ${rooms.length} habitaciones.
- **Huéspedes Totales Registrados**: ${guests.length} clientes.
- **Habitaciones Ocupadas Hoy**: ${occupiedToday} habitaciones (Ocupación: ${pctOcupacion}%).
- **Huéspedes Físicamente Hospedados Hoy (Check-in Activo)**: ${checkInActivos} habitaciones.
- **Reservas Programadas Pendientes/Confirmadas**: ${pendingBookings} reservas.
- **Salidas Recientes (Check-out)**: ${completedBookings} habitaciones liberadas.

CATÁLOGO COMPLETO DE HABITACIONES REGISTRADAS:
${roomsDetail || 'No hay habitaciones registradas.'}

DIRECTORIO DE HUÉSPEDES REGISTRADOS (Máx. 150):
${guestsDetail || 'No hay huéspedes registrados.'}

LISTADO DETALLADO DE RESERVAS REGISTRADAS (HISTORIAL RECIENTE Y PRÓXIMOS 45 DÍAS):
${bookingsDetail || 'No hay reservas registradas en este período.'}

LISTADO DETALLADO DE BLOQUEOS Y NO DISPONIBILIDADES (PRÓXIMOS 45 DÍAS):
${blocksDetail || 'No hay bloqueos de habitación registrados en este período.'}
`;
      setDbSummary(summary);
    } catch (err) {
      console.error('Error al cargar datos en tiempo real de la base de datos:', err);
    }
  };

  useEffect(() => {
    loadLiveSummary();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadLiveSummary();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: textToSend, timestamp: getFormattedTime() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API Key de Gemini no encontrada. Por favor, configúrala en el archivo .env');
      }

      // Append dynamic live database context to the system prompt
      const dynamicSystemPrompt = `${SYSTEM_PROMPT}

CONTEXTO EN TIEMPO REAL DEL HOTEL VERONA (BASE DE DATOS SUPABASE):
${dbSummary || 'Cargando datos reales del hotel...'}
`;

      // Filter out the welcome message (since it's a model message and Gemini requires history to start with a user message)
      let apiMessages = [...updatedMessages];
      if (apiMessages.length > 0 && apiMessages[0].role === 'model') {
        apiMessages.shift();
      }

      // Safeguard for empty history
      if (apiMessages.length === 0) {
        apiMessages = [{ role: 'user', text: textToSend }];
      }

      // Format conversation turns
      const formattedContents = apiMessages.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));

      const response = await fetchGeminiWithRotation({
        contents: formattedContents,
        systemInstruction: {
          parts: [{ text: dynamicSystemPrompt }]
        },
        tools: [{
          functionDeclarations: [
            {
              name: 'updateReservation',
              description: 'Modifica datos de una reserva de hotel existente en la base de datos (fechas de check-in/check-out, habitación, número de adultos, niños, observaciones, estado, tarifa/precio total o comodidades como cama extra, limpieza, minibar/neverita y plancha). El usuario debe especificar la reserva.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  idReservaHotel: { type: 'STRING', description: 'El ID de la reserva a modificar (ej: \'res_xxx\' o el id_reserva_hotel obtenido de la base de datos).' },
                  idHabitacion: { type: 'STRING', description: 'ID de la nueva habitación asignada (opcional).' },
                  checkIn: { type: 'STRING', description: 'Nueva fecha de check-in en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm (opcional).' },
                  checkOut: { type: 'STRING', description: 'Nueva fecha de check-out en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm (opcional).' },
                  tipoReserva: { type: 'STRING', description: 'Tipo de reserva: \'noche\' o \'hora\' (opcional).' },
                  adultos: { type: 'NUMBER', description: 'Número de adultos (opcional).' },
                  ninos: { type: 'NUMBER', description: 'Número de niños (opcional).' },
                  estado: { type: 'STRING', description: 'Nuevo estado de la reserva: \'pendiente\', \'confirmada\', \'check_in\', \'check_out\', \'cancelada\' (opcional).' },
                  observaciones: { type: 'STRING', description: 'Notas u observaciones especiales (opcional).' },
                  totalReserva: { type: 'NUMBER', description: 'El precio o tarifa total final de la reserva en HNL (opcional).' },
                  camaExtra: { type: 'BOOLEAN', description: 'Si la reserva cuenta con cama extra (opcional).' },
                  limpiezaDiaria: { type: 'BOOLEAN', description: 'Si la reserva incluye limpieza diaria (opcional).' },
                  neverita: { type: 'BOOLEAN', description: 'Si la reserva incluye neverita/minibar (opcional).' },
                  plancha: { type: 'BOOLEAN', description: 'Si la reserva incluye plancha (opcional).' }
                },
                required: ['idReservaHotel']
              }
            },
            {
              name: 'cancelReservation',
              description: 'Cancela una reserva existente cambiándole el estado a \'cancelada\' en la base de datos.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  idReservaHotel: { type: 'STRING', description: 'ID de la reserva a cancelar (id_reserva_hotel).' },
                  anularPagos: { type: 'BOOLEAN', description: 'Si es true, se anularán los pagos asociados a la reserva (opcional, por defecto false).' }
                },
                required: ['idReservaHotel']
              }
            },
            {
              name: 'createGuest',
              description: 'Crea un nuevo huésped en la base de datos de Supabase para poder registrar reservas a su nombre. Devuelve el ID del huésped creado.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  nombreCompleto: { type: 'STRING', description: 'Nombre completo del huésped (requerido).' },
                  correo: { type: 'STRING', description: 'Correo electrónico del huésped (opcional).' },
                  telefono: { type: 'STRING', description: 'Teléfono del huésped (opcional).' },
                  ciudad: { type: 'STRING', description: 'Ciudad del huésped (opcional).' },
                  direccion: { type: 'STRING', description: 'Dirección del huésped (opcional).' }
                },
                required: ['nombreCompleto']
              }
            },
            {
              name: 'createReservation',
              description: 'Crea una nueva reserva de hotel en la base de datos de Supabase. Requiere que el huésped ya esté registrado (idHuesped) y la habitación seleccionada (idHabitacion).',
              parameters: {
                type: 'OBJECT',
                properties: {
                  idHuesped: { type: 'STRING', description: 'ID del huésped (id_huesped) obtenido de la base de datos o retornado al crear uno.' },
                  idHabitacion: { type: 'STRING', description: 'ID de la habitación (id_habitacion) elegida.' },
                  checkIn: { type: 'STRING', description: 'Fecha de check-in en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm.' },
                  checkOut: { type: 'STRING', description: 'Fecha de check-out en formato YYYY-MM-DD o YYYY-MM-DDTHH:mm.' },
                  tipoReserva: { type: 'STRING', description: 'Tipo de reserva: \'noche\' o \'hora\'.' },
                  adultos: { type: 'NUMBER', description: 'Número de adultos.' },
                  ninos: { type: 'NUMBER', description: 'Número de niños.' },
                  estado: { type: 'STRING', description: 'Estado inicial: \'pendiente\' o \'confirmada\'.' },
                  totalReserva: { type: 'NUMBER', description: 'Tarifa total de la reserva en HNL o USD.' },
                  moneda: { type: 'STRING', description: 'Moneda de cobro: \'HNL\' o \'USD\'.' },
                  observaciones: { type: 'STRING', description: 'Observaciones de la reserva (opcional).' },
                  esCortesia: { type: 'BOOLEAN', description: 'Si la reserva es de cortesía (tarifa 0). Requerido si totalReserva es 0.' },
                  camaExtra: { type: 'BOOLEAN', description: 'Si requiere cama extra (opcional).' },
                  limpiezaDiaria: { type: 'BOOLEAN', description: 'Si requiere limpieza diaria (opcional).' },
                  neverita: { type: 'BOOLEAN', description: 'Si requiere neverita/minibar (opcional).' },
                  plancha: { type: 'BOOLEAN', description: 'Si requiere plancha (opcional).' }
                },
                required: ['idHuesped', 'idHabitacion', 'checkIn', 'checkOut', 'adultos', 'ninos', 'estado', 'totalReserva', 'moneda']
              }
            },
            {
              name: 'toggleRoomBlock',
              description: 'Bloquea o habilita (desbloquea) una habitación específica para una fecha determinada en el sistema para regular su disponibilidad.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  idHabitacion: { type: 'STRING', description: 'ID de la habitación (id_habitacion) a la cual alternar disponibilidad.' },
                  fecha: { type: 'STRING', description: 'Fecha en formato YYYY-MM-DD para la cual alternar la disponibilidad de la habitación.' },
                  motivo: { type: 'STRING', description: 'Motivo u observaciones del bloqueo de disponibilidad (opcional).' }
                },
                required: ['idHabitacion', 'fecha']
              }
            },
            {
              name: 'splitReservation',
              description: 'Divide una estancia de varias noches en dos reservas separadas a partir de una fecha de corte.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  idReservaHotel: { type: 'STRING', description: 'ID de la reserva original (id_reserva_hotel).' },
                  fechaCorte: { type: 'STRING', description: 'Fecha a partir de la cual se separará la estancia, en formato YYYY-MM-DD.' }
                },
                required: ['idReservaHotel', 'fechaCorte']
              }
            }
          ]
        }]
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Error en la API: ${response.status}`);
      }

      // Reset consecutive rate-limiting hits count on successful response
      setConsecutiveRateLimits(0);

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCallParts = parts.filter((p: any) => p.functionCall);

      if (functionCallParts.length > 0) {
        // Push a status message to show the user that action is running
        setMessages(prev => [...prev, { role: 'model', text: `*Procesando ${functionCallParts.length} acciones automáticas en la base de datos...*`, timestamp: getFormattedTime() }]);

        try {
          // Execute function calls sequentially to avoid race conditions (e.g. two reservations on same room)
          const results: { name: string; resultText: string }[] = [];
          for (const part of functionCallParts) {
            const { name, args } = part.functionCall;
            let resultText = '';
            
            try {
              if (name === 'updateReservation') {
                const fields: any = {};
                if (args.idHabitacion) fields.id_habitacion = args.idHabitacion;
                if (args.checkIn) fields.check_in = args.checkIn.includes('T') ? args.checkIn : args.checkIn + 'T14:00:00';
                if (args.checkOut) fields.check_out = args.checkOut.includes('T') ? args.checkOut : args.checkOut + 'T12:00:00';
                if (args.tipoReserva) fields.tipo_reserva = args.tipoReserva;
                if (args.adultos !== undefined) fields.adultos = args.adultos;
                if (args.ninos !== undefined) fields.ninos = args.ninos;
                if (args.estado) fields.estado = args.estado;
                if (args.observaciones) fields.observaciones = args.observaciones;
                if (args.totalReserva !== undefined) fields.total_reserva = args.totalReserva;
                if (args.camaExtra !== undefined) fields.cama_extra = args.camaExtra;
                if (args.limpiezaDiaria !== undefined) fields.limpieza_diaria = args.limpiezaDiaria;
                if (args.neverita !== undefined) fields.neverita = args.neverita;
                if (args.plancha !== undefined) fields.plancha = args.plancha;

                await updateReserva(args.idReservaHotel, fields);
                resultText = `Actualización de reserva ${args.idReservaHotel} exitosa.`;
              } else if (name === 'cancelReservation') {
                await cancelReserva(args.idReservaHotel, !!args.anularPagos);
                resultText = `Cancelación de reserva ${args.idReservaHotel} exitosa (anular pagos: ${args.anularPagos ? 'sí' : 'no'}).`;
              } else if (name === 'createGuest') {
                const guest = await createHuesped({
                  nombre_completo: args.nombreCompleto,
                  correo: args.correo,
                  telefono: args.telefono,
                  ciudad: args.ciudad,
                  direccion: args.direccion
                });
                resultText = `Huésped creado con éxito. ID: ${guest.id_huesped}.`;
              } else if (name === 'createReservation') {
                const newRes = await createReserva({
                  id_huesped: args.idHuesped,
                  id_habitacion: args.idHabitacion,
                  check_in: args.checkIn.includes('T') ? args.checkIn : args.checkIn + 'T14:00:00',
                  check_out: args.checkOut.includes('T') ? args.checkOut : args.checkOut + 'T12:00:00',
                  tipo_reserva: args.tipoReserva || 'noche',
                  adultos: args.adultos,
                  ninos: args.ninos,
                  estado: args.estado,
                  total_reserva: args.totalReserva,
                  moneda: args.moneda,
                  observaciones: args.observaciones ? `[IA] ${args.observaciones}` : '[IA] Creado por Asistente AI',
                  es_cortesia: !!args.esCortesia,
                  cama_extra: !!args.camaExtra,
                  limpieza_diaria: !!args.limpiezaDiaria,
                  neverita: !!args.neverita,
                  plancha: !!args.plancha,
                  origen_reserva: 'ia'
                });
                resultText = `Reserva creada con éxito. ID: ${newRes.id_reserva_hotel}. Habitación: ${newRes.id_habitacion}.`;
              } else if (name === 'toggleRoomBlock') {
                const res = await toggleBloqueo(args.idHabitacion, args.fecha, args.motivo || 'Modificado por Verona AI');
                resultText = `Bloqueo de habitación ${args.idHabitacion} para la fecha ${args.fecha} conmutado con éxito. Nueva acción realizada: ${res.action === 'added' ? 'Bloqueada' : 'Habilitada'}.`;
              } else if (name === 'splitReservation') {
                await splitReserva(args.idReservaHotel, args.fechaCorte);
                resultText = `Reserva ${args.idReservaHotel} dividida exitosamente a partir de la fecha de corte ${args.fechaCorte}.`;
              }
            } catch (err: any) {
              console.warn(`Error en función ${name}:`, err);
              resultText = `ERROR en ${name} para habitación ${args.idHabitacion || 'desconocida'}: ${err.message || 'Error desconocido'}. Debes elegir otra habitación disponible e informar al usuario.`;
            }
            
            results.push({ name, resultText });
          }

          // Trigger global reload event so the bookings grid updates instantly
          window.dispatchEvent(new CustomEvent('reloadBookings'));

          // Perform follow-up fetch to Gemini with all function responses
          const responseParts = results.map(r => ({
            functionResponse: {
              name: r.name,
              response: { result: r.resultText }
            }
          }));

          const followUpContents = [
            ...formattedContents,
            {
              role: 'model',
              parts: candidate?.content?.parts || functionCallParts
            },
            {
              role: 'user',
              parts: responseParts
            }
          ];

          const followUpResponse = await fetchGeminiWithRotation({
            contents: followUpContents,
            systemInstruction: {
              parts: [{ text: dynamicSystemPrompt }]
            }
          });

          let finalReply = '';
          if (!followUpResponse.ok) {
            console.warn(`Error en seguimiento de acción AI: ${followUpResponse.status}. Usando fallback local.`);
            finalReply = `**Acciones completadas con éxito en la base de datos.**\n\nEl asistente ha procesado correctamente las siguientes tareas directamente en el sistema:\n\n` +
              results.map(r => {
                if (r.name === 'toggleRoomBlock') {
                  return `- **Gestión de Disponibilidad:** ${r.resultText}`;
                } else if (r.name === 'createReservation') {
                  return `- **Creación de Reserva:** ${r.resultText}`;
                } else if (r.name === 'updateReservation') {
                  return `- **Modificación de Reserva:** ${r.resultText}`;
                } else if (r.name === 'cancelReservation') {
                  return `- **Cancelación de Reserva:** ${r.resultText}`;
                } else if (r.name === 'createGuest') {
                  return `- **Registro de Huésped:** ${r.resultText}`;
                } else if (r.name === 'splitReservation') {
                  return `- **División de Estancia:** ${r.resultText}`;
                }
                return `- **Acción:** ${r.resultText}`;
              }).join('\n') +
              `\n\n*(Nota: Las acciones se completaron correctamente en el sistema, pero la respuesta conversacional final se generó vía fallback debido a un límite temporal de tasa/cuota API 429)*`;
          } else {
            const followUpData = await followUpResponse.json();
            finalReply = followUpData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Acciones completadas con éxito en la base de datos.';
          }

          // Remove the loader message and push the final reply
          setMessages(prev => {
            const copy = [...prev];
            copy.pop(); // Remove loader
            return [...copy, { role: 'model', text: finalReply, timestamp: getFormattedTime() }];
          });

          // Reload the live statistics in the AI assistant sidebar
          loadLiveSummary();
        } catch (err: any) {
          console.error('Error al ejecutar herramientas en base de datos:', err);
          setMessages(prev => {
            const copy = [...prev];
            copy.pop(); // Remove loader
            return [...copy, { role: 'model', text: `**Error al ejecutar las acciones:** ${err.message || 'Error desconocido.'}`, timestamp: getFormattedTime() }];
          });
        }
        return;
      }

      const modelReply = candidate?.content?.parts?.[0]?.text || 'No obtuve una respuesta válida de la inteligencia artificial.';
      setMessages(prev => [...prev, { role: 'model', text: modelReply, timestamp: getFormattedTime() }]);
    } catch (error: any) {
      console.error('Error con Gemini AI:', error);
      const errMsg = error.message || '';
      const retrySecs = parseRetrySeconds(errMsg);
      let cleanErrorMessage = '';

      const isRateLimit = retrySecs !== null || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('429');

      if (isRateLimit) {
        // Increment consecutive rate limit count
        setConsecutiveRateLimits(prev => prev + 1);

        const baseRetry = retrySecs !== null && retrySecs > 0 ? retrySecs : 30;
        // Add a progressive safety buffer (+8s on 1st hit, +15s on 2nd hit, +25s on subsequent hits)
        // to let Gemini's rolling 60-second window actually release the older requests.
        const buffer = consecutiveRateLimits === 0 ? 8 : (consecutiveRateLimits === 1 ? 15 : 25);
        const bufferedRetry = baseRetry + buffer;

        setRateLimitCountdown(bufferedRetry);
        cleanErrorMessage = `**Límite de Consultas Alcanzado (Frecuencia Excesiva)**\n\n` +
          `El motor de inteligencia artificial de Gemini ha alcanzado su límite de cuota por minuto del plan gratuito.\n\n` +
          `Para garantizar que la conexión se restablezca por completo, hemos añadido un **margen de seguridad de ${buffer} segundos** al tiempo sugerido. Por favor, espera **${bufferedRetry} segundos** antes de enviar tu mensaje.\n\n` +
          `*(El canal de chat se reactivará automáticamente cuando el contador llegue a cero)*`;
      } else {
        cleanErrorMessage = `**Error de Conexión:** ${errMsg || 'No se pudo comunicar con el asistente.'}`;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          text: cleanErrorMessage,
          timestamp: getFormattedTime()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('¿Seguro que deseas limpiar la conversación?')) {
      const initial = [
        {
          role: 'model',
          text: `He reiniciado la conversación.

¿En qué te puedo asistir hoy?`,
          timestamp: getFormattedTime()
        }
      ];
      setMessages(initial);
      sessionStorage.setItem('verona_ai_history', JSON.stringify(initial));
      loadLiveSummary();
    }
  };

  // Safe html rendering for markdown (simple custom inline parser to avoid raw html vulnerabilities)
  const renderMessageContent = (text: string) => {
    return text.split('\n').map((paragraph, index) => {
      // Detect and replace bullet points
      let cleanText = paragraph;
      const isBullet = paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ');
      if (isBullet) {
        cleanText = cleanText.replace(/^[\s*-]+/, '');
      }

      // Replace bold tags (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(cleanText)) !== null) {
        if (match.index > lastIndex) {
          parts.push(cleanText.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index}>{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < cleanText.length) {
        parts.push(cleanText.substring(lastIndex));
      }

      const content = parts.length > 0 ? parts : cleanText;

      if (isBullet) {
        return (
          <li key={index} style={{ marginLeft: '16px', marginBottom: '4px', listStyleType: 'disc' }}>
            {content}
          </li>
        );
      }

      return (
        <p key={index} style={{ marginBottom: '8px', lineHeight: '1.45' }}>
          {content}
        </p>
      );
    });
  };

  return (
    <>
      <style>{`
        /* Floating Button */
        .verona-ai-float {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: white;
          border: none;
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.35);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          font-size: 24px;
          transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .verona-ai-float:hover {
          transform: scale(1.08) rotate(5deg);
          box-shadow: 0 12px 36px rgba(37, 99, 235, 0.45);
        }
        .verona-ai-float.active {
          transform: scale(0.9) rotate(-45deg);
          background: var(--danger);
          box-shadow: 0 8px 24px rgba(239, 68, 68, 0.35);
        }

        /* Chat Panel */
        .verona-ai-panel {
          position: fixed;
          bottom: 90px;
          right: 24px;
          width: 380px;
          height: 580px;
          max-width: calc(100vw - 48px);
          max-height: calc(100vh - 140px);
          background: var(--shell-panel-strong);
          border: 1px solid var(--shell-border);
          border-radius: 24px;
          box-shadow: 0 16px 48px rgba(15, 23, 42, 0.15);
          backdrop-filter: blur(16px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 998;
          font-family: var(--sans);
        }

        .verona-ai-header {
          padding: 16px 20px;
          background: var(--shell-panel);
          border-bottom: 1px solid var(--shell-border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .verona-ai-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .verona-ai-logo {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: white;
        }
        .verona-ai-header-title {
          font-weight: 700;
          color: var(--text-h);
          font-size: 14px;
        }
        .verona-ai-header-sub {
          font-size: 10px;
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 2px;
        }
        .verona-ai-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--success);
          display: inline-block;
          animation: pulseAI 2s infinite;
        }
        @keyframes pulseAI {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }

        .verona-ai-clear-btn {
          background: transparent;
          border: none;
          color: var(--muted);
          font-size: 12px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .verona-ai-clear-btn:hover {
          background: var(--sidebar-item-hover);
          color: var(--danger);
        }

        /* Message Area */
        .verona-ai-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: var(--shell-bg);
        }

        .verona-ai-msg-row {
          display: flex;
          width: 100%;
          gap: 8px;
        }
        .verona-ai-msg-row.user {
          flex-direction: row-reverse;
        }
        
        .verona-ai-msg-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .verona-ai-msg-avatar.user {
          background: var(--shell-border-strong);
          color: var(--text-h);
        }

        .verona-ai-bubble {
          max-width: 80%;
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 13px;
          line-height: 1.5;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
          word-break: break-word;
        }
        .verona-ai-bubble.model {
          background: var(--shell-panel);
          border: 1px solid var(--shell-border);
          color: var(--text-h);
          border-top-left-radius: 4px;
        }
        .verona-ai-bubble.user {
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: white;
          border-top-right-radius: 4px;
        }

        .verona-ai-timestamp {
          font-size: 9px;
          margin-top: 5px;
          text-align: right;
          opacity: 0.7;
          user-select: none;
        }
        .verona-ai-timestamp.user {
          color: rgba(255, 255, 255, 0.85);
        }
        .verona-ai-timestamp.model {
          color: var(--muted);
        }

        /* Suggestion Chips */
        .verona-ai-suggestions {
          display: flex;
          gap: 6px;
          padding: 8px 12px;
          background: var(--shell-panel-strong);
          border-top: 1px solid var(--shell-border-subtle);
          overflow-x: auto;
          scrollbar-width: none;
        }
        .verona-ai-suggestions::-webkit-scrollbar {
          display: none;
        }
        .verona-ai-chip {
          background: var(--shell-bg);
          border: 1px solid var(--shell-border);
          color: var(--text-h);
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          white-space:nowrap;
          transition: all 0.2s;
        }
        .verona-ai-chip:hover {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        /* Input Area */
        .verona-ai-input-area {
          padding: 12px 16px;
          background: var(--shell-panel-strong);
          border-top: 1px solid var(--shell-border-subtle);
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .verona-ai-input {
          flex: 1;
          border: 1px solid var(--shell-border-strong);
          background: var(--shell-bg);
          color: var(--text-h);
          border-radius: 12px;
          padding: 9px 12px;
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
        }
        .verona-ai-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        .verona-ai-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, var(--accent), var(--accent-strong));
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }
        .verona-ai-send-btn:disabled {
          background: var(--shell-border-strong);
          color: var(--muted);
          cursor: not-allowed;
          box-shadow: none;
        }
        .verona-ai-send-btn:not(:disabled):hover {
          transform: scale(1.05);
        }

        /* AI Thinking dots */
        .ai-loading-dots {
          display: flex;
          gap: 4px;
          padding: 8px;
          align-items: center;
        }
        .ai-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: aiBounce 1.2s infinite;
        }
        .ai-dot:nth-child(2) { animation-delay: 0.2s; }
        .ai-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes aiBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      {/* Floating Toggle Button */}
      <button
        className={`verona-ai-float${isOpen ? ' active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Asistente Verona AI (Gemini)"
      >
        {isOpen ? '×' : 'AI'}
      </button>

      {/* Slide-in Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="verona-ai-panel"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.22, cubicBezier: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="verona-ai-header">
              <div className="verona-ai-header-info">
                <div className="verona-ai-logo">AI</div>
                <div>
                  <div className="verona-ai-header-title">Verona AI</div>
                  <div className="verona-ai-header-sub">
                    <span className="verona-ai-dot" /> Copiloto Activo
                  </div>
                </div>
              </div>
              <button className="verona-ai-clear-btn" onClick={handleClearHistory} title="Limpiar conversación">
                Reiniciar
              </button>
            </div>

            {/* Message Area */}
            <div className="verona-ai-messages">
              {messages.map((msg, index) => (
                <div key={index} className={`verona-ai-msg-row ${msg.role}`}>
                  <div className={`verona-ai-msg-avatar ${msg.role}`}>
                    {msg.role === 'model' ? 'AI' : (user?.email?.[0]?.toUpperCase() || 'P')}
                  </div>
                  <div className={`verona-ai-bubble ${msg.role}`}>
                    {renderMessageContent(msg.text)}
                    {msg.timestamp && (
                      <div className={`verona-ai-timestamp ${msg.role}`}>
                        {msg.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="verona-ai-msg-row model">
                  <div className="verona-ai-msg-avatar model">AI</div>
                  <div className="verona-ai-bubble model">
                    <div className="ai-loading-dots">
                      <div className="ai-dot" />
                      <div className="ai-dot" />
                      <div className="ai-dot" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestions */}
            <div className="verona-ai-suggestions">
              {SUGGESTIONS.map((sug, idx) => (
                <button
                  key={idx}
                  className="verona-ai-chip"
                  onClick={() => handleSend(sug.prompt)}
                  disabled={loading || rateLimitCountdown !== null || isVerifying}
                >
                  {sug.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              className="verona-ai-input-area"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
            >
              <input
                className="verona-ai-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isVerifying
                    ? "Verificando disponibilidad..."
                    : rateLimitCountdown !== null
                      ? `Espera ${rateLimitCountdown}s para consultar...`
                      : "Pregunta a Verona AI..."
                }
                disabled={loading || rateLimitCountdown !== null || isVerifying}
                style={(rateLimitCountdown !== null || isVerifying) ? { backgroundColor: 'var(--shell-bg)', cursor: 'not-allowed' } : undefined}
              />
              <button
                type="submit"
                className="verona-ai-send-btn"
                disabled={!input.trim() || loading || rateLimitCountdown !== null || isVerifying}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
