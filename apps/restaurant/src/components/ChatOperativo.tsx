import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchChannels, fetchMessages, sendMessage, createChannel, deleteChannel,
  joinChannel, leaveChannel, getSocket,
  emitTyping, emitStopTyping, getChannelColor, getChannelLabel, formatMessageContent,
  type ChatChannel, type ChatMessage, type TypingUser,
} from '../api/chatService';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
.chat-root { display:flex; height:100%; overflow:hidden; background:var(--shell-bg); }
.chat-sidebar { width:200px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid var(--shell-border); background:var(--shell-panel); overflow:hidden; }
.chat-sidebar-head { padding:14px 14px 8px; border-bottom:1px solid var(--shell-border); }
.chat-sidebar-title { font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; margin-bottom:8px; }
.chat-channel-list { flex:1; overflow-y:auto; padding:6px; }
.chat-channel-item { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer; transition:background .12s; margin-bottom:2px; }
.chat-channel-item:hover { background:var(--sidebar-item-hover); }
.chat-channel-item.active { background:var(--accent-bg); }
.chat-channel-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.chat-channel-name { font-size:12px; font-weight:600; color:var(--text); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.chat-channel-item.active .chat-channel-name { color:var(--accent); }
.chat-channel-badge { background:var(--accent); color:#fff; font-size:10px; font-weight:700; padding:1px 5px; border-radius:99px; }
.chat-new-btn { margin:8px; padding:8px 10px; border-radius:8px; border:1px dashed var(--shell-border); background:transparent; color:var(--muted); font-size:11px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all .15s; }
.chat-new-btn:hover { border-color:var(--accent); color:var(--accent); background:var(--accent-bg); }
.chat-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
.chat-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid var(--shell-border); background:var(--shell-panel); flex-shrink:0; }
.chat-topbar-left { display:flex; align-items:center; gap:10px; }
.chat-topbar-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
.chat-topbar-name { font-size:14px; font-weight:700; color:var(--text-h); }
.chat-topbar-type { font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; background:var(--surface-raised); border:1px solid var(--shell-border); padding:2px 8px; border-radius:99px; }
.chat-topbar-del { background:none; border:none; color:var(--muted); cursor:pointer; padding:6px; border-radius:6px; transition:all .12s; display:flex; align-items:center; }
.chat-topbar-del:hover { color:var(--danger); background:rgba(239,68,68,.08); }
.chat-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:6px; }
.chat-date-sep { display:flex; align-items:center; gap:8px; margin:8px 0; }
.chat-date-sep span { font-size:10px; color:var(--muted); font-weight:600; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
.chat-date-sep::before,.chat-date-sep::after { content:''; flex:1; height:1px; background:var(--shell-border); }
.chat-msg-group { display:flex; gap:10px; }
.chat-msg-group.mine { flex-direction:row-reverse; }
.chat-avatar { width:32px; height:32px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; }
.chat-msg-body { max-width:75%; display:flex; flex-direction:column; gap:2px; }
.chat-msg-group.mine .chat-msg-body { align-items:flex-end; }
.chat-sender-row { display:flex; align-items:baseline; gap:6px; }
.chat-msg-group.mine .chat-sender-row { flex-direction:row-reverse; }
.chat-sender-name { font-size:11px; font-weight:700; color:var(--text-h); }
.chat-msg-time { font-size:10px; color:var(--muted); }
.chat-bubble { padding:8px 12px; border-radius:12px; font-size:13px; line-height:1.5; color:var(--text-h); word-break:break-word; }
.chat-bubble.mine { background:var(--accent); color:#fff; border-bottom-right-radius:4px; }
.chat-bubble.theirs { background:var(--surface-raised); border:1px solid var(--shell-border); border-bottom-left-radius:4px; }
.chat-mention { display:inline-block; background:var(--accent-bg); color:var(--accent); font-size:11px; font-weight:700; padding:1px 6px; border-radius:4px; border:1px solid var(--accent-border); }
.chat-typing { font-size:11px; color:var(--muted); font-style:italic; padding:4px 8px; }
.chat-input-area { border-top:1px solid var(--shell-border); background:var(--shell-panel); padding:12px 16px; flex-shrink:0; }
.chat-input-row { display:flex; gap:8px; align-items:flex-end; }
.chat-input { flex:1; background:var(--surface-raised); border:1px solid var(--shell-border); border-radius:10px; padding:10px 14px; font-size:13px; color:var(--text-h); resize:none; outline:none; font-family:inherit; line-height:1.4; max-height:100px; transition:border-color .15s; }
.chat-input:focus { border-color:var(--accent); }
.chat-input::placeholder { color:var(--muted); }
.chat-send-btn { width:38px; height:38px; border-radius:10px; background:var(--accent); border:none; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
.chat-send-btn:hover:not(:disabled) { background:var(--accent-strong); }
.chat-send-btn:disabled { opacity:.4; cursor:default; }
.chat-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:12px; color:var(--muted); }
.chat-empty-icon { width:48px; height:48px; border-radius:12px; background:var(--surface-raised); border:1px solid var(--shell-border); display:flex; align-items:center; justify-content:center; }
.chat-empty p { font-size:13px; }
.chat-no-channel { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:10px; color:var(--muted); font-size:13px; }
.chat-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,.5); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:9999; }
.chat-modal { background:var(--card-bg); border:1px solid var(--shell-border); border-top:3px solid var(--accent); border-radius:12px; padding:22px; width:340px; }
.chat-modal h3 { font-size:15px; font-weight:700; color:var(--text-h); margin-bottom:4px; }
.chat-modal p { font-size:12px; color:var(--muted); margin-bottom:16px; }
.chat-modal-input { width:100%; background:var(--surface-raised); border:1px solid var(--shell-border); border-radius:8px; padding:9px 12px; font-size:13px; color:var(--text-h); outline:none; font-family:inherit; box-sizing:border-box; margin-bottom:10px; }
.chat-modal-input:focus { border-color:var(--accent); }
.chat-modal-select { width:100%; background:var(--surface-raised); border:1px solid var(--shell-border); border-radius:8px; padding:9px 12px; font-size:13px; color:var(--text-h); outline:none; font-family:inherit; box-sizing:border-box; margin-bottom:16px; cursor:pointer; }
.chat-modal-btns { display:flex; gap:8px; justify-content:flex-end; }
.chat-modal-cancel { padding:8px 16px; border-radius:8px; border:1px solid var(--shell-border); background:var(--surface-raised); color:var(--text); font-size:13px; font-weight:600; cursor:pointer; }
.chat-modal-ok { padding:8px 16px; border-radius:8px; border:none; background:var(--accent); color:#fff; font-size:13px; font-weight:600; cursor:pointer; }
.chat-modal-ok:disabled { opacity:.5; cursor:default; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashColor(str: string): string {
  const COLORS = ['#f97316','#3b82f6','#10b981','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#ef4444'];
  let n = 0;
  for (let i = 0; i < str.length; i++) n = (n + str.charCodeAt(i)) % COLORS.length;
  return COLORS[n];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'long' });
}

