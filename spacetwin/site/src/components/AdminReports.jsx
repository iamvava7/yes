import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Flag, Eye, AlertTriangle, Pencil } from "lucide-react";
import PropertyEditForm from "@/components/PropertyEditForm";
import { useLoadMore } from "@/hooks/useLoadMore";
import LoadMoreButton from "@/components/admin/LoadMoreButton";

const STATUS_TONE = {
  PENDING: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-soft text-emerald",
  REJECTED: "bg-rose-50 text-rose-600",
};
const STATUS_LABEL = { PENDING: "În așteptare", RESOLVED: "Rezolvat", REJECTED: "Respins" };

// Admin moderation panel for reported properties & comments. Each row links
// to the target, shows who reported + when, and exposes a resolve/reject
// flow with an optional auto-action on the target + message to the reporter.
export default function AdminReports({ reports = [], properties = [], onReload }) {
  const { toast } = useToast();
  const [resolvingId, setResolvingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    status: "RESOLVED", note: "", auto_action: "none", send_email: false, resolved_date: "",
  });
  const { count: repCount, loadMore: loadMoreReps } = useLoadMore(5, []);

  const open = (r) => {
    setResolvingId(r.id);
    setForm({
      status: "RESOLVED",
      note: r.resolution_note || "",
      auto_action: r.auto_action || "none",
      send_email: false,
      resolved_date: new Date().toISOString().slice(0, 10),
    });
  };
  const close = () => setResolvingId(null);

  const save = async (r) => {
    try {
      await base44.functions.invoke("ResolveReport", {
        report_id: r.id,
        status: form.status,
        resolution_note: form.note.trim(),
        auto_action: form.auto_action,
        send_email: form.send_email,
        resolved_date: form.resolved_date || undefined,
      });
      toast({ title: `Raport ${form.status === "RESOLVED" ? "rezolvat" : "respins"}` });
      close();
    } catch (e) { toast({ title: "Eroare la procesare", variant: "destructive" }); }
  };

  return (
    <div className="space-y-3">
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nicio sesizare deschisă.</p>
      ) : (
        <>
        {reports.slice(0, repCount).map((r) => (
        <div key={r.id} className="rounded border border-border bg-white p-4 shadow-soft dark:bg-card">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-heading font-bold text-navy dark:text-foreground">
                <Flag className="h-4 w-4 text-rose-500" /> {r.reason}
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
                De: {r.is_anonymous ? "Anonim" : (r.reporter_name || "Utilizator")}
                {r.reporter_email ? ` · ${r.reporter_email}` : ""} · {new Date(r.created_date).toLocaleString("ro-RO")}
              </p>
              {r.status !== "PENDING" && r.resolved_by_name && (
                <p className="mt-0.5 text-[11px] text-emerald">
                  Procesat de {r.resolved_by_name}{r.resolved_date ? ` · ${new Date(r.resolved_date).toLocaleString("ro-RO")}` : ""}
                </p>
              )}
              {r.resolution_note && (
                <p className="mt-1 rounded-lg bg-secondary/40 px-2 py-1 text-xs text-foreground/70">
                  <b>Notă:</b> {r.resolution_note}
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {r.target_type === "property" && (
              <Button size="sm" variant="outline" asChild className="gap-1">
                <Link to={`/property/${r.target_id}`}><Eye className="h-3.5 w-3.5" /> Vezi anunț</Link>
              </Button>
            )}
            {r.target_type === "property" && properties.find((p) => p.id === r.target_id) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditingId(editingId === r.target_id ? null : r.target_id)}
                className="gap-1 border-emerald/40 text-emerald hover:bg-emerald-soft"
              >
                <Pencil className="h-3.5 w-3.5" /> {editingId === r.target_id ? "Închide editarea" : "Editează"}
              </Button>
            )}
            {r.status === "PENDING" && (
              <Button size="sm" variant="outline" onClick={() => open(r)} className="gap-1 border-amber-400 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" /> Procesează
              </Button>
            )}
          </div>

          {editingId === r.target_id && r.target_type === "property" && (() => {
            const prop = properties.find((p) => p.id === r.target_id);
            return prop ? (
              <div className="mt-3">
                <PropertyEditForm
                  property={prop}
                  isAdmin
                  onDone={() => { setEditingId(null); onReload && onReload(); }}
                />
              </div>
            ) : null;
          })()}

          {resolvingId === r.id && (
            <div className="mt-3 space-y-2 rounded border border-border bg-secondary/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="vc-select vc-select-sm rounded-lg border border-border bg-white py-1.5 pl-2.5 pr-7 text-xs font-semibold outline-none dark:bg-card"
                >
                  <option value="RESOLVED">Rezolvat</option>
                  <option value="REJECTED">Respins</option>
                </select>
                {r.target_type === "property" ? (
                  <select
                    value={form.auto_action}
                    onChange={(e) => setForm((f) => ({ ...f, auto_action: e.target.value }))}
                    className="vc-select vc-select-sm rounded-lg border border-border bg-white py-1.5 pl-2.5 pr-7 text-xs font-semibold outline-none dark:bg-card"
                  >
                    <option value="none">Fără acțiune pe anunț</option>
                    <option value="hide">Retrage/Ascunde anunț</option>
                    <option value="pending_review">Trimite în PENDING pentru modificări</option>
                  </select>
                ) : (
                  <select
                    value={form.auto_action}
                    onChange={(e) => setForm((f) => ({ ...f, auto_action: e.target.value }))}
                    className="vc-select vc-select-sm rounded-lg border border-border bg-white py-1.5 pl-2.5 pr-7 text-xs font-semibold outline-none dark:bg-card"
                  >
                    <option value="none">Fără acțiune</option>
                    <option value="hide">Șterge comentariul</option>
                  </select>
                )}
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  Data:
                  <input
                    type="date"
                    value={form.resolved_date}
                    onChange={(e) => setForm((f) => ({ ...f, resolved_date: e.target.value }))}
                    className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs outline-none dark:bg-card"
                  />
                </label>
              </div>
              <Textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                placeholder="Mesaj către utilizator (ex: anunț retras / sesizare neconfirmată)…"
                className="resize-none text-sm"
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.send_email}
                  onChange={(e) => setForm((f) => ({ ...f, send_email: e.target.checked }))}
                />
                Trimite și email informativ (dacă reporterul e înregistrat)
              </label>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={close}>Anulează</Button>
                <Button size="sm" onClick={() => save(r)} className="bg-emerald text-white hover:bg-emerald/90">
                  Salvează
                </Button>
              </div>
            </div>
          )}
        </div>
        ))}
        {reports.length > repCount && (
          <LoadMoreButton onClick={loadMoreReps} remaining={reports.length - repCount} />
        )}
        </>
      )}
    </div>
  );
}