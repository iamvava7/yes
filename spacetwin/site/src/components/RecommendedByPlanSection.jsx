import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import { PLANS, resolvePropertyPlan, compareByBoostThenViews } from "@/lib/plans";
import { fetchActivePlanMap } from "@/lib/subscriptions";
import RecommendedPropertyCard from "@/components/RecommendedPropertyCard";
import { buildCoverMap } from "@/lib/covers";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/AuthContext";

// Homepage — „Anunțuri recomandate", pe 4 rânduri distincte, delimitate strict
// de planul celui care a postat (Agent > Pro > Basic > fără plan), fiecare
// rând ordonat descrescător după vizualizări. Regula exactă: planul postatorului
// decide RÂNDUL, vizualizările decid doar ordinea în interiorul aceluiași rând
// — un anunț Agent cu puține vizualizări tot apare înaintea unui anunț Pro cu
// mai multe. Vezi src/lib/plans.js pentru sursa de adevăr a planurilor.
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "admin"];

export default function RecommendedByPlanSection() {
  const { lang } = useCountry();
  const { user } = useAuth();
  const en = lang === "en";
  // Un raft gol arată ca un magazin fără marfă, deci publicul vede doar
  // rândurile care au ceva în ele. Adminul le vede pe toate, goale sau nu: el
  // are nevoie de structura pe planuri ca să știe ce lipsește și unde, nu de o
  // pagină care tace.
  const isAdmin = ADMIN_ROLES.includes((user?.role || "").toUpperCase());
  const [properties, setProperties] = useState(null);
  const [planMap, setPlanMap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [props, map] = await Promise.all([
          base44.entities.Property.list("-views_count", 200),
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

  if (properties === null || planMap === null) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-16 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 rounded" />)}
        </div>
      </section>
    );
  }

  if (properties.length === 0) return null;

  // Harta de coperți se calculează pe TOATE anunțurile, nu pe rând, ca
  // acelasi duplicat sa nu reapara in doua randuri diferite.
  const coverMap = buildCoverMap(properties);

  const grouped = { agent: [], pro: [], basic: [], none: [] };
  for (const p of properties) {
    const plan = resolvePropertyPlan(p, planMap) || "none";
    (grouped[plan] || grouped.none).push(p);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(compareByBoostThenViews);
  }

  const rows = [
    ...PLANS.slice().reverse().map((plan) => ({ ...plan, items: grouped[plan.id] || [] })),
    { id: "none", name: en ? "Other listings" : "Alte anunțuri", items: grouped.none },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-16 lg:px-8">
      {rows.map((row) => (
        <PlanRow key={row.id} row={row} en={en} coverMap={coverMap} showEmpty={isAdmin} />
      ))}
    </section>
  );
}

function PlanRow({ row, en, coverMap, showEmpty = false }) {
  // Publicul nu vede rafturi goale. Adminul da — vezi nota din componenta de
  // deasupra.
  const empty = row.items.length === 0;
  if (empty && !showEmpty) return null;

  const visible = row.items.slice(0, 8);

  return (
    <div className="mb-7 last:mb-0 sm:mb-10">
      {/* Titlul întâi, insigna după el. Cât timp insigna stătea înaintea
          cuvantului, rândurile cu plan își începeau titlul la 54px, iar cele
          fără plan la 16px — două margini din stânga diferite pe aceeași
          pagină, și niciuna peste cardurile de dedesubt. Acum toate titlurile
          pornesc din gutieră, exact de unde pornesc și cardurile. */}
      <div className="mb-3 flex items-center gap-2.5 sm:mb-4">
        <h2 className="text-base font-bold text-foreground sm:text-xl">{row.shortName || row.name}</h2>
        {row.badgeImg && (
          <img
            src={row.badgeImg}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="h-7 w-7 shrink-0 object-contain drop-shadow-sm sm:h-8 sm:w-8"
          />
        )}
        <Link
          to="/anunturi-recomandate"
          className="ml-auto tap-44 flex shrink-0 items-center text-sm font-bold text-emerald transition-transform hover:translate-x-0.5"
        >
          {en ? "See all" : "Vezi tot"} <span aria-hidden="true">→</span>
        </Link>
      </div>

      {/* Carduri late pe telefon: un rând de defilare cu o carte și un pic din
          următoarea, nu cinci miniaturi de 168px.
          `scroll-px-4` NU e decorativ. Banda iese din marginea secțiunii cu
          -mx-4 și își pune gutiera înapoi cu px-4, deci primul card ar trebui să
          înceapă la 16px, fix sub titlu. Dar cu snap-mandatory, punctul de
          oprire al unui copil `snap-start` se aliniază la marginea zonei de
          derulare, adică la CUTIA DE PADDING, nu la conținut: browserul
          derula singur banda cu exact 16px la încărcare și lipea primul card
          de marginea ecranului. scroll-padding mută punctul de oprire pe
          gutieră, deci scrollLeft rămâne 0 și cardul stă unde îi e locul. */}
      {empty ? (
        <p className="py-5 text-sm text-muted-foreground">
          {en ? "No listings on this plan yet." : "Niciun anunț pe acest plan deocamdată."}
        </p>
      ) : (
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 sm:mx-0 sm:gap-4 sm:px-0 sm:scroll-px-0">
        {visible.map((p) => (
          <div
            key={p.id}
            className="w-[46vw] max-w-[210px] shrink-0 snap-start sm:w-[220px] lg:w-[240px]"
          >
            <RecommendedPropertyCard property={p} planId={row.id === "none" ? null : row.id} coverMap={coverMap} />
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