// Agrupa mensajes consecutivos del mismo remitente
function groupMessages(msgs: ChatMessage[]) {
  const groups: { msgs: ChatMessage[]; date: string }[] = [];
  let lastDate = '';
  let lastSender = '';
  let currentGroup: ChatMessage[] = [];

  for (const msg of msgs) {
    const date = fmtDate(msg.created_at);
    const flush = () => {
      if (currentGroup.length) groups.push({ msgs: [...currentGroup], date: lastDate });
      currentGroup = [];
    };
    if (date !== lastDate) { flush(); lastDate = date; lastSender = ''; }
    if (msg.sender_name !== lastSender) { flush(); lastSender = msg.sender_name; }
    currentGroup.push(msg);
  }
  if (currentGroup.length) groups.push({ msgs: currentGroup, date: lastDate });
  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChatOperativo: React.FC = () => {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState<TypingUser[]>([]);
  const [loadingCh, setLoadingCh] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newChName, setNewChName] = useState('');
  const [newChType, setNewChType] = useState<ChatChannel['channel_type']>('general');
  const [creatingCh, setCreatingCh] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const senderName = user?.email?.split('@')[0] ?? 'Empleado';
  const senderId = user?.id ?? '';

  // Solo tipos internos de empleados — se excluyen canales 'cliente' del hotel
  const EMPLOYEE_TYPES: ChatChannel['channel_type'][] = ['general', 'cocina', 'servicio', 'caja', 'privado'];

  // Cargar canales
  const loadChannels = useCallback(async () => {
    setLoadingCh(true);
    try {
      const all = await fetchChannels();
      const chs = all.filter(ch => EMPLOYEE_TYPES.includes(ch.channel_type));
      setChannels(chs);
      if (!activeChannel && chs.length > 0) setActiveChannel(chs[0]);
    } catch (err) {
      console.error('Error al cargar canales:', err);
    } finally {
      setLoadingCh(false);
    }
  }, [activeChannel]);

  useEffect(() => { loadChannels(); }, []);

  // Cargar mensajes del canal activo
  useEffect(() => {
    if (!activeChannel) { setMessages([]); return; }
    setLoadingMsg(true);
    fetchMessages(activeChannel.id)
      .then(msgs => { setMessages(msgs); setLoadingMsg(false); })
      .catch(() => setLoadingMsg(false));

    joinChannel(activeChannel.id);
    return () => { if (activeChannel) leaveChannel(activeChannel.id); };
  }, [activeChannel?.id]);

  // Socket.io — tiempo real
  useEffect(() => {
    if (!activeChannel) return;
    const sock = getSocket();

    const onNewMsg = (msg: ChatMessage) => {
      if (msg.channel_id === activeChannel.id) {
        setMessages(prev => [...prev, msg]);
        // Borrar typing del remitente
        setTyping(prev => prev.filter(u => u.userId !== msg.sender_id));
      }
    };

    const onTyping = (channelId: string, user: TypingUser) => {
      if (channelId !== activeChannel.id || user.userId === senderId) return;
      setTyping(prev => prev.some(u => u.userId === user.userId) ? prev : [...prev, user]);
    };

    const onStopTyping = (channelId: string, user: TypingUser) => {
      if (channelId !== activeChannel.id) return;
      setTyping(prev => prev.filter(u => u.userId !== user.userId));
    };

    const onNewChannel = (ch: ChatChannel) => {
      if (!EMPLOYEE_TYPES.includes(ch.channel_type)) return;
      setChannels(prev => prev.some(c => c.id === ch.id) ? prev : [...prev, ch]);
    };

    sock.on('new_message', onNewMsg);
    sock.on('user_typing', onTyping);
    sock.on('user_stop_typing', onStopTyping);
    sock.on('new_channel', onNewChannel);

    return () => {
      sock.off('new_message', onNewMsg);
      sock.off('user_typing', onTyping);
      sock.off('user_stop_typing', onStopTyping);
      sock.off('new_channel', onNewChannel);
    };
  }, [activeChannel?.id, senderId]);

  // Scroll al fondo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !activeChannel || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    emitStopTyping(activeChannel.id, { userId: senderId, userName: senderName });
    try {
      await sendMessage(activeChannel.id, content, 'text', { sender_name: senderName });
    } catch (err) {
      console.error('Error al enviar:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); return; }
    if (activeChannel) {
      emitTyping(activeChannel.id, { userId: senderId, userName: senderName });
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        emitStopTyping(activeChannel.id, { userId: senderId, userName: senderName });
      }, 2500);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChName.trim()) return;
    setCreatingCh(true);
    try {
      const ch = await createChannel({ name: newChName.trim(), channel_type: newChType });
      setChannels(prev => [...prev, ch]);
      setActiveChannel(ch);
      setShowNewModal(false);
      setNewChName('');
      setNewChType('general');
    } catch (err) {
      console.error('Error al crear canal:', err);
    } finally {
      setCreatingCh(false);
    }
  };

  const handleDeleteChannel = async (ch: ChatChannel) => {
    if (!window.confirm(`¿Eliminar el canal "${ch.name}"?`)) return;
    try {
      await deleteChannel(ch.id);
      setChannels(prev => prev.filter(c => c.id !== ch.id));
      if (activeChannel?.id === ch.id) setActiveChannel(null);
    } catch (err) {
      console.error('Error al eliminar canal:', err);
    }
  };

  const groups = React.useMemo(() => groupMessages(messages), [messages]);

  return (
    <>
      <style>{CSS}</style>
      <div className="chat-root">
        {/* Sidebar de canales */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Solo Empleados</span>
            </div>
            <div className="chat-sidebar-title">Canales internos</div>
          </div>
          <div className="chat-channel-list">
            {loadingCh ? (
              <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--muted)' }}>Cargando...</div>
            ) : channels.length === 0 ? (
              <div style={{ padding: '10px', fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                Sin canales internos.
                <br />Crea uno con el botón de abajo.
              </div>
            ) : channels.map(ch => (
              <div
                key={ch.id}
                className={`chat-channel-item${activeChannel?.id === ch.id ? ' active' : ''}`}
                onClick={() => setActiveChannel(ch)}
              >
                <div className="chat-channel-dot" style={{ background: getChannelColor(ch.channel_type) }} />
                <span className="chat-channel-name">{ch.name}</span>
                {(ch.unread_count ?? 0) > 0 && (
                  <span className="chat-channel-badge">{ch.unread_count}</span>
                )}
              </div>
            ))}
          </div>
          <button className="chat-new-btn" onClick={() => setShowNewModal(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nuevo canal
          </button>
        </div>

        {/* Área principal */}
        <div className="chat-main">
          {!activeChannel ? (
            <div className="chat-no-channel">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .3 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Selecciona un canal para comenzar</span>
            </div>
          ) : (
            <>
              {/* Topbar */}
              <div className="chat-topbar">
                <div className="chat-topbar-left">
                  <div className="chat-topbar-dot" style={{ background: getChannelColor(activeChannel.channel_type) }} />
                  <span className="chat-topbar-name">{activeChannel.name}</span>
                  <span className="chat-topbar-type">{getChannelLabel(activeChannel.channel_type)}</span>
                </div>
                <button
                  className="chat-topbar-del"
                  onClick={() => handleDeleteChannel(activeChannel)}
                  title="Eliminar canal"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </div>

              {/* Mensajes */}
              <div className="chat-messages">
                {loadingMsg ? (
                  <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>Cargando mensajes...</div>
                ) : groups.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-empty-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <p>Sin mensajes aún. ¡Sé el primero!</p>
                  </div>
                ) : (
                  (() => {
                    let lastDate = '';
                    return groups.map((group, gi) => {
                      const isMe = group.msgs[0].sender_id === senderId || group.msgs[0].sender_name === senderName;
                      const dateEl = group.date !== lastDate
                        ? <div key={`d-${gi}`} className="chat-date-sep"><span>{group.date}</span></div>
                        : null;
                      lastDate = group.date;
                      const color = hashColor(group.msgs[0].sender_name);
                      return (
                        <React.Fragment key={gi}>
                          {dateEl}
                          <div className={`chat-msg-group${isMe ? ' mine' : ''}`}>
                            <div className="chat-avatar" style={{ background: color }}>
                              {initials(group.msgs[0].sender_name)}
                            </div>
                            <div className="chat-msg-body">
                              <div className="chat-sender-row">
                                <span className="chat-sender-name">{isMe ? 'Tú' : group.msgs[0].sender_name}</span>
                                <span className="chat-msg-time">{fmtTime(group.msgs[0].created_at)}</span>
                              </div>
                              {group.msgs.map((msg, mi) => {
                                const { parts } = formatMessageContent(msg.content);
                                return (
                                  <div key={msg.id || mi} className={`chat-bubble${isMe ? ' mine' : ' theirs'}`}>
                                    {parts.map((p, pi) =>
                                      p.isMention
                                        ? <span key={pi} className="chat-mention">{p.text}</span>
                                        : <span key={pi}>{p.text}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()
                )}
                {typing.length > 0 && (
                  <div className="chat-typing">
                    {typing.map(u => u.userName).join(', ')} {typing.length === 1 ? 'está escribiendo' : 'están escribiendo'}...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="chat-input-area">
                <div className="chat-input-row">
                  <textarea
                    className="chat-input"
                    rows={1}
                    placeholder={`Mensaje en #${activeChannel.name}…`}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    className="chat-send-btn"
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                  Enter para enviar · Shift+Enter para nueva línea
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nuevo canal */}
      {showNewModal && (
        <div className="chat-modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <h3>Nuevo Canal</h3>
            <p>Crea un canal para tu equipo de restaurante</p>
            <input
              className="chat-modal-input"
              placeholder="Nombre del canal"
              value={newChName}
              onChange={e => setNewChName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateChannel()}
              autoFocus
            />
            <select
              className="chat-modal-select"
              value={newChType}
              onChange={e => setNewChType(e.target.value as ChatChannel['channel_type'])}
            >
              <option value="general">General</option>
              <option value="cocina">Cocina</option>
              <option value="servicio">Servicio</option>
              <option value="caja">Caja</option>
              <option value="privado">Privado</option>
            </select>
            <div className="chat-modal-btns">
              <button className="chat-modal-cancel" onClick={() => setShowNewModal(false)}>Cancelar</button>
              <button className="chat-modal-ok" disabled={!newChName.trim() || creatingCh} onClick={handleCreateChannel}>
                {creatingCh ? 'Creando...' : 'Crear Canal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatOperativo;
