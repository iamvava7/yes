import React, { useMemo, useState } from "react";
import { Search, Inbox, MessageSquare, ShieldCheck, History } from "lucide-react";
import { useLoadMore } from "@/hooks/useLoadMore";
import LoadMoreButton from "@/components/admin/LoadMoreButton";

const ACTION_LABELS = {
  approve: "Aprobat anunț",
  reject: "Respins anunț",
  delete: "Șters anunț",
  moderate: "Moderare",
  enable_ai_tour: "Tur 3D activat",
  disable_ai_tour: "Tur 3D retras",
  report_property: "Sesizare proprietate",
  report_comment: "Sesizare comentariu",
  resolve_report: "Raport rezolvat",
  reject_report: "Raport respins",
};

const relTime = (iso) => {
  try { return new Date(iso).toLocaleString("ro-RO"); } catch { return ""; }
};

export default function PropertyLogs({ properties = [], audit = [], comments = [], inquiries = [] }) {
  const [q, setQ] = useState("");
  const [pid, setPid] = useState("");
  const { count: listCount, loadMore: loadMoreList } = useLoadMore(8, [q]);
  const { count: tlCount, loadMore: loadMoreTl } = useLoadMore(6, [pid]);

  const list = useMemo(() => {
    const lq = q.toLowerCase();
    return properties.filter((p) =>
      !lq ||
      (p.title || "").toLowerCase().includes(lq) ||
      (p.city || "").toLowerCase().includes(lq) ||
      (p.zone || "").toLowerCase().includes(lq) ||
      (p.id || "").toLowerCase().includes(lq) ||
      String(p.property_code || "").toLowerCase().includes(lq)
    );
  }, [properties, q]);

  const timeline = useMemo(() => {
    if (!pid) return [];
    const items = [
      ...(audit || []).filter((a) => a.target_id === pid && a.target_type === "property").map((a) => ({
        kind: "audit", Icon: ShieldCheck, tone: "text-emerald bg-emerald-soft",
        title: `${a.actor_name || "Sistem"} · ${ACTION_LABELS[a.action] || a.action}`,
        sub: a.detail || "",
        date: a.created_date,
      })),
      ...(inquiries || []).filter((i) => i.property_id === pid).map((i) => ({
        kind: "inquiry", Icon: Inbox, tone: "text-emerald bg-emerald-soft",
        title: `Cerere de închiriere de la ${i.name}`,
        sub: [i.email, i.phone, i.occupation].filter(Boolean).join(" · "),
        date: i.created_date,
      })),
      ...(comments || []).filter((c) => c.property_id === pid).map((c) => ({
        kind: "comment", Icon: MessageSquare, tone: "text-gold bg-gold-soft",
        title: `${c.user_name} a comentat`,
        sub: c.content || "",
        date: c.created_date,
      })),
    ];
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [pid, audit, inquiries, comments]);

  const property = properties.find((p) => p.id === pid);

  return (
    <div className="grid gap-4 md:grid-cols-[280px_1fr]">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută proprietate..." className="w-full rounded-full border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald dark:bg-card" />
        </div>
        <div className="no-scrollbar max-h-[45vh] space-y-1 overflow-auto rounded border border-border bg-white p-1 dark:bg-card sm:max-h-[60vh]">
          {list.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nicio proprietate.</p>
          ) : list.slice(0, listCount).map((p) => (
            <button key={p.id} onClick={() => setPid(p.id)} className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition ${pid === p.id ? "bg-navy text-white" : "hover:bg-secondary"}`}>
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p.title}</span>
              <span className={`shrink-0 font-mono text-[10px] ${pid === p.id ? "text-white/60" : "text-muted-foreground/60"}`}>#{p.property_code || p.id?.slice(0, 8)}</span>
              {p.approval_status !== "APPROVED" && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">nou</span>}
            </button>
          ))}
          {list.length > listCount && (
            <div className="px-2 pt-1"><LoadMoreButton onClick={loadMoreList} remaining={list.length - listCount} /></div>
          )}
        </div>
      </div>

      <div className="rounded border border-border bg-white p-4 dark:bg-card">
        {!pid ? (
          <div className="flex flex-col items-center justify-center py-9 text-center sm:py-16">
            <History className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Selectează o proprietate pentru a vedea istoricul acțiunilor:</p>
            <p className="mt-1 text-xs text-muted-foreground/70">cine a aprobat/respins anunțul, cine a trimis cereri de închiriere, cine a comentat.</p>
          </div>
        ) : timeline.length === 0 ? (
          <div className="py-7 text-center text-sm text-muted-foreground sm:py-12">Nicio acțiune înregistrată pentru „{property?.title}".</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="font-heading font-bold text-navy dark:text-foreground">{property?.title}</p>
              <button onClick={() => navigator.clipboard?.writeText(String(property?.property_code || ""))} title="Copiază cod" className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-emerald hover:text-emerald">
                Cod Proprietate: {property?.property_code || property?.id?.slice(0, 8)}
              </button>
            </div>
            <ol className="space-y-3">
              {timeline.slice(0, tlCount).map((it, idx) => {
                const Icon = it.Icon;
                return (
                  <li key={idx} className="flex gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.tone}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-navy dark:text-foreground">{it.title}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{relTime(it.date)}</span>
                      </div>
                      {it.sub && <p className="mt-0.5 text-xs text-muted-foreground">{it.sub}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {timeline.length > tlCount && (
              <div className="mt-3"><LoadMoreButton onClick={loadMoreTl} remaining={timeline.length - tlCount} /></div>
            )}
          </>
        )}
      </div>
    </div>
  );
}