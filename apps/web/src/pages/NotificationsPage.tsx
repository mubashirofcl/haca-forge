import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  Search,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotificationPreferencesModal } from '../components/NotificationPreferencesModal';

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'tasks' | 'requests' | 'mentions'>('all');
  const [page, setPage] = useState(1);
  const [showPreferences, setShowPreferences] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications', activeTab, page],
    queryFn: async () => {
      let url = `/api/notifications?page=${page}&limit=20`;
      if (activeTab === 'unread') {
        url += '&unreadOnly=true';
      } else if (activeTab !== 'all') {
        url += `&type=${activeTab}`;
      }

      const res = await fetch(url);
      if (!res.ok) return { data: [], unreadCount: 0, pagination: { total: 0, pages: 1 } };
      return res.json();
    },
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unreadCount || 0;
  const pagination = notificationsData?.pagination || { total: 0, page: 1, pages: 1 };

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markSingleReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const filteredNotifications = searchQuery
    ? notifications.filter(
        (n: any) =>
          n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.message?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notifications;

  const getNotificationIcon = (type: string) => {
    if (type?.includes('blocked') || type?.includes('overdue')) {
      return <AlertTriangle className="w-4 h-4 text-rose-500" />;
    }
    if (type?.includes('approaching')) {
      return <Clock className="w-4 h-4 text-amber-500" />;
    }
    if (type?.includes('comment') || type?.includes('mention')) {
      return <MessageSquare className="w-4 h-4 text-emerald-500" />;
    }
    if (type?.includes('decided') || type?.includes('accepted') || type?.includes('approved') || type?.includes('published')) {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    return <Inbox className="w-4 h-4 text-[#7a6af6]" />;
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#7a6af6]/10 text-[#7a6af6]">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Stay up to date with task handoffs, approvals, deadlines, and team activity
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-white/80 hover:bg-white text-slate-700 border border-white/90 shadow-sm transition-all"
            >
              Mark all as read
            </button>
          )}

          <button
            onClick={() => setShowPreferences(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold bg-[#0f172a] text-white hover:bg-slate-800 shadow-md transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2 rounded-3xl glass-panel border border-white/90 bg-white/80 backdrop-blur-xl shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'All Notifications' },
              { id: 'unread', label: 'Unread' },
              { id: 'tasks', label: 'Tasks & Deadlines' },
              { id: 'requests', label: 'Requests' },
              { id: 'mentions', label: 'Mentions' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[#0f172a] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-2xl bg-white/90 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7a6af6] transition-all"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="rounded-3xl glass-panel border border-white/90 bg-white/90 backdrop-blur-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No notifications found</p>
            <p className="text-xs text-slate-400">You're all caught up on your marketing operations.</p>
          </div>
        ) : (
          filteredNotifications.map((n: any) => {
            const isUnread = !n.read;
            return (
              <div
                key={n._id}
                className={`group flex items-start gap-4 p-4 transition-all duration-150 ${
                  isUnread ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="p-2.5 rounded-2xl bg-white shadow-sm border border-slate-100 shrink-0 mt-0.5">
                  {getNotificationIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 leading-snug truncate">
                      {n.title}
                    </h3>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(n.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    {n.message}
                  </p>

                  {n.link && (
                    <Link
                      to={n.link}
                      onClick={() => {
                        if (isUnread) markSingleReadMutation.mutate(n._id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7a6af6] hover:underline mt-2.5"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {isUnread && (
                    <button
                      onClick={() => markSingleReadMutation.mutate(n._id)}
                      title="Mark as read"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(n._id)}
                    title="Delete"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            Showing page {pagination.page} of {pagination.pages} ({pagination.total} notifications)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 border border-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 border border-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <NotificationPreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />
    </div>
  );
};
export default NotificationsPage;
