import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerifiCasaLogo from "@/components/VerifiCasaLogo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Plus, Minus, Loader2 } from "lucide-react";
import PropertyWizard from "@/components/postproperty/PropertyWizard";
import LanguageToggle from "@/components/LanguageToggle";
import BoostDialog from "@/components/BoostDialog";
import BoostCheckoutModal from "@/components/BoostCheckoutModal";
import PlanCheckoutModal from "@/components/PlanCheckoutModal";
import { useCountry } from "@/components/CountryContext";
import { useWiz } from "@/components/postproperty/wizardCopy";
import { useAuth } from "@/lib/AuthContext";
import { fetchBoostBalance, applyBoost, fetchActiveListingCount } from "@/lib/boosts";
import { getEntitlements } from "@/lib/plans";
import { fetchMyActiveSubscription } from "@/lib/subscriptions";
import { useToast } from "@/components/ui/use-toast";

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "admin"];

export default function PostProperty() {
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState(null);
  const [balance, setBalance] = useState(0);
  const [boosting, setBoosting] = useState(false);
  // Cumpărarea de boost-uri se face AICI, în pagină (cererea clientului) —
  // dialogul de mai jos; /upgrade rămâne doar pentru cine vrea pagina întreagă.
  const [buyOpen, setBuyOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  // Câte promovări pune pe anunțul ăsta. Boost-urile se adună și nu expiră,
  // deci numărul chiar înseamnă ceva: fiecare îl urcă mai sus.
  const [qty, setQty] = useState(1);
  const [applying, setApplying] = useState(false);
  const { lang } = useCountry();
  const { user } = useAuth();
  const { w } = useWiz();
  const { toast } = useToast();
  const en = lang === "en";
  const isAdmin = ADMIN_ROLES.includes((user?.role || "").toUpperCase());

  // Limita de anunțuri se spune LA UȘĂ, nu la ultimul pas. Până acum
  // CheckListingAllowance rula abia la Publică: omul completa cinci pași ca
  // să afle la final că planul lui nu mai are locuri. Verificarea serverului
  // rămâne neatinsă — asta e doar vestea, dată înainte de muncă.
  // undefined = se verifică; null = liber; obiect = blocat.
  const [gate, setGate] = useState(undefined);
  useEffect(() => {
    if (!user?.id) return;
    if (isAdmin) { setGate(null); return; }
    let cancelled = false;
    const check = async () => {
      try {
        const [sub, count] = await Promise.all([
          fetchMyActiveSubscription(user.id),
          fetchActiveListingCount(user.id),
        ]);
        if (cancelled) return;
        const planId = sub?.plan_id || null;
        const max = getEntitlements(planId).activeListings;
        setGate(max !== null && count >= max ? { used: count, max, planId } : null);
      } catch (_) {
        // O eroare de rețea nu ține omul afară — limita reală e la publicare.
        if (!cancelled) setGate(null);
      }
    };
    check();
    // Planul se cumpără în filă nouă; la întoarcere, poarta se ridică singură.
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.removeEventListener("focus", check); };
  }, [user?.id, isAdmin]);

  // Soldul se citește după publicare, nu la intrarea în formular: până nu
  // există un anunț, nu are ce oferi.
  useEffect(() => {
    if (!submitted || !user?.id) return;
    let cancelled = false;
    const load = () => fetchBoostBalance(user.id).then((b) => { if (!cancelled) setBalance(b); });
    load();
    // Fallback-ul de cumpărare se deschide în filă nouă; la întoarcere, soldul
    // de aici trebuie să fie deja cel nou.
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.removeEventListener("focus", load); };
  }, [submitted, user?.id]);

  // ApplyBoost acceptă și anunțul PENDING al propriului autor (23.08) — deci
  // stepperul funcționează imediat după trimitere; efectul public pornește la
  // aprobare, și exact asta spune textul. Doar anunțul respins rămâne refuzat.
  const approved = created?.approval_status === "APPROVED";
  const boostable = created?.approval_status !== "REJECTED";
  const maxQty = Math.max(1, balance);

  const promote = async () => {
    if (!created?.id || applying) return;
    setApplying(true);
    try {
      const res = await applyBoost(created.id, qty);
      if (res.error) {
        toast({ title: en ? "Could not promote" : "Nu am putut promova", description: res.error, variant: "destructive" });
      } else {
        setBalance(res.balance ?? Math.max(0, balance - qty));
        setCreated((c) => (c ? { ...c, boost_active: true, boost_count: res.boost_count ?? qty } : c));
        toast({
          title: en ? "Listing promoted" : "Anunț promovat",
          description: en
            ? `${qty} ${qty === 1 ? "boost" : "boosts"} on this listing.`
            : `${qty} boost${qty === 1 ? "" : "-uri"} pe acest anunț.`,
        });
      }
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/40 dark:bg-background">
      {/* Formularul nu trece prin Layout, deci antetul ăsta e primul lucru
          de sus. Pe un telefon cu decupaj, sticky top-0 înseamnă sub decupaj
          dacă nu se adaugă marginea sigură — la fel ca în Header. */}
      <div className="sticky top-0 z-30 border-b border-border/60 bg-card" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-1.5 sm:px-6">
          <Link to="/" className="flex min-h-[44px] min-w-0 items-center gap-2">
            <VerifiCasaLogo size={34} tagline={false} />
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Formularul își desenează propriul antet, deci selectorul din
                Header nu ajunge aici — fără ăsta, pagina rămâne blocată în
                română și nu ai de unde să schimbi. */}
            <LanguageToggle />
            <Link
              to="/"
              aria-label={w.back_to_site}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-emerald"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{w.back_to_site}</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {submitted ? (
          <div className="surface-card mt-5 rounded-2xl p-5 text-center sm:mt-8 sm:p-8">
            <img
              src="/images/generated/icon-document-check.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-16 w-16 object-contain"
            />
            <h1 className="mt-4 font-heading text-xl font-bold sm:text-2xl text-navy dark:text-foreground">{w.ok_t}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {w.ok_d}
            </p>
            {/* PROMOVARE — ultimul pas al fluxului de publicare.
                Până acum nu exista nicăieri în „adaugă un anunț" un moment în
                care să ți se propună promovarea, deși ăsta e exact momentul în
                care omul se gândește cât de repede vrea să fie văzut. */}
            <div className="mt-7 rounded-2xl border border-emerald/30 bg-emerald-soft/40 p-5 text-left dark:bg-emerald-soft/10">
              <div className="flex items-start gap-3">
                <img
                  src="/images/generated/badge-promovat.png"
                  alt=""
                  aria-hidden="true"
                  className="h-11 w-11 shrink-0 object-contain drop-shadow"
                />
                <div className="min-w-0">
                  <p className="font-heading text-base font-bold text-navy dark:text-foreground">
                    {en ? "Want it seen first?" : "Vrei să fie văzut primul?"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {en
                      ? "A boost lifts this listing above the rest of its band, for as long as it is up."
                      : "Un boost ridică anunțul peste restul categoriei sale, cât timp e publicat."}
                    {" "}
                    {approved
                      ? (en ? `You have ${balance}.` : `Ai ${balance}.`)
                      : (en
                          ? "It starts as soon as the listing is approved."
                          : "Pornește imediat ce anunțul e aprobat.")}
                  </p>
                </div>
              </div>

              {/* Contorul cerut de client: câte promovări ai și câte pui pe
                  anunțul ăsta, chiar aici, la finalul publicării. */}
              {boostable && balance >= 1 && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {en ? "Promote this listing" : "Promovează anunțul"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {en ? `you have ${balance}` : `ai ${balance} promovări`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setQty((n) => Math.max(1, n - 1))}
                      disabled={qty <= 1 || applying}
                      aria-label={en ? "One fewer" : "Una mai puțin"}
                      className="tap-44 flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-emerald disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-7 text-center text-base font-bold tnum text-foreground">{qty}</span>
                    <button
                      type="button"
                      onClick={() => setQty((n) => Math.min(maxQty, n + 1))}
                      disabled={qty >= maxQty || applying}
                      aria-label={en ? "One more" : "Încă una"}
                      className="tap-44 flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-emerald disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {boostable && balance >= 1 ? (
                  <Button
                    onClick={promote}
                    disabled={applying}
                    className="h-11 gap-2 rounded-full bg-emerald px-5 text-sm text-white hover:bg-emerald/90"
                  >
                    {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                    {en ? "Promote now" : "Promovează acum"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setBuyOpen(true)}
                    className="h-11 rounded-full bg-emerald px-5 text-sm text-white hover:bg-emerald/90"
                  >
                    {en ? "Buy boosts" : "Cumpără boost-uri"}
                  </Button>
                )}
                {boostable && balance >= 1 && (
                  <Button variant="outline" onClick={() => setBuyOpen(true)} className="h-11 rounded-full px-5 text-sm">
                    {en ? "Buy more" : "Cumpără mai multe"}
                  </Button>
                )}
                <Button asChild variant="outline" className="h-11 gap-1.5 rounded-full px-5 text-sm">
                  <Link to="/my-properties">
                    {en ? "My listings" : "Anunțurile mele"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button variant="outline" onClick={() => { setSubmitted(false); setCreated(null); }} className="h-11 gap-1.5 rounded-full px-5 sm:h-12">
                <Plus className="h-4 w-4" /> {en ? "Add another listing" : "Adaugă alt anunț"}
              </Button>
              <Button asChild className="h-11 rounded-full bg-emerald px-6 text-white hover:bg-emerald/90 sm:h-12">
                <Link to="/">{en ? "Back to site" : "Vezi site-ul"}</Link>
              </Button>
            </div>

            <BoostDialog
              open={boosting}
              onOpenChange={setBoosting}
              property={created}
              balance={balance}
              onDone={(res) => setBalance(res.balance ?? balance - 1)}
            />
            <BoostCheckoutModal
              open={buyOpen}
              onOpenChange={setBuyOpen}
              onDone={(newBalance) => {
                if (typeof newBalance === "number") setBalance(newBalance);
              }}
            />
          </div>
        ) : gate === undefined ? (
          <div className="mt-5 h-64 animate-pulse rounded-2xl border border-border bg-card sm:mt-8" />
        ) : gate ? (
          <div className="surface-card mt-5 rounded-2xl p-6 text-center sm:mt-8 sm:p-8">
            <img
              src="/images/generated/icon-percent-badge.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-16 w-16 object-contain"
            />
            <h1 className="mt-4 font-heading text-xl font-bold text-navy dark:text-foreground sm:text-2xl">
              {w.err_limit_t}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {en
                ? `${gate.used} of ${gate.max} active ${gate.max === 1 ? "listing" : "listings"} on ${gate.planId ? gate.planId.charAt(0).toUpperCase() + gate.planId.slice(1) : "no plan"}. `
                : `${gate.used} din ${gate.max} ${gate.max === 1 ? "anunț activ" : "anunțuri active"} pe ${gate.planId ? gate.planId.charAt(0).toUpperCase() + gate.planId.slice(1) : "fără plan"}. `}
              {w.err_limit_d}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => setPlansOpen(true)} className="h-11 rounded-full bg-emerald px-6 text-white hover:bg-emerald/90 sm:h-12">
                {en ? "See the plans" : "Vezi planurile"}
              </Button>
              <Button asChild variant="outline" className="h-11 gap-1.5 rounded-full px-5 sm:h-12">
                <Link to="/my-properties">
                  {en ? "My listings" : "Anunțurile mele"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <PlanCheckoutModal open={plansOpen} onOpenChange={setPlansOpen} />
          </div>
        ) : (
          <>
            <div className="mb-4 mt-2">
              <h1 className="font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">
                {w.page_h}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {w.page_sub}
              </p>
            </div>
            <PropertyWizard
              onDone={(property) => { setCreated(property || null); setSubmitted(true); }}
              onCancel={() => { window.location.href = "/"; }}
            />
          </>
        )}
      </div>
    </div>
  );
}