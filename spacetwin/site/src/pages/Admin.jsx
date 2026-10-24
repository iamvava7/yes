import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { Image as UIImage } from "@/components/ui/image";
import { ShieldAlert, Check, X, Trash2, RefreshCw, Search, Users, ShieldCheck, Clock, ClipboardList, Building2, MessageSquare, FileText, Pencil, History, Flag, ClipboardCheck, Crown, Mail, Phone, Wrench, CreditCard, KeyRound, Languages } from "lucide-react";
import PropertyEditForm from "@/components/PropertyEditForm";
import PropertyLogs from "@/components/PropertyLogs";
import AdminReports from "@/components/AdminReports";
import AdminResolvedReports from "@/components/AdminResolvedReports";
import AdminStatCard from "@/components/AdminStatCard";
import AdminDataCleanup from "@/components/AdminDataCleanup";
import AdminPlanSync from "@/components/AdminPlanSync";
import AdminPlansPricing from "@/components/admin/AdminPlansPricing";
import AdminIntegrations from "@/components/admin/AdminIntegrations";
import SiteTextEditor from "@/components/admin/SiteTextEditor";
import { callFn, callFnQuiet } from "@/lib/serverCall";
import InspectionContactModal from "@/components/InspectionContactModal";
import { useLoadMore } from "@/hooks/useLoadMore";
import LoadMoreButton from "@/components/admin/LoadMoreButton";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "admin"];
const ROLE_OPTIONS = ["PROPRIETAR", "AGENT", "ADMIN", "SUPER_ADMIN", "SUPPORT", "user"];

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [properties, setProperties] = useState(null);
  const [comments, setComments] = useState(null);
  const [audit, setAudit] = useState(null);
  const [users, setUsers] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [inspections, setInspections] = useState(null);
  const [inquiries, setInquiries] = useState(null);
  const [reports, setReports] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [propSearch, setPropSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [commentSearch, setCommentSearch] = useState("");
  const [featuredInput, setFeaturedInput] = useState("");
  const [contactTarget, setContactTarget] = useState(null);
  const [contactSending, setContactSending] = useState(false);

  // Paginare incrementală — afișăm câte 5 itemi per secțiune; restul la „Încarcă mai mult".
  // Reset automat la schimbarea filtrului/tab-ului, dar NU la realtime reload.
  const { count: propCount, loadMore: loadMoreProps } = useLoadMore(5, [propSearch, tab]);
  const { count: auditCount, loadMore: loadMoreAudit } = useLoadMore(5, [auditSearch, tab]);
  const { count: userCount, loadMore: loadMoreUsers } = useLoadMore(5, [userSearch, tab]);
  const { count: commentCount, loadMore: loadMoreComments } = useLoadMore(5, [commentSearch, tab]);
  const { count: inspCount, loadMore: loadMoreInsp } = useLoadMore(5, [tab]);
  const { count: featCount, loadMore: loadMoreFeat } = useLoadMore(5, [tab]);
  const { count: inspDoneCount, loadMore: loadMoreInspDone } = useLoadMore(5, [tab]);

  const isAllowed = isAuthenticated && user && ADMIN_ROLES.includes((user.role || "").toUpperCase());
  const isSuper = (user?.role || "").toUpperCase() === "SUPER_ADMIN";

  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };
  const load = async () => {
    const [props, cmts, logs, usrs, insp, inq, reps] = await Promise.all([
      safe(() => base44.entities.Property.list("-created_date", 100), []),
      safe(() => base44.entities.Comment.list("-created_date", 50), []),
      safe(() => base44.entities.AuditLog.list("-created_date", 50), []),
      safe(() => base44.entities.User.list("-created_date", 100), []),
      safe(() => base44.entities.InspectionRequest.list("-created_date", 50), []),
      safe(() => base44.entities.Inquiry.list("-created_date", 50), []),
      safe(() => base44.entities.Report.list("-created_date", 100), []),
    ]);
    setProperties(props); setComments(cmts); setAudit(logs); setUsers(usrs);
    setInspections(insp); setInquiries(inq); setReports(reps);
  };

  useEffect(() => { if (isAllowed) load(); }, [isAllowed]);

  // Real-time: any create/update/delete on listings, comments, users,
  // inspections, inquiries, reports or audit log reloads the whole panel
  // automatically — no manual refresh needed after resolving a report,
  // approving a listing, deleting a comment, etc.
  useEffect(() => {
    if (!isAllowed) return;
    const unsubs = [];
    const names = ["Property", "Comment", "AuditLog", "User", "InspectionRequest", "Inquiry", "Report"];
    names.forEach((n) => {
      try { unsubs.push(base44.entities[n].subscribe(() => load())); } catch { /* noop */ }
    });
    return () => { unsubs.forEach((u) => { try { u && u(); } catch { /* noop */ } }); };
  }, [isAllowed]);

  const log = async (action, target_type, target_id, detail) => {
    try {
      await base44.entities.AuditLog.create({
        actor_id: user.id, actor_name: user.full_name || user.email,
        actor_role: (user.role || "").toUpperCase(), action, target_type, target_id, detail: detail || "",
      });
    } catch {}
  };

  const setApproval = async (p, status) => {
    try {
      const patch = { approval_status: status };
      if (status === "APPROVED") {
        patch.approved_by_id = user.id;
        patch.approved_by_name = user.full_name || user.email;
        patch.approved_date = new Date().toISOString();
      } else {
        patch.approved_by_id = null; patch.approved_by_name = null; patch.approved_date = null;
      }
      await base44.entities.Property.update(p.id, patch);
      toast({ title: status === "APPROVED" ? "Anunt aprobat" : "Anunt respins" });
      log(status === "APPROVED" ? "approve" : "reject", "property", p.id, p.title);
      callFnQuiet("NotifyOnPropertyDecision", { property_id: p.id, decision: status });
      // Aprobarea de admin intră în banda de verificare — recalculăm scorul ca
      // decizia să se vadă imediat.
      callFnQuiet("ComputeTrustScore", { property_id: p.id });
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  // Recalculează scorul ȘI arată răspunsul brut. Ăsta e instrumentul care
  // spune de ce un anunț stă pe 0: până acum fiecare apel era înghițit de un
  // `.catch(() => {})`, deci eșecul nu apărea nicăieri.
  const [scoring, setScoring] = useState(null);
  const recomputeScore = async (p) => {
    setScoring(p.id);
    const res = await callFn("ComputeTrustScore", { property_id: p.id });
    setScoring(null);
    if (res.ok) {
      toast({
        title: `Scor: ${res.data.score}/100`,
        description: (res.data.breakdown?.bands || [])
          .map((b) => `${b.label} ${b.points}/${b.max}`).join(" · "),
      });
      load();
    } else {
      toast({ title: "Scorul nu s-a putut calcula", description: res.error, variant: "destructive" });
    }
  };

  const delProperty = async (p) => {
    if (!confirm("Stergi definitiv acest anunt?")) return;
    try {
      await base44.entities.Property.delete(p.id);
      // Clean up orphaned notifications referencing this property
      try {
        const propNotifs = await base44.entities.Notification.filter({ link: `/property/${p.id}` }, "-created_date", 100);
        if (propNotifs.length) await base44.entities.Notification.deleteMany({ link: `/property/${p.id}` });
      } catch {}
      toast({ title: "Anunt sters" });
      log("delete", "property", p.id, p.title);
      load();
    } catch { toast({ title: "Eroare la stergere", variant: "destructive" }); }
  };

  const delComment = async (c) => {
    if (!confirm("Stergi comentariul?")) return;
    try {
      await base44.entities.Comment.delete(c.id);
      toast({ title: "Comentariu sters" });
      log("moderate", "comment", c.id, c.content?.slice(0, 40));
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  const changeRole = async (u, role) => {
    if (!isSuper) { toast({ title: "Doar SUPER_ADMIN poate schimba grade", variant: "destructive" }); return; }
    if (u.id === user.id && role !== user.role) { toast({ title: "Nu poti schimba propriul rol", variant: "destructive" }); return; }
    try {
      await base44.entities.User.update(u.id, { role });
      toast({ title: "Rol actualizat: " + role });
      log("role_change", "user", u.id, u.email + " to " + role);
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  const delUser = async (u) => {
    if (!isSuper) { toast({ title: "Doar SUPER_ADMIN poate sterge conturi", variant: "destructive" }); return; }
    if (u.id === user.id) { toast({ title: "Nu poti sterge propriul cont", variant: "destructive" }); return; }
    if (!confirm("Stergi utilizatorul " + u.email + "?")) return;
    try {
      await base44.entities.User.delete(u.id);
      toast({ title: "Utilizator sters" });
      log("delete", "user", u.id, u.email);
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  const toggleAiTour = async (p) => {
    try {
      const next = !p.ai_tour_verified;
      await base44.entities.Property.update(p.id, {
        ai_tour_verified: next,
        verification_level: next ? "video_ai" : (p.verification_level === "video_ai" ? "unverified" : p.verification_level),
      });
      toast({ title: next ? "Tur 3D activat" : "Tur 3D retras" });
      log(next ? "enable_ai_tour" : "disable_ai_tour", "property", p.id, p.title);
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  const toggleFeatured = async (p) => {
    try {
      await base44.entities.Property.update(p.id, { featured: !p.featured });
      toast({ title: !p.featured ? "Badge Recomandat acordat" : "Badge Recomandat retras" });
      log(!p.featured ? "grant_featured" : "revoke_featured", "property", p.id, p.title);
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  const grantFeaturedById = async () => {
    const input = featuredInput.trim();
    if (!input) return;
    const p = (properties || []).find((x) => x.id === input || String(x.property_code) === input || x.id.startsWith(input));
    if (!p) { toast({ title: "Proprietate negasita", variant: "destructive" }); return; }
    if (p.featured) { toast({ title: "Aceasta proprietate are deja badge-ul", variant: "destructive" }); return; }
    await toggleFeatured(p);
    setFeaturedInput("");
  };

  const verifyUser = async (u, val) => {
    if (!val && !isSuper) { toast({ title: "Doar SUPER_ADMIN poate retrage conturi", variant: "destructive" }); return; }
    try {
      await base44.entities.User.update(u.id, { is_verified: val });
      toast({ title: val ? "Utilizator verificat" : "Verificare retrasa" });
      log("verify", "user", u.id, u.email);
      load();
    } catch { toast({ title: "Eroare", variant: "destructive" }); }
  };

  // Admin a contactat proprietarul pentru o cerere de inspecție:
  // trimite e-mail automat, schimbă statusul în "Contactat" și salvează AuditLog.
  const contactInspection = async (note) => {
    const r = contactTarget;
    if (!r) return;
    setContactSending(true);
    try {
      await base44.entities.InspectionRequest.update(r.id, { status: "Contactat" });
      log("contact_inspection", "inspection", r.id,
        `${r.name || "—"} · ${r.address_or_url || "—"} · ${r.package_interest || "—"}${note ? " · Notă: " + note : ""}`);
      try {
        base44.functions.invoke("NotifyOnInspectionContacted", {
          inspection_id: r.id, name: r.name, email: r.email,
          address_or_url: r.address_or_url, package_interest: r.package_interest,
          admin_note: note || "",
        }).catch(() => {});
      } catch {}
      toast({ title: "Proprietar contactat", description: "E-mail trimis și cerere mutată la Rezolvate." });
      setContactTarget(null);
      load();
    } catch {
      toast({ title: "Eroare la contactare", variant: "destructive" });
    } finally {
      setContactSending(false);
    }
  };

  if (isAuthenticated && !isAllowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:py-20">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 font-heading text-xl font-bold sm:text-2xl text-navy dark:text-foreground">Acces restrictionat</h1>
        <p className="mt-1 text-sm text-muted-foreground">Doar administratorii pot accesa acest panou.</p>
        <Button asChild className="mt-4 bg-emerald text-white"><Link to="/">Inapoi acasa</Link></Button>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const pending = (properties || []).filter((p) => p.approval_status !== "APPROVED");
  const all = properties || [];
  const codeById = new Map();
  all.forEach((p) => codeById.set(p.id, p.property_code));
  const filteredUsers = (users || []).filter((u) => {
    const q = userSearch.toLowerCase();
    if (!q) return true;
    return (u.email || "").toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q);
  });

  const PTABS = [
    { k: "pending",            label: "In asteptare", icon: Clock,          count: pending.length,                                                 tone: "amber" },
    { k: "users",              label: "Utilizatori",  icon: Users,           count: (users || []).length,                                           tone: "emerald" },
    { k: "inspectii",          label: "Inspectii",    icon: ClipboardList,   count: (inspections || []).filter((r) => r.status === "Nou").length,   tone: "emerald" },
    { k: "rapoarte",           label: "Sesizari",     icon: Flag,            count: (reports || []).filter((r) => r.status === "PENDING").length,   tone: "rose" },
    { k: "rapoarte_rezolvate", label: "Rezolvate",    icon: ClipboardCheck,  count: (reports || []).filter((r) => r.status !== "PENDING").length + (inspections || []).filter((r) => r.status !== "Nou").length, tone: "emerald" },
    { k: "recomandate",        label: "Recomandate",   icon: Crown,            count: all.filter((p) => p.featured).length,                           tone: "gold" },
  ];
  const GTABS = [
    { k: "all",      label: "Toate anunturile",   icon: Building2 },
    { k: "comments", label: "Comentarii",          icon: MessageSquare },
    { k: "audit",    label: "Audit log",           icon: FileText },
    { k: "planuri",  label: "Planuri & Prețuri",   icon: CreditCard },
    { k: "texte",    label: "Texte site",          icon: Languages },
    ...(isSuper || user?.role === "admin" ? [{ k: "integrari", label: "Integrări & chei API", icon: KeyRound }] : []),
    { k: "loguri",   label: "Loguri proprietate",  icon: History },
    { k: "date",     label: "Curățare date",       icon: Wrench },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-white dark:bg-card shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy sm:h-9 sm:w-9 sm:rounded">
              <ShieldAlert className="h-4 w-4 text-emerald sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-heading text-base font-bold text-navy dark:text-foreground sm:text-xl">
                Admin Panel
                {isSuper && <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-emerald">Super</span>}
              </h1>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Moderare anunturi{isSuper ? " · Super Admin" : ""}
              </p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={load} aria-label="Reincarca" className="h-8 w-8 shrink-0 rounded sm:h-9 sm:w-auto sm:gap-1.5 sm:px-4 sm:text-sm">
            <RefreshCw className="h-4 w-4" /> <span className="hidden sm:inline">Reincarca</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Stat cards */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "In asteptare",   value: pending.length,                                                icon: Clock,      tone: "amber" },
            { label: "Utilizatori",    value: (users || []).length,                                          icon: Users,      tone: "emerald" },
            { label: "Sesizari",       value: (reports || []).filter((r) => r.status === "PENDING").length,  icon: Flag,       tone: "rose" },
            { label: "Total anunturi", value: all.length,                                                    icon: Building2,  tone: "slate" },
          ].map((s) => (
            <AdminStatCard key={s.label} {...s} />
          ))}
        </div>

        {/* Tab nav */}
        <div className="mb-5 rounded border border-border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Prioritare</p>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar">
              {PTABS.map((t) => {
                const Ico = t.icon;
                const isActive = tab === t.k;
                return (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-3.5 py-2 text-sm font-semibold transition " +
                      (isActive ? "bg-navy text-white shadow-sm" : "text-foreground/70 hover:bg-secondary/60")}
                  >
                    <Ico className={"h-4 w-4 " + (isActive ? "text-emerald" : t.tone === "rose" ? "text-rose-500" : t.tone === "amber" ? "text-amber-500" : t.tone === "gold" ? "text-gold-deep" : "text-emerald")} />
                    {t.label}
                    {t.count > 0 && (
                      <span className={"rounded px-1.5 py-0.5 text-[10px] font-bold " +
                        (isActive ? "bg-white/20 text-white" :
                         t.tone === "rose" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" :
                         t.tone === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                         t.tone === "gold" ? "bg-gold-soft text-gold-deep" :
                         "bg-emerald-soft text-emerald")}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mx-4 border-t border-border" />
          <div className="px-4 pt-3 pb-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Gestionare</p>
            <div className="flex flex-wrap gap-1.5">
              {GTABS.map((t) => {
                const Ico = t.icon;
                const isActive = tab === t.k;
                return (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    className={"flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition " +
                      (isActive ? "bg-secondary text-foreground font-semibold" : "text-foreground/60 hover:bg-secondary/50")}
                  >
                    <Ico className="h-3.5 w-3.5" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div>
          {tab === "inspectii" ? (
            <div className="space-y-2">
              {(() => {
                const items = (inspections || []).filter((r) => r.status === "Nou");
                if (items.length === 0) return <p className="text-sm text-muted-foreground">Nicio solicitare de inspectie nepreluata.</p>;
                const visible = items.slice(0, inspCount);
                return (
                  <>
                    {visible.map((r) => (
                <div key={r.id} className="rounded border border-border bg-white p-4 dark:bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-heading font-bold text-navy dark:text-foreground">
                        {r.name} <span className="text-xs font-normal text-muted-foreground">· {r.role}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{r.email} · {r.phone || "fara tel"}</p>
                    </div>
                    <span className="rounded-full bg-emerald-soft px-2.5 py-0.5 text-[11px] font-semibold text-emerald">
                      {r.status}
                    </span>
                  </div>
                  {r.address_or_url && <p className="mt-1 text-xs text-muted-foreground">Adresa: {r.address_or_url}</p>}
                  {r.package_interest && <p className="text-xs text-muted-foreground">Pachet: {r.package_interest}</p>}
                  {r.message && <p className="mt-1 text-sm text-foreground/80">{r.message}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setContactTarget(r)} className="gap-1.5 bg-emerald text-white hover:bg-emerald/90">
                      <Mail className="h-3.5 w-3.5" /> Contactează proprietarul
                    </Button>
                    {r.phone && (
                      <Button size="sm" variant="outline" asChild className="gap-1 border-emerald/40 text-emerald hover:bg-emerald-soft">
                        <a href={`tel:${r.phone}`}><Phone className="h-3.5 w-3.5" /> {r.phone}</a>
                      </Button>
                    )}
                  </div>
                </div>
                    ))}
                    {items.length > visible.length && (
                      <LoadMoreButton onClick={loadMoreInsp} remaining={items.length - visible.length} />
                    )}
                  </>
                );
              })()}
            </div>

          ) : tab === "audit" ? (
            <div className="space-y-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cauta dupa ID, autor sau actiune..."
                  className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald dark:bg-card"
                />
              </div>
              {(() => {
                const as = (auditSearch || "").toLowerCase();
                const src = (audit || []).filter((a) =>
                  !as || [a.actor_name, a.action, a.target_type, a.target_id, codeById.get(a.target_id), a.detail]
                    .filter(Boolean).join(" ").toLowerCase().includes(as)
                );
                if (src.length === 0) return <p className="text-sm text-muted-foreground">Nicio actiune gasita.</p>;
                const visible = src.slice(0, auditCount);
                return (
                  <>
                    {visible.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded border border-border bg-white p-3 text-sm dark:bg-card">
                    <span>
                      <b className="text-navy dark:text-foreground">{a.actor_name}</b>
                      <span className="text-muted-foreground">
                        {" · "}{a.action}{" · "}{a.target_type}
                        {a.target_id ? " · Cod: " + (codeById.get(a.target_id) || a.target_id.slice(0, 8)) : ""}
                        {a.detail ? " · " + a.detail : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(a.created_date).toLocaleString("ro-RO")}</span>
                  </div>
                    ))}
                    {src.length > visible.length && (
                      <LoadMoreButton onClick={loadMoreAudit} remaining={src.length - visible.length} />
                    )}
                  </>
                );
              })()}
            </div>

          ) : tab === "date" ? (
            <div className="space-y-4">
              <AdminDataCleanup onDone={load} />
            </div>
          ) : tab === "planuri" ? (
            <div className="space-y-4">
              <AdminPlansPricing canEdit={isSuper || user?.role === "admin"} />
              <AdminPlanSync />
            </div>
          ) : tab === "texte" ? (
            <SiteTextEditor />
          ) : tab === "integrari" ? (
            <AdminIntegrations canEdit={isSuper || user?.role === "admin"} />
          ) : tab === "loguri" ? (
            <PropertyLogs properties={properties || []} audit={audit || []} comments={comments || []} inquiries={inquiries || []} />

          ) : tab === "rapoarte" ? (
            <AdminReports reports={(reports || []).filter((r) => r.status === "PENDING")} properties={properties || []} onReload={load} />

          ) : tab === "rapoarte_rezolvate" ? (
            <div className="space-y-5">
              {(() => {
                const insp = (inspections || []).filter((r) => r.status !== "Nou");
                if (insp.length > 0) {
                  return (
                    <div>
                      <p className="mb-2 text-sm font-semibold text-navy dark:text-foreground">
                        Inspecții preluate ({insp.length})
                      </p>
                      <div className="space-y-2">
                        {insp.slice(0, inspDoneCount).map((r) => (
                          <div key={r.id} className="rounded border border-border bg-white p-4 dark:bg-card">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-heading font-bold text-navy dark:text-foreground">
                                  {r.name} <span className="text-xs font-normal text-muted-foreground">· {r.role}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">{r.email} · {r.phone || "fara tel"}</p>
                              </div>
                              <span className={"rounded px-2.5 py-0.5 text-[11px] font-semibold " +
                                (r.status === "Contactat" ? "bg-emerald-soft text-emerald" : "bg-secondary text-muted-foreground")}>
                                {r.status}
                              </span>
                            </div>
                            {r.address_or_url && <p className="mt-1 text-xs text-muted-foreground">Adresa: {r.address_or_url}</p>}
                            {r.package_interest && <p className="text-xs text-muted-foreground">Pachet: {r.package_interest}</p>}
                          </div>
                        ))}
                        {insp.length > inspDoneCount && (
                          <LoadMoreButton onClick={loadMoreInspDone} remaining={insp.length - inspDoneCount} />
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              <AdminResolvedReports reports={(reports || []).filter((r) => r.status !== "PENDING")} />
            </div>

          ) : tab === "users" ? (
            <div className="space-y-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cauta dupa nume sau email..."
                  className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald dark:bg-card"
                />
              </div>
              {users === null
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded" />)
                : filteredUsers.length === 0
                ? <p className="text-sm text-muted-foreground">Niciun utilizator gasit.</p>
                : filteredUsers.slice(0, userCount).map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 rounded border border-border bg-white p-4 shadow-soft dark:bg-card">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-soft text-emerald">
                      <Users className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading font-bold text-navy dark:text-foreground">{u.full_name || u.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email} · {u.is_verified ? "Verificat" : "Neverificat"}</p>
                    </div>
                    <select
                      value={u.role || "user"}
                      onChange={(e) => changeRole(u, e.target.value)}
                      disabled={u.id === user.id || !isSuper}
                      className="vc-select vc-select-sm rounded border border-border bg-white py-1.5 pl-3 pr-7 text-xs font-semibold outline-none focus:border-emerald disabled:opacity-60 dark:bg-card"
                    >
                      {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => verifyUser(u, !u.is_verified)} className="gap-1 border-emerald/40 text-emerald hover:bg-emerald-soft" disabled={u.is_verified && !isSuper}>
                      <ShieldCheck className="h-3.5 w-3.5" /> {u.is_verified ? "Retrage" : "Verifica"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => delUser(u)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10" disabled={!isSuper}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {filteredUsers.length > userCount && (
                  <LoadMoreButton onClick={loadMoreUsers} remaining={filteredUsers.length - userCount} />
                )}
            </div>

          ) : tab === "comments" ? (
            <div className="space-y-2">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={commentSearch}
                  onChange={(e) => setCommentSearch(e.target.value)}
                  placeholder="Cauta dupa autor, continut sau proprietate..."
                  className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald dark:bg-card"
                />
              </div>
              {(() => {
                const cs = (commentSearch || "").toLowerCase();
                const items = (comments || []).filter((c) =>
                  !cs || [c.user_name, c.content, c.property_title, c.user_role].filter(Boolean).join(" ").toLowerCase().includes(cs)
                );
                if (items.length === 0) return <p className="text-sm text-muted-foreground">Niciun comentariu gasit.</p>;
                const visible = items.slice(0, commentCount);
                return (
                  <>
                    {visible.map((c) => (
                  <div key={c.id} className="rounded border border-border bg-white p-3 dark:bg-card">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        <b className="text-navy dark:text-foreground">{c.user_name}</b>
                        <span className="text-xs text-muted-foreground"> · {c.user_role} · pe {c.property_title}</span>
                      </span>
                      <Button variant="outline" size="sm" onClick={() => delComment(c)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" /> Sterge
                      </Button>
                    </div>
                    <p className="mt-1 text-sm text-foreground/80">{c.content}</p>
                  </div>
                    ))}
                    {items.length > visible.length && (
                      <LoadMoreButton onClick={loadMoreComments} remaining={items.length - visible.length} />
                    )}
                  </>
                );
              })()}
            </div>

          ) : tab === "recomandate" ? (
            <div className="space-y-4">
              <div className="rounded border border-gold/30 bg-gold-soft/30 p-4 dark:bg-card">
                <div className="mb-1 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-gold-deep" />
                  <h3 className="font-heading font-bold text-navy dark:text-foreground">Acordare badge Recomandat</h3>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">Introdu ID-ul sau codul proprietatii pentru a acorda badge-ul premium Recomandat.</p>
                <div className="flex gap-2">
                  <input
                    value={featuredInput}
                    onChange={(e) => setFeaturedInput(e.target.value)}
                    placeholder="ID proprietate sau cod..."
                    className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-gold dark:bg-card"
                    onKeyDown={(e) => { if (e.key === "Enter") grantFeaturedById(); }}
                  />
                  <Button onClick={grantFeaturedById} className="gap-1.5 gradient-gold text-white hover:opacity-90">
                    <Crown className="h-4 w-4" /> Acorda
                  </Button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-navy dark:text-foreground">
                  Proprietati recomandate ({all.filter((p) => p.featured).length})
                </p>
                {all.filter((p) => p.featured).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nicio proprietate recomandata.</p>
                ) : (
                  <div className="space-y-2">
                    {all.filter((p) => p.featured).slice(0, featCount).map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded border border-gold/30 bg-white p-3 dark:bg-card">
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                          {p.images?.[0] && <UIImage src={p.images[0]} fittingType="fill" className="h-full w-full" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-heading font-bold text-navy line-clamp-1 dark:text-foreground">{p.title}</p>
                          <p className="text-xs text-muted-foreground">{p.zone}, {p.city} · Cod: {p.property_code || p.id.slice(0, 8)}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => toggleFeatured(p)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
                          <X className="h-3.5 w-3.5" /> Retrage
                        </Button>
                      </div>
                    ))}
                    {all.filter((p) => p.featured).length > featCount && (
                      <LoadMoreButton onClick={loadMoreFeat} remaining={all.filter((p) => p.featured).length - featCount} />
                    )}
                  </div>
                )}
              </div>
            </div>

          ) : (
            // pending + all
            <div className="space-y-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={propSearch}
                  onChange={(e) => setPropSearch(e.target.value)}
                  placeholder="Cauta dupa titlu sau ID..."
                  className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald dark:bg-card"
                />
              </div>
              {(() => {
                const ps = (propSearch || "").toLowerCase();
                const src = (tab === "pending" ? pending : all).filter(
                  (p) => !ps || (p.title || "").toLowerCase().includes(ps) || (p.id || "").toLowerCase().includes(ps)
                );
                if (src.length === 0) {
                  return properties === null
                    ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded" />)
                    : <p className="text-sm text-muted-foreground">{tab === "pending" ? "Niciun anunt in asteptare." : "Niciun anunt gasit."}</p>;
                }
                const visible = src.slice(0, propCount);
                return (
                  <>
                  {visible.map((p) => {
                  if (editingId === p.id) {
                    return <PropertyEditForm key={p.id} property={p} isAdmin onDone={() => { setEditingId(null); load(); }} />;
                  }
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-4 rounded border border-border bg-white p-4 shadow-soft dark:bg-card">
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-secondary">
                        {p.images?.[0] && <UIImage src={p.images[0]} fittingType="fill" className="h-full w-full" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-navy line-clamp-1 dark:text-foreground">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.zone}, {p.city} · {p.property_type} · {p.price_monthly}
                          {" · "}
                          <span className={p.approval_status === "APPROVED" ? "font-semibold text-emerald" : "font-semibold text-amber-600"}>
                            {p.approval_status || "PENDING"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                          Cod: <span className="select-all font-mono font-semibold text-foreground/60">{p.property_code || p.id}</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(p.id)} className="gap-1 border-emerald/40 text-emerald hover:bg-emerald-soft">
                          <Pencil className="h-3.5 w-3.5" /> Editeaza
                        </Button>
                        {p.approval_status !== "APPROVED" && (
                          <Button size="sm" onClick={() => setApproval(p, "APPROVED")} className="gap-1 bg-emerald text-white">
                            <Check className="h-3.5 w-3.5" /> Aproba
                          </Button>
                        )}
                        {p.approval_status === "APPROVED" && (
                          <Button size="sm" variant="outline" onClick={() => setApproval(p, "REJECTED")} className="gap-1 border-amber-400 text-amber-700">
                            <X className="h-3.5 w-3.5" /> Retrage
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => toggleAiTour(p)}
                          className={"gap-1 " + (p.ai_tour_verified ? "border-emerald bg-emerald text-white hover:bg-emerald/90" : "border-emerald/40 text-emerald hover:bg-emerald-soft")}>
                          {p.ai_tour_verified ? "Tur 3D" : "+ Tur 3D"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => recomputeScore(p)} disabled={scoring === p.id}
                          title="Recalculează scorul și arată răspunsul"
                          className="gap-1 border-border text-muted-foreground hover:text-foreground">
                          <RefreshCw className={"h-3.5 w-3.5" + (scoring === p.id ? " animate-spin" : "")} />
                          {typeof p.trust_score === "number" ? p.trust_score : "—"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => delProperty(p)} className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                  {src.length > visible.length && (
                    <LoadMoreButton onClick={loadMoreProps} remaining={src.length - visible.length} />
                  )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <InspectionContactModal
        inspection={contactTarget}
        open={!!contactTarget}
        onClose={() => setContactTarget(null)}
        onConfirm={contactInspection}
        sending={contactSending}
      />
    </div>
  );
}