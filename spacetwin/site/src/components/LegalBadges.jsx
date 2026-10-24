import React from "react";

/**
 * ANPC SAL + SOL — obligatorii în subsolul oricărei firme din România.
 *
 * Bannerele sunt EXACT grafica oficială (SVG), auto-găzduită în
 * public/images/legal/ — nu hotlink: un banner găzduit la altcineva dispare
 * când îl mută, și subsolul rămâne cu două pătrate goale. SAL poartă stema
 * ANPC în interior; SOL e varianta text, așa cum apare și în referința
 * clientului. Alb, colțuri rotunde și butonul DETALII vin din artă, nu din
 * CSS-ul nostru — de-aia aici nu mai e nimic desenat.
 */

const BADGES = [
  {
    href: "https://anpc.ro/ce-este-sal/",
    img: "/images/legal/anpc-sal.svg",
    alt: "ANPC — Soluționarea Alternativă a Litigiilor",
  },
  {
    href: "https://consumer-redress.ec.europa.eu/site-relocation_en",
    img: "/images/legal/anpc-sol.svg",
    alt: "Soluționarea Online a Litigiilor",
  },
];

export default function LegalBadges() {
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {BADGES.map((b) => (
        <a
          key={b.href}
          href={b.href}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full max-w-[260px] transition-opacity hover:opacity-90"
        >
          <img src={b.img} alt={b.alt} className="h-auto w-full" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
