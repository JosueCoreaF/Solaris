import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import { supabase } from '../api/supabase';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string, key?: number): React.ReactNode {
  const regex = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    if (m[2]) parts.push(<strong key={i++} style={{ fontWeight: 700, color: 'var(--text-h)' }}>{m[2]}</strong>);
    else if (m[3]) parts.push(<em key={i++} style={{ fontStyle: 'italic', opacity: .85 }}>{m[3]}</em>);
    else if (m[4]) parts.push(
      <code key={i++} style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--accent-bg)', color: 'var(--accent)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--accent-border)' }}>
        {m[4]}
      </code>
    );
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
  return <React.Fragment key={key}>{parts}</React.Fragment>;
}

const MdContent: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    if (line.startsWith('#### ')) {
      nodes.push(<div key={i} style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '.07em', marginTop: 8, marginBottom: 3, opacity: .85 }}>{renderInline(line.slice(5))}</div>);
    } else if (line.startsWith('### ')) {
      nodes.push(<div key={i} style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 10, marginBottom: 4 }}>{renderInline(line.slice(4))}</div>);
    } else if (line.startsWith('## ')) {
      nodes.push(<div key={i} style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-h)', marginTop: 12, marginBottom: 5, paddingBottom: 4, borderBottom: '1px solid var(--shell-border)' }}>{renderInline(line.slice(3))}</div>);
    } else if (line.startsWith('# ')) {
      nodes.push(<div key={i} style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)', marginTop: 12, marginBottom: 6 }}>{renderInline(line.slice(2))}</div>);

    // Bullet list — collect consecutive
    } else if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''));
        i++;
      }
      nodes.push(
        <ul key={`ul${i}`} style={{ margin: '4px 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((it, j) => (
            <li key={j} style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-h)', listStyleType: 'none', paddingLeft: 4, position: 'relative' }}>
              <span style={{ position: 'absolute', left: -12, color: 'var(--accent)', fontWeight: 700 }}>·</span>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;

    // Numbered list — collect consecutive
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''));
        i++;
      }
      nodes.push(
        <ol key={`ol${i}`} style={{ margin: '4px 0', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((it, j) => (
            <li key={j} style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-h)', listStyleType: 'none', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ minWidth: 18, height: 18, borderRadius: '50%', background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{j + 1}</span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ol>
      );
      continue;

    // Horizontal rule
    } else if (line === '---') {
      nodes.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--shell-border)', margin: '8px 0' }} />);

    // Empty line
    } else if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: 6 }} />);

    // Regular paragraph
    } else {
      nodes.push(<div key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-h)' }}>{renderInline(line)}</div>);
    }

    i++;
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{nodes}</div>;
};

const getFormattedTime = (): string => {
  const d = new Date();
  let hr = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  return `${hr}:${min} ${ampm}`;
};

const SYSTEM_PROMPT = `Eres 'Sol', el copiloto inteligente de inteligencia artificial exclusivo para el personal administrativo del restaurante en la plataforma Solaris.

Tu propósito es asistir a meseros, cajeros, cocineros y administradores en la gestión diaria del restaurante:
1. **Gestión de Pedidos**: Consultar pedidos activos, estados (pendiente/preparando/listo/entregado/cancelado), detalles por mesa.
2. **Mesas y Reservas**: Verificar disponibilidad, estado actual (disponible/ocupada/reservada/fuera_de_servicio), reservas del día.
3. **Menú y Platillos**: Información de platillos, precios, categorías, disponibilidad en inventario.
4. **Clientes**: Historial de visitas, datos de contacto, reservas asociadas.
5. **Inventario y Finanzas**: Alertas de stock bajo, gastos del día, ventas (provenientes de facturas, no de pedidos directamente).
6. **KPIs del Restaurante**: Ventas del día y semana desde \`factura_restaurante\`, pedidos completados, platillos más vendidos del mes.

REGLAS DE OPERACIÓN:
1. Responde siempre en español con tono profesional, cálido y ejecutivo.
2. Usa formato markdown — encabezados (##), negritas (**), listas (- ), código (\`id\`) — para mayor claridad visual.
3. Basa tus respuestas únicamente en los datos reales del contexto de base de datos proporcionado en tiempo real.
4. **Confirmación antes de actuar**: Antes de ejecutar cualquier acción de escritura (actualizar mesa, modificar pedido, crear reserva), resume los datos relevantes y solicita confirmación explícita al usuario. Omite este paso solo si el usuario ya confirmó todos los detalles en el mismo mensaje.
5. Mantén respuestas concisas pero completas — el personal necesita información rápida durante el servicio.
6. Si no tienes datos suficientes para responder con precisión, indícalo claramente y solicita los datos faltantes.
7. **REGLA DE ORO — FUNCTION CALLS**: Si el usuario solicita actualizar el estado de una mesa, modificar un pedido, crear una reserva o cambiar el estado de una reserva, **debes emitir obligatoriamente la llamada de función correspondiente** (\`updateMesaEstado\`, \`updatePedidoEstado\`, \`createReservaRestaurante\`, \`updateReservaEstado\`). **NUNCA** digas que realizaste la acción si no has emitido la herramienta.
8. **Manejo de Errores**: Si la base de datos retorna un ERROR al ejecutar una acción, no declares que fue exitosa. Informa al usuario del fallo con la razón disponible y sugiere una alternativa concreta (ej. verificar el ID, elegir otra mesa disponible).
9. **Cálculos Financieros**: Las ventas reales del restaurante provienen de \`factura_restaurante.total\`, nunca estimes desde pedidos. El total de una mesa se calcula sumando los ítems de \`detalle_pedido_restaurante\`. Usa siempre los datos del contexto para cifras exactas.
`;

