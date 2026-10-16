import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Bell, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
}

export const NotificationToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { on } = useSocket();

  useEffect(() => {
    // Listen for new real-time notifications from Socket.io
    const unsubscribe = on('notification:new', (notification: any) => {
      const newToast: ToastItem = {
        id: notification._id || String(Date.now()),
        title: notification.title,
        message: notification.message,
        link: notification.link,
        type: notification.type,
      };

      setToasts((prev) => [newToast, ...prev].slice(0, 4));

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, 6000);
    });

    return () => {
      unsubscribe();
    };
  }, [on]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isAlert = toast.type?.includes('blocked') || toast.type?.includes('overdue');
        const isDeadline = toast.type?.includes('approaching');

        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl glass-panel border border-white/90 bg-white/95 backdrop-blur-xl shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
          >
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isAlert
                  ? 'bg-rose-100 text-rose-600'
                  : isDeadline
                  ? 'bg-amber-100 text-amber-600'
                  : 'bg-indigo-100 text-[#7a6af6]'
              }`}
            >
              {isAlert ? (
                <AlertTriangle className="w-4 h-4" />
              ) : isDeadline ? (
                <Clock className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                {toast.title}
              </h4>
              <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                {toast.message}
              </p>

              {toast.link && (
                <Link
                  to={toast.link}
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7a6af6] hover:underline mt-1.5"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
