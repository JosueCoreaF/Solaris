import { io, Socket } from 'socket.io-client';
import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
const WS_URL   = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace('/api', '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatChannel {
  id: string;
  name: string;
  channel_type: 'general' | 'operativo' | 'cliente' | 'privado';
  created_by: string;
  created_at: string;
  is_active: boolean;
  /** UUID del huésped vinculado al canal (columna real en DB) */
  id_huesped?: string | null;
  /** Alias de id_huesped para compatibilidad con ChatOperativo */
  guest_id?: string | null;
  guest_email?: string | null;
  guest_name?: string | null;
  metadata?: Record<string, any>;
  unread_count?: number;
}

export interface ChatReference {
  id: string;
  entity_type: 'reserva' | 'pago' | 'huesped' | 'habitacion' | 'factura';
  entity_id: string;
  entity_data?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'data_card' | 'system' | 'file';
  file_url?: string;
  file_name?: string;
  metadata?: Record<string, any>;
  created_at: string;
  edited_at?: string;
  is_deleted?: boolean;
  chat_references?: ChatReference[];
}

export interface TypingUser {
  userId: string;
  userName: string;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Obtener token de Supabase — import estático, igual que el resto del proyecto
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const activeHotelId = localStorage.getItem('active_hotel_id') || '';

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Hotel-ID': activeHotelId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

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

export async function fetchEntity(type: ChatReference['entity_type'], id: string): Promise<Record<string, any>> {
  return apiFetch<Record<string, any>>(`/chat/entity/${type}/${id}`);
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

// ─── Channel type helpers ─────────────────────────────────────────────────────

export function getChannelIcon(type: ChatChannel['channel_type']): string {
  const icons: Record<ChatChannel['channel_type'], string> = {
    general:   'general',
    hotel:     'hotel',
    operativo: 'operativo',
    cliente:   'cliente',
    privado:   'privado',
    cierre:    'cierre',
  };
  return icons[type] ?? 'general';
}

export function getChannelColor(type: ChatChannel['channel_type']): string {
  const colors: Record<ChatChannel['channel_type'], string> = {
    general:   '#6366f1',
    hotel:     '#0ea5e9',
    operativo: '#f59e0b',
    cliente:   '#10b981',
    privado:   '#8b5cf6',
    cierre:    '#ef4444',
  };
  return colors[type] ?? '#6366f1';
}

/** Parse @entity:uuid mentions from message content */
export function parseMentions(content: string): Array<{ full: string; type: string; id: string }> {
  const regex = /@(reserva|pago|huesped|habitacion|factura):([0-9a-f-]{36})/gi;
  const matches = [...content.matchAll(regex)];
  return matches.map(m => ({ full: m[0], type: m[1], id: m[2] }));
}

/** Format content so @entity:uuid becomes a clickable chip */
export function formatMessageContent(content: string): { parts: Array<{ text: string; isMention: boolean; type?: string; id?: string }> } {
  const regex = /@(reserva|pago|huesped|habitacion|factura):([0-9a-f-]{36})/gi;
  const parts: Array<{ text: string; isMention: boolean; type?: string; id?: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) {
      parts.push({ text: content.slice(last, match.index), isMention: false });
    }
    parts.push({ text: `@${match[1]}`, isMention: true, type: match[1], id: match[2] });
    last = regex.lastIndex;
  }
  if (last < content.length) {
    parts.push({ text: content.slice(last), isMention: false });
  }
  return { parts };
}

// ─── Bot with Context ─────────────────────────────────────────────────────────

export interface BotContextParams {
  message: string;
  userId?: string;
  channelId?: string;
  hotelId?: string;
}

export interface BotContextResponse {
  response: string;
  message?: ChatMessage;
}

/**
 * Envía un mensaje al bot y obtiene una respuesta con contexto mejorado
 * El bot usa Claude API (si está disponible) con información del hotel y reservas del usuario
 */
export async function sendBotMessage(params: BotContextParams): Promise<BotContextResponse> {
  try {
    const response = await fetch(`${API_BASE}/chat/bot/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error en sendBotMessage:', error);
    throw error;
  }
}

/**
 * Obtiene FAQs relevantes basadas en un mensaje del usuario
 * Útil para mostrar sugerencias rápidas sin necesidad de llamar al bot
 */
export async function getRelevantFAQs(message: string): Promise<Array<{ pregunta: string; respuesta: string; categoria: string }>> {
  try {
    // Esta función podría llamar a un endpoint backend que implemente la búsqueda de FAQs
    // Por ahora, retorna un array vacío y debe implementarse en el backend
    console.log('getRelevantFAQs para:', message);
    return [];
  } catch (error) {
    console.error('Error en getRelevantFAQs:', error);
    return [];
  }
}
