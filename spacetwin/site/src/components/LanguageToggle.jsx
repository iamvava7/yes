import React from "react";
import { FlagRO, FlagGB } from "@/components/FlagCircle";
import { useCountry } from "@/components/CountryContext";
import { cn } from "@/lib/utils";

// Comutator RO/EN de sine stătător, pentru paginile care NU folosesc chenarul
// principal al aplicației — formularul de publicare își desenează propriul
// antet, deci selectorul de limbă din Header nu ajunge acolo și omul rămâne
// blocat în română fără niciun buton la vedere.
//
// Aici sunt două steaguri, nu meniul combinat monedă+limbă din Header: pe un
// formular, moneda se alege în câmpul de preț, nu în antet.
//
// `variant="bare"` scoate pastila și steagurile și lasă doar RO / EN scris. Pe
// paginile de autentificare comutatorul stă peste fotografie, lângă siglă: cu
// pastila albă și două steaguri colorate, alegerea limbii era obiectul cel mai
// zgomotos de pe ecran, mai tare decât marca. E o unealtă, deci se scrie, nu se
// îmbracă.
export default function LanguageToggle({ className, variant = "pill" }) {
  const { lang, setLang } = useCountry();

  const opts = [
    { code: "ro", label: "Română", short: "RO", Flag: FlagRO },
    { code: "en", label: "English", short: "EN", Flag: FlagGB },
  ];

  if (variant === "bare") {
    return (
      <div className={cn("flex items-center text-xs font-bold tracking-wide", className)} role="group" aria-label="Limbă / Language">
        {opts.map(({ code, label, short }, i) => (
          <React.Fragment key={code}>
            {i > 0 && <span className="px-1 text-white/30" aria-hidden="true">/</span>}
            <button
              type="button"
              onClick={() => setLang(code)}
              aria-label={label}
              aria-pressed={lang === code}
              className={cn(
                "tap-44 transition-colors",
                lang === code ? "text-white" : "text-white/55 hover:text-white/85"
              )}
            >
              {short}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-0.5 rounded-full border border-border bg-background p-0.5", className)}
      role="group"
      aria-label="Limbă / Language"
    >
      {opts.map(({ code, label, short, Flag }) => {
        const active = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-colors",
              active
                ? "bg-emerald text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Flag className="h-4 w-4 shrink-0" />
            {short}
          </button>
        );
      })}
    </div>
  );
}
