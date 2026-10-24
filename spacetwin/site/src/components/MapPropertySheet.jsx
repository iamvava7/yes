import React from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useCountry } from "@/components/CountryContext";
import { Image } from "@/components/ui/image";
import { PropertyBadgeRow } from "@/components/PropertyBadges";
import { coverOf } from "@/lib/covers";
import { floorLabel } from "@/lib/propertyPayload";

// Panoul care urcă de jos când atingi un anunț pe hartă. E cardul din listă,
// în miniatură și pe toată lățimea: fotografia conduce, insignele stau pe
// fotografie, prețul e primul lucru citit, apoi o singură linie de
// caracteristici și zona. Fără cod de anunț, fără tabel de fapte.
export default function MapPropertySheet({ property, onClose, lang, coverMap }) {
  const { currency, formatPrice, t } = useCountry();
  const reduced = useReducedMotion();
  const en = lang === "en";
  const p = property;

  const cover = p ? coverOf(p, coverMap) : null;

  const eur = formatPrice(p?.price_monthly, p?.currency, "EUR");
  const ron = formatPrice(p?.price_monthly, p?.currency, "RON");
  const primary = currency === "EUR" ? eur : ron;

  // O singură linie de specificații, în aceeași ordine ca pe cardul principal.
  const specs = p
    ? [
        p.rooms != null && `${p.rooms} ${en ? (p.rooms === 1 ? "room" : "rooms") : "cam."}`,
        p.surface_sqm != null && `${p.surface_sqm} mp`,
        floorLabel(p.floor, en),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const place =
    p && (p.zone || p.city) ? `${p.zone ? p.zone + ", " : ""}${p.city || ""}` : t("info_missing");

  return (
    <AnimatePresence>
      {p && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[1200] flex items-end bg-black/45"
          onClick={onClose}
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { y: "100%" }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduced
                ? { duration: 0.18 }
                : { type: "spring", stiffness: 320, damping: 22, mass: 0.9 }
            }
            className="relative w-full overflow-hidden rounded-t-3xl bg-card pb-[max(env(safe-area-inset-bottom),14px)] shadow-[0_-10px_34px_rgba(0,0,0,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <Link
                to={`/property/${p.id}`}
                className="block aspect-[16/9] w-full overflow-hidden bg-secondary"
              >
                {cover ? (
                  <Image
                    src={cover}
                    alt={p.title || ""}
                    fittingType="fill"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    {t("info_missing")}
                  </span>
                )}
              </Link>

              <PropertyBadgeRow
                property={p}
                size="md"
                lang={lang}
                className="absolute left-3 top-3 max-w-[calc(100%-4.5rem)]"
              />

              <button
                type="button"
                onClick={onClose}
                aria-label={en ? "Close" : "Închide"}
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-[0_1px_4px_rgba(0,0,0,0.28)] transition-transform hover:scale-105 dark:bg-neutral-900/92 dark:text-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <Link to={`/property/${p.id}`} className="block px-4 pt-3.5">
              <p className="text-2xl font-bold leading-none text-foreground tnum">
                {primary}
                <span className="ml-1 text-sm font-semibold text-muted-foreground">
                  {p.transaction_type === "SALE" ? "" : t("pc_permonth")}
                </span>
              </p>

              {specs && (
                <p className="mt-1.5 truncate text-sm font-semibold text-foreground/80">{specs}</p>
              )}

              <p className="mt-1 truncate text-sm text-muted-foreground">{place}</p>
            </Link>

            <div className="px-4 pb-4 pt-3.5">
              <Link
                to={`/property/${p.id}`}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-emerald px-5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.01]"
              >
                {en ? "View listing" : "Vezi anunțul"}
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
