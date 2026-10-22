import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Filter,
  Inbox,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { Notification } from '../types';
type NotificationSeverity = Notification['severity'];
import { useToast } from '../components/shared/Toast';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'warnings' | 'errors'>('all');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications();
      if (Array.isArray(data)) {
        // Sort newest first
        const sorted = [...data].sort((a, b) => {
          const tA = new Date(a.created_at || 0).getTime();
          const tB = new Date(b.created_at || 0).getTime();
          return tB - tA;
        });
        setNotifications(sorted);
      } else {
        setNotifications([]);
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to fetch notifications', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update notification', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      showToast('All notifications marked as read', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to mark all as read', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'Recently';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityBorder = (severity: string, isRead: boolean) => {
    if (isRead) return 'border-l-gray-300';
    switch (severity?.toLowerCase()) {
      case 'error':
        return 'border-l-rose-500';
      case 'warning':
        return 'border-l-amber-500';
      case 'success':
        return 'border-l-emerald-500';
      case 'info':
      default:
        return 'border-l-blue-500';
    }
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (activeTab === 'unread') return !n.is_read;
      if (activeTab === 'warnings') return n.severity === 'warning';
      if (activeTab === 'errors') return n.severity === 'error';
      return true;
    });
  }, [notifications, activeTab]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  const warningCount = useMemo(() => {
    return notifications.filter((n) => n.severity === 'warning').length;
  }, [notifications]);

  const errorCount = useMemo(() => {
    return notifications.filter((n) => n.severity === 'error').length;
  }, [notifications]);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary-600" />
            System Notifications & Alerts
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time constraint violations, routing exceptions, and system events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleMarkAllRead}
            disabled={actionLoading || unreadCount === 0}
            className="btn-primary text-xs"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'all'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'all' ? 'bg-primary-800 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {notifications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('unread')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'unread'
              ? 'bg-primary-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Unread
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'unread' ? 'bg-primary-800 text-white' : 'bg-red-100 text-red-700'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('warnings')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'warnings'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Warnings
          {warningCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'warnings' ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {warningCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('errors')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'errors'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Errors
          {errorCount > 0 && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'errors' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {errorCount}
            </span>
          )}
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
            <span className="text-sm font-medium">Checking for notifications...</span>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="card p-12 text-center bg-white">
            <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-1">No Notifications</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {activeTab === 'unread'
                ? "You're all caught up! There are no unread notifications right now."
                : 'No alerts matching the selected filter.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isRead = Boolean(item.is_read);
            const borderClass = getSeverityBorder(item.severity, isRead);

            return (
              <div
                key={`notif-${item.id}`}
                onClick={() => !isRead && handleMarkAsRead(item.id)}
                className={`card p-4 transition-all duration-200 border-l-4 ${borderClass} ${
                  isRead
                    ? 'bg-white/60 hover:bg-white text-gray-700 opacity-80'
                    : 'bg-white shadow-sm hover:shadow-md cursor-pointer text-gray-900 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(item.severity)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-sm font-bold truncate">{item.title}</h4>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary-600 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 leading-relaxed mb-2.5">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                      {item.related_entity_type && item.related_entity_id ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.related_entity_type === 'order') {
                              navigate('/orders');
                            } else if (item.related_entity_type === 'agent') {
                              navigate('/agents');
                            }
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-800 text-[11px]"
                        >
                          <span className="capitalize">{item.related_entity_type}</span> #
                          {item.related_entity_id.substring(0, 8)}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">
                          System Event
                        </span>
                      )}

                      {!isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          className="text-[11px] font-medium text-gray-500 hover:text-gray-800 hover:underline"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
