export interface ChatChannel {
  id: string;
  name: string;
  description?: string;
  channel_type: 'operativo' | 'cliente' | 'privado' | 'cierre';
  created_by: string;
  created_at: string;
  is_active: boolean;
  guest_email?: string;
  guest_name?: string;
  unread_count?: number;
  metadata?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  message_type: 'text' | 'data_card' | 'cierre_share' | 'system' | 'file';
  file_url?: string;
  file_name?: string;
  created_at: string;
  updated_at: string;
  edited_at?: string;
  edited_by?: string;
  is_deleted: boolean;
  chat_references?: ChatReference[];
}

export interface ChatReference {
  id: string;
  message_id: string;
  entity_type: 'reserva' | 'pago' | 'huesped' | 'habitacion' | 'factura' | 'cierre' | 'personal';
  entity_id: string;
  entity_data?: Record<string, any>;
  created_at: string;
}

export interface ChatReadStatus {
  user_id: string;
  channel_id: string;
  last_read_at: string;
  unread_count: number;
}

export interface ChatNotification {
  id: string;
  user_id: string;
  channel_id: string;
  message_id?: string;
  notification_type: 'new_message' | 'mention' | 'channel_invite' | 'typing';
  title: string;
  body?: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
  channelId: string;
}

export type EntityType = 'reserva' | 'pago' | 'huesped' | 'habitacion' | 'factura' | 'cierre' | 'personal';

export interface EntityData {
  type: EntityType;
  id: string;
  [key: string]: any;
}
