import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

/**
 * Loads the current user's notifications and keeps them in sync in real time
 * via the entity subscription API. Exposes the unread count (for header badge)
 * and a markAllRead helper (used when the panel is opened).
 */
export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    setLoading(true);
    try {
      const list = await base44.entities.Notification.filter(
        { user_id: user.id },
        "-created_date",
        50
      );
      setNotifications(Array.isArray(list) ? list : []);
    } catch (e) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    load();
    if (!isAuthenticated) return;
    const unsub = base44.entities.Notification.subscribe(() => load());
    return () => {
      try { unsub && unsub(); } catch { /* noop */ }
    };
  }, [isAuthenticated, user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadMessageCount = notifications.filter((n) => !n.read && n.type === "message").length;

  const markAsRead = useCallback(async (id) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await base44.entities.Notification.update(id, { read: true });
    } catch (e) { /* ignore */ }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    // optimistic
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    try {
      await base44.entities.Notification.bulkUpdate(
        unread.map((n) => ({ id: n.id, read: true }))
      );
    } catch (e) {
      /* ignore */
    }
  }, [notifications]);

  return { notifications, unreadCount, unreadMessageCount, markAsRead, markAllRead, loading, reload: load };
}