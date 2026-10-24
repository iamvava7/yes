import React from "react";
import { Link } from "react-router-dom";
import { Flag, CheckCircle2, XCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoadMore } from "@/hooks/useLoadMore";
import LoadMoreButton from "@/components/admin/LoadMoreButton";

const STATUS_TONE = {
  RESOLVED: "bg-emerald-soft text-emerald",
  REJECTED: "bg-rose-50 text-rose-600",
};
const STATUS_LABEL = { RESOLVED: "Rezolvat", REJECTED: "Respins" };
const AUTO_ACTION_LABEL = {
  none: "Fără acțiune pe target",
  hide: "Target ascuns / șters",
  pending_review: "Trimis în PENDING pentru modificări",
};

// Read-only archive of reports an admin has already processed (resolved or
// rejected). Shows the full original report (reason, details, reporter) plus
// who handled it, when, what auto-action was applied and the resolution note.
export default function AdminResolvedReports({ reports = [] }) {
  const { count: repCount, loadMore: loadMoreReps } = useLoadMore(5, []);
  if (reports.length === 0) {
    return <p className="text-sm text-muted-foreground">Nicio sesizare procesată încă.</p>;
  }
  const sorted = [...reports].sort((a, b) => {
    const da = a.resolved_date ? new Date(a.resolved_date).getTime() : 0;
    const db = b.resolved_date ? new Date(b.resolved_date).getTime() : 0;
    return db - da;
  });
  return (
    <div className="space-y-3">
      {sorted.slice(0, repCount).map((r) => {
        const Icon = r.status === "RESOLVED" ? CheckCircle2 : XCircle;
        const tone = r.status === "RESOLVED" ? "text-emerald" : "text-rose-500";
        return (
          <div key={r.id} className="rounded border border-border bg-white p-4 shadow-soft dark:bg-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-heading font-bold text-navy dark:text-foreground">
                  <Flag className="h-4 w-4 text-muted-foreground" /> {r.reason}
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[r.status] || "bg-secondary text-muted-foreground"}`}>
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.target_type === "comment" ? "Comentariu" : "Anunț"}:{" "}
                  {r.target_type === "property" ? (
                    <Link to={`/property/${r.target_id}`} className="font-semibold text-emerald hover:underline">
                      {r.target_title || r.target_id}
                    </Link>
                  ) : (
                    <span className="font-mono">{r.target_title || (r.target_id || "").slice(0, 8)}</span>
                  )}
                </p>
                {r.details && <p className="mt-1 text-sm text-foreground/80">{r.details}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Raportat de: {r.is_anonymous ? "Anonim" : (r.reporter_name || "Utilizator")}
                  {r.reporter_email ? ` · ${r.reporter_email}` : ""} · {new Date(r.created_date).toLocaleString("ro-RO")}
                </p>

                <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-2.5 text-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-navy dark:text-foreground">
                    <Icon className={`h-3.5 w-3.5 ${tone}`} />
                    Procesat de: <span className="font-bold">{r.resolved_by_name || "—"}</span>
                    {r.resolved_date ? ` · ${new Date(r.resolved_date).toLocaleString("ro-RO")}` : ""}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Acțiune aplicată: <span className="font-semibold text-foreground/80">{AUTO_ACTION_LABEL[r.auto_action] || r.auto_action || "—"}</span>
                  </p>
                </div>

                {r.resolution_note && (
                  <p className="mt-2 rounded-lg bg-secondary/40 px-2 py-1 text-xs text-foreground/70">
                    <b>Notă admin:</b> {r.resolution_note}
                  </p>
                )}
              </div>

              {r.target_type === "property" && (
                <Button size="sm" variant="outline" asChild className="gap-1">
                  <Link to={`/property/${r.target_id}`}><Eye className="h-3.5 w-3.5" /> Vezi anunț</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {sorted.length > repCount && (
        <LoadMoreButton onClick={loadMoreReps} remaining={sorted.length - repCount} />
      )}
    </div>
  );
}