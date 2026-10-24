import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Image as UIImage } from "@/components/ui/image";
import { cn } from "@/lib/utils";
import { createNotification } from "@/lib/notifications";
import ReportModal from "@/components/ReportModal";
import { ShieldCheck, BadgeCheck, Lock, Heart, Reply, Send, Trash2 } from "lucide-react";

const ROLE_BADGE = {
  SUPER_ADMIN: { label: "Super Admin", cls: "bg-gold text-navy" },
  ADMIN: { label: "Admin", cls: "bg-navy text-emerald" },
  AGENT: { label: "Agent", cls: "bg-emerald-soft text-emerald" },
  PROPRIETAR: { label: "Proprietar", cls: "bg-emerald text-white" },
  USER: { label: "Utilizator", cls: "bg-secondary text-foreground" },
  SUPPORT: { label: "Support", cls: "bg-secondary text-foreground" },
};

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "admin"];

function Avatar({ url, name, className }) {
  const initials = (name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  if (url) {
    return <UIImage src={url} fittingType="fill" className={cn("rounded-full object-cover", className || "h-8 w-8")} />;
  }
  return (
    <span className={cn("flex items-center justify-center rounded-full bg-emerald-soft text-emerald font-bold", className || "h-8 w-8 text-xs")}>
      {initials}
    </span>
  );
}

export default function PropertyComments({ property }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isAdmin = isAuthenticated && ADMIN_ROLES.includes((user?.role || "").toUpperCase());
  const [comments, setComments] = useState(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyPosting, setReplyPosting] = useState(false);
  const [verifiedOwners, setVerifiedOwners] = useState(() => new Set());

  const load = async () => {
    try {
      const [list, approved] = await Promise.all([
        base44.entities.Comment.filter({ property_id: property.id }, "-created_date", 100),
        base44.entities.Property.filter({ approval_status: "APPROVED" }, "-created_date", 500),
      ]);
      setComments(list);
      setVerifiedOwners(new Set(approved.map((p) => p.created_by_id).filter(Boolean)));
    } catch (e) { setComments([]); }
  };

  // Rolul afișat: admin/agent/support din rolul platformei; altfel Proprietar
  // doar dacă utilizatorul are cel puțin un anunț aprobat, altfel Utilizator.
  const roleFor = (role, userId) => {
    const r = (role || "USER").toUpperCase();
    if (["SUPER_ADMIN", "ADMIN", "AGENT", "SUPPORT"].includes(r)) return r;
    return verifiedOwners.has(userId) ? "PROPRIETAR" : "USER";
  };
  useEffect(() => { load(); }, [property.id]);

  // Reîmprospătare în timp real: când oricine adaugă/editează/șterge un comentariu,
  // lista se reîncarcă automat (fără refresh), atât pentru cel care scrie, cât și pentru cel care citește.
  useEffect(() => {
    const unsub = base44.entities.Comment.subscribe(() => load());
    return () => { try { unsub && unsub(); } catch { /* noop */ } };
  }, [property.id]);

  const canPost = isAuthenticated && user?.is_verified;

  const submitComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (!canPost) { toast({ title: "Doar utilizatorii verificați pot comenta", variant: "destructive" }); return; }
    setPosting(true);
    try {
      await base44.entities.Comment.create({
        property_id: property.id, property_title: property.title,
        user_id: user.id, user_name: user.full_name || user.email,
        user_role: roleFor(user.role, user.id),
        avatar_url: user.avatar_url || "", content: content.trim(), likes: [],
      });
      const actor = user.full_name || user.email;
      // Notificăm proprietarul + toți ceilalți care au interacționat deja cu anunțul
      const recipients = new Set();
      if (property.created_by_id && property.created_by_id !== user.id) recipients.add(property.created_by_id);
      (comments || []).forEach((c) => { if (c.user_id && c.user_id !== user.id) recipients.add(c.user_id); });
      recipients.forEach((rid) => {
        const isOwner = rid === property.created_by_id;
        createNotification({
          userId: rid,
          type: "comment",
          text: isOwner
            ? `${actor} a comentat la anunțul tău „${property.title}".`
            : `${actor} a comentat la „${property.title}", un anunț pe care l-ai urmărit.`,
          link: `/property/${property.id}`,
          actorName: actor,
        });
      });
      try {
        base44.functions.invoke("NotifyOnComment", {
          property_id: property.id,
          property_title: property.title,
          author_name: actor,
          commenter_id: user.id,
          content: content.trim(),
        }).catch(() => {});
      } catch (_) {}
      setContent(""); load(); toast({ title: "Comentariu adăugat" });
    } catch (err) { toast({ title: "Eroare la comentariu", variant: "destructive" }); }
    finally { setPosting(false); }
  };

  const submitReply = async (parentId) => {
    if (!replyContent.trim()) return;
    if (!canPost) { toast({ title: "Doar utilizatorii verificați pot răspunde", variant: "destructive" }); return; }
    setReplyPosting(true);
    try {
      await base44.entities.Comment.create({
        property_id: property.id, property_title: property.title,
        user_id: user.id, user_name: user.full_name || user.email,
        user_role: roleFor(user.role, user.id),
        avatar_url: user.avatar_url || "", content: replyContent.trim(), parent_id: parentId, likes: [],
      });
      const actor = user.full_name || user.email;
      const parent = (comments || []).find((x) => x.id === parentId);
      if (parent && parent.user_id && parent.user_id !== user.id) {
        createNotification({
          userId: parent.user_id,
          type: "reply",
          text: `${actor} a răspuns comentariului tău la „${property.title}".`,
          link: `/property/${property.id}`,
          actorName: actor,
        });
      } else if (property.created_by_id && property.created_by_id !== user.id) {
        createNotification({
          userId: property.created_by_id,
          type: "reply",
          text: `${actor} a răspuns la un comentariu la „${property.title}".`,
          link: `/property/${property.id}`,
          actorName: actor,
        });
      }
      setReplyContent(""); setReplyTo(null); load();
    } catch (err) { toast({ title: "Eroare la răspuns", variant: "destructive" }); }
    finally { setReplyPosting(false); }
  };

  const toggleLike = async (c) => {
    if (!isAuthenticated) { toast({ title: "Conectează-te pentru a aprecia", variant: "destructive" }); return; }
    const likes = c.likes || [];
    const has = likes.includes(user.id);
    const next = has ? likes.filter((id) => id !== user.id) : [...likes, user.id];
    setComments((cs) => (cs || []).map((x) => (x.id === c.id ? { ...x, likes: next } : x)));
    try {
      await base44.entities.Comment.update(c.id, { likes: next });
      if (!has && c.user_id && c.user_id !== user.id) {
        createNotification({
          userId: c.user_id,
          type: "like",
          text: `${user.full_name || user.email} a apreciat comentariul tău la „${property.title}".`,
          link: `/property/${property.id}`,
          actorName: user.full_name || user.email,
        });
      }
    }
    catch (e) { setComments((cs) => (cs || []).map((x) => (x.id === c.id ? { ...x, likes } : x))); toast({ title: "Eroare la like", variant: "destructive" }); }
  };

  const deleteComment = async (c) => {
    if (!confirm("Ștergi acest comentariu?")) return;
    try {
      await base44.entities.Comment.delete(c.id);
      setComments((cs) => (cs || []).filter((x) => x.id !== c.id && x.parent_id !== c.id));
      toast({ title: "Comentariu șters" });
    } catch (e) { toast({ title: "Eroare la ștergere", variant: "destructive" }); }
  };

  const topLevel = (comments || []).filter((c) => !c.parent_id);
  const repliesOf = (parentId) => (comments || []).filter((c) => c.parent_id === parentId);

  const renderBadge = (role, userId) => {
    const r = roleFor(role, userId);
    const badge = ROLE_BADGE[r] || ROLE_BADGE.USER;
    const Icon = r === "PROPRIETAR" ? BadgeCheck : ["SUPER_ADMIN", "ADMIN", "AGENT", "SUPPORT"].includes(r) ? ShieldCheck : null;
    return (
      <span className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold", badge.cls)}>
        {Icon && <Icon className="h-3 w-3" />} {badge.label}
      </span>
    );
  };

  const renderComment = (c, isReply = false) => {
    const name = c.user_name || "Utilizator";
    const likeCount = (c.likes || []).length;
    const liked = isAuthenticated && (c.likes || []).includes(user.id);
    return (
      <div key={c.id} className={cn("py-3", isReply && "pl-5 sm:pl-10")}>
        <div className="flex items-start gap-3">
          <Avatar url={c.avatar_url} name={name} className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-navy dark:text-foreground">{name}</span>
              {renderBadge(c.user_role, c.user_id)}
              <span className="ml-auto text-[10px] text-muted-foreground">{new Date(c.created_date).toLocaleDateString("ro-RO")}</span>
            </div>
            <p className="mt-1 text-sm text-foreground/80">{c.content}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <button onClick={() => toggleLike(c)} className={cn("flex items-center gap-1 text-xs font-semibold transition", liked ? "text-rose-500" : "text-muted-foreground hover:text-rose-500")}>
                <Heart className={cn("h-3.5 w-3.5", liked && "fill-rose-500")} /> {likeCount > 0 ? likeCount : ""} Apreciază
              </button>
              {canPost && !isReply && (
                <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyContent(""); }} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-emerald">
                  <Reply className="h-3.5 w-3.5" /> Răspunde
                </button>
              )}
              <ReportModal targetType="comment" targetId={c.id} targetTitle={(c.content || "").slice(0, 80)} variant="ghost" />
              {isAdmin && (
                <button onClick={() => deleteComment(c)} aria-label="Șterge" title="Șterge" className="flex shrink-0 items-center text-muted-foreground transition hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>

            {replyTo === c.id && canPost && (
              <div className="mt-3 flex items-end gap-2">
                <Textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} rows={2} placeholder={`Răspunde lui ${name}...`} className="resize-none text-sm" />
                <Button type="button" size="sm" onClick={() => submitReply(c.id)} disabled={replyPosting} className="bg-emerald text-white hover:bg-emerald/90"><Send className="h-4 w-4" /></Button>
              </div>
            )}

            {!isReply && repliesOf(c.id).length > 0 && (
              <div className="mt-1 space-y-0 divide-y divide-border/30">{repliesOf(c.id).map((r) => renderComment(r, true))}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded border border-border bg-white p-4 shadow-soft dark:bg-card sm:p-6">
      {/* Bula de chat stătea înaintea titlului și împingea cuvântul cu 28px
          dincolo de marginea din stânga a tot ce urmează sub el. */}
      <h3 className="font-heading text-lg font-bold text-navy dark:text-foreground">Comentarii</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {isAuthenticated
          ? user?.is_verified ? "Poți publica comentarii și răspunsuri (cont verificat)." : "Doar conturile verificate pot publica. Aprecierile sunt libere."
          : "Conectează-te pentru a comenta sau aprecia."}
      </p>

      {isAuthenticated ? (
        user?.is_verified ? (
          <form onSubmit={submitComment} className="mt-4 space-y-2">
            <div className="flex items-start gap-3">
              <Avatar url={user.avatar_url} name={user.full_name || user.email} className="h-9 w-9 shrink-0" />
              <div className="flex-1 space-y-2">
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Scrie un comentariu..." className="resize-none" />
                <Button type="submit" disabled={posting} className="bg-emerald text-white hover:bg-emerald/90">{posting ? "Public..." : "Publică"}</Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded border border-dashed border-border bg-secondary/30 px-4 py-3 text-xs text-muted-foreground">
            <Lock className="h-4 w-4" /> Contul tău nu este verificat. Solicită verificarea pentru a putea comenta.
          </div>
        )
      ) : (
        <div className="mt-4 rounded border border-dashed border-border bg-secondary/30 px-4 py-3 text-center text-xs text-muted-foreground">
          <a href="/login" className="font-bold text-emerald">Conectează-te</a> pentru a lăsa un comentariu.
        </div>
      )}

      <div className="mt-5 divide-y divide-border/50">
        {comments === null ? <p className="text-sm text-muted-foreground">Se încarcă...</p>
        : topLevel.length === 0 ? <p className="text-sm text-muted-foreground">Niciun comentariu încă. Fii primul!</p>
        : topLevel.map((c) => renderComment(c))}
      </div>
    </div>
  );
}