import { supabase } from './supabase';

export interface ChatbotConfig {
  id_config: string;
  id_restaurant: string;
  nombre_bot: string;
  bienvenida: string;
  system_prompt: string;
  activo: boolean;
  updated_at: string;
}

export async function getChatbotConfig(id_restaurant: string): Promise<ChatbotConfig | null> {
  const { data } = await supabase
    .from('chatbot_config_restaurant')
    .select('*')
    .eq('id_restaurant', id_restaurant)
    .maybeSingle();
  return data;
}

export async function upsertChatbotConfig(config: Omit<ChatbotConfig, 'id_config' | 'updated_at'>): Promise<ChatbotConfig> {
  const { data, error } = await supabase
    .from('chatbot_config_restaurant')
    .upsert({ ...config, updated_at: new Date().toISOString() }, { onConflict: 'id_restaurant' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export interface ChatbotMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendChatbotMessage(
  messages: ChatbotMessage[],
  systemPrompt: string,
  restaurantContext: string,
): Promise<string> {
  const headers = await authHeaders();
  const fullSystem = `${systemPrompt}\n\n--- CONTEXTO DEL RESTAURANTE ---\n${restaurantContext}`;

  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      messages,
      system: fullSystem,
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'Error desconocido');
    throw new Error(err);
  }

  const json = await res.json();
  return json.content?.[0]?.text ?? json.response ?? json.message ?? 'Sin respuesta.';
}
