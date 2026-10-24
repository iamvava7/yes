import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import SimilarPropertyCard from "@/components/SimilarPropertyCard";
import { buildCoverMap } from "@/lib/covers";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/reveal";

// Până la 6 proprietăți similare, din același oraș, recomandate după vizualizări.
// Afișate într-un carusel orizontal (scroll stânga→dreapta) cu buton "Vezi toate".
export default function SimilarProperties({ property }) {
  const { t } = useCountry();
  const [items, setItems] = useState(null);
  const coverMap = useMemo(() => buildCoverMap(items || []), [items]);
  const scrollerRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const all = await base44.entities.Property.list("-views_count", 100);
        if (!alive) return;
        const same = all.filter(
          (p) => p.city === property.city && p.id !== property.id && (p.approval_status || "APPROVED") === "APPROVED"
        );
        if (same.length < 6) {
          const extra = all.filter(
            (p) => p.id !== property.id && (p.approval_status || "APPROVED") === "APPROVED" && p.city !== property.city
          );
          setItems([...same, ...extra].slice(0, 6));
        } else {
          setItems(same.slice(0, 6));
        }
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => { alive = false; };
  }, [property]);

  const scrollBy = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (!items) {
    return (
      <div className="flex gap-3 overflow-hidden sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-64 w-[220px] shrink-0 rounded sm:w-64" />)}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <Reveal className="overflow-hidden rounded border border-border bg-white p-4 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold text-navy dark:text-foreground sm:text-lg">{t("similar_h")}</h3>
            <p className="truncate text-xs text-muted-foreground">{t("similar_sub", { city: property.city })}</p>
          </div>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <button onClick={() => scrollBy(-1)} aria-label="Anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:bg-secondary dark:bg-card">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scrollBy(1)} aria-label="Următor"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:bg-secondary dark:bg-card">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-2 sm:mt-4 sm:gap-4"
        style={{ scrollSnapType: "x proximity", WebkitOverflowScrolling: "touch" }}
      >
        {items.map((p) => (
          <div key={p.id} className="w-[220px] shrink-0 sm:w-64 lg:w-72" style={{ scrollSnapAlign: "start" }}>
            <SimilarPropertyCard property={p} hot={p.featured} coverMap={coverMap} />
          </div>
        ))}

        {/* Card final — Vezi toate */}
        <Link
          to={`/search?city=${encodeURIComponent(property.city || "")}`}
          className="group flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-emerald/40 bg-emerald-soft/40 p-4 text-center sm:gap-3 sm:p-6 transition hover:border-emerald hover:bg-emerald-soft sm:w-48"
          style={{ scrollSnapAlign: "start" }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald text-white shadow-soft transition group-">
            <ArrowRight className="h-6 w-6" />
          </div>
          <p className="text-sm font-bold text-navy dark:text-foreground">{t("view_all")}</p>
          <p className="text-[11px] text-muted-foreground">{property.city}</p>
        </Link>
      </div>
    </Reveal>
  );
}