import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMensaje {
  id_chat: string;
  id_restaurant: string;
  nombre_remitente: string;
  avatar_color: string;
  mensaje: string;
  created_at: string;
}

export async function getChatMensajes(id_restaurant: string, limit = 50): Promise<ChatMensaje[]> {
  const { data, error } = await supabase
    .from('chat_restaurante')
    .select('*')
    .eq('id_restaurant', id_restaurant)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function sendChatMensaje(payload: {
  id_restaurant: string;
  nombre_remitente: string;
  avatar_color?: string;
  mensaje: string;
}): Promise<ChatMensaje> {
  const { data, error } = await supabase
    .from('chat_restaurante')
    .insert({ ...payload, avatar_color: payload.avatar_color ?? '#f97316' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChatMensaje(id_chat: string): Promise<void> {
  const { error } = await supabase.from('chat_restaurante').delete().eq('id_chat', id_chat);
  if (error) throw error;
}

export function subscribeChatMensajes(
  id_restaurant: string,
  onInsert: (msg: ChatMensaje) => void,
  onDelete: (id_chat: string) => void,
): RealtimeChannel {
  return supabase
    .channel(`chat_restaurante:${id_restaurant}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_restaurante', filter: `id_restaurant=eq.${id_restaurant}` },
      (payload) => onInsert(payload.new as ChatMensaje),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'chat_restaurante', filter: `id_restaurant=eq.${id_restaurant}` },
      (payload) => onDelete((payload.old as ChatMensaje).id_chat),
    )
    .subscribe();
}
