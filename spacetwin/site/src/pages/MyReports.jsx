import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_TONE = {
  PENDING: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-soft text-emerald",
  REJECTED: "bg-rose-50 text-rose-600",
};
const STATUS_LABEL = { PENDING: "În așteptare", RESOLVED: "Rezolvat", REJECTED: "Respins" };

// "Rapoartele mele" — a user sees the history + status of reports they filed.
// Anonymous reports (filed while logged out) are not listed here.
export default function MyReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState(null);

  const load = async () => {
    if (!user?.id) { setReports([]); return; }
    try {
      const list = await base44.entities.Report.filter({ reporter_user_id: user.id }, "-created_date", 100);
      setReports(list || []);
    } catch { setReports([]); }
  };

  useEffect(() => { load(); }, [user?.id]);

  // Real-time: when an admin resolves/rejects one of my reports, the status
  // and resolution note update here automatically — no refresh needed.
  useEffect(() => {
    if (!user?.id) return;
    const unsub = base44.entities.Report.subscribe(() => load());
    return () => { try { unsub && unsub(); } catch { /* noop */ } };
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="font-heading text-2xl font-bold sm:text-3xl text-navy dark:text-foreground">Rapoartele mele</h1>
      <p className="mt-1 text-sm text-muted-foreground">Istoricul sesizărilor trimise de tine și starea lor.</p>

      <div className="mt-6 space-y-3">
        {reports === null ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
        ) : reports.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center sm:px-6 sm:py-14">
            <img src="/images/generated/icon-flag.png" alt="" aria-hidden="true" className="mx-auto h-12 w-12 object-contain" />
            <p className="mt-3 text-sm text-muted-foreground">Nu ai trimis nicio sesizare încă.</p>
          </div>
        ) : reports.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-heading font-bold text-navy dark:text-foreground">{r.reason}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_TONE[r.status] || "bg-secondary"}`}>
                {STATUS_LABEL[r.status] || r.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.target_type === "comment" ? "Comentariu" : "Anunț"}:{" "}
              {r.target_type === "property" ? (
                <Link to={`/property/${r.target_id}`} className="font-semibold text-emerald hover:underline">
                  {r.target_title || "vezi anunț"}
                </Link>
              ) : (
                <span>{(r.target_title || "").slice(0, 48)}</span>
              )}
            </p>
            {r.details && <p className="mt-1 text-sm text-foreground/80">{r.details}</p>}
            <p className="mt-1 text-[11px] text-muted-foreground">Trimis: {new Date(r.created_date).toLocaleString("ro-RO")}</p>
            {r.resolution_note && (
              <p className="mt-2 rounded-xl bg-emerald-soft/60 px-3 py-2 text-xs text-foreground/80">
                <b>Răspuns admin:</b> {r.resolution_note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}