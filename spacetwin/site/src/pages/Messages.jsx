import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/components/CountryContext";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Search, MoreVertical, CheckCheck, RefreshCw, Trash2, ChevronDown } from "lucide-react";
import { initials, timeLabel, avatarColor } from "@/lib/chatUtils";
import { Image } from "@/components/ui/image";

const PAGE_SIZE = 5;
const EASE = [0.16, 1, 0.3, 1];

export default function Messages() {
  const { user, isAuthenticated } = useAuth();
  const { lang } = useCountry();
  const en = lang === "en";
  const reduced = useReducedMotion();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const legacyId = params.get("c");
  const [conversations, setConversations] = useState(null);
  const [convSearch, setConvSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [avatarMap, setAvatarMap] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  const loadConversations = async () => {
    try {
      const [all, allMsgs, allUsers] = await Promise.all([
        base44.entities.Conversation.list("-updated_date", 200),
        base44.entities.Message.list("-created_date", 500).catch(() => []),
        base44.entities.User.list("-created_date", 200).catch(() => []),
      ]);
      const mine = all.filter((c) => c.buyer_id === user.id || c.seller_id === user.id);

      // Build avatar map (user id -> avatar_url)
      const avatars = {};
      (allUsers || []).forEach((u) => {
        if (u.id && u.avatar_url) avatars[u.id] = u.avatar_url;
      });
      setAvatarMap(avatars);

      const unreadByConv = {};
      const lastByConv = {};
      allMsgs.forEach((m) => {
        if (!m) return;
        const cid = m.conversation_id;
        if (m.sender_id !== user.id && !m.read_at) unreadByConv[cid] = (unreadByConv[cid] || 0) + 1;
        if (!lastByConv[cid] || new Date(m.created_date) > new Date(lastByConv[cid])) lastByConv[cid] = m.created_date;
      });
      const enriched = mine
        .map((c) => ({ ...c, _unread: unreadByConv[c.id] || 0, _lastAt: lastByConv[c.id] || c.updated_date }))
        .sort((a, b) => new Date(b._lastAt || 0) - new Date(a._lastAt || 0));
      setConversations(enriched);
    } catch { setConversations([]); }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadConversations();
    const unsubM = base44.entities.Message.subscribe(() => loadConversations());
    const unsubC = base44.entities.Conversation.subscribe(() => loadConversations());
    return () => { try { unsubM?.(); } catch {} try { unsubC?.(); } catch {} };
     
  }, [isAuthenticated, user?.id]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (legacyId) return <Navigate to={"/messages/" + legacyId} replace />;

  const markAllRead = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Message.list() intoarce mesajele TUTUROR, nu doar ale mele. Fara filtrul
      // pe conversatiile mele, „marcheaza tot ca citit" stampila read_at pe
      // corespondenta privata a strainilor — exact ca loadConversations, care
      // filtreaza pe `mine`, doar ca aici filtrul lipsea.
      const myConvIds = new Set(conversations.map((c) => c.id));
      const allMsgs = await base44.entities.Message.list("-created_date", 500).catch(() => []);
      const toUpdate = allMsgs.filter(
        (m) => myConvIds.has(m.conversation_id) && m.sender_id !== user.id && !m.read_at
      );
      if (!toUpdate.length) { toast({ title: en ? "Everything is already read" : "Toate mesajele sunt deja citite" }); return; }
      const now = new Date().toISOString();
      await Promise.all(toUpdate.map((m) => base44.entities.Message.update(m.id, { read_at: now }).catch(() => {})));
      toast({ title: en ? `${toUpdate.length} messages marked as read` : `${toUpdate.length} mesaje marcate ca citite` });
      loadConversations();
    } catch { toast({ title: en ? "Something went wrong" : "Eroare", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  const deleteConversation = async (e, conv) => {
    e.stopPropagation();
    setDeletingId(conv.id);
    try {
      await base44.entities.Message.deleteMany({ conversation_id: conv.id }).catch(() => {});
      await base44.entities.Conversation.delete(conv.id);
      toast({ title: en ? "Conversation deleted" : "Conversație ștearsă" });
      loadConversations();
    } catch {
      toast({ title: en ? "Delete failed" : "Ștergerea a eșuat", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredConvs = (conversations || []).filter((c) => {
    const q = convSearch.toLowerCase();
    if (!q) return true;
    return (
      (c.property_title || "").toLowerCase().includes(q) ||
      (c.buyer_name || "").toLowerCase().includes(q) ||
      (c.seller_name || "").toLowerCase().includes(q)
    );
  });

  const totalUnread = (conversations || []).reduce((acc, c) => acc + (c._unread || 0), 0);
  const visibleConvs = filteredConvs.slice(0, visibleCount);
  const hasMore = filteredConvs.length > visibleCount;

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] w-full max-w-2xl flex-col overflow-hidden bg-background lg:h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        {/* Iconița decorativă de 32px ținea titlul la 58px, iar căutarea și
            lista de sub el la 12 și la 8. Trei margini din stânga pe un ecran
            de 375px. Titlul stă acum în gutieră, ca tot restul paginii. */}
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-xl font-bold text-navy dark:text-foreground">
            {en ? "Messages" : "Mesaje"}
          </h1>
          {totalUnread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald px-1.5 text-[10px] font-bold text-primary-foreground">
              {totalUnread > 9 ? "+9" : totalUnread}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="tap-44 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
              aria-label={en ? "Options" : "Opțiuni"}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl">
            <DropdownMenuItem onClick={markAllRead} disabled={busy} className="gap-2 rounded-xl py-2.5">
              <CheckCheck className="h-4 w-4 text-emerald" /> {en ? "Mark all as read" : "Marchează toate ca citite"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => loadConversations()} className="gap-2 rounded-xl py-2.5">
              <RefreshCw className="h-4 w-4" /> {en ? "Refresh" : "Reîmprospătează"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search */}
      <div className="bg-card px-4 pb-3 pt-1">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={convSearch}
            onChange={(e) => { setConvSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            placeholder={en ? "Search conversations..." : "Caută conversație..."}
            aria-label={en ? "Search conversations" : "Caută conversație"}
            className="h-11 w-full rounded-full border border-border bg-background pl-10 pr-4 text-base outline-none focus:border-emerald"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-20 pt-2 lg:pb-2">
        {conversations === null ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[72px] rounded-2xl" />)}
          </div>
        ) : filteredConvs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-9 text-center sm:px-6 sm:py-16">
            <img
              src="/images/generated/icon-chat.png"
              alt=""
              aria-hidden="true"
              className="h-12 w-12 object-contain opacity-70"
            />
            <p className="text-sm text-muted-foreground">
              {convSearch
                ? (en ? "No conversations found." : "Nicio conversație găsită.")
                : (en ? "No conversations yet. Open a listing and tap Message." : "Nicio conversație încă. Deschide un anunț și apasă Mesaj.")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleConvs.map((c, idx) => {
              const otherId = c.buyer_id === user?.id ? c.seller_id : c.buyer_id;
              const otherN = c.buyer_id === user?.id ? c.seller_name : c.buyer_name;
              const unread = c._unread || 0;
              const avatarUrl = avatarMap[otherId];
              return (
                <motion.div
                  key={c.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={reduced ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE, delay: Math.min(idx, 8) * 0.03 }}
                  onClick={() => navigate("/messages/" + c.id)}
                  className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card px-3 py-3 text-left shadow-soft transition-colors hover:bg-secondary/60"
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={otherN || "Avatar"}
                      fittingType="fill"
                      className="h-12 w-12 shrink-0 rounded-full"
                    />
                  ) : (
                    <span className={["flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white", avatarColor(c.id)].join(" ")}>
                      {initials(otherN || c.property_title || "?")}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={["truncate text-sm text-navy dark:text-foreground", unread ? "font-bold" : "font-semibold"].join(" ")}>
                        {otherN || c.property_title || (en ? "Conversation" : "Conversație")}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel(c._lastAt || c.updated_date, lang)}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className={["truncate text-xs", unread ? "font-medium text-foreground/80" : "text-muted-foreground"].join(" ")}>
                        {c.last_message || c.property_title || (en ? "No messages" : "Niciun mesaj")}
                      </p>
                      {unread > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald px-1.5 text-[10px] font-bold text-primary-foreground">
                          {unread > 9 ? "+9" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteConversation(e, c)}
                    disabled={deletingId === c.id}
                    className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={en ? "Delete conversation" : "Șterge conversația"}
                  >
                    {deletingId === c.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </motion.div>
              );
            })}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-emerald-soft text-sm font-semibold text-emerald transition hover:bg-emerald/15 sm:h-12"
              >
                <ChevronDown className="h-4 w-4" />
                {en
                  ? `Show more (${filteredConvs.length - visibleCount} left)`
                  : `Arată mai multe (${filteredConvs.length - visibleCount} restante)`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}