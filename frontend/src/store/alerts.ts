import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  address?: string;
  riskScore?: number;
  timestamp: number;
  read: boolean;
}

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  maxAlerts: number;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  addAlert: (alert: Alert) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
  toggleSound: () => void;
  toggleNotifications: () => void;
}

export const useAlertStore = create<AlertState>()(
  persist(
    (set, get) => ({
      alerts: [],
      unreadCount: 0,
      maxAlerts: 100,
      soundEnabled: true,
      notificationsEnabled: true,

      addAlert: (alert) => {
        set((state) => {
          const newAlerts = [alert, ...state.alerts].slice(0, state.maxAlerts);
          return {
            alerts: newAlerts,
            unreadCount: state.unreadCount + 1,
          };
        });

        // Play sound for critical/high alerts
        const state = get();
        if (state.soundEnabled && (alert.severity === 'critical' || alert.severity === 'high')) {
          playAlertSound();
        }

        // Show browser notification
        if (state.notificationsEnabled && Notification.permission === 'granted') {
          showBrowserNotification(alert);
        }
      },

      markAsRead: (id) => {
        set((state) => {
          const alert = state.alerts.find((a) => a.id === id);
          if (alert && !alert.read) {
            return {
              alerts: state.alerts.map((a) =>
                a.id === id ? { ...a, read: true } : a
              ),
              unreadCount: Math.max(0, state.unreadCount - 1),
            };
          }
          return state;
        });
      },

      markAllAsRead: () => {
        set((state) => ({
          alerts: state.alerts.map((a) => ({ ...a, read: true })),
          unreadCount: 0,
        }));
      },

      removeAlert: (id) => {
        set((state) => {
          const alert = state.alerts.find((a) => a.id === id);
          return {
            alerts: state.alerts.filter((a) => a.id !== id),
            unreadCount: alert && !alert.read
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
          };
        });
      },

      clearAlerts: () => {
        set({ alerts: [], unreadCount: 0 });
      },

      toggleSound: () => {
        set((state) => ({ soundEnabled: !state.soundEnabled }));
      },

      toggleNotifications: () => {
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled }));
      },
    }),
    {
      name: 'alert-storage',
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        notificationsEnabled: state.notificationsEnabled,
      }),
    }
  )
);

// Utility functions
function playAlertSound() {
  try {
    const audio = new Audio('/alert.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore audio play errors (e.g., user hasn't interacted with page)
    });
  } catch {
    // Ignore errors
  }
}

function showBrowserNotification(alert: Alert) {
  try {
    new Notification(alert.title, {
      body: alert.message,
      icon: '/vite.svg',
      tag: alert.id,
    });
  } catch {
    // Ignore errors
  }
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}
