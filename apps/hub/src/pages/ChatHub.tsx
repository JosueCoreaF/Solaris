import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Database, Zap, BarChart3, Building2,
  Search, Copy, Check, Trash2, ChevronDown, ChevronUp,
  CreditCard, BedDouble, Users, TrendingUp, Mic, MicOff, SlidersHorizontal
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
  get_businesses:       { label: 'negocios',      color: 'text-blue-400 bg-blue-400/10' },
  get_hotel_info:       { label: 'hotel',          color: 'text-indigo-400 bg-indigo-400/10' },
  get_reservations:     { label: 'reservas',       color: 'text-amber-400 bg-amber-400/10' },
  get_rooms:            { label: 'habitaciones',   color: 'text-emerald-400 bg-emerald-400/10' },
  get_guests:           { label: 'huéspedes',      color: 'text-cyan-400 bg-cyan-400/10' },
  get_payments:         { label: 'pagos',           color: 'text-green-400 bg-green-400/10' },
  get_metrics:          { label: 'métricas',        color: 'text-purple-400 bg-purple-400/10' },
  update_reservation:   { label: 'editó reserva',  color: 'text-orange-400 bg-orange-400/10' },
  check_in:             { label: 'check-in',        color: 'text-teal-400 bg-teal-400/10' },
  check_out:            { label: 'check-out',       color: 'text-sky-400 bg-sky-400/10' },
  cancel_reservation:   { label: 'canceló',         color: 'text-red-400 bg-red-400/10' },
  register_payment:     { label: 'registró pago',  color: 'text-lime-400 bg-lime-400/10' },
  update_room:          { label: 'editó hab.',      color: 'text-violet-400 bg-violet-400/10' },
  get_available_rooms:  { label: 'disponibilidad', color: 'text-yellow-400 bg-yellow-400/10' },
  create_guest:         { label: 'creó huésped',   color: 'text-cyan-400 bg-cyan-400/10' },
  create_reservation:   { label: 'creó reserva',   color: 'text-emerald-400 bg-emerald-400/10' },
  search_database:      { label: 'consulta BD',    color: 'text-slate-400 bg-slate-400/10' },
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
  { icon: <BedDouble className="w-4 h-4 text-emerald-400" />, title: 'Nueva reserva', prompt: 'Quiero crear una reserva nueva. ¿Qué información necesitas?' },
  { icon: <Users className="w-4 h-4 text-blue-400" />, title: 'Reservas de hoy', prompt: '¿Qué reservas tienen check-in o check-out hoy?' },
  { icon: <CreditCard className="w-4 h-4 text-purple-400" />, title: 'Pagos pendientes', prompt: '¿Cuáles reservas tienen estado de pago "deuda" o "abonada"?' },
  { icon: <TrendingUp className="w-4 h-4 text-rose-400" />, title: 'Habitaciones libres', prompt: '¿Qué habitaciones están disponibles este fin de semana?' },
  { icon: <Building2 className="w-4 h-4 text-cyan-400" />, title: 'Mis negocios', prompt: 'Muéstrame un resumen de todos mis negocios y su estado.' },
  { icon: <Search className="w-4 h-4 text-indigo-400" />, title: 'Buscar huésped', prompt: 'Busca el huésped más reciente registrado en el hotel.' },
  { icon: <Zap className="w-4 h-4 text-yellow-400" />, title: '¿Qué puedes hacer?', prompt: '¿Qué acciones y consultas puedes realizar sobre mi base de datos?' },
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function ChatHub() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [showTools, setShowTools]       = useState(true);
  const [voiceError, setVoiceError]     = useState('');
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceLevel, setVoiceLevel]     = useState(0);
  const [mode, setMode] = useState<'idle'|'listening'|'transcribing'|'enrolling'>('idle');
  const [silenceThreshold, setSilenceThreshold] = useState(() => Number(localStorage.getItem('voice_threshold') || 8));
  const [voicePrint, setVoicePrint] = useState<number[] | null>(() => {
    const s = localStorage.getItem('voice_print');
    return s ? JSON.parse(s) : null;
  });
  const [voiceMatchThreshold, setVoiceMatchThreshold] = useState(() => Number(localStorage.getItem('voice_match') || 0.78));

  const listening      = mode === 'listening' || mode === 'transcribing';
  const isTranscribing = mode === 'transcribing';

  const chatEndRef      = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const analyserRef     = useRef<AnalyserNode | null>(null);
  const freqDataRef     = useRef<Uint8Array | null>(null);
  const volTickRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modeRef         = useRef<'idle'|'listening'|'transcribing'|'enrolling'>('idle');
  const silenceThresholdRef  = useRef(Number(localStorage.getItem('voice_threshold') || 8));
  const voicePrintRef        = useRef<number[] | null>(null);
  const voiceMatchThresholdRef = useRef(Number(localStorage.getItem('voice_match') || 0.78));

  // Sincronizar voicePrint al ref
  useEffect(() => { voicePrintRef.current = voicePrint; }, [voicePrint]);

  const setModeBoth = (m: typeof mode) => { modeRef.current = m; setMode(m); };

  // ── Similitud coseno entre FFT actual y firma guardada ────────────────────
  const cosineSimilarity = (a: Uint8Array, b: number[]): number => {
    let dot = 0, magA = 0, magB = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom > 0 ? dot / denom : 0;
  };

  // ── Registro de voz: graba 4s y guarda firma espectral ────────────────────
  const enrollVoice = async () => {
    if (modeRef.current !== 'idle') return;
    setVoiceError('');
    setModeBoth('enrolling');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const samples: Uint8Array[] = [];

      await new Promise<void>(resolve => {
        let ticks = 0;
        const collect = () => {
          if (ticks >= 40) { resolve(); return; } // 4 segundos
          analyser.getByteFrequencyData(data);
          const vol = data.reduce((a, b) => a + b, 0) / data.length;
          if (vol > silenceThresholdRef.current) samples.push(new Uint8Array(data));
          ticks++;
          setTimeout(collect, 100);
        };
        collect();
      });

      stream.getTracks().forEach(t => t.stop());
      ctx.close();

      if (samples.length < 8) {
        setVoiceError('Habla más durante el registro — se captaron pocas muestras');
        return;
      }

      // Promediar todas las muestras → firma espectral
      const avg = new Array(samples[0].length).fill(0);
      for (const s of samples) s.forEach((v, i) => { avg[i] += v; });
      avg.forEach((_, i) => { avg[i] /= samples.length; });

      localStorage.setItem('voice_print', JSON.stringify(avg));
      setVoicePrint(avg);
      voicePrintRef.current = avg;
    } catch {
      setVoiceError('No se pudo acceder al micrófono para el registro');
    } finally {
      setModeBoth('idle');
    }
  };

  // ── Blob → base64 ─────────────────────────────────────────────────────────
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });

  // ── Apagar todo ───────────────────────────────────────────────────────────
  const stopAll = () => {
    setModeBoth('idle');
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (volTickRef.current) clearTimeout(volTickRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    freqDataRef.current = null;
    setVoiceLevel(0);
  };

  // ── Ciclo: graba hasta silencio → transcribe con Gemini → repite ──────────
  const startCycle = () => {
    if (!streamRef.current || modeRef.current === 'idle') return;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    let hasSpeech = false;
    let speechDuration = 0;  // ms consecutivos de voz detectada
    let silenceDuration = 0;
    const startTime = Date.now();

    // Calcular bins del rango de voz humana (300Hz – 3400Hz)
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const binHz = sampleRate / (analyserRef.current?.fftSize ?? 1024);
    const voiceLow  = Math.floor(300  / binHz);
    const voiceHigh = Math.floor(3400 / binHz);

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = async () => {
      if (volTickRef.current) clearTimeout(volTickRef.current);
      setVoiceLevel(0);
      if (modeRef.current === 'idle') return;

      if (hasSpeech && chunks.length > 0) {
        // Cerrar el stream → mic se apaga en el OS durante la transcripción
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        setModeBoth('transcribing');
        try {
          const blob = new Blob(chunks, { type: mimeType });
          const base64 = await blobToBase64(blob);
          const res = await apiClient.post('/hub/ai/transcribe', { audio: base64, mimeType });
          if (res?.text) setInput(res.text.trim());
        } catch { /* ignorar */ }

        // Reabrir stream y continuar escuchando
        if (modeRef.current !== 'idle') {
          try {
            const newStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            streamRef.current = newStream;
            // Reconectar fuente al analizador existente
            audioCtxRef.current!.createMediaStreamSource(newStream).connect(analyserRef.current!);
            setModeBoth('listening');
            startCycle();
          } catch {
            stopAll();
          }
        }
      } else {
        // Sin voz real → reiniciar ciclo directamente
        if (modeRef.current !== 'idle') { setModeBoth('listening'); startCycle(); }
      }
    };

    recorder.start();

    const tick = () => {
      if (recorder.state !== 'recording' || modeRef.current === 'idle') return;
      if (analyserRef.current && freqDataRef.current) {
        analyserRef.current.getByteFrequencyData(freqDataRef.current);
        const data = freqDataRef.current;

        // Volumen general
        const total = data.reduce((a, b) => a + b, 0);
        const vol   = total / data.length;
        setVoiceLevel(Math.round(vol));

        // Energía en banda de voz vs energía total
        let voiceEnergy = 0;
        for (let i = voiceLow; i <= Math.min(voiceHigh, data.length - 1); i++) {
          voiceEnergy += data[i];
        }
        const voiceRatio = total > 0 ? voiceEnergy / total : 0;

        // Banda de voz + similitud con firma del usuario (si está registrado)
        const inVoiceBand = vol > silenceThresholdRef.current && voiceRatio > 0.25;
        let isVoice = inVoiceBand;
        if (inVoiceBand && voicePrintRef.current) {
          const sim = cosineSimilarity(data, voicePrintRef.current);
          isVoice = sim >= voiceMatchThresholdRef.current;
        }

        if (isVoice) {
          speechDuration += 100;
          silenceDuration = 0;
          if (speechDuration >= 400) hasSpeech = true;
        } else {
          speechDuration = 0;
          if (hasSpeech) {
            silenceDuration += 100;
            if (silenceDuration >= 1500) { recorder.stop(); return; }
          }
        }
      }
      if (Date.now() - startTime >= 15000) { recorder.stop(); return; }
      volTickRef.current = setTimeout(tick, 100);
    };
    volTickRef.current = setTimeout(tick, 100);
  };

  // ── Toggle ────────────────────────────────────────────────────────────────
  const toggleListening = async () => {
    if (listening) { stopAll(); return; }
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // más resolución de frecuencias
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      setModeBoth('listening');
      startCycle();
    } catch {
      setVoiceError('Permiso de micrófono denegado');
    }
  };

  useEffect(() => () => stopAll(), []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
    setMessages(prev => [...prev, { role: 'ai', content: '', loading: true }]);
    try {
      const res = await apiClient.post('/hub/ai/chat', { prompt: userMsg, history });
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'ai',
          content: res?.reply || 'No se recibió respuesta.',
          toolsUsed: res?.toolsUsed || [],
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
                {/* Panel de configuración de voz — fuera del overflow-hidden */}
                {showVoiceSettings && (
                  <div className="mb-2 bg-[#1a1a1e] border border-slate-700 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Configuración de voz</p>
                    <div className="space-y-4">

                      {/* Sensibilidad */}
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs text-slate-300">Sensibilidad del micrófono</span>
                          <span className="text-xs font-mono text-indigo-400">{silenceThreshold}</span>
                        </div>
                        <input type="range" min="1" max="30" value={silenceThreshold}
                          onChange={e => { const v = Number(e.target.value); silenceThresholdRef.current = v; setSilenceThreshold(v); localStorage.setItem('voice_threshold', String(v)); }}
                          className="w-full accent-indigo-500" />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                          <span>Más sensible</span><span>Menos sensible</span>
                        </div>
                      </div>

                      {/* Registro de voz */}
                      <div className="border-t border-slate-800 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-xs text-slate-300">Mi voz</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">
                              {voicePrint ? 'Firma registrada · solo reconocerá tu voz' : 'Sin registrar · reconoce cualquier voz'}
                            </p>
                          </div>
                          <button type="button" onClick={enrollVoice}
                            disabled={mode !== 'idle'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all
                              ${mode === 'enrolling'
                                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                                : voicePrint
                                  ? 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                            {mode === 'enrolling' ? '⏺ Grabando 4s...' : voicePrint ? 'Re-registrar' : '⏺ Registrar voz'}
                          </button>
                        </div>
                        {voicePrint && (
                          <>
                            <div className="flex justify-between mb-1.5">
                              <span className="text-xs text-slate-400">Exigencia de similitud</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-indigo-400">{Math.round(voiceMatchThreshold * 100)}%</span>
                                <button type="button" onClick={() => { localStorage.removeItem('voice_print'); setVoicePrint(null); voicePrintRef.current = null; }}
                                  className="text-[10px] text-rose-500 hover:text-rose-400">borrar</button>
                              </div>
                            </div>
                            <input type="range" min="60" max="95" value={Math.round(voiceMatchThreshold * 100)}
                              onChange={e => { const v = Number(e.target.value) / 100; voiceMatchThresholdRef.current = v; setVoiceMatchThreshold(v); localStorage.setItem('voice_match', String(v)); }}
                              className="w-full accent-indigo-500" />
                            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                              <span>Más permisivo</span><span>Más estricto</span>
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                <div className="bg-[#16161a] border border-slate-800 rounded-2xl focus-within:border-slate-600 transition-colors overflow-hidden">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                    placeholder={mode === 'transcribing' ? 'Transcribiendo...' : mode === 'listening' ? 'Habla cuando quieras...' : 'Pregunta sobre tus negocios o da una orden...'}
                    rows={1}
                    className="w-full bg-transparent text-slate-200 placeholder-slate-600 px-5 pt-4 pb-2 resize-none focus:outline-none text-sm leading-relaxed"
                    style={{ minHeight: 52 }}
                  />
                  <div className="flex items-center justify-between px-4 pb-3 pt-1">
                    <span className="text-[11px] text-slate-600">
                      {voiceError
                        ? <span className="text-rose-400">{voiceError}</span>
                        : mode === 'transcribing'
                          ? <span className="text-indigo-400">Transcribiendo...</span>
                          : mode === 'listening'
                            ? voiceLevel > silenceThreshold
                              ? <span className="text-emerald-400 font-medium">Captando voz...</span>
                              : <span className="text-slate-500">Habla cuando quieras · Enter para enviar</span>
                            : 'Enter para enviar · Shift+Enter para nueva línea'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setShowVoiceSettings(p => !p)}
                        className={`p-1.5 rounded-lg transition-colors ${showVoiceSettings ? 'text-indigo-400 bg-indigo-400/10' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'}`}>
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>

                      {mode === 'listening' && (
                        <div className="flex items-end gap-[2px] h-4">
                          {[0.5, 0.8, 1, 0.8, 0.5].map((factor, i) => {
                            const active = voiceLevel > silenceThreshold;
                            const h = active ? Math.max(3, Math.min(16, voiceLevel * factor * 0.55)) : 3;
                            return (
                              <div key={i}
                                className={`w-[3px] rounded-full transition-all duration-75 ${active ? 'bg-emerald-400' : 'bg-slate-700'}`}
                                style={{ height: `${h}px` }}
                              />
                            );
                          })}
                        </div>
                      )}

                      <button type="button" onClick={toggleListening}
                        title={listening ? 'Detener micrófono' : 'Activar micrófono'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all
                          ${listening
                            ? voiceLevel > silenceThreshold
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 ring-1 ring-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 ring-1 ring-rose-500/30'
                            : 'bg-[#25252d] text-slate-400 hover:bg-[#2d2d36] hover:text-slate-200'}`}>
                        {listening
                          ? <Mic className={`w-3.5 h-3.5 ${voiceLevel > silenceThreshold ? 'animate-pulse' : ''}`} />
                          : <MicOff className="w-3.5 h-3.5" />}
                        {mode === 'transcribing' ? 'Procesando…' : mode === 'listening' ? (voiceLevel > silenceThreshold ? 'Captando' : 'Escuchando') : 'Voz'}
                      </button>
                      <button type="submit" disabled={!input.trim() || isTyping}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-colors
                          bg-indigo-600 hover:bg-indigo-500 text-white
                          disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed">
                        <Send className="w-3.5 h-3.5" />
                        {isTyping ? 'Procesando...' : 'Enviar'}
                      </button>
                    </div>
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
                'Crear reservas nuevas',
                'Registrar huéspedes',
                'Ver disponibilidad por fechas',
                'Check-in / Check-out',
                'Cancelar reservas',
                'Registrar pagos',
                'Cambiar estado habitaciones',
                'Ver métricas e ingresos',
                'Buscar huéspedes',
                'Consultar cualquier tabla',
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
