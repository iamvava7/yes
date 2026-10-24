import React from "react";
import { Instagram, Mail } from "lucide-react";
import AppleIcon from "@/components/AppleIcon";
import GooglePlayIcon from "@/components/GooglePlayIcon";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/appLinks";
import { cn } from "@/lib/utils";

// Rândul de contact din subsol, ca iconițe în loc de text: Instagram, TikTok,
// Email, App Store, Google Play. Fiecare e o țintă rotundă de 44px — se poate
// apăsa cu degetul — și fiecare are culoarea brandului ei la hover/apăsare,
// nu un verde uniform care le-ar face imposibil de deosebit dintr-o privire.
//
// Animația e pe o curbă cu depășire (0.34, 1.56, 0.64, 1): iconița sare puțin
// peste poziția finală și revine. Pe CSS, nu pe framer-motion — subsolul nu
// merită un runtime de animație, iar așa merge și când bufferul de cadre e
// sugrumat (vezi comentariul din ui/reveal.jsx).

// URL-urile magazinelor stau în @/lib/appLinks — același loc din care le
// citesc pasul 5 din formular și pagina Tur 3D. Cât timp sunt `null`, cele
// două iconițe se văd stinse, marcate „În curând"; niciodată un link mort
// către un magazin unde aplicația încă nu există.

function TikTokIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.24-2.5v-3.1a5.68 5.68 0 0 0-.65-.04A5.68 5.68 0 0 0 4.18 15.3 5.68 5.68 0 0 0 9.86 21a5.68 5.68 0 0 0 5.68-5.68V9.01a7.35 7.35 0 0 0 4.28 1.37V7.29a4.28 4.28 0 0 1-3.22-1.47z" />
    </svg>
  );
}

// `hover` ține culoarea de brand a fiecărei rețele — clasele sunt scrise
// literal, niciodată compuse din bucăți, altfel Tailwind le curăță la build.
const LINKS = [
  {
    key: "instagram",
    label: "Instagram",
    href: "https://instagram.com/verificasaro",
    Icon: Instagram,
    hover: "hover:border-[#E1306C] hover:text-[#E1306C] focus-visible:border-[#E1306C] focus-visible:text-[#E1306C]",
  },
  {
    key: "tiktok",
    label: "TikTok",
    href: "https://tiktok.com/@verificasaro",
    Icon: TikTokIcon,
    hover: "hover:border-[#25F4EE] hover:text-[#25F4EE] focus-visible:border-[#25F4EE] focus-visible:text-[#25F4EE]",
  },
  {
    key: "email",
    label: "contact@verificasa.ro",
    href: "mailto:contact@verificasa.ro",
    Icon: Mail,
    external: false,
    hover: "hover:border-emerald hover:text-emerald focus-visible:border-emerald focus-visible:text-emerald",
  },
  {
    key: "appstore",
    label: "App Store",
    href: APP_STORE_URL,
    Icon: AppleIcon,
    hover: "hover:border-white hover:text-white focus-visible:border-white focus-visible:text-white",
  },
  {
    key: "playstore",
    label: "Google Play",
    href: PLAY_STORE_URL,
    Icon: GooglePlayIcon,
    hover: "hover:border-[#34A853] hover:text-[#34A853] focus-visible:border-[#34A853] focus-visible:text-[#34A853]",
  },
];

const BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

export default function SocialLinks({ className, soon = "În curând", compact = false }) {
  // Cele stinse primesc motivul în `aria-label` (deci cititorul de ecran îl
  // aude) plus o singură notă vizibilă sub rând — nu câte o etichetă lângă
  // fiecare iconiță, care rupea rândul pe telefon și umfla subsolul cu 60px.
  const pending = LINKS.filter((l) => !l.href).map((l) => l.label);

  return (
    <div className={className}>
    <ul className="flex flex-wrap items-center gap-2">
      {LINKS.map(({ key, label, href, Icon, hover, external = true }, i) => {
        // Pe telefon cercurile sunt de 40px în loc de 44: rândul rămâne apăsabil
        // cu degetul, dar subsolul nu mai cheltuie un rând întreg pe el.
        const base =
          (compact ? "flex h-10 w-10" : "flex h-11 w-11") +
          " items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70";
        const motion =
          "transition-[transform,color,border-color,background-color] duration-300 will-change-transform hover:-translate-y-1 hover:scale-110 hover:bg-white/10 active:scale-90 focus-visible:-translate-y-1 focus-visible:scale-110 focus-visible:outline-none";

        // Fără URL, iconița NU e link: rămâne un buton stins, marcat, ca să nu
        // trimitem pe nimeni către un magazin unde aplicația încă nu există.
        // Fără URL nu e link. `role="img"` e obligatoriu: un <span> fără rol
        // se mapează la `generic`, care NU acceptă nume accesibil, deci
        // aria-label ar fi pur și simplu ignorat și iconița ar fi mută. Iar
        // motivul se scrie pe ecran, nu doar în `title` — pe telefon nu există
        // hover, deci un tooltip nu se vede niciodată.
        if (!href) {
          return (
            <li key={key}>
              <span
                role="img"
                aria-label={`${label} — ${soon}`}
                className={cn(base, "cursor-default opacity-35")}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
            </li>
          );
        }

        return (
          <li key={key}>
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-label={label}
              title={label}
              className={cn(base, motion, hover)}
              style={{ transitionTimingFunction: BOUNCE, transitionDelay: `${i * 20}ms` }}
            >
              <Icon className="h-[18px] w-[18px]" />
            </a>
          </li>
        );
      })}
    </ul>

    {/* Nota care explică iconițele stinse costă un rând întreg. Pe telefon
        motivul rămâne în `aria-label`-ul fiecăreia; pe desktop se scrie. */}
    {!compact && pending.length > 0 && (
      <p aria-hidden="true" className="mt-1.5 text-[10.5px] text-white/35">
        {pending.join(" · ")} — {soon.toLowerCase()}
      </p>
    )}
    </div>
  );
}
