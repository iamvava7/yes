import React from "react";
import { Link } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import VerifiCasaLogo from "@/components/VerifiCasaLogo";
import LegalBadges from "@/components/LegalBadges";
import SocialLinks from "@/components/SocialLinks";
import { Reveal } from "@/components/ui/reveal";

// Registry footer: ink ground, ruled columns, typed links.
//
// Pe telefon subsolul ajunsese să ocupe tot ecranul — patru coloane stivuite
// una peste alta înseamnă douăzeci de rânduri de linkuri înainte de copyright,
// iar omul care derulează până jos pe pagina principală dădea de un perete de
// text în loc de sfârșitul paginii. Așa că sunt DOUĂ compoziții, nu una
// stivuită: pe telefon linkurile stau înșirate pe rânduri, despărțite prin
// puncte, iar contactul e rândul de iconițe; de la `md` în sus revine grila de
// patru coloane, unde chiar e loc pentru ea.
//
// Ce NU dispare pe telefon: Termeni, Confidențialitate, Cookies, Ștergerea
// datelor și pastilele ANPC/ODR. Sunt obligatorii și trebuie să rămână la un
// singur tap distanță de orice pagină care arată subsolul.
export default function Footer() {
  const { t } = useCountry();

  const platform = [
    { to: "/search", label: t("f_search") },
    { to: "/map", label: "Hartă" },
    { to: "/tur-3d", label: "Tur 3D" },
    { to: "/about", label: t("footer_about") },
    { to: "/upgrade", label: "Planuri" },
    { to: "/parteneri", label: "Parteneri" },
    { to: "/owner", label: t("nav_owners") },
  ];

  const legal = [
    { to: "/terms", label: t("footer_terms") },
    { to: "/privacy", label: t("footer_privacy") },
    { to: "/data-deletion", label: "Ștergerea datelor" },
    { to: "/cookies", label: "Politica de cookies" },
    { to: "/contact", label: "Contact" },
  ];

  const col = "space-y-0.5 text-[13px]";
  const link = "flex min-h-[32px] items-center text-white/60 transition-colors hover:text-white";
  const head = "text-[13px] font-bold text-white";
  // Pe telefon linkurile sunt inline, despărțite prin puncte — ținta de atins
  // rămâne generoasă pe verticală fără să coste un rând întreg per link.
  // 26px pe verticală în loc de 30: tot o țintă rezonabilă pentru deget într-un
  // rând curgător, dar unsprezece linkuri costă cu ~40px mai puțin.
  const inlineLink =
    "inline-flex min-h-[26px] items-center text-white/65 transition-colors hover:text-white";

  return (
    // Spatiul pentru bara fixa de jos sta AICI, pe subsol, nu pe <main>.
    // Era pe <main>, iar subsolul e fratele lui, nu copilul: rezulta ca ultimul
    // rand al subsolului — pastilele ANPC/SAL si ODR-UE, care sunt obligatorii —
    // statea sub bara de navigare si nu se putea atinge. Padding-ul pe subsol
    // duce si fundalul inchis pana sub bara, deci nu apare nicio dunga.
    <footer className="bg-navy-deep pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-white/70 md:pb-0">
      <Reveal className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-10 lg:px-8">
        {/* ——— TELEFON: cât mai mic cu putință ———
            Subsolul ajunsese la 369px pe un ecran de 812 — aproape jumătate de
            telefon, la capătul fiecărei pagini. Aici e strâns la strictul
            necesar: sigla mică, rândul de contact fără nota explicativă, TOATE
            linkurile legale într-o singură curgere despărțită prin puncte,
            apoi pastilele ANPC/ODR.

            Linkurile de platformă (Caută, Hartă, Tur 3D, Planuri, Parteneri,
            Despre) NU se repetă aici pe telefon: sunt deja în meniul din antet,
            care e pe fiecare pagină. Șase linkuri duplicate costau două rânduri
            în capătul fiecărui ecran fără să ducă nicăieri nou.

            Ce NU dispare: Termeni, Confidențialitate, Cookies, Ștergerea
            datelor, Contact și ANPC/SAL/ODR. Alea trăiesc DOAR în subsol și
            sunt obligatorii — se strâng, nu se ascund după un buton. */}
        <div className="md:hidden">
          <VerifiCasaLogo size={26} tone="light" />

          <SocialLinks className="mt-2.5" compact />

          <nav className="mt-2.5 flex flex-wrap items-center gap-x-1 text-[11.5px] font-semibold leading-tight">
            {legal.map((l, i) => (
              <React.Fragment key={l.to}>
                {i > 0 && <span aria-hidden="true" className="text-white/25">·</span>}
                <Link to={l.to} className={inlineLink}>{l.label}</Link>
              </React.Fragment>
            ))}
          </nav>

          <LegalBadges />

          <p className="mt-2.5 border-t border-white/15 pt-2.5 text-[10.5px] text-white/40">
            {t("footer_copy")}
          </p>
        </div>

        {/* ——— DESKTOP: grila de patru coloane ——— */}
        <div className="hidden md:block">
          <div className="grid gap-8 border-b border-white/15 pb-6 md:grid-cols-4">
            <div>
              <VerifiCasaLogo size={34} tone="light" />
              <p className="mt-2.5 max-w-[36ch] text-[13px] leading-relaxed text-white/55">{t("footer_desc_vc")}</p>
              <p className="mt-2.5 text-xs font-semibold text-white/70">{t("footer_inspectii")}</p>
            </div>

            <div>
              <h4 className={head}>{t("f_platform")}</h4>
              <ul className={`mt-2 ${col}`}>
                {platform.map((l) => (
                  <li key={l.to}><Link to={l.to} className={link}>{l.label}</Link></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className={head}>{t("f_legal")}</h4>
              <ul className={`mt-2 ${col}`}>
                {legal.map((l) => (
                  <li key={l.to}><Link to={l.to} className={link}>{l.label}</Link></li>
                ))}
              </ul>
              <p className="mt-2.5 text-xs text-white/45">{t("footer_anpc")}</p>
              <LegalBadges />
            </div>

            <div>
              <h4 className={head}>{t("f_contact")}</h4>
              {/* Adresa apare o singură dată per ecran: rândul de iconițe are
                  deja un link mailto, iar dublarea îi dă cititorului de ecran
                  aceeași destinație de două ori la rând. */}
              <p className="mt-2 text-[13px] text-white/60">contact@verificasa.ro</p>
              <SocialLinks className="mt-2" />
              <p className="mt-3 text-xs text-white/45">{t("footer_coverage")}</p>
            </div>
          </div>

          <div className="flex flex-col items-start justify-between gap-1 pt-4 text-[11px] text-white/40 sm:flex-row">
            <p>{t("footer_copy")}</p>
            <p>{t("footer_compliance")}</p>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}
