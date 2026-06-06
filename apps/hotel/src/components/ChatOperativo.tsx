import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import {
  ChatChannel, ChatMessage, TypingUser,
  emitStopTyping, emitTyping, fetchChannels, fetchMessages,
  formatMessageContent, getChannelColor,
  getSocket, joinChannel, leaveChannel, markChannelAsRead,
  sendMessage, createChannel, deleteChannel,
} from '../api/chatService';
import { fetchReservas, fetchPagos, fetchHabitaciones, fetchHuespedes } from '../api/bookingsService';
import { useRole } from '../hooks/useRole';
import { canAccessChannel, canDo } from '../config/rbac';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}
function fmtDay(iso: string): string {
  const d = new Date(iso); const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Hoy';
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });
}
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function hueFrom(name: string) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return Math.abs(h) % 360;
}

// ─── Channel SVG Icons (no emojis del SO) ─────────────────────────────────────
const CH_COLOR: Record<string, string> = {
  general: 'var(--accent)', hotel: '#0ea5e9', operativo: '#f59e0b',
  cliente: '#10b981', privado: '#8b5cf6', cierre: '#ef4444',
};
const CH_LABEL: Record<string, string> = {
  general: 'General', hotel: 'Hotel', operativo: 'Operativo',
  cliente: 'Clientes', privado: 'Privado', cierre: 'Cierre Diario',
};
const ChannelIcon: React.FC<{ type: string; size?: number }> = ({ type, size = 15 }) => {
  const c = CH_COLOR[type] ?? 'var(--accent)';
  const s = { width: size, height: size, display: 'block' as const, flexShrink: 0 as const };
  if (type === 'hotel')
    return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
  if (type === 'operativo')
    return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  if (type === 'cliente')
    return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
  if (type === 'privado')
    return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
  if (type === 'cierre')
    return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
  return <svg style={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
.chat-root{display:flex;flex:1;height:100%;min-height:0;background:var(--shell-bg);font-family:var(--sans);overflow:hidden;}
.chat-sidebar{width:240px;flex-shrink:0;display:flex;flex-direction:column;background:var(--shell-panel);border:1px solid var(--shell-border);border-radius:20px;margin:16px 0 16px 16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06);}
.chat-sidebar-head{padding:14px 14px 10px;border-bottom:1px solid var(--shell-border-subtle);display:flex;align-items:center;justify-content:space-between;}
.chat-sidebar-title{font-size:14px;font-weight:700;color:var(--text-h);display:flex;align-items:center;gap:8px;}
.chat-sidebar-badge{background:var(--danger);color:#fff;border-radius:10px;font-size:10px;font-weight:700;padding:1px 6px;}
.chat-sidebar-add{width:28px;height:28px;border-radius:8px;border:1px solid var(--shell-border);background:var(--card-bg);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;transition:all .18s;}
.chat-sidebar-add:hover{background:var(--accent-bg);border-color:var(--accent-border);color:var(--accent);}
.chat-ch-list{flex:1;overflow-y:auto;padding:8px;}
.chat-ch-item{width:100%;text-align:left;border:1px solid transparent;cursor:pointer;border-radius:10px;padding:8px 10px 8px 14px;display:flex;align-items:center;gap:9px;background:transparent;transition:all .15s;margin-bottom:1px;position:relative;user-select:none;overflow:hidden;}
.chat-ch-item:hover{background:var(--sidebar-item-hover);}
.chat-ch-item.active{background:var(--sidebar-item-active);border-color:var(--accent-border);}
.chat-ch-item::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:0;background:var(--accent);border-radius:0 4px 4px 0;transition:height .25s ease;}
.chat-ch-item.active::before{height:20px;}
.chat-ch-del{opacity:0;position:absolute;right:6px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:5px;border:none;background:transparent;color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;transition:all .15s;flex-shrink:0;}
.chat-ch-item:hover .chat-ch-del{opacity:1;}
.chat-ch-del:hover{background:rgba(220,38,38,.1);}
.chat-ch-name{flex:1;font-size:13px;font-weight:500;color:var(--muted);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.chat-ch-item.active .chat-ch-name{color:var(--text-h);font-weight:600;}
.chat-ch-unread{background:var(--danger);color:#fff;border-radius:10px;font-size:10px;font-weight:700;padding:1px 5px;flex-shrink:0;}
.chat-user-foot{padding:10px 12px;border-top:1px solid var(--shell-border-subtle);display:flex;align-items:center;gap:8px;}
.chat-user-name{font-size:12px;font-weight:600;color:var(--text-h);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.chat-user-status{font-size:10px;color:var(--muted);}
.chat-main{flex:1;display:flex;flex-direction:column;min-width:0;margin:16px;background:var(--card-bg);border:1px solid var(--shell-border);border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06);position:relative;}
.chat-main-head{padding:14px 18px;border-bottom:1px solid var(--shell-border-subtle);display:flex;align-items:center;gap:10px;background:var(--shell-panel-strong);flex-shrink:0;}
.chat-main-title{font-size:14px;font-weight:700;color:var(--text-h);}
.chat-main-sub{font-size:11px;color:var(--muted);text-transform:capitalize;}
.chat-conn-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;margin-left:auto;}
.chat-messages{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:2px;background-color:var(--shell-bg);background-image:radial-gradient(var(--shell-border-subtle) 1px, transparent 0),radial-gradient(var(--shell-border-subtle) 1px, transparent 0);background-size:20px 20px;background-position:0 0, 10px 10px;position:relative;}
.chat-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted);font-size:13px;gap:8px;z-index:2;}
.chat-bubble-row{display:flex;gap:8px;align-items:flex-end;z-index:2;}
.chat-bubble-row.own{flex-direction:row-reverse;}
.chat-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}
.chat-avatar-ph{width:28px;flex-shrink:0;}
.chat-bubble-wrap{max-width:65%;}
.chat-bubble-meta{font-size:10px;color:var(--muted);margin-bottom:3px;padding-left:2px;}
.chat-bubble-meta b{font-weight:600;}
.chat-bubble{border-radius:14px;padding:8px 12px;font-size:13px;line-height:1.5;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,0.05);}
.chat-bubble.theirs{background:var(--shell-panel);border:1px solid var(--shell-border);color:var(--text-h);border-radius:14px 14px 14px 4px;}
.chat-bubble.mine{background:linear-gradient(135deg,var(--accent),var(--accent-strong));color:#fff;border-radius:14px 14px 4px 14px;}
.chat-bubble-time{font-size:9px;opacity:.7;text-align:right;margin-top:2px;}
.chat-mention{background:var(--accent-bg);color:var(--accent);border-radius:4px;padding:1px 5px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--accent-border);}
.chat-mine .chat-mention{background:rgba(255,255,255,.2);color:#fff;border-color:rgba(255,255,255,.3);}
.chat-typing{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:11px;color:var(--muted);z-index:2;}
.chat-typing-dots{display:flex;gap:3px;align-items:center;}
.chat-typing-dot{width:5px;height:5px;border-radius:50%;background:var(--muted);animation:chatBounce 1.2s infinite;}
.chat-typing-dot:nth-child(2){animation-delay:.2s;}
.chat-typing-dot:nth-child(3){animation-delay:.4s;}
@keyframes chatBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
.chat-day-sep{display:flex;align-items:center;gap:10px;margin:14px 0 6px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.04em;z-index:2;}
.chat-day-sep::before,.chat-day-sep::after{content:'';flex:1;height:1px;background:var(--shell-border-subtle);}
.chat-bubble-time{font-size:10px;opacity:.65;margin-top:3px;text-align:right;}
.chat-input-area{padding:12px 16px;border-top:1px solid var(--shell-border-subtle);background:var(--shell-panel-strong);flex-shrink:0;position:relative;}
.chat-input-box{display:flex;gap:8px;align-items:flex-end;background:var(--shell-bg);border:1px solid var(--shell-border-strong);border-radius:12px;padding:8px 10px;transition:border-color .2s;}
.chat-input-box:focus-within{border-color:var(--accent-border);background:var(--card-bg);}
.chat-textarea{flex:1;background:transparent;border:none;outline:none;color:var(--text-h);font-size:13px;resize:none;line-height:1.5;font-family:var(--sans);max-height:100px;overflow-y:auto;}
.chat-textarea::placeholder{color:var(--muted);}
.chat-send-btn{width:32px;height:32px;border-radius:9px;border:none;background:linear-gradient(135deg,var(--accent),var(--accent-strong));color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;flex-shrink:0;box-shadow:0 4px 12px rgba(37,99,235,.24);}
.chat-send-btn:disabled{background:var(--shell-border-strong);box-shadow:none;cursor:not-allowed;}
.chat-send-btn:not(:disabled):hover{transform:scale(1.05);box-shadow:0 6px 16px rgba(37,99,235,.32);}
.chat-tip{font-size:10px;color:var(--muted);margin-top:5px;padding-left:2px;}
.chat-no-ch{flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;}

/* ── Interactive Mention Chips ── */
.chat-mention-chip{display:inline-flex;align-items:center;gap:4px;background:var(--accent-bg);color:var(--accent);border:1px solid var(--accent-border);border-radius:6px;padding:2px 6px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;margin:0 2px;}
.chat-mention-chip:hover{background:var(--accent);color:#fff;transform:translateY(-1px);box-shadow:0 4px 8px rgba(37,99,235,0.15);}
.chat-mention-chip.reserva{background:rgba(16,185,129,0.1);color:#10b981;border-color:rgba(16,185,129,0.2);}
.chat-mention-chip.reserva:hover{background:#10b981;color:#fff;}
.chat-mention-chip.pago{background:rgba(245,158,11,0.1);color:#f59e0b;border-color:rgba(245,158,11,0.2);}
.chat-mention-chip.pago:hover{background:#f59e0b;color:#fff;}
.chat-mention-chip.own-msg{background:rgba(255,255,255,0.2);color:#fff;border-color:rgba(255,255,255,0.35);}
.chat-mention-chip.own-msg:hover{background:#fff;color:var(--accent);box-shadow:0 4px 8px rgba(255,255,255,0.25);}

/* ── Emoji Picker ── */
.chat-emoji-picker{position:absolute;bottom:75px;left:16px;right:16px;background:var(--shell-panel-strong);border:1px solid var(--shell-border-strong);border-radius:12px;padding:8px;display:flex;gap:6px;box-shadow:0 8px 32px rgba(0,0,0,0.15);backdrop-filter:blur(10px);z-index:10;animation:fadeInUpEmoji 0.2s cubic-bezier(.22,1,.36,1);}
.chat-emoji-btn{background:transparent;border:none;font-size:20px;cursor:pointer;padding:6px;border-radius:8px;transition:all 0.15s;display:flex;align-items:center;justify-content:center;flex:1;}
.chat-emoji-btn:hover{background:var(--sidebar-item-hover);transform:scale(1.2);}
.chat-emoji-toggle-btn{background:transparent;border:none;font-size:18px;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;transition:all 0.15s;opacity:0.7;flex-shrink:0;}
.chat-emoji-toggle-btn:hover{opacity:1;transform:scale(1.1);}
@keyframes fadeInUpEmoji{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}

/* ── Mentions Autocomplete suggestions dropdown ── */
.chat-suggestions-dropdown{position:absolute;bottom:75px;left:16px;right:16px;background:var(--shell-panel-strong);border:1px solid var(--shell-border-strong);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,0.18);z-index:20;display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(10px);animation:fadeInUpEmoji 0.15s cubic-bezier(.22,1,.36,1);}
.chat-suggestion-header{padding:8px 12px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;border-bottom:1px solid var(--shell-border-subtle);background:var(--shell-panel);}
.chat-suggestion-list{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;}
.chat-suggestion-item{display:flex;flex-direction:column;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--shell-border-subtle);transition:all 0.15s;text-align:left;background:transparent;border-left:3px solid transparent;}
.chat-suggestion-item:last-child{border-bottom:none;}
.chat-suggestion-item:hover, .chat-suggestion-item.selected{background:var(--sidebar-item-active);border-left-color:var(--accent);}
.chat-sug-title{font-size:13px;font-weight:600;color:var(--text-h);display:flex;align-items:center;gap:6px;}
.chat-sug-sub{font-size:11px;color:var(--muted);margin-top:2px;}
.chat-sug-badge{font-size:9px;font-weight:700;padding:1px 4px;border-radius:4px;text-transform:uppercase;}
.chat-sug-badge.reserva{background:rgba(16,185,129,0.15);color:#10b981;}
.chat-sug-badge.pago{background:rgba(245,158,11,0.15);color:#f59e0b;}
.chat-sug-badge.habitacion{background:rgba(14,165,233,0.15);color:#0ea5e9;}
.chat-sug-badge.huesped{background:rgba(139,92,246,0.15);color:#8b5cf6;}

/* ── Scroll Bottom Button ── */
.chat-scroll-bottom-btn{position:absolute;bottom:85px;right:28px;width:34px;height:34px;border-radius:50%;background:var(--shell-panel-strong);border:1px solid var(--shell-border-strong);color:var(--text-h);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,0.12);transition:all .2s;z-index:9;animation:bounceScrollBtn 2s infinite;}
.chat-scroll-bottom-btn:hover{background:var(--card-bg);transform:scale(1.1);border-color:var(--accent-border);}
@keyframes bounceScrollBtn{0%,20%,50%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}60%{transform:translateY(-3px)}}

/* ── Premium Welcome State ── */
.chat-welcome-container{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);gap:16px;text-align:center;padding:24px;background-color:var(--shell-bg);background-image:radial-gradient(var(--shell-border-subtle) 1px, transparent 0),radial-gradient(var(--shell-border-subtle) 1px, transparent 0);background-size:20px 20px;background-position:0 0, 10px 10px;}
.chat-welcome-card{background:var(--shell-panel);border:1px solid var(--shell-border);border-radius:24px;padding:32px;max-width:380px;box-shadow:0 12px 32px rgba(15,23,42,.04);display:flex;flex-direction:column;align-items:center;gap:12px;animation:fadeInUpWelcome 0.4s cubic-bezier(.22,1,.36,1);}
.chat-welcome-icon{font-size:48px;animation:floatWelcomeIcon 3s ease-in-out infinite;}
@keyframes floatWelcomeIcon{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes fadeInUpWelcome{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}

/* ── Loading Skeletons ── */
.chat-messages-skeleton{display:flex;flex-direction:column;gap:12px;padding:16px 18px;flex:1;}
.chat-skeleton-row{display:flex;gap:8px;align-items:flex-end;}
.chat-skeleton-row.own{flex-direction:row-reverse;}
.chat-skeleton-avatar{width:28px;height:28px;border-radius:50%;background:var(--shell-border-subtle);flex-shrink:0;}
.chat-skeleton-bubble-wrap{display:flex;flex-direction:column;gap:4px;max-width:65%;}
.chat-skeleton-meta{width:60px;height:10px;border-radius:4px;background:var(--shell-border-subtle);}
.chat-skeleton-bubble{height:36px;border-radius:14px;background:var(--shell-border-subtle);}
.chat-skeleton-row.own .chat-skeleton-bubble{border-radius:14px 14px 4px 14px;}
.chat-skeleton-row:not(.own) .chat-skeleton-bubble{border-radius:14px 14px 14px 4px;}
.shimmer{background:linear-gradient(90deg, var(--shell-border-subtle) 25%, var(--shell-panel) 50%, var(--shell-border-subtle) 75%);background-size:200% 100%;animation:shimmerAnimation 1.5s infinite;}
@keyframes shimmerAnimation{0%{background-position:200% 0;}100%{background-position:-200% 0;}}

/* Modal */
.chat-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:200;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.chat-modal{background:var(--shell-panel-strong);border:1px solid var(--shell-border);border-radius:20px;padding:24px;width:340px;box-shadow:var(--shadow);animation:fadeInUp .25s cubic-bezier(.22,1,.36,1);}
.chat-modal h3{font-size:15px;font-weight:700;color:var(--text-h);margin:0 0 16px;}
.chat-modal-input{width:100%;border:1px solid var(--shell-border-strong);border-radius:10px;background:var(--shell-bg);color:var(--text-h);font-size:13px;padding:9px 12px;outline:none;box-sizing:border-box;font-family:var(--sans);margin-bottom:10px;transition:border-color .2s;}
.chat-modal-input:focus{border-color:var(--accent-border);}
.chat-modal-row{display:flex;gap:8px;margin-top:4px;}
.chat-modal-btn{flex:1;padding:9px;border-radius:10px;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:all .18s;}
.chat-modal-btn.cancel{background:var(--shell-bg);border:1px solid var(--shell-border-strong);color:var(--muted);}
.chat-modal-btn.cancel:hover{border-color:var(--shell-border-strong);color:var(--text-h);}
.chat-modal-btn.confirm{background:linear-gradient(135deg,var(--accent),var(--accent-strong));color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.24);}
.chat-modal-btn.confirm:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(37,99,235,.32);}
.chat-suggestion-tabs{display:flex;gap:6px;padding:8px 12px;background:var(--shell-panel-strong);border-bottom:1px solid var(--shell-border-subtle);overflow-x:auto;scrollbar-width:none;}
.chat-suggestion-tabs::-webkit-scrollbar{display:none;}
.chat-sug-tab-btn{background:var(--shell-bg);border:1px solid var(--shell-border-strong);color:var(--muted);border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all 0.15s;display:flex;align-items:center;gap:4px;}
.chat-sug-tab-btn:hover{background:var(--sidebar-item-hover);color:var(--text-h);border-color:var(--shell-border-strong);}
.chat-sug-tab-btn.active{background:var(--accent);color:#fff;border-color:var(--accent);box-shadow:0 2px 6px rgba(37,99,235,0.25);}
.chat-root.in-sidebar {
  height: 100%;
  background: transparent;
  border: none;
  border-radius: 0;
}
.chat-root.in-sidebar .chat-sidebar {
  width: 170px;
  margin: 8px 0 8px 8px;
  border-radius: 12px;
}
.chat-root.in-sidebar .chat-main {
  margin: 8px;
  border-radius: 12px;
}
.chat-root.in-sidebar .chat-ch-item {
  padding: 6px 8px 6px 10px;
  gap: 6px;
}
.chat-root.in-sidebar .chat-ch-name {
  font-size: 11.5px;
}
.chat-root.in-sidebar .chat-sidebar-title {
  font-size: 12px;
  gap: 4px;
}
.chat-root.in-sidebar .chat-user-foot {
  padding: 8px;
  gap: 6px;
}
.chat-root.in-sidebar .chat-avatar {
  width: 24px;
  height: 24px;
  font-size: 9px;
}
.chat-root.in-sidebar .chat-bubble {
  padding: 6px 10px;
  font-size: 12px;
}
.chat-root.in-sidebar .chat-main-head {
  padding: 8px 12px;
}
`;

interface SuggestionItem {
  type: 'reserva' | 'pago' | 'habitacion' | 'huesped';
  id: string;
  label: string;
  sublabel: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
const ChatOperativo: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
  const { user, session, loading: authLoading } = useAuth();
  const { role } = useRole();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // sender_id en chat_messages es UUID (auth.users.id), usar id primero
  const userId   = user?.id ?? user?.email ?? 'guest';
  const userName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const [channels, setChannels]     = useState<ChatChannel[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [messages, setMessages]     = useState<ChatMessage[]>([]);
  const [text, setText]             = useState('');
  const [sending, setSending]       = useState(false);
  const [loadingCh, setLoadingCh]   = useState(true);
  const [loadingMsg, setLoadingMsg] = useState(false);
  const [typing, setTyping]         = useState<TypingUser[]>([]);
  const [unread, setUnread]         = useState<Record<string, number>>({});
  const [connected, setConnected]   = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [newName, setNewName]       = useState('');
  const [newType, setNewType]       = useState<ChatChannel['channel_type']>('general');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Mentions autocomplete states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedSugIdx, setSelectedSugIdx] = useState(0);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState<'all' | 'reserva' | 'pago' | 'habitacion' | 'huesped'>('all');

  // Load bookings, payments, rooms and guests for autocomplete suggestions with role-based and channel-based security isolation
  useEffect(() => {
    const loadSuggestionsData = async () => {
      setLoadingSuggestions(true);
      try {
        const today = new Date();
        const desde = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const hasta = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const [resRes, resPag, resHab, resHue] = await Promise.allSettled([
          fetchReservas(desde, hasta),
          fetchPagos(),
          fetchHabitaciones(),
          fetchHuespedes()
        ]);

        const items: SuggestionItem[] = [];

        // Check if the current user is administrative staff
        const isStaff = ['PROPIETARIO', 'ADMIN', 'RECEPCIONISTA', 'MANTENIMIENTO', 'CONTADOR'].includes(role || '');

        // Resolve the active channel object to check if it's a client channel
        const activeChannel = channels.find(c => c.id === activeId);
        const isClientChannel = activeChannel?.channel_type === 'cliente';

        // Secure filtering parameters
        let myGuestId: string | null = null;
        let myGuestName: string | null = null;
        let myGuestEmail: string | null = null;

        if (isClientChannel) {
          // Inside a client-specific channel, restrict mentions to THAT client's records
          // regardless of who is typing (receptionist, admin, or the guest)!
          myGuestId = activeChannel?.guest_id ?? null;
          myGuestName = activeChannel?.guest_name ?? null;
          myGuestEmail = activeChannel?.guest_email ?? null;
        } else if (!isStaff && resHue.status === 'fulfilled') {
          // If a B2C client is chatting in general/any channel, isolate to their own data
          const myGuest = resHue.value.find(g => 
            g.correo?.toLowerCase() === user?.email?.toLowerCase()
          );
          if (myGuest) {
            myGuestId = myGuest.id_huesped ?? null;
            myGuestName = myGuest.nombre_completo ?? null;
            myGuestEmail = myGuest.correo ?? null;
          }
        }

        // Apply strict filter if it is a client channel or if the user is a B2C guest
        const enforceIsolation = isClientChannel || !isStaff;

        // Keep track of client-owned reservation IDs to restrict payment/room suggestions
        const myReservationIds = new Set<string>();
        const myRoomIds = new Set<string>();

        if (resRes.status === 'fulfilled') {
          resRes.value.forEach(r => {
            const rid = r.id_reserva_hotel ?? r.id_reserva ?? '';
            if (rid) {
              // Security validation: restricted view of reservations
              const isMine = enforceIsolation
                ? (myGuestId && r.id_huesped === myGuestId) || 
                  (r.huesped?.toLowerCase() === myGuestName?.toLowerCase()) ||
                  (myGuestEmail && r.correo?.toLowerCase() === myGuestEmail.toLowerCase()) ||
                  (!isStaff && r.huesped?.toLowerCase() === userName.toLowerCase())
                : true;

              if (isMine) {
                myReservationIds.add(rid);
                if (r.id_habitacion) myRoomIds.add(r.id_habitacion);

                items.push({
                  type: 'reserva',
                  id: rid,
                  label: `Reserva: ${r.huesped || 'Huésped Sin Nombre'}`,
                  sublabel: `Hab: ${r.habitacion || ''} · ${r.check_in?.split('T')[0]} a ${r.check_out?.split('T')[0]}`,
                });
              }
            }
          });
        }

        if (resPag.status === 'fulfilled') {
          resPag.value.forEach(p => {
            const pid = p.id_pago_hotel ?? '';
            if (pid) {
              // Security validation: restricted view of payments
              const isMine = enforceIsolation
                ? myReservationIds.has(p.id_reserva_hotel || '') ||
                  (p.huesped?.toLowerCase() === myGuestName?.toLowerCase()) ||
                  (!isStaff && p.huesped?.toLowerCase() === userName.toLowerCase())
                : true;

              if (isMine) {
                items.push({
                  type: 'pago',
                  id: pid,
                  label: `Pago: ${p.moneda} ${Number(p.monto).toLocaleString('es-HN')}`,
                  sublabel: `${p.huesped || 'Huésped'} · ${p.metodo_pago} (${p.fecha_pago?.split('T')[0]})`,
                });
              }
            }
          });
        }

        if (resHab.status === 'fulfilled') {
          resHab.value.forEach(h => {
            const hid = h.id_habitacion ?? '';
            if (hid) {
              // Security validation: restricted view of rooms
              const isMine = enforceIsolation ? myRoomIds.has(hid) : true;

              if (isMine) {
                items.push({
                  type: 'habitacion',
                  id: hid,
                  label: `Habitación: ${h.nombre_alias || h.nombre_habitacion}`,
                  sublabel: `${h.tipo || ''} · Tarifa: HNL ${Number(h.tarifa_noche).toLocaleString('es-HN')}`,
                });
              }
            }
          });
        }

        if (resHue.status === 'fulfilled') {
          resHue.value.forEach(g => {
            const gid = g.id_huesped ?? '';
            if (gid) {
              // Security validation: restricted view of guest profiles
              const isMine = enforceIsolation
                ? (gid === myGuestId || g.correo?.toLowerCase() === myGuestEmail?.toLowerCase() || (!isStaff && g.correo?.toLowerCase() === user?.email?.toLowerCase()))
                : true;

              if (isMine) {
                items.push({
                  type: 'huesped',
                  id: gid,
                  label: `Huésped: ${g.nombre_completo}`,
                  sublabel: `${g.correo || 'Sin correo'} · ${g.telefono || 'Sin tel'}`,
                });
              }
            }
          });
        }

        setSuggestions(items);
      } catch (err) {
        console.error('Error loading autocomplete mentions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    void loadSuggestionsData();
  }, [role, user, userName, activeId, channels]);

  const selectSuggestion = (item: SuggestionItem) => {
    setText(prev => {
      // Replace the last typed @word with the @type:uuid format
      return prev.replace(/@(\w*)$/, `@${item.type}:${item.id} `);
    });
    setShowSuggestions(false);
  };

  // Synchronize filtered suggestions when text, suggestions list, or active category filter changes
  useEffect(() => {
    const lastWordMatch = text.match(/@(\w*)$/);
    if (lastWordMatch) {
      const q = lastWordMatch[1].toLowerCase();
      
      const filtered = suggestions.filter(item => {
        // Apply text query match
        const matchesQuery = item.label.toLowerCase().includes(q) || 
                             item.sublabel.toLowerCase().includes(q) ||
                             item.type.toLowerCase().includes(q);
        
        // Apply dynamic tab filter
        const matchesCategory = suggestionFilter === 'all' || item.type === suggestionFilter;
        
        return matchesQuery && matchesCategory;
      });
      
      setFilteredSuggestions(filtered.slice(0, 8));
    } else {
      setFilteredSuggestions([]);
    }
  }, [text, suggestions, suggestionFilter]);

  const triggerQuickMention = () => {
    setText(prev => {
      const endsWithSpace = prev === '' || prev.endsWith(' ');
      const newText = endsWithSpace ? prev + '@' : prev + ' @';
      return newText;
    });
    setShowSuggestions(true);
    setSuggestionFilter('all');
    setSelectedSugIdx(0);
    
    // Focus the textarea
    setTimeout(() => {
      const textarea = document.querySelector('.chat-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 20);
  };

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '😮', '🎉', '💡'];
  const insertEmoji = (emoji: string) => {
    setText(p => p + emoji);
    setShowEmojiPicker(false);
  };

  const handleMentionClick = (type: string, id: string) => {
    if (type === 'reserva') {
      navigate('/reservas', { state: { highlightId: id } });
      addToast(`Navegando a reserva...`, 'success', 3000);
    } else if (type === 'pago') {
      navigate('/pagos', { state: { highlightId: id } });
      addToast(`Navegando a pago...`, 'success', 3000);
    } else if (type === 'huesped' || type === 'personal') {
      navigate(`/clientes/${id}`);
      addToast(`Navegando a cliente...`, 'success', 3000);
    } else if (type === 'habitacion') {
      navigate('/habitaciones', { state: { highlightId: id } });
      addToast(`Navegando a habitaciones...`, 'success', 3000);
    } else {
      navigator.clipboard.writeText(id);
      addToast(`ID copiado al portapapeles: ${id.slice(0, 8)}...`, 'info', 3000);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const endRef      = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCh      = useRef<string | null>(null);


  // load channels — filtrados por rol
  const loadChannels = useCallback(async () => {
    try {
      const data = await fetchChannels();
      // Solo mostrar canales a los que el rol tiene acceso
      const visible = data.filter(ch => canAccessChannel(role, ch.tipo ?? ch.channel_type ?? 'general'));
      setChannels(visible);
      const map: Record<string, number> = {};
      visible.forEach(ch => { map[ch.id] = ch.unread_count ?? 0; });
      setUnread(map);
      if (!activeId && data.length > 0) setActiveId(data[0].id);
    } finally { setLoadingCh(false); }
  }, [activeId]);

  useEffect(() => { if (!authLoading && user && session?.access_token) void loadChannels(); }, [loadChannels, authLoading, user, session?.access_token]);

  // load messages on channel switch
  useEffect(() => {
    if (!activeId) {
      sessionStorage.removeItem('active_chat_channel_id');
      return;
    }
    sessionStorage.setItem('active_chat_channel_id', activeId);
    setLoadingMsg(true); setMessages([]);
    if (prevCh.current && prevCh.current !== activeId) leaveChannel(prevCh.current);
    prevCh.current = activeId;
    joinChannel(activeId);
    void markChannelAsRead(activeId).catch(() => null);
    setUnread(u => ({ ...u, [activeId]: 0 }));
    fetchMessages(activeId).then(d => {
      setMessages(d); setLoadingMsg(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
    }).catch(() => setLoadingMsg(false));
    return () => {
      sessionStorage.removeItem('active_chat_channel_id');
    };
  }, [activeId]);

  // socket events — referencia estable con ref para evitar re-subscripciones
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => {
    const s = getSocket();
    
    // Función para reproducir un tono de timbre premium y cálido de doble tono (tipo campana de hotel)
    // usando la API nativa de Audio de HTML5. Funciona sin dependencias externas y sin archivos físicos.
    const playNotificationSound = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Primer tono (Nota D5 / 587.33 Hz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 0.3);

        // Segundo tono armónico más agudo con retraso de 120ms (Nota A5 / 880 Hz)
        setTimeout(() => {
          try {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, audioCtx.currentTime);
            gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.4);
          } catch { /* silent */ }
        }, 120);
      } catch (e) {
        console.error('AudioContext error:', e);
      }
    };

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => { setConnected(false); setTimeout(() => s.connect(), 3000); };
    
    const onMsg = (msg: ChatMessage) => {
      const isOwn = msg.sender_id === userId || msg.sender_id === user?.id || msg.sender_name === userName || msg.sender_name?.startsWith(`${userName} `);
      if (msg.channel_id === activeIdRef.current) {
        setMessages(p => [...p, msg]);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
        if (!isOwn) {
          playNotificationSound();
        }
      } else {
        setUnread(u => ({ ...u, [msg.channel_id]: (u[msg.channel_id] ?? 0) + 1 }));
        const chName = msg.sender_name || 'Alguien';
        addToast(`${chName}: ${msg.content.slice(0, 60)}`, 'info', 4000);
        if (!isOwn) {
          playNotificationSound();
        }
      }
    };

    const onNewChannel = (ch: ChatChannel) => {
      setChannels(p => {
        if (p.some(c => c.id === ch.id)) return p;
        return [...p, ch];
      });
      playNotificationSound();
      addToast(`Nuevo canal de chat: ${ch.name}`, 'success', 6000);
    };

    const onNewClientChat = (data: { channel: ChatChannel; mensaje: string }) => {
      setChannels(p => {
        if (p.some(c => c.id === data.channel.id)) return p;
        return [...p, data.channel];
      });
      playNotificationSound();
      addToast(data.mensaje || 'Nuevo chat de cliente', 'success', 6000);
    };

    const onTyping     = (d: TypingUser) => { if (d.userId !== userId) setTyping(p => p.some(u => u.userId === d.userId) ? p : [...p, d]); };
    const onStopTyping = (d: TypingUser) => setTyping(p => p.filter(u => u.userId !== d.userId));

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('new_message', onMsg);
    s.on('new_channel', onNewChannel);
    s.on('new_client_chat', onNewClientChat);
    s.on('user_typing', onTyping);
    s.on('user_stop_typing', onStopTyping);
    if (s.connected) setConnected(true); else s.connect();

    return () => {
      s.off('connect', onConnect); s.off('disconnect', onDisconnect);
      s.off('new_message', onMsg); s.off('new_channel', onNewChannel);
      s.off('new_client_chat', onNewClientChat); s.off('user_typing', onTyping); s.off('user_stop_typing', onStopTyping);
    };
  }, [userId, addToast, userName]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !activeId || sending) return;
    const c = text.trim(); setText(''); setSending(true);
    if (activeId) emitStopTyping(activeId, { userId, userName });
    try { await sendMessage(activeId, c, 'text', { sender_name: userName }); } catch { setText(c); } finally { setSending(false); }
  }, [text, activeId, sending, userId, userName]);

  const handleTyping = (val: string) => {
    setText(val);
    if (!activeId) return;
    emitTyping(activeId, { userId, userName });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitStopTyping(activeId, { userId, userName }), 2000);

    // Mapear disparador de menciones cuando se escribe @
    const lastWordMatch = val.match(/@(\w*)$/);
    if (lastWordMatch) {
      setShowSuggestions(true);
      setSelectedSugIdx(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (!canDo(role, 'chat', 'crear_canal')) return;
    try {
      const ch = await createChannel({ name: newName.trim(), channel_type: newType });
      setChannels(p => [...p, ch]); setActiveId(ch.id); setShowModal(false); setNewName('');
    } catch { /* ignore */ }
  };

  const handleDelete = async (ch: ChatChannel, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el canal "${ch.name}" y todos sus mensajes?`)) return;
    try {
      await deleteChannel(ch.id);
      setChannels(p => p.filter(c => c.id !== ch.id));
      if (activeId === ch.id) setActiveId(channels.find(c => c.id !== ch.id)?.id ?? null);
    } catch { alert('No se pudo eliminar el canal'); }
  };

  const active     = channels.find(c => c.id === activeId);
  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <>
      <style>{CSS}</style>
      <div className={`chat-root${embedded ? ' in-sidebar' : ''}`}>

        {/* ── Sidebar ── */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-head">
            <span className="chat-sidebar-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Chat
              {totalUnread > 0 && <span className="chat-sidebar-badge">{totalUnread}</span>}
            </span>
            {canDo(role, 'chat', 'crear_canal') && (
              <button className="chat-sidebar-add" onClick={() => setShowModal(true)} title="Nuevo canal">+</button>
            )}
          </div>

          <div className="chat-ch-list">
            {loadingCh ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>Cargando…</div>
            ) : channels.map(ch => {
              const u = unread[ch.id] ?? 0;
              return (
                <div
                  key={ch.id}
                  className={`chat-ch-item${ch.id === activeId ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveId(ch.id)}
                  onKeyDown={e => e.key === 'Enter' && setActiveId(ch.id)}
                >
                  <ChannelIcon type={ch.channel_type} size={15} />
                  <span className="chat-ch-name" style={{ paddingRight: u > 0 ? 0 : 20 }}>{ch.name}</span>
                  {u > 0 && <span className="chat-ch-unread">{u}</span>}
                  {canDo(role, 'chat', 'eliminar_canal') && (
                    <button className="chat-ch-del" onClick={(e) => void handleDelete(ch, e)} title="Eliminar canal">✕</button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="chat-user-foot">
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${hueFrom(userName)},60%,55%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials(userName)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="chat-user-name">{userName}</div>
              <div className="chat-user-status" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div className="chat-conn-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--success)' : 'var(--muted)', display: 'inline-block' }} />
                {connected ? 'En línea' : 'Reconectando…'}
              </div>
            </div>
          </div>
        </div>
        <div className="chat-main">
          {!active ? (
            <div className="chat-welcome-container">
              <div className="chat-welcome-card">
                <div className="chat-welcome-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <h3 style={{ color: 'var(--text-h)', fontWeight: 700, fontSize: 16, margin: 0 }}>Buzón Operativo Verona</h3>
                <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>Selecciona un canal de la barra lateral para ver mensajes o iniciar una conversación.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="chat-main-head">
                <div style={{ width: 34, height: 34, borderRadius: 10, background: `${CH_COLOR[active.channel_type] ?? 'var(--accent)'}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ChannelIcon type={active.channel_type} size={18} />
                </div>
                <div>
                  <div className="chat-main-title">{active.name}</div>
                  <div className="chat-main-sub">{CH_LABEL[active.channel_type] ?? active.channel_type}</div>
                </div>
                <div className="chat-conn-dot" style={{ background: connected ? 'var(--success)' : 'var(--danger)' }} title={connected ? 'Conectado' : 'Sin conexión'} />
              </div>

              {/* Messages */}
              <div className="chat-messages" onScroll={handleScroll}>
                {loadingMsg ? (
                  <div className="chat-messages-skeleton">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`chat-skeleton-row ${i % 2 === 0 ? 'own' : ''}`}>
                        {i % 2 !== 0 && <div className="chat-skeleton-avatar shimmer" />}
                        <div className="chat-skeleton-bubble-wrap">
                          <div className="chat-skeleton-meta shimmer" />
                          <div className="chat-skeleton-bubble shimmer" style={{ width: i === 1 ? '180px' : i === 2 ? '120px' : '220px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>No hay mensajes. ¡Sé el primero en escribir!</span>
                  </div>
                ) : messages.map((msg, idx) => {
                  const isOwn      = msg.sender_id === userId || msg.sender_id === user?.id || msg.sender_name === userName || msg.sender_name?.startsWith(`${userName} `);
                  const prev       = messages[idx - 1];
                  const showHeader = !prev || prev.sender_id !== msg.sender_id;
                  const showDay    = !prev || fmtDay(prev.created_at) !== fmtDay(msg.created_at);
                  const { parts }  = formatMessageContent(msg.content);
                  const hue        = hueFrom(msg.sender_name);

                  return (
                    <React.Fragment key={msg.id}>
                      {showDay && <div className="chat-day-sep">{fmtDay(msg.created_at)}</div>}
                      <div className={`chat-bubble-row${isOwn ? ' own' : ''}`} style={{ marginTop: showHeader ? 8 : 2 }}>
                        {!isOwn && showHeader
                          ? <div className="chat-avatar" style={{ background: `hsl(${hue},60%,55%)` }}>{initials(msg.sender_name)}</div>
                          : !isOwn && <div className="chat-avatar-ph" />}

                        <div className="chat-bubble-wrap">
                          {showHeader && !isOwn && (
                            <div className="chat-bubble-meta">
                              <b style={{ color: `hsl(${hue},55%,40%)` }}>{msg.sender_name}</b>
                            </div>
                          )}
                          <div className={`chat-bubble ${isOwn ? 'mine' : 'theirs'}`}>
                            {msg.message_type === 'system'
                              ? <span style={{ fontStyle: 'italic', opacity: .7 }}>{msg.content}</span>
                              : parts.map((p, i) =>
                                  p.isMention ? (
                                    <span
                                      key={i}
                                      className={`chat-mention-chip ${p.type || ''} ${isOwn ? 'own-msg' : ''}`}
                                      title={`Haga clic para ver detalles de ${p.type}`}
                                      onClick={() => handleMentionClick(p.type!, p.id!)}
                                    >
                                      <span className="mention-icon">
                                        {p.type === 'reserva' && 'R'}
                                        {p.type === 'pago' && 'P'}
                                        {p.type === 'huesped' && 'H'}
                                        {p.type === 'habitacion' && 'Hab'}
                                        {p.type === 'factura' && 'F'}
                                        {p.type === 'cierre' && 'C'}
                                        {p.type === 'personal' && 'Per'}
                                      </span>
                                      <span className="mention-text">@{p.type}:{p.id?.slice(0, 8)}</span>
                                    </span>
                                  ) : (
                                    <span key={i}>{p.text}</span>
                                  )
                                )
                            }
                          </div>
                          <div className="chat-bubble-time" style={{ textAlign: isOwn ? 'right' : 'left' }}>{fmtTime(msg.created_at)}</div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {typing.length > 0 && (
                  <div className="chat-typing">
                    <div className="chat-typing-dots">{[0,1,2].map(i => <div key={i} className="chat-typing-dot" />)}</div>
                    <span>{typing.map(u => u.userName).join(', ')} está escribiendo…</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {showScrollBottom && (
                <button className="chat-scroll-bottom-btn" onClick={scrollToBottom} title="Ir al final">
                  ▼
                </button>
              )}

              {/* Input */}
              <div className="chat-input-area">
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="chat-suggestions-dropdown">
                    <div className="chat-suggestion-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Menciones (Usa ⇅ para navegar, Enter para insertar)</span>
                      <button
                        onClick={() => setShowSuggestions(false)}
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Cerrar
                      </button>
                    </div>
                    
                    {/* Filtros rápidos interactivos */}
                    <div className="chat-suggestion-tabs">
                      <button
                        className={`chat-sug-tab-btn ${suggestionFilter === 'all' ? 'active' : ''}`}
                        onClick={() => { setSuggestionFilter('all'); setSelectedSugIdx(0); }}
                      >
                        Todos
                      </button>
                      <button
                        className={`chat-sug-tab-btn ${suggestionFilter === 'reserva' ? 'active' : ''}`}
                        onClick={() => { setSuggestionFilter('reserva'); setSelectedSugIdx(0); }}
                      >
                        Reservas
                      </button>
                      <button
                        className={`chat-sug-tab-btn ${suggestionFilter === 'pago' ? 'active' : ''}`}
                        onClick={() => { setSuggestionFilter('pago'); setSelectedSugIdx(0); }}
                      >
                        Pagos
                      </button>
                      <button
                        className={`chat-sug-tab-btn ${suggestionFilter === 'habitacion' ? 'active' : ''}`}
                        onClick={() => { setSuggestionFilter('habitacion'); setSelectedSugIdx(0); }}
                      >
                        Habitaciones
                      </button>
                      <button
                        className={`chat-sug-tab-btn ${suggestionFilter === 'huesped' ? 'active' : ''}`}
                        onClick={() => { setSuggestionFilter('huesped'); setSelectedSugIdx(0); }}
                      >
                        Huéspedes
                      </button>
                    </div>

                    <div className="chat-suggestion-list">
                      {filteredSuggestions.map((item, idx) => (
                        <div
                          key={item.type + '-' + item.id}
                          className={`chat-suggestion-item${idx === selectedSugIdx ? ' selected' : ''}`}
                          onClick={() => selectSuggestion(item)}
                        >
                          <div className="chat-sug-title">
                            <span className={`chat-sug-badge ${item.type}`}>
                              {item.type.toUpperCase()}
                            </span>
                            <span style={{ fontWeight: 600 }}>{item.label}</span>
                          </div>
                          <div className="chat-sug-sub">{item.sublabel}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showEmojiPicker && (
                  <div className="chat-emoji-picker">
                    {QUICK_EMOJIS.map(em => (
                      <button key={em} className="chat-emoji-btn" onClick={() => insertEmoji(em)}>
                        {em}
                      </button>
                    ))}
                  </div>
                )}
                <div className="chat-input-box">
                  <textarea
                    className="chat-textarea"
                    rows={1}
                    value={text}
                    placeholder={`Escribe en ${active.name}… Escribe @ para mencionar reservas, pagos, habitaciones o huéspedes`}
                    onChange={e => handleTyping(e.target.value)}
                    onKeyDown={e => {
                      if (showSuggestions && filteredSuggestions.length > 0) {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSelectedSugIdx(p => (p + 1) % filteredSuggestions.length);
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSelectedSugIdx(p => (p - 1 + filteredSuggestions.length) % filteredSuggestions.length);
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          selectSuggestion(filteredSuggestions[selectedSugIdx]);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          setShowSuggestions(false);
                        }
                      } else {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }
                    }}
                  />
                  <button 
                    className="chat-mention-toggle-btn" 
                    onClick={triggerQuickMention} 
                    title="Mención rápida (@)"
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '15px',
                      cursor: 'pointer',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.7,
                      transition: 'all 0.15s',
                      flexShrink: 0,
                      color: 'var(--accent)',
                      fontWeight: 'bold'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    @
                  </button>
                  <button className="chat-emoji-toggle-btn" onClick={() => setShowEmojiPicker(p => !p)} title="Insertar emoji" style={{ fontSize: 14, fontWeight: 700 }}>
                    +
                  </button>
                  <button className="chat-send-btn" disabled={!text.trim() || sending} onClick={() => void handleSend()}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
                <div className="chat-tip">Tip: Escribe @ y filtra por nombre o monto para hacer menciones dinámicas y rápidas.</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modal nuevo canal ── */}
      {showModal && (
        <div className="chat-modal-bg" onClick={() => setShowModal(false)}>
          <div className="chat-modal" onClick={e => e.stopPropagation()}>
            <h3>Nuevo canal</h3>
            <input
              className="chat-modal-input" autoFocus placeholder="Nombre del canal"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleCreate()}
            />
            <select
              className="chat-modal-input"
              value={newType}
              onChange={e => setNewType(e.target.value as ChatChannel['channel_type'])}
            >
              <option value="general">General</option>
              <option value="hotel">Hotel</option>
              <option value="operativo">Operativo</option>
              <option value="privado">Privado</option>
              <option value="cierre">Cierre</option>
            </select>
            <div className="chat-modal-row">
              <button className="chat-modal-btn cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="chat-modal-btn confirm" onClick={() => void handleCreate()}>Crear canal</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatOperativo;
