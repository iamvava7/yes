import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useCountry } from "@/components/CountryContext";
import { useNotifications } from "@/hooks/useNotifications";

const EASE = [0.16, 1, 0.3, 1];

// Site menu, top-right. A solid rounded panel on a round trigger — no glass,
// no icon tiles. The trigger carries the unread badge; the menu includes
// Notificări so the badge leads somewhere. Every row is a 44px rounded target.
//
// Mișcarea: panoul crește din colțul din dreapta-sus, adică fix de sub buton,
// depășește puțin ținta și se așază înapoi; rândurile intră dinspre dreapta,
// unul după altul, la 55ms distanță. Scara dinspre trigger arată DE UNDE a venit
// panoul; decalajul dă ochiului timp să prindă lista. În spate se lasă un scrim,
// ca deschiderea meniului să se vadă și cu coada ochiului.
//
// Fiecare rând răspunde și la `active:`, nu doar la `hover:`. Pe telefon
// `(hover: none)` e adevărat, deci un meniu care se mișcă numai la hover nu se
// mișcă deloc — exact reclamația „nu se întâmplă nimic când apăs".
//
// Animația e în CSS (vc-menu-panel / vc-menu-row în index.css), NU pe
// framer-motion. Motivul e măsurat, nu teoretic: cu framer, panoul și toate cele
// opt rânduri stăteau la `opacity: 0` până rula un cadru — la o secundă după
// click, cu bucla de cadre sugrumată, meniul era complet invizibil. Cu CSS,
// starea de repaus e cea vizibilă, deci în cel mai rău caz meniul apare pur și
// simplu, fără animație. Reducerea de mișcare e deja globală în index.css.
//
// Închiderea e instantanee, intenționat: odată ce omul a decis să plece, un
// panou care se stinge lent doar stă în drum.
export default function SiteNavMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { lang } = useCountry();
  const { unreadCount } = useNotifications();
  const reduced = useReducedMotion();
  const en = lang === "en";

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = [
    { label: en ? "My account" : "Contul meu", path: isAuthenticated ? "/account" : "/login" },
    ...(isAuthenticated
      ? [{ label: en ? "Notifications" : "Notificări", path: "/notificari", badge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : unreadCount) : null }]
      : []),
    { label: en ? "3D Tour" : "Tur 3D", path: "/tur-3d" },
    { label: en ? "Plans" : "Planuri", path: "/upgrade" },
    { label: en ? "Search" : "Caută", path: "/search" },
    { label: en ? "Map" : "Hartă", path: "/map" },
    { label: en ? "Partners" : "Parteneri", path: "/parteneri" },
    { label: en ? "Contact" : "Contact", path: "/contact" },
    { label: en ? "About us" : "Despre noi", path: "/about" },
  ];

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="tap-44 relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-[transform,border-color,background-color] duration-200 ease-out hover:border-emerald active:scale-90 active:border-emerald"
        aria-label={en ? "Menu" : "Meniu"}
        aria-expanded={open}
      >
        {/* Cele două pictograme se rotesc una în alta. Amândouă sunt mereu în
            pagină și se schimbă pe `transition`, nu pe `animation`: o tranziție
            care nu apucă să ruleze sare direct la valoarea finală, deci în cel
            mai rău caz pictograma corectă e pur și simplu acolo. O animație sau
            un `initial` de framer ar fi lăsat butonul gol. */}
        <span className="relative flex h-5 w-5 items-center justify-center">
          <Menu
            className={`absolute h-5 w-5 transition-all duration-200 ease-out ${
              open ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <X
            className={`absolute h-5 w-5 transition-all duration-200 ease-out ${
              open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
            }`}
          />
        </span>
        {!open && isAuthenticated && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-emerald px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background tnum">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Umbra care intuneca pagina cat timp meniul e deschis. Nu prinde clicuri:
          handlerul de mousedown de mai sus inchide oricum meniul, iar un scrim
          care ar inghiti primul tap ar face meniul sa para blocat.

          Merge prin portal in <body> pentru ca antetul are `transition-transform`,
          deci un `transform` calculat chiar si in repaus — masurat: `matrix(1,0,0,1,0,0)`.
          Orice transform diferit de `none` face elementul bloc-container pentru
          descendentii `fixed`, asa ca un scrim scris aici se intindea pe cei 57px
          ai antetului, nu pe ecran. Sub z-50 al antetului, deci panoul ramane
          deasupra si antetul ramane luminat. */}
      {open && !reduced && createPortal(
        <div className="vc-menu-scrim pointer-events-none fixed inset-0 z-40 bg-foreground/15" aria-hidden="true" />,
        document.body
      )}

      {open && (
        <div
          className={`absolute right-0 top-[calc(100%+8px)] z-50 max-h-[calc(100vh-5rem)] w-60 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-2xl ${reduced ? "" : "vc-menu-panel"}`}
          role="menu"
        >
          {items.map((it, i) => (
            <button
              key={it.path + it.label}
              type="button"
              role="menuitem"
              onClick={() => go(it.path)}
              style={reduced ? undefined : { animationDelay: `${0.05 + i * 0.055}s` }}
              className={`group flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-3.5 text-left text-sm font-semibold text-foreground transition-[transform,background-color,color] duration-200 ease-out hover:bg-secondary hover:text-emerald active:scale-[0.96] active:bg-secondary active:text-emerald ${reduced ? "" : "vc-menu-row"}`}
            >
              {/* Eticheta alunecă 2px la hover — atât cât să se simtă că rândul
                  răspunde, fără să miște rândurile de deasupra sau dedesubt. */}
              <span className="transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-active:translate-x-1">
                {it.label}
              </span>
              {it.badge && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald px-1.5 text-[10px] font-bold leading-none text-primary-foreground transition-transform duration-200 group-hover:scale-110 group-active:scale-110 tnum">
                  {it.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
