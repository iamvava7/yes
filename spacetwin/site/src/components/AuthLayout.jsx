import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerifiCasaLogo from "@/components/VerifiCasaLogo";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";

// Single shell for every auth page: login/register, forgot password, reset
// password and OAuth consent. One architecture, so the page does not change
// shape when a user clicks through from sign in to "Ai uitat parola?".
//
// A full-bleed photograph sits behind an ink scrim and a pane of dark glass.
// The photos are viewings across the country, and each one names where it is in
// mono at the foot of the frame — the background states the claim the product
// makes, instead of just setting a mood, so the card lets it through instead of
// covering it.
//
// The glass is DARK, and that is the whole trick. The card was tried at 60% of
// the cream surface and it composited to mud: cream over a navy scrim lands on
// a flat grey around #AEABA7, where the fields, the idle tab and the card all
// sit within a few points of each other and the whole form reads as disabled.
// Carrying `dark` on the card re-points every token underneath it — ink becomes
// cream, the surfaces go night — so one class buys a translucent pane that the
// photograph shows through and that every child still styles itself against.
//
// The card is sized for a phone, not for a laptop window shrunk down: measured
// at 375x812, sign in lands around 460px tall and sign up around 680px, both
// inside the 691px a phone actually shows.
//
// NOTE: the `icon` prop is still accepted by callers but no longer rendered;
// the wordmark carries the branding instead of a decorative lucide medallion.

const SHOTS = [
  { src: "/images/auth/bucuresti-v2.webp", place: "București", area: "Cotroceni" },
  { src: "/images/auth/cluj-v2.webp", place: "Cluj-Napoca", area: "Mărăști" },
  { src: "/images/auth/brasov-v2.webp", place: "Brașov", area: "Schei" },
  { src: "/images/auth/constanta-v2.webp", place: "Constanța", area: "Faleză Nord" },
  { src: "/images/auth/timisoara-v2.webp", place: "Timișoara", area: "Cetate" },
];

const HOLD_MS = 8000;

// Every shot is inside the viewport, so loading="lazy" would not defer anything.
// Only the first one is mounted until the page has finished loading; the other
// four are added afterwards and so stay off the critical path.
function useBackground() {
  const [index, setIndex] = useState(0);
  const [mountRest, setMountRest] = useState(false);

  useEffect(() => {
    const start = () => setMountRest(true);
    if (document.readyState === "complete") {
      const id = setTimeout(start, 200);
      return () => clearTimeout(id);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  useEffect(() => {
    if (!mountRest) return; // nothing to cross-fade to yet
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // hold frame one
    const id = setInterval(() => setIndex((i) => (i + 1) % SHOTS.length), HOLD_MS);
    return () => clearInterval(id);
  }, [mountRest]);

  return { index, mountRest };
}

export default function AuthLayout({ title, subtitle, footer, children }) {
  const { index, mountRest } = useBackground();
  const shot = SHOTS[index];

  return (
    <div className="relative min-h-screen-safe w-full overflow-hidden bg-background">
      {/* Photographs. The first paints immediately, the rest arrive after it. */}
      <div className="absolute inset-0" aria-hidden="true">
        {SHOTS.map((s, i) =>
          i === 0 || mountRest ? (
            <img
              key={s.src}
              src={s.src}
              alt=""
              decoding="async"
              // React 18 passes lowercase unknown attributes straight through;
              // the camelCase `fetchPriority` the lint rule wants is React 19+
              // and warns at runtime here. Keep the DOM spelling.
              // eslint-disable-next-line react/no-unknown-property
              fetchpriority={i === 0 ? "high" : "low"}
              className={`auth-shot absolute inset-0 h-full w-full object-cover ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : null
        )}
        {/* Ziua și noaptea se văd AICI. Cardul nu poate răspunde temei — rămâne
            întunecat în ambele, altfel tuporul cald peste fotografie nu se mai
            citește — deci comutatorul părea stricat: apăsai și nu se schimba
            nimic. Perdeaua de peste fotografie se subțiază ziua și se îngroașă
            noaptea, deci se vede imediat ce-ai apăsat, iar poza rămâne poză. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--navy-deep)/0.26)_0%,hsl(var(--navy-deep)/0.50)_100%)] dark:bg-[linear-gradient(180deg,hsl(var(--navy-deep)/0.54)_0%,hsl(var(--navy-deep)/0.76)_100%)]" />
        {/* Marca și comenzile stau direct pe fotografie, iar prima imagine are o
            fereastră luminoasă exact sub ele. Fără puțin pământ sub rândul de
            sus, albul se pierde în geam. */}
        <div className="absolute inset-x-0 top-0 h-[calc(env(safe-area-inset-top)+6rem)] bg-gradient-to-b from-black/45 to-transparent" />
      </div>

      {/* Un singur rând sus: sigla în stânga, limba și tema în dreapta.
          Paginile de autentificare nu trec prin Layout, deci nu au Header — iar
          fără el nu exista niciun buton de limbă sau de zi/noapte pe primul
          ecran pe care îl vede cineva.
          Sigla stătea centrată deasupra cardului, în aceeași coloană cu el. Cât
          timp formularul încăpea pe ecran, coloana îl centra și sigla rămânea
          sub comenzi. Când nu încăpea — cont nou, pe un ecran scund — coloana
          nu mai avea ce centra, sigla urca în rândul comenzilor și pastila de
          limbă se așeza direct peste ea. Acum sunt în același rând, deci nu au
          cum să se mai suprapună, iar coloana de dedesubt îi rezervă locul. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6 sm:pb-5 sm:pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <Link to="/" className="tap-44 flex items-center">
          <VerifiCasaLogo size={44} tone="light" tagline={false} />
        </Link>
        <div className="flex items-center gap-3">
          <LanguageToggle variant="bare" />
          <ThemeToggle className="h-8 w-8 justify-center border-transparent bg-transparent px-0 text-white/60 hover:border-transparent hover:bg-transparent hover:text-white" />
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex min-h-screen-safe flex-col items-center justify-center px-4 pb-[calc(var(--cookie-banner-h,0px)+env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+4rem)] sm:pt-[calc(env(safe-area-inset-top)+7rem)]">
        <div className="dark w-full max-w-[19.5rem] rounded border border-white/15 bg-card/30 px-4 py-3 shadow-[0_26px_60px_-26px_rgba(0,0,0,0.75)] backdrop-blur-[3px] backdrop-brightness-[0.42] sm:max-w-[22rem] sm:p-6"
          // Cu geamul atât de subțire, cel mai luminos petic de fotografie ajunge
          // sub text — iar cenușiul de noapte pentru text secundar pică sub prag
          // acolo. Se ridică tokenul o dată, pe card, nu clasă cu clasă.
          style={{ "--muted-foreground": "44 14% 78%" }}
        >
          <h1 className="font-heading text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-sm">{subtitle}</p>
          )}

          <div className="mt-2.5 sm:mt-5">{children}</div>
        </div>

        {footer && <div className="mt-3 text-center text-[13px] text-white/85 sm:mt-5 sm:text-sm">{footer}</div>}
      </div>

      {/* The location of the shot currently on screen. */}
      <p className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-4 z-10 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60 sm:left-5 sm:text-[11px]">
        {shot.place} <span className="text-white/35">·</span> {shot.area}
      </p>
    </div>
  );
}
