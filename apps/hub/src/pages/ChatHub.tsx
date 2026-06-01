import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Database, Zap, BarChart3, Building2,
  Search, Copy, Check, Trash2, ChevronDown, ChevronUp,
  CreditCard, BedDouble, Users, TrendingUp,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import apiClient from '../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'ai';
  content: string;
  toolsUsed?: string[];
  loading?: boolean;
}

// ── Markdown simple ───────────────────────────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    // Bloques de código
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="my-3 bg-[#0e0e0f] border border-slate-800 rounded-xl p-4 overflow-x-auto text-sm text-emerald-300 font-mono"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    // Encabezados
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-100 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-100 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-100 mt-5 mb-3">$1</h1>')
    // Negrita e itálica
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-slate-300 italic">$1</em>')
    // Tablas
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      const isHeader = cells.every(c => c.trim());
      return '<tr>' + cells.map(c =>
        isHeader
          ? `<th class="border border-slate-700 px-3 py-1.5 text-left text-xs font-semibold text-slate-300 bg-slate-800/50">${c.trim()}</th>`
          : `<td class="border border-slate-700 px-3 py-1.5 text-sm text-slate-400">${c.trim()}</td>`
      ).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>)/gs, '<div class="overflow-x-auto my-3"><table class="w-full border-collapse text-sm">$1</table></div>')
    // Separadores de tabla markdown
    .replace(/<tr><t[hd][^>]*>[-:| ]+<\/t[hd]><\/tr>/g, '')
    // Listas
    .replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc text-slate-300 text-sm leading-relaxed">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-slate-300 text-sm leading-relaxed">$2</li>')
    .replace(/(<li.*<\/li>)/gs, '<ul class="my-2 space-y-1">$1</ul>')
    // Líneas horizontales
    .replace(/^---+$/gm, '<hr class="border-slate-700 my-4" />')
    // Párrafos y saltos de línea
    .replace(/\n\n/g, '</p><p class="text-slate-300 text-sm leading-relaxed mt-3">')
    .replace(/\n/g, '<br/>');
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div
      className="prose-custom"
      dangerouslySetInnerHTML={{
        __html: `<p class="text-slate-300 text-sm leading-relaxed">${renderMarkdown(content)}</p>`
      }}
    />
  );
}

// ── Tool badge ────────────────────────────────────────────────────────────────
const TOOL_LABELS: Record<string, { label: string; color: string }> = {
  get_businesses:       { label: 'negocios',     color: 'text-blue-400 bg-blue-400/10' },
  get_hotel_info:       { label: 'hotel',         color: 'text-indigo-400 bg-indigo-400/10' },
  get_reservations:     { label: 'reservas',      color: 'text-amber-400 bg-amber-400/10' },
  get_rooms:            { label: 'habitaciones',  color: 'text-emerald-400 bg-emerald-400/10' },
  get_guests:           { label: 'huéspedes',     color: 'text-cyan-400 bg-cyan-400/10' },
  get_payments:         { label: 'pagos',          color: 'text-green-400 bg-green-400/10' },
  get_metrics:          { label: 'métricas',       color: 'text-purple-400 bg-purple-400/10' },
  update_reservation:   { label: 'editó reserva', color: 'text-orange-400 bg-orange-400/10' },
  check_in:             { label: 'check-in',       color: 'text-teal-400 bg-teal-400/10' },
  check_out:            { label: 'check-out',      color: 'text-sky-400 bg-sky-400/10' },
  cancel_reservation:   { label: 'canceló',        color: 'text-red-400 bg-red-400/10' },
  register_payment:     { label: 'registró pago', color: 'text-lime-400 bg-lime-400/10' },
  update_room:          { label: 'editó hab.',     color: 'text-violet-400 bg-violet-400/10' },
  search_database:      { label: 'consulta BD',   color: 'text-slate-400 bg-slate-400/10' },
};

