import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { getSocket, fetchChannels } from '../api/chatService';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';
import { RightSidebarChat } from './RightSidebarChat';
import { WelcomeAnimation } from './WelcomeAnimation';

export const Layout: React.FC = () => {
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';
  const { addToast } = useToast();
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.email || 'anon';
  const userName = user?.email?.split('@')[0] || 'Personal';
  // Token directo desde el contexto (siempre disponible cuando session existe)
  const accessToken = session?.access_token ?? null;

  // Animación de bienvenida tras un login exitoso. El Login no puede mostrarla
  // porque el GuestGuard redirige a "/" en cuanto la sesión se actualiza.
  const [welcomeNombre, setWelcomeNombre] = useState<string | null>(null);
  useEffect(() => {
    const pendiente = sessionStorage.getItem('pendingWelcomeNombre');
    if (pendiente) {
      sessionStorage.removeItem('pendingWelcomeNombre');
      setWelcomeNombre(pendiente);
    }
  }, []);

  useEffect(() => {
    const s = getSocket();

    // 1. Sonido de Timbre de Hotel Premium (Campana Doble) para Chats e Hilos
    const playChatChime = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Primer tono (Nota D5 / 587.33 Hz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
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
            gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 0.4);
          } catch { /* silent */ }
        }, 120);
      } catch (e) {
        console.error('Audio error:', e);
      }
    };

    // 2. Sonido Triunfal / Arpegio Elevado de Éxito para Nuevas Reservas (C5 -> E5 -> G5 -> C6)
    const playReservationArpeggio = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.50];
        
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            try {
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
              gain.gain.setValueAtTime(0.10, audioCtx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.45);
            } catch { /* silent */ }
          }, idx * 100);
        });
      } catch (e) {
        console.error('Audio error:', e);
      }
    };

    const onUnreadUpdate = () => {
      // Solo hacer fetch si tenemos token disponible
      if (!accessToken) return;
      fetchChannels()
        .then(chs => {
          const total = chs.reduce((sum, ch) => sum + (ch.unread_count ?? 0), 0);
          try {
            sessionStorage.setItem('chat-unread-count', total.toString());
          } catch {}
          window.dispatchEvent(new CustomEvent('chat-unread-update', { detail: total }));
        })
        .catch(() => {});
    };

    const joinAllChannels = () => {
      // Solo hacer fetch si tenemos token disponible
      if (!accessToken) return;
      fetchChannels()
        .then(chs => {
          chs.forEach(ch => {
            s.emit('join_channel', ch.id);
          });
        })
        .catch(() => {});
    };

    // Listener de Mensajes Nuevos en Tiempo Real (Suena y avisa si no está viendo ese canal)
    const onNewMsg = (msg: any) => {
      const isOwn = msg.sender_id === userId || msg.sender_id === user?.id || msg.sender_name === userName || msg.sender_name?.startsWith(`${userName} `);
      if (isOwn) return;

      const chName = msg.sender_name || 'Alguien';
      const channelLabel = msg.channel_name ? `[${msg.channel_name}] ` : '';
      const currentActiveCh = sessionStorage.getItem('active_chat_channel_id');

      if (location.pathname !== '/chat' || currentActiveCh !== msg.channel_id) {
        addToast(`${channelLabel}${chName}: ${msg.content.slice(0, 60)}`, 'info', 5000);
        playChatChime();
      }
    };

    // Listener de Nuevos Canales Creados (Solo si NO está en la página de chat)
    const onNewChannel = (ch: any) => {
      if (ch && ch.id) {
        s.emit('join_channel', ch.id);
      }
      if (location.pathname !== '/chat') {
        addToast(`Nuevo canal de chat: ${ch.name}`, 'success', 6000);
        playChatChime();
      }
      onUnreadUpdate();
    };

    const onNewClientChat = (data: any) => {
      if (data && data.channel && data.channel.id) {
        s.emit('join_channel', data.channel.id);
      }
      if (location.pathname !== '/chat') {
        addToast(data.mensaje || 'Nuevo chat de cliente', 'success', 6000);
        playChatChime();
      }
      onUnreadUpdate();
    };

    // Listener de Nuevas Reservas Web en Tiempo Real (¡Suena en CUALQUIER página!)
    const onNewBooking = (data: any) => {
      let extMsg = '';
      if (data.reserva) {
        const opts = [];
        if (data.reserva.cama_extra) opts.push('Cama extra');
        if (data.reserva.limpieza_diaria) opts.push('Limpieza');
        if (data.reserva.neverita) opts.push('Neverita');
        if (data.reserva.plancha) opts.push('Plancha');
        if (opts.length > 0) {
          extMsg = ` (Solicita: ${opts.join(', ')})`;
        }
      }
      addToast((data.mensaje || 'Nueva solicitud de reserva web recibida') + extMsg, 'success', 10000);
      playReservationArpeggio();
    };

    // Fetch inicial de canales — solo cuando tengamos sesión con token válido
    if (!authLoading && user && accessToken) {
      onUnreadUpdate();
      joinAllChannels();
    }

    s.on('new_message', onNewMsg);
    s.on('unread_update', onUnreadUpdate);
    s.on('new_channel', onNewChannel);
    s.on('new_client_chat', onNewClientChat);
    s.on('nueva_solicitud_reserva', onNewBooking);

    return () => {
      s.off('new_message', onNewMsg);
      s.off('unread_update', onUnreadUpdate);
      s.off('new_channel', onNewChannel);
      s.off('new_client_chat', onNewClientChat);
      s.off('nueva_solicitud_reserva', onNewBooking);
    };
  }, [location.pathname, userId, userName, addToast, authLoading, user, accessToken]);

  return (
    <div className="dashboard-root">
      {welcomeNombre && (
        <WelcomeAnimation
          nombre={welcomeNombre}
          onDone={() => setWelcomeNombre(null)}
        />
      )}
      <Sidebar />
      <div className="dashboard-shell" style={isChatPage ? { overflow: 'hidden' } : {}}>
        <div className={isChatPage ? 'chat-route-stage' : 'dashboard-route-stage'}>
          <Outlet />
        </div>
      </div>
      <RightSidebarChat />
    </div>
  );
};
