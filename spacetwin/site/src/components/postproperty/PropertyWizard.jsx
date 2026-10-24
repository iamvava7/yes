import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import confetti from "canvas-confetti";
import { generateUniquePropertyCode } from "@/lib/propertyCode";
import { uploadPhotos } from "@/lib/imageUpload";
import { callFnQuiet } from "@/lib/serverCall";
import { fetchMyActiveSubscription } from "@/lib/subscriptions";
import { fetchBoostBalance, applyBoost } from "@/lib/boosts";
import { fetchTourStatus, setTourUrl as saveTourUrl } from "@/lib/tours";
import { createNotification } from "@/lib/notifications";
import {
  EMPTY_FORM, MIN_PHOTOS, MAX_PHOTOS, MIN_FEATURES, buildPropertyPayload,
} from "@/lib/propertyPayload";
import StepBasics from "./StepBasics";
import StepLocation from "./StepLocation";
import StepDetails from "./StepDetails";
import StepFeatures, { countFeatures } from "./StepFeatures";
import BoostCheckoutModal from "@/components/BoostCheckoutModal";
import PlanCheckoutModal from "@/components/PlanCheckoutModal";
import StepPhotos from "./StepPhotos";
import { useWiz } from "./wizardCopy";

const STEP_COUNT = 5;

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "admin"];

