import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useCountry } from "@/components/CountryContext";

// „De ce VerifiCasa" — nouă motive. Erau nouă cutii într-o grilă 3×3: tot
// blocul se citea dintr-o privire, ocupa o treime de ecran și nu scotea nimic
// în față. Acum e o singură bandă care se plimbă singură, la orice lățime, iar
// motivul din mijlocul benzii e cel scos în evidență — pe rând, la nesfârșit.
//
// Banda se mișcă pe `setInterval`, nu pe requestAnimationFrame: temporizatoarele
// merg și când bufferul de cadre e sugrumat (tab în fundal, iframe-ul din
// editorul Base44), iar dacă totuși nu merge nimic, banda rămâne pur și simplu
// pe loc — vizibilă, nu goală.
const ITEMS = [
  { key: "vp2", img: "/images/generated/icon-shield-check.png", cap: { ro: "Poze, acte și preț, verificate", en: "Photos, papers and price, checked" } },
  { key: "vp4", img: "/images/generated/icon-document-check.png", cap: { ro: "Măsurători și acte, la dosar", en: "Measurements and papers on file" } },
  { key: "vp8", img: "/images/generated/icon-percent-badge.png", cap: { ro: "Comparat cu piața locală", en: "Compared with the local market" } },
  { key: "vp1", img: "/images/generated/icon-video.png", cap: { ro: "Vezi locuința din telefon", en: "Walk it from your phone" } },
  { key: "vp3", img: "/images/generated/icon-coins.png", cap: { ro: "Fără taxe ascunse", en: "No hidden fees" } },
  { key: "vp7", img: "/images/generated/icon-clock.png", cap: { ro: "Vezi totul înainte de drum", en: "See it all before you go" } },
  { key: "vp5", img: "/images/generated/icon-users-check.png", cap: { ro: "Doar cereri serioase", en: "Serious requests only" } },
  { key: "vp6", img: "/images/generated/icon-flag.png", cap: { ro: "Semnalezi, verificăm direct", en: "You flag it, we check it" } },
  { key: "vp9", img: "/images/generated/icon-chat.png", cap: { ro: "Experiențe reale, nefiltrate", en: "Real, unfiltered experiences" } },
];

function Chip({ item, t, en, ariaHidden }) {
  return (
    <div
      data-spot="off"
      aria-hidden={ariaHidden || undefined}
      className="group flex w-[214px] shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-sm transition-[transform,box-shadow,border-color,background-color] duration-500 ease-out data-[spot=on]:-translate-y-1 data-[spot=on]:border-emerald/50 data-[spot=on]:bg-emerald/[0.06] data-[spot=on]:shadow-[0_14px_30px_-14px_rgba(16,24,40,0.4)] sm:w-[248px]"
    >
      <img
        src={item.img}
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 object-contain opacity-70 drop-shadow-sm transition-[opacity,transform] duration-500 ease-out group-data-[spot=on]:scale-110 group-data-[spot=on]:opacity-100 sm:h-10 sm:w-10"
        loading="lazy"
      />
      <div className="min-w-0">
        <p className="truncate text-[12.5px] font-bold leading-tight text-foreground sm:text-[13.5px]">
          {t(`${item.key}_t`)}
        </p>
        <p className="mt-0.5 truncate text-[10.5px] leading-tight text-muted-foreground sm:text-[11.5px]">
          {en ? item.cap.en : item.cap.ro}
        </p>
      </div>
    </div>
  );
}

export default function ValueProps() {
  const { t, lang } = useCountry();
  const en = lang === "en";
  const reduced = useReducedMotion();
  const railRef = useRef(null);
  // Pauza stă într-un ref, nu în state: dacă ar fi state, fiecare atingere ar
  // reporni efectul, iar un `mouseenter` rămas agățat ar opri banda definitiv.
  const pausedRef = useRef(false);

  useEffect(() => {
    if (reduced) return undefined;
    const rail = railRef.current;
    if (!rail) return undefined;

    const TICK = 40;   // ms
    const SPEED = 30;  // px pe secundă — lent, nu distrage de la conținut
    let carry = 0;     // scrollLeft e întreg; acumulăm subunitățile

    // Reflectorul: cardul a cărui/cărei margine e cea mai apropiată de centru.
    //
    // Întâi se citește geometria, abia apoi se scrie `data-spot` — și numai
    // acolo unde valoarea chiar se schimbă. Varianta veche stingea fiecare
    // placă în aceeași buclă în care citea `offsetLeft`, inclusiv pe cea
    // câștigătoare. Citirea lui `offsetLeft` forțează recalculul stilului, așa
    // că placă aprinsă apuca să pornească drumul înapoi în jos, iar `on`-ul
    // de după buclă repornea tranziția din poziția aia. La fiecare 40 ms.
    // Cu un arc cu depășire, asta se vede exact ca un tremurat.
    const spotlight = () => {
      const kids = rail.children;
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let best = null;
      let bestDist = Infinity;
      for (const chip of kids) {
        const dist = Math.abs(chip.offsetLeft + chip.offsetWidth / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = chip;
        }
      }
      for (const chip of kids) {
        const want = chip === best ? "on" : "off";
        if (chip.dataset.spot !== want) chip.dataset.spot = want;
      }
    };

    const id = setInterval(() => {
      if (!pausedRef.current) {
        const half = rail.scrollWidth / 2;
        if (half > 0) {
          carry += (SPEED * TICK) / 1000;
          if (carry >= 1) {
            const whole = Math.floor(carry);
            carry -= whole;
            const next = rail.scrollLeft + whole;
            rail.scrollLeft = next >= half ? next - half : next;
          }
        }
      }
      spotlight();
    }, TICK);

    return () => clearInterval(id);
  }, [reduced]);

  // Atingerea sau cursorul opresc banda cât timp omul se uită la un card.
  const hold = () => { pausedRef.current = true; };
  const release = () => {
    // scurt răgaz după ce ridici degetul, ca inerția de scroll să se stingă
    setTimeout(() => { pausedRef.current = false; }, 900);
  };

  return (
    <section className="py-7 sm:py-10">
      <h2 className="mx-auto max-w-7xl px-4 text-xl font-bold text-foreground sm:px-6 sm:text-3xl lg:px-8">
        {en ? "Why VerifiCasa" : "De ce VerifiCasa"}
      </h2>

      {/* Banda taie pagina dintr-o margine în alta, cu capetele stinse — se
          vede că mai e ceva dincolo de ecran, fără să apară o tăietură seacă. */}
      <div
        className="relative mt-4 sm:mt-6"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 clamp(1.25rem, 6vw, 4.5rem), #000 calc(100% - clamp(1.25rem, 6vw, 4.5rem)), transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 clamp(1.25rem, 6vw, 4.5rem), #000 calc(100% - clamp(1.25rem, 6vw, 4.5rem)), transparent)",
        }}
      >
        <div
          ref={railRef}
          onPointerDown={hold}
          onPointerUp={release}
          onPointerCancel={release}
          onMouseEnter={hold}
          onMouseLeave={release}
          onTouchStart={hold}
          onTouchEnd={release}
          className="vc-rail flex gap-3 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8"
        >
          {ITEMS.map((item) => (
            <Chip key={item.key} item={item} t={t} en={en} />
          ))}
          {/* Copia care face bucla continuă. */}
          {ITEMS.map((item) => (
            <Chip key={`loop-${item.key}`} item={item} t={t} en={en} ariaHidden />
          ))}
        </div>
      </div>
    </section>
  );
}
