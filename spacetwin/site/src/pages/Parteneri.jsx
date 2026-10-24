import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { useCountry } from "@/components/CountryContext";
import { PARTNERS } from "@/lib/partners";

// Pagina de parteneri, în aceeași limbă vizuală ca pagina de planuri: card
// lucios cu ramă rotunjită, logo-ul partenerului într-o casetă albă (verdele
// lor nu se bate cu al nostru), oferta ca titlu mare și codul într-o pastilă
// cu buton de copiere. Fără paragrafe: partenerul se vinde prin ofertă.

// partners.js are deocamdată copy doar în română. Până capătă câmpuri EN,
// varianta engleză a taglinei stă aici, pe id de partener.
const TAGLINE_EN = {
  "residence-vertical": "Independent property checks, 100% online",
};

// Reducerea e scrisă în română în date („10% reducere"). Scoatem procentul și
// îl reetichetăm în limba interfeței, ca să nu rămână română în modul EN.
function offerLabel(partner, en) {
  const pct = /(\d+)\s*%/.exec(partner.discount || "");
  if (pct) return en ? `${pct[1]}% off` : `${pct[1]}% reducere`;
  return partner.discount || "";
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function PartnerCard({ partner, en }) {
  const [copied, setCopied] = useState(false);
  const host = hostOf(partner.url);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(partner.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-ul poate fi blocat de browser; codul rămâne oricum pe ecran.
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Logo, pe o tentă verde moale */}
      <div className="flex items-center justify-center bg-emerald/10 px-5 py-6 dark:bg-emerald/15 sm:py-8">
        {/* PNG transparent, tuș verde-închis — nu are nevoie de casetă albă. */}
        <img
          src={partner.logo}
          alt={partner.name}
          className="h-16 w-auto max-w-[240px] object-contain dark:hidden"
          loading="lazy"
        />
        <img
          src={partner.logoLight || partner.logo}
          alt={partner.name}
          className="hidden h-16 w-auto max-w-[240px] object-contain dark:block"
          loading="lazy"
        />
      </div>

      <div className="p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">{partner.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {en ? TAGLINE_EN[partner.id] || partner.tagline : partner.tagline}
        </p>

        {/* Oferta — linia mare a cardului */}
        <div className="mt-5 flex items-center gap-3">
          <img
            src="/images/generated/icon-percent-badge.png"
            alt=""
            aria-hidden="true"
            className="h-12 w-12 shrink-0 object-contain drop-shadow"
          />
          <p className="font-heading text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {offerLabel(partner, en)}
            <span className="block text-sm font-semibold text-muted-foreground sm:text-base">
              {en ? "with the VerifiCasa code" : "cu codul VerifiCasa"}
            </span>
          </p>
        </div>

        {/* Codul + copiere */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-[32px] items-center rounded-full bg-emerald/10 px-4 py-1 text-base font-bold tracking-wide text-emerald">
            {partner.code}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="tap-44 inline-flex min-h-[36px] items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-emerald hover:text-emerald"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? (en ? "Copied" : "Copiat") : en ? "Copy" : "Copiază"}
          </button>
        </div>

        <a
          href={partner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-emerald/70 bg-gradient-to-t from-emerald to-emerald/85 px-6 text-base font-semibold text-white shadow-lg shadow-emerald/40 transition active:scale-[0.99] sm:inline-flex sm:w-auto"
        >
          {en ? `Check on ${host}` : `Verifică pe ${host}`}
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}

export default function Parteneri() {
  const { lang } = useCountry();
  const en = lang === "en";

  return (
    <div className="relative overflow-hidden">
      {/* Aceeași semnătură ca pagina de planuri: o aură verde în spatele titlului */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[8%] top-0 z-0 h-[380px] bg-[image:radial-gradient(circle_at_50%_0%,hsl(var(--emerald))_0%,transparent_70%)] opacity-10 dark:opacity-20"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <Reveal className="text-center">
          <img
            src="/images/generated/icon-handshake.png"
            alt=""
            aria-hidden="true"
            className="mx-auto h-16 w-16 object-contain drop-shadow"
          />
          <h1 className="mt-3 font-heading text-3xl font-bold text-foreground sm:text-4xl">
            {en ? "Partners" : "Parteneri"}
          </h1>
          <p className="mx-auto mt-2 max-w-[42ch] text-sm text-muted-foreground sm:text-base">
            {en
              ? "Check any property independently — and pay less with our code."
              : "Verifică orice proprietate independent — și plătești mai puțin cu codul nostru."}
          </p>
        </Reveal>

        <div className="mt-8 space-y-6">
          {PARTNERS.map((p, i) => (
            <Reveal key={p.id} delay={i * 0.08}>
              <PartnerCard partner={p} en={en} />
            </Reveal>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {en
            ? "Partners are independent services. The discount applies on their own site."
            : "Partenerii sunt servicii independente. Reducerea se aplică pe site-ul lor."}
        </p>
      </div>
    </div>
  );
}
