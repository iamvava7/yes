import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Star, CheckCheck } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useCountry } from "@/components/CountryContext";
import { cn } from "@/lib/utils";

// Soft notification card: one rounded panel, pill tabs, one line per entry.

const TYPE_LABEL = {
  ro: { comment: "Comentariu", reply: "Răspuns", like: "Apreciere", message: "Mesaj", property: "Proprietate", review: "Recenzie", system: "Sistem" },
  en: { comment: "Comment", reply: "Reply", like: "Like", message: "Message", property: "Listing", review: "Review", system: "System" },
};

function timeAgo(dateStr, lang) {
  if (!dateStr) return "";
  const en = lang === "en";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return en ? "now" : "acum";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} h`;
  const days = Math.floor(hrs / 24);
  return en ? `${days}d` : `${days} zile`;
}

const TAB_IDS = ["recente", "citite", "marcate"];

export default function NotificationsPanel() {
  const { notifications, unreadCount, markAsRead, markAllRead, loading } = useNotifications();
  const { lang } = useCountry();
  const L = (ro, en) => (lang === "en" ? en : ro);
  const labels = TYPE_LABEL[lang === "en" ? "en" : "ro"];
  const TAB_LABEL = {
    recente: L("Recente", "Recent"),
    citite: L("Citite", "Read"),
    marcate: L("Marcate", "Starred"),
  };
  const [activeTab, setActiveTab] = useState("recente");
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("vc_starred_notifs") || "[]")); }
    catch { return new Set(); }
  });

  const toggleStar = (id, e) => {
    e.preventDefault(); e.stopPropagation();
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem("vc_starred_notifs", JSON.stringify([...next]));
      return next;
    });
  };

  const filtered = notifications.filter((n) => {
    if (activeTab === "recente") return !n.read;
    if (activeTab === "citite") return n.read;
    if (activeTab === "marcate") return starred.has(n.id);
    return true;
  });

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-heading text-lg font-semibold text-foreground">{L("Notificări", "Notifications")}</h2>
          {unreadCount > 0 && (
            <span className="text-sm font-semibold text-emerald tnum">
              {L(`${unreadCount} necitite`, `${unreadCount} unread`)}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="-mr-2 tap-44 flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-emerald transition-colors hover:bg-secondary"
          >
            <CheckCheck className="h-4 w-4" /> {L("Marchează tot citit", "Mark all read")}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-5 pb-4">
        {TAB_IDS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "tap-44 h-9 shrink-0 rounded-full border px-4 text-sm transition-colors",
              activeTab === tab
                ? "border-emerald bg-emerald font-semibold text-primary-foreground"
                : "border-border bg-background font-medium text-muted-foreground hover:border-emerald/50 hover:text-foreground dark:bg-card"
            )}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border border-t border-border">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-7 text-center sm:py-12">
            <p className="text-sm text-muted-foreground">
              {activeTab === "marcate"
                ? L("Nicio notificare marcată.", "Nothing starred.")
                : activeTab === "citite"
                  ? L("Nimic în arhivă încă.", "Nothing archived yet.")
                  : L("Nimic necitit. Totul la zi.", "Nothing unread. All caught up.")}
            </p>
          </div>
        ) : (
          filtered.map((n) => {
            const label = labels[n.type] || labels.system;
            const isStarred = starred.has(n.id);

            const body = (
              <div className={cn("flex min-h-[64px] items-center gap-3 px-5 py-3 transition-colors hover:bg-secondary/60", !n.read && "bg-secondary/40")}>
                {/* unread mark */}
                <span className={cn("h-2 w-2 shrink-0 rounded-full", !n.read ? "bg-emerald" : "bg-transparent")} aria-hidden="true" />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {label}
                    {n.actor_name && <span className="font-normal"> · {n.actor_name}</span>}
                    <span className="font-normal tnum"> · {timeAgo(n.created_date, lang)}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">{n.text}</p>
                </div>

                <button
                  onClick={(e) => toggleStar(n.id, e)}
                  className="-mr-2 tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-secondary"
                  aria-label={isStarred ? L("Scoate marcajul", "Remove star") : L("Marchează", "Star")}
                >
                  <Star className={cn("h-4 w-4 transition-colors", isStarred ? "fill-emerald text-emerald" : "text-border hover:text-muted-foreground")} />
                </button>
              </div>
            );

            return n.link ? (
              <Link key={n.id} to={n.link} className="block" onClick={() => markAsRead(n.id)}>
                {body}
              </Link>
            ) : (
              <div key={n.id} onClick={() => markAsRead(n.id)} className="cursor-pointer">{body}</div>
            );
          })
        )}
      </div>
    </section>
  );
}