const SUGGESTIONS = [
  { label: 'Estado del día', prompt: 'Dame un resumen ejecutivo del día: pedidos activos, mesas ocupadas y ventas acumuladas.' },
  { label: 'Mesas disponibles', prompt: '¿Cuántas mesas están disponibles ahora mismo y cuáles están ocupadas o reservadas?' },
  { label: 'Platillos populares', prompt: '¿Cuáles son los platillos más pedidos del menú?' },
  { label: 'Pedidos activos', prompt: 'Muéstrame los pedidos que están pendientes o en preparación ahora mismo.' },
];

const parseRetrySeconds = (msg: string): number | null => {
  const m = msg.match(/retry\s+in\s+([\d.]+)\s*s/i);
  return m ? Math.ceil(parseFloat(m[1])) : null;
};

const playChimeSound = (): void => {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
    osc1.type = 'sine'; osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    g1.gain.setValueAtTime(0, ctx.currentTime);
    g1.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.04);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc1.connect(g1); g1.connect(ctx.destination);
    osc1.start(); osc1.stop(ctx.currentTime + 0.35);
    const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
    osc2.type = 'sine'; osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
    g2.gain.setValueAtTime(0, ctx.currentTime + 0.08);
    g2.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08); osc2.stop(ctx.currentTime + 0.60);
  } catch {}
};

