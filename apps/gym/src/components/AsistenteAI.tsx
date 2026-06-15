import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { fetchMiembros, crearMiembro } from '../api/miembrosService';
import type { Miembro } from '../api/miembrosService';
import { fetchPlanes, fetchInscripciones, crearInscripcion } from '../api/membresiaService';
import type { PlanMembresia, InscripcionGym } from '../api/membresiaService';
import { fetchClases, crearClase, fetchEntrenadores } from '../api/clasesService';
import type { ClaseGym, Entrenador } from '../api/clasesService';
import { registrarPago } from '../api/pagosService';
import type { PagoGym } from '../api/pagosService';
import { fetchDashboardKPIs } from '../api/dashboardService';
import type { DashboardKPIs } from '../api/dashboardService';

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
  hr = hr ? hr : 12;
  return `${hr}:${min} ${ampm}`;
};

const SYSTEM_PROMPT = `Eres 'Apolo', el copiloto inteligente de inteligencia artificial exclusivo para el personal administrativo de nuestro gimnasio Solaris.

Tu propósito es asistir a entrenadores, recepcionistas y administradores en la gestión diaria del gimnasio, tales como:
1. **Atención y Políticas del Gimnasio**:
   - Acceso: Los miembros deben registrar su entrada/asistencia.
   - Duración de Clases: Usualmente de 50 a 60 minutos.
   - Inscripciones: Se debe registrar el plan correcto para habilitar el acceso.
   - Pagos: Los pagos se asocian a una inscripción específica.
2. **Cálculos Financieros**:
   - Total del Plan: Debe coincidir con el precio configurado del plan elegido.
   - Fecha de Vencimiento: Se calcula sumando la duración en días del plan ('duracion_dias') a la fecha de inicio.
3. **Creación y Gestión de Miembros e Inscripciones**: Tienes la capacidad total de crear nuevos miembros, inscribirlos a planes vigentes, registrar pagos correspondientes, y programar nuevas clases en la base de datos de Supabase si el usuario te lo solicita explícitamente.
4. **Resumen y KPIs**: Puedes analizar el estado del gimnasio (miembros activos, aforo actual, clases programadas, ingresos) utilizando los datos en tiempo real que te proporcionamos.

REGLAS DE NEGOCIO Y OPERACIÓN:
1. Responde siempre en español.
2. Mantén un tono sumamente enérgico, profesional, ejecutivo y servicial (acorde a la marca de fitness premium Solaris).
3. Utiliza formato markdown (negritas, listas, saltos de línea) para que las respuestas sean extremadamente legibles.
4. Usa los datos reales de la base de datos que se te proporcionan a continuación para responder preguntas sobre aforo, cantidad de miembros, etc. de manera precisa.
5. **REGLA DE ORO DE ACCIONES Y FALLOS**: Si el usuario te pide registrar un miembro, inscribir a alguien a un plan, registrar un pago o crear una clase, **debes generar obligatoriamente la llamada de función correspondiente** (ej: 'createMember', 'createInscription', 'registerPayment', 'createClass'). **NUNCA** le digas al usuario que realizaste la acción si no has emitido la llamada a la herramienta.
6. **Inscripciones Inteligentes**: Para crear una inscripción (utilizando 'createInscription'), primero busca el miembro en el directorio. Si no existe, avísale al usuario que debes registrarlo primero o pídele los datos de miembro. Calcula de forma precisa la fecha de fin sumando la duración del plan a la fecha de inicio (formato YYYY-MM-DD). La fecha de inicio por defecto debe ser la fecha actual del sistema si el usuario no especifica otra.
7. **Manejo de Pagos**: Cuando el usuario pida registrar un pago para una inscripción, debes requerir el ID de la inscripción (puedes buscarlo en el historial de inscripciones del miembro) y el monto. Llama a 'registerPayment'.

EXPLICACIÓN DE LAS HERRAMIENTAS:
- 'createMember': Registra un miembro con su nombre, correo, teléfono, etc.
- 'createInscription': Inscribe un miembro a un plan. REQUIERE que calcules la fecha_inicio, fecha_fin (fecha_inicio + duracion_dias del plan) y total (precio del plan).
- 'registerPayment': Registra un pago de efectivo/tarjeta/transferencia para una inscripción.
- 'createClass': Crea una clase de gimnasio programada en un día específico con hora de inicio/fin y capacidad.
`;

