import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import StoreBadges from "@/components/StoreBadges";
import Glyph from "@/components/Glyph";
import LoopVideo from "@/components/LoopVideo";
import PhotoMarquee from "@/components/PhotoMarquee";
import { usePlanConfigs } from "@/hooks/usePlanConfigs";
import { startPlanCheckout, startBoostCheckout } from "@/lib/checkout";
import { TOUR_3D_LINK_SAMPLE, hasStoreLinks } from "@/lib/appLinks";

// Pagina care vinde aplicația de tur 3D. Marketing, public, fără login.
//
// Trei lucruri de ținut minte dacă o modifici:
//
// 1. Textul stă în CONTENT, nu în src/i18n.js. Sunt vreo patruzeci de șiruri
//    folosite de o singură pagină — aceeași alegere ca la About.jsx. Dicționarul
//    global e pentru ce se repetă prin aplicație.
// 2. Dezvăluirile la derulare vin din @/components/ui/reveal, NICIODATĂ din
//    `whileInView`. Diferența nu e de stil: cu `whileInView` singurul lucru care
//    face conținutul vizibil e un cadru de animație, iar când bufferul de cadre
//    e sugrumat secțiunea rămâne invizibilă ocupându-și toată înălțimea.
// 3. Telefonul și desktopul au compoziții diferite, nu una stivuită. Unde se
//    schimbă ordinea sau decupajul, e intenționat.
//
// Cifrele de tururi/promovări per plan vin din src/lib/plans.js. Cât timp sunt
// `null` scriem „în curând" — pagina NU inventează un număr.

