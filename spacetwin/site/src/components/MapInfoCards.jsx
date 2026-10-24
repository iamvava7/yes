import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import { Image } from "@/components/ui/image";
import { PropertyBadgeRow } from "@/components/PropertyBadges";
import { buildCoverMap, coverOf } from "@/lib/covers";
import { floorLabel } from "@/lib/propertyPayload";

// Panourile de sub hartă, pe telefon. Ultimul dintre ele e o listă de carduri
// în miniatură — aceeași limbă ca PropertyCard: fotografie, insigne pe
// fotografie, preț, o linie de caracteristici, zona.
function MiniPropertyCard({ property, coverMap, lang }) {
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
      className="flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors hover:border-emerald"
    >
      <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl bg-secondary">
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

// Panourile compacte de sub hartă, pe telefon.
export default function MapInfoCards({ properties, lang }) {
  const en = lang === "en";

  const stats = useMemo(() => {
    const geo = (properties || []).filter((p) => p.latitude && p.longitude);
    const counties = {};
    const cities = new Set();
    geo.forEach((p) => {
      const c = p.county || (lang === "en" ? "Other" : "Altele");
      counties[c] = (counties[c] || 0) + 1;
      if (p.city) cities.add(p.city);
    });
    const topCounties = Object.entries(counties)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    // Anunțurile promovate sau certificate în teren urcă primele; restul, după dată.
    const first = geo
      .filter((p) => p.boost_active || p.featured || p.verification_level === "field_certified")
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))
      .slice(0, 3);
    const firstIds = new Set(first.map((p) => p.id));
    const rest = geo
      .filter((p) => !firstIds.has(p.id))
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    const recent = [...first, ...rest].slice(0, 5);
    return {
      total: geo.length,
      countyCount: Object.keys(counties).length,
      cityCount: cities.size,
      topCounties,
      recent,
      coverMap: buildCoverMap(geo),
    };
  }, [properties, lang]);

  return (
    <>
      {/* Cifrele hărții */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="text-sm font-bold text-foreground">{en ? "On the map" : "Pe hartă"}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-emerald-soft p-3 text-center dark:bg-emerald/10">
            <p className="text-xl font-bold text-emerald tnum">{stats.total}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {en ? "properties" : "proprietăți"}
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-center dark:bg-white/5">
            <p className="text-xl font-bold text-foreground tnum">{stats.countyCount}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {en ? "counties" : "județe"}
            </p>
          </div>
          <div className="rounded-xl bg-secondary p-3 text-center dark:bg-white/5">
            <p className="text-xl font-bold text-foreground tnum">{stats.cityCount}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{en ? "cities" : "orașe"}</p>
          </div>
        </div>
      </div>

      {/* Județele cu cele mai multe anunțuri */}
      {stats.topCounties.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-bold text-foreground">{en ? "By county" : "După județ"}</p>
          <div className="mt-3 space-y-2.5">
            {stats.topCounties.map(([county, count], i) => (
              <div key={county} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground tnum dark:bg-white/10">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {county}
                </span>
                <span className="shrink-0 rounded-full bg-emerald-soft px-2.5 py-1 text-xs font-bold text-emerald tnum dark:bg-emerald/15">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adăugate recent */}
      {stats.recent.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-sm font-bold text-foreground">
            {en ? "Recently added" : "Adăugate recent"}
          </p>
          {stats.recent.map((p) => (
            <MiniPropertyCard key={p.id} property={p} coverMap={stats.coverMap} lang={lang} />
          ))}
        </div>
      )}
    </>
  );
}
