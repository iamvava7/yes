import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/components/CountryContext";
import { base44 } from "@/api/base44Client";
import { PLANS } from "@/lib/plans";

// Alegerea unui plan FĂRĂ să pleci din formular (cererea clientului, 23.08):
// tierele stau în dialog, iar plata — abonament Stripe, deci checkout găzduit —
// se deschide în filă NOUĂ, ca pagina de sub dialog să rămână exact unde e.
// La întoarcerea în filă, ascultătorii de focus (wizard, banner, gate) recitesc
// singuri planul și cotele, deci dialogul nu are nimic de sincronizat.

const price = (v) => v.toLocaleString("ro-RO", { minimumFractionDigits: v % 1 ? 2 : 0 }) + " RON";

export default function PlanCheckoutModal({ open, onOpenChange }) {
  const { lang } = useCountry();
  const en = lang === "en";
  const [annual, setAnnual] = useState(false);
  const [planId, setPlanId] = useState("pro");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [external, setExternal] = useState(false);

  useEffect(() => {
    if (!open) { setBusy(false); setErr(null); setExternal(false); }
  }, [open]);

  const plan = PLANS.find((p) => p.id === planId) || PLANS[0];

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await base44.functions.invoke("CreateCheckoutSession", {
        plan_id: plan.id,
        interval: annual ? "yearly" : "monthly",
      });
      const d = res?.data || res || {};
      if (d.url) {
        window.open(d.url, "_blank", "noopener");
        setExternal(true);
      } else {
        setErr(d.error || (en ? "Could not start the payment." : "Nu am putut porni plata."));
      }
    } catch (_) {
      setErr(en ? "Could not start the payment." : "Nu am putut porni plata.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-semibold">
            {en ? "Pick a plan" : "Alege un plan"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {external
              ? (en
                  ? "The payment opened in a new tab. Your plan activates when you come back."
                  : "Plata s-a deschis într-o filă nouă. Planul se activează când revii aici.")
              : (en
                  ? "Listings, 3D tours and boosts grow with the plan."
                  : "Anunțurile, tururile 3D și boost-urile cresc odată cu planul.")}
          </DialogDescription>
        </DialogHeader>

        {!external && (
          <>
            <div className="flex items-center justify-center gap-1 rounded-full bg-secondary p-1 text-xs font-bold">
              {[
                { v: false, l: en ? "Monthly" : "Lunar" },
                { v: true, l: en ? "Yearly · save 20%" : "Anual · economisești 20%" },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  onClick={() => setAnnual(o.v)}
                  className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${
                    annual === o.v ? "bg-emerald text-white" : "text-muted-foreground"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PLANS.map((p) => {
                const active = p.id === planId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`relative rounded-2xl border p-3 text-left transition-colors ${
                      active ? "border-emerald bg-emerald-soft/40" : "border-border bg-card hover:border-emerald/50"
                    }`}
                  >
                    {p.id === "pro" && (
                      <span className="absolute -top-2 right-2 rounded-full bg-emerald px-2 py-0.5 text-[10px] font-bold text-white">
                        Popular
                      </span>
                    )}
                    <p className="text-sm font-bold text-foreground">{p.shortName || p.name}</p>
                    <p className="mt-0.5 text-sm text-foreground tnum">
                      {price(annual ? p.yearly : p.monthly)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{annual ? (en ? "/year" : "/an") : (en ? "/month" : "/lună")}</p>
                  </button>
                );
              })}
            </div>

            <ul className="space-y-1 rounded-2xl bg-secondary/60 px-4 py-3">
              {(plan.headline || []).slice(0, 4).map((f) => (
                <li key={f.ro} className="flex items-start gap-2 text-xs text-foreground">
                  <span className="mt-px text-emerald" aria-hidden="true">✓</span>
                  <span>
                    {en ? f.en : f.ro}
                    {f.soon && (
                      <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 py-px text-[9px] font-bold uppercase text-neutral-600 dark:bg-white/10 dark:text-neutral-400">
                        {en ? "soon" : "în curând"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <a
              href="/upgrade"
              target="_blank"
              rel="noopener noreferrer"
              className="text-center text-xs font-semibold text-emerald underline-offset-2 hover:underline"
            >
              {en ? "See the full comparison" : "Vezi comparația completă"}
            </a>
          </>
        )}

        {err && <p className="text-sm font-medium text-destructive">{err}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {!external && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-full px-5"
            >
              {en ? "Cancel" : "Anulează"}
            </Button>
          )}
          {!external ? (
            <Button
              type="button"
              onClick={buy}
              disabled={busy}
              className="min-h-[44px] gap-2 rounded-full bg-emerald px-5 font-bold text-white hover:bg-emerald/90"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {en
                ? `Continue · ${price(annual ? plan.yearly : plan.monthly)}`
                : `Continuă · ${price(annual ? plan.yearly : plan.monthly)}`}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-full bg-emerald px-5 font-bold text-white hover:bg-emerald/90"
            >
              {en ? "Done" : "Gata"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
