import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, TypingUser } from '../types/chat';

const SOCKET_URL = (() => {
  if (typeof window !== 'undefined' && window.location.protocol === 'file:')
    return 'http://localhost:4000';
  const base = import.meta.env.VITE_API_BASE_URL?.trim();
  if (base) return base.replace(/\/api\/?$/, '');
  if (typeof window !== 'undefined' && !import.meta.env.DEV)
    return window.location.origin;
  return 'http://localhost:4000';
})();

interface UseChatOptions {
  channelId?: string;
  onNewMessage?: (message: ChatMessage) => void;
  onUnreadUpdate?: () => void;
  onUserTyping?: (user: TypingUser) => void;
  onUserStopTyping?: (userId: string) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conectar Socket.io
  useEffect(() => {
    if (!user?.id) return;

    try {
      socketRef.current = io(SOCKET_URL, {
        auth: {
          userId: user.id,
          email: user.email,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socketRef.current.on('connect', () => {
        console.log('✅ Conectado a socket.io');
        setConnected(true);
        setError(null);
      });

      socketRef.current.on('disconnect', () => {
        console.log('❌ Desconectado de socket.io');
        setConnected(false);
      });

      socketRef.current.on('new_message', (msg: ChatMessage) => {
        options.onNewMessage?.(msg);
      });

      socketRef.current.on('unread_update', () => {
        options.onUnreadUpdate?.();
      });

      socketRef.current.on('user_typing', (user: TypingUser) => {
        options.onUserTyping?.(user);
      });

      socketRef.current.on('user_stop_typing', (data: { userId: string }) => {
        options.onUserStopTyping?.(data.userId);
      });

      socketRef.current.on('error', (err: any) => {
        console.error('Socket.io error:', err);
        setError(err?.message || 'Error en conexión');
      });

      return () => {
        if (socketRef.current?.connected) {
          socketRef.current.disconnect();
        }
      };
    } catch (err) {
      console.error('Error initializing socket:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }, [user?.id, user?.email, options]);

  // Emitir unirse a canal
  const joinChannel = useCallback((channelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_channel', channelId);
      console.log(`Unido a canal: ${channelId}`);
    }
  }, []);

  // Emitir salir de canal
  const leaveChannel = useCallback((channelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_channel', channelId);
      console.log(`Salido de canal: ${channelId}`);
    }
  }, []);

  // Emitir escritura
  const emitTyping = useCallback((channelId: string, userName: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', channelId, {
        userId: user?.id,
        userName,
        channelId,
      });
    }
  }, [user?.id]);

  // Parar de escribir
  const emitStopTyping = useCallback((channelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stop_typing', channelId, {
        userId: user?.id,
        channelId,
      });
    }
  }, [user?.id]);

  return {
    socket: socketRef.current,
    connected,
    error,
    joinChannel,
    leaveChannel,
    emitTyping,
    emitStopTyping,
  };
}
