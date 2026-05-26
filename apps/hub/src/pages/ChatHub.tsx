import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Hash, Clock, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import apiClient from '../services/api';

const channelTypeLabel: Record<string, string> = {
  general: 'General',
  hotel: 'Hotel',
  operativo: 'Operativo',
  cliente: 'Cliente',
  privado: 'Privado',
};

const channelTypeColor: Record<string, string> = {
  general: 'bg-indigo-100 text-indigo-600',
  hotel: 'bg-emerald-100 text-emerald-600',
  operativo: 'bg-amber-100 text-amber-700',
  cliente: 'bg-blue-100 text-blue-600',
  privado: 'bg-slate-100 text-slate-600',
};

export default function ChatHub() {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const data: any[] = await apiClient.get('/hub/chat/channels');
      setChannels(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching channels', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Channels sidebar */}
        <div className="w-72 bg-white border-r border-slate-100 flex flex-col shrink-0">
          <div className="p-5 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-500" /> Chat Operativo
              </h2>
              <button onClick={fetchChannels} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <p className="text-slate-400 text-xs">Canales de todos tus negocios</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-10 px-4">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No hay canales activos.</p>
                <p className="text-slate-400 text-xs mt-1">Los canales se crean automáticamente en el módulo de Hotel.</p>
              </div>
            ) : (
              channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setSelected(ch)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${selected?.id === ch.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Hash className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800 text-sm truncate">{ch.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto shrink-0 ${channelTypeColor[ch.channel_type] || 'bg-slate-100 text-slate-500'}`}>
                      {channelTypeLabel[ch.channel_type] || ch.channel_type}
                    </span>
                  </div>
                  {ch.last_message ? (
                    <p className="text-xs text-slate-400 truncate pl-5">
                      <span className="font-medium text-slate-500">{ch.last_message.sender_name}:</span> {ch.last_message.content}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300 pl-5 italic">Sin mensajes</p>
                  )}
                  {ch.last_message && (
                    <p className="text-[10px] text-slate-300 pl-5 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ch.last_message.created_at).toLocaleString('es-HN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col bg-slate-50">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                {/* Channel header */}
                <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="flex items-center gap-2">
                      <Hash className="w-4 h-4 text-slate-400" />
                      <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${channelTypeColor[selected.channel_type] || 'bg-slate-100 text-slate-500'}`}>
                        {channelTypeLabel[selected.channel_type] || selected.channel_type}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">Canal operativo — Vista de solo lectura desde el Hub</p>
                  </div>
                  <button className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-sm font-medium transition-colors">
                    <ExternalLink className="w-4 h-4" />
                    Abrir en App
                  </button>
                </div>

                {/* Last message preview */}
                <div className="flex-1 overflow-y-auto p-6">
                  {selected.last_message ? (
                    <div className="max-w-2xl mx-auto">
                      <div className="text-center mb-6">
                        <span className="text-xs text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                          Último mensaje registrado
                        </span>
                      </div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                            {selected.last_message.sender_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{selected.last_message.sender_name}</p>
                            <p className="text-xs text-slate-400">{new Date(selected.last_message.created_at).toLocaleString('es-HN')}</p>
                          </div>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{selected.last_message.content}</p>
                      </motion.div>
                      <p className="text-center text-xs text-slate-400 mt-6">
                        Para ver todo el historial y enviar mensajes, abre el chat en el módulo correspondiente.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-14 h-14 text-slate-200 mb-4" />
                      <h4 className="text-lg font-bold text-slate-700 mb-1">Canal vacío</h4>
                      <p className="text-slate-400 text-sm max-w-xs">Aún no hay mensajes en este canal. Los mensajes operativos aparecerán aquí.</p>
                    </div>
                  )}
                </div>

                {/* Read-only notice */}
                <div className="bg-white border-t border-slate-100 px-6 py-3 flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed">
                    Vista de solo lectura. Abre el módulo correspondiente para responder...
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full text-center p-10"
              >
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                  <MessageSquare className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Chat Operativo del Hub</h3>
                <p className="text-slate-500 max-w-sm leading-relaxed">
                  Selecciona un canal de la izquierda para previsualizar los mensajes operativos de todos tus negocios desde un solo lugar.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
