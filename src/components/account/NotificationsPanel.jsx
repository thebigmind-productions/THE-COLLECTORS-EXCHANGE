import React from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { getUser } from '../../utils/storage';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/api/useNotifications';

const NotificationsPanel = () => {
  const { data: notifications = [], isLoading } = useNotifications(!!getUser());
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  if (isLoading) {
    return (
      <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 flex justify-center">
        <Loader2 className="animate-spin text-luxury-gold" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-serif mb-1">Notifications</h2>
          <p className="text-gray-500 text-sm">Stay informed about your account and listings</p>
        </div>
        {notifications.some((n) => !n.read) && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs text-luxury-gold hover:underline uppercase tracking-wider"
          >
            Mark All Read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={48} className="mx-auto text-gray-200 mb-4" aria-hidden="true" />
          <p className="text-gray-500 font-serif text-lg">No notifications yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            We'll notify you about orders, verification updates, and more.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border transition-colors ${notification.read ? 'bg-white border-gray-100' : 'bg-luxury-gold/5 border-luxury-gold/20'}`}
              onClick={() => {
                if (!notification.read) markReadMutation.mutate(notification.id);
              }}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-sm font-medium ${notification.read ? 'text-gray-600' : 'text-heritage-charcoal'}`}
                  >
                    {notification.title}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">{notification.message}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </span>
                  {!notification.read && <div className="w-2 h-2 rounded-full bg-luxury-gold" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPanel;
