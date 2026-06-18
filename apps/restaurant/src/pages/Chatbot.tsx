import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Settings, RefreshCw, Save, Sparkles, User, Trash2, ToggleLeft, ToggleRight, MessageSquare } from 'lucide-react';
import { useRestaurant } from '../context/RestaurantContext';
import { supabase } from '../api/supabase';
import {
  getChatbotConfig, upsertChatbotConfig, sendChatbotMessage,
  type ChatbotConfig, type ChatbotMessage,
} from '../api/chatbot';
import { getPlatillos } from '../api/platillos';

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[1][0]).toUpperCase();
}

const DEFAULT_CONFIG: Omit<ChatbotConfig, 'id_config' | 'updated_at'> = {
  id_restaurant: '',
  nombre_bot: 'Asistente',
  bienvenida: '¡Hola! Soy el asistente de este restaurante. ¿En qué puedo ayudarte hoy?',
  system_prompt: 'Eres un asistente amable y profesional de un restaurante. Ayudas a los clientes con información sobre el menú, horarios, reservaciones y cualquier duda general. Siempre responde en español de manera concisa y cordial.',
  activo: true,
};

export const Chatbot: React.FC = () => {
  const { restaurant } = useRestaurant();

  // Config state
  const [config, setConfig] = useState<Omit<ChatbotConfig, 'id_config' | 'updated_at'>>(DEFAULT_CONFIG);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [configTab, setConfigTab] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Contexto del restaurante para el chatbot
  const [restaurantContext, setRestaurantContext] = useState('');

  useEffect(() => {
    if (!restaurant) return;
    setLoadingConfig(true);
    getChatbotConfig(restaurant.id_restaurant).then(cfg => {
      if (cfg) setConfig({ id_restaurant: cfg.id_restaurant, nombre_bot: cfg.nombre_bot, bienvenida: cfg.bienvenida, system_prompt: cfg.system_prompt, activo: cfg.activo });
      else setConfig({ ...DEFAULT_CONFIG, id_restaurant: restaurant.id_restaurant });
    }).finally(() => setLoadingConfig(false));

    // Construir contexto del restaurante
    buildContext(restaurant.id_restaurant);
  }, [restaurant]);

  async function buildContext(id: string) {
    const platillos = await getPlatillos(id).catch(() => []);
    const { data: mesas } = await supabase.from('mesa_restaurante').select('numero_mesa, capacidad, estado').eq('id_restaurant', id);
    const lines: string[] = [];
    if (restaurant) {
      lines.push(`Restaurante: ${restaurant.nombre_restaurante}`);
      if (restaurant.direccion) lines.push(`Dirección: ${restaurant.direccion}`);
      if (restaurant.telefono) lines.push(`Teléfono: ${restaurant.telefono}`);
      if (restaurant.correo) lines.push(`Correo: ${restaurant.correo}`);
    }
    if (platillos.length > 0) {
      lines.push('\nMenú disponible:');
      platillos.filter(p => p.activo).forEach(p => {
        const precio = new Intl.NumberFormat('es-HN', { style: 'currency', currency: 'HNL' }).format(p.precio);
        lines.push(`- ${p.nombre_platillo}: ${precio}${p.descripcion ? ` (${p.descripcion})` : ''}`);
      });
    }
    if (mesas && mesas.length > 0) {
      const disponibles = mesas.filter((m: any) => m.estado === 'disponible').length;
      lines.push(`\nMesas: ${mesas.length} en total, ${disponibles} disponibles actualmente.`);
    }
    setRestaurantContext(lines.join('\n'));
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSaveConfig = async () => {
    if (!restaurant) return;
    setSavingConfig(true);
    try {
      await upsertChatbotConfig({ ...config, id_restaurant: restaurant.id_restaurant });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatbotMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    try {
      const history = [...messages, userMsg];
      const reply = await sendChatbotMessage(history, config.system_prompt, restaurantContext);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e.message ?? 'Error al obtener respuesta del chatbot.');
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ No pude procesar tu mensaje. Verifica la configuración del backend.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const resetChat = () => {
    setMessages([]);
    setError(null);
  };

  const inputCls = "w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-orange-500 transition-colors";
  const labelCls = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";

  return (
    <div className="p-6 lg:p-8 h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center">
            <Bot className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Chatbot del Restaurante</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs">Asistente IA · prueba y configura tu bot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfig(c => ({ ...c, activo: !c.activo }))}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              config.activo
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
            }`}
          >
            {config.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            {config.activo ? 'Activo' : 'Inactivo'}
          </button>
          <button
            onClick={() => setConfigTab(t => !t)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              configTab
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-500'
            }`}
          >
            <Settings size={13} /> Configurar
          </button>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Panel de configuración */}
        <AnimatePresence>
          {configTab && (
            <motion.div
              initial={{ opacity: 0, x: -16, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: -16, width: 0 }}
              className="flex-shrink-0 overflow-hidden"
              style={{ width: 320 }}
            >
              <div className="w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 h-full overflow-y-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Settings size={14} className="text-orange-400" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Configuración del Bot</span>
                </div>

                {loadingConfig ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls}>Nombre del bot</label>
                      <input value={config.nombre_bot} onChange={e => setConfig(c => ({ ...c, nombre_bot: e.target.value }))} className={inputCls} placeholder="Ej: Asistente, Chef Bot..." />
                    </div>
                    <div>
                      <label className={labelCls}>Mensaje de bienvenida</label>
                      <textarea value={config.bienvenida} onChange={e => setConfig(c => ({ ...c, bienvenida: e.target.value }))} rows={3} className={`${inputCls} resize-none`} placeholder="¡Hola! ¿En qué puedo ayudarte?" />
                    </div>
                    <div>
                      <label className={labelCls}>Prompt del sistema</label>
                      <p className="text-xs text-slate-400 mb-1">Instrucciones base para el comportamiento del bot</p>
                      <textarea value={config.system_prompt} onChange={e => setConfig(c => ({ ...c, system_prompt: e.target.value }))} rows={6} className={`${inputCls} resize-none font-mono text-xs`} />
                    </div>

                    {error && <p className="text-red-400 text-xs">{error}</p>}

                    <button
                      onClick={handleSaveConfig}
                      disabled={savingConfig}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      {savingConfig ? <RefreshCw size={14} className="animate-spin" /> : savedOk ? '✓ Guardado' : <><Save size={14} /> Guardar cambios</>}
                    </button>

                    {/* Contexto actual */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Contexto actual del restaurante</p>
                      <pre className="text-xs text-slate-500 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2 overflow-y-auto max-h-40 whitespace-pre-wrap leading-relaxed">
                        {restaurantContext || 'Cargando contexto...'}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel de chat */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden min-h-0">
          {/* Chat header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
                <Sparkles size={14} className="text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{config.nombre_bot}</p>
                <p className="text-xs text-emerald-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  {config.activo ? 'En línea' : 'Desactivado'}
                </p>
              </div>
            </div>
            <button onClick={resetChat} className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Limpiar chat">
              <Trash2 size={14} />
            </button>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Bienvenida siempre visible */}
            <div className="flex gap-3">
              <div className="w-8 h-8 flex-shrink-0 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center">
                <Bot size={14} className="text-orange-400" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-sm">
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{config.bienvenida}</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    msg.role === 'user' ? 'bg-slate-600 dark:bg-slate-700' : 'bg-orange-500/10 border border-orange-500/20'
                  }`}>
                    {msg.role === 'user'
                      ? <User size={14} className="text-white dark:text-slate-200" />
                      : <Bot size={14} className="text-orange-400" />
                    }
                  </div>
                  {/* Burbuja */}
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white rounded-tr-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loader */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 flex-shrink-0 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center">
                  <Bot size={14} className="text-orange-400" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 0.15, 0.3].map(delay => (
                    <motion.div
                      key={delay}
                      className="w-2 h-2 bg-slate-400 rounded-full"
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugerencias rápidas */}
          {messages.length === 0 && (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {['¿Cuál es el menú?', '¿Tienen mesas disponibles?', '¿Cómo hago una reservación?', '¿Cuál es el platillo más popular?'].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-orange-500/10 hover:text-orange-500 border border-slate-200 dark:border-slate-700 hover:border-orange-500/30 rounded-full text-slate-600 dark:text-slate-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5">
              <MessageSquare size={15} className="text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Pregunta algo a ${config.nombre_bot}...`}
                disabled={loading || !config.activo}
                className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || !config.activo}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
            {!config.activo && (
              <p className="text-xs text-amber-500 mt-1.5 text-center">El chatbot está desactivado. Actívalo para responder mensajes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
