import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import { PLAN_BY_ID, resolvePropertyPlan, planRank } from "@/lib/plans";
import { fetchActivePlanMap } from "@/lib/subscriptions";
import RecommendedPropertyCard from "@/components/RecommendedPropertyCard";
import { buildCoverMap } from "@/lib/covers";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 15;

// Destinația unică a butoanelor „Vezi mai multe" de pe homepage — indiferent
// de pe ce rând (Agent/Pro/Basic/fără plan) a fost apăsat, toate duc aici, la
// TOATE anunțurile, ordonate întâi după planul postatorului, apoi după
// vizualizări în interiorul aceluiași plan. Listă simplă, fără hartă — harta
// e o funcție separată, disponibilă la /map.
export default function RecommendedListings() {
  const { lang } = useCountry();
  const en = lang === "en";
  const [properties, setProperties] = useState(null);
  const [planMap, setPlanMap] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [props, map] = await Promise.all([
          base44.entities.Property.list("-views_count", 300),
          fetchActivePlanMap(),
        ]);
        if (cancelled) return;
        setProperties(props.filter((p) => p.approval_status === "APPROVED" && p.country === "RO"));
        setPlanMap(map);
      } catch (e) {
        if (!cancelled) { setProperties([]); setPlanMap(new Map()); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const coverMap = useMemo(() => buildCoverMap(properties || []), [properties]);

  const sorted = useMemo(() => {
    if (!properties || !planMap) return [];
    return properties
      .map((p) => ({ ...p, _plan: resolvePropertyPlan(p, planMap) || "none" }))
      .sort((a, b) => {
        const diff = planRank(b._plan) - planRank(a._plan);
        if (diff !== 0) return diff;
        return (b.views_count || 0) - (a.views_count || 0);
      });
  }, [properties, planMap]);

  const visible = sorted.slice(0, visibleCount);
  const loading = properties === null;

  const tierLabel = (id) => {
    if (id === "none") return en ? "No active plan" : "Fără plan activ";
    return PLAN_BY_ID[id]?.name || id;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 sm:mb-4 text-sm font-semibold text-muted-foreground transition hover:text-emerald">
        <ArrowLeft className="h-4 w-4" /> {en ? "Back to home" : "Înapoi acasă"}
      </Link>

      <h1 className="font-heading text-2xl font-bold text-navy dark:text-foreground sm:text-3xl">
        {en ? "All recommended listings" : "Toate anunțurile recomandate"}
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        {en
          ? "Ordered by the poster's plan first, then by views within the same plan."
          : "Ordonate întâi după planul celui care a postat, apoi după numărul de vizualizări."}
      </p>

      {loading ? (
        <div className="mt-5 grid grid-cols-2 sm:mt-8 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-52 rounded" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-5 rounded border border-dashed sm:mt-8 border-border py-9 text-center text-sm text-muted-foreground sm:py-16">
          {en ? "No listings yet." : "Niciun anunț momentan."}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 sm:mt-8 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {visible.map((p, i) => {
              const prevPlan = i > 0 ? visible[i - 1]._plan : null;
              const showDivider = p._plan !== prevPlan;
              return (
                <React.Fragment key={p.id}>
                  {showDivider && (
                    <div className="col-span-full mt-2 flex items-center gap-3 first:mt-0">
                      <span className="whitespace-nowrap text-xs font-bold uppercase tracking-widest text-muted-foreground">{tierLabel(p._plan)}</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <RecommendedPropertyCard property={p} planId={p._plan === "none" ? null : p._plan} coverMap={coverMap} />
                </React.Fragment>
              );
            })}
          </div>

          {visibleCount < sorted.length && (
            <div className="mt-5 flex justify-center sm:mt-8">
              <Button
                variant="outline"
                className="gap-1.5 rounded-full"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                {en ? "Load more" : "Încarcă mai multe"} <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
