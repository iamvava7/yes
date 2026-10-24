import React from "react";
import { cn } from "@/lib/utils";
import { isImplausible } from "@/lib/listingSanity";

// Insignele care stau PE fotografia unui card. Fiecare e o pastilă solidă cu
// iconița lucioasă a aplicației — aceeași limbă vizuală ca insignele de plan,
// nu contururi desenate cu linie. Sunt intenționat mari: pe telefon trebuie să
// se citească dintr-o privire, nu să fie descifrate.

const KINDS = {
  // Fundal închis, nu auriu: iconița e din aur lucios și dispare pe auriu.
  promovat: {
    img: "/images/generated/badge-promovat.png",
    label: { ro: "Promovat", en: "Promoted" },
    className: "bg-[#1E1608]/95 text-[#F5CE7C] shadow-[0_1px_4px_rgba(0,0,0,0.4)]",
  },
  verificat: {
    img: "/images/generated/plan-badge-basic-v2.png",
    label: { ro: "Verificat", en: "Verified" },
    className: "bg-white text-[#12603D] shadow-[0_1px_3px_rgba(0,0,0,0.22)] dark:bg-neutral-900 dark:text-emerald",
  },
  agent: {
    img: "/images/generated/plan-badge-agent-v2.png",
    label: { ro: "Agent", en: "Agent" },
    className: "bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.22)] dark:bg-neutral-900 dark:text-white",
  },
  pro: {
    img: "/images/generated/plan-badge-pro-v2.png",
    label: { ro: "Pro", en: "Pro" },
    className: "bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.22)] dark:bg-neutral-900 dark:text-white",
  },
  basic: {
    img: "/images/generated/plan-badge-basic-v2.png",
    label: { ro: "Basic", en: "Basic" },
    className: "bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.22)] dark:bg-neutral-900 dark:text-white",
  },
  // Fără iconiță: nu există artwork pentru planul gratuit și nu inventează
  // nimeni unul. Pastila rămâne scrisă, în tuș pe hartie, ca să se vadă că e
  // treapta de jos fără să concureze cu insignele plătite.
  free: {
    img: null,
    label: { ro: "Free", en: "Free" },
    className: "bg-secondary text-muted-foreground",
  },
};

const SIZES = {
  // „xs" e insigna de miniatură: doar iconița, într-un cerc. Pe un thumbnail de
  // 92 px o pastilă cu text ocupă 78% din lățime — nu mai e o insignă pe o
  // fotografie, e o etichetă cu o fotografie în spate. Numele rămâne în `title`.
  xs: { chip: "h-5 w-5 justify-center p-0", img: "h-3.5 w-3.5" },
  sm: { chip: "h-6 gap-1 pl-1 pr-2.5 text-[11px]", img: "h-4 w-4" },
  md: { chip: "h-7 gap-1.5 pl-1 pr-3 text-xs", img: "h-5 w-5" },
  lg: { chip: "h-8 gap-1.5 pl-1.5 pr-3.5 text-[13px]", img: "h-6 w-6" },
};

// Înălțimea rândului, egală cu înălțimea pastilei din SIZES. Stă separat pentru
// că rândul gol nu are pastile din care să o moștenească.
const ROW_H = { xs: "h-5", sm: "h-6", md: "h-7", lg: "h-8" };

export function PropertyBadge({ kind, size = "md", lang = "ro", className, children }) {
  const meta = KINDS[kind];
  if (!meta) return null;
  const s = SIZES[size] || SIZES.md;
  const label = lang === "en" ? meta.label.en : meta.label.ro;
  return (
    <span
      title={size === "xs" ? label : undefined}
      className={cn(
        "inline-flex items-center rounded-full font-bold leading-none",
        s.chip,
        meta.className,
        className
      )}
    >
      {meta.img ? (
        <img
          src={meta.img}
          alt={size === "xs" ? label : ""}
          aria-hidden={size === "xs" ? undefined : "true"}
          className={cn("shrink-0 object-contain", s.img)}
          loading="lazy"
        />
      ) : null}
      {size === "xs" ? (meta.img ? null : label) : children || label}
    </span>
  );
}

