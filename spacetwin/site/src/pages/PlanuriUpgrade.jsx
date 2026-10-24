import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import NumberFlow from "@number-flow/react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import ScrambleText from "@/components/ScrambleText";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/components/CountryContext";
import { base44 } from "@/api/base44Client";
import { Reveal as HouseReveal } from "@/components/ui/reveal";
import { boostUnitPrice, featureText } from "@/lib/plans";
import { usePlanConfigs } from "@/hooks/usePlanConfigs";

// ---------------------------------------------------------------------------
// Pagina de planuri, în forma cerută de client: cardurile albastre cu insignă
// în colț, comutatorul Lunar/Anual cu pastilă animată și prețul care se
// rostogolește. Iconițele de beneficii sunt PNG-urile lucioase din
// public/images/generated — aceeași limbă vizuală ca insignele, fără line art.
//
// Boost-urile stau sub planuri, în același stil, iar primul pachet e „1 boost"
// pentru că un proprietar trebuie să poată cumpăra exact unul.
// ---------------------------------------------------------------------------

// Această pagină încă folosea `whileInView` — tiparul retras în 672f244 tocmai
// pentru că ascundea secțiuni întregi. Problema nu e de stil:
// starea de repaus era `opacity: 0`, iar singurul lucru care aducea conținutul
// înapoi era un cadru de animație. Când bucla de cadre e sugrumată — filă în
// fundal, iframe-ul editorului Base44, telefon încetinit — tween-ul nu pornește
// niciodată, iar planurile, comutatorul de facturare și TOATE pachetele de
// boost rămân desenate la opacitate zero, ocupându-și înălțimea. Pagina arată
// goală, nu stricată, deci nimeni nu raportează o eroare: pur și simplu nu
// găsești de unde să cumperi.
//
// Shim-ul de mai jos păstrează semnătura veche (`as`, `index`), ca să nu fie
// nevoie să rescriu cele zece locuri care o folosesc, dar dedesubt e Reveal-ul
// casei: starea de repaus e cea VIZIBILĂ, iar ascunderea se aplică doar după ce
// avem dovada că un IntersectionObserver e viu și raportează.
//
// Mai rămâne un caz de rezolvat: EmailDirectory (pe /contact) are același tipar
// pe cardurile de email și pe avertismentul de securitate. Nu l-am mutat odată
// cu ăsta pentru că acolo clasele care contează pentru grilă (`sm:col-span-2`)
// stau chiar pe elementul animat, deci mutarea cere și rearanjarea grilei.
function Reveal({ as = "div", index = 0, className, children }) {
  const delay = index * 0.08;
  if (as === "div") {
    return (
      <HouseReveal delay={delay} className={className}>
        {children}
      </HouseReveal>
    );
  }
  const Tag = as;
  return (
    <HouseReveal delay={delay}>
      <Tag className={className}>{children}</Tag>
    </HouseReveal>
  );
}

