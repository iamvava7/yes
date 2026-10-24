import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const REASONS = [
  "Anunț fals / Escrocherie",
  "Preț sau costuri incorecte",
  "Proprietatea este deja închiriată/vândută",
  "Date de contact invalide",
  "Conținut ofensator/discriminatoriu",
  "Altele",
];

// Reusable report modal used for both properties and comments.
// Anyone can report (guests submit anonymously via the SubmitReport function).
export default function ReportModal({
  targetType = "property",
  targetId,
  targetTitle = "",
  variant = "ghost",
  size = "sm",
  className = "",
}) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [sending, setSending] = useState(false);

  const reset = () => { setReason(""); setDetails(""); setRName(""); setREmail(""); };

  const submit = async (e) => {
    e?.preventDefault();
    if (!reason) { toast({ title: "Selectează un motiv", variant: "destructive" }); return; }
    if (!targetId) { toast({ title: "Lipsă țintă raport", variant: "destructive" }); return; }
    setSending(true);
    try {
      await base44.functions.invoke("SubmitReport", {
        target_type: targetType,
        target_id: targetId,
        target_title: targetTitle,
        reason,
        details: details.trim(),
        reporter_name: isAuthenticated ? (user?.full_name || user?.email || "") : rName.trim(),
        reporter_email: isAuthenticated ? (user?.email || "") : rEmail.trim(),
      });
      toast({ title: "Raport trimis. Mulțumim!", description: "Echipa VerifiCasa analizează sesizarea." });
      reset();
      setOpen(false);
    } catch (err) {
      toast({ title: "Eroare la trimitere", variant: "destructive" });
    } finally { setSending(false); }
  };

  const isComment = targetType === "comment";

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn("gap-1 text-muted-foreground hover:text-rose-500", className)}
        title={isComment ? "Raportează comentariu" : "Raportează anunț"}
      >
        <Flag className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Raportează</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-rose-500" /> Raportează {isComment ? "comentariu" : "anunț"}
            </DialogTitle>
            <DialogDescription>
              Sesizările sunt confidențiale. Echipa VerifiCasa le analizează cât mai repede.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Motiv *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="vc-select mt-1 w-full rounded border border-border bg-secondary/30 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-mint"
              >
                <option value="">Selectează motivul…</option>
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">Detalii</label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="Descrie problema…"
                className="mt-1 resize-none"
              />
            </div>

            {!isAuthenticated && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={rName}
                  onChange={(e) => setRName(e.target.value)}
                  placeholder="Nume (opțional)"
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-2.5 text-sm outline-none focus:border-mint"
                />
                <input
                  type="email"
                  value={rEmail}
                  onChange={(e) => setREmail(e.target.value)}
                  placeholder="Email (opțional)"
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-2.5 text-sm outline-none focus:border-mint"
                />
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={sending} className="bg-rose-500 text-white hover:bg-rose-600">
                {sending ? "Se trimite…" : "Trimite raportul"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}