export const AsistenteAI: React.FC = () => {
  const { user } = useAuth();
  const { restaurant } = useRestaurant();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbSummary, setDbSummary] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [consecutiveRL, setConsecutiveRL] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationRetries, setVerificationRetries] = useState(0);
  const [activeKeyIndex, setActiveKeyIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Ref para que handleSend siempre lea el contexto más reciente aunque sea async
  const dbSummaryRef = useRef('');

  const keysPool = useMemo(() => {
    const raw = import.meta.env.VITE_GEMINI_API_KEY || '';
    return raw.split(',').map((k: string) => k.trim()).filter(Boolean);
  }, []);

  // ─── Key rotation ──────────────────────────────────────────────────────────

  const fetchGeminiWithRotation = async (body: any, attempt = 0): Promise<Response> => {
    if (keysPool.length === 0) throw new Error('API Key de Gemini no configurada en .env');
    const idx = (activeKeyIndex + attempt) % keysPool.length;
    const key = keysPool[idx];

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.error?.message || `Error ${res.status}`;
        const isRL = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit') || res.status === 429;
        if (isRL && attempt < keysPool.length - 1) {
          setActiveKeyIndex((idx + 1) % keysPool.length);
          return fetchGeminiWithRotation(body, attempt + 1);
        }
        throw new Error(msg);
      }
      setActiveKeyIndex(idx);
      return res;
    } catch (error: any) {
      const isRL = (error.message || '').toLowerCase().includes('quota') || (error.message || '').toLowerCase().includes('rate limit');
      if (isRL && attempt < keysPool.length - 1) {
        setActiveKeyIndex((idx + 1) % keysPool.length);
        return fetchGeminiWithRotation(body, attempt + 1);
      }
      throw error;
    }
  };

  const verifyGeminiAvailability = async (): Promise<boolean> => {
    if (keysPool.length === 0) return false;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${keysPool[activeKeyIndex]}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] }) }
      );
      if (res.ok) return true;
      if (keysPool.length > 1) setActiveKeyIndex((activeKeyIndex + 1) % keysPool.length);
      return false;
    } catch { return false; }
  };

  const handleVerificationAndUnlock = async () => {
    setIsVerifying(true);
    const ok = await verifyGeminiAvailability();
    setIsVerifying(false);
    if (ok) { setRateLimitCountdown(null); setVerificationRetries(0); playChimeSound(); }
    else {
      const next = verificationRetries + 1;
      setVerificationRetries(next);
      if (next >= 3) { setRateLimitCountdown(null); setVerificationRetries(0); }
      else setRateLimitCountdown(5);
    }
  };

  useEffect(() => {
    if (rateLimitCountdown === null) return;
    if (rateLimitCountdown <= 0) { handleVerificationAndUnlock(); return; }
    const t = setInterval(() => setRateLimitCountdown(p => (p === null || p <= 1) ? 0 : p - 1), 1000);
    return () => clearInterval(t);
  }, [rateLimitCountdown]);

  // ─── Historial ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const saved = sessionStorage.getItem('sol_ai_history');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch {}
    } else {
      setMessages([{
        role: 'model',
        text: `¡Hola! Soy **Sol**, tu copiloto inteligente para la gestión de **${restaurant?.nombre_restaurante ?? 'tu restaurante'}**.

Estoy conectado en tiempo real a tu base de datos. Puedo ayudarte a:
- **Consultar pedidos** activos y su estado.
- **Verificar mesas** disponibles y reservas.
- **Analizar ventas** y métricas del día.
- **Información del menú**, precios y disponibilidad.

¿En qué te puedo asistir hoy?`,
        timestamp: getFormattedTime(),
      }]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) sessionStorage.setItem('sol_ai_history', JSON.stringify(messages));
  }, [messages]);

  // ─── Contexto DB del restaurante ───────────────────────────────────────────

  const loadLiveSummary = async () => {
    if (!restaurant) return;
    const id = Number(restaurant.id_restaurant);
    setDbLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_restaurant_ai_context', { p_restaurant_id: id });
      if (error) throw error;

      const ctx = data as any;
      const mesas: any[]        = ctx.mesas            ?? [];
      const pedidosHoy: any[]   = ctx.pedidos_hoy      ?? [];
      const platillos: any[]    = ctx.platillos         ?? [];
      const clientes: any[]     = ctx.clientes          ?? [];
      const reservas: any[]     = ctx.reservas_proximas ?? [];
      const inventario: any[]   = ctx.inventario        ?? [];
      const topPlatillos: any[] = ctx.top_platillos_mes ?? [];
      const ventasHoy           = Number(ctx.ventas_hoy   ?? 0);
      const ventasSemana        = Number(ctx.ventas_semana ?? 0);

      const systemTime = new Date().toLocaleString('es-HN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });

      const mesasOcupadas    = mesas.filter((m: any) => m.estado === 'ocupada').length;
      const mesasDisponibles = mesas.filter((m: any) => m.estado === 'disponible').length;
      const mesasReservadas  = mesas.filter((m: any) => m.estado === 'reservada').length;
      const pedidosActivos   = pedidosHoy.filter((p: any) => ['pendiente', 'preparando'].includes(p.estado_pedido)).length;
      const pedidosCompletados = pedidosHoy.filter((p: any) => p.estado_pedido === 'completado').length;
      const reservasHoy      = reservas.filter((r: any) => r.fecha_reserva === new Date().toISOString().split('T')[0]);

      const mesasStr = mesas.length
        ? mesas.map((m: any) => `- Mesa ${m.numero_mesa}: ${m.estado} (capacidad ${m.capacidad})`).join('\n')
        : 'Sin mesas registradas.';

      const platillosStr = platillos.length
        ? platillos.map((p: any) => `- ${p.nombre_platillo}: L. ${p.precio}${p.descripcion ? ` (${p.descripcion})` : ''}`).join('\n')
        : 'Sin platillos registrados.';

      const pedidosStr = pedidosHoy.length
        ? pedidosHoy.slice(0, 25).map((p: any) =>
            `- Pedido #${p.id_pedido} (Mesa ${p.id_mesa ?? '-'}): ${p.estado_pedido} | L. ${Number(p.total ?? 0).toFixed(2)}`
          ).join('\n')
        : 'Sin pedidos hoy.';

      const reservasStr = reservas.length
        ? reservas.map((r: any) =>
            `- ${r.cliente_nombre ?? 'Sin nombre'}: ${r.fecha_reserva} ${r.hora_reserva} | ${r.cantidad_personas} personas | ${r.estado}${r.observaciones ? ` (${r.observaciones})` : ''}`
          ).join('\n')
        : 'Sin reservas en los próximos 7 días.';

      const inventarioStr = inventario.length
        ? inventario.map((p: any) => {
            const stock = p.stock_actual !== null ? `stock: ${p.stock_actual}` : `cantidad: ${p.cantidad}`;
            const alerta = p.bajo_minimo ? ' ⚠️ BAJO MÍNIMO' : '';
            const vence = p.fecha_vencimiento ? ` | vence: ${p.fecha_vencimiento}` : '';
            return `- ${p.nombre_producto}: ${stock}${vence}${alerta}`;
          }).join('\n')
        : 'Sin datos de inventario.';

      const topStr = topPlatillos.length
        ? topPlatillos.map((t: any) => `- ${t.nombre_platillo}: ${t.total_pedidos} pedidos | L. ${Number(t.total_ingresos).toFixed(2)} generados`).join('\n')
        : 'Sin datos del mes.';

      const clientesStr = clientes.length
        ? clientes.map((c: any) => `- ${c.nombre} ${c.apellido}${c.telefono ? ` | ${c.telefono}` : ''}${c.correo ? ` | ${c.correo}` : ''}`).join('\n')
        : 'Sin clientes registrados.';

      const summary = `DATOS EN TIEMPO REAL — RESTAURANTE: ${restaurant.nombre_restaurante}
Fecha y hora del sistema: ${systemTime}

KPIs DEL DÍA:
- Ventas totales hoy (facturas): L. ${ventasHoy.toFixed(2)}
- Ventas últimos 7 días: L. ${ventasSemana.toFixed(2)}
- Pedidos activos (pendiente/preparando): ${pedidosActivos}
- Pedidos completados hoy: ${pedidosCompletados}
- Pedidos totales hoy: ${pedidosHoy.length}
- Mesas ocupadas: ${mesasOcupadas} | disponibles: ${mesasDisponibles} | reservadas: ${mesasReservadas} | total: ${mesas.length}
- Reservas para hoy: ${reservasHoy.length}
- Reservas próximos 7 días: ${reservas.length}
- Clientes en directorio: ${clientes.length}
- Platillos activos en menú: ${platillos.length}

ESTADO DE MESAS:
${mesasStr}

MENÚ ACTIVO:
${platillosStr}

PEDIDOS DE HOY:
${pedidosStr}

RESERVAS (HOY Y PRÓXIMOS 7 DÍAS):
${reservasStr}

INVENTARIO:
${inventarioStr}

PLATILLOS MÁS PEDIDOS (ÚLTIMOS 30 DÍAS):
${topStr}

DIRECTORIO DE CLIENTES:
${clientesStr}`;

      dbSummaryRef.current = summary;
      setDbSummary(summary);
    } catch (err: any) {
      console.warn('[Sol AI] Error cargando contexto:', err?.message ?? err);
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => { loadLiveSummary(); }, [restaurant]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Enviar mensaje ────────────────────────────────────────────────────────

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', text: textToSend, timestamp: getFormattedTime() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const dynamicPrompt = `${SYSTEM_PROMPT}\n\n${dbSummaryRef.current || dbSummary || 'Sin datos del restaurante cargados aún.'}`;

      let apiMsgs = [...updated];
      if (apiMsgs.length > 0 && apiMsgs[0].role === 'model') apiMsgs.shift();
      if (apiMsgs.length > 20) apiMsgs = apiMsgs.slice(-20);
      if (apiMsgs.length === 0) apiMsgs = [{ role: 'user', text: textToSend }];

      const contents = apiMsgs.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const res = await fetchGeminiWithRotation({
        contents,
        systemInstruction: { parts: [{ text: dynamicPrompt }] },
        tools: [{
          functionDeclarations: [
            {
              name: 'updateMesaEstado',
              description: 'Cambia el estado de una mesa del restaurante.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  id_mesa: { type: 'NUMBER', description: 'ID numérico de la mesa (id_mesa).' },
                  nuevo_estado: { type: 'STRING', enum: ['disponible', 'ocupada', 'reservada', 'fuera_de_servicio'], description: 'Nuevo estado de la mesa.' }
                },
                required: ['id_mesa', 'nuevo_estado']
              }
            },
            {
              name: 'updatePedidoEstado',
              description: 'Actualiza el estado de un pedido activo.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  id_pedido: { type: 'NUMBER', description: 'ID del pedido a actualizar.' },
                  nuevo_estado: { type: 'STRING', enum: ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'], description: 'Nuevo estado del pedido.' }
                },
                required: ['id_pedido', 'nuevo_estado']
              }
            },
            {
              name: 'createReservaRestaurante',
              description: 'Crea una nueva reserva en el restaurante.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  id_cliente: { type: 'NUMBER', description: 'ID del cliente (id_cliente) del directorio.' },
                  id_mesa: { type: 'NUMBER', description: 'ID de la mesa (id_mesa) a reservar.' },
                  fecha_reserva: { type: 'STRING', description: 'Fecha de la reserva en formato YYYY-MM-DD.' },
                  hora_reserva: { type: 'STRING', description: 'Hora de la reserva en formato HH:MM.' },
                  cantidad_personas: { type: 'NUMBER', description: 'Número de personas.' },
                  observaciones: { type: 'STRING', description: 'Observaciones opcionales.' }
                },
                required: ['id_cliente', 'id_mesa', 'fecha_reserva', 'hora_reserva', 'cantidad_personas']
              }
            },
            {
              name: 'updateReservaEstado',
              description: 'Actualiza el estado de una reserva existente.',
              parameters: {
                type: 'OBJECT',
                properties: {
                  id_reserva: { type: 'NUMBER', description: 'ID de la reserva a modificar.' },
                  nuevo_estado: { type: 'STRING', enum: ['pendiente', 'confirmada', 'cancelada', 'completada'], description: 'Nuevo estado de la reserva.' }
                },
                required: ['id_reserva', 'nuevo_estado']
              }
            }
          ]
        }]
      });

      // ── Streaming ─────────────────────────────────────────────────────────
      setMessages(prev => [...prev, { role: 'model', text: '', timestamp: getFormattedTime() }]);
      let accText = '';
      let finalCandidate: any = null;
      {
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const line of dec.decode(value, { stream: true }).split('\n')) {
            if (!line.startsWith('data: ')) continue;
            try {
              const chunk = JSON.parse(line.slice(6));
              const cand = chunk?.candidates?.[0];
              if (!cand) continue;
              finalCandidate = cand;
              for (const part of (cand?.content?.parts ?? [])) {
                if (part.text) { accText += part.text; setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], text: accText }; return c; }); }
              }
            } catch {}
          }
        }
      }

      const parts = finalCandidate?.content?.parts ?? [];
      const functionCallParts = parts.filter((p: any) => p.functionCall);

      // ── Function calling: write operations ────────────────────────────────
      if (functionCallParts.length > 0) {
        setMessages(prev => { const c = [...prev]; c.pop(); return [...c, { role: 'model', text: `*Procesando ${functionCallParts.length} acción(es) en la base de datos...*`, timestamp: getFormattedTime() }]; });
        try {
          const results: { name: string; resultText: string }[] = [];
          for (const part of functionCallParts) {
            const { name, args } = part.functionCall;
            let resultText = '';
            try {
              const rid = Number(restaurant!.id_restaurant);
              if (name === 'updateMesaEstado') {
                const { error } = await supabase.from('mesa_restaurante')
                  .update({ estado: args.nuevo_estado })
                  .eq('id_mesa', args.id_mesa).eq('id_restaurant', rid);
                if (error) throw error;
                resultText = `Mesa ${args.id_mesa} actualizada a "${args.nuevo_estado}" con éxito.`;
              } else if (name === 'updatePedidoEstado') {
                const { error } = await supabase.from('pedido_restaurante')
                  .update({ estado_pedido: args.nuevo_estado })
                  .eq('id_pedido', args.id_pedido).eq('id_restaurant', rid);
                if (error) throw error;
                resultText = `Pedido #${args.id_pedido} actualizado a "${args.nuevo_estado}" con éxito.`;
              } else if (name === 'createReservaRestaurante') {
                const hora = args.hora_reserva.length === 5 ? `${args.hora_reserva}:00` : args.hora_reserva;
                const { data: newRes, error } = await supabase.from('reserva')
                  .insert({
                    id_restaurant: rid,
                    id_cliente: args.id_cliente,
                    id_mesa: args.id_mesa,
                    fecha_reserva: args.fecha_reserva,
                    hora_reserva: hora,
                    cantidad_personas: args.cantidad_personas,
                    estado: 'pendiente',
                    observaciones: args.observaciones || null,
                  }).select().single();
                if (error) throw error;
                resultText = `Reserva creada con éxito. ID: ${newRes.id_reserva}, Fecha: ${args.fecha_reserva} ${hora}, ${args.cantidad_personas} personas.`;
              } else if (name === 'updateReservaEstado') {
                const { error } = await supabase.from('reserva')
                  .update({ estado: args.nuevo_estado })
                  .eq('id_reserva', args.id_reserva).eq('id_restaurant', rid);
                if (error) throw error;
                resultText = `Reserva #${args.id_reserva} actualizada a "${args.nuevo_estado}" con éxito.`;
              }
            } catch (err: any) {
              console.warn(`[Sol AI] Error en ${name}:`, err);
              resultText = `ERROR en ${name}: ${err.message || 'Error desconocido'}.`;
            }
            results.push({ name, resultText });
          }

          const followUpContents = [
            ...contents,
            { role: 'model', parts: candidate?.content?.parts || functionCallParts },
            { role: 'user', parts: results.map(r => ({ functionResponse: { name: r.name, response: { result: r.resultText } } })) }
          ];
          const followUpRes = await fetchGeminiWithRotation({
            contents: followUpContents,
            systemInstruction: { parts: [{ text: dynamicPrompt }] },
          });
          setMessages(prev => { const c = [...prev]; c.pop(); return [...c, { role: 'model', text: '', timestamp: getFormattedTime() }]; });
          let followUpText = '';
          {
            const reader = followUpRes.body!.getReader();
            const dec = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              for (const line of dec.decode(value, { stream: true }).split('\n')) {
                if (!line.startsWith('data: ')) continue;
                try {
                  const chunk = JSON.parse(line.slice(6));
                  for (const part of (chunk?.candidates?.[0]?.content?.parts ?? [])) {
                    if (part.text) { followUpText += part.text; setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], text: followUpText }; return c; }); }
                  }
                } catch {}
              }
            }
          }
          if (!followUpText) setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], text: 'Acciones completadas con éxito.' }; return c; });

          setConsecutiveRL(0);
          playChimeSound();
          loadLiveSummary();
        } catch (err: any) {
          setMessages(prev => { const c = [...prev]; c.pop(); return [...c, { role: 'model', text: `**Error al ejecutar la acción:** ${err.message || 'Error desconocido.'}`, timestamp: getFormattedTime() }]; });
        }
        return;
      }

      setConsecutiveRL(0);
      playChimeSound();
      if (!accText) setMessages(prev => { const c = [...prev]; c[c.length - 1] = { ...c[c.length - 1], text: 'No obtuve respuesta de la IA.' }; return c; });
    } catch (error: any) {
      const errMsg = error.message || '';
      const retrySecs = parseRetrySeconds(errMsg);
      const isRL = retrySecs !== null || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('429');

      if (isRL) {
        setConsecutiveRL(prev => prev + 1);
        const base = retrySecs && retrySecs > 0 ? retrySecs : 30;
        const buffer = consecutiveRL === 0 ? 8 : consecutiveRL === 1 ? 15 : 25;
        setRateLimitCountdown(base + buffer);
        setMessages(prev => [...prev, {
          role: 'model',
          text: `**Límite de consultas alcanzado**\n\nEl motor Gemini ha alcanzado su límite. Se desbloqueará automáticamente en ${base + buffer} segundos.`,
          timestamp: getFormattedTime(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'model',
          text: `**Error de conexión**\n\n\`${errMsg || 'Error de red o CORS'}\``,
          timestamp: getFormattedTime(),
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (!window.confirm('¿Limpiar el historial de chat con Sol?')) return;
    sessionStorage.removeItem('sol_ai_history');
    setMessages([{
      role: 'model',
      text: `Historial limpio. Soy **Sol**, tu asistente de restaurante. ¿En qué te ayudo?`,
      timestamp: getFormattedTime(),
    }]);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--shell-panel-strong)', position: 'relative', overflow: 'hidden', borderLeft: '1px solid var(--shell-border)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--shell-border)', background: 'var(--shell-panel)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(249,115,22,.25)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#22c55e', borderRadius: '50%', border: '2px solid var(--shell-panel)' }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-h)' }}>Sol IA</div>
            <div style={{ fontSize: 10, color: dbLoading ? 'var(--accent)' : dbSummary ? '#22c55e' : 'var(--muted)', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
              {dbLoading
                ? <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'sol-bounce 1s infinite' }} />Sincronizando datos...</>
                : dbSummary
                  ? <><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />Datos del restaurante listos</>
                  : 'Sin datos cargados'
              }
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={loadLiveSummary}
            title="Sincronizar datos"
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--shell-border)', background: 'var(--surface-raised)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 16h5v5" />
            </svg>
          </button>
          <button
            onClick={handleClearHistory}
            title="Limpiar historial"
            style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--shell-border)', background: 'var(--surface-raised)', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 3 }}
            >
              {msg.role === 'user' ? (
                /* Burbuja del usuario */
                <div style={{
                  maxWidth: '80%', padding: '9px 13px', borderRadius: 14, borderBottomRightRadius: 4,
                  background: 'var(--accent)', color: '#fff', fontSize: 13, lineHeight: 1.5,
                  fontWeight: 600, wordBreak: 'break-word',
                }}>
                  {msg.text}
                </div>
              ) : (
                /* Respuesta de Sol — sin burbuja, con avatar */
                <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, boxShadow: '0 0 10px rgba(249,115,22,.2)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, background: 'var(--surface-raised)', border: '1px solid var(--shell-border)', borderRadius: 14, borderTopLeftRadius: 4, padding: '10px 14px', wordBreak: 'break-word' }}>
                    <MdContent text={msg.text} />
                  </div>
                </div>
              )}
              {msg.timestamp && (
                <span style={{ fontSize: 10, color: 'var(--muted)', paddingInline: msg.role === 'model' ? 38 : 2, fontFamily: 'monospace' }}>
                  {msg.timestamp}
                </span>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 10px rgba(249,115,22,.2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                </svg>
              </div>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--shell-border)', borderRadius: 14, borderTopLeftRadius: 4, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                {[0, 160, 320].map(d => (
                  <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'sol-bounce 1.1s ease-in-out infinite', animationDelay: `${d}ms` }} />
                ))}
                <style>{`@keyframes sol-bounce { 0%,80%,100%{transform:scale(.7);opacity:.5} 40%{transform:scale(1);opacity:1} }`}</style>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Sugerencias</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s.prompt)}
                style={{
                  textAlign: 'left', padding: '8px 10px', fontSize: 11, borderRadius: 8,
                  border: '1px solid var(--shell-border)', background: 'var(--surface-raised)',
                  color: 'var(--text)', cursor: 'pointer', transition: 'all .15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent-bg)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--shell-border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-raised)'; }}
              >
                <span style={{ fontWeight: 700, color: 'var(--text-h)', display: 'block', marginBottom: 2 }}>{s.label}</span>
                <span style={{ opacity: .7, fontSize: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{s.prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rate limit overlay */}
      {rateLimitCountdown !== null && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center', zIndex: 50 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '1px solid rgba(239,68,68,.3)', background: 'rgba(239,68,68,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-h)' }}>Límite de Consultas</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 260 }}>
            Se desbloqueará automáticamente en:
          </div>
          {isVerifying
            ? <div style={{ fontSize: 12, color: 'var(--accent)' }}>Verificando disponibilidad...</div>
            : <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>{rateLimitCountdown}s</div>
          }
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--shell-border)', background: 'var(--shell-panel)', flexShrink: 0 }}>
        <form onSubmit={e => { e.preventDefault(); handleSend(input); }} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || rateLimitCountdown !== null}
            placeholder="Pregúntale a Sol sobre el restaurante..."
            style={{
              flex: 1, background: 'var(--surface-raised)', border: '1px solid var(--shell-border)',
              borderRadius: 9, padding: '10px 14px', fontSize: 13, color: 'var(--text-h)',
              outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--shell-border)')}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || rateLimitCountdown !== null}
            style={{
              width: 42, height: 42, borderRadius: 9, border: 'none', background: 'var(--accent)',
              color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              opacity: !input.trim() || loading || rateLimitCountdown !== null ? .4 : 1,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AsistenteAI;
