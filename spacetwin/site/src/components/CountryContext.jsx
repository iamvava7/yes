import React, { createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { makeT } from "@/i18n";
import { base44 } from "@/api/base44Client";

const CountryContext = createContext(null);

const RATES = {
  EUR: { EUR: 1, RON: 4.97, GBP: 0.85 },
  RON: { EUR: 0.20, RON: 1, GBP: 0.17 },
  GBP: { EUR: 1.18, RON: 5.85, GBP: 1 },
};

export function CountryProvider({ children }) {
  // VerifiCasa is a Romania-first platform. country stays RO; users switch
  // the display currency between RON (default) and EUR.
  const [country, setCountry] = useState("RO");
  const [currency, setCurrency] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("vc_currency") || "RON";
    return "RON";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("vc_currency", currency);
  }, [currency]);

  const [lang, setLang] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("vc_lang") || "ro";
    return "ro";
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("vc_lang", lang);
  }, [lang]);

  const legalInfo = useMemo(
    () => ({
      legal1: "Conform ANPC · Protecția Consumatorului",
      legal2: "Verificare online a fiecărui anunț",
      commission: "Comision corect · 0% chiriași pe selectate",
      tenantFee: "Fără comision chiriași · Protecție consumator",
    }),
    []
  );

  const convert = useCallback(
    (amount, fromCurrency, target) => {
      const from = fromCurrency || currency;
      const to = target || currency;
      const rate = RATES[from]?.[to] ?? 1;
      return Math.round((amount || 0) * rate);
    },
    [currency]
  );

  const formatPrice = useCallback(
    (amount, fromCurrency, target) => {
      const to = target || currency;
      const value = convert(amount, fromCurrency, to);
      const formatted = value.toLocaleString("ro-RO");
      return to === "EUR" ? `€${formatted}` : to === "GBP" ? `£${formatted}` : `${formatted} lei`;
    },
    [convert, currency]
  );

  // Texte editate din Admin → Texte site. Se încarcă o dată, apoi se
  // actualizează în timp real; până atunci (sau fără rețea) rămân textele din cod.
  const [overrides, setOverrides] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => base44.entities.SiteText.list("-updated_date", 1000)
      .then((rows) => { if (alive) setOverrides(Object.fromEntries((rows || []).map((r) => [r.key, { ro: r.ro || "", en: r.en || "" }]))); })
      .catch(() => {});
    load();
    let unsubscribe = null;
    try { unsubscribe = base44.entities.SiteText.subscribe?.(() => load()); } catch (_) { /* realtime opțional */ }
    return () => { alive = false; if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  const t = useMemo(() => makeT(lang, overrides), [lang, overrides]);

  const value = useMemo(
    () => ({ country, setCountry, currency, setCurrency, lang, setLang, t, legalInfo, convert, formatPrice }),
    [country, currency, lang, t, legalInfo, convert, formatPrice]
  );

  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

// A missing provider used to throw, which meant one stray consumer took down
// the whole page with "useCountry must be used within CountryProvider" and no
// clue as to which component. Currency and language are chrome, not content —
// they are never worth a blank page. Fall back to the app's own defaults and
// say so in the console instead.
const FALLBACK = {
  country: "RO",
  setCountry: () => {},
  currency: "RON",
  setCurrency: () => {},
  lang: "ro",
  setLang: () => {},
  t: makeT("ro"),
  legalInfo: {
    legal1: "Conform ANPC · Protecția Consumatorului",
    legal2: "Verificare online a fiecărui anunț",
    commission: "Comision corect · 0% chiriași pe selectate",
    tenantFee: "Fără comision chiriași · Protecție consumator",
  },
  convert: (amount) => Math.round(amount || 0),
  formatPrice: (amount) => `${Math.round(amount || 0).toLocaleString("ro-RO")} lei`,
};

let warned = false;

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) {
    if (!warned) {
      warned = true;
      console.warn("[VerifiCasa] useCountry called outside CountryProvider — using RO/RON defaults.");
    }
    return FALLBACK;
  }
  return ctx;
}