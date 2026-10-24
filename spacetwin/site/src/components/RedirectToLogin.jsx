import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Trimite un vizitator nelogat la autentificare PĂSTRÂND unde voia să ajungă.
//
// Înainte, rutele protejate primeau un `<Navigate to="/login" replace />` gata
// construit, adică un element care nu are cum să știe ce rută păzește. Așa că
// destinația se pierdea: apeși „Adaugă anunț", ești trimis la login, te
// autentifici — și te trezești înapoi pe prima pagină, fără formular. Omul
// crede că butonul e stricat, pentru că din punctul lui de vedere chiar e.
//
// Formularul de autentificare știe deja să citească `?returnTo=` prin
// safeReturnTo() (src/lib/authReturnTo.js, care validează că e o cale
// same-origin, nu un open redirect). Singura piesă care lipsea era cineva care
// să-l scrie — asta face componenta de față.
export default function RedirectToLogin() {
  const location = useLocation();
  const target = `${location.pathname}${location.search}`;
  const to = target && target !== "/" ? `/login?returnTo=${encodeURIComponent(target)}` : "/login";
  return <Navigate to={to} replace />;
}