/**
 * Rândul standard de insigne pentru un card.
 *
 * O SINGURĂ ordine, pe toate suprafețele: promovarea întâi (e plătită și
 * trebuie declarată), apoi verificarea (motivul pentru care există aplicația),
 * apoi cine a postat. Insigna de identitate („Agent") poate veni din două
 * locuri — `seller_role` sau planul postatorului — și înainte cele două intrau
 * în rând în poziții diferite. De aceea două carduri alăturate arătau „Agent,
 * Verificat" și „Verificat, Agent". Acum ambele ocupă același loc în listă.
 *
 * Rândul NU se rupe pe două linii. Pe un card de 164 px (două pe un ecran de
 * 375 px) două pastile măsurau 145 px — 88% din lățimea cardului, iar în
 * engleză treceau pe al doilea rând și acopereau fotografia. Pe cardurile mici
 * se afișează exact o pastilă, cea mai puternică; pe cele mari, cel mult două.
 * `max` poate forța altceva acolo unde chiar e loc.
 *
 * Verificarea se citește DOAR din `verification_level`, niciodată din
 * `trust_score`. Scorul e de acum un scor de completitudine (v3): un anunț bine
 * completat ajunge singur la 80 din 100 fără ca nimeni din afară să fi confirmat
 * ceva. Cu vechiul prag de 40 pe scor, oricine umplea formularul își acorda
 * singur insigna „Verificat" — exact minciuna pe care listingSanity a fost
 * scris să o oprească.
 */
export function PropertyBadgeRow({ property, planId, size = "md", lang = "ro", className, max, reserve = false }) {
  const boosted = property?.boost_active || property?.featured;
  // Un anunț implauzibil (preț de sute de mii, o cameră pe 345 mp) nu are voie
  // să poarte „Verificat", oricât de mare i-ar fi scorul din date.
  const verified =
    !isImplausible(property) &&
    !!property?.verification_level &&
    property.verification_level !== "unverified";
  // Planul stă denormalizat pe anunț (Property.poster_plan, scris server-side)
  // și anunțurile se citesc de oricine, deci fiecare card îl are fără să mai
  // ceară nimic. `planId` rămâne pentru cine îl rezolvă deja singur (rândurile
  // pe plan de pe prima pagină).
  const resolved = planId || property?.poster_plan || null;
  const plan = resolved && KINDS[resolved] ? resolved : null;

  // Ordinea cerută de client: întâi că e promovat, apoi pe ce plan e
  // proprietarul, apoi verificarea.
  //
  // A DOUA PASTILĂ E PLANUL, MEREU. Până acum `seller_role === "Agent"` — o
  // căsuță pe care și-o bifează singur cine publică — câștiga înaintea planului
  // plătit, așa că un anunț stătea în rândul „Basic" purtând insigna „Agent":
  // rândul spunea una, insigna alta, pe același card. Meseria declarată nu e
  // același lucru cu abonamentul, și doar abonamentul sortează rândurile.
  // Rolul rămâne scris sub numele omului, în banda de contact a cardului mare.
  const kinds = [];
  if (boosted) kinds.push("promovat");
  kinds.push(plan || "free");
  if (verified) kinds.push("verificat");

  // Două pastile scrise, și atât. A treia încercase să încapă ca iconiță de
  // 20px și ieșea un cerc verde fără cuvânt lângă două pastile scrise — arată
  // ca o greșeală, nu ca o insignă. Ordinea de mai sus decide cine rămâne:
  // promovat și planul, exact perechea cerută de client.
  const cap = max ?? (size === "xs" ? 3 : 2);
  const shown = kinds.slice(0, cap);

  // `reserve` ține rândul deschis și când nu e nicio insignă. Întedărăt un card
  // cu „Promovat" era mai înalt decât vecinii lui și împingea prețul și tot ce
  // urmează cu un rând mai jos — trei carduri alături, trei linii de bază
  // diferite. Locul se păstrează acum indiferent de ce are anunțul.
  if (!shown.length) {
    return reserve
      ? <div aria-hidden="true" className={cn(ROW_H[size], className)} />
      : null;
  }

  return (
    <div className={cn("pointer-events-none flex flex-nowrap items-center gap-1.5", ROW_H[size], className)}>
      {shown.map((kind) => (
        <PropertyBadge key={kind} kind={kind} size={size} lang={lang} />
      ))}
    </div>
  );
}

export default PropertyBadge;
