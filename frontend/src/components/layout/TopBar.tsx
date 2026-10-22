import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Menu, Bell, ChevronRight, CheckCheck } from 'lucide-react';
import { api } from '../../services/api';
import { Notification } from '../../types';

interface TopBarProps {
  onToggleMobile: () => void;
}

const routeTitles: Record<string, { title: string; breadcrumb: string }> = {
  '/': { title: 'Dashboard', breadcrumb: 'Overview' },
  '/orders': { title: 'Orders Management', breadcrumb: 'Orders' },
  '/agents': { title: 'Fleet & Agents', breadcrumb: 'Agents' },
  '/optimize': { title: 'Route Optimization', breadcrumb: 'Optimize' },
  '/map': { title: 'Live Fleet Map', breadcrumb: 'Map' },
  '/simulation': { title: 'Dispatch Simulation', breadcrumb: 'Simulation' },
  '/analytics': { title: 'Performance Analytics', breadcrumb: 'Analytics' },
  '/history': { title: 'Optimization History', breadcrumb: 'History' },
  '/notifications': { title: 'Notifications & Alerts', breadcrumb: 'Notifications' },
  '/settings': { title: 'System Settings', breadcrumb: 'Settings' },
  '/help': { title: 'Documentation & Help', breadcrumb: 'Help' },
};

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobile }) => {
  const location = useLocation();
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);

  const currentInfo = routeTitles[location.pathname] || {
    title: 'RouteWise Platform',
    breadcrumb: 'Page',
  };

  const fetchUnread = async () => {
    try {
      const data = await api.getNotifications(true);
      if (Array.isArray(data)) {
        setUnreadNotifications(data);
      }
    } catch {
      // Ignore network errors on polling
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadNotifications([]);
    } catch {
      // Ignore
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200">
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onToggleMobile}
          className="lg:hidden p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb & Title */}
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-0.5">
            <Link to="/" className="hover:text-gray-600 transition-colors">
              RouteWise
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-600 font-medium">{currentInfo.breadcrumb}</span>
          </nav>
          <h1 className="text-lg font-semibold text-gray-900 leading-none">
            {currentInfo.title}
          </h1>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative p-2 text-gray-500 rounded-xl hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadNotifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </button>

          {/* Quick Notification Dropdown */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Unread Alerts ({unreadNotifications.length})
                </span>
                {unreadNotifications.length > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                {unreadNotifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    No unread notifications
                  </div>
                ) : (
                  unreadNotifications.slice(0, 5).map((n) => (
                    <div key={n.id} className="p-3 hover:bg-gray-50 transition-colors">
                      <div className="text-xs font-medium text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {n.message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-2 border-t border-gray-100 text-center">
                <Link
                  to="/notifications"
                  onClick={() => setShowDropdown(false)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold"
                >
                  View all notifications &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
