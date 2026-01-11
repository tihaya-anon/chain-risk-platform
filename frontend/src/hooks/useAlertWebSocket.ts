import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAlertStore } from '@/store/alerts';

interface SubscriptionPayload {
  addresses?: string[];
  riskThreshold?: number;
  alertTypes?: string[];
}

interface AlertMessage {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  riskScore?: number;
  address?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

export function useAlertWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const addAlert = useAlertStore((state) => state.addAlert);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(`${WS_URL}/alerts`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected:', socket.id);
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    socket.on('connected', (data) => {
      console.log('WebSocket welcome message:', data);
    });

    socket.on('alert', (alert: AlertMessage) => {
      console.log('Received alert:', alert);
      addAlert({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        address: alert.address,
        riskScore: alert.riskScore,
        timestamp: alert.timestamp,
        read: false,
      });
    });

    socketRef.current = socket;
  }, [addAlert]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback((payload: SubscriptionPayload) => {
    if (!socketRef.current?.connected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    socketRef.current.emit('subscribe', payload, (response: unknown) => {
      console.log('Subscribe response:', response);
    });
  }, []);

  const unsubscribe = useCallback((addresses?: string[]) => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('unsubscribe', { addresses }, (response: unknown) => {
      console.log('Unsubscribe response:', response);
    });
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    connectionError,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}
