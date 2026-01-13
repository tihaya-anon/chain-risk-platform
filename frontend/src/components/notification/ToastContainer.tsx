import { useEffect, useState } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useAlertStore, type Alert } from '@/store/alerts';
import { clsx } from 'clsx';

interface ToastProps {
  alert: Alert;
  onDismiss: () => void;
}

function Toast({ alert, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10);

    // Auto dismiss after 5 seconds (longer for critical)
    const timeout = alert.severity === 'critical' ? 10000 : 5000;
    const timer = setTimeout(() => {
      handleDismiss();
    }, timeout);

    return () => clearTimeout(timer);
  }, [alert.severity]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const severityConfig = {
    critical: {
      icon: AlertTriangle,
      bgColor: 'bg-red-500',
      borderColor: 'border-red-600',
      iconColor: 'text-white',
    },
    high: {
      icon: AlertCircle,
      bgColor: 'bg-orange-500',
      borderColor: 'border-orange-600',
      iconColor: 'text-white',
    },
    medium: {
      icon: Info,
      bgColor: 'bg-yellow-500',
      borderColor: 'border-yellow-600',
      iconColor: 'text-white',
    },
    low: {
      icon: CheckCircle,
      bgColor: 'bg-blue-500',
      borderColor: 'border-blue-600',
      iconColor: 'text-white',
    },
  };

  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg shadow-lg border transition-all duration-300',
        config.bgColor,
        config.borderColor,
        isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{alert.title}</p>
        <p className="text-sm text-white/90 mt-1 line-clamp-2">{alert.message}</p>
        {alert.address && (
          <p className="text-xs text-white/70 mt-1 font-mono truncate">
            {alert.address}
          </p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="text-white/70 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const alerts = useAlertStore((state) => state.alerts);
  const [visibleToasts, setVisibleToasts] = useState<Alert[]>([]);

  useEffect(() => {
    // Show only the latest unread alerts as toasts (max 5)
    const unreadAlerts = alerts.filter((a) => !a.read).slice(0, 5);
    
    // Add new alerts to visible toasts
    unreadAlerts.forEach((alert) => {
      if (!visibleToasts.find((t) => t.id === alert.id)) {
        setVisibleToasts((prev) => [...prev, alert].slice(-5));
      }
    });
  }, [alerts]);

  const handleDismiss = (id: string) => {
    setVisibleToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {visibleToasts.map((alert) => (
        <Toast
          key={alert.id}
          alert={alert}
          onDismiss={() => handleDismiss(alert.id)}
        />
      ))}
    </div>
  );
}
