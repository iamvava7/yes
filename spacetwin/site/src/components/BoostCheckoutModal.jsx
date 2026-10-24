import React, { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCountry } from "@/components/CountryContext";
import { BOOST_PACKS, boostUnitPrice } from "@/lib/plans";
import {
  loadStripeJs, createBoostPaymentIntent, verifyBoostPayment,
  startHostedBoostCheckout, stripeAppearance, STRIPE_FONTS,
} from "@/lib/stripeCheckout";

// Cumpărarea de boost-uri FĂRĂ să pleci de pe pagină: alegi pachetul, plătești
// în același dialog (Stripe Payment Element, îmbrăcat în tokenurile site-ului),
// iar soldul nou se întoarce prin onDone. Dacă cheia publică Stripe nu e încă
// în secretele aplicației, dialogul cade pe checkout-ul găzduit, în filă nouă,
// și pagina de sub el rămâne neatinsă.

const ron = (v) => v.toLocaleString("ro-RO", { minimumFractionDigits: 2 }) + " RON";

export default function BoostCheckoutModal({ open, onOpenChange, onDone }) {
  const { lang } = useCountry();
  const en = lang === "en";

  const [packId, setPackId] = useState("b3");
  const [phase, setPhase] = useState("pack"); // pack | pay | done | external
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  const stripeRef = useRef(null);
  const elementsRef = useRef(null);
  const mountRef = useRef(null);

  const pack = BOOST_PACKS.find((p) => p.id === packId) || BOOST_PACKS[0];

  const reset = () => {
    try { elementsRef.current?.getElement?.("payment")?.unmount?.(); } catch (_) { /* gata oricum */ }
    stripeRef.current = null;
    elementsRef.current = null;
    setPhase("pack");
    setBusy(false);
    setErr(null);
    setResult(null);
  };
  useEffect(() => { if (!open) reset(); }, [open]);

  const toPayment = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const intent = await createBoostPaymentIntent(pack.id);

    // Fără cheie publică în secrete: filă nouă pe checkout-ul găzduit, iar
    // dialogul spune exact asta în loc să pretindă că plata s-a terminat.
    if (intent.error === "embedded_unavailable") {
      const res = await startHostedBoostCheckout(pack.id);
      setBusy(false);
      if (res.error) { setErr(res.error); return; }
      setPhase("external");
      return;
    }
    if (intent.error || !intent.client_secret) {
      setBusy(false);
      setErr(intent.error || (en ? "Could not start the payment." : "Nu am putut porni plata."));
      return;
    }

    try {
      await loadStripeJs();
      const stripe = window.Stripe(intent.publishable_key);
      const elements = stripe.elements({
        clientSecret: intent.client_secret,
        appearance: stripeAppearance(),
        fonts: STRIPE_FONTS,
      });
      stripeRef.current = stripe;
      elementsRef.current = elements;
      setPhase("pay");
      setBusy(false);
      // Elementul se montează după ce div-ul lui există în DOM.
      requestAnimationFrame(() => {
        if (mountRef.current) elements.create("payment").mount(mountRef.current);
      });
    } catch (_) {
      setBusy(false);
      setErr(en ? "The payment form did not load." : "Formularul de plată nu s-a încărcat.");
    }
  };

  const pay = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (error) {
      setBusy(false);
      setErr(error.message || (en ? "The payment failed." : "Plata a eșuat."));
      return;
    }
    if (paymentIntent?.status !== "succeeded") {
      setBusy(false);
      setErr(en ? "The payment is not confirmed yet." : "Plata nu este confirmată încă.");
      return;
    }
    const v = await verifyBoostPayment(paymentIntent.id);
    setBusy(false);
    if (v.ok) {
      setResult({ boosts: v.boosts ?? pack.boosts, balance: v.balance });
      setPhase("done");
      onDone?.(v.balance, v.boosts ?? pack.boosts);
    } else {
      setErr(v.error || (en ? "Could not confirm the payment." : "Nu am putut confirma plata."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-semibold">
            {phase === "done"
              ? (en ? "Boosts added" : "Boost-uri adăugate")
              : (en ? "Buy boosts" : "Cumpără boost-uri")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {phase === "pack" && (en
              ? "Boosts stack on a listing and never expire."
              : "Boost-urile se adună pe un anunț și nu expiră.")}
            {phase === "pay" && (en
              ? `${pack.label ?? pack.boosts + " boosts"} · ${ron(pack.priceRon)}`
              : `${pack.boosts} boost${pack.boosts === 1 ? "" : "-uri"} · ${ron(pack.priceRon)}`)}
            {phase === "done" && result && (en
              ? `${result.boosts} added. Your balance is ${result.balance}.`
              : `${result.boosts} adăugate. Soldul tău e ${result.balance}.`)}
            {phase === "external" && (en
              ? "The payment opened in a new tab. Your balance updates when you come back."
              : "Plata s-a deschis într-o filă nouă. Soldul se actualizează când revii aici.")}
          </DialogDescription>
        </DialogHeader>

        {phase === "pack" && (
          <div className="grid grid-cols-2 gap-2">
            {BOOST_PACKS.map((p) => {
              const active = p.id === packId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPackId(p.id)}
                  className={`relative rounded-2xl border p-3 text-left transition-colors ${
                    active ? "border-emerald bg-emerald-soft/40" : "border-border bg-card hover:border-emerald/50"
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-2 right-3 rounded-full bg-emerald px-2 py-0.5 text-[10px] font-bold text-white">
                      {en ? "Popular" : "Popular"}
                    </span>
                  )}
                  <p className="text-sm font-bold text-foreground">
                    {p.boosts} {en ? (p.boosts === 1 ? "boost" : "boosts") : (p.boosts === 1 ? "boost" : "boost-uri")}
                  </p>
                  <p className="mt-0.5 text-sm text-foreground tnum">{ron(p.priceRon)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tnum">
                    {ron(boostUnitPrice(p))} / boost
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {phase === "pay" && <div ref={mountRef} className="min-h-[180px]" />}

        {phase === "done" && (
          <div className="flex items-center justify-center py-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-soft text-emerald">
              <Check className="h-7 w-7" />
            </span>
          </div>
        )}

        {err && <p className="text-sm font-medium text-destructive">{err}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          {(phase === "pack" || phase === "pay") && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-full px-5"
            >
              {en ? "Cancel" : "Anulează"}
            </Button>
          )}
          {phase === "pack" && (
            <Button
              type="button"
              onClick={toPayment}
              disabled={busy}
              className="min-h-[44px] gap-2 rounded-full bg-emerald px-5 font-bold text-white hover:bg-emerald/90"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {en ? `Continue · ${ron(pack.priceRon)}` : `Continuă · ${ron(pack.priceRon)}`}
            </Button>
          )}
          {phase === "pay" && (
            <Button
              type="button"
              onClick={pay}
              disabled={busy}
              className="min-h-[44px] gap-2 rounded-full bg-emerald px-5 font-bold text-white hover:bg-emerald/90"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {en ? `Pay ${ron(pack.priceRon)}` : `Plătește ${ron(pack.priceRon)}`}
            </Button>
          )}
          {(phase === "done" || phase === "external") && (
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
