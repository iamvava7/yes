import React from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

// Header bell — the fix for "notifications don't show anywhere": a visible,
// always-present control that carries the unread count and leads to the
// dedicated /notificari page. Functional control, so the icon stays.
export default function NotificationBell({ className = "" }) {
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotifications();
  if (!isAuthenticated) return null;

  return (
    <Link
      to="/notificari"
      aria-label={`Notificări${unreadCount ? `, ${unreadCount} necitite` : ""}`}
      className={`tap-44 relative flex h-9 w-9 items-center justify-center rounded border border-border bg-card text-foreground transition-colors hover:border-emerald ${className}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-emerald px-1 text-[10px] font-bold leading-none text-primary-foreground tnum">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