const CONTENT = {
  ro: {
    hero_h: "Turul 3D al locuinței, făcut din telefon.",
    hero_p:
      "Scanezi fiecare cameră cu aplicația VerifiCasa 3D, primești un link și îl lipești în anunț. Cine caută intră în locuință înainte să bată drumul.",
    hero_plans: "Vezi planurile",
    hero_note: "Tururile fac parte din planul tău VerifiCasa.",
    hero_alt: "Telefon care scanează o cameră de zi, cu structura camerei desenată peste imagine",

    steps_h: "Cum funcționează",
    steps_p: "Patru pași. Al patrulea e în formularul pe care îl completezi oricum.",
    steps: [
      {
        icon: "/images/generated/icon-3d-download.png",
        t: "Descarcă aplicația",
        d: "VerifiCasa 3D, pe iPhone și pe Android.",
      },
      {
        icon: "/images/generated/icon-3d-rooms.png",
        t: "Scanează fiecare cameră",
        d: "Te plimbi încet prin locuință, cu telefonul în mână. Aplicația face restul.",
      },
      {
        icon: "/images/generated/icon-3d-link.png",
        t: "Primești linkul",
        d: "Un link verificasa.ro/3D/… — găzduit la noi, nu la altcineva.",
      },
      {
        icon: "/images/generated/icon-3d-listing.png",
        t: "Îl adaugi la anunț",
        d: "În pasul „Poze & contact”, ultimul din formularul de publicare.",
      },
    ],

    why_h: "De ce contează",
    why: [
      {
        t: "Anunțul tău nu mai arată ca celelalte",
        d: "Zece poze arată la fel peste tot. Un tur prin care omul se plimbă singur prin casă, nu.",
      },
      {
        t: "Se vizitează de oriunde, la orice oră",
        d: "Cine caută din alt oraș — sau la unsprezece noaptea — intră în locuință fără să te sune.",
        img: "/images/tur3d/tur3d-easy-phone-v1.webp",
        alt: "Telefon în fața unei camere de zi, arătând aceeași cameră pe ecran",
      },
      {
        t: "Mai puține drumuri degeaba",
        d: "Cine ajunge la vizionare a văzut deja totul. Vine pentru că îi place, nu ca să afle.",
        img: "/images/tur3d/tur3d-reach-map-v1.webp",
        alt: "Fotografia unei clădiri așezată pe o hartă, lângă un ac de locație",
      },
    ],
    why_trio_alt: "Trei fațade de imobile",

    plans_h: "Tururi 3D în planuri",
    plans_p:
      "Fiecare plan vine cu un număr de tururi 3D și de promovări. Dacă ai nevoie de mai multe, le cumperi separat.",
    plans_tours: "Tururi 3D incluse",
    plans_boosts: "Promovări incluse",
    plans_soon: "în curând",
    plans_cta: "Vezi toate planurile",
    plans_buy: "Alege planul",
    plans_buying: "Se deschide plata",
    plans_free: "Gratuit",
    plans_free_cta: "Publică un anunț",
    plans_monthly: "Lunar",
    plans_yearly: "Anual",
    packs_buy: "Cumpără",
    packs_buying: "Se deschide",
    pay_err_h: "Nu am putut porni plata",
    pay_err_p: "Încearcă din nou în câteva minute.",
    packs_h: "Sau la bucată",
    packs_p: "O promovare ridică un anunț peste restul categoriei sale cât timp anunțul e publicat.",
    packs_unit: (n) => (n === 1 ? "promovare" : "promovări"),

    field_h: "Unde ajunge linkul",
    field_p:
      "Câmpul „Link Tur 3D” stă în ultimul pas al formularului de publicare, lângă poze și datele de contact. Sub el vezi câte tururi ai folosit din planul tău; când le termini, câmpul se blochează până cumperi altele.",
    field_note: "Machetă — câmpul intră în formular odată cu aplicația.",
    field_step: "Pasul 5 din 5 · Poze & contact",
    field_label: "Link Tur 3D",
    field_usage: "3 din 5 tururi folosite",
    field_boost_label: "Promovează anunțul",
    field_boost_balance: "ai 4 promovări",

    cta_h: "Descarcă VerifiCasa 3D",
    cta_p: "Scanezi o cameră în câteva minute. Primul tur e greu doar pentru că e primul.",
    cta_list: "Publică un anunț",
    cta_alt: "Interiorul unei bucătării deschise, văzut ca într-un tur virtual",
  },

  en: {
    hero_h: "A 3D tour of the place, shot on your phone.",
    hero_p:
      "Scan each room with the VerifiCasa 3D app, get a link, paste it into your listing. People walk the place before they drive to it.",
    hero_plans: "See the plans",
    hero_note: "Tours come with your VerifiCasa plan.",
    hero_alt: "A phone scanning a living room, the shape of the room drawn over the image",

    steps_h: "How it works",
    steps_p: "Four steps. The fourth is in the form you are filling in anyway.",
    steps: [
      {
        icon: "/images/generated/icon-3d-download.png",
        t: "Download the app",
        d: "VerifiCasa 3D, on iPhone and Android.",
      },
      {
        icon: "/images/generated/icon-3d-rooms.png",
        t: "Scan every room",
        d: "Walk slowly through the place, phone in hand. The app does the rest.",
      },
      {
        icon: "/images/generated/icon-3d-link.png",
        t: "Get your link",
        d: "A verificasa.ro/3D/… link — hosted by us, not by somebody else.",
      },
      {
        icon: "/images/generated/icon-3d-listing.png",
        t: "Add it to your listing",
        d: "In the “Photos & contact” step, the last one in the publishing form.",
      },
    ],

    why_h: "Why it matters",
    why: [
      {
        t: "Your listing stops looking like the rest",
        d: "Ten photos look the same everywhere. A tour someone walks through on their own does not.",
      },
      {
        t: "Viewed from anywhere, at any hour",
        d: "Someone searching from another city — or at eleven at night — walks the place without ringing you.",
        img: "/images/tur3d/tur3d-easy-phone-v1.webp",
        alt: "A phone in front of a living room, showing the same room on screen",
      },
      {
        t: "Fewer wasted trips",
        d: "Whoever turns up for a viewing has already seen everything. They come because they like it, not to find out.",
        img: "/images/tur3d/tur3d-reach-map-v1.webp",
        alt: "A photograph of a building resting on a map beside a location pin",
      },
    ],
    why_trio_alt: "Three building facades",

    plans_h: "3D tours in the plans",
    plans_p:
      "Every plan comes with a number of 3D tours and boosts. Need more, you buy them separately.",
    plans_tours: "3D tours included",
    plans_boosts: "Boosts included",
    plans_soon: "coming soon",
    plans_cta: "See all plans",
    plans_buy: "Choose plan",
    plans_buying: "Opening checkout",
    plans_free: "Free",
    plans_free_cta: "Post a listing",
    plans_monthly: "Monthly",
    plans_yearly: "Yearly",
    packs_buy: "Buy",
    packs_buying: "Opening",
    pay_err_h: "Could not start the payment",
    pay_err_p: "Try again in a few minutes.",
    packs_h: "Or one at a time",
    packs_p: "A boost lifts one listing above the rest of its band, for as long as the listing is up.",
    packs_unit: (n) => (n === 1 ? "boost" : "boosts"),

    field_h: "Where the link goes",
    field_p:
      "The “Link Tur 3D” field sits in the last step of the publishing form, next to the photos and contact details. Under it you see how many tours you have used from your plan; once they run out, the field locks until you buy more.",
    field_note: "Mock-up — the field lands in the form together with the app.",
    field_step: "Step 5 of 5 · Photos & contact",
    field_label: "3D tour link",
    field_usage: "3 of 5 tours used",
    field_boost_label: "Boost this listing",
    field_boost_balance: "you have 4 boosts",

    cta_h: "Download VerifiCasa 3D",
    cta_p: "A room takes a few minutes. The first tour is only hard because it is the first.",
    cta_list: "Post a listing",
    cta_alt: "The interior of an open kitchen, seen as if inside a virtual tour",
  },
};

