import React from "react";

// Steaguri desenate ca SVG, nu ca emoji: Windows nu randează emoji-urile de
// steag deloc — le arată ca două litere. Un cerc desenat arată la fel pe orice
// sistem și se potrivește cu restul controalelor rotunde.

export function FlagRO({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="România">
      <defs><clipPath id="fc-ro"><circle cx="12" cy="12" r="12" /></clipPath></defs>
      <g clipPath="url(#fc-ro)">
        <rect x="0" y="0" width="8" height="24" fill="#002B7F" />
        <rect x="8" y="0" width="8" height="24" fill="#FCD116" />
        <rect x="16" y="0" width="8" height="24" fill="#CE1126" />
      </g>
    </svg>
  );
}

export function FlagGB({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="English">
      <defs><clipPath id="fc-gb"><circle cx="12" cy="12" r="12" /></clipPath></defs>
      <g clipPath="url(#fc-gb)">
        <rect width="24" height="24" fill="#012169" />
        {/* diagonalele albe, apoi cele roșii decalate */}
        <path d="M0 0 L24 24 M24 0 L0 24" stroke="#FFF" strokeWidth="5" />
        <path d="M0 0 L24 24" stroke="#C8102E" strokeWidth="2.5" />
        <path d="M24 0 L0 24" stroke="#C8102E" strokeWidth="2.5" />
        {/* crucea dreaptă */}
        <path d="M12 0 V24 M0 12 H24" stroke="#FFF" strokeWidth="8" />
        <path d="M12 0 V24 M0 12 H24" stroke="#C8102E" strokeWidth="4.5" />
      </g>
    </svg>
  );
}

export function FlagFor({ lang, className }) {
  return lang === "en" ? <FlagGB className={className} /> : <FlagRO className={className} />;
}

export default FlagFor;
