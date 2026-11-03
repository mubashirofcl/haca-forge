import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  ExternalLink,
  Check,
  Settings,
  Trash2,
  Inbox,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../hooks/useSocket';

export const NotificationCenter: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'tasks' | 'requests' | 'mentions'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { on } = useSocket();

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Real-time notification arrival listener via Socket.io
  useEffect(() => {
    const unsubscribe = on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    const unsubscribeStatus = on('status_change', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [on, queryClient]);

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', activeTab],
    queryFn: async () => {
      let url = `/api/notifications?limit=25`;
      if (activeTab === 'unread') {
        url += '&unreadOnly=true';
      } else if (activeTab !== 'all') {
        url += `&type=${activeTab}`;
      }

      const res = await fetch(url);
      if (!res.ok) return { data: [], unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unreadCount || 0;

  // Mark all read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark single notification read mutation
  const markSingleReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDays}d ago`;
  };

  const getNotificationIcon = (type: string) => {
    if (type?.includes('blocked') || type?.includes('overdue')) {
      return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
    }
    if (type?.includes('approaching')) {
      return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
    if (type?.includes('comment') || type?.includes('mention')) {
      return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (type?.includes('decided') || type?.includes('accepted') || type?.includes('approved') || type?.includes('published')) {
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
    }
    return <Inbox className="w-3.5 h-3.5 text-[#7a6af6]" />;
  };

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          title="Notifications"
          className="relative p-2 rounded-full bg-white/70 hover:bg-white border border-white/90 text-slate-600 shadow-sm transition-all focus:outline-none"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center text-[9px] font-extrabold bg-[#7a6af6] text-white rounded-full ring-2 ring-white animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl glass-panel border border-white/90 shadow-2xl p-4 bg-white/95 backdrop-blur-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100/90">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#7a6af6]/10 text-[#7a6af6]">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    className="text-[11px] font-semibold text-[#7a6af6] hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/settings');
                  }}
                  title="Notification Settings"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 py-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'tasks', label: 'Tasks' },
                  { id: 'requests', label: 'Requests' },
                  { id: 'mentions', label: 'Mentions' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-[#0f172a] text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100/80 my-1 pr-1">
              {isLoading ? (
                <div className="py-12 text-center text-slate-400">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-xs">No notifications found.</p>
                </div>
              ) : (
                notifications.map((n: any) => {
                  const isUnread = !n.read;
                  return (
                    <div
                      key={n._id}
                      className={`group relative p-2.5 my-1 rounded-2xl transition-all duration-150 ${
                        isUnread
                          ? 'bg-indigo-50/50 hover:bg-indigo-50/80 border border-indigo-100/50'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-xl bg-white shadow-sm border border-slate-100 shrink-0 mt-0.5">
                          {getNotificationIcon(n.type)}
                        </div>

                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center justify-between gap-1">
                            <strong className="text-slate-900 text-xs font-semibold leading-snug truncate">
                              {n.title}
                            </strong>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>

                          <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5 line-clamp-2">
                            {n.message}
                          </p>

                          {n.link && (
                            <Link
                              to={n.link}
                              onClick={() => {
                                setIsOpen(false);
                                if (isUnread) markSingleReadMutation.mutate(n._id);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7a6af6] hover:underline mt-1.5"
                            >
                              <span>View details</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Hover action buttons */}
                      <div className="absolute top-2.5 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isUnread && (
                          <button
                            onClick={() => markSingleReadMutation.mutate(n._id)}
                            title="Mark as read"
                            className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(n._id)}
                          title="Delete"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-slate-100/90 flex items-center justify-between text-[11px] text-slate-500">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="font-semibold text-slate-700 hover:text-[#7a6af6] transition-colors"
              >
                View all notifications &rarr;
              </Link>
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/settings');
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
