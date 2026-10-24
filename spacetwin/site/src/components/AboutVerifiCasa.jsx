import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { useCountry } from "@/components/CountryContext";
import { Reveal } from "@/components/ui/reveal";

// Despre — un titlu, un link și cele cinci publicuri.
//
// Erau cinci plăcuțe într-o grilă care stătea nemișcată: pe telefon, două
// coloane și un rând orfan la final. Acum e aceeași bandă care se plimbă
// singură ca la „De ce VerifiCasa", cu publicul din mijlocul benzii scos în
// evidență pe rând — dar cu un arc mai vioi: curba are depășire (0.34, 1.56),
// așa că plăcuța sare puțin peste poziția finală și revine, iar iconița se
// ridică odată cu ea. Aceeași mecanică, mai multă viață.
//
// Ca și acolo, banda merge pe `setInterval`, nu pe requestAnimationFrame:
// temporizatoarele merg și când bufferul de cadre e sugrumat (tab în fundal,
// iframe-ul din editorul Base44), iar dacă totuși nu merge nimic banda rămâne
// pe loc — vizibilă, nu goală.

const BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
// Cinci publicuri umplu mai puțin decât nouă motive, deci banda are nevoie de
// mai multe copii ca bucla să nu se termine înainte de marginea ecranului.
const COPIES = 4;

function Tile({ item, ariaHidden }) {
  return (
    <div
      data-spot="off"
      aria-hidden={ariaHidden || undefined}
      className="group flex w-[168px] shrink-0 items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-3 shadow-sm transition-[transform,box-shadow,border-color,background-color] data-[spot=on]:-translate-y-1.5 data-[spot=on]:border-emerald/60 data-[spot=on]:bg-emerald/[0.07] data-[spot=on]:shadow-[0_16px_34px_-16px_rgba(16,24,40,0.45)] sm:w-[190px] sm:px-4 sm:py-3.5"
      style={{ transitionTimingFunction: BOUNCE, transitionDuration: "420ms" }}
    >
      <img
        src={item.img}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 object-contain transition-transform group-data-[spot=on]:scale-125 sm:h-11 sm:w-11"
        style={{ transitionTimingFunction: BOUNCE, transitionDuration: "420ms" }}
        loading="lazy"
      />
      <p className="truncate text-[13px] font-bold leading-tight text-foreground sm:text-sm">
        {item.label}
      </p>
    </div>
  );
}

export default function AboutVerifiCasa() {
  const { lang } = useCountry();
  const en = lang === "en";
  const reduced = useReducedMotion();
  const railRef = useRef(null);
  // Pauza stă într-un ref, nu în state: dacă ar fi state, fiecare atingere ar
  // reporni efectul, iar un `mouseenter` rămas agățat ar opri banda definitiv.
  const pausedRef = useRef(false);

  const audience = [
    { label: en ? "Owners" : "Proprietari", img: "/images/generated/icon-proprietari.png" },
    { label: en ? "Tenants" : "Chiriași", img: "/images/generated/icon-chiriasi.png" },
    { label: en ? "Managers" : "Administratori", img: "/images/generated/icon-administratori.png" },
    { label: en ? "Buyers" : "Cumpărători", img: "/images/generated/icon-cumparatori.png" },
    { label: en ? "Agents" : "Agenți", img: "/images/generated/icon-agenti.png" },
  ];

  useEffect(() => {
    if (reduced) return undefined;
    const rail = railRef.current;
    if (!rail) return undefined;

    const TICK = 40;  // ms
    const SPEED = 34; // px pe secundă — un pic peste banda de motive
    let carry = 0;    // scrollLeft e întreg; acumulăm subunitățile

    // Reflectorul: plăcuța a cărui/cărei margine e cea mai apropiată de centru.
    //
    // Întâi se citește geometria, abia apoi se scrie `data-spot` — și numai
    // acolo unde valoarea chiar se schimbă. Varianta veche stingea fiecare
    // plăcuța în aceeași buclă în care citea `offsetLeft`, inclusiv pe cea
    // câștigătoare. Citirea lui `offsetLeft` forțează recalculul stilului, așa
    // că plăcuța aprinsă apuca să pornească drumul înapoi în jos, iar `on`-ul
    // de după buclă repornea tranziția din poziția aia. La fiecare 40 ms.
    // Cu un arc cu depășire, asta se vede exact ca un tremurat.
    const spotlight = () => {
      const kids = rail.children;
      const mid = rail.scrollLeft + rail.clientWidth / 2;
      let best = null;
      let bestDist = Infinity;
      for (const tile of kids) {
        const dist = Math.abs(tile.offsetLeft + tile.offsetWidth / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = tile;
        }
      }
      for (const tile of kids) {
        const want = tile === best ? "on" : "off";
        if (tile.dataset.spot !== want) tile.dataset.spot = want;
      }
    };

    const perSet = audience.length;

    // Lungimea unei serii se măsoară din poziția reală a plăcuțelor, NU ca
    // scrollWidth/COPIES: scrollWidth include și padding-ul orizontal al benzii
    // și îi lipsește spațiul de după ultima plăcuță, așa că împărțirea dă cu
    // câțiva pixeli peste pasul adevărat. Diferența se adună la fiecare buclă
    // și se vede ca o smucitură. Cu offsetLeft, bucla e exactă.
    const strideOf = () => {
      const kids = rail.children;
      if (kids.length > perSet) {
        const d = kids[perSet].offsetLeft - kids[0].offsetLeft;
        if (d > 0) return d;
      }
      return rail.scrollWidth / COPIES;
    };

    const id = setInterval(() => {
      if (!pausedRef.current) {
        const oneSet = strideOf();
        if (oneSet > 0) {
          carry += (SPEED * TICK) / 1000;
          if (carry >= 1) {
            const whole = Math.floor(carry);
            carry -= whole;
            const next = rail.scrollLeft + whole;
            rail.scrollLeft = next >= oneSet ? next - oneSet : next;
          }
        }
      }
      spotlight();
    }, TICK);

    return () => clearInterval(id);
  }, [reduced]);

  // Atingerea sau cursorul opresc banda cât timp omul se uită la o plăcuță.
  const hold = () => { pausedRef.current = true; };
  const release = () => {
    // scurt răgaz după ce ridici degetul, ca inerția de scroll să se stingă
    setTimeout(() => { pausedRef.current = false; }, 900);
  };

  return (
    <section className="py-8 sm:py-12">
      <Reveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="max-w-[18ch] text-2xl font-bold leading-tight text-foreground sm:text-4xl">
          {en ? "Verified before it goes live." : "Verificat înainte de publicare."}
        </h2>
        <Link
          to="/about"
          className="mt-3 tap-44 inline-flex items-center text-sm font-bold text-emerald transition-transform hover:translate-x-0.5"
        >
          {en ? "How it works" : "Cum funcționează"}
          <span className="ml-1" aria-hidden="true">→</span>
        </Link>
      </Reveal>

      {/* Banda taie pagina dintr-o margine în alta, cu capetele stinse — se
          vede că mai e ceva dincolo de ecran, fără să apară o tăietură seacă. */}
      <div
        className="relative mt-5 sm:mt-7"
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
          className="vc-rail flex gap-3 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8"
        >
          {Array.from({ length: COPIES }).flatMap((_, c) =>
            audience.map((item) => (
              <Tile key={`${c}-${item.label}`} item={item} ariaHidden={c > 0} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
