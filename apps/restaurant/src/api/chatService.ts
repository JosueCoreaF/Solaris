import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const WS_URL   = API_BASE.replace(/\/api\/?$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  name: string;
  channel_type: 'general' | 'cocina' | 'servicio' | 'caja' | 'privado';
  created_by: string;
  created_at: string;
  is_active: boolean;
  metadata?: Record<string, any>;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'data_card' | 'system';
  metadata?: Record<string, any>;
  created_at: string;
  edited_at?: string;
  is_deleted?: boolean;
}

export interface TypingUser {
  userId: string;
  userName: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  for (const delay of [150, 400, 800]) {
    await new Promise(r => setTimeout(r, delay));
    const { data: retry } = await supabase.auth.getSession();
    if (retry.session?.access_token) return retry.session.access_token;
  }
  return null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let token = await getToken();
  if (!token) throw new Error('No autenticado');
  const restaurantId = localStorage.getItem('active_restaurant_id') || '';

  const makeRequest = async (t: string) => fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Restaurant-ID': restaurantId,
      Authorization: `Bearer ${t}`,
      ...options.headers,
    },
  });

  let res = await makeRequest(token);

  if (res.status === 401) {
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData?.session?.access_token) {
      token = refreshData.session.access_token;
      res = await makeRequest(token);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json();
}

// ─── REST API ─────────────────────────────────────────────────────────────────

export async function fetchChannels(): Promise<ChatChannel[]> {
  return apiFetch<ChatChannel[]>('/chat/channels');
}

export async function fetchMessages(channelId: string, limit = 60, offset = 0): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/chat/channels/${channelId}/messages?limit=${limit}&offset=${offset}`);
}

export async function sendMessage(
  channelId: string,
  content: string,
  messageType: ChatMessage['message_type'] = 'text',
  metadata: Record<string, any> = {},
): Promise<ChatMessage> {
  const { sender_name, ...restMeta } = metadata;
  return apiFetch<ChatMessage>(`/chat/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, message_type: messageType, metadata: restMeta, sender_name }),
  });
}

export async function createChannel(params: {
  name: string;
  channel_type?: ChatChannel['channel_type'];
  description?: string;
}): Promise<ChatChannel> {
  return apiFetch<ChatChannel>('/chat/channels', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function markChannelAsRead(channelId: string): Promise<void> {
  await apiFetch<void>(`/chat/channels/${channelId}/read`, { method: 'PUT' });
}

export async function deleteChannel(channelId: string): Promise<void> {
  await apiFetch<void>(`/chat/channels/${channelId}`, { method: 'DELETE' });
}

// ─── Socket.io ────────────────────────────────────────────────────────────────

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinChannel(channelId: string): void {
  getSocket().emit('join_channel', channelId);
}

export function leaveChannel(channelId: string): void {
  getSocket().emit('leave_channel', channelId);
}

export function emitTyping(channelId: string, userData: { userId: string; userName: string }): void {
  getSocket().emit('typing', channelId, userData);
}

export function emitStopTyping(channelId: string, userData: { userId: string; userName: string }): void {
  getSocket().emit('stop_typing', channelId, userData);
}

// ─── Channel helpers ──────────────────────────────────────────────────────────

export function getChannelColor(type: ChatChannel['channel_type']): string {
  const colors: Record<ChatChannel['channel_type'], string> = {
    general:  '#f97316',
    cocina:   '#ef4444',
    servicio: '#3b82f6',
    caja:     '#10b981',
    privado:  '#8b5cf6',
  };
  return colors[type] ?? '#f97316';
}

export function getChannelLabel(type: ChatChannel['channel_type']): string {
  const labels: Record<ChatChannel['channel_type'], string> = {
    general:  'General',
    cocina:   'Cocina',
    servicio: 'Servicio',
    caja:     'Caja',
    privado:  'Privado',
  };
  return labels[type] ?? type;
}

export function formatMessageContent(content: string): { parts: Array<{ text: string; isMention: boolean; type?: string; id?: string }> } {
  const regex = /@(pedido|mesa|cliente|platillo|reserva):([0-9a-f-]{36})/gi;
  const parts: Array<{ text: string; isMention: boolean; type?: string; id?: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) parts.push({ text: content.slice(last, match.index), isMention: false });
    parts.push({ text: `@${match[1]}`, isMention: true, type: match[1], id: match[2] });
    last = regex.lastIndex;
  }
  if (last < content.length) parts.push({ text: content.slice(last), isMention: false });
  return { parts };
}
