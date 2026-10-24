import React from "react";
import { useNavigate } from "react-router-dom";
import { useCountry } from "@/components/CountryContext";
import { Image } from "@/components/ui/image";
import { PropertyBadgeRow } from "@/components/PropertyBadges";
import { coverOf } from "@/lib/covers";

// Cardul din carusele („anunțuri similare"). Aceeași formă ca celelalte, la
// scară mică — fotografie, insigne, preț, o linie de specificații.
export default function SimilarPropertyCard({ property, hot = false, coverMap }) {
  const { currency, formatPrice, t, lang } = useCountry();
  const navigate = useNavigate();
  const p = property;
  const en = lang === "en";
  const cover = coverOf(p, coverMap);
  const boosted = p.boost_active || p.featured || hot;

  const eur = formatPrice(p.price_monthly, p.currency, "EUR");
  const ron = formatPrice(p.price_monthly, p.currency, "RON");
  const primary = currency === "EUR" ? eur : ron;

  const specs = [
    p.rooms != null && `${p.rooms} ${en ? (p.rooms === 1 ? "room" : "rooms") : "cam."}`,
    p.surface_sqm != null && `${p.surface_sqm} mp`,
  ].filter(Boolean).join(" · ");

  return (
    <article
      onClick={() => navigate(`/property/${p.id}`)}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {cover ? (
          <Image
            src={cover}
            alt={p.title}
            fittingType="fill"
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <span className="text-xs text-muted-foreground">{t("info_missing")}</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        {/* Insignele sub fotografie, nu peste ea — vezi PropertyCard. */}
        <PropertyBadgeRow
          property={{ ...p, boost_active: boosted }}
          size="sm"
          lang={lang}
          reserve
          className="mb-1.5 max-w-full"
        />
        <p className="text-base font-bold leading-none text-foreground tnum sm:text-lg">
          {primary}
          <span className="ml-0.5 text-[11px] font-semibold text-muted-foreground">
            {p.transaction_type === "SALE" ? "" : t("pc_permonth")}
          </span>
        </p>
        {/* Ambele rânduri se desenează mereu, chiar goale: un anunț fără
            camere trecute nu are voie să-și ridice cardul cu un rând față de
            vecinul lui. */}
        <p className="mt-1 min-h-[1rem] truncate text-xs font-semibold text-foreground/80">
          {specs || " "}
        </p>
        <p className="mt-0.5 min-h-[1rem] truncate text-xs text-muted-foreground">
          {p.zone || p.city ? `${p.zone ? p.zone + ", " : ""}${p.city || ""}` : "—"}
        </p>
      </div>
    </article>
  );
}
