import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

let socketInstance: Socket | null = null;

export function useSocket() {
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    user = null;
  }
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // If not authenticated, disconnect existing socket
    if (!user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setIsConnected(false);
      }
      return;
    }

    // In test environments, skip opening real socket connections
    if (process.env.NODE_ENV === 'test' || Boolean((import.meta as any)?.env?.VITEST)) {
      return;
    }

    // Connect socket if not already connected
    if (!socketInstance) {
      const token =
        typeof window !== 'undefined' && typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
          ? localStorage.getItem('accessToken') || localStorage.getItem('token')
          : null;
      socketInstance = io(window.location.origin, {
        withCredentials: true,
        auth: token ? { token } : undefined,
        query: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
      });

      socketInstance.on('connect_error', (err) => {
        if (err.message && err.message.toLowerCase().includes('authentication')) {
          setIsConnected(false);
        }
      });
    } else if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      // Keep socket alive across component renders, disconnect only when user logs out
    };
  }, [user]);

  // Chat Socket Operations
  const joinChannel = useCallback((channelId: string) => {
    if (socketInstance && channelId) {
      socketInstance.emit('chat:join', { channelId });
    }
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    if (socketInstance && channelId) {
      socketInstance.emit('chat:leave', { channelId });
    }
  }, []);

  const emitTyping = useCallback((channelId: string, isTyping: boolean) => {
    if (socketInstance && channelId) {
      socketInstance.emit(isTyping ? 'chat:typing:start' : 'chat:typing:stop', { channelId });
    }
  }, []);

  const emitRead = useCallback((channelId: string, messageId?: string) => {
    if (socketInstance && channelId) {
      socketInstance.emit('chat:read', { channelId, messageId });
    }
  }, []);

  const on = useCallback((eventName: string, handler: Function) => {
    if (!socketInstance) return () => {};

    socketInstance.on(eventName, handler as any);
    return () => {
      if (socketInstance) {
        socketInstance.off(eventName, handler as any);
      }
    };
  }, []);

  const emit = useCallback((eventName: string, data?: any) => {
    if (socketInstance) {
      socketInstance.emit(eventName, data);
    }
  }, []);

  return {
    socket: socketInstance,
    isConnected,
    joinChannel,
    leaveChannel,
    emitTyping,
    emitRead,
    on,
    emit,
  };
}
