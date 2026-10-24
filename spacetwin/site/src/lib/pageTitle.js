// Titlurile de pagină, într-un singur loc.
//
// Înainte, doar câteva pagini își setau document.title și niciuna nu îl reseta,
// așa că titlul rămânea „lipit": după o vizită pe /parteneri, fiecare pagină
// următoare rămânea „Parteneri – VerifiCasa". Layout aplică maparea de mai jos
// la fiecare schimbare de rută, deci fiecare pagină are titlul ei, mereu.

const SUFFIX = "VerifiCasa";

const TITLES_RO = {
  "/": "VerifiCasa — Chirii verificate online",
  "/search": "Căutare anunțuri",
  "/map": "Hartă",
  "/upgrade": "Planuri și boost-uri",
  "/parteneri": "Parteneri",
  "/tur-3d": "Tur 3D",
  "/about": "Despre noi",
  "/contact": "Contact",
  "/terms": "Termeni și condiții",
  "/privacy": "Politica de confidențialitate",
  "/cookies": "Politica de cookies",
  "/data-deletion": "Ștergerea datelor",
  "/anunturi-recomandate": "Anunțuri recomandate",
  "/notificari": "Notificări",
  "/account": "Contul meu",
  "/settings": "Setări",
  "/saved": "Salvate",
  "/searches": "Căutări salvate",
  "/messages": "Mesaje",
  "/my-properties": "Anunțurile mele",
  "/my-reports": "Rapoartele mele",
  "/owner": "Pentru proprietari",
  "/post-property": "Adaugă un anunț",
  "/admin": "Administrare",
  "/login": "Autentificare",
  "/register": "Cont nou",
  "/forgot-password": "Recuperare parolă",
  "/reset-password": "Parolă nouă",
};

const TITLES_EN = {
  "/": "VerifiCasa — Verified rentals online",
  "/search": "Search listings",
  "/map": "Map",
  "/upgrade": "Plans and boosts",
  "/parteneri": "Partners",
  "/tur-3d": "3D Tour",
  "/about": "About us",
  "/contact": "Contact",
  "/terms": "Terms and conditions",
  "/privacy": "Privacy policy",
  "/cookies": "Cookie policy",
  "/data-deletion": "Data deletion",
  "/anunturi-recomandate": "Recommended listings",
  "/notificari": "Notifications",
  "/account": "My account",
  "/settings": "Settings",
  "/saved": "Saved",
  "/searches": "Saved searches",
  "/messages": "Messages",
  "/my-properties": "My listings",
  "/my-reports": "My reports",
  "/owner": "For landlords",
  "/post-property": "Add a listing",
  "/admin": "Admin",
  "/login": "Sign in",
  "/register": "Create account",
  "/forgot-password": "Reset password",
  "/reset-password": "New password",
};

// Rute cu parametru — titlul real îl pune pagina (titlul anunțului, numele
// profilului); aici doar ne asigurăm că nu rămâne titlul paginii precedente.
const DYNAMIC = [
  { test: /^\/property\//, ro: "Fișa proprietății", en: "Property record" },
  { test: /^\/profile\//, ro: "Profil", en: "Profile" },
  { test: /^\/messages\//, ro: "Conversație", en: "Conversation" },
];

export function titleForPath(pathname, lang = "ro") {
  const map = lang === "en" ? TITLES_EN : TITLES_RO;
  const exact = map[pathname];
  if (exact) return exact === map["/"] ? exact : `${exact} – ${SUFFIX}`;

  for (const d of DYNAMIC) {
    if (d.test.test(pathname)) return `${lang === "en" ? d.en : d.ro} – ${SUFFIX}`;
  }
  return map["/"];
}
