import React from "react";
import AppleIcon from "@/components/AppleIcon";
import GooglePlayIcon from "@/components/GooglePlayIcon";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import { cn } from "@/lib/utils";

// Butoanele de magazin.
//
// Cât timp URL-urile din @/lib/appLinks sunt `null`, aplicația nu există în
// niciun magazin, deci NU desenăm un link: desenăm aceeași formă, stinsă și
// marcată „În curând". Un buton care arată apăsabil și nu duce nicăieri e mai
// rău decât unul care spune cinstit că mai are de așteptat.
//
// Insignele oficiale Apple / Google au reguli stricte de folosire și nu se
// redesenează. Când aplicația ajunge în magazine se pun fișierele oficiale în
// public/images/stores/ și se completează URL-urile — abia atunci componenta
// arată insigna adevărată, în locul formei de mai jos.

const STORES = [
  { key: "apple", href: APP_STORE_URL, Icon: AppleIcon, top: "Descarcă din", name: "App Store", topEn: "Download on the" },
  { key: "play", href: PLAY_STORE_URL, Icon: GooglePlayIcon, top: "Disponibil pe", name: "Google Play", topEn: "Get it on" },
];

function Shell({ store, en, tone, soon, asLink }) {
  const { Icon, name, top, topEn } = store;

  // Două tonuri, pentru cele două fundaluri pe care stau butoanele: `ink` pe
  // secțiunile închise, `paper` pe corpul deschis al paginii.
  const skin =
    tone === "ink"
      ? "border-white/25 bg-white/10 text-white"
      : "border-border bg-foreground text-background";

  return (
    <span
      className={cn(
        "flex min-h-[52px] items-center gap-3 rounded-xl border px-4",
        skin,
        asLink
          ? "transition-transform duration-300 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]"
          : "cursor-default opacity-45"
      )}
    >
      <Icon className="h-6 w-6 shrink-0" />
      <span className="min-w-0 text-left leading-none">
        <span className="block text-[10px] font-medium opacity-80">
          {asLink ? (en ? topEn : top) : soon}
        </span>
        <span className="mt-1 block text-[15px] font-bold tracking-tight">{name}</span>
      </span>
    </span>
  );
}

export default function StoreBadges({ className, en = false, tone = "paper" }) {
  const soon = en ? "Coming soon" : "În curând";

  return (
    <ul className={cn("flex flex-wrap items-center gap-3", className)}>
      {STORES.map((store) => (
        <li key={store.key}>
          {store.href ? (
            <a
              href={store.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${en ? store.topEn : store.top} ${store.name}`}
              className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald"
            >
              <Shell store={store} en={en} tone={tone} soon={soon} asLink />
            </a>
          ) : (
            // Fără rol de imagine, un <span> se mapează la `generic`, care nu
            // acceptă nume accesibil — aria-label ar fi pur și simplu ignorat.
            <span role="img" aria-label={`${store.name} — ${soon}`} className="inline-flex">
              <Shell store={store} en={en} tone={tone} soon={soon} asLink={false} />
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
