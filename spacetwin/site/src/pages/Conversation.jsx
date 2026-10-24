import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams, Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/components/CountryContext";
import { createNotification } from "@/lib/notifications";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Send, ArrowLeft, MoreVertical, Check, CheckCheck, Trash2, Star } from "lucide-react";
import { initials, avatarColor } from "@/lib/chatUtils";
import ChatPropertyCard from "@/components/ChatPropertyCard";
import ReviewModal from "@/components/ReviewModal";
import VerifiCasaLogo from "@/components/VerifiCasaLogo";

// Full-screen iMessage-style conversation — its own page, no app chrome.
export default function Conversation() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const prefill = searchParams.get("prefill") === "1";
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { lang } = useCountry();
  const en = lang === "en";
  const dateLocale = en ? "en-GB" : "ro-RO";
  const { toast } = useToast();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [pendingRef, setPendingRef] = useState(null);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const bottomRef = useRef(null);
  const prefillApplied = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    base44.entities.Conversation.get(id).then(setConv).catch(() => setConv(false));
  }, [id, isAuthenticated]);

  const otherUserId = conv
    ? conv.buyer_id === user?.id ? conv.seller_id : conv.buyer_id
    : null;

  // null = inca se incarca, true/false = verdict. Fara asta, loadMessages()
  // rula pe orice id din URL si randa firul altcuiva.
  const isParticipant =
    conv === null ? null : conv === false ? false : conv.buyer_id === user?.id || conv.seller_id === user?.id;

  // Fetch the other participant's full user record (avatar, name, etc.)
  useEffect(() => {
    if (!otherUserId || isParticipant !== true) return;
    base44.entities.User.get(otherUserId).then(setOtherUser).catch(() => setOtherUser(null));
  }, [otherUserId, isParticipant]);

  // Prefill: când utilizatorul apasă „Trimite mesaj" de pe pagina anunț,
  // pre-completăm textul șablon și atașăm cardul de proprietate la primul mesaj.
  // Se aplică O SINGURĂ DATĂ — doar la prima interacțiune, nu la fiecare mesaj.
  useEffect(() => {
    if (!prefill || !conv || !conv.property_id || conv.property_id === "direct" || pendingRef || prefillApplied.current) return;
    // Așteaptă încărcarea mesajelor; dacă conversația are deja mesaje, nu pre-completa
    if (messages === null) return;
    if (messages.length > 0) { prefillApplied.current = true; return; }
    prefillApplied.current = true;
    (async () => {
      try {
        const prop = await base44.entities.Property.get(conv.property_id);
        const code = prop.property_code
          ? (en ? ` Listing code: ${prop.property_code}` : ` Cod anunț: ${prop.property_code}`)
          : "";
        setText(en
          ? `Hello, I'm interested in this property: ${prop.title}. I'd like more details.${code}`
          : `Bună ziua, sunt interesat de această proprietate: ${prop.title}. Aș dori mai multe detalii.${code}`);
        setPendingRef({
          property_ref_id: prop.id,
          property_ref_title: prop.title,
          property_ref_image: prop.images?.[0] || "",
          property_ref_price: prop.price_monthly,
          property_ref_currency: prop.currency || "EUR",
        });
      } catch { /* best-effort */ }
    })();
  }, [prefill, conv, pendingRef, messages]);

  const loadMessages = async () => {
    try {
      const list = await base44.entities.Message.filter({ conversation_id: id }, "created_date", 500);
      setMessages(list);
      const incoming = list.filter((m) => m.sender_id !== user.id && !m.read_at && !m.is_system);
      if (incoming.length) {
        const now = new Date().toISOString();
        await Promise.all(incoming.map((m) => base44.entities.Message.update(m.id, { read_at: now }).catch(() => {})));
        const refreshed = await base44.entities.Message.filter({ conversation_id: id }, "created_date", 500).catch(() => list);
        setMessages(refreshed);
      }
    } catch { setMessages([]); }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    // Asteapta verdictul conversatiei. Efectul asta si cel care incarca `conv`
    // se declansau in paralel, deci mesajele se citeau inainte sa se stie daca
    // firul e al meu.
    if (isParticipant === null) return;
    if (isParticipant === false) { setMessages([]); return; }
    let cancelled = false;
    loadMessages();
    const unsub = base44.entities.Message.subscribe((event) => {
      if (cancelled) return;
      if (event?.data?.conversation_id === id) loadMessages();
    });
    return () => { cancelled = true; try { unsub?.(); } catch {} };
     
  }, [id, isAuthenticated, user?.id, isParticipant]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Firul altcuiva: inapoi in lista, nu randa chrome-ul conversatiei.
  if (isParticipant === false) return <Navigate to="/messages" replace />;

  const otherName = conv
    ? conv.buyer_id === user?.id
      ? conv.seller_name || otherUser?.full_name || (en ? "Landlord" : "Proprietar")
      : conv.buyer_name || otherUser?.full_name || (en ? "Buyer" : "Cumpărător")
    : "";

  const maybeSendReviewRequest = async () => {
    try {
      const nonSystemCount = (messages || []).filter((m) => !m.is_system).length + 1;
      if (nonSystemCount < 3) return;
      const existing = await base44.entities.Message.filter(
        { conversation_id: conv.id, is_system: true, system_type: "review_request" },
        "-created_date", 1
      ).catch(() => []);
      if (existing.length === 0) {
        const created = await base44.entities.Message.create({
          conversation_id: conv.id,
          sender_id: "system",
          sender_name: "VerifiCasa",
          recipient_id: otherUserId || "",
          content: "Sper că am fost pe placul așteptărilor tale, m-ar ajuta foarte mult o recenzie din partea dumneavoastră.",
          is_system: true,
          system_type: "review_request",
        }).catch(() => null);
        // recipient_id e camp nou: pana la publish e inghitit tacut la `create`,
        // dar acceptat la `update`. Stampila de urmarire il pune oricum.
        if (created?.id && !created.recipient_id && otherUserId) {
          base44.entities.Message.update(created.id, { recipient_id: otherUserId }).catch(() => {});
        }
      }
    } catch { /* best-effort */ }
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !conv) return;
    setSending(true);
    const content = text.trim();
    const ref = pendingRef;
    try {
      // Cine primeste mesajul, scris pe mesaj. Conversation stie asta, dar RLS
      // nu poate face join, deci datul trebuie denormalizat ca sa se poata
      // inchide vreodata citirea.
      const recipientId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
      const msgData = {
        conversation_id: conv.id,
        sender_id: user.id,
        sender_name: user.full_name || user.email,
        recipient_id: recipientId || "",
        content,
      };
      if (ref) Object.assign(msgData, ref);
      const createdMsg = await base44.entities.Message.create(msgData);
      // Camp nou => tacut ignorat la `create` pana la publish. Il stampilam.
      if (createdMsg?.id && !createdMsg.recipient_id && recipientId) {
        base44.entities.Message.update(createdMsg.id, { recipient_id: recipientId }).catch(() => {});
      }
      // Auto review-request after 3+ messages (once per conversation)
      maybeSendReviewRequest();
      base44.entities.Conversation.update(conv.id, { last_message: content }).catch(() => {});
      setPendingRef(null);
      setText("");
      const recipient = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;
      if (recipient && recipient !== user.id) {
        createNotification({
          userId: recipient,
          type: "message",
          text: "Ai un mesaj nou de la " + (user.full_name || user.email) + ".",
          link: "/messages/" + conv.id,
          actorName: user.full_name || user.email,
        });
      }
    } catch (err) {
      toast({ title: en ? "Could not send the message" : "Eroare la trimitere", variant: "destructive" });
    } finally { setSending(false); }
  };

  const markAllRead = async () => {
    if (busy || !messages) return;
    setBusy(true);
    try {
      const toUpdate = messages.filter((m) => m.sender_id !== user.id && !m.read_at && !m.is_system);
      const now = new Date().toISOString();
      await Promise.all(toUpdate.map((m) => base44.entities.Message.update(m.id, { read_at: now }).catch(() => {})));
      loadMessages();
    } finally { setBusy(false); }
  };

  const deleteConversation = async () => {
    if (!conv) return;
    const ask = en
      ? `Delete the conversation with ${otherName}? The messages will be gone for good.`
      : `Ștergi conversația cu ${otherName}? Mesajele vor fi șterse definitiv.`;
    if (!confirm(ask)) return;
    setBusy(true);
    try {
      await base44.entities.Message.deleteMany({ conversation_id: conv.id }).catch(() => {});
      await base44.entities.Conversation.delete(conv.id);
      toast({ title: en ? "Conversation deleted" : "Conversație ștearsă" });
      navigate("/messages", { replace: true });
    } catch { toast({ title: en ? "Delete failed" : "Eroare la ștergere", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header — shows other participant's name + avatar */}
      <div
        className="flex items-center gap-2 border-b border-border bg-card px-3 py-2.5 shadow-sm sm:px-4"
        style={{ paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}
      >
        <button
          onClick={() => navigate("/messages")}
          className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
          aria-label={en ? "Back to inbox" : "Înapoi la inbox"}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link to={otherUserId ? `/profile/${otherUserId}` : "#"} className="shrink-0">
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className={["flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white", avatarColor(otherUserId || id)].join(" ")}>
              {initials(otherName || "?")}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={otherUserId ? `/profile/${otherUserId}` : "#"}
            className="block truncate font-heading text-base font-bold text-navy hover:text-emerald dark:text-foreground"
          >
            {otherName || (en ? "Conversation" : "Conversație")}
          </Link>
          {conv?.property_id && conv.property_id !== "direct" ? (
            <Link to={`/property/${conv.property_id}`} className="block truncate text-xs text-muted-foreground hover:text-emerald">
              {conv?.property_title || (en ? "Property" : "Proprietate")}
            </Link>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{en ? "Direct conversation" : "Conversație directă"}</p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary"
              aria-label={en ? "Conversation options" : "Opțiuni conversație"}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-2xl">
            <DropdownMenuItem onClick={markAllRead} disabled={busy} className="gap-2 rounded-xl py-2.5">
              <CheckCheck className="h-4 w-4 text-emerald" /> {en ? "Mark all as read" : "Marchează toate ca citite"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={deleteConversation} disabled={busy} className="gap-2 rounded-xl py-2.5 text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> {en ? "Delete conversation" : "Șterge conversația"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-4">
        {messages === null ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-7 text-center text-sm text-muted-foreground sm:py-12">
            {en ? "No messages yet. Be the first to write." : "Niciun mesaj. Fii primul care scrie!"}
          </div>
        ) : (
          messages.map((m) => {
            // System message — review request notification
            if (m.is_system && m.system_type === "review_request") {
              return (
                <div key={m.id} className="flex justify-center px-2 py-2">
                  <div className="flex max-w-[90%] flex-col items-center gap-2 rounded-2xl border border-gold/30 bg-gold-soft px-4 py-3 text-center dark:border-gold/20 sm:max-w-[70%]">
                    <div className="flex items-center gap-2">
                      <VerifiCasaLogo size={28} withWordmark={false} />
                      <span className="text-xs font-bold uppercase tracking-wide text-gold-deep">VerifiCasa</span>
                    </div>
                    <p className="text-sm leading-relaxed text-navy dark:text-foreground">{m.content}</p>
                    {otherUser && (
                      <button
                        onClick={() => setShowReviewModal(true)}
                        className="mt-1 tap-44 flex h-9 items-center gap-1.5 rounded-full bg-emerald px-4 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-emerald/90"
                      >
                        <Star className="h-3.5 w-3.5 fill-current" /> {en ? "Leave a review" : "Lasă o recenzie"}
                      </button>
                    )}
                  </div>
                </div>
              );
            }
            const mine = m.sender_id === user.id;
            const readTitle = m.read_at
              ? (en
                ? `Seen at ${new Date(m.read_at).toLocaleString(dateLocale)}`
                : `Văzut la ${new Date(m.read_at).toLocaleString(dateLocale)}`)
              : (en ? "Sent · not seen yet" : "Trimis · încă nu a fost văzut");
            return (
              <div key={m.id} className={"flex gap-2 " + (mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  otherUser?.avatar_url ? (
                    <img src={otherUser.avatar_url} alt="" className="h-7 w-7 shrink-0 self-end rounded-full object-cover" />
                  ) : (
                    <span className={["flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-full text-[11px] font-bold text-white", avatarColor(otherUserId || id)].join(" ")}>
                      {initials(m.sender_name || "?")}
                    </span>
                  )
                )}
                <div className={"flex max-w-[82%] flex-col gap-0.5 sm:max-w-[70%] " + (mine ? "items-end" : "items-start")}>
                  <div className={[
                    "overflow-hidden rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm [overflow-wrap:anywhere]",
                    // text-primary-foreground is paper in light and near-ink in
                    // dark — both clear 5:1 on the verde bubble.
                    mine
                      ? "rounded-br-md bg-emerald text-primary-foreground"
                      : "rounded-bl-md border border-border/70 bg-secondary text-secondary-foreground",
                  ].join(" ")}>
                    {m.content}
                    {m.property_ref_id && <ChatPropertyCard message={m} mine={mine} />}
                  </div>
                  <div className={"flex items-center gap-1 px-1 " + (mine ? "flex-row-reverse" : "flex-row")}>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.created_date).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine && (m.read_at
                      ? <span title={readTitle} className="text-emerald"><CheckCheck className="h-3.5 w-3.5" /></span>
                      : <span title={readTitle} className="text-muted-foreground"><Check className="h-3.5 w-3.5" /></span>)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={en ? "Write a message..." : "Scrie un mesaj..."}
          aria-label={en ? "Write a message" : "Scrie un mesaj"}
          className="h-12 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-base outline-none focus:border-emerald"
        />
        <Button
          type="submit"
          disabled={sending || !text.trim()}
          className="h-12 w-12 shrink-0 rounded-full bg-emerald p-0 text-primary-foreground shadow-md hover:bg-emerald/90 disabled:opacity-50"
          aria-label={en ? "Send" : "Trimite"}
        >
          {sending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Send className="h-5 w-5" />}
        </Button>
      </form>

      {showReviewModal && otherUser && (
        <ReviewModal targetUser={otherUser} onClose={() => setShowReviewModal(false)} />
      )}
    </div>
  );
}