const HOUSES = [
  "/images/tur3d/tur3d-house-1-v1.webp",
  "/images/tur3d/tur3d-house-2-v1.webp",
  "/images/tur3d/tur3d-house-3-v1.webp",
];

// Fotografiile care trec prin banda primului card. Fațade obișnuite, alese
// tocmai pentru că sunt obișnuite: cardul spune „zece poze arată la fel peste
// tot", iar banda o arată în loc s-o afirme.
const MARQUEE = [
  ...HOUSES,
  "/images/properties/exterior-01.webp",
  "/images/properties/exterior-02.webp",
  "/images/properties/exterior-03.webp",
  "/images/properties/exterior-04.webp",
  "/images/properties/exterior-05.webp",
  "/images/properties/exterior-06.webp",
  "/images/properties/exterior-07.webp",
  "/images/properties/exterior-08.webp",
];

// Clipurile din banda „De ce contează", 5 secunde fiecare, mute.
//
// Aceeași regulă ca la linkurile de magazin din lib/appLinks.js: dacă un `src`
// e `null`, cardul cade pe fotografia lui. Nimic gol, niciodată, și niciun
// <video> care caută un fișier inexistent.
//
// `crossfade` e pornit pe amândouă pentru că sunt clipuri generate: primul și
// ultimul cadru sunt APROAPE la fel, nu identice, iar bucla nativă ar arăta o
// tăietură la fiecare tură. 0.35s de dizolvare acoperă îmbinarea. Dacă un clip
// ajunge vreodată să se închidă perfect pe el însuși, pune 0 și economisește un
// decodor — vezi comentariul din LoopVideo.
//
// Posterul e fotografia care stătea aici înainte, deci și primul cadru, și
// varianta cu mișcare redusă, arată corect.
const WHY_MEDIA = [
  { kind: "marquee" },
  { kind: "video", src: "/videos/tur3d-day-cycle-v1.mp4", poster: "/images/tur3d/tur3d-easy-phone-v1.webp" },
  { kind: "video", src: "/videos/tur3d-map-car-v1.mp4", poster: "/images/tur3d/tur3d-reach-map-v1.webp" },
];

