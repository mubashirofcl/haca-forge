import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

let socketInstance: Socket | null = null;

export function useSocket() {
  const { user } = useAuth();
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

    // Connect socket if not already connected
    if (!socketInstance) {
      socketInstance = io(window.location.origin, {
        withCredentials: true,
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
    } else if (socketInstance.connected) {
      setIsConnected(true);
    }

    return () => {
      // Keep socket alive across component renders, disconnect only when user logs out
    };
  }, [user]);

  const joinTask = useCallback((taskId: string) => {
    if (socketInstance && taskId) {
      socketInstance.emit('join_task', taskId);
    }
  }, []);

  const leaveTask = useCallback((taskId: string) => {
    if (socketInstance && taskId) {
      socketInstance.emit('leave_task', taskId);
    }
  }, []);

  const joinRequest = useCallback((requestId: string) => {
    if (socketInstance && requestId) {
      socketInstance.emit('join_request', requestId);
    }
  }, []);

  const leaveRequest = useCallback((requestId: string) => {
    if (socketInstance && requestId) {
      socketInstance.emit('leave_request', requestId);
    }
  }, []);

  const emitTyping = useCallback((taskId: string, isTyping: boolean) => {
    if (socketInstance && taskId) {
      socketInstance.emit('task:typing', { taskId, isTyping });
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

  return {
    socket: socketInstance,
    isConnected,
    joinTask,
    leaveTask,
    joinRequest,
    leaveRequest,
    emitTyping,
    on,
  };
}
