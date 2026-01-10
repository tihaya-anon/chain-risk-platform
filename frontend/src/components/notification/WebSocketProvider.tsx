import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAlertWebSocket } from '@/hooks/useAlertWebSocket';
import { useAuthStore } from '@/store/auth';
import { requestNotificationPermission } from '@/store/alerts';

interface WebSocketContextValue {
  isConnected: boolean;
  connectionError: string | null;
  subscribe: (payload: {
    addresses?: string[];
    riskThreshold?: number;
    alertTypes?: string[];
  }) => void;
  unsubscribe: (addresses?: string[]) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const {
    isConnected,
    connectionError,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  } = useAlertWebSocket();

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      connect();
      // Request notification permission
      requestNotificationPermission();
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        connectionError,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