export default function Tur3D() {
  const { lang } = useCountry();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const en = lang === "en";
  const c = en ? CONTENT.en : CONTENT.ro;
  const live = hasStoreLinks();
  // Planurile și pachetele vin din configurarea Admin → Planuri & Prețuri
  // (cu fallback pe valorile statice) — aceeași sursă ca /upgrade.
  const { plans, freePlan, boostPacks } = usePlanConfigs();

  // Planurile se cumpără DE AICI, nu doar de pe /upgrade. Cererea clientului:
  // cine citește pagina care vinde tururile 3D e deja convins, iar un link
  // „vezi toate planurile" îl trimite să se hotărască din nou.
  //
  // Paginile de întoarcere din Stripe le decid funcțiile de backend
  // (/upgrade pentru abonament, /account pentru boost-uri), deci cine cumpără
  // de aici se întoarce acolo, cu notificarea de plată reușită. Se schimbă în
  // base44/functions/*/entry.ts, nu în pagina asta.
  const [annual, setAnnual] = useState(false);
  const [planPending, setPlanPending] = useState(null);
  const [packPending, setPackPending] = useState(null);

  const payError = (detail) =>
    toast({ title: c.pay_err_h, description: detail || c.pay_err_p, variant: "destructive" });

  const buyPlan = async (plan) => {
    if (!user) { navigate("/login?returnTo=%2Ftur-3d"); return; }
    setPlanPending(plan.id);
    const res = await startPlanCheckout(plan.id, annual ? "yearly" : "monthly");
    if (!res.redirected) { payError(res.error); setPlanPending(null); }
  };

  const buyPack = async (pack) => {
    if (!user) { navigate("/login?returnTo=%2Ftur-3d"); return; }
    setPackPending(pack.id);
    const res = await startBoostCheckout(pack.id);
    if (!res.redirected) { payError(res.error); setPackPending(null); }
  };

  return (
    <div>
      {/* ——— HERO ———
          Telefon: fotografia intră prima, pe toată lățimea, și se stinge în
          fundal; textul vine dedesubt. Desktop: două coloane, cu fotografia
          ca panou înalt în dreapta. */}
      <section className="border-b border-border/60 bg-secondary/25">
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-8">
          <div className="relative lg:hidden">
            <img
              src="/images/tur3d/tur3d-hero-scan-v1.webp"
              alt={c.hero_alt}
              className="h-[46vw] max-h-[300px] min-h-[170px] w-full object-cover"
            />
            <div className="hero-fade absolute inset-x-0 bottom-0 h-20" />
          </div>

          <Reveal className="px-4 pb-10 pt-6 sm:px-6 lg:col-span-6 lg:px-0 lg:py-20">
            <h1 className="font-heading text-[1.9rem] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {c.hero_h}
            </h1>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
              {c.hero_p}
            </p>

            {/* Fără URL-uri de magazin, butonul care chiar duce undeva devine
                cel principal. Altfel hero-ul îndeamnă la o acțiune imposibilă. */}
            <div className="mt-7">
              <Link
                to="/upgrade"
                className={
                  "inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 text-base font-bold transition-transform hover:scale-[1.03] active:scale-[0.99] " +
                  (live
                    ? "border border-border bg-background text-foreground"
                    : "bg-emerald text-primary-foreground shadow-lg shadow-emerald/30")
                }
              >
                {c.hero_plans}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <StoreBadges className="mt-4" en={en} />

            <p className="mt-4 text-xs font-semibold text-muted-foreground">{c.hero_note}</p>
          </Reveal>

          <div className="hidden lg:col-span-6 lg:block">
            <img
              src="/images/tur3d/tur3d-hero-scan-v1.webp"
              alt={c.hero_alt}
              className="h-[30rem] w-full rounded-2xl object-cover shadow-soft xl:h-[34rem]"
            />
          </div>
        </div>
      </section>

      {/* ——— CUM FUNCȚIONEAZĂ ———
          Telefon: listă verticală, numerele legate printr-o linie subțire.
          Desktop: patru coloane, numărul deasupra iconiței. */}
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-16 lg:px-8">
        <Reveal>
          <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{c.steps_h}</h2>
          <p className="mt-2 max-w-[52ch] text-sm text-muted-foreground sm:text-base">{c.steps_p}</p>
        </Reveal>

        {/* telefon */}
        <RevealGroup className="mt-7 sm:hidden">
          {c.steps.map((s) => (
            <RevealItem key={s.t} className="flex gap-3.5 border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
              <Glyph src={s.icon} className="h-11 w-11" />
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-bold text-foreground">{s.t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>

        {/* desktop */}
        <RevealGroup className="mt-9 hidden gap-8 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map((s) => (
            <RevealItem key={s.t} className="border-t border-border pt-5">
              <Glyph src={s.icon} className="h-12 w-12" />
              <h3 className="mt-3 font-heading text-lg font-bold text-foreground">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ——— DE CE CONTEAZĂ ———
          Fără procente. Nu avem date reale de folosire, iar o cifră inventată
          pe pagina care vinde încrederea e exact lucrul pe care nu ni-l putem
          permite. Când clientul are numere, aici intră banda de statistici. */}
      <section className="border-y border-border/60 bg-secondary/25 py-7 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{c.why_h}</h2>
          </Reveal>

          <RevealGroup className="mt-7 grid gap-5 md:grid-cols-3">
            {c.why.map((w, i) => (
              <RevealItem
                key={w.t}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
              >
                {/* Aceeași înălțime pe toate trei, ca rândul să nu se clatine,
                    dar trei feluri de imagine: o bandă care se plimbă, apoi
                    două clipuri. Cât timp un clip lipsește din /public/videos,
                    cardul lui rămâne fotografia de azi — vezi WHY_MEDIA. */}
                {WHY_MEDIA[i]?.kind === "marquee" ? (
                  <PhotoMarquee images={MARQUEE} className="h-40 border-b border-border sm:h-44" />
                ) : WHY_MEDIA[i]?.src ? (
                  <LoopVideo
                    src={WHY_MEDIA[i].src}
                    poster={WHY_MEDIA[i].poster}
                    crossfade={0.35}
                    className="h-40 border-b border-border sm:h-44"
                  />
                ) : (
                  <img
                    src={w.img}
                    alt={w.alt}
                    className="h-40 w-full object-cover sm:h-44"
                    loading="lazy"
                  />
                )}
                <div className="p-5">
                  <h3 className="font-heading text-lg font-bold leading-snug text-foreground">{w.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{w.d}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ——— PLANURI ȘI TURURI 3D ——— */}
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-16 lg:px-8">
        <Reveal>
          <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{c.plans_h}</h2>
          <p className="mt-2 max-w-[56ch] text-sm text-muted-foreground sm:text-base">{c.plans_p}</p>
        </Reveal>

        {/* Lunar / Anual. Comutatorul de pe /upgrade e o pastilă pe framer cu
            layoutId; aici e nevoie de o singură pereche de butoane, nu de încă
            un motor de animație pe o pagină de prezentare. */}
        <Reveal className="mt-6 flex" y={12}>
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            {[false, true].map((val) => (
              <button
                key={String(val)}
                type="button"
                onClick={() => setAnnual(val)}
                aria-pressed={annual === val}
                className={
                  "min-h-[40px] rounded-full px-4 text-sm font-bold transition-[transform,background-color,color] duration-200 ease-out active:scale-[0.96] " +
                  (annual === val
                    ? "bg-emerald text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {val ? c.plans_yearly : c.plans_monthly}
              </button>
            ))}
          </div>
        </Reveal>

        <RevealGroup className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[freePlan, ...plans].map((plan) => {
            const free = plan.id === "none";
            const price = annual ? plan.yearly : plan.monthly;
            return (
              <RevealItem
                key={plan.id}
                className={
                  "flex flex-col rounded-2xl border bg-card p-5 shadow-soft " +
                  (plan.id === "pro" ? "border-emerald ring-1 ring-emerald/40" : "border-border")
                }
              >
                <div className="flex items-center gap-3">
                  {plan.badgeImg && <Glyph src={plan.badgeImg} className="h-11 w-11" />}
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-bold text-foreground">{plan.shortName}</h3>
                    <p className="text-xs text-muted-foreground tnum">
                      {free
                        ? c.plans_free
                        : `${price.toLocaleString("ro-RO")} RON/${annual ? (en ? "year" : "an") : (en ? "month" : "lună")}`}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  {[
                    [c.plans_tours, plan.tours3d, true],
                    [c.plans_boosts, plan.boostsIncluded, false],
                  ].map(([label, value, isTours]) => (
                    <div key={label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="flex shrink-0 items-baseline gap-1.5">
                        <span className="font-extrabold text-emerald tnum">{value}</span>
                        {/* Cifra e reală, aplicația nu e. Cât timp nu există
                            linkuri de magazin, rândul de tururi o spune — pe
                            toate treptele, fiindcă e o stare a produsului, nu a
                            planului. */}
                        {isTours && !live && value > 0 && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                            {c.plans_soon}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>

                {free ? (
                  <Link
                    to="/post-property"
                    className="mt-5 flex min-h-[48px] items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-foreground transition-[transform,border-color,color] duration-200 ease-out hover:border-emerald hover:text-emerald active:scale-[0.96] dark:bg-card"
                  >
                    {c.plans_free_cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => buyPlan(plan)}
                    disabled={planPending === plan.id}
                    className="mt-5 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-emerald text-sm font-bold text-primary-foreground transition-[transform,background-color] duration-200 ease-out hover:bg-emerald/90 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {planPending === plan.id ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {c.plans_buying}</>
                    ) : (
                      c.plans_buy
                    )}
                  </button>
                )}
              </RevealItem>
            );
          })}
        </RevealGroup>

        <Reveal className="mt-6 rounded-2xl border border-border bg-secondary/40 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="font-heading text-base font-bold text-foreground">{c.packs_h}</h3>
            <p className="text-xs text-muted-foreground">{c.packs_p}</p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {boostPacks.map((pack) => (
              <li key={pack.id}>
                <button
                  type="button"
                  onClick={() => buyPack(pack)}
                  disabled={packPending === pack.id}
                  className="flex min-h-[44px] w-full flex-col items-center justify-center rounded-xl border border-border bg-card px-3 py-2.5 text-center transition-[transform,border-color] duration-200 ease-out hover:border-emerald active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {packPending === pack.id ? (
                    <span className="flex items-center gap-1.5 py-2 text-xs font-bold text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {c.packs_buying}
                    </span>
                  ) : (
                    <>
                      <span className="font-heading text-lg font-extrabold text-foreground tnum">{pack.boosts}</span>
                      <span className="text-[11px] text-muted-foreground">{c.packs_unit(pack.boosts)}</span>
                      <span className="mt-1 text-xs font-bold text-emerald tnum">
                        {pack.priceRon.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} RON
                      </span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <Link
            to="/upgrade"
            className="mt-4 tap-44 inline-flex items-center gap-1.5 py-1 text-sm font-bold text-emerald underline-offset-4 hover:underline"
          >
            {c.plans_cta}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      {/* ——— UNDE AJUNGE LINKUL ———
          Macheta e desenată cu aceleași forme ca formularul adevărat, dar NU e
          interactivă: niciun `input`, niciun buton. Un câmp dezactivat tot ar
          apărea în arborele de accesibilitate al unei pagini de prezentare,
          fără să facă nimic. Aici sunt div-uri care arată ca un formular. */}
      <section className="border-t border-border/60 bg-secondary/25 py-7 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
          <Reveal>
            <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">{c.field_h}</h2>
            <p className="mt-3 max-w-[54ch] text-sm leading-relaxed text-muted-foreground sm:text-base">
              {c.field_p}
            </p>
            <Link
              to="/post-property"
              className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-emerald px-6 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              {c.cta_list}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>

          <Reveal delay={0.1}>
            <div
              aria-hidden="true"
              className="pointer-events-none select-none overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
            >
              <div className="border-b border-border/60 px-5 py-4">
                <p className="text-xs font-semibold text-emerald">{c.field_step}</p>
                <div className="mt-3 flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span key={i} className="h-1.5 flex-1 rounded-full bg-emerald" />
                  ))}
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {c.field_label}
                  </span>
                  <div className="w-full truncate rounded border border-emerald bg-background px-3.5 py-3 text-base text-foreground ring-2 ring-emerald/15 dark:bg-card">
                    {TOUR_3D_LINK_SAMPLE}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full w-3/5 rounded-full bg-emerald" />
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-muted-foreground tnum">
                      {c.field_usage}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3.5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">{c.field_boost_label}</span>
                    <span className="block text-[11px] text-muted-foreground">{c.field_boost_balance}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-base font-bold text-muted-foreground">
                      −
                    </span>
                    <span className="w-5 text-center font-extrabold text-foreground tnum">1</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald text-base font-bold text-emerald">
                      +
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-2.5 text-center text-[11px] text-muted-foreground/80">{c.field_note}</p>
          </Reveal>
        </div>
      </section>

      {/* ——— CTA FINAL ——— */}
      <section className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-16 lg:px-8">
        <Reveal className="relative overflow-hidden rounded-2xl">
          <img
            src="/images/tur3d/tur3d-interior-hotspot-v1.webp"
            alt={c.cta_alt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-deep/95 via-navy-deep/85 to-navy-deep/45" />

          <div className="relative max-w-xl p-6 sm:p-12">
            <h2 className="font-heading text-2xl font-bold leading-tight text-white sm:text-4xl">
              {c.cta_h}
            </h2>
            <p className="mt-3 max-w-[42ch] text-sm text-white/75 sm:text-base">{c.cta_p}</p>

            <StoreBadges className="mt-6" en={en} tone="ink" />

            <Link
              to="/post-property"
              className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/50 px-6 text-sm font-bold text-white transition-colors hover:bg-white/15"
            >
              {c.cta_list}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}