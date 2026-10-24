import React, { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import { Image } from "@/components/ui/image";
import { PropertyBadgeRow } from "@/components/PropertyBadges";
import { coverOf } from "@/lib/covers";
import { floorLabel } from "@/lib/propertyPayload";

// Banda de carduri de pe hartă, pe telefon.
//
// Înlocuiește panoul care urca peste toată harta la fiecare atingere de pin.
// Modelul e cel de la DayUse: harta ocupă tot ecranul, iar rezultatele stau
// într-o singură bandă care se trage cu degetul, jos, peste hartă. Sincronizarea
// merge în ambele sensuri — atingi un pin, banda se aduce la cardul lui; tragi
// banda, pinul cardului ajuns în centru se aprinde.
//
// Cardul e aceeași limbă ca PropertyCard, comprimată pe orizontală: fotografia
// conduce, insignele stau pe fotografie, prețul e primul lucru citit, apoi o
// linie de caracteristici și zona.

// Cardul lasă câte o fâșie din vecini la vedere de fiecare parte — de acolo
// se învață că banda se trage. Distanțierele de la capete au exact lățimea
// fâșiei, ca primul și ultimul card să poată ajunge și ele în centru.
const CARD_W = "w-[78vw] max-w-[320px]";
const EDGE_W = "w-[11vw] max-w-[44px]";

function RailCard({ property, coverMap, lang, active }) {
  const { currency, formatPrice, t } = useCountry();
  const p = property;
  const en = lang === "en";
  const cover = coverOf(p, coverMap);

  const eur = formatPrice(p.price_monthly, p.currency, "EUR");
  const ron = formatPrice(p.price_monthly, p.currency, "RON");
  const primary = currency === "EUR" ? eur : ron;

  const specs = [
    p.rooms != null && `${p.rooms} ${en ? (p.rooms === 1 ? "room" : "rooms") : "cam."}`,
    p.surface_sqm != null && `${p.surface_sqm} mp`,
    floorLabel(p.floor, en),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      to={`/property/${p.id}`}
      className={`flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-card p-2 shadow-lg transition-colors ${
        active ? "border-emerald" : "border-border"
      }`}
    >
      <div className="relative h-[76px] w-[92px] shrink-0 overflow-hidden rounded-xl bg-secondary">
        {cover ? (
          <Image src={cover} alt={p.title || ""} fittingType="fill" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            {t("info_missing")}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1 pr-1">
        {/* Insignele lângă fapte, nu peste fotografie — vezi PropertyCard. */}
        <PropertyBadgeRow
          property={p}
          size="sm"
          lang={lang}
          className="mb-1.5 max-w-full"
        />
        <p className="text-base font-bold leading-none text-foreground tnum">
          {primary}
          <span className="ml-0.5 text-[11px] font-semibold text-muted-foreground">
            {p.transaction_type === "SALE" ? "" : t("pc_permonth")}
          </span>
        </p>
        {specs && <p className="mt-1 truncate text-xs font-semibold text-foreground/80">{specs}</p>}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {p.city || p.zone ? `${p.zone ? p.zone + ", " : ""}${p.city || ""}` : t("info_missing")}
        </p>
      </div>
    </Link>
  );
}

export default function MapCardRail({ properties, coverMap, lang, selectedId, onSelect }) {
  const scrollerRef = useRef(null);
  // Când banda e mutată din cod (fiindcă s-a atins un pin), evenimentele de
  // scroll pe care le produce singură nu au voie să retrimită o selecție —
  // altfel harta și banda se împing una pe alta la nesfârșit.
  const programmaticUntil = useRef(0);
  const settleTimer = useRef(null);

  // Atingi un pin → banda se aduce la cardul lui. Poziția o calculăm noi, în
  // loc de scrollIntoView: acela mișcă și pagina pe verticală, iar harta ține
  // tot ecranul, deci ecranul ar sări sub degete.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !selectedId) return;
    const card = scroller.querySelector(`[data-pid="${CSS.escape(String(selectedId))}"]`);
    if (!card) return;
    const target = card.offsetLeft - (scroller.clientWidth - card.clientWidth) / 2;
    if (Math.abs(scroller.scrollLeft - target) < 8) return;
    programmaticUntil.current = Date.now() + 700;
    scroller.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selectedId, properties]);

  // Tragi banda → pinul cardului ajuns în centru se aprinde.
  const handleScroll = useCallback(() => {
    if (Date.now() < programmaticUntil.current) return;
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const mid = scroller.scrollLeft + scroller.clientWidth / 2;
      let best = null;
      let bestD = Infinity;
      for (const card of scroller.querySelectorAll("[data-pid]")) {
        const d = Math.abs(card.offsetLeft + card.clientWidth / 2 - mid);
        if (d < bestD) { bestD = d; best = card; }
      }
      const id = best?.dataset.pid;
      if (id && id !== String(selectedId)) onSelect?.(id, { fromRail: true });
    }, 130);
  }, [onSelect, selectedId]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  if (!properties?.length) return null;

  return (
    <div
      ref={scrollerRef}
      onScroll={handleScroll}
      className="vc-rail flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain pb-2.5 pt-2"
    >
      <div className={`${EDGE_W} shrink-0`} aria-hidden="true" />
      {properties.map((p) => (
        <div key={p.id} data-pid={p.id} className={`${CARD_W} flex shrink-0 snap-center`}>
          <RailCard
            property={p}
            coverMap={coverMap}
            lang={lang}
            active={String(selectedId) === String(p.id)}
          />
        </div>
      ))}
      <div className={`${EDGE_W} shrink-0`} aria-hidden="true" />
    </div>
  );
}
