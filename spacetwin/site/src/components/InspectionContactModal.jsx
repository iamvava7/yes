import React, { useEffect, useState } from "react";
import { X, Send, Mail, User, Home, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

// Modal pentru confirmarea contactării proprietarului unei cereri de inspecție.
// Adminul poate adăuga o notă internă opțională (ex: "S-a apelat la ora 14:00")
// care va fi inclusă în e-mailul automat trimis solicitantului.
export default function InspectionContactModal({ inspection, open, onClose, onConfirm, sending }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open || !inspection) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-deep/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded border border-border bg-white shadow-2xl dark:bg-card">
        {/* Header */}
        <div className="gradient-navy p-5 text-white">
          <button onClick={onClose} aria-label="Închide" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded bg-white/15 transition hover:bg-white/30">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded bg-emerald/20 text-emerald"><Mail className="h-5 w-5" /></span>
            <div>
              <h3 className="font-heading text-lg font-bold">Contactează proprietarul</h3>
              <p className="text-xs text-white/70">Se trimite e-mail automat și se marchează ca contactat</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          {/* Summary */}
          <div className="space-y-2 rounded border border-border/60 bg-secondary/30 p-4">
            <p className="flex items-center gap-2 text-sm text-foreground/80">
              <User className="h-4 w-4 text-emerald" /> <b>{inspection.name}</b> · {inspection.role}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {inspection.email}
            </p>
            {inspection.address_or_url && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Home className="h-3.5 w-3.5" /> {inspection.address_or_url}
              </p>
            )}
            {inspection.package_interest && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ClipboardList className="h-3.5 w-3.5" /> {inspection.package_interest}
              </p>
            )}
          </div>

          {/* Note */}
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Notă internă (opțional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="ex: S-a apelat telefonic la ora 14:00 sau un mesaj personalizat pentru e-mail…"
              className="w-full rounded border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-emerald focus:ring-2 focus:ring-emerald/15 dark:bg-card"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground/80">
              Nota va fi inclusă în e-mailul trimis solicitantului.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3 sm:px-5 sm:gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="shrink-0 rounded px-4">
            Anulează
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(note.trim())}
            disabled={sending}
            className="min-w-0 flex-1 gap-1.5 rounded-full bg-emerald text-white shadow-soft hover:bg-emerald/90 disabled:opacity-60"
          >
            <Send className="h-4 w-4 shrink-0" />
            <span className="truncate">{sending ? "Se trimite…" : "Contactează"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}