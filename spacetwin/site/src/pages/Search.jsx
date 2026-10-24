import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCountry } from "@/components/CountryContext";
import { getCities, getZones } from "@/components/locations";
import PropertyCard from "@/components/PropertyCard";
import { buildCoverMap } from "@/lib/covers";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { BookmarkPlus, RotateCcw, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import SearchFiltersDrawer from "@/components/SearchFiltersDrawer";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { resolvePropertyPlan, PLAN_FILTER_OPTIONS, compareByBoostThenViews } from "@/lib/plans";
import { fetchActivePlanMap } from "@/lib/subscriptions";

// VerifiCasa verification filters — each applies a real-property predicate.
// Plain text pills: no ornament icons, the label carries the meaning.
const VERIF_FILTERS = [
  { key: "ai", labelKey: "tg_ai", test: (p) => !!p.tour_3d_url || !!p.ai_video_url || !!p.ai_tour_verified },
  { key: "field", labelKey: "tg_field", test: (p) => p.owner_verified || p.verification_level === "field_certified" || p.ai_tour_verified },
  { key: "pet", labelKey: "tg_pet", test: (p) => !!p.pet_friendly },
  { key: "nofee", labelKey: "tg_nofee", test: (p) => !!p.commission_free },
  { key: "studio", labelKey: "type_studio_vc", test: (p) => ["Garsonieră", "Studio"].includes(p.property_type) },
  { key: "2camere", labelKey: "type_2_vc", test: (p) => p.property_type === "2 Camere" },
  { key: "parking", labelKey: "sr_parking", test: (p) => !!p.parking },
];

const makeFairness = (t) => [
  { value: "", label: t("sr_fairness_all") },
  { value: "sub_piata", label: t("sr_fairness_below") },
  { value: "corect", label: t("sr_fairness_fair") },
  { value: "peste_medie", label: t("sr_fairness_above") },
];

// Cate anunturi intra intr-o pagina. Multipli de 12, ca randul sa se umple si
// pe grila de 2 coloane (telefon larg) si pe cea de 3 (desktop) — 10 lasa
// mereu un card singur pe ultimul rand. Plafonul e 200, cat aduce list() de la
// server, deci 48 nu poate depasi ce avem in mana.
const PER_PAGE_OPTIONS = [12, 24, 48];
const DEFAULT_PER_PAGE = 12;

const makeSort = (t) => [
  { value: "", label: t("sr_sort") },
  { value: "newest", label: t("sr_sort_newest") },
  { value: "price_asc", label: t("sr_sort_asc") },
  { value: "price_desc", label: t("sr_sort_desc") },
];

// Normalize text for diacritics-insensitive fuzzy matching so "Pacurari" matches
// "Păcurari", "Husi" matches "Huși", etc. — independent of how users type zones.
const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function SearchPage() {
  const { country, t, lang } = useCountry();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [properties, setProperties] = useState(null);
  const [planMap, setPlanMap] = useState(null);
  const [budget, setBudget] = useState("");
  const [roomsMin, setRoomsMin] = useState("");
  const [surfaceMin, setSurfaceMin] = useState("");
  const [furnished, setFurnished] = useState(false);
  const [swap, setSwap] = useState(false);
  const [fairness, setFairness] = useState("");
  const [sort, setSort] = useState("");
  const [page, setPage] = useState(1);

  const cityParam = params.get("city");
  const zoneParam = params.get("zone");
  const typeParam = params.get("type");
  const qParam = params.get("q") || "";
  const setQ = (v) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (v) next.set("q", v); else next.delete("q");
    return next;
  }, { replace: true });

  // Marimea paginii traieste in URL, ca sa plece cu o cautare salvata sau cu un
  // link trimis mai departe. Orice valoare din afara listei cade pe implicit.
  const perParam = parseInt(params.get("per"), 10);
  const perPage = PER_PAGE_OPTIONS.includes(perParam) ? perParam : DEFAULT_PER_PAGE;
  const updatePer = (val) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (Number(val) === DEFAULT_PER_PAGE) next.delete("per"); else next.set("per", val);
    return next;
  }, { replace: true });

  const cities = useMemo(() => getCities(country), [country]);
  const cityFilter = cityParam || "";
  const zones = useMemo(() => getZones(country, cityFilter), [country, cityFilter]);
  const zoneFilter = zoneParam || "";

  // Selectorii de oraș/zonă actualizează direct URL-ul, deci rezultatele se
  // re-filtrează instant, în timp real — fără refresh. Plus buton de recautare.
  const updateCity = (val) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (val) next.set("city", val); else next.delete("city");
    next.delete("zone");
    return next;
  }, { replace: true });
  const updateZone = (val) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (val) next.set("zone", val); else next.delete("zone");
    return next;
  }, { replace: true });

  const [activeFilters, setActiveFilters] = useState(() => {
    const s = new Set();
    VERIF_FILTERS.forEach((f) => { if (params.get(f.key) === "1") s.add(f.key); });
    return s;
  });
  const [planFilters, setPlanFilters] = useState(() => {
    const raw = params.get("plan");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  });

  // Real-time: admin approvals/deletes or new listings appear live in results.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [all, map] = await Promise.all([
          base44.entities.Property.list("-created_date", 200),
          fetchActivePlanMap(),
        ]);
        if (cancelled) return;
        setProperties(all);
        setPlanMap(map);
      } catch (e) {
        if (!cancelled) { setProperties([]); setPlanMap(new Map()); }
      }
    };
    run();
    const unsub = base44.entities.Property.subscribe(() => run());
    return () => { cancelled = true; try { unsub && unsub(); } catch { /* noop */ } };
  }, []);

  // Reset to first page whenever filters change
  useEffect(() => { setPage(1); }, [cityParam, zoneParam, typeParam, qParam, perPage, budget, roomsMin, surfaceMin, furnished, swap, fairness, sort, activeFilters.size, planFilters.size]);

  const toggle = (key) => {
    setActiveFilters((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      // sync to URL
      const next = new URLSearchParams(params);
      if (n.has(key)) next.set(key, "1"); else next.delete(key);
      setParams(next, { replace: true });
      return n;
    });
  };

  const togglePlan = (id) => {
    setPlanFilters((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      const next = new URLSearchParams(params);
      if (n.size > 0) next.set("plan", Array.from(n).join(",")); else next.delete("plan");
      setParams(next, { replace: true });
      return n;
    });
  };

  const coverMap = useMemo(() => buildCoverMap(properties || []), [properties]);

  let filtered = (properties || []).filter((p) => {
    if (p.approval_status !== "APPROVED") return false;
    if (p.country !== "RO") return false;
    if (cityParam && !norm(p.city).includes(norm(cityParam))) return false;
    if (zoneParam && !norm(`${p.zone || ""} ${p.landmark || ""}`).includes(norm(zoneParam))) return false;
    if (typeParam && p.property_type !== typeParam) return false;
    if (qParam) {
      const hay = norm([p.title, p.zone, p.city, p.landmark, p.description, p.property_type, p.property_code].join(" "));
      if (!hay.includes(norm(qParam))) return false;
    }
    for (const f of VERIF_FILTERS) {
      if (activeFilters.has(f.key) && !f.test(p)) return false;
    }
    if (planFilters.size > 0) {
      const plan = resolvePropertyPlan(p, planMap) || "none";
      if (!planFilters.has(plan)) return false;
    }
    if (budget) { const max = parseInt(budget, 10); if (!isNaN(max) && p.price_monthly > max) return false; }
    if (roomsMin) { const r = parseInt(roomsMin, 10); if (!isNaN(r) && (p.rooms == null || p.rooms < r)) return false; }
    if (surfaceMin) { const s = parseFloat(surfaceMin); if (!isNaN(s) && (p.surface_sqm == null || p.surface_sqm < s)) return false; }
    if (furnished && !p.furnished) return false;
    if (swap && !p.is_swap_available) return false;
    if (fairness && p.price_fairness !== fairness) return false;
    return true;
  });

  // Sortarea explicit aleasă de utilizator câștigă mereu: un boost nu are voie
  // să răstoarne „cele mai ieftine întâi". Doar ordinea implicită dă
  // promovatelor prioritate, iar cardurile o declară ca plasare plătită.
  if (sort === "price_asc") filtered = [...filtered].sort((a, b) => (a.price_monthly || 0) - (b.price_monthly || 0));
  else if (sort === "price_desc") filtered = [...filtered].sort((a, b) => (b.price_monthly || 0) - (a.price_monthly || 0));
  else if (sort === "newest") filtered = [...filtered].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  else filtered = [...filtered].sort(compareByBoostThenViews);

  const found = filtered.length;
  const PER_PAGE = perPage;
  const totalPages = Math.max(1, Math.ceil(found / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);
  const goPage = (pn) => { setPage(pn); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const saveSearch = async () => {
    if (!isAuthenticated) { toast({ title: t("sr_save_login"), variant: "destructive" }); return; }
    const qs = params.toString();
    if (!qs) { toast({ title: t("sr_save_empty"), variant: "destructive" }); return; }
    const parts = [];
    if (cityParam) parts.push(cityParam);
    if (zoneParam) parts.push(zoneParam);
    if (typeParam) parts.push(typeParam);
    const label = parts.length ? parts.join(" · ") : t("sr_all");
    try {
      await base44.entities.SavedSearch.create({ user_id: user.id, label, query_string: qs });
      toast({ title: t("sr_save_ok"), description: t("sr_save_ok_desc") });
    } catch (e) { toast({ title: t("sr_save_err"), variant: "destructive" }); }
  };

  const resetFilters = () => {
    setBudget(""); setRoomsMin(""); setSurfaceMin("");
    setFurnished(false); setSwap(false); setFairness(""); setSort("");
    setActiveFilters(new Set());
    setPlanFilters(new Set());
    setParams(new URLSearchParams(), { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <Reveal className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-6" y={16}>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
            {cityParam || zoneParam || typeParam || qParam ? t("sr_results") : t("sr_all")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cityParam && `${t("sr_city_select")}: ${cityParam} · `}
            {zoneParam && `${t("sr_zone_select")}: ${zoneParam} · `}
            {typeParam && `${t("sr_type")}: ${typeParam} · `}
            {qParam && `${t("sr_search_label")}: "${qParam}" · `}
            {found === 1 ? t("sr_found_one", { n: found }) : t("sr_found_many", { n: found })}
          </p>
        </div>
        {/* Pe telefon golirea filtrelor și salvarea căutării sunt acțiuni
            secundare: rămân doar iconițe și urcă pe rândul titlului, în loc să
            ceară un rând întreg de 44px deasupra rezultatelor. */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            onClick={resetFilters}
            variant="outline"
            aria-label={t("sr_reset_filters")}
            className="tap-44 h-9 w-9 shrink-0 gap-1.5 rounded-full border-border p-0 text-foreground hover:border-emerald hover:text-emerald sm:h-11 sm:w-auto sm:px-4"
          >
            <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">{t("sr_reset_filters")}</span>
          </Button>
          <Button
            onClick={saveSearch}
            variant="outline"
            aria-label={t("sr_save_search")}
            className="tap-44 h-9 w-9 shrink-0 gap-1.5 rounded-full border-border p-0 text-foreground hover:border-emerald hover:text-emerald sm:h-11 sm:w-auto sm:px-4"
          >
            <BookmarkPlus className="h-4 w-4" /> <span className="hidden sm:inline">{t("sr_save_search")}</span>
          </Button>
        </div>
      </Reveal>

      {/* Pe telefon filtrele nu mai ocupă patru rânduri: căutarea liberă sus pe
          tot rândul (e acțiunea principală), oraș și zonă alături dedesubt, apoi
          paginarea și filtrele avansate. Pe ecran mare rămâne rândul de dinainte. */}
      <div className="mb-4 grid grid-cols-2 items-center gap-2 sm:mb-5 sm:flex sm:flex-wrap sm:gap-3">
        <select
          value={cityFilter}
          onChange={(e) => updateCity(e.target.value)}
          className="vc-select order-2 tap-44 h-10 w-full min-w-0 rounded-full border border-border bg-background py-0 pl-4 pr-9 text-sm font-medium text-foreground outline-none focus:border-emerald dark:bg-card sm:order-none sm:h-auto sm:min-h-[44px] sm:w-auto sm:py-2.5 sm:pr-10"
        >
          <option value="">{t("sr_city_select")}</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={zoneFilter}
          onChange={(e) => updateZone(e.target.value)}
          disabled={!cityFilter}
          className="vc-select order-3 tap-44 h-10 w-full min-w-0 rounded-full border border-border bg-background py-0 pl-4 pr-9 text-sm font-medium text-foreground outline-none focus:border-emerald disabled:opacity-50 dark:bg-card sm:order-none sm:h-auto sm:min-h-[44px] sm:w-auto sm:py-2.5 sm:pr-10"
        >
          <option value="">{t("sr_zone_select")}</option>
          {zones.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
        <select
          value={perPage}
          onChange={(e) => updatePer(e.target.value)}
          aria-label={t("sr_per_page")}
          className="vc-select order-4 tap-44 h-10 w-full min-w-0 rounded-full border border-border bg-background py-0 pl-4 pr-9 text-sm font-medium text-foreground outline-none focus:border-emerald dark:bg-card sm:order-none sm:h-auto sm:min-h-[44px] sm:w-auto sm:py-2.5 sm:pr-10"
        >
          {PER_PAGE_OPTIONS.map((n) => (
            <option key={n} value={n}>{t("sr_per_page_n", { n })}</option>
          ))}
        </select>
        <div className="relative order-1 col-span-2 sm:order-none sm:col-auto sm:min-w-[200px] sm:flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={qParam}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("sr_search_placeholder")}
            className="h-10 w-full rounded-full border border-border bg-background py-0 pl-11 pr-4 text-sm text-foreground outline-none focus:border-emerald dark:bg-card sm:h-auto sm:min-h-[44px] sm:py-2"
          />
        </div>

        {/* Filtrele avansate stau în același bloc, nu pe un rând propriu. */}
        <div className="order-5 flex items-center sm:order-none">
          <SearchFiltersDrawer
            t={t}
            filters={VERIF_FILTERS}
            activeFilters={activeFilters}
            onToggle={toggle}
            planOptions={PLAN_FILTER_OPTIONS}
            planFilters={planFilters}
            onTogglePlan={togglePlan}
            budget={budget} setBudget={setBudget}
            roomsMin={roomsMin} setRoomsMin={setRoomsMin}
            surfaceMin={surfaceMin} setSurfaceMin={setSurfaceMin}
            fairness={fairness} setFairness={setFairness}
            fairnessOptions={makeFairness(t)}
            furnished={furnished} setFurnished={setFurnished}
            swap={swap} setSwap={setSwap}
            sort={sort} setSort={setSort}
            sortOptions={makeSort(t)}
            onReset={resetFilters}
          />
        </div>
      </div>


      {properties === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      ) : found === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center sm:py-20">
          <p className="font-heading text-xl font-semibold text-foreground">{t("sr_empty_title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("sr_empty_sub")}</p>
          <button type="button" onClick={resetFilters} className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-emerald px-5 text-sm font-bold text-primary-foreground transition-[transform,background-color] duration-200 ease-out hover:bg-emerald/90 active:scale-[0.96]">
            {t("sr_reset_filters")} <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : (
        <>
          {/* once={false} so a filter change or a page turn can never leave a
              card stuck at opacity 0; the key replays the stagger per page. */}
          <RevealGroup key={safePage} once={false} stagger={0.06} className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {paged.map((p) => (
              <RevealItem key={p.id}>
                <PropertyCard property={p} coverMap={coverMap} />
              </RevealItem>
            ))}
          </RevealGroup>

          {totalPages > 1 && (() => {
            const MAX_VISIBLE = 5;
            let start = Math.max(1, safePage - Math.floor(MAX_VISIBLE / 2));
            let end = Math.min(totalPages, start + MAX_VISIBLE - 1);
            start = Math.max(1, end - MAX_VISIBLE + 1);
            const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            return (
              <div className="mt-7 flex flex-col items-center gap-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {lang === "en"
                    ? `${found} listings · Page ${safePage} of ${totalPages}`
                    : `${found} anunțuri · Pagina ${safePage} din ${totalPages}`}
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => goPage(Math.max(1, safePage - 1))} disabled={safePage === 1} aria-label={lang === "en" ? "Previous page" : "Pagina anterioară"}
                    className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {start > 1 && <span className="px-1 text-muted-foreground">…</span>}
                  {pages.map((pn) => (
                    <button key={pn} onClick={() => goPage(pn)}
                      className={"tap-44 h-9 min-w-[36px] rounded-full px-2 text-sm font-semibold tnum transition-colors " +
                        (pn === safePage ? "bg-emerald text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-secondary")}>
                      {pn}
                    </button>
                  ))}
                  {end < totalPages && <span className="px-1 text-muted-foreground">…</span>}
                  <button onClick={() => goPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} aria-label={lang === "en" ? "Next page" : "Pagina următoare"}
                    className="tap-44 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}