// ── CopyButton ────────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Sugerencias ───────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: <BarChart3 className="w-4 h-4 text-amber-400" />, title: 'Métricas del mes', prompt: 'Dame las métricas y resumen financiero de este mes para todos mis hoteles.' },
  { icon: <BedDouble className="w-4 h-4 text-emerald-400" />, title: 'Estado habitaciones', prompt: 'Muéstrame el estado actual de todas las habitaciones de mi hotel.' },
  { icon: <Users className="w-4 h-4 text-blue-400" />, title: 'Reservas de hoy', prompt: '¿Qué reservas tienen check-in o check-out hoy?' },
  { icon: <CreditCard className="w-4 h-4 text-purple-400" />, title: 'Pagos pendientes', prompt: '¿Cuáles reservas tienen estado de pago "deuda" o "abonada"?' },
  { icon: <TrendingUp className="w-4 h-4 text-rose-400" />, title: 'Ocupación', prompt: '¿Cuál es el porcentaje de ocupación actual de mis hoteles?' },
  { icon: <Building2 className="w-4 h-4 text-cyan-400" />, title: 'Mis negocios', prompt: 'Muéstrame un resumen de todos mis negocios y su estado.' },
  { icon: <Search className="w-4 h-4 text-indigo-400" />, title: 'Buscar huésped', prompt: 'Busca el huésped más reciente registrado en el hotel.' },
  { icon: <Zap className="w-4 h-4 text-yellow-400" />, title: '¿Qué puedes hacer?', prompt: '¿Qué acciones y consultas puedes realizar sobre mi base de datos?' },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChatHub() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const send = useCallback(async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || isTyping) return;
    setInput('');

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    // Placeholder de carga
    setMessages(prev => [...prev, { role: 'ai', content: '', loading: true }]);

    try {
      const res = await apiClient.post('/hub/ai/chat', { prompt: userMsg, history });
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'ai',
          content: res.data?.reply || 'No se recibió respuesta.',
          toolsUsed: res.data?.toolsUsed || [],
        };
        return copy;
      });
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'ai',
          content: `Error: ${err.response?.data?.error || err.message || 'Sin conexión con Solaris AI.'}`,
        };
        return copy;
      });
    } finally {
      setIsTyping(false);
    }
  }, [messages, isTyping]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    send(input);
  };

  const clearChat = () => setMessages([]);

  const toolCount = Object.keys(TOOL_LABELS).length;

  return (
    <DashboardLayout>
      <div className="flex h-full bg-[#0e0e0f] text-slate-300 font-sans overflow-hidden">

        {/* ── Main chat area ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-slate-800/60 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-100">Solaris AI</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                Gemini 2.5 Flash
              </span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button onClick={clearChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            <AnimatePresence mode="popLayout">
              {messages.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="max-w-3xl mx-auto">
                  <div className="text-center mb-10 mt-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-7 h-7 text-indigo-400" />
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-100 mb-2">Solaris AI</h2>
                    <p className="text-slate-500 text-sm">Consulta y gestiona todos tus negocios con lenguaje natural</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => send(s.prompt)}
                        className="text-left bg-[#16161a] hover:bg-[#1e1e24] border border-slate-800/60 hover:border-slate-700 p-4 rounded-2xl transition-all group">
                        <div className="mb-2.5">{s.icon}</div>
                        <p className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">{s.title}</p>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-6 pb-4">
                  {messages.map((msg, idx) => (
                    <motion.div key={idx}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 group ${msg.role === 'user' ? 'justify-end' : 'items-start'}`}>

                      {msg.role === 'ai' && (
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-indigo-500/20">
                          <Sparkles className={`w-3.5 h-3.5 text-white ${msg.loading ? 'animate-pulse' : ''}`} />
                        </div>
                      )}

                      <div className={`max-w-[88%] ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                        {/* Tool badges */}
                        {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {[...new Set(msg.toolsUsed)].map(t => {
                              const info = TOOL_LABELS[t] || { label: t, color: 'text-slate-400 bg-slate-400/10' };
                              return (
                                <span key={t} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${info.color}`}>
                                  <Database className="w-2.5 h-2.5" />
                                  {info.label}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Message bubble */}
                        <div className={`relative ${
                          msg.role === 'user'
                            ? 'bg-[#25252d] text-slate-200 px-4 py-3 rounded-2xl rounded-tr-sm text-sm'
                            : 'text-slate-300'
                        }`}>
                          {msg.loading ? (
                            <div className="flex items-center gap-2 py-1 h-6">
                              {[0,150,300].map(d => (
                                <span key={d} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                  style={{ animationDelay: `${d}ms` }} />
                              ))}
                            </div>
                          ) : msg.role === 'ai' ? (
                            <div className="flex items-start gap-2">
                              <MarkdownMessage content={msg.content} />
                              <CopyButton text={msg.content} />
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="px-4 pb-5 md:px-8 shrink-0">
            <div className="max-w-3xl mx-auto">
              <form onSubmit={handleSubmit}>
                <div className="bg-[#16161a] border border-slate-800 rounded-2xl focus-within:border-slate-600 transition-colors overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                    placeholder="Pregunta sobre tus negocios o da una orden..."
                    rows={1}
                    className="w-full bg-transparent text-slate-200 placeholder-slate-600 px-5 pt-4 pb-2 resize-none focus:outline-none text-sm leading-relaxed"
                    style={{ minHeight: 52 }}
                  />
                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <span className="text-[11px] text-slate-600">Enter para enviar · Shift+Enter para nueva línea</span>
                    <button type="submit" disabled={!input.trim() || isTyping}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors
                        bg-indigo-600 hover:bg-indigo-500 text-white
                        disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed">
                      <Send className="w-3.5 h-3.5" />
                      {isTyping ? 'Procesando...' : 'Enviar'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-72 bg-[#111113] border-l border-slate-800/60 shrink-0 hidden lg:flex flex-col">
          <div className="p-5 border-b border-slate-800/60">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Motor</p>
            <div className="bg-[#1a1a1e] border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-slate-200">Gemini 2.5 Flash</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Modelo multimodal con acceso completo a tu base de datos en tiempo real.
              </p>
            </div>
          </div>

          <div className="p-5 flex-1 overflow-y-auto">
            <button onClick={() => setShowTools(p => !p)}
              className="flex items-center justify-between w-full mb-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Herramientas ({toolCount})
              </p>
              {showTools ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
            </button>

            {showTools && (
              <div className="space-y-1">
                {Object.entries(TOOL_LABELS).map(([key, { label, color }]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0">
                    <span className="text-[11px] font-mono text-slate-500">{key}()</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 p-3.5 bg-[#1a1a1e] border border-slate-800 rounded-xl">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Capacidades</p>
              {[
                'Consultar cualquier tabla',
                'Check-in / Check-out',
                'Registrar pagos',
                'Cancelar reservas',
                'Cambiar estado habitaciones',
                'Ver métricas e ingresos',
                'Buscar huéspedes',
              ].map(c => (
                <div key={c} className="flex items-center gap-2 py-1">
                  <div className="w-1 h-1 rounded-full bg-indigo-400" />
                  <span className="text-[11px] text-slate-400">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
