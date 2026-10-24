import React from "react";

// Google Play triangle. Stă în fișierul lui pentru că îl folosesc și rândul de
// contact din subsol, și butoanele de magazin de pe pagina Tur 3D.
export default function GooglePlayIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.6 2.4a1 1 0 0 0-.35.76v17.68a1 1 0 0 0 .35.76l10-9.6-10-9.6z" fill="currentColor" />
      <path d="M17.2 8.6 14.1 6.8 4.2 2.06 13.6 12l3.6-3.4z" fill="currentColor" opacity=".78" />
      <path d="M17.2 15.4 13.6 12 4.2 21.94l9.9-4.74 3.1-1.8z" fill="currentColor" opacity=".62" />
      <path d="m17.2 8.6-3.6 3.4 3.6 3.4 3.05-1.77c.73-.42.73-1.84 0-2.26L17.2 8.6z" fill="currentColor" opacity=".9" />
    </svg>
  );
}