export default function PropertyWizard({ onDone, onCancel }) {
  const { country } = useCountry();
  const { w } = useWiz();
  const STEPS = w.steps;
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = ADMIN_ROLES.includes((user?.role || "").toUpperCase());

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    owner_name: user?.full_name || "",
    phone: user?.phone || "",
    whatsapp_phone: user?.whatsapp_phone || "",
  });
  const [chips, setChips] = useState({});
  const [facilities, setFacilities] = useState({});
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const publishRef = useRef(null);

  // Promovarea de pe ultimul pas: câte boost-uri pune pe anunțul ăsta.
  // Soldul se ia la intrare și se ia din nou când fila redevine activă —
  // cumpărarea se deschide în altă filă, iar la întoarcere contorul e la zi.
  const [boostQty, setBoostQty] = useState(0);
  const [boostBalance, setBoostBalance] = useState(0);
  const [buyOpen, setBuyOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  // Bannerul de plan de pe ultimul pas (cererea clientului, 23.08): planul,
  // boost-urile rămase, tururile 3D disponibile și — dacă are voie — chiar
  // câmpul de link. O singură citire acoperă plan + tururi.
  const [tourStatus, setTourStatus] = useState(null);
  const [wizTourUrl, setWizTourUrl] = useState("");
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const load = () => {
      fetchBoostBalance(user.id).then((b) => {
        if (cancelled) return;
        setBoostBalance(b);
        setBoostQty((q) => Math.min(q, b));
      });
      fetchTourStatus({ userId: user.id, isAdmin }).then((t) => {
        if (!cancelled) setTourStatus(t);
      });
    };
    load();
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.removeEventListener("focus", load); };
  }, [user?.id, isAdmin]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const imagesCount = useMemo(() => (form.images ? form.images.split(",").filter(Boolean).length : 0), [form.images]);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const existing = form.images ? form.images.split(",").filter(Boolean) : [];
      const remaining = Math.max(0, MAX_PHOTOS - existing.length);
      if (remaining === 0) {
        toast({ title: w.err_max_photos(MAX_PHOTOS), variant: "destructive" });
        return;
      }
      const urls = await uploadPhotos(files, remaining);
      set({ images: [...existing, ...urls].join(",") });
    } catch {
      toast({ title: w.err_upload, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const validateStep = (s) => {
    if (s === 0 && !form.title.trim()) return w.err_title;
    if (s === 1 && !form.city) return w.err_city;
    if (s === 2) {
      // Ordinea e cea de pe ecran, de sus în jos: mesajul trimite omul la
      // primul câmp pe care îl vede gol, nu la ultimul din listă.
      // Etajul a ieșit dintre obligatorii — o casă nu are etaj.
      if (!form.price_monthly) return w.err_price;
      if (!form.surface_sqm) return w.err_surface;
      if (!String(form.building_year || "").trim()) return w.err_year;
      if (!form.available_from) return w.err_available;
      if (!form.description.trim()) return w.err_desc;
    }
    // Minim 3 bife la dotări, din oricare grup — anunțurile goale la
    // capitolul ăsta arată la fel de goale și în pagina publică.
    if (s === 3 && countFeatures(chips, facilities, form) < MIN_FEATURES) return w.err_features(MIN_FEATURES);
    return null;
  };

  // Jump to the top after the new step renders (instant, so it can't be
  // interrupted mid-animation by the layout change).
  const scrollTop = () => {
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    });
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { toast({ title: err, variant: "destructive" }); return; }
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
    scrollTop();
  };
  const back = () => {
    if (step === 0) { onCancel ? onCancel() : onDone?.(); return; }
    setStep((s) => s - 1);
    scrollTop();
  };

  const handlePublish = async () => {
    for (let s = 0; s <= 3; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); toast({ title: err, variant: "destructive" }); throw new Error(err); }
    }
    if (imagesCount < MIN_PHOTOS) { toast({ title: w.err_photos(MIN_PHOTOS), variant: "destructive" }); throw new Error("photos"); }
    if (!form.phone) { toast({ title: w.err_phone, variant: "destructive" }); throw new Error("phone"); }
    if (!agreed) { toast({ title: w.err_terms, variant: "destructive" }); throw new Error("terms"); }

    // Limitele planului se verifică server-side înainte de publicare — altfel
    // planurile vând „1 anunț activ" fără ca nimic să îl impună.
    // `slotsLeftBefore` ține locurile rămase înainte de acest anunț — folosit
    // mai jos ca să știm dacă tocmai s-a ocupat ultimul loc din plan.
    let slotsLeftBefore = null;
    if (!isAdmin) {
      try {
        const res = await base44.functions.invoke("CheckListingAllowance", { photo_count: imagesCount });
        const data = res?.data || res || {};
        if (data.allowed === false) {
          toast({
            title: w.err_limit_t,
            description: data.error || w.err_limit_d,
            variant: "destructive",
          });
          throw new Error("allowance");
        }
        slotsLeftBefore = typeof data.remaining === "number" ? data.remaining : null;
      } catch (e) {
        if (e?.message === "allowance") throw e;
        // O eroare de rețea nu trebuie să blocheze publicarea — limita rămâne
        // impusă oricum la aprobare.
      }
    }

    const property_code = await generateUniquePropertyCode();
    const created = await base44.entities.Property.create(
      buildPropertyPayload({ form, chips, facilities, country, user, isAdmin, property_code })
    );
    // Planul proprietarului se scrie PE anunț, nu se citește din abonament.
    // Subscription.read e blocat la owner/admin, deci un vizitator nu are cum
    // să afle pe ce plan e altcineva — de-aia anunțurile de Agent se vedeau
    // doar când era logat chiar agentul: pentru toți ceilalți cădeau în
    // „fără plan" și rândul de Agent rămânea gol. Property.read e null, deci
    // câmpul ăsta se vede de oriunde.
    //
    // Se scrie printr-un UPDATE după create, nu în payload-ul de create:
    // pe Base44, un câmp nou e ignorat în tăcere la create până la publish,
    // dar e acceptat la update.
    try {
      const mySub = await fetchMyActiveSubscription(user?.id);
      if (mySub?.plan_id) {
        await base44.entities.Property.update(created.id, { poster_plan: mySub.plan_id });
      }
    } catch (_) {
      // Best-effort: dacă pică, SyncPosterPlans repară la următoarea rulare.
    }

    // Boost-urile alese pe ultimul pas. NU aruncă: anunțul e deja creat, iar
    // ApplyBoost rezervă-și-restituie creditul singur — dacă pică, soldul
    // rămâne în cont și omul află din toast, nu dintr-o publicare „eșuată".
    if (boostQty > 0) {
      const res = await applyBoost(created.id, boostQty).catch(() => ({ error: true }));
      if (res?.error) toast({ title: w.p_boost_fail });
    }

    // Link-ul de tur pus pe ultimul pas. SetTourUrl re-verifică toate regulile
    // server-side (plan, ferestre de 3 zile, cotă, blocajul de 30 de zile) —
    // aici doar îl trimitem; un refuz nu strică publicarea.
    if (wizTourUrl.trim() && tourStatus?.allowed && tourStatus.remaining > 0) {
      const res = await saveTourUrl(created.id, wizTourUrl.trim()).catch(() => ({ ok: false }));
      if (!res?.ok) toast({ title: w.p_tour_fail, description: res?.error || undefined });
    }

    if (!isAdmin) {
      base44.functions.invoke("NotifyAdminsOnNewProperty", {
        property_id: created.id, title: form.title, owner_name: form.owner_name || "",
      }).catch(() => {});
    }

    // Notificare in-app la epuizare (cererea clientului, 23.08): dacă mai era
    // UN singur loc înainte de acest anunț, acum locurile din plan s-au terminat.
    if (!isAdmin && slotsLeftBefore === 1 && user?.id) {
      createNotification({
        userId: user.id,
        type: "system",
        text: "Ai folosit toate locurile de anunț din planul tău.",
        link: "/account",
        actorName: "VerifiCasa",
      });
    }
    callFnQuiet("ComputeTrustScore", { property_id: created.id });
    toast(isAdmin
      ? { title: w.ok_admin_t, description: w.ok_admin_d }
      : { title: w.ok_t, description: w.ok_d });

    // Confetti bursting from the publish button.
    const el = publishRef.current;
    const origin = el
      ? { x: (el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2) / window.innerWidth, y: (el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2) / window.innerHeight }
      : { y: 0.85 };
    const colors = ["#1F7048", "#DE4E12", "#161C29", "#F8F6F1"];
    confetti({ particleCount: 110, spread: 78, startVelocity: 42, origin, colors });
    setTimeout(() => confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: origin.y }, colors }), 120);
    setTimeout(() => confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: origin.y }, colors }), 120);

    // Let the success state show, then leave. Anunțul creat pleacă mai departe:
    // ecranul de final oferă promovarea, iar pentru asta îi trebuie id-ul și
    // starea de aprobare.
    await new Promise((r) => setTimeout(r, 1500));
    onDone?.(created);
  };

  // Corpul pasului își schimbă înălțimea brusc la fiecare pas, și cardul —
  // plus tot ce e sub el — sare. Măsurăm conținutul și lăsăm o TRANZIȚIE CSS
  // să ducă înălțimea acolo (tranziția aterizează pe valoarea-țintă chiar și
  // când se oprește cadrul de animație — regula casei; un keyframe nu).
  const bodyInnerRef = useRef(null);
  const [bodyH, setBodyH] = useState(null);
  useEffect(() => {
    const el = bodyInnerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBodyH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const Current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {/* Progress header */}
      <div className="border-b border-border/60 px-4 pb-4 pt-5 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald">
              {w.step_of(step + 1, STEP_COUNT)}
            </p>
            <h2 className="truncate font-heading text-lg font-bold text-navy dark:text-foreground">{Current.title}</h2>
          </div>
          <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">{Current.sub}</p>
        </div>

        <div
          className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step + 1}
        >
          <motion.div
            className="h-full rounded-full bg-emerald"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={reduced ? { duration: 0 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* Pași parcurși */}
        <div className="mt-4 flex items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors duration-300 ${
                  i < step
                    ? "border-emerald bg-emerald text-white"
                    : i === step
                    ? "border-emerald bg-card text-emerald ring-4 ring-emerald/15"
                    : "border-border bg-secondary text-muted-foreground/50"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {i < STEP_COUNT - 1 && (
                <span className={`mx-1 h-0.5 flex-1 rounded-full transition-colors duration-500 ${i < step ? "bg-emerald" : "bg-border"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step body */}
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <div
          style={{ height: bodyH == null ? "auto" : bodyH }}
          className="overflow-hidden transition-[height] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        >
          <div ref={bodyInnerRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, x: -16 }}
            transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && <StepBasics form={form} set={set} />}
            {step === 1 && <StepLocation form={form} set={set} country={country} />}
            {step === 2 && <StepDetails form={form} set={set} />}
            {step === 3 && <StepFeatures form={form} set={set} chips={chips} setChips={setChips} facilities={facilities} setFacilities={setFacilities} />}
            {step === 4 && (
              <>
                <p className="mb-4 rounded-xl bg-emerald-soft px-3.5 py-2.5 text-sm font-medium text-emerald">
                  {w.real_photos}
                </p>
                <StepPhotos
                  form={form} set={set} uploading={uploading} onFiles={handleFile}
                  agreed={agreed} setAgreed={setAgreed}
                  boostQty={boostQty} setBoostQty={setBoostQty} boostBalance={boostBalance}
                  onBuyBoosts={() => setBuyOpen(true)}
                  onSeePlans={() => setPlansOpen(true)}
                  tourStatus={tourStatus} tourUrl={wizTourUrl} setTourUrl={setWizTourUrl}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-border/60 bg-card px-4 py-3 sm:px-6">
        <Button
          type="button"
          variant="outline"
          onClick={back}
          className="h-12 gap-1.5 rounded-full px-5"
        >
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? w.cancel : w.back}
        </Button>
        {step < STEP_COUNT - 1 ? (
          <Button
            type="button"
            onClick={next}
            className="h-12 flex-1 gap-1.5 rounded-full bg-emerald text-base text-white shadow-soft hover:bg-emerald/90"
          >
            {w.next} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <span ref={publishRef} className="flex-1">
            <LoadingButton
              onAction={handlePublish}
              disabled={uploading}
              pendingLabel={w.publishing}
              successLabel={w.published}
              errorLabel={w.retry}
              className="w-full rounded-full"
            >
              {w.publish}
            </LoadingButton>
          </span>
        )}
      </div>

      <BoostCheckoutModal
        open={buyOpen}
        onOpenChange={setBuyOpen}
        onDone={(newBalance) => {
          if (typeof newBalance === "number") setBoostBalance(newBalance);
        }}
      />
      <PlanCheckoutModal open={plansOpen} onOpenChange={setPlansOpen} />
    </div>
  );
}