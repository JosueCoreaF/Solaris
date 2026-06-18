import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Trash2, ChevronDown, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRestaurant } from '../context/RestaurantContext';
import {
  getChatMensajes, sendChatMensaje, deleteChatMensaje,
  subscribeChatMensajes, type ChatMensaje,
} from '../api/chat';

const AVATAR_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f59e0b', '#ef4444',
];

function hashColor(str: string): string {
  let n = 0;
  for (let i = 0; i < str.length; i++) n = (n + str.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[n];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

export const EmployeeChat: React.FC = () => {
  const { user } = useAuth();
  const { restaurant } = useRestaurant();
  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<ChatMensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const nombreRemitente = user?.email?.split('@')[0] ?? 'Empleado';
  const avatarColor = hashColor(nombreRemitente);

  // Cargar mensajes iniciales
  useEffect(() => {
    if (!restaurant) return;
    getChatMensajes(restaurant.id_restaurant).then(setMensajes);
  }, [restaurant]);

  // Suscripción en tiempo real
  useEffect(() => {
    if (!restaurant) return;
    const channel = subscribeChatMensajes(
      restaurant.id_restaurant,
      (msg) => {
        setMensajes(prev => [...prev, msg]);
        if (!open) setUnread(u => u + 1);
      },
      (id_chat) => setMensajes(prev => prev.filter(m => m.id_chat !== id_chat)),
    );
    return () => { channel.unsubscribe(); };
  }, [restaurant, open]);

  // Scroll al fondo cuando hay mensajes nuevos
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, open]);

  // Al abrir, limpiar unread
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSend = async () => {
    if (!texto.trim() || !restaurant || sending) return;
    const msg = texto.trim();
    setTexto('');
    setSending(true);
    try {
      await sendChatMensaje({
        id_restaurant: restaurant.id_restaurant,
        nombre_remitente: nombreRemitente,
        avatar_color: avatarColor,
        mensaje: msg,
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id_chat: string) => {
    await deleteChatMensaje(id_chat);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      {/* Botón flotante */}
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 flex items-center justify-center"
        style={{ width: 52, height: 52 }}
        title="Chat de empleados"
      >
        <div className="relative w-full h-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/40 transition-colors">
          <AnimatePresence mode="wait">
            {open
              ? <motion.span key="close" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}><X size={20} /></motion.span>
              : <motion.span key="open"  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}><MessageSquare size={20} /></motion.span>
            }
          </AnimatePresence>
          {unread > 0 && !open && (
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
            >
              {unread > 9 ? '9+' : unread}
            </motion.div>
          )}
        </div>
      </motion.button>

      {/* Panel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-24 right-6 z-50 w-80 sm:w-96 flex flex-col"
            style={{ height: 480 }}
          >
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-orange-500 text-white">
                <div className="flex items-center gap-2">
                  <Users size={16} />
                  <span className="font-bold text-sm">Chat de Empleados</span>
                  <span className="text-xs text-orange-200 bg-orange-600/50 px-1.5 py-0.5 rounded-full">
                    {mensajes.length} msj
                  </span>
                </div>
                <button onClick={() => setOpen(false)} className="text-orange-200 hover:text-white transition-colors">
                  <ChevronDown size={18} />
                </button>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                {mensajes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <MessageSquare size={32} className="opacity-30" />
                    <p className="text-sm">Sin mensajes aún. ¡Sé el primero!</p>
                  </div>
                ) : (
                  mensajes.map((msg, idx) => {
                    const isOwn = msg.nombre_remitente === nombreRemitente;
                    const showAvatar = idx === 0 || mensajes[idx - 1].nombre_remitente !== msg.nombre_remitente;
                    return (
                      <div key={msg.id_chat} className={`flex gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className="flex-shrink-0 flex flex-col justify-end">
                          {showAvatar ? (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: msg.avatar_color ?? '#f97316' }}
                              title={msg.nombre_remitente}
                            >
                              {initials(msg.nombre_remitente)}
                            </div>
                          ) : <div className="w-7" />}
                        </div>

                        {/* Burbuja */}
                        <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                          {showAvatar && (
                            <span className="text-xs text-slate-400 mb-0.5 px-1">
                              {isOwn ? 'Tú' : msg.nombre_remitente} · {fmtTime(msg.created_at)}
                            </span>
                          )}
                          <div className={`relative px-3 py-1.5 rounded-2xl text-sm leading-relaxed ${
                            isOwn
                              ? 'bg-orange-500 text-white rounded-br-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'
                          }`}>
                            {msg.mensaje}
                            {isOwn && (
                              <button
                                onClick={() => handleDelete(msg.id_chat)}
                                className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-all"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2">
                  <input
                    ref={inputRef}
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none"
                    maxLength={500}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!texto.trim() || sending}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 text-center">
                  Enviando como <span className="font-semibold text-orange-400">{nombreRemitente}</span> · Enter para enviar
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