function PricingSwitch({ annual, onSwitch, en }) {
  const opts = [
    { value: false, label: en ? "Monthly" : "Lunar" },
    { value: true, label: en ? "Yearly" : "Anual", note: en ? "Save 20%" : "Economisești 20%" },
  ];
  return (
    <div className="flex justify-center">
      <div className="relative z-10 mx-auto flex w-fit rounded-full border border-gray-200 bg-neutral-50 p-1 dark:border-white/10 dark:bg-white/5">
        {opts.map((opt) => {
          const active = annual === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onSwitch(opt.value)}
              aria-pressed={active}
              className={`relative z-10 h-11 flex-shrink-0 rounded-full px-4 py-1 font-medium transition-colors sm:h-12 sm:px-6 sm:py-2 ${
                active ? "text-white" : "text-muted-foreground hover:text-black dark:hover:text-white"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="planSwitchPill"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute left-0 top-0 h-11 w-full rounded-full border-4 border-emerald bg-gradient-to-t from-emerald via-emerald/85 to-emerald shadow-sm shadow-emerald/60 sm:h-12"
                />
              )}
              <span className="relative flex items-center gap-2 whitespace-nowrap">
                {opt.label}
                {opt.note && (
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-emerald">
                    {opt.note}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Fundalul-fotografie care se aprindea la hover pe o treaptă A EXISTAT aici
// (TIER_BACKDROP + useHoverCapable) și a fost SCOS la cererea clientului,
// 23.08 („remove the hover photos background"). El îl ceruse inițial, apoi
// l-a văzut și l-a respins. Nu-l readuce fără să citezi ambele decizii.

// Iconițele lucioase existente, mapate pe beneficiile fiecărui plan.
const FEATURE_ICONS = {
  basic: ["/images/generated/icon-document.png", "/images/generated/icon-video.png", "/images/generated/icon-shield-check.png"],
  pro: ["/images/generated/icon-users-check.png", "/images/generated/icon-camera-verify.png", "/images/generated/icon-gauge.png"],
  agent: ["/images/generated/icon-agenti.png", "/images/generated/icon-lock.png", "/images/generated/icon-handshake.png"],
};

const INCLUDES_LABEL = {
  none: { ro: "Include gratuit:", en: "Included free:" },
  basic: { ro: "Include gratuit:", en: "Included free:" },
  pro: { ro: "Tot ce e în Basic, plus:", en: "Everything in Basic, plus:" },
  agent: { ro: "Tot ce e în Pro, plus:", en: "Everything in Pro, plus:" },
};

function Tick() {
  return (
    <span
      aria-hidden="true"
      className="mr-2.5 mt-px grid h-5 w-5 shrink-0 place-content-center rounded-full bg-gradient-to-t from-emerald to-emerald/80 text-[11px] font-bold leading-none text-white shadow-sm shadow-emerald/50 sm:mr-3 sm:h-6 sm:w-6 sm:text-[13px]"
    >
      ✓
    </span>
  );
}

// Eticheta de pe rândurile pe care clientul le-a marcat el însuși ca nelivrate.
// Rândul rămâne în listă — planul chiar îl include — dar nu se citește ca o
// promisiune pe care produsul o poate ține azi.
function SoonTag({ en }) {
  return (
    <span className="ml-2 mt-px shrink-0 self-start rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:bg-white/10 dark:text-neutral-400">
      {en ? "coming soon" : "în curând"}
    </span>
  );
}

// `free` schimbă subsolul cardului: planul gratuit nu se cumpără, deci nu
// primește un buton de plată care ar deschide un checkout gol.
function PlanCard({ plan, annual, onSelect, checkingOut, en, free = false }) {
  // Eticheta poate fi setată din Admin → Planuri & Prețuri (custom_tag);
  // fallback-ul istoric marchează Pro drept „Popular".
  const popular = plan.tag ? true : plan.id === "pro";
  const price = annual ? plan.yearly : plan.monthly;
  const decimals = price % 1 !== 0;
  const icons = FEATURE_ICONS[plan.id] || [];
  const headline = plan.headline || [];
  const includes = plan.includes || [];
  const label = INCLUDES_LABEL[plan.id] || INCLUDES_LABEL.basic;

  return (
    <Card
      className={`relative isolate flex h-full flex-col overflow-visible border-neutral-200 bg-white transition-transform duration-300 ease-out dark:border-white/10 dark:bg-neutral-900 ${
        popular ? "ring-2 ring-emerald" : ""
      }`}
    >
      {/* Cardul „Popular" era singurul TRANSPARENT: `bg-emerald/5` inseamna 5%
          verde si 95% NIMIC, deci prin el se vedea pagina. Vecinii lui sunt
          `bg-white`, opaci. Cat timp fundalul paginii e uniform nu se observa —
          dar in clipa in care se aprinde fotografia treptei, ea razbate DOAR
          prin cardul Pro. Acela se spala, isi pierde contrastul pe text si
          arata ca o greseala langa trei carduri curate.
          Cardul e acum opac ca toate celelalte, iar verdele e un strat pictat
          INAUNTRUL lui. Nu poate sta pe aceeasi clasa: `cn()` din Card ruleaza
          tailwind-merge, care vede `bg-white` si `bg-gradient-*` drept acelasi
          lucru si o arunca pe prima — verificat, `bg-white` disparea din lista
          de clase si fundalul redevenea transparent. */}
      {popular && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-emerald/5 dark:bg-emerald/10"
        />
      )}
      {/* Insigna atarnata in colt exista doar de la sm in sus. Pe telefon se
          suprapunea peste pastila „Popular" si oricum dubla iconita planului.
          Fisierele -v3 sunt taiate pe conturul artei (cele vechi aveau margini
          transparente intre 22% si 51%, deci trei cutii identice aratau trei
          medalii de marimi si pozitii diferite — exact „nealinierea" reclamata
          de client). Fara `-right` negativ: cardul Agent e lipit de marginea
          ferestrei, iar `overflow-x: clip` de pe html reteza ce atarna afara. */}
      {plan.badgeImg && (
        <img
          src={plan.badgeImg}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute z-20 hidden object-contain drop-shadow-lg sm:right-3 sm:-top-6 sm:block sm:h-16 sm:w-16"
        />
      )}

      <CardHeader className="p-4 text-left sm:p-6">
        {/* Pe telefon iconita sta pe randul ei si titlul coboara dedesubt, ca
            numele, descrierea si pretul sa porneasca TOATE din aceeasi margine.
            Cu iconita langa titlu, titlul atarna cu 48px in dreapta restului
            cardului (masurat la 375px: h3 la x=81, descrierea si pretul la
            x=33) — iar cardul Free, care nu are iconita, isi punea titlul la
            x=33. Patru carduri unul sub altul, cu doua indentari diferite:
            exact ce se vede ca „nealiniat". De la sm in sus e loc pentru
            lockup-ul aprobat de client, iconita mare langa nume, deci acolo
            randul nu se mai rupe (`sm:flex-nowrap`). */}
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:flex-nowrap">
          {plan.iconImg && (
            <img
              src={plan.iconImg}
              alt=""
              aria-hidden="true"
              className="order-1 h-9 w-9 shrink-0 object-contain drop-shadow sm:h-14 sm:w-14"
            />
          )}
          {popular && (
            <span className="order-2 ml-auto shrink-0 rounded-full bg-emerald px-3 py-1 text-sm font-semibold text-white sm:order-3">
              {plan.tag || "Popular"}
            </span>
          )}
          <h3 className="order-3 w-full text-xl font-bold text-gray-900 dark:text-white sm:order-2 sm:w-auto sm:min-w-0 sm:text-[1.75rem]">
            {plan.name}
          </h3>
        </div>
        <p className="mb-3 text-[13px] text-gray-600 dark:text-neutral-400 sm:mb-4 sm:min-h-[2.5rem] sm:text-sm">{en && plan.description_en ? plan.description_en : plan.description}</p>
        {/* „RON" statea pe `align-top`, adica ridicat in varful unei casete de
            52px, iar „/luna" — aliniat pe linia de baza a cifrei — cadea cu
            19px mai jos si la dreapta lui. Nu era o rupere de rand, dar se
            citea exact ca una: „50 ^RON" si dedesubt „/luna". Totul sta acum
            pe aceeasi linie de baza. */}
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          {free ? (
            <span className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
              {en ? "Free" : "Gratuit"}
            </span>
          ) : (
          <span className="text-3xl font-bold leading-none text-gray-900 dark:text-white sm:text-4xl">
            <NumberFlow
              value={price}
              locales="ro-RO"
              format={decimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }}
              className="text-3xl font-bold sm:text-4xl"
            />
            <span className="ml-1 text-lg font-semibold sm:text-xl">RON</span>
          </span>
          )}
          {!free && (
            <span className="text-sm text-gray-600 dark:text-neutral-400 sm:text-base">/{annual ? (en ? "year" : "an") : (en ? "month" : "lună")}</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-4 pt-0 sm:p-6 sm:pt-0">
        {free ? (
          <Link
            to="/post-property"
            className="mb-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white p-3 text-base font-semibold text-gray-900 transition active:scale-[0.98] dark:border-white/15 dark:bg-white/5 dark:text-white sm:mb-4 sm:min-h-[52px] sm:p-4 sm:text-lg"
          >
            {en ? "Post a listing" : "Publică un anunț"}
          </Link>
        ) : (
        <button
          type="button"
          onClick={() => onSelect(plan)}
          disabled={checkingOut === plan.id}
          className={`mb-3 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl p-3 text-base font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 sm:mb-4 sm:min-h-[52px] sm:p-4 sm:text-lg ${
            popular
              ? "border border-emerald/70 bg-gradient-to-t from-emerald to-emerald/85 text-white shadow-lg shadow-emerald/50"
              : "border border-neutral-700 bg-gradient-to-t from-neutral-900 to-neutral-600 text-white shadow-lg shadow-neutral-900/40"
          }`}
        >
          {checkingOut === plan.id ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> {en ? "Opening checkout" : "Se deschide plata"}</>
          ) : (
            en ? "Choose plan" : "Alege planul"
          )}
        </button>
        )}

        <ul className="space-y-2 py-3 sm:space-y-3 sm:py-4">
          {headline.map((f, i) => (
            <li key={f.ro} className="flex items-start">
              {icons[i] ? (
                <img src={icons[i]} alt="" aria-hidden="true" className="mr-2.5 h-5 w-5 shrink-0 object-contain drop-shadow-sm sm:mr-3 sm:h-7 sm:w-7" />
              ) : (
                <Tick />
              )}
              <span className="text-[13px] font-semibold leading-5 text-gray-700 dark:text-neutral-300 sm:text-sm">{featureText(f, en)}</span>
              {f.soon && <SoonTag en={en} />}
            </li>
          ))}
        </ul>

        {includes.length > 0 && (
          <div className="mt-auto space-y-2 border-t border-neutral-200 pt-3 dark:border-white/10 sm:space-y-3 sm:pt-4">
            <h4 className="mb-2 text-sm font-medium text-gray-900 dark:text-white sm:mb-3 sm:text-base">{en ? label.en : label.ro}</h4>
            <ul className="space-y-1.5 sm:space-y-2">
              {includes.map((f) => (
                <li key={f.ro} className="flex items-start">
                  <Tick />
                  <span className="text-[13px] leading-5 text-gray-600 dark:text-neutral-400 sm:text-sm">{featureText(f, en)}</span>
                  {f.soon && <SoonTag en={en} />}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BoostCard({ pack, cheapestUnit, onBuy, pending, en }) {
  const unit = boostUnitPrice(pack);
  const best = Math.abs(unit - cheapestUnit) < 0.001;
  const decimals = pack.priceRon % 1 !== 0;

  return (
    <Card
      className={`relative isolate flex h-full flex-col overflow-visible border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-900 ${
        pack.popular ? "ring-2 ring-emerald" : ""
      }`}
    >
      {/* Acelasi strat opac ca pe cardul de plan „Popular". */}
      {pack.popular && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-emerald/5 dark:bg-emerald/10"
        />
      )}
      {best && (
        <span className="absolute -top-2.5 left-3 z-20 rounded-full bg-gradient-to-t from-emerald to-emerald/80 px-2 py-0.5 text-[10px] font-semibold text-white shadow shadow-emerald/50 sm:-top-3 sm:left-4 sm:px-3 sm:py-1 sm:text-xs">
          {en ? "Best rate" : "Cel mai bun preț"}
        </span>
      )}
      <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Doua coloane la 375px inseamna 124px de continut cu p-5, din care
            iconita de 40px plus gap-3 lasa 70px pentru text. „boost-uri" nu
            incape in 70px, deci se rupea cu cratima — si doar pe pachetele de
            3/6/12, nu si pe „1 boost". Rezultatul: in acelasi rand al grilei,
            pretul si butonul „Cumpara" stateau cu 24px mai jos pe un card
            decat pe vecinul lui (masurat: 2521 vs 2545).
            Pe telefon iconita urca DEASUPRA textului. Langa el nu incape: la
            320px raman 104px de continut, iar „12 boost-uri" cere 81px — cu
            iconita si spatiul dintre ele, 121px. Un `whitespace-nowrap` nu
            rezolva nimic acolo, doar transforma ruperea de rand intr-o
            revarsare in afara cardului (masurat: 19px in afara). Asezate una
            peste alta, toate cele patru carduri au exact aceeasi structura —
            o iconita si UN rand de text — deci preturile si butoanele se
            aliniaza de la sine, in ambele limbi, pana la 320px.
            De la sm in sus e loc pentru lockup-ul orizontal de dinainte. */}
        <div className="flex flex-col items-start gap-1.5 sm:h-12 sm:flex-row sm:items-center sm:gap-3">
          <img
            src="/images/generated/icon-coins.png"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 shrink-0 object-contain drop-shadow sm:h-10 sm:w-10"
          />
          <p className="whitespace-nowrap text-xl font-bold leading-none text-gray-900 dark:text-white sm:text-2xl">
            {pack.boosts}{" "}
            <span className="text-[13px] font-semibold sm:text-base">
              {pack.boosts === 1 ? "boost" : en ? "boosts" : "boost-uri"}
            </span>
          </p>
        </div>

        <p className="mt-3 flex items-baseline text-2xl font-bold leading-none text-gray-900 dark:text-white sm:mt-4 sm:text-3xl">
          <NumberFlow
            value={pack.priceRon}
            locales="ro-RO"
            format={decimals ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }}
          />
          <span className="ml-1 text-sm font-semibold sm:text-base">RON</span>
        </p>
        <p className="mt-1.5 text-[11px] leading-tight text-gray-600 dark:text-neutral-400 sm:text-xs">
          {unit.toFixed(2).replace(".", ",")} RON {en ? "per boost" : "pe boost"}
        </p>

        <button
          type="button"
          onClick={() => onBuy(pack)}
          disabled={pending === pack.id}
          className={`mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold sm:mt-5 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 ${
            pack.popular || pack.single
              ? "border border-emerald/70 bg-gradient-to-t from-emerald to-emerald/85 text-white shadow-lg shadow-emerald/50"
              : "border border-neutral-700 bg-gradient-to-t from-neutral-900 to-neutral-600 text-white shadow-lg shadow-neutral-900/40"
          }`}
        >
          {pending === pack.id ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {en ? "Opening" : "Se deschide"}</>
          ) : (
            en ? "Buy" : "Cumpără"
          )}
        </button>
      </CardContent>
    </Card>
  );
}

export default function PlanuriUpgrade() {
  const [annual, setAnnual] = useState(false);
  const [checkingOut, setCheckingOut] = useState(null);
  const [boostPending, setBoostPending] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { lang } = useCountry();
  const navigate = useNavigate();
  const en = lang === "en";
  // Planurile și pachetele dinamice — configurate din Admin, cu fallback pe
  // valorile statice; realtime, deci o salvare din admin se vede pe loc aici.
  const { plans, freePlan, boostPacks } = usePlanConfigs();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get("checkout");
    const boost = params.get("boost");
    const sessionId = params.get("session_id");
    if (checkout === "success") {
      toast({
        title: en ? "Payment successful" : "Plată reușită",
        description: en ? "Your plan is active. Thank you!" : "Abonamentul tău a fost activat. Îți mulțumim!",
      });
      if (sessionId) base44.functions.invoke("VerifyCheckoutSession", { session_id: sessionId }).catch(() => {});
    } else if (checkout === "cancelled" || boost === "cancelled") {
      toast({
        title: en ? "Payment cancelled" : "Plată anulată",
        description: en ? "You were not charged." : "Nicio sumă nu a fost taxată.",
      });
    }
    if (checkout || boost) {
      params.delete("checkout"); params.delete("boost"); params.delete("session_id");
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectPlan = async (plan) => {
    if (!user) { navigate("/login"); return; }
    setCheckingOut(plan.id);
    try {
      const res = await base44.functions.invoke("CreateCheckoutSession", {
        plan_id: plan.id, interval: annual ? "yearly" : "monthly",
      });
      const url = res?.data?.url || res?.url;
      if (url) { window.location.href = url; return; }
      toast({
        title: en ? "Could not start the payment" : "Nu am putut porni plata",
        description: res?.data?.error || res?.error || (en ? "Try again in a few minutes." : "Încearcă din nou în câteva minute."),
        variant: "destructive",
      });
    } catch (e) {
      toast({
        title: en ? "Could not start the payment" : "Nu am putut porni plata",
        description: en ? "Try again in a few minutes." : "Încearcă din nou în câteva minute.",
        variant: "destructive",
      });
    } finally {
      setCheckingOut(null);
    }
  };

  const buyBoosts = async (pack) => {
    if (!user) { navigate("/login"); return; }
    setBoostPending(pack.id);
    try {
      const res = await base44.functions.invoke("CreateBoostCheckout", { pack_id: pack.id });
      const url = res?.data?.url || res?.url;
      if (url) { window.location.href = url; return; }
      toast({
        title: en ? "Could not start the payment" : "Nu am putut porni plata",
        description: res?.data?.error || res?.error || (en ? "Try again in a few minutes." : "Încearcă din nou în câteva minute."),
        variant: "destructive",
      });
    } catch (e) {
      toast({
        title: en ? "Could not start the payment" : "Nu am putut porni plata",
        description: en ? "Try again in a few minutes." : "Încearcă din nou în câteva minute.",
        variant: "destructive",
      });
    } finally {
      setBoostPending(null);
    }
  };

  const cheapestUnit = Math.min(...boostPacks.map(boostUnitPrice));

  return (
    <div className="relative mx-auto min-h-screen overflow-hidden bg-neutral-100 px-4 pb-24 pt-6 dark:bg-neutral-950 sm:pt-20">
      {/* Glow radial albastru — semnătura paginii, în forma cerută de client */}
      <div
        className="pointer-events-none absolute left-[10%] right-[10%] top-0 z-0 h-full w-[80%] dark:hidden"
        style={{
          backgroundImage: "radial-gradient(circle at center, #1F7048 0%, transparent 70%)",
          opacity: 0.35,
          mixBlendMode: "multiply",
        }}
      />
      <div
        className="pointer-events-none absolute left-[10%] right-[10%] top-0 z-0 hidden h-full w-[80%] dark:block"
        style={{
          backgroundImage: "radial-gradient(circle at center, #37A06B 0%, transparent 70%)",
          opacity: 0.18,
        }}
      />

      <div className="relative z-10">
        {/* Titlul, subtitlul si comutatorul mancau 357px din cei ~691px vizibili
            pe un 375x812 cu antet lipit sus si bara de jos — adica ajungeai la
            primul card fara sa-l vezi intreg. Subtitlul statea pe `w-[90%]`,
            ceea ce ii mai adauga un rand degeaba pe telefon. */}
        <div className="mx-auto mb-5 max-w-3xl text-center sm:mb-6">
          <Reveal as="h1" index={0} className="mb-3 text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl md:text-6xl">
            {en ? "Plans that fit " : "Planuri potrivite "}
            <span className="inline-block rounded-xl border border-dashed border-emerald bg-emerald/10 px-2 py-1 dark:bg-emerald/15">
              <ScrambleText text={en ? "you" : "pentru tine"} />
            </span>
          </Reveal>
          <Reveal as="p" index={1} className="mx-auto w-full text-sm text-gray-600 dark:text-neutral-400 sm:w-[70%] sm:text-base">
            {en
              ? "Pick how visible you want your listings to be. Verification stays free on every plan."
              : "Alege nivelul de vizibilitate potrivit pentru anunțurile tale. Verificarea de bază rămâne mereu gratuită, indiferent de plan."}
          </Reveal>
        </div>

        <Reveal as="div" index={2}>
          <PricingSwitch annual={annual} onSwitch={setAnnual} en={en} />
        </Reveal>

        {/* Patru trepte de când clientul a cerut planul gratuit declarat pe
            pagină. Pe telefon una sub alta, două pe tabletă, patru de la lg în
            sus — la md patru carduri de plan devin coloane de 170px. */}
        <div className="mx-auto mt-2 grid max-w-7xl grid-cols-1 gap-4 py-5 sm:mt-6 sm:grid-cols-2 sm:py-8 lg:grid-cols-4">
          {[freePlan, ...plans].map((plan, i) => (
            <Reveal key={plan.id} as="div" index={3 + i} className="h-full">
              <PlanCard
                plan={plan}
                annual={annual}
                onSelect={selectPlan}
                checkingOut={checkingOut}
                en={en}
                free={plan.id === "none"}
              />
            </Reveal>
          ))}
        </div>

        {/* BOOST-URI — sub planuri, în aceeași limbă vizuală */}
        <div className="mx-auto max-w-7xl pt-6">
          <div className="mx-auto mb-6 max-w-3xl text-center">
            <Reveal as="h2" index={0} className="mb-3 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl md:text-4xl">
              {en ? "Boost a listing" : "Promovează un anunț"}
            </Reveal>
            <Reveal as="p" index={1} className="mx-auto w-full text-sm text-gray-600 dark:text-neutral-400 sm:w-[75%] sm:text-base">
              {en
                ? "A boost lifts one listing above the rest of its band, and stays on it for as long as the listing is up. Buy a single one, or a pack if you list often."
                : "Un boost ridică un anunț peste restul categoriei sale și rămâne pe el cât timp anunțul e publicat. Cumperi unul singur, sau un pachet dacă postezi des."}
            </Reveal>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 lg:grid-cols-4">
            {boostPacks.map((pack, i) => (
              <Reveal key={pack.id} as="div" index={2 + i} className="h-full">
                <BoostCard
                  pack={pack}
                  cheapestUnit={cheapestUnit}
                  onBuy={buyBoosts}
                  pending={boostPending}
                  en={en}
                />
              </Reveal>
            ))}
          </div>


          <p className="mx-auto mt-10 max-w-3xl text-center text-xs text-gray-500 dark:text-neutral-500">
            {en
              ? "Prices include VAT. Subscriptions renew automatically and can be cancelled at any time; boosts are a one-off purchase and do not expire until used."
              : "Prețurile includ TVA. Abonamentele se reînnoiesc automat și pot fi anulate oricând; boost-urile sunt o plată unică și nu expiră până nu sunt folosite."}
          </p>
        </div>
      </div>
    </div>
  );
}