import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { useCountry } from "@/components/CountryContext";
import { PARTNERS } from "@/lib/partners";

// „Nu ne crezi pe cuvânt?" — caseta partenerului, sub Contactează & Programează.
// Aceeași formă ca pe /parteneri, doar la scara barei laterale: logo în ramă
// albă pe tentă verde, oferta ca linie mare, codul într-o pastilă cu copiere.
export default function PartnerBox({ partnerId = "residence-vertical", className = "" }) {
  const { lang } = useCountry();
  const [copied, setCopied] = useState(false);
  const en = lang === "en";
  const partner = PARTNERS.find((p) => p.id === partnerId);
  if (!partner) return null;

  const pct = /(\d+)\s*%/.exec(partner.discount || "");
  const offer = pct ? (en ? `${pct[1]}% off` : `${pct[1]}% reducere`) : partner.discount || "";

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
    <Reveal className={className}>
      <aside className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3.5 bg-emerald/10 px-4 py-4 dark:bg-emerald/15">
          {/* Logo-ul e PNG cu fundal transparent și tuș verde-închis, deci stă
              direct pe tentă. Caseta albă din spate era o cutie în plus, care
              rupea banda verde în două. */}
          <img
            src={partner.logo}
            alt={partner.name}
            className="h-10 w-auto max-w-[104px] shrink-0 object-contain dark:hidden"
            loading="lazy"
          />
          <img
            src={partner.logoLight || partner.logo}
            alt={partner.name}
            className="hidden h-10 w-auto max-w-[104px] shrink-0 object-contain dark:block"
            loading="lazy"
          />
          <div className="min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground">
              {en ? "Don't take our word for it" : "Nu ne crezi pe cuvânt?"}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {en ? "Check it independently" : "Verifică independent"}
            </p>
          </div>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            {en
              ? `Developer, seismic risk and building permits — checked by ${partner.name}.`
              : `Dezvoltator, risc seismic și autorizații — verificate de ${partner.name}.`}
          </p>

          <div className="mt-4 flex items-center gap-2.5">
            <img
              src="/images/generated/icon-percent-badge.png"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 shrink-0 object-contain drop-shadow"
            />
            <p className="font-heading text-xl font-bold leading-tight text-foreground">
              {offer}
              <span className="block text-xs font-semibold text-muted-foreground">
                {en ? "with the code below" : "cu codul de mai jos"}
              </span>
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-[32px] items-center rounded-full bg-emerald/10 px-3.5 py-1 text-sm font-bold tracking-wide text-emerald">
              {partner.code}
            </span>
            <button
              type="button"
              onClick={copyCode}
              className="tap-44 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm font-semibold text-foreground transition-colors hover:border-emerald hover:text-emerald"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? (en ? "Copied" : "Copiat") : en ? "Copy" : "Copiază"}
            </button>
          </div>

          <a
            href={partner.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full border border-emerald/70 bg-gradient-to-t from-emerald to-emerald/85 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald/40 transition active:scale-[0.99]"
          >
            <span className="text-white/80">{en ? "Check on" : "Verifică pe"}</span>
            {/* Varianta albă a logo-ului, direct pe verde — fără casetă. */}
            <img
              src={partner.logoLight || partner.logo}
              alt={partner.name}
              className="h-7 w-auto max-w-[110px] object-contain"
            />
            <span aria-hidden="true">↗</span>
          </a>

          <Link
            to="/parteneri"
            className="mt-1 tap-44 flex items-center justify-center gap-1 py-1 text-xs font-semibold text-emerald transition-colors hover:text-foreground"
          >
            {en ? "All partners" : "Toți partenerii"} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </aside>
    </Reveal>
  );
}
