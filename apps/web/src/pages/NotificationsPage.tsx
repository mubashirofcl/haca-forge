import React, { useState } from 'react';
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
  Search,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'tasks' | 'requests' | 'mentions'>('all');
  const [page, setPage] = useState(1);
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

      // apiFetch sends the login cookie and renews it once if it has expired.
      return apiFetch<any>(url).catch(() => ({ data: [], unreadCount: 0, pagination: { total: 0, pages: 1 } }));
    },
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notificationsData?.unreadCount || 0;
  const pagination = notificationsData?.pagination || { total: 0, page: 1, pages: 1 };

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markSingleReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
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
    return <Inbox className="w-4 h-4 text-ui-ink" />;
  };

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/70 text-ui-text">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-[15px] text-ui-muted mt-1.5 max-w-[70ch]">
            Stay up to date with task handoffs, approvals, deadlines, and team activity
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="ui-btn ui-btn-secondary bg-transparent h-11"
            >
              Mark all as read
            </button>
          )}

          <button
            onClick={() => navigate('/settings')}
            className="ui-btn ui-btn-primary h-11"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 glass-panel rounded-ui-panel">
        {/* Tabs */}
        <div className="max-w-full overflow-x-auto no-scrollbar">
        <div className="ui-tabs">
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
              aria-pressed={activeTab === tab.id}
              className={`ui-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-ui-muted absolute left-4 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search notifications"
            className="ui-input w-full pl-10 pr-3"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="glass-card overflow-hidden divide-y divide-ui-line">
        {isLoading ? (
          <div className="py-20 text-center text-ui-muted text-sm">Loading notifications...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-20 text-center text-ui-muted flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/70 flex items-center justify-center text-ui-muted">
              <Bell className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-ui-text">No notifications found</p>
            <p className="text-xs text-ui-muted">You're all caught up on your marketing operations.</p>
          </div>
        ) : (
          filteredNotifications.map((n: any) => {
            const isUnread = !n.read;
            return (
              <div
                key={n._id}
                className={`group flex items-start gap-3 sm:gap-4 p-4 transition-colors ${
                  isUnread ? 'bg-white' : 'hover:bg-white/60'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-ui-card flex items-center justify-center shrink-0">
                  {getNotificationIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0 sm:pr-4">
                  {/* Title wraps on narrow screens; the time drops below it. */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2">
                    <h3 className={`min-w-0 text-sm leading-snug text-ui-ink flex items-baseline gap-2 ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                      {/* Unread: blue dot plus text for screen readers, not colour alone */}
                      {isUnread && (
                        <>
                          <span className="w-2 h-2 rounded-full bg-ui-blue shrink-0 self-center" aria-hidden="true" />
                          <span className="sr-only">Unread: </span>
                        </>
                      )}
                      <span className="min-w-0 break-words sm:truncate">{n.title}</span>
                    </h3>
                    <span className="text-xs text-ui-muted shrink-0">
                      {new Date(n.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-[13px] text-ui-text leading-relaxed mt-1 max-w-[70ch]">
                    {n.message}
                  </p>

                  {n.link && (
                    <Link
                      to={n.link}
                      onClick={() => {
                        if (isUnread) markSingleReadMutation.mutate(n._id);
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[44px] -mb-3 text-xs font-semibold text-ui-ink hover:underline"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-1.5 shrink-0 -mt-1 -mr-2 sm:mr-0">
                  {isUnread && (
                    <button
                      onClick={() => markSingleReadMutation.mutate(n._id)}
                      title="Mark as read"
                      aria-label="Mark as read"
                      className="ui-icon-btn border-transparent"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(n._id)}
                    title="Delete"
                    aria-label="Delete notification"
                    className="ui-icon-btn border-transparent"
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
          <span className="text-xs text-ui-muted">
            Showing page {pagination.page} of {pagination.pages} ({pagination.total} notifications)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="ui-btn ui-btn-secondary h-11"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
              className="ui-btn ui-btn-secondary h-11"
            >
              Next
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
export default NotificationsPage;
