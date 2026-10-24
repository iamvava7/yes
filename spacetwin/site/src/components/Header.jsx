import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { User, Plus, Check } from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useCountry } from "@/components/CountryContext";
import { useAuth } from "@/lib/AuthContext";
import VerifiCasaLogo from "@/components/VerifiCasaLogo";
import ThemeToggle from "@/components/ThemeToggle";
import SiteNavMenu from "@/components/SiteNavMenu";
import NotificationBell from "@/components/NotificationBell";
import { FlagRO, FlagGB, FlagFor } from "@/components/FlagCircle";

// Bara de sus. Trei decizii, nu trei accidente:
//
// 1. Pastila verde care marchează pagina curentă nu apare și dispare — ALUNECĂ
//    dintr-un element în altul (layoutId), deci navigarea are continuitate.
// 2. Bara nu mai dispare la primul pixel de derulare. Se ascunde doar când
//    cobori hotărât și revine imediat ce urci — comportamentul unei aplicații,
//    nu al unei pagini care fuge.
// 3. Limba se arată ca steag, nu ca un glob generic. Emoji-urile de steag nu
//    se randează pe Windows, deci steagurile sunt desenate ca SVG.
export default function Header() {
  const { currency, setCurrency, lang, setLang, t } = useCountry();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const reduced = useReducedMotion();

  const NAV = [
    { to: "/", label: t("hdr_home") },
    { to: "/search", label: t("sb_btn") },
    { to: "/tur-3d", label: lang === "en" ? "3D Tour" : "Tur 3D" },
    { to: "/about", label: t("hdr_about") },
    { to: "/upgrade", label: t("hdr_upgrade") },
  ];
  const isActive = (to) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  // Ascundere doar la coborâre susținută; revenire instantanee la urcare.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < 80) setHidden(false);
      else if (delta > 6) setHidden(true);
      else if (delta < -6) setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const LangSwitch = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="tap-44 group flex h-9 items-center gap-1.5 rounded-full border border-border bg-card pl-1.5 pr-3 text-foreground transition-colors hover:border-emerald"
          aria-label={`${t("hdr_currency")} / ${t("hdr_language")}`}
        >
          <FlagFor lang={lang} className="h-6 w-6 shrink-0" />
          <span className="text-xs font-bold tracking-wide">{currency}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2">
        <DropdownMenuLabel className="px-2 text-xs font-semibold text-muted-foreground">
          {t("hdr_currency")}
        </DropdownMenuLabel>
        {[
          { code: "EUR", mark: "€" },
          { code: "RON", mark: "lei" },
        ].map((c) => (
          <DropdownMenuItem
            key={c.code}
            onClick={() => setCurrency(c.code)}
            className="min-h-[44px] cursor-pointer gap-2.5 rounded-xl px-2 font-semibold"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
              {c.mark}
            </span>
            {c.code}
            {currency === c.code && <Check className="ml-auto h-4 w-4 text-emerald" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="px-2 text-xs font-semibold text-muted-foreground">
          {t("hdr_language")}
        </DropdownMenuLabel>
        {[
          { code: "ro", label: "Română", Flag: FlagRO },
          { code: "en", label: "English", Flag: FlagGB },
        ].map(({ code, label, Flag }) => (
          <DropdownMenuItem
            key={code}
            onClick={() => setLang(code)}
            className="min-h-[44px] cursor-pointer gap-2.5 rounded-xl px-2 font-semibold"
          >
            <Flag className="h-7 w-7 shrink-0" />
            {label}
            {lang === code && <Check className="ml-auto h-4 w-4 text-emerald" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b border-border bg-background transition-transform duration-300 ease-out ${
        hidden ? "-translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2">
          <Link to="/" className="flex min-w-0 items-center rounded-full">
            <VerifiCasaLogo size={32} tagline={false} />
          </Link>

          {/* Pastila activă alunecă între secțiuni în loc să clipească. */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => {
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className="relative flex h-9 items-center rounded-full px-3.5 text-sm font-semibold transition-colors"
                >
                  {active && (
                    <motion.span
                      layoutId={reduced ? undefined : "navPill"}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-emerald"
                    />
                  )}
                  <span className={`relative z-10 ${active ? "text-primary-foreground" : "text-foreground/70 hover:text-emerald"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden md:block"><LangSwitch /></div>
            <div className="hidden md:block">
              <ThemeToggle className="w-9 justify-center rounded-full px-0" />
            </div>
            <NotificationBell className="rounded-full" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/post-property"
                  aria-label={t("hdr_add")}
                  className="hidden h-9 items-center justify-center gap-1 rounded-full bg-emerald px-3 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.04] md:flex md:px-4"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden md:inline">{t("hdr_add")}</span>
                </Link>
                <SiteNavMenu />
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden h-9 items-center gap-1.5 rounded-full bg-emerald px-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.04] md:flex"
                >
                  <User className="h-4 w-4" />
                  <span>{t("hdr_login")}</span>
                </Link>
                <SiteNavMenu />
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