const SUGGESTIONS = [
  { label: 'Estado del Gym', prompt: 'Dame un resumen ejecutivo analítico del estado actual del gimnasio con base en los datos del sistema.' },
  { label: 'Planes Activos', prompt: '¿Cuáles son los planes de membresía vigentes y sus tarifas?' },
  { label: 'Miembros e Inscripciones', prompt: 'Muéstrame los últimos miembros registrados y si tienen membresía activa.' },
  { label: 'Próximos Vencimientos', prompt: '¿Qué miembros tienen inscripciones prontas a vencer este mes?' }
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

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
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
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
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

export const AsistenteAI: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(embedded ? true : false);
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

  const keysPool = useMemo(() => {
    const rawVal = import.meta.env.VITE_GEMINI_API_KEY || '';
    return rawVal.split(',').map((k: string) => k.trim()).filter(Boolean);
  }, []);

  const verifyGeminiAvailability = async (): Promise<boolean> => {
    if (keysPool.length === 0) return false;
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

      if (keysPool.length > 1) {
        const nextIndex = (activeKeyIndex + 1) % keysPool.length;
        setActiveKeyIndex(nextIndex);
        console.log(`[Apolo AI] Key #${activeKeyIndex + 1} bloqueada. Rotando a Key #${nextIndex + 1}...`);
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
        setRateLimitCountdown(null);
        setVerificationRetries(0);
        console.warn('Gemini availability verification failed 3 times. Forcing chat unlock.');
      } else {
        setRateLimitCountdown(5);
      }
    }
  };

  const fetchGeminiWithRotation = async (bodyObj: any, attempt = 0): Promise<Response> => {
    if (keysPool.length === 0) {
      throw new Error('API Key de Gemini no encontrada. Por favor, configúrala en el archivo .env');
    }
    const targetIndex = (activeKeyIndex + attempt) % keysPool.length;
    const apiKey = keysPool[targetIndex];

    console.log(`[Apolo AI] Enviando consulta con Key #${targetIndex + 1} de ${keysPool.length}...`);

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
          console.warn(`[Apolo AI] Key #${targetIndex + 1} agotada por cuota. Rotando a la siguiente clave...`);
          setActiveKeyIndex((targetIndex + 1) % keysPool.length);
          return fetchGeminiWithRotation(bodyObj, attempt + 1);
        }
        throw new Error(errMsg);
      }

      setActiveKeyIndex(targetIndex);
      return response;
    } catch (error: any) {
      const errMsg = error.message || '';
      const isRateLimit = errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('429');

      if (isRateLimit && attempt < keysPool.length - 1) {
        console.warn(`[Apolo AI] Error de cuota con Key #${targetIndex + 1}. Rotando...`);
        setActiveKeyIndex((targetIndex + 1) % keysPool.length);
        return fetchGeminiWithRotation(bodyObj, attempt + 1);
      }
      throw error;
    }
  };

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
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitCountdown]);

  useEffect(() => {
    const saved = sessionStorage.getItem('apolo_ai_history');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
    } else {
      setMessages([
        {
          role: 'model',
          text: `Hola. Soy **Apolo**, tu copiloto inteligente de soporte conectado a la base de datos de Solaris Gym en tiempo real.

¿En qué te puedo asistir hoy? Puedo ayudarte a:
- **Registrar nuevos miembros** en el sistema.
- **Crear inscripciones** a planes de membresía activos.
- **Registrar pagos** de cuotas de tus clientes.
- **Programar nuevas clases** y asignarlas a entrenadores.
- Analizar el estado de aforo, ingresos, y vencimientos.`,
          timestamp: getFormattedTime()
        }
      ]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('apolo_ai_history', JSON.stringify(messages));
    }
  }, [messages]);

  const loadLiveSummary = async () => {
    try {
      const [kpis, members, planes, inscriptions, classes, trainers] = await Promise.all([
        fetchDashboardKPIs().catch(() => null),
        fetchMiembros().catch(() => []),
        fetchPlanes().catch(() => []),
        fetchInscripciones().catch(() => []),
        fetchClases().catch(() => []),
        fetchEntrenadores().catch(() => [])
      ]);

      const today = new Date();
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

      const membersDetail = (members || []).slice(0, 100).map((m: Miembro) =>
        `- Miembro: ${m.nombre_completo} (ID: ${m.id_miembro}, Correo: ${m.correo || 'N/A'}, Teléfono: ${m.telefono || 'N/A'}, Estado: ${m.estado})`
      ).join('\n');

      const planesDetail = (planes || []).map((p: PlanMembresia) =>
        `- Plan: "${p.nombre}" (ID: ${p.id_plan}, Precio: ${p.precio} HNL, Duración: ${p.duracion_dias} días, Acceso Clases: ${p.acceso_clases ? 'Sí' : 'No'}, Acceso Gym: ${p.acceso_gym ? 'Sí' : 'No'})`
      ).join('\n');

      const inscriptionsDetail = (inscriptions || []).slice(0, 50).map((i: InscripcionGym) => {
        const memberName = i.miembros?.nombre_completo || 'Desconocido';
        const planName = i.planes_membresia?.nombre || 'N/A';
        return `- Inscripción ID: ${i.id_inscripcion}, Miembro: ${memberName} (ID miembro: ${i.id_miembro}), Plan: "${planName}" (ID plan: ${i.id_plan}), Inicio: ${i.fecha_inicio}, Fin: ${i.fecha_fin}, Estado: ${i.estado}, Pago: ${i.estado_pago}, Total: ${i.total} HNL`;
      }).join('\n');

      const classesDetail = (classes || []).map((c: ClaseGym) => {
        const trainerName = c.entrenadores?.nombre_completo || 'Sin entrenador';
        return `- Clase: "${c.nombre_clase}" (ID: ${c.id_clase}), Entrenador: ${trainerName} (ID: ${c.id_entrenador || 'N/A'}), Día: ${c.dia_semana}, Hora: ${c.hora_inicio} a ${c.hora_fin}, Capacidad: ${c.capacidad_maxima}, Activa: ${c.activa ? 'Sí' : 'No'}`;
      }).join('\n');

      const trainersDetail = (trainers || []).map((t: Entrenador) =>
        `- Entrenador: ${t.nombre_completo} (ID: ${t.id_entrenador}, Especialidad: ${t.especialidad || 'N/A'}, Estado: ${t.estado})`
      ).join('\n');

      const summary = `
INFORMACIÓN DETALLADA DE LA BASE DE DATOS SUPABASE DEL GIMNASIO (SOLARIS GYM):
(Fecha y hora actual de referencia del sistema: ${systemTimeHN}):

KPIs DEL DASHBOARD ACTUAL:
- **Total Miembros**: ${kpis?.totalMiembros ?? 0}
- **Miembros Activos**: ${kpis?.miembrosActivos ?? 0}
- **Inscripciones Activas**: ${kpis?.inscripcionesActivas ?? 0}
- **Inscripciones que Vencen este Mes**: ${kpis?.vencenEsteMes ?? 0}
- **Ingresos de este Mes**: ${kpis?.ingresosMes ?? 0} HNL
- **Clases Programadas Hoy**: ${kpis?.clasesHoy ?? 0}
- **Nuevos Miembros esta Semana**: ${kpis?.nuevosEstaSemana ?? 0}

PLANES DE MEMBRESÍA VIGENTES:
${planesDetail || 'No hay planes registrados.'}

ENTRENADORES REGISTRADOS:
${trainersDetail || 'No hay entrenadores registrados.'}

CLASES PROGRAMADAS EN EL GIMNASIO:
${classesDetail || 'No hay clases programadas.'}

DIRECTORIO DE MIEMBROS RECIENTES:
${membersDetail || 'No hay miembros registrados.'}

INSCIPCIONES RECIENTES Y ACTIVAS (Máx 50):
${inscriptionsDetail || 'No hay inscripciones registradas.'}
`;
      setDbSummary(summary);
    } catch (err) {
      console.error('Error al cargar datos reales de Solaris Gym:', err);
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

      const dynamicSystemPrompt = `${SYSTEM_PROMPT}

CONTEXTO EN TIEMPO REAL DE SOLARIS GYM (BASE DE DATOS SUPABASE):
${dbSummary || 'Cargando datos reales del gimnasio...'}
`;

      let apiMessages = [...updatedMessages];
      if (apiMessages.length > 0 && apiMessages[0].role === 'model') {
        apiMessages.shift();
      }
      if (apiMessages.length === 0) {
        apiMessages = [{ role: 'user', text: textToSend }];
      }

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
              name: 'createMember',
              description: 'Registra un nuevo miembro en la base de datos de Solaris Gym.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  nombre_completo: { type: 'STRING', description: 'Nombre completo del miembro (requerido).' },
                  correo: { type: 'STRING', description: 'Correo electrónico del miembro (requerido).' },
                  telefono: { type: 'STRING', description: 'Teléfono de contacto (opcional).' },
                  documento_identidad: { type: 'STRING', description: 'Documento nacional de identidad (opcional).' },
                  genero: { type: 'STRING', enum: ['masculino', 'femenino', 'otro'], description: 'Género (opcional).' },
                  direccion: { type: 'STRING', description: 'Dirección física (opcional).' },
                  contacto_emergencia: { type: 'STRING', description: 'Nombre de contacto de emergencia (opcional).' },
                  telefono_emergencia: { type: 'STRING', description: 'Teléfono del contacto de emergencia (opcional).' },
                  observaciones: { type: 'STRING', description: 'Observaciones de salud o físicas (opcional).' }
                },
                required: ['nombre_completo', 'correo']
              }
            },
            {
              name: 'createInscription',
              description: 'Inscribe a un miembro existente en un plan de membresía. Requiere calcular la fecha de inicio, fecha de fin y el total final.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  id_miembro: { type: 'STRING', description: 'El ID del miembro a inscribir (id_miembro).' },
                  id_plan: { type: 'STRING', description: 'El ID del plan de membresía seleccionado (id_plan).' },
                  fecha_inicio: { type: 'STRING', description: 'Fecha de inicio de la membresía en formato YYYY-MM-DD.' },
                  fecha_fin: { type: 'STRING', description: 'Fecha de vencimiento calculada sumando duracion_dias del plan en formato YYYY-MM-DD.' },
                  total: { type: 'NUMBER', description: 'El importe total del plan en HNL.' },
                  anticipo: { type: 'NUMBER', description: 'Monto pagado como anticipo si aplica (opcional, por defecto 0).' },
                  notas: { type: 'STRING', description: 'Notas u observaciones de la inscripción (opcional).' }
                },
                required: ['id_miembro', 'id_plan', 'fecha_inicio', 'fecha_fin', 'total']
              }
            },
            {
              name: 'registerPayment',
              description: 'Registra un pago para una inscripción activa.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  id_inscripcion: { type: 'STRING', description: 'El ID de la inscripción a la cual aplicar el pago (id_inscripcion).' },
                  monto: { type: 'NUMBER', description: 'Monto en HNL a pagar (debe ser mayor a 0).' },
                  metodo_pago: { type: 'STRING', enum: ['efectivo', 'tarjeta', 'transferencia', 'deposito', 'otro'], description: 'Método de pago utilizado.' },
                  referencia: { type: 'STRING', description: 'Número de referencia bancaria o transacción (opcional).' },
                  notas: { type: 'STRING', description: 'Notas del pago (opcional).' }
                },
                required: ['id_inscripcion', 'monto', 'metodo_pago']
              }
            },
            {
              name: 'createClass',
              description: 'Programa una nueva clase de fitness en el gimnasio.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  nombre_clase: { type: 'STRING', description: 'Nombre de la clase (ej: Spinning, Crossfit, Zumba).' },
                  descripcion: { type: 'STRING', description: 'Breve descripción de la clase (opcional).' },
                  dia_semana: { type: 'STRING', enum: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'], description: 'Día de la semana programado.' },
                  hora_inicio: { type: 'STRING', description: 'Hora de inicio en formato HH:MM (ej: 08:00).' },
                  hora_fin: { type: 'STRING', description: 'Hora de finalización en formato HH:MM (ej: 09:00).' },
                  capacidad_maxima: { type: 'NUMBER', description: 'Capacidad máxima de alumnos (opcional, por defecto 20).' },
                  id_entrenador: { type: 'STRING', description: 'ID del entrenador asignado (opcional).' }
                },
                required: ['nombre_clase', 'dia_semana', 'hora_inicio', 'hora_fin']
              }
            }
          ]
        }]
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Error en la API: ${response.status}`);
      }

      setConsecutiveRateLimits(0);

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCallParts = parts.filter((p: any) => p.functionCall);

      if (functionCallParts.length > 0) {
        setMessages(prev => [...prev, { role: 'model', text: `*Procesando ${functionCallParts.length} acciones en la base de datos...*`, timestamp: getFormattedTime() }]);

        try {
          const results: { name: string; resultText: string }[] = [];
          for (const part of functionCallParts) {
            const { name, args } = part.functionCall;
            let resultText = '';

            try {
              if (name === 'createMember') {
                const member = await crearMiembro({
                  nombre_completo: args.nombre_completo,
                  correo: args.correo,
                  telefono: args.telefono || null,
                  documento_identidad: args.documento_identidad || null,
                  genero: args.genero || null,
                  direccion: args.direccion || null,
                  contacto_emergencia: args.contacto_emergencia || null,
                  telefono_emergencia: args.telefono_emergencia || null,
                  observaciones: args.observaciones || null,
                  estado: 'activo'
                });
                resultText = `Miembro registrado con éxito. ID: ${member.id_miembro}. Nombre: ${member.nombre_completo}.`;
              } else if (name === 'createInscription') {
                const inscription = await crearInscripcion({
                  id_miembro: args.id_miembro,
                  id_plan: args.id_plan,
                  fecha_inicio: args.fecha_inicio,
                  fecha_fin: args.fecha_fin,
                  total: args.total,
                  anticipo: args.anticipo || 0,
                  estado: 'activa',
                  estado_pago: (args.anticipo || 0) >= args.total ? 'pagado' : ((args.anticipo || 0) > 0 ? 'abonada' : 'deuda'),
                  notas: args.notas ? `[Apolo AI] ${args.notas}` : '[Apolo AI] Inscripción automática.'
                });
                resultText = `Inscripción creada con éxito. ID Inscripción: ${inscription.id_inscripcion}. Vence el: ${inscription.fecha_fin}.`;
              } else if (name === 'registerPayment') {
                const payment = await registrarPago({
                  id_inscripcion: args.id_inscripcion,
                  monto: args.monto,
                  metodo_pago: args.metodo_pago,
                  referencia: args.referencia || null,
                  notas: args.notas ? `[Apolo AI] ${args.notes || args.notas}` : '[Apolo AI] Pago registrado via asistente.',
                  moneda: 'HNL'
                });
                resultText = `Pago de ${args.monto} HNL registrado con éxito. ID Pago: ${payment.id_pago_gym}. Estado de pago inscripción: ${payment.inscripciones_gym?.planes_membresia?.nombre || 'aplicado'}.`;
              } else if (name === 'createClass') {
                // Ensure HH:MM:00 for postgres time
                const formatTime = (t: string) => t.length === 5 ? `${t}:00` : t;
                const clase = await crearClase({
                  nombre_clase: args.nombre_clase,
                  descripcion: args.descripcion || null,
                  dia_semana: args.dia_semana,
                  hora_inicio: formatTime(args.hora_inicio),
                  hora_fin: formatTime(args.hora_fin),
                  capacidad_maxima: args.capacidad_maxima || 20,
                  id_entrenador: args.id_entrenador || null,
                  activa: true
                });
                resultText = `Clase de "${clase.nombre_clase}" programada con éxito para el día ${clase.dia_semana} (${clase.hora_inicio} - ${clase.hora_fin}).`;
              }
            } catch (err: any) {
              console.warn(`Error en la acción de base de datos ${name}:`, err);
              resultText = `ERROR en ${name}: ${err.message || 'Error desconocido'}.`;
            }

            results.push({ name, resultText });
          }

          // Emit event to notify lists to reload
          window.dispatchEvent(new CustomEvent('reloadGymData'));

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
            console.warn(`Error en seguimiento de Apolo AI. Usando fallback local.`);
            finalReply = `**Acciones completadas con éxito en el sistema.**\n\nEl asistente ha procesado correctamente las siguientes tareas:\n\n` +
              results.map(r => `- **${r.name === 'createMember' ? 'Miembro' : r.name === 'createInscription' ? 'Inscripción' : r.name === 'registerPayment' ? 'Pago' : 'Clase'}:** ${r.resultText}`).join('\n');
          } else {
            const followUpData = await followUpResponse.json();
            finalReply = followUpData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Acciones completadas con éxito en la base de datos.';
          }

          playChimeSound();

          setMessages(prev => {
            const copy = [...prev];
            copy.pop(); // remove progress indicator
            return [...copy, { role: 'model', text: finalReply, timestamp: getFormattedTime() }];
          });

          loadLiveSummary();
        } catch (err: any) {
          console.error('Error al ejecutar herramientas en base de datos:', err);
          setMessages(prev => {
            const copy = [...prev];
            copy.pop();
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
        setConsecutiveRateLimits(prev => prev + 1);
        const baseRetry = retrySecs !== null && retrySecs > 0 ? retrySecs : 30;
        const buffer = consecutiveRateLimits === 0 ? 8 : (consecutiveRateLimits === 1 ? 15 : 25);
        const bufferedRetry = baseRetry + buffer;

        setRateLimitCountdown(bufferedRetry);
        cleanErrorMessage = `**Límite de Consultas Alcanzado (Frecuencia Excesiva)**\n\n` +
          `El motor de inteligencia artificial de Gemini ha alcanzado su límite de consultas.
           Esto se desbloqueará automáticamente en unos segundos.

           *Desbloqueo automático en:* **${bufferedRetry} segundos.**`;
      } else {
        cleanErrorMessage = `**Error de Conexión / API**\n\n` +
          `No se pudo completar la comunicación con Gemini. Detalle:\n` +
          `\`${errMsg || 'Error de red o CORS detectado'}\``;
      }

      setMessages(prev => [...prev, { role: 'model', text: cleanErrorMessage, timestamp: getFormattedTime() }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('¿Estás seguro de que deseas limpiar el historial de chat con Apolo?')) {
      sessionStorage.removeItem('apolo_ai_history');
      setMessages([
        {
          role: 'model',
          text: `Historial borrado. Hola, soy **Apolo**, tu asistente administrativo inteligente. ¿Cómo te puedo ayudar hoy?`,
          timestamp: getFormattedTime()
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--shell-panel-strong)] text-[var(--text)] relative overflow-hidden select-none border-l border-[var(--shell-border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 bg-[var(--shell-panel)] border-b border-[var(--shell-border)]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_0_15px_rgba(var(--accent-rgb),0.25)]">
            <span className="font-['Anton'] text-sm tracking-wider">AP</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--success)] rounded-full border-2 border-[var(--shell-panel-strong)]" />
          </div>
          <div>
            <h4 className="font-['Anton'] text-sm tracking-wide uppercase text-[var(--text-h)]">Apolo AI</h4>
            <p className="text-[10px] font-mono tracking-widest text-[var(--muted)] uppercase">Copiloto Inteligente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLiveSummary}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--shell-border)] bg-[var(--surface-raised)] text-[var(--muted)] hover:text-[var(--text-h)] hover:border-[var(--accent)] transition-all cursor-pointer"
            title="Sincronizar base de datos en tiempo real"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center justify-center w-8 h-8 rounded-md border border-[var(--shell-border)] bg-[var(--surface-raised)] text-[var(--muted)] hover:text-[var(--danger)] hover:border-[var(--danger)] transition-all cursor-pointer"
            title="Borrar historial de conversación"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-lg text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-semibold shadow-[0_4px_12px_rgba(var(--accent-rgb),0.12)]'
                    : 'bg-[var(--surface-raised)] text-[var(--text-h)] border border-[var(--shell-border-subtle)] shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
                }`}
                style={{
                  clipPath: msg.role === 'user'
                    ? 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
                    : 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)'
                }}
              >
                <div className="whitespace-pre-line break-words markdown-content">
                  {msg.text}
                </div>
              </div>
              {msg.timestamp && (
                <span className="text-[10px] text-[var(--muted)] font-mono mt-1 px-1">{msg.timestamp}</span>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[var(--muted)] text-xs font-mono px-1 py-1"
            >
              <div className="flex space-x-1.5 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Apolo está pensando...</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested actions list */}
      {messages.length <= 1 && (
        <div className="px-5 pb-3">
          <p className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-wider mb-2">Sugerencias:</p>
          <div className="grid grid-cols-2 gap-2">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.prompt)}
                className="text-left p-2.5 text-xs rounded border border-[var(--shell-border-subtle)] bg-[var(--surface-raised)] text-[var(--text)] hover:text-[var(--text-h)] hover:border-[var(--accent)] hover:bg-[var(--accent-bg)] transition-all cursor-pointer"
                style={{
                  clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)'
                }}
              >
                <span className="font-semibold block text-[var(--text-h)] mb-0.5">{s.label}</span>
                <span className="text-[10px] opacity-75 line-clamp-1">{s.prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rate limit status blocker */}
      {rateLimitCountdown !== null && (
        <div className="absolute inset-0 bg-[var(--bg)]/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-full border border-[rgba(251,82,82,0.3)] bg-[rgba(251,82,82,0.08)] text-[var(--danger)] flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="font-['Anton'] text-lg uppercase tracking-wider text-[var(--text-h)] mb-2">Frecuencia Excesiva</h3>
          <p className="text-sm text-[var(--text)] max-w-sm mb-5">
            Las consultas con Gemini AI han excedido el límite de cuota. El sistema se desbloqueará de forma automática temporalmente.
          </p>
          <div className="flex items-center gap-3">
            {isVerifying ? (
              <div className="flex items-center gap-2 text-[var(--accent)] font-mono text-xs">
                <div className="w-3.5 h-3.5 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin" />
                <span>Verificando disponibilidad...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="font-mono text-3xl font-extrabold text-[var(--accent)] tracking-wider">
                  {rateLimitCountdown}s
                </span>
                <span className="text-[10px] font-mono text-[var(--muted)] uppercase tracking-widest mt-1">Tiempo de Espera</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 bg-[var(--shell-panel)] border-t border-[var(--shell-border)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2 items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || rateLimitCountdown !== null}
            placeholder="Pregúntale a Apolo sobre Solaris Gym..."
            className="flex-1 bg-[var(--surface-raised)] border border-[var(--shell-border-strong)] text-[var(--text-h)] placeholder-[var(--muted)] text-sm px-4 py-3 rounded focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 transition-all font-sans"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)'
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || rateLimitCountdown !== null}
            className="flex items-center justify-center w-11 h-11 bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-strong)] disabled:opacity-40 disabled:hover:bg-[var(--accent)] rounded font-semibold transition-all shadow-[0_4px_12px_rgba(var(--accent-rgb),0.12)] cursor-pointer"
            style={{
              